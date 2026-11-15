#!/usr/bin/env bash
# Uso (desde cualquier carpeta):  bash scripts/4to_entregable/validar-kyverno.sh
#
# Corre los manifiestos de k8s/policies/test/ contra las 4 politicas de Kyverno
# y guarda toda la salida en reports/kyverno-validation.log

# Ir a la raiz del repo (este script vive en scripts/4to_entregable/)
cd "$(dirname "$0")/../.." || exit 1

POLICIES_DIR="k8s/policies"
TEST_DIR="$POLICIES_DIR/test"
LOG="reports/kyverno-validation.log"
POLICIES=(disallow-latest-tag require-resources disallow-root require-probes)

k() { minikube kubectl -- "$@"; }

mkdir -p reports

# --- Chequeos previos ---------------------------------------------------
if ! minikube status >/dev/null 2>&1; then
  echo "ERROR: minikube no esta corriendo. Ejecuta 'minikube start' (y abri Docker Desktop)."
  exit 1
fi

echo "Esperando al admission controller de Kyverno..."
if ! k wait --for=condition=Ready pod \
      -l app.kubernetes.io/component=admission-controller \
      -n kyverno --timeout=90s >/dev/null 2>&1; then
  echo "ERROR: el admission controller de Kyverno no esta Ready."
  echo "Revisa: minikube kubectl -- get pods -n kyverno"
  exit 1
fi

# --- Encabezado del log -------------------------------------------------
{
  echo "=== Kyverno validation $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo
  echo "--- clusterpolicy ---"
  k get clusterpolicy 2>&1
} > "$LOG"

# Las 4 politicas tienen que estar instaladas
for p in "${POLICIES[@]}"; do
  if ! k get clusterpolicy "$p" >/dev/null 2>&1; then
    echo "ERROR: falta la politica '$p'. Instalala con: minikube kubectl -- apply -f $POLICIES_DIR/"
    exit 1
  fi
done

# --- Tanda de pruebas ---------------------------------------------------
shopt -s nullglob
files=("$TEST_DIR"/*.yaml)
if [ ${#files[@]} -eq 0 ]; then
  echo "ERROR: no hay manifiestos en $TEST_DIR"
  exit 1
fi

for f in "${files[@]}"; do
  {
    echo
    echo "--- $(basename "$f") ---"
    k apply -f "$f" 2>&1
    echo "(exit code: $?)"
  } >> "$LOG"
  # Si el pod fue aceptado, borrarlo para dejar el cluster limpio
  k delete -f "$f" --ignore-not-found >/dev/null 2>&1
done

# --- Resumen y verificacion --------------------------------------------
echo
echo "Log generado: $LOG"
echo "Verificacion (cada politica debe tener al menos un rechazo):"
missing=0
for p in "${POLICIES[@]}"; do
  if grep -q "^$p:" "$LOG"; then
    echo "  [OK]   $p"
  else
    echo "  [FALTA] $p  (ningun rechazo la nombra en el log)"
    missing=1
  fi
done

{
  echo
  echo "--- resumen ---"
  for p in "${POLICIES[@]}"; do
    if grep -q "^$p:" "$LOG"; then echo "$p: rechazo registrado"; else echo "$p: SIN rechazo registrado"; fi
  done
} >> "$LOG"

exit $missing
