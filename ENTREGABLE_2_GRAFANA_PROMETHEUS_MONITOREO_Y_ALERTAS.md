# Entregable 2: monitoreo y alertas con Grafana y Prometheus

Sistema de monitoreo y alertas para Pet-Core (FastAPI + Postgres, ya desplegado en
Kubernetes con Blue/Green en el entregable 1), con Prometheus y Grafana. Este documento
es la única referencia del entregable: qué se construyó, por qué, y cómo levantarlo y
probarlo.

La consigna pedía un sistema de monitoreo y alertas que avise si se supera una cantidad
de operaciones en una ventana de tiempo, contenerizado y desplegado en Kubernetes. El
stack "recomendado" por la cátedra era Java/Spring Boot + Prometheus + Grafana; como
Pet-Core ya está en FastAPI corriendo en K8s, se instrumentó ese stack directamente —
Prometheus/Grafana son agnósticos al lenguaje de la app que monitorean.

## 1. Preparar el entorno

Abrir Docker Desktop y esperar a que esté listo. En PowerShell, parado en la raíz del
proyecto (la carpeta donde está este archivo):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up-monitoring.ps1
```

El script inicia Minikube, construye la API y el frontend de monitoreo, y despliega
PostgreSQL, `api-monitoring`, Prometheus, Grafana y `frontend-monitoring`. Si el
clúster ya contiene Blue/Green, esos recursos también pueden reanudarse al iniciar
Minikube.

Comprobar que los cuatro Deployments de monitoreo estén disponibles:

```powershell
minikube kubectl -- get deployment api-monitoring prometheus grafana frontend-monitoring -n clinica-veterinaria
```

Cada uno debe mostrar `1/1` en `READY`.

### Acceder a Grafana

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-open-grafana.ps1
```

Dejar la terminal abierta y abrir la URL que muestra. Credenciales iniciales: `admin` /
`admin`. Ir a **Dashboards → Pet-Core → Pet-Core — Monitoreo**, seleccionar los últimos
15 minutos y activar actualización cada 5 segundos.

**Grafana no tiene almacenamiento persistente**: cada reinicio del Pod (por ejemplo, al
volver a correr `k8s-up-monitoring.ps1`) resetea la contraseña a `admin`/`admin`, aunque
se haya cambiado antes — es el mismo motivo por el que el dashboard y las alertas
aparecen solos (se re-provisionan desde los ConfigMaps en cada arranque). Si no deja
entrar con ninguna contraseña:
`minikube kubectl -- exec deploy/grafana -n clinica-veterinaria -- grafana cli admin reset-admin-password <nueva>`.

Si alguna vez hace falta entrar directo a la UI de Prometheus para debuggear un scrape
target (Prometheus no tiene URL propia, queda `ClusterIP` a propósito — nadie necesita
entrar ahí para el día a día):

```powershell
minikube kubectl -- port-forward svc/prometheus 9090:9090 -n clinica-veterinaria
```

### Preparar el frontend para operaciones de negocio

**El frontend Blue/Green de `localhost:8080` no apunta a `api-monitoring`.**
Para probar contadores y alertas, las operaciones tienen que hacerse desde
`frontend-monitoring`, que ya viene apuntado a la API que observa Prometheus
(`scripts\k8s-up-monitoring.ps1` lo construye y despliega solo, no hace falta
ningún paso manual):

```powershell
minikube service frontend-monitoring --namespace=clinica-veterinaria --url
```

Abrir la URL que muestra ese comando — ahí es donde hay que hacer las acciones de
prueba (entrar, reservar turnos, fallar un login, etc.), no en `localhost:8080`.

Para entrar directo a la API sin pasar por el frontend (Swagger y métricas crudas):

```powershell
minikube service api-monitoring --namespace=clinica-veterinaria --url
```

Esa URL + `/docs` es Swagger, y esa URL + `/metrics` son las métricas en crudo.

Después de levantar el entorno, esperar al menos 30 segundos antes de empezar
la prueba. Así Prometheus registra los valores de los contadores antes de realizar
las acciones y puede compararlos con los valores posteriores para calcular cuánto
aumentaron.

## Arquitectura y decisiones de diseño

![Diagrama de arquitectura](entregable2-diagrama-arquitectura.png)

Resumen del flujo: Prometheus scrapea `GET /metrics` del Service `api-monitoring` cada
15s (pull); Grafana consulta Prometheus vía PromQL para los paneles del dashboard y
evalúa las reglas de alerta cada 30s.

**Por qué `api-monitoring` es un Deployment aparte, no el `api` de Blue/Green:**
Blue/Green es un requisito del entregable 1, no de este. Reusar su Service hubiera hecho
que el monitoreo dependa de tener Blue/Green desplegado y mergeado a una rama en
particular. `api-monitoring` es un Deployment de un solo Pod, con su propio Service, sin
labels `version: blue/green`, que reusa la misma imagen y el mismo Postgres que ya existe
(no se duplica la base). Nada de esto toca `api-blue-deployment.yaml`,
`api-green-deployment.yaml`, `api-service.yaml` ni los scripts `k8s-up.ps1`/
`k8s-switch-*.ps1` existentes. Mismo criterio para `frontend-monitoring` respecto de
`frontend-blue`/`frontend-green`.

**Por qué Prometheus queda `ClusterIP` y Grafana `NodePort`:** para no sumarle una
terminal nueva a cada persona por cada pieza del monitoreo. Nadie necesita entrar a la
UI de Prometheus para el día a día — eso lo hace Grafana, que ya lo tiene de datasource.

**Por qué el contador de logins fallidos es global (no por cuenta):** `LoginService`
(RNF-02) ya bloquea una cuenta 15 minutos tras el quinto intento fallido — esa protección
ya existe y es por cuenta individual. El contador de monitoreo no busca reemplazarla,
sino darle al equipo una visión agregada en tiempo real (por ejemplo, detectar un ataque
distribuido contra muchas cuentas a la vez, algo que el bloqueo por-cuenta no muestra de
un vistazo). La contra conocida: varios usuarios equivocándose de contraseña en el mismo
minuto puede disparar la alerta sin que haya ataque real — es una simplificación
consciente, no un descuido. Se descartó a propósito la alternativa de usar el correo como
label del contador (permitiría distinguir cuentas) porque eso es alta cardinalidad en
Prometheus — mala práctica conocida, no vale la pena para esta ganancia.

**Contrato de nombres de métricas:**

| Métrica | Tipo | Dónde se incrementa/mide |
|---|---|---|
| `turnos_creados_total` | counter | `TurnoRepository.crear_turno` |
| `turnos_cancelados_total` | counter | `TurnoRepository.cancelar` |
| `clientes_registrados_total` | counter | `RegisterRepository.crear_cliente`, tras el commit |
| `logins_fallidos_total` | counter | `LoginRepository.registrar_intento_fallido` (global) |
| `pg_query_duration_seconds` | histogram | alrededor de la query de listado de turnos |
| `http_requests_total` / `http_request_duration_seconds` | counter / histogram | automáticos, vía `prometheus-fastapi-instrumentator` |

**Alternativa sin Kubernetes, solo para desarrollo** (no es lo que se entrega — la
consigna pide Kubernetes explícitamente, eso es todo lo de `k8s/`): `compose.yaml` trae
también Prometheus y Grafana apuntados al servicio `server` de Docker Compose
(`monitoring/prometheus.yml`, `monitoring/grafana-datasources.yml`), para iterar más
rápido en el código sin pasar por Minikube. Totalmente independiente de la configuración
de Kubernetes — no hace falta mantenerlos sincronizados más que en el nombre de las
métricas que exponen.

## Reglas de alerta en Grafana

### Qué hace

Grafana consulta Prometheus cada 30 segundos y activa estas reglas:

| Regla | Condición |
| --- | --- |
| Exceso de turnos creados | Más de 10 reservas exitosas en los últimos 5 minutos. |
| Exceso de intentos de login fallidos | Más de 3 intentos contabilizados en el último minuto. |

Las ventanas son móviles. Las alertas vuelven a `Normal` cuando deja de superarse
el umbral. `Firing` indica alerta activa; `No Data` indica falta de datos y `Error`
un fallo de evaluación. No se configuraron avisos externos por correo o webhook.

### Archivos de la implementación

| Archivo | Función |
| --- | --- |
| `k8s/grafana-alerting-configmap.yaml` | Define las dos reglas, consultas y umbrales. |
| `k8s/grafana-deployment.yaml` | Monta las reglas en el directorio de provisioning. |
| `scripts/k8s-up-monitoring.ps1` | Aplica la configuración y reinicia Grafana para cargarla. |
| `app/metrics.py` | Define los contadores usados por las reglas. |
| `app/turnos/repository.py` | Incrementa el contador de reservas creadas. |
| `app/Auth/login/repository.py` | Incrementa el contador de logins fallidos. |
| `app/main.py` | Expone `/metrics` mediante la instrumentación de FastAPI. |

### Cómo probar la alerta de turnos

1. Usar `frontend-monitoring` (la URL que da `minikube service frontend-monitoring --url`), conectado a `api-monitoring`.
2. Entrar como cliente y tener una mascota registrada.
3. Crear 12 reservas exitosas en menos de 5 minutos, en horarios futuros
   disponibles y sin superposición. Las reservas rechazadas no cuentan.
4. En Grafana, abrir **Alerting → Alert rules → Pet-Core → pet-core-alertas**.
5. Esperar aproximadamente 15–45 segundos tras las últimas operaciones.
   **Exceso de turnos creados** debe aparecer en `Firing`.
6. Dejar de crear reservas. Cuando la ventana de 5 minutos deje de superar el
   umbral, debe volver a `Normal`.

La fecha de atención puede estar lejos: se mide cuándo se crea la reserva.
La prueba guarda reservas reales en la base y no las elimina automáticamente.

### Cómo probar la alerta de logins

1. Usar una cuenta existente y no bloqueada. Iniciar sesión correctamente y
   cerrar sesión para comenzar sin fallos previos en esa cuenta.
2. Enviar cuatro intentos con contraseña incorrecta en menos de un minuto.
   Deben ser rechazos por credenciales incorrectas, no por formato inválido.
3. Revisar la regla **Exceso de intentos de login fallidos** durante los siguientes
   15–45 segundos. Debe pasar a `Firing` y luego volver a `Normal` al vencer la ventana.
4. Iniciar sesión correctamente para limpiar los intentos de la cuenta.

No acumular un quinto fallo: bloquea la cuenta durante 15 minutos.
Usuarios inexistentes e intentos durante el bloqueo no incrementan este contador.
La ventana de un minuto es corta: observar Grafana mientras se realiza la prueba.

## Contador de turnos cancelados

### Qué hace

`turnos_cancelados_total` aumenta después del commit de una cancelación exitosa.
Una solicitud rechazada o repetir la cancelación no suma otro evento.
El panel **Turnos cancelados (últimas 24 h)** estima las cancelaciones de las últimas
24 horas mediante `increase`; no es un conteo desde la medianoche.

### Archivos de la implementación

| Archivo | Función |
| --- | --- |
| `app/metrics.py` | Define `turnos_cancelados_total`. |
| `app/turnos/repository.py` | Incrementa el contador únicamente si se canceló un turno. |
| `k8s/grafana-dashboard-configmap.yaml` | Define el panel y su consulta de las últimas 24 horas. |

### Cómo probarlo

1. Abrir Grafana y anotar el valor del panel **Turnos cancelados (últimas 24 h)**.
2. Entrar al frontend de prueba (`frontend-monitoring`) e iniciar sesión como
   cliente. Debe estar preparado como se explica al comienzo de esta guía.
3. En **Mis turnos**, elegir un turno confirmado cuyo inicio esté a más de una hora.
4. Cancelar el turno y comprobar que aparezca como cancelado.
5. Volver a Grafana, esperar unos 30 segundos y actualizar el dashboard.
   El panel debe reflejar la nueva cancelación.

La prueba funciona si el turno queda cancelado y aumenta el valor del panel.
No se cuentan los intentos rechazados ni se suma otra cancelación por el mismo turno.
El panel muestra una estimación de las últimas 24 horas, por lo que el valor puede
no aumentar exactamente en una unidad.

## Contador de clientes nuevos registrados

### Qué hace

`clientes_registrados_total` aumenta después del commit de un alta de cliente
exitosa. Los intentos rechazados (datos inválidos, email o documento ya registrados) no suman.
El panel **Clientes nuevos registrados (últimas 24 h)** estima los altas de las
últimas 24 horas mediante `increase`; no es un conteo desde la medianoche.
No tiene alerta asociada: es solo una estadística de negocio.

### Archivos de la implementación

| Archivo | Función |
| --- | --- |
| `app/metrics.py` | Define `clientes_registrados_total`. |
| `app/Auth/Register/clients/repository.py` | Incrementa el contador solo tras un alta exitosa. |
| `k8s/grafana-dashboard-configmap.yaml` | Define el panel y su consulta. |
| `tests/test_clientes_metrics.py` | Prueba que suma en el alta exitosa y no en los rechazos. |

### Cómo probarlo

1. Levantar el entorno y preparar el frontend como se explica al comienzo de esta guía.
2. Abrir Grafana y anotar el valor del panel.
3. En `frontend-monitoring`, registrar uno o más clientes nuevos con emails distintos.
4. Intentar registrar un email duplicado: no debe aumentar el contador.
5. Esperar unos 30 segundos y actualizar el dashboard: el panel debe reflejar los altas.

La prueba funciona si el valor sube por cada registro exitoso. Como el panel
muestra una estimación de 24 h, puede no aumentar en exactamente una unidad.
Si el pod de la API se reinicia, el contador vuelve a cero.


## Duración de query y comparación con latencia HTTP

### Qué hace

Este punto ayuda a investigar por qué puede tardar en cargar la lista de turnos.
Para eso, el gráfico compara dos tiempos:

- **Consulta a la base de datos:** cuánto tarda la API en pedir los turnos a
  PostgreSQL y recibir los resultados.
- **Respuesta completa de la API:** cuánto tarda en atender la solicitud de listar
  turnos, incluyendo comprobar el usuario, consultar la base y preparar la respuesta.

El panel se llama **Turnos: p95 de consulta PostgreSQL vs endpoint**.
Aquí, **endpoint** es la ruta de la API que devuelve la lista de turnos.
Las dos líneas resumen lo ocurrido en los últimos 5 minutos.

**¿Qué significa p95?** Es un tiempo por debajo del cual terminó aproximadamente
el 95% de las consultas o solicitudes. Por ejemplo, un p95 de 200 milisegundos
indica que aproximadamente 95 de cada 100 terminaron en ese tiempo o menos.
Sirve para observar las respuestas más lentas sin depender de un único caso extremo.

**Cómo leer el gráfico:** si las dos líneas suben al mismo tiempo, la consulta a
la base podría estar contribuyendo a la demora. Si solo sube el tiempo de respuesta
completa, conviene revisar otras partes del proceso. El gráfico orienta la
investigación, pero por sí solo no confirma la causa.

Los valores son aproximados, especialmente si se hicieron pocas solicitudes.
No hay que restar las dos líneas para calcular el tiempo de las otras tareas.
Para probarlo, iniciar sesión como cliente y listar turnos correctamente: los
intentos rechazados pueden aparecer en el tiempo de la API sin consultar los turnos.

### Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `app/metrics.py` | Histograma con intervalos desde 0,5 ms hasta 10 s para distinguir respuestas rápidas. |
| `app/main.py` | Configura la misma precisión para medir los tiempos de la API. |
| `app/turnos/repository.py` | Cronometra ejecución y lectura de la consulta de listado. |
| `k8s/grafana-dashboard-configmap.yaml` | Panel con las dos curvas p95, en segundos. |
| `tests/test_query_metrics.py` | Prueba incremento de observaciones, preservación de resultados y propagación de errores. |
| Este documento | Explicación y pasos de reproducción. |

### Cómo probarlo desde el frontend

Antes de empezar, seguir la sección **Preparar el frontend para operaciones de
negocio** de esta guía. El frontend de la prueba es `frontend-monitoring`,
conectado a la API de monitoreo.

1. Abrir `frontend-monitoring` e iniciar sesión como cliente.
2. Entrar a la pantalla donde se muestra la lista de sus turnos. No hace falta
   crear reservas nuevas: alcanza con consultar la lista, aunque esté vacía.
3. Esperar 30 segundos después de abrir la lista por primera vez.
4. Recargar esa pantalla unas 10–20 veces durante uno o dos minutos. Dejar que
   termine de cargar antes de volver a recargar. Si pide iniciar sesión, hacerlo
   y regresar a la lista de turnos.
5. Abrir Grafana (`scripts\k8s-open-grafana.ps1`, ver "Acceder a Grafana" más arriba) y
   entrar a **Dashboards → Pet-Core → Pet-Core — Monitoreo**.
6. Seleccionar **Últimos 15 minutos**, activar actualización cada **5 segundos**
   y buscar al final el gráfico **Turnos: p95 de consulta PostgreSQL vs endpoint**.
7. Esperar unos 30 segundos. Deben aparecer las dos líneas: una para la consulta
   a la base de datos y otra para la respuesta completa de la API.

**La prueba funciona si aparecen datos en las dos líneas.** No hace falta que
suban mucho: consultar una lista pequeña suele ser rápido, por lo que pueden
mantenerse bajas y casi planas.

Si aparece **No data**, volver a la lista de turnos, recargarla varias veces y
esperar 30 segundos. Comprobar también que se está usando `frontend-monitoring`,
preparado como indica esta guía. El frontend Blue/Green (el de siempre) consulta
otra API y no sirve para esta prueba.

Después de 5 minutos sin consultar turnos, las líneas pueden dejar de mostrar
valores. Para verlas de nuevo, volver a cargar la lista varias veces.

No se agregaron demoras artificiales ni endpoints para forzar consultas lentas.

## CPU y RAM del pod de la API

### Qué hace

Prometheus descubre los nodos y consulta cAdvisor mediante la API de Kubernetes,
usando un ServiceAccount dedicado. Conserva las métricas del cgroup del pod
`api-monitoring`, sin sumar de nuevo los contenedores hijos.

En este Minikube esas series tienen `container=""`; filtrar por `container="api"`
las descartaba y producía `No data`. La configuración ya incluye la corrección.

| Indicador | Cálculo | Límite actual |
| --- | --- | --- |
| CPU | Uso promedio de 2 minutos dividido por la cuota de CPU. | 1 núcleo. |
| RAM | Memoria working set dividida por el límite de memoria. | 512 MiB. |

Los límites se leen de las métricas de cAdvisor. Cada pod tiene su propio indicador.
Desde 75% el gauge se pone rojo; esto no crea una regla de alerta adicional.

### Archivos modificados

| Archivo | Cambio |
| --- | --- |
| `k8s/prometheus-rbac.yaml` (nuevo) | ServiceAccount, ClusterRole y ClusterRoleBinding para descubrir nodos y acceder a cAdvisor. |
| `k8s/prometheus-configmap.yaml` | Job `kubernetes-cadvisor`, autenticación, CA y filtros de métricas del pod. |
| `k8s/prometheus-deployment.yaml` | Usa el ServiceAccount y monta su token. |
| `k8s/api-monitoring-deployment.yaml` | Requests de 100m/128Mi y límites de 1 CPU/512Mi. |
| `k8s/grafana-dashboard-configmap.yaml` | Dos gauges, consultas y umbral visual del 75%. |
| `scripts/k8s-up-monitoring.ps1` | Valida e incluye el manifiesto RBAC en el despliegue. |

El permiso `nodes/proxy` tiene alcance de clúster y permite acceso amplio al kubelet;
se asigna al ServiceAccount de Prometheus, no al de la API de la aplicación.

### Cómo probar que recibe datos

1. Abrir el dashboard y esperar unos 2 minutos.
2. CPU y RAM deben mostrar porcentajes. CPU muy baja en reposo es normal.
### Cómo hacer que los valores cambien

Ejecutar los comandos uno por vez en PowerShell, con Grafana actualizando cada 5 segundos.
No requieren abrir el frontend: generan consumo dentro del pod monitoreado.

CPU durante 30 segundos:

```powershell
minikube kubectl -- exec deployment/api-monitoring -n clinica-veterinaria -- /app/.venv/bin/python -c "import time; fin=time.monotonic()+30; exec('while time.monotonic()<fin: pass')"
```

La CPU debe subir y después bajar gradualmente, porque el indicador promedia 2 minutos.
Esta prueba corta no necesariamente alcanza el umbral rojo.

RAM adicional de 200 MiB durante 45 segundos:

```powershell
minikube kubectl -- exec deployment/api-monitoring -n clinica-veterinaria -- /app/.venv/bin/python -c "import time; memoria=bytearray(200*1024*1024); time.sleep(45)"
```

La RAM debe subir durante la ejecución y bajar cuando termina el proceso.
No hace falta superar 75% para validar que mide consumo real.

## Si un gráfico muestra «No data»

Significa que el gráfico no tiene datos para mostrar en el período elegido.

1. En Grafana, seleccionar **Últimos 15 minutos** y pulsar **Actualizar**.
2. Repetir la acción de la prueba desde `frontend-monitoring` y esperar unos
   30 segundos. Para CPU y RAM, esperar hasta 2 minutos.
3. Si sigue sin mostrar datos, revisar que se hayan seguido los pasos de
   **Preparar el entorno** al comienzo de esta guía.

Cerrar y abrir la página no soluciona la falta de datos por sí solo.

## Qué queda pendiente

Todo lo de arriba está implementado y verificado en Minikube, incluidas las dos reglas de
alerta llegando a `Firing` con datos reales. Lo único que falta para cerrar la entrega:

- Reemplazar las capturas de pantalla de este documento (si las hay) por capturas reales
  del dashboard y de una alerta en estado `Firing`.
- Armar el informe/documento final de entrega con esa evidencia.
