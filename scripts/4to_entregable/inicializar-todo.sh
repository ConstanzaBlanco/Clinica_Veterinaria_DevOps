#!/usr/bin/env bash
#
# Punto de entrada unico de la entrega final: levanta TODO el proyecto en
# minikube, en este orden:
#   1. minikube + addon ingress
#   2. imagenes y recursos previos (preparar-chart.sh) + helm chart "petcore"
#   3. Kyverno (helm) + las 4 politicas de k8s/policies/
#   4. Falco (helm)
#   5. Prometheus y Grafana en el namespace petcore (k8s/entrega-final/)
#   6. (opcional) Jenkins
#
# Uso (desde cualquier carpeta, en Git Bash):
#   bash scripts/4to_entregable/inicializar-todo.sh
#   bash scripts/4to_entregable/inicializar-todo.sh --con-jenkins
#
# Variables opcionales:
#   MINIKUBE_ARGS="--driver=docker --memory=4096"   (solo afecta si el cluster no existe)
#
# Se puede correr las veces que haga falta: todo es "install or upgrade".

set -euo pipefail

# Git Bash (MSYS) traduce rutas tipo "/algo" a rutas de Windows antes de
# pasarlas a programas externos. Esto lo desactiva para todo el script.
export MSYS_NO_PATHCONV=1

NAMESPACE="petcore"
KYVERNO_VERSION="3.9.2"
FALCO_VERSION="9.2.2"
POLITICAS=(disallow-latest-tag require-resources disallow-root require-probes)

CON_JENKINS=0
for arg in "$@"; do
    case "$arg" in
        --con-jenkins) CON_JENKINS=1 ;;
        -h|--ayuda)
            sed -n '2,19p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Opcion desconocida: $arg (usa --ayuda)" >&2; exit 1 ;;
    esac
done

# Raiz del repo, sin importar desde donde se llame al script.
RAIZ="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$RAIZ"

# kubectl que trae minikube (misma version que el cluster).
kc() { minikube kubectl -- "$@"; }
hm() { helm --kube-context minikube "$@"; }

paso() { printf '\n==> %s\n' "$*"; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# Espera a que existan pods con ese label y a que queden Ready.
# (kubectl wait falla de inmediato si todavia no hay ningun pod que coincida.)
esperar_pods() {
    local ns="$1" selector="$2" timeout="${3:-180s}" i
    for i in $(seq 1 60); do
        if [[ -n "$(kc get pods -n "$ns" -l "$selector" -o name 2>/dev/null)" ]]; then
            break
        fi
        sleep 2
    done
    kc wait --for=condition=Ready pod -l "$selector" -n "$ns" --timeout="$timeout" >/dev/null \
        || error "Los pods ($selector) del namespace $ns no quedaron Ready. Revisa: minikube kubectl -- get pods -n $ns"
}

# Aplica un manifiesto de k8s/ que solo difiere del original en el namespace:
# lo transforma al vuelo (clinica-veterinaria -> petcore, y el filtro de pod
# api-monitoring-.+ -> api-.+ del dashboard) en vez de mantener una copia.
# Si despues de transformar queda algun nombre viejo, corta: quiere decir que
# ese archivo necesita una copia propia en k8s/entrega-final/.
aplicar_adaptado() {
    local archivo="$1" salida
    salida="$(sed -e 's/clinica-veterinaria/petcore/g' -e 's/api-monitoring-\.+/api-.+/g' "$archivo" | tr -d '\r')"
    if grep -qE 'clinica-veterinaria|api-monitoring' <<<"$salida"; then
        error "$archivo todavia menciona clinica-veterinaria/api-monitoring despues de adaptarlo. Hace una copia a mano en k8s/entrega-final/."
    fi
    printf '%s\n' "$salida" | kc apply -f -
}

# --- Chequeos previos -------------------------------------------------------

paso "Chequeando requisitos"

command -v docker   >/dev/null || error "No se encuentra docker. ¿Esta instalado Docker Desktop?"
command -v minikube >/dev/null || error "No se encuentra minikube."
command -v helm     >/dev/null || error "No se encuentra helm. Instalalo con: winget install --id Helm.Helm -e"
docker info >/dev/null 2>&1    || error "Docker Desktop no esta corriendo."

for archivo in \
    scripts/4to_entregable/preparar-chart.sh \
    helm-chart/Chart.yaml \
    k8s/entrega-final/prometheus-configmap.yaml \
    k8s/entrega-final/prometheus-rbac.yaml \
    k8s/entrega-final/prometheus-deployment.yaml \
    k8s/entrega-final/grafana-deployment.yaml \
    k8s/entrega-final/falco-values.yaml \
    k8s/prometheus-service.yaml \
    k8s/grafana-datasource-configmap.yaml \
    k8s/grafana-dashboard-configmap.yaml \
    k8s/grafana-alerting-configmap.yaml \
    k8s/grafana-service.yaml
do
    [[ -f "$archivo" ]] || error "Falta el archivo requerido: $archivo"
done
for p in "${POLITICAS[@]}"; do
    [[ -f "k8s/policies/$p.yaml" ]] || error "Falta la politica k8s/policies/$p.yaml"
done

# --- 1. minikube + ingress --------------------------------------------------

paso "1/6 minikube"
estado="$(minikube status --format '{{.Host}}' 2>/dev/null || true)"
if [[ "$estado" == "Running" ]]; then
    echo "minikube ya esta corriendo."
else
    read -r -a mk_args <<<"${MINIKUBE_ARGS:---driver=docker}"
    minikube start "${mk_args[@]}"
fi
kc get nodes >/dev/null || error "kubectl no puede hablar con el cluster."

# El addon se activa ANTES de instalar Kyverno y solo si no estaba activo:
# los pods del controller de ingress no cumplen las politicas (sin limits,
# sin runAsNonRoot), asi que volver a activarlo con Kyverno instalado los
# rechazaria.
if kc get namespace ingress-nginx >/dev/null 2>&1; then
    echo "El addon ingress ya estaba activo."
else
    minikube addons enable ingress
fi
esperar_pods ingress-nginx "app.kubernetes.io/component=controller"

# --- 2. imagenes, recursos previos y chart ----------------------------------

paso "2/6 Preparando imagenes y recursos (preparar-chart.sh)"
bash scripts/4to_entregable/preparar-chart.sh "$NAMESPACE"

paso "2/6 Instalando la chart petcore en el namespace $NAMESPACE"
hm upgrade --install petcore ./helm-chart --namespace "$NAMESPACE" --wait --timeout 5m

# --- 3. Kyverno + politicas -------------------------------------------------

paso "3/6 Instalando Kyverno $KYVERNO_VERSION"
hm repo add kyverno https://kyverno.github.io/kyverno/ --force-update >/dev/null
hm repo update >/dev/null
hm upgrade --install kyverno kyverno/kyverno \
    --namespace kyverno --create-namespace \
    --version "$KYVERNO_VERSION" \
    --wait --timeout 5m
esperar_pods kyverno "app.kubernetes.io/component=admission-controller"

paso "3/6 Aplicando las ${#POLITICAS[@]} politicas de Kyverno"
for p in "${POLITICAS[@]}"; do
    kc apply -f "k8s/policies/$p.yaml"
done
kc wait --for=condition=Ready clusterpolicy --all --timeout=120s >/dev/null \
    || error "Alguna politica no quedo Ready. Revisa: minikube kubectl -- get clusterpolicy"
kc get clusterpolicy

# --- 4. Falco ---------------------------------------------------------------
# Mismos parametros que scripts/k8s-up-falco.ps1, pero sin la captura
# interminable de logs (esa terminal no termina nunca y trabaria este script)
# y con la excepcion de Postgres apuntando al namespace petcore.

paso "4/6 Instalando Falco $FALCO_VERSION"
hm repo add falcosecurity https://falcosecurity.github.io/charts --force-update >/dev/null
hm repo update >/dev/null
hm upgrade --install falco falcosecurity/falco \
    --version "$FALCO_VERSION" \
    --namespace falco --create-namespace \
    --set driver.kind=modern_ebpf \
    --set tty=true \
    --set falco.json_output=true \
    --set falco.priority=notice \
    --set falco.buffered_outputs=false \
    --set falco.stdout_output.enabled=true \
    --values k8s/entrega-final/falco-values.yaml \
    --wait --timeout 5m

# --- 5. Prometheus y Grafana ------------------------------------------------

paso "5/6 Desplegando Prometheus y Grafana en $NAMESPACE"

# Si ya existian de una corrida anterior, hay que reiniciarlos para que
# relean sus ConfigMaps (Kubernetes no los recarga en caliente).
reiniciar=0
if kc get deployment prometheus -n "$NAMESPACE" >/dev/null 2>&1; then reiniciar=1; fi

# Copias propias (cambian mas que el namespace)
kc apply -f k8s/entrega-final/prometheus-configmap.yaml
kc apply -f k8s/entrega-final/prometheus-rbac.yaml
# Originales adaptados al vuelo
aplicar_adaptado k8s/grafana-datasource-configmap.yaml
aplicar_adaptado k8s/grafana-dashboard-configmap.yaml
aplicar_adaptado k8s/grafana-alerting-configmap.yaml
aplicar_adaptado k8s/prometheus-service.yaml
aplicar_adaptado k8s/grafana-service.yaml
# Deployments (copias propias: agregan la livenessProbe que exige Kyverno)
kc apply -f k8s/entrega-final/prometheus-deployment.yaml
kc apply -f k8s/entrega-final/grafana-deployment.yaml

if [[ "$reiniciar" -eq 1 ]]; then
    kc rollout restart deployment/prometheus deployment/grafana -n "$NAMESPACE"
fi
kc rollout status deployment/prometheus -n "$NAMESPACE" --timeout=180s
kc rollout status deployment/grafana    -n "$NAMESPACE" --timeout=180s

# --- 6. Jenkins (opcional) --------------------------------------------------

if [[ "$CON_JENKINS" -eq 1 ]]; then
    paso "6/6 Levantando Jenkins (jenkins-up.sh)"
    bash scripts/4to_entregable/jenkins-up.sh
else
    paso "6/6 Jenkins omitido (usa --con-jenkins para levantarlo)"
fi

# --- Listo ------------------------------------------------------------------

paso "Listo. Estado del cluster:"
kc get pods -n "$NAMESPACE"
kc get clusterpolicy

cat <<EOF

Siguientes pasos:
  Poblar los dashboards:   bash scripts/4to_entregable/poblar-dashboards.sh
  Abrir Grafana (admin/admin):
      minikube service grafana -n $NAMESPACE --url
  Abrir la app sin Ingress:
      minikube kubectl -- port-forward svc/frontend 8081:8080 -n $NAMESPACE
      (despues: http://localhost:8081)
  Borrar todo:             bash scripts/4to_entregable/borrar-todo.sh
EOF
