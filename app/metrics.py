from prometheus_client import Counter

turnos_creados_total = Counter(
    "turnos_creados_total",
    "Cantidad de turnos creados exitosamente.",
)

turnos_cancelados_total = Counter(
    "turnos_cancelados_total",
    "Cantidad de turnos cancelados exitosamente.",
)

logins_fallidos_total = Counter(
    "logins_fallidos_total",
    "Cantidad de intentos de login fallidos, de todas las cuentas (contador global, "
    "no separado por usuario).",
)
