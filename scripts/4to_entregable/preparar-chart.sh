#!/usr/bin/env bash
#
# Deja listo en minikube todo lo que la Helm chart (helm-chart/) necesita y
# NO crea por sí misma:
#   - el namespace,
#   - los Secrets postgres-secret y jwt-secret (desde db/*.txt, que no están en git),
#   - el ConfigMap postgres-init con los SQL de db/init/,
#   - las imágenes de la API y del frontend, construidas DENTRO de minikube
#     con el tag de la chart.
#
# Uso (desde la raíz del repo, en Git Bash):
#   bash scripts/4to_entregable/preparar-chart.sh            # namespace "petcore"
#   bash scripts/4to_entregable/preparar-chart.sh otro-ns    # otro namespace
#
# Después:
#   helm install petcore ./helm-chart -n petcore
#
# Se puede correr las veces que haga falta: si algo ya existe, lo actualiza.

# -e: cortar ante el primer error / -u: error si se usa una variable sin definir /
# -o pipefail: un "a | b" falla si falla "a", no solo si falla "b".
set -euo pipefail

NAMESPACE="${1:-petcore}"

# Raíz del repo, sin importar desde dónde se llame al script ni en qué
# carpeta esté guardado: se la pregunta a git.
RAIZ="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$RAIZ"

# Tag de las imágenes = appVersion de Chart.yaml (el mismo que usa la chart
# por defecto). Se puede pisar con: TAG=0.1.1 bash scripts/4to_entregable/preparar-chart.sh
TAG="${TAG:-$(sed -n 's/^appVersion:[[:space:]]*"\{0,1\}\([^"]*\)"\{0,1\}[[:space:]]*$/\1/p' helm-chart/Chart.yaml | tr -d '\r')}"

# kubectl que trae minikube: misma versión que el cluster (el de Docker
# Desktop es más viejo y avisa incompatibilidades).
kc() { minikube kubectl -- "$@"; }

paso() { printf '\n==> %s\n' "$*"; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# --- Chequeos previos -------------------------------------------------------

paso "Chequeando requisitos"

command -v docker   >/dev/null || error "No se encuentra docker. ¿Está instalado Docker Desktop?"
command -v minikube >/dev/null || error "No se encuentra minikube."

[[ -n "$TAG" ]] || error "No pude leer appVersion de helm-chart/Chart.yaml."

for archivo in db/password.txt db/jwt-secret.txt; do
    [[ -s "$archivo" ]] || error "Falta $archivo (o está vacío). Ver README: 'Configurar la contraseña'."
done

ls db/init/*.sql >/dev/null 2>&1 || error "No hay scripts SQL en db/init/."

estado="$(minikube status --format '{{.Host}}' 2>/dev/null || true)"
[[ "$estado" == "Running" ]] || error "minikube no está corriendo (estado: '${estado:-desconocido}'). Corré: minikube start --driver=docker"

echo "OK. Namespace: $NAMESPACE | tag de imagen: $TAG"

# --- Recursos en el cluster -------------------------------------------------
# Patrón "create --dry-run=client -o yaml | apply -f -": genera el YAML del
# recurso sin crearlo y se lo pasa a apply, que lo crea si no existe o lo
# actualiza si ya existe. Un "kubectl create" a secas fallaría la segunda vez.

paso "1/5 Namespace $NAMESPACE"
kc create namespace "$NAMESPACE" --dry-run=client -o yaml | kc apply -f -

paso "2/5 Secrets (contraseña de Postgres y clave JWT)"
kc create secret generic postgres-secret \
    --from-file=db-password=db/password.txt \
    --namespace "$NAMESPACE" --dry-run=client -o yaml | kc apply -f -

kc create secret generic jwt-secret \
    --from-file=jwt-secret=db/jwt-secret.txt \
    --namespace "$NAMESPACE" --dry-run=client -o yaml | kc apply -f -

paso "3/5 ConfigMap postgres-init (SQL de db/init/)"
kc create configmap postgres-init \
    --from-file=db/init \
    --namespace "$NAMESPACE" --dry-run=client -o yaml | kc apply -f -

# --- Imagen -----------------------------------------------------------------
# "minikube image build" construye adentro de minikube, así el cluster la
# encuentra sin registry (por eso la chart usa pullPolicy: Never).

paso "4/5 Imagen de la API: clinica-veterinaria:$TAG (puede tardar unos minutos)"
minikube image build -t "clinica-veterinaria:$TAG" .

paso "5/5 Imagen del frontend: clinica-frontend:$TAG"
# Dockerfile.k8s es el multi-stage (Node compila, nginx sirve). Usa el
# nginx.conf por defecto, que reenvía /api/ al Service "api" de la chart.
minikube image build -t "clinica-frontend:$TAG" -f Dockerfile.k8s frontend

# --- Listo ------------------------------------------------------------------

paso "Listo. Recursos creados en $NAMESPACE:"
kc get secret,configmap --namespace "$NAMESPACE"

cat <<EOF

Siguiente paso, instalar la chart:
  helm install petcore ./helm-chart -n $NAMESPACE

Ver cómo arrancan los pods:
  kubectl get pods -n $NAMESPACE -w

Ojo: el ConfigMap postgres-init solo se usa la PRIMERA vez que arranca
Postgres con el disco vacío. Si cambiás un .sql de db/init/ con la base ya
creada, hay que borrar el disco (kubectl delete pvc -n $NAMESPACE --all).
EOF
