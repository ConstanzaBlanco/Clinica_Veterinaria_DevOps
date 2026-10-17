from prometheus_client import Counter, Histogram


# Misma precision para comparar SQL y HTTP, incluso por debajo de 100 ms.
LATENCY_BUCKETS = (
    0.0005, 0.001, 0.002, 0.003, 0.004, 0.005, 0.0075,
    0.01, 0.015, 0.02, 0.025, 0.035, 0.05, 0.075, 0.1,
    0.15, 0.25, 0.5, 1, 2.5, 5, 10,
)

pg_query_duration_seconds = Histogram(
    "pg_query_duration_seconds",
    "Tiempo de consulta desde la API: ejecucion y lectura de resultados de PostgreSQL.",
    labelnames=("query",),
    buckets=LATENCY_BUCKETS,
)

# Nombre fijo: no publicar SQL, parametros ni datos de clientes como etiquetas.
listar_turnos_query_duration = pg_query_duration_seconds.labels(query="listar_turnos_cliente")

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
