#!/usr/bin/env bash
#
# Borra todo lo que levanta inicializar-todo.sh y confirma que no quede nada
# colgado. En este orden:
#   1. chart petcore (+ discos PVC y namespace petcore, con Prometheus y Grafana)
#   2. Falco
#   3. Kyverno: primero las politicas, despues el helm release, y por ultimo
#      los webhooks y CRDs que "helm uninstall" deja atras
#   4. addon ingress de minikube
#   5. verificacion final
#
# Uso (desde cualquier carpeta, en Git Bash):
#   bash scripts/4to_entregable/borrar-todo.sh
#   bash scripts/4to_entregable/borrar-todo.sh --con-jenkins      # tambien borra Jenkins (contenedor + volumen)
#   bash scripts/4to_entregable/borrar-todo.sh --borrar-cluster   # al final hace "minikube delete"
#
# No pide confirmacion: borra tambien los datos de Postgres (el disco PVC).
# No toca db/*.txt, las imagenes construidas en minikube ni el monitoreo viejo
# del namespace clinica-veterinaria (entregables 1 a 3).
# Se puede correr las veces que haga falta: lo que ya no existe se saltea.

# Sin "set -e" a proposito: si un paso falla, se avisa y se sigue con el resto
# para dejar la mayor parte limpia; el resultado final lo da la verificacion.
set -uo pipefail

# Git Bash (MSYS) traduce rutas tipo "/algo" a rutas de Windows antes de
# pasarlas a programas externos. Esto lo desactiva para todo el script.
export MSYS_NO_PATHCONV=1

NAMESPACE="petcore"
CONTENEDOR_JENKINS="petcore-jenkins"
VOLUMEN_JENKINS="petcore-jenkins-home"

CON_JENKINS=0
BORRAR_CLUSTER=0
for arg in "$@"; do
    case "$arg" in
        --con-jenkins)    CON_JENKINS=1 ;;
        --borrar-cluster) BORRAR_CLUSTER=1 ;;
        -h|--ayuda)
            sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Opcion desconocida: $arg (usa --ayuda)" >&2; exit 1 ;;
    esac
done

kc() { minikube kubectl -- "$@"; }
hm() { helm --kube-context minikube "$@"; }

paso() { printf '\n==> %s\n' "$*"; }
aviso() { printf '  AVISO: %s\n' "$*" >&2; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

release_existe() { hm list -n "$1" -q 2>/dev/null | grep -qx "$2"; }
namespace_existe() { kc get namespace "$1" >/dev/null 2>&1; }

# Espera hasta N segundos a que un namespace termine de borrarse.
esperar_namespace_borrado() {
    local ns="$1" segundos="${2:-120}" i
    for i in $(seq 1 "$segundos"); do
        namespace_existe "$ns" || return 0
        sleep 1
    done
    return 1
}

# --- Chequeos previos -------------------------------------------------------

command -v minikube >/dev/null || error "No se encuentra minikube."
command -v helm     >/dev/null || error "No se encuentra helm."

PENDIENTES=0
CLUSTER_ACTIVO=0
estado="$(minikube status --format '{{.Host}}' 2>/dev/null || true)"
if [[ "$estado" == "Running" ]] && kc get nodes >/dev/null 2>&1; then
    CLUSTER_ACTIVO=1
else
    aviso "minikube no esta corriendo: no hay nada que borrar dentro del cluster."
fi

if [[ "$CLUSTER_ACTIVO" -eq 1 ]]; then

    # --- 1. petcore ---------------------------------------------------------

    paso "1/4 Borrando petcore (chart, discos y namespace $NAMESPACE)"
    if release_existe "$NAMESPACE" petcore; then
        hm uninstall petcore -n "$NAMESPACE" --wait --timeout 3m || aviso "no pude desinstalar el release petcore"
    else
        echo "El release petcore ya no existe."
    fi

    if namespace_existe "$NAMESPACE"; then
        # "helm uninstall" NO borra el disco de Postgres (a proposito, para no
        # perder datos): se borra a mano, despues de que el pod ya no exista.
        kc delete pvc --all -n "$NAMESPACE" --timeout=120s || aviso "no pude borrar los PVC de $NAMESPACE"
        # Borrar el namespace se lleva tambien Prometheus y Grafana.
        kc delete namespace "$NAMESPACE" --ignore-not-found --timeout=180s || aviso "el namespace $NAMESPACE no termino de borrarse"
    else
        echo "El namespace $NAMESPACE ya no existe."
    fi
    # Recursos de todo el cluster (no viven dentro del namespace)
    kc delete clusterrolebinding,clusterrole petcore-prometheus --ignore-not-found >/dev/null 2>&1 || true

    # --- 2. Falco -----------------------------------------------------------

    paso "2/4 Desinstalando Falco"
    if release_existe falco falco; then
        hm uninstall falco -n falco --wait --timeout 3m || aviso "no pude desinstalar Falco"
    else
        echo "El release falco ya no existe."
    fi
    kc delete namespace falco --ignore-not-found --timeout=120s || aviso "el namespace falco no termino de borrarse"
    # Por si el chart dejo algun CRD de Falco
    kc get crd -o name 2>/dev/null | grep -i falco | while read -r crd; do
        kc delete "$crd" --ignore-not-found --timeout=120s || aviso "no pude borrar $crd"
    done

    # --- 3. Kyverno ---------------------------------------------------------
    # Las politicas se borran ANTES de desinstalar Kyverno, mientras su
    # controlador todavia puede procesar los borrados.

    paso "3/4 Desinstalando Kyverno y sus politicas"
    if kc get crd clusterpolicies.kyverno.io >/dev/null 2>&1; then
        kc delete clusterpolicy --all --timeout=60s || aviso "no pude borrar las ClusterPolicy"
    fi

    if release_existe kyverno kyverno; then
        hm uninstall kyverno -n kyverno --wait --timeout 5m || aviso "no pude desinstalar Kyverno"
    else
        echo "El release kyverno ya no existe."
    fi

    # "helm uninstall" puede dejar los webhooks: con failurePolicy Fail y sin
    # backend, bloquearian la creacion de TODOS los pods del cluster.
    kc get validatingwebhookconfiguration,mutatingwebhookconfiguration -o name 2>/dev/null | grep -i kyverno | while read -r wh; do
        kc delete "$wh" --ignore-not-found || aviso "no pude borrar $wh"
    done

    # Tampoco borra los CRDs (kyverno.io, policies.kyverno.io, reports.kyverno.io, wgpolicyk8s.io...).
    kc get crd -o name 2>/dev/null | grep -E 'kyverno\.io|wgpolicyk8s\.io' | while read -r crd; do
        kc delete "$crd" --ignore-not-found --timeout=120s || aviso "no pude borrar $crd"
    done
    kc delete namespace kyverno --ignore-not-found --timeout=120s || aviso "el namespace kyverno no termino de borrarse"

    # --- 4. Ingress ---------------------------------------------------------
    # inicializar-todo.sh lo activa; se desactiva aca (con Kyverno ya afuera).

    paso "4/4 Desactivando el addon ingress de minikube"
    if namespace_existe ingress-nginx; then
        minikube addons disable ingress || aviso "no pude desactivar el addon ingress"
        esperar_namespace_borrado ingress-nginx 90 || aviso "el namespace ingress-nginx no termino de borrarse"
    else
        echo "El addon ingress ya estaba desactivado."
    fi
fi

# --- Jenkins (opcional) -----------------------------------------------------

if [[ "$CON_JENKINS" -eq 1 ]]; then
    paso "Borrando Jenkins ($CONTENEDOR_JENKINS y su volumen)"
    if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
        docker rm -f "$CONTENEDOR_JENKINS" >/dev/null 2>&1 && echo "Contenedor borrado." || echo "El contenedor no existia."
        docker volume rm "$VOLUMEN_JENKINS" >/dev/null 2>&1 && echo "Volumen borrado." || echo "El volumen no existia."
    else
        aviso "Docker no esta corriendo: no pude borrar Jenkins."
        PENDIENTES=$((PENDIENTES + 1))
    fi
fi

# --- Verificacion -----------------------------------------------------------

if [[ "$BORRAR_CLUSTER" -eq 1 ]]; then
    paso "Borrando el cluster de minikube"
    minikube delete
    echo
    echo "Cluster borrado: no hay nada mas que verificar."
    exit $(( PENDIENTES > 0 ? 1 : 0 ))
fi

if [[ "$CLUSTER_ACTIVO" -eq 1 ]]; then
    paso "Verificando que no quedaron recursos"

    # Los PV de minikube se borran solos cuando se borra su PVC, pero tardan unos segundos.
    for _ in $(seq 1 30); do
        [[ -z "$(kc get pv -o name 2>/dev/null)" ]] && break
        sleep 1
    done

    chequear() {  # chequear "descripcion" <valor vacio = OK>
        if [[ -z "$2" ]]; then
            printf '  [OK]        %s\n' "$1"
        else
            printf '  [PENDIENTE] %s: %s\n' "$1" "$(tr '\n' ' ' <<<"$2")"
            PENDIENTES=$((PENDIENTES + 1))
        fi
    }

    for ns in "$NAMESPACE" falco kyverno ingress-nginx; do
        existe=""
        namespace_existe "$ns" && existe="el namespace sigue existiendo"
        chequear "namespace $ns borrado" "$existe"
    done

    chequear "sin releases de Helm (petcore, falco, kyverno)" \
        "$(hm list -A -q 2>/dev/null | grep -xE 'petcore|falco|kyverno' || true)"
    chequear "sin CRDs de Kyverno" \
        "$(kc get crd -o name 2>/dev/null | grep -E 'kyverno\.io|wgpolicyk8s\.io' || true)"
    chequear "sin CRDs de Falco" \
        "$(kc get crd -o name 2>/dev/null | grep -i falco || true)"
    chequear "sin webhooks de Kyverno" \
        "$(kc get validatingwebhookconfiguration,mutatingwebhookconfiguration -o name 2>/dev/null | grep -i kyverno || true)"
    chequear "sin ClusterRole/Binding de Prometheus (petcore-prometheus)" \
        "$(kc get clusterrole,clusterrolebinding -o name 2>/dev/null | grep 'petcore-prometheus' || true)"
    chequear "sin volumenes persistentes (PV)" \
        "$(kc get pv -o name 2>/dev/null || true)"
fi

echo
if [[ "$PENDIENTES" -eq 0 ]]; then
    echo "Todo borrado. Para volver a levantarlo: bash scripts/4to_entregable/inicializar-todo.sh"
    exit 0
else
    echo "Quedaron $PENDIENTES cosas pendientes (ver arriba). Podes volver a correr este script: saltea lo que ya no existe."
    exit 1
fi
