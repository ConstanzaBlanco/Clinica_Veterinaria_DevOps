# Entregable 2 — Monitoreo y Alertas (Pet-Core)

Este documento tiene un plan para el segundo entregable de Devops en el mismo vamos a tomar la app que utilizamos para la primer entrega (con FastAPI + Postgres, ya desplegada en Kubernetes con la estrategia Blue/Green) con un sistema
de monitoreo y alertas, contenerizado y desplegado en el mismo cluster de k8s.

## Lo que pide la consigna

Implementar un sistema de monitoreo y alertas que dispare un aviso si se supera una determinada cantidad de X operaciones en un período de Y minutos. Solución contenerizada y desplegada en un cluster de Kubernetes.

El stack "recomendado" por la cátedra es Java/Spring Boot + Prometheus + Grafana. Como nosotros ya realizamos Pet-Core en FastAPI y corriendo en K8s, utilizaremos ese stack — Prometheus/Grafana son agnósticos al lenguaje de la app que monitorean.

## Qué vamos a monitorear en este entregable

### 1. Métrica de negocio (requisito explícito del entregable)

- **Turnos creados**: Va ser un contador `turnos_creados_total`, incrementado en
  `TurnoRepository.crear_turno` cada vez que se crea un turno exitosamente.
- **Alerta**: dispara si se superan los **10 turnos creados en 5 minutos**.

**Stats de negocio adicionales (solo paneles por ahora, no van a agregan alertas nuevas):**

- **Clientes nuevos registrados**: contador en el alta de `Register/clients`.
- **Turnos cancelados**: contador en `TurnoRepository.cancelar`. Panel pensado para
  mostrarse como "cancelados hoy" (acumulado de las últimas 24h vía PromQL). Combinado con turnos creados permite ver un ratio cancelación/creación en el
  dashboard que puede estar bueno.

**Idea opcional (todavía no confirmada y se puede implementar despué):**

- **Turnos marcados `NO_ASISTIO`**: ya se generan solos en
  `app/turnos/tareas_programadas.py` (hay un servicio periódico corriendo que vence automaticamente los turnos) —
  solo faltaría contarlos, sin tocar la lógica existente. Queda como posible panel
  extra si da el tiempo.

### 2. Métricas de aplicación (Lo que anotaron Belén y Martin)

- Tasa de requests por endpoint.
- Latencia promedio por endpoint.
- Tasa de errores HTTP 5xx.
- Se obtienen prácticamente automático vía `prometheus-fastapi-instrumentator` sobre la
  app FastAPI — cubre las ideas de "requests por minuto" y "latencia por endpoint".

### 3. Métrica de seguridad: intentos de login fallidos en un período de tiempo

- **Logins fallidos:** se utiliza la tabla `auditoria_sistema`, que ya registra los intentos de inicio de sesión, tanto exitosos como fallidos, bloqueados o rechazados. Por lo tanto, no es necesario modificar la base de datos, sino simplemente agregar un contador que utilice los registros existentes.

- **Alerta:** se genera cuando hay más de 3 intentos fallidos en un minuto. Se eligió un intervalo corto para detectar posibles ataques antes de que se active el bloqueo de la cuenta, que ocurre al llegar a 5 intentos fallidos en `Auth/login`.

- **Relación con la protección existente:** el `LoginService` (RNF-02) ya bloquea la cuenta durante 15 minutos después del quinto intento fallido y reinicia el contador cuando el usuario inicia sesión correctamente. Esta métrica no busca reemplazar ese mecanismo, sino complementarlo. La idea es que el equipo pueda detectar comportamientos sospechosos en tiempo real, como un ataque distribuido que afecte a varias cuentas al mismo tiempo. En otras palabras, el bloqueo protege cada cuenta, mientras que el monitoreo permite tener una visión más general de lo que está pasando en el sistema.

- **Alcance del contador:** el contador es global, es decir, suma los intentos fallidos de todo el sistema y no los separa por cuenta. Esto permite detectar una cantidad inusual de errores de inicio de sesión en poco tiempo, aunque también puede generar falsas alarmas. Por ejemplo, varios usuarios que se equivoquen al ingresar su contraseña durante el mismo minuto podrían activar la alerta sin que exista un ataque. Se decidió mantener este enfoque porque el bloqueo por cuenta ya cubre ese caso de forma individual. De todas formas, es importante aclarar en el informe que se trata de una simplificación consciente y que la alerta debe interpretarse teniendo en cuenta este posible escenario.

### 4. Observabilidad y bonus

- **CPU/RAM del pod de la API > 75%**: requiere scrapear métricas de nodo/pod vía
  cAdvisor/kubelet (RBAC + service discovery de Kubernetes en Prometheus), más esfuerzo de
  infraestructura que las métricas anteriores.
- **Correlación latencia de endpoint ↔ duración de queries a Postgres**: panel que
  reproduce literalmente el ejemplo de la teórica ("el monitoreo detecta que la API
  responde lento; la observabilidad muestra que la causa es una query lenta en la BD").

## Qué decidimos no hacer

- **No** se mete blue/green dentro del sistema de métricas (nada de labels
  `version=blue|green` en los contadores). Prometheus y Grafana son componentes nuevos e
  independientes, con una sola instancia de cada uno — no necesitan su propia versión
  blue/green, porque ambas versiones de la API exponen el mismo contrato en `/metrics`.

## Cómo conviven con el Blue/Green existente (entregable 1)

- El `Service` `api` (y `frontend`) ya resuelve el "cuál está arriba" vía
  `selector: version: blue|green` — Kubernetes mantiene los Endpoints automáticamente. Para
  consultarlo en cualquier momento: `kubectl get svc api -o jsonpath='{.spec.selector}'`.
- Prometheus scrapea la **URL del Service**, nunca un pod directamente, así que un switch
  de blue a green en medio de la demo no rompe nada del monitoreo.
- Los manifests nuevos (`prometheus-*.yaml`, `grafana-*.yaml`) se agregan a `k8s/` sin
  tocar `api-blue-deployment.yaml`, `api-green-deployment.yaml` ni los scripts
  `k8s-switch-*.ps1` existentes — mismo criterio que ya se sigue con los scripts SQL de
  `db/init/` (se agrega, no se edita lo que ya funciona).

## Arquitectura

![Diagrama de arquitectura del entregable 2](entregable2-diagrama-arquitectura.png)


Resumen del flujo:

1. Prometheus scrapea `GET /metrics` del `Service: api` cada 15s (pull) — no necesita
   saber si responde `api-blue` o `api-green`.
2. Grafana consulta Prometheus vía PromQL y arma los dashboards (tasa de requests,
   latencia, errores 5xx, turnos creados, logins fallidos).
3. Grafana evalúa las reglas de alerta sobre esas series y dispara el aviso si
   `turnos_creados` supera 10 en 5 minutos, o `logins_fallidos` supera 3 en 1 minuto.

## Piezas a desplegar (nuevas, en `k8s/`)

- `prometheus-configmap.yaml` — configuración de scrape (target: Service `api`).
- `prometheus-deployment.yaml` + `prometheus-service.yaml`.
- `grafana-deployment.yaml` + `grafana-service.yaml` — con Prometheus como datasource,
  el dashboard y las reglas de alerta ya provisionadas.
- Cambio mínimo en la API: exponer `/metrics` (instrumentación + contadores de negocio).

## Prioridad de implementación

1. Alerta de negocio obligatoria: turnos creados > 10 en 5 min — núcleo del entregable.
2. Métricas de aplicación (requests, latencia, errores 5xx) — relleno barato vía
   instrumentator.
3. Alerta de logins fallidos: > 3 en 1 min — segundo caso de "X en Y minutos", reutiliza
   auditoría existente.
4. Correlación latencia-vs-query (Postgres) — el ejemplo monitoreo vs. observabilidad que fue lo qu vimos en clase, aplicado al proyecto.
5. CPU/RAM del pod de la API > 75% (cAdvisor/kubelet) — la pieza de infraestructura
   pura, con más configuración de K8s (RBAC + service discovery).

## Alertas definidas

| Alerta | Condición | Motivo |
|---|---|---|
| Turnos creados | > 10 en 5 min | Requisito obligatorio del enunciado, escala realista |
| Logins fallidos | > 3 en 1 min | Aviso temprano, por debajo del bloqueo de cuenta (5 intentos) de `Auth/login` |

## Contrato de nombres de métricas

Nombres ya definidos, para que Prometheus/Grafana se puedan configurar sin esperar al
código final de la API:

| Métrica | Tipo | Dónde se incrementa/mide |
|---|---|---|
| `turnos_creados_total` | counter | `TurnoRepository.crear_turno` |
| `turnos_cancelados_total` | counter | `TurnoRepository.cancelar` |
| `clientes_registrados_total` | counter | alta en `Register/clients` |
| `logins_fallidos_total` | counter | mismo evento que ya escribe en `auditoria_sistema` (global, sin label por cuenta — ver nota más arriba) |
| `pg_query_duration_seconds` | histogram | alrededor de la query pesada del endpoint de turnos |
| `http_requests_total` | counter | automático, lo agrega `prometheus-fastapi-instrumentator` |
| `http_request_duration_seconds` | histogram | automático, idem |

## Checklist de trabajo

Antes de repartir nada entre personas, esto es lo que el trabajo necesita que se haga,
en el orden en que una cosa depende de la otra:

1. **Instrumentar la API**: agregar `prometheus-fastapi-instrumentator`, exponer `/metrics`,
   agregar el contador de turnos creados (`TurnoRepository.crear_turno`), el contador de
   logins fallidos (sobre el mismo evento que ya escribe en `auditoria_sistema`), y la
   métrica de duración de query a Postgres en el endpoint de turnos.
2. **Escribir los manifests de Prometheus** en `k8s/` (`prometheus-configmap.yaml`,
   `prometheus-deployment.yaml`, `prometheus-service.yaml`), apuntando el scrape al
   `Service: api`, más el RBAC necesario para leer métricas de cAdvisor/kubelet (bonus de
   CPU/RAM).
3. **Escribir los manifests de Grafana** en `k8s/` (`grafana-deployment.yaml`,
   `grafana-service.yaml`), con Prometheus como datasource.
4. **Armar el dashboard en Grafana**: los paneles ya definidos en el mockup (turnos
   creados, logins fallidos, latencia por endpoint, error rate, CPU/RAM, correlación
   latencia-vs-query) y las 2 reglas de alerta (turnos > 10/5min, logins > 3/1min).
5. **Desplegar todo junto** en el cluster (`kubectl apply`) al lado de lo que ya existe de
   Blue/Green, sin tocar los manifests existentes.
6. **Verificar que las alertas disparan de verdad**: generar la condición una vez (crear
   más de 10 turnos en 5 min, fallar un login 4 veces seguidas) y confirmar que Grafana
   pasa a estado "Firing".
7. **Juntar la evidencia y documentar**: capturas reales del dashboard y de una alerta
   disparada, reemplazando las capturas simuladas de este documento, y dejar los pasos de
   despliegue finales escritos (acá o en el README).


## Mockup del dashboard (datos simulados, antes del código real)

Simulación de cómo quedaría el dashboard en Grafana, con los umbrales ya definidos arriba.

![Mockup del dashboard — turnos creados, logins fallidos y reglas de alerta](entregable2-mock-dashboard-1.png)

![Mockup del dashboard — latencia por endpoint y panel de observabilidad](entregable2-mock-dashboard-2.png)

