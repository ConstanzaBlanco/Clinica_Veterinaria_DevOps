#!/usr/bin/env bash
#
# Genera trafico real contra la API de petcore para que los paneles de
# Grafana tengan datos sin tocar el frontend. Hace lo que hoy se hace a mano:
#   - registra un cliente nuevo                      (clientes_registrados_total)
#   - falla el login a proposito unas veces          (logins_fallidos_total)
#   - inicia sesion bien con el cliente de prueba
#   - crea reservas de turnos a futuro               (turnos_creados_total)
#   - cancela la ultima reserva                      (turnos_cancelados_total)
#   - lista turnos varias veces                      (latencia HTTP y de PostgreSQL)
#
# Uso (desde cualquier carpeta, en Git Bash):
#   bash scripts/4to_entregable/poblar-dashboards.sh
#   bash scripts/4to_entregable/poblar-dashboards.sh --disparar-alertas
#
# Por defecto hace 4 reservas y 2 logins fallidos: se ven en los paneles pero
# NO superan los umbrales de alerta (mas de 10 reservas en 5 min, mas de 3
# logins fallidos en 1 min). Con --disparar-alertas hace 12 reservas y 4
# fallos para que las dos alertas pasen a Firing.
#
# Ojo: las reservas y el cliente registrado quedan guardados en la base.
# Nunca se hace un 5to login fallido seguido: bloquearia la cuenta 15 min.
#
# Variables opcionales:
#   PETCORE_EMAIL / PETCORE_PASSWORD   cliente de prueba (por defecto ana.cliente@petcore.com)
#   API_URL                            usar una API ya expuesta (omite el port-forward)
#   API_PORT                           puerto local del port-forward (por defecto 18000)

set -euo pipefail

# Git Bash (MSYS) traduce rutas tipo "/algo" a rutas de Windows antes de
# pasarlas a programas externos. Esto lo desactiva para todo el script.
export MSYS_NO_PATHCONV=1

NAMESPACE="petcore"
EMAIL="${PETCORE_EMAIL:-ana.cliente@petcore.com}"
PASSWORD="${PETCORE_PASSWORD:-Password123!}"
API_PORT="${API_PORT:-18000}"
API="${API_URL:-http://localhost:${API_PORT}}"

DISPARAR_ALERTAS=0
for arg in "$@"; do
    case "$arg" in
        --disparar-alertas) DISPARAR_ALERTAS=1 ;;
        -h|--ayuda)
            sed -n '2,27p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) echo "Opcion desconocida: $arg (usa --ayuda)" >&2; exit 1 ;;
    esac
done

if [[ "$DISPARAR_ALERTAS" -eq 1 ]]; then
    N_TURNOS=12
    N_FALLOS=4
else
    N_TURNOS=4
    N_FALLOS=2
fi
N_LISTADOS=20

paso() { printf '\n==> %s\n' "$*"; }
error() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

TOKEN=""
RESP=""
CODE=""

# http METODO RUTA [CUERPO_JSON]  ->  deja la respuesta en $RESP y el codigo en $CODE
http() {
    local metodo="$1" ruta="$2" cuerpo="${3:-}"
    local args=(-sS --max-time 20 -X "$metodo" "$API$ruta" -H "Content-Type: application/json")
    [[ -n "$TOKEN" ]] && args+=(-H "Authorization: Bearer $TOKEN")
    [[ -n "$cuerpo" ]] && args+=(-d "$cuerpo")
    local salida
    if salida="$(curl "${args[@]}" -w $'\n%{http_code}' 2>/dev/null)"; then
        CODE="${salida##*$'\n'}"
        RESP="${salida%$'\n'*}"
    else
        CODE="000"
        RESP=""
    fi
}

# Primer numero que sigue a la clave "campo": en un texto JSON
primer_numero() { grep -oE "\"$1\":[0-9]+" <<<"$2" | head -1 | grep -oE '[0-9]+$' || true; }

# Minutos desde medianoche de un "HH:MM"
a_min() { local h="${1%%:*}" m="${1##*:}"; echo $(( 10#$h * 60 + 10#$m )); }

# --- Conexion a la API ------------------------------------------------------

PF_PID=""
limpiar() {
    if [[ -n "$PF_PID" ]]; then kill "$PF_PID" 2>/dev/null || true; fi
}
trap limpiar EXIT

if [[ -z "${API_URL:-}" ]]; then
    paso "Conectando con la API (port-forward temporal a svc/api en $NAMESPACE)"
    command -v curl >/dev/null || error "No se encuentra curl."
    command -v minikube >/dev/null || error "No se encuentra minikube."
    estado="$(minikube status --format '{{.Host}}' 2>/dev/null || true)"
    [[ "$estado" == "Running" ]] || error "minikube no esta corriendo. Ejecuta primero inicializar-todo.sh"

    if curl -s -o /dev/null --max-time 2 "http://localhost:${API_PORT}/health"; then
        error "El puerto $API_PORT ya esta en uso. Usa otro con: API_PORT=18001 bash $0"
    fi

    # Se prefiere el kubectl del PATH: con "minikube kubectl --" el kill de
    # abajo mataria al wrapper y podria dejar el port-forward colgado.
    if command -v kubectl >/dev/null; then
        kubectl --context minikube port-forward -n "$NAMESPACE" svc/api "${API_PORT}:8000" >/dev/null 2>&1 &
    else
        minikube kubectl -- port-forward -n "$NAMESPACE" svc/api "${API_PORT}:8000" >/dev/null 2>&1 &
    fi
    PF_PID=$!
fi

for _ in $(seq 1 30); do
    if curl -fsS --max-time 2 "$API/health" >/dev/null 2>&1; then break; fi
    sleep 1
done
curl -fsS --max-time 5 "$API/health" >/dev/null 2>&1 \
    || error "La API no responde en $API/health. ¿Esta corriendo petcore? (minikube kubectl -- get pods -n $NAMESPACE)"
echo "API lista en $API"

# --- Rutas (se leen de /openapi.json, asi no hay que adivinar prefijos) ------

paso "Descubriendo las rutas de la API"
http GET /openapi.json
[[ "$CODE" == "200" ]] || error "No pude leer /openapi.json (codigo $CODE)."
OPENAPI="$RESP"

# Devuelve la ruta mas corta (sin parametros {id}) que termina en el patron.
ruta_de() {
    local patron="$1" ruta
    ruta="$(grep -oE "\"/[^\"{}]*${patron}\"" <<<"$OPENAPI" | tr -d '"' \
            | awk '{print length($0) " " $0}' | sort -n | head -1 | cut -d' ' -f2 || true)"
    [[ -n "$ruta" ]] || error "No encontre en /openapi.json una ruta que termine en '$patron'."
    printf '%s' "$ruta"
}

R_LOGIN="$(ruta_de 'login')"
R_REGISTRO="$(ruta_de 'register')"
R_MASCOTAS="$(ruta_de 'mascotas')"
R_VETS="$(ruta_de 'veterinarios')"
R_TIPOS="$(ruta_de 'tipos[-_]atencion')"
R_ESPECIES="$(ruta_de 'especies')"
R_TURNOS="$(ruta_de 'turnos')"
R_DISP="$(ruta_de 'disponibilidad')"
echo "login=$R_LOGIN registro=$R_REGISTRO mascotas=$R_MASCOTAS turnos=$R_TURNOS disponibilidad=$R_DISP"

# --- 1. Cliente nuevo -------------------------------------------------------

paso "1/6 Registrando un cliente nuevo"
SUFIJO="$(date +%s)"
CORREO_NUEVO="cliente.demo.${SUFIJO}@petcore.com"
http POST "$R_REGISTRO" "$(printf '{"nombre":"Demo","apellido":"Dashboard","documento":"D%s","correo":"%s","telefono":"099%s","contrasena":"%s","confirmar_contrasena":"%s"}' \
    "$SUFIJO" "$CORREO_NUEVO" "${SUFIJO: -6}" "$PASSWORD" "$PASSWORD")"
if [[ "$CODE" == "201" || "$CODE" == "200" ]]; then
    echo "Cliente registrado: $CORREO_NUEVO"
    REGISTRADOS=1
else
    echo "AVISO: el registro devolvio $CODE: ${RESP:0:200}"
    REGISTRADOS=0
fi

# --- 2. Logins fallidos -----------------------------------------------------

paso "2/6 Fallando el login $N_FALLOS veces a proposito"
FALLIDOS=0
for i in $(seq 1 "$N_FALLOS"); do
    http POST "$R_LOGIN" "$(printf '{"correo":"%s","contrasena":"ClaveIncorrecta%s!"}' "$EMAIL" "$i")"
    echo "  intento $i -> $CODE"
    if [[ "$CODE" == "401" || "$CODE" == "400" ]]; then FALLIDOS=$((FALLIDOS + 1)); fi
done

# --- 3. Login correcto ------------------------------------------------------
# Tambien limpia el contador de intentos fallidos de la cuenta.

paso "3/6 Iniciando sesion como $EMAIL"
http POST "$R_LOGIN" "$(printf '{"correo":"%s","contrasena":"%s"}' "$EMAIL" "$PASSWORD")"
[[ "$CODE" == "200" ]] || error "El login devolvio $CODE: ${RESP:0:200}. ¿Estan bien el correo y la contraseña? (PETCORE_EMAIL / PETCORE_PASSWORD)"
TOKEN="$(sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p' <<<"$RESP")"
[[ -n "$TOKEN" ]] || error "No pude leer access_token de la respuesta del login."
echo "Sesion iniciada."

# --- 4. Datos base para reservar --------------------------------------------

paso "4/6 Buscando mascota, veterinario y tipo de atencion"

http GET "$R_VETS"
[[ "$CODE" == "200" ]] || error "GET $R_VETS devolvio $CODE."
VET_ID="$(primer_numero id_usuario "$RESP")"
[[ -n "$VET_ID" ]] || error "No hay veterinarios activos (respuesta: ${RESP:0:200})."

http GET "$R_TIPOS"
[[ "$CODE" == "200" ]] || error "GET $R_TIPOS devolvio $CODE."
OBJ_TIPO="$(grep -oE '\{[^{}]*\}' <<<"$RESP" | grep '"reservable_cliente":true' | head -1 || true)"
TIPO_ID="$(primer_numero id_tipo_atencion "$OBJ_TIPO")"
[[ -n "$TIPO_ID" ]] || error "No hay tipos de atencion reservables por clientes (respuesta: ${RESP:0:200})."

http GET "$R_MASCOTAS"
[[ "$CODE" == "200" ]] || error "GET $R_MASCOTAS devolvio $CODE."
MASCOTA_ID="$(primer_numero id_mascota "$RESP")"
if [[ -z "$MASCOTA_ID" ]]; then
    echo "El cliente no tiene mascotas: creando una."
    http GET "$R_ESPECIES"
    ESPECIE="$(grep -oE '"nombre":"[^"]*"' <<<"$RESP" | head -1 | sed 's/"nombre":"\(.*\)"/\1/' || true)"
    ESPECIE="${ESPECIE:-Perro}"
    http POST "$R_MASCOTAS" "$(printf '{"nombre":"Demo","especie":"%s"}' "$ESPECIE")"
    [[ "$CODE" == "201" || "$CODE" == "200" ]] || error "No pude crear la mascota (codigo $CODE): ${RESP:0:200}"
    MASCOTA_ID="$(primer_numero id_mascota "$RESP")"
fi
echo "mascota=$MASCOTA_ID veterinario=$VET_ID tipo_atencion=$TIPO_ID"

# --- 5. Reservas ------------------------------------------------------------
# Para cada dia futuro se pide la grilla de horarios y se reservan horarios
# libres separados por la duracion de la atencion (asi no se superponen).

paso "5/6 Reservando hasta $N_TURNOS turnos"
CREADOS=0
ULTIMO_ID=""
for dia in $(seq 1 21); do
    [[ "$CREADOS" -lt "$N_TURNOS" ]] || break
    fecha="$(date -d "+${dia} day" +%F)"
    http GET "${R_DISP}?veterinario=${VET_ID}&fecha=${fecha}&tipo_atencion=${TIPO_ID}"
    [[ "$CODE" == "200" ]] || continue
    dur="$(primer_numero duracion_requerida "$RESP")"
    dur="${dur:-30}"
    proximo=0
    while read -r hora; do
        [[ -n "$hora" ]] || continue
        [[ "$CREADOS" -lt "$N_TURNOS" ]] || break
        minutos="$(a_min "$hora")"
        [[ "$minutos" -ge "$proximo" ]] || continue
        http POST "$R_TURNOS" "$(printf '{"id_mascota":%s,"id_tipo_atencion":%s,"id_veterinario":%s,"fecha":"%s","hora_inicio":"%s"}' \
            "$MASCOTA_ID" "$TIPO_ID" "$VET_ID" "$fecha" "$hora")"
        if [[ "$CODE" == "201" ]]; then
            CREADOS=$((CREADOS + 1))
            ULTIMO_ID="$(primer_numero id_turno "$RESP")"
            proximo=$((minutos + dur))
            echo "  turno $CREADOS/$N_TURNOS: $fecha $hora (id $ULTIMO_ID)"
        else
            echo "  AVISO: $fecha $hora rechazado ($CODE): ${RESP:0:120}"
        fi
    done < <(grep -oE '"inicio":"[^"]*","disponible":true' <<<"$RESP" | grep -oE '[0-9]{2}:[0-9]{2}' || true)
done
[[ "$CREADOS" -ge "$N_TURNOS" ]] || echo "AVISO: solo pude crear $CREADOS de $N_TURNOS turnos (no hubo mas horarios libres en 21 dias)."

CANCELADOS=0
if [[ -n "$ULTIMO_ID" ]]; then
    http POST "$R_TURNOS/$ULTIMO_ID/cancelar"
    if [[ "$CODE" == "204" || "$CODE" == "200" ]]; then
        CANCELADOS=1
        echo "  turno $ULTIMO_ID cancelado"
    else
        echo "  AVISO: no se pudo cancelar el turno $ULTIMO_ID ($CODE): ${RESP:0:120}"
    fi
fi

# --- 6. Lecturas (latencia) -------------------------------------------------

paso "6/6 Listando turnos $N_LISTADOS veces (para los paneles de latencia)"
for _ in $(seq 1 "$N_LISTADOS"); do
    http GET "$R_TURNOS"
done
echo "Ultima respuesta: $CODE"

# --- Resumen ----------------------------------------------------------------

paso "Listo"
cat <<EOF
Se generaron en la API:
  clientes registrados : $REGISTRADOS
  logins fallidos      : $FALLIDOS
  turnos creados       : $CREADOS
  turnos cancelados    : $CANCELADOS
  listados de turnos   : $N_LISTADOS

Prometheus scrapea cada 15 s: espera ~30 s y abri Grafana
(minikube service grafana -n $NAMESPACE --url, usuario admin / admin),
Dashboards > Pet-Core > Pet-Core — Monitoreo.
EOF
if [[ "$DISPARAR_ALERTAS" -eq 1 ]]; then
    echo "Las alertas deberian pasar a Firing en 15-45 s (Alerting > Alert rules)."
fi
