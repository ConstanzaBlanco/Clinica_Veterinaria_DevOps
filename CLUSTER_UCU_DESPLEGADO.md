# Qué hay desplegado en el cluster de la UCU (namespace `alumno-team8`)

> Este documento explica el estado y configuración del cluster de la UCU que utilizamos para alojar nuestros proyecto, va desde qué está desplegado hoy, como está implementado y por qué se tomaron las decisiones que se tomaron.
>
> Para los diagramas de arquitectura (pod por pod, con quién habla cada uno) ver [`ARQUITECTURA_FISICA_CLUSTER_UCU.md`](./ARQUITECTURA_FISICA_CLUSTER_UCU.md) — ese documento se mantuvo aparte porque ya era bastante extenso y centrado en diagramas, no en las decisiones que tomamos.
>

## Índice

1. [Mapa de componentes](#1-mapa-de-componentes)
2. [Acceso](#2-acceso)
3. [Qué está desplegado ahora mismo](#3-qué-está-desplegado-ahora-mismo)
4. [Jenkins en el cluster — decisiones y cómo quedó armado](#4-jenkins-en-el-cluster--decisiones-y-cómo-quedó-armado)
5. [El `Jenkinsfile.ucu`, etapa por etapa](#5-el-jenkinsfileucu-etapa-por-etapa)
6. [Otras herramientas del D4 (Kyverno, Falco, Prometheus/Grafana)](#6-otras-herramientas-del-d4-kyverno-falco-prometheusgrafana)
7. [Guía práctica: hacer un cambio y verlo funcionando, paso a paso](#7-guía-práctica-hacer-un-cambio-y-verlo-funcionando-paso-a-paso)
8. [Comandos de referencia rápida](#8-comandos-de-referencia-rápida)

> **¿Qué es un PVC?** Un Pod es descartable: si se recrea (falla, se actualiza, se mueve de nodo), pierde todo lo que tenía escrito en su propio disco. Un `PersistentVolumeClaim` (PVC) es un disco aparte, que sobrevive aunque el Pod se recree — el Pod nuevo se monta sobre el mismo PVC y sigue viendo los mismos datos. En este cluster se usa solo donde perder los datos sería grave: `postgres-data` (la base, 1Gi) y `jenkins-home` (configuración, credenciales e historial de builds, 2Gi). `api`, `frontend`, `prometheus` y `grafana` no tienen PVC — no guardan nada que no se pueda perder sin problema.

---

## 1. Mapa de componentes

Esta es una tabla de los componentes que utilizamos dentro del cluster

| Componente | Tipo de recurso | Estado | Se conecta con |
|---|---|---|---|
| `api` | Tiene su deployment y service con ClusterIP (significa que solo son alcanzables dentro del mismo cluster) | ✅ Desplegado (`build-8`) | directamente con `postgres` (SQL) y solo lo alcanza `frontend`, no tiene ruta pública propia |
| `frontend` | Tiene su deployment y service con ClusterIP (significa que solo son alcanzables dentro del mismo cluster)| ✅ Desplegado (`build-8`) | hace solicitudes a `api` y tiene su único Service expuesto al público |
| `postgres` | StatefulSet + Service headless (`db`) | ✅ Desplegado | consumido por `api` |
| `jwt-secret`, `postgres-secret` | Secret | ✅ Desplegado | configurados en `api` / `postgres` |
| `postgres-init`, `api-config` | ConfigMap | ✅ Desplegado | configurados en `postgres` / `api` |
| Jenkins (controlador) | Deployment + PVC (con 2Gi ) + Service | ✅ Desplegado | lanza Jobs efímeros y hace `helm upgrade` |
| Kaniko | Job efímero (backend + frontend, en paralelo) | ✅ Funciona, probado de punta a punta | lo lanza Jenkins, publica en Docker Hub |
| `docker-config-kaniko` | Secret (`dockerconfigjson`) | ✅ Se recrea cada build | lo usa Kaniko para publicar |
| `petcore-route` | ApisixRoute (`k8s/apisix-route-ucu.yaml`) | ✅ Desplegado | expone únicamente `frontend` al público |
| Kyverno (webhook de admisión) | Instalación cluster-wide | ✅ Activo (no administrado por el equipo) | intercepta cualquier `apply`/Helm contra el namespace |
| `prometheus` | Deployment + Service (ClusterIP) | ✅ Desplegado (`k8s/monitoring-ucu.yaml`) | scrapea `api:8000/metrics`; target `pet-core-api` confirmado `up` |
| `grafana` | Deployment + Service (ClusterIP) | ✅ Desplegado (`k8s/monitoring-ucu.yaml`) | consulta a `prometheus` como datasource |
| Falco | — | ❌ Descartado para este cluster | necesita acceso a nivel de nodo, compartido con otros equipos |
| `inventory-config`, `inventory-secret` | ConfigMap / Secret | ⚠️ De otro proyecto propio (Inventario), no de Pet-Core | no se conecta a nada de este proyecto |

Leyenda: ✅ desplegado y verificado · ❌ descartado deliberadamente · ⚠️ existe pero no es Pet-Core.

---

## 2. Acceso

- **URL pública del frontend**: `https://petcore.reto-ucu.net/`. El dominio `reto-ucu.net` que nos dio la UCU funciona como un "paraguas": cualquier palabra que se le ponga delante (`petcore.reto-ucu.net`, lo que sea) apunta al mismo gateway (APISIX), sin tener que pedirle a nadie que la registre. Nosotros elegimos `petcore` como nombre para nuestra app.
  - Le dijimos a APISIX (archivo `k8s/apisix-route-ucu.yaml`) una sola regla: todo lo que llegue a `petcore.reto-ucu.net` se manda al Service `frontend`. No hay ninguna otra regla — por eso no existe ningún camino desde internet hacia el backend (`api`): la gente de afuera solo puede hablarle al frontend.
  - La chart de Helm también crea, aparte, un Ingress (`host: petcore.local`) — es de la versión local (minikube), no se usa para el acceso público de este cluster. Está en el código porque la misma chart sirve para los dos entornos, pero acá para conectarnos utilizamos la `ApisixRoute`.
  - A través del proxy del frontend quedan públicas, sin login, `/api/docs` (el Swagger) y `/api/metrics`. **Decisión confirmada con el equipo (2026-11-15): se dejan públicas** — no exponen datos de clientes ni credenciales, solo estructura de la API y estadísticas, y puede ser útil tenerlas visibles para la demo. Si se quiere cambiar, se bloquean en el `nginx.conf` del frontend.
- **Jenkins**: sin URL pública se realizó con esa intención. Se accede con `kubectl port-forward svc/jenkins 8081:8080 -n alumno-team8` y se abre en `http://127.0.0.1:8081/` — por esto cada integrante que lo necesite corre su propio túnel con el kubeconfig del equipo.
- **Prometheus / Grafana**: tampoco tienen URL pública, se utilizó el mismo criterio que con Jenkins. Se accede con:
  - `kubectl port-forward svc/prometheus 9090:9090 -n alumno-team8` quedando en `http://127.0.0.1:9090/targets` (ver el estado de los scrape targets).
  - `kubectl port-forward svc/grafana 3000:3000 -n alumno-team8` quedando en `http://127.0.0.1:3000/` (usuario/contraseña `admin`/`admin`, pide cambiarla al entrar — el dashboard "Pet-Core" ya queda provisionado solo, carpeta "Pet-Core").
- Cluster: provisto por la UCU, compartido con otros equipos de la materia.
- Namespace asignado al equipo: `alumno-team8`.
- Kubeconfig: archivo propio del equipo (no se versionó en el repo), cargado en Jenkins como credencial `KUBECONFIG_UCU`.
- El usuario del equipo (`team8`) es un ServiceAccount **namespace-scoped** por lo tanto puede crear Deployments, Services, PVCs, Secrets, ConfigMaps, Jobs y `ApisixRoute` dentro de `alumno-team8`, pero no tiene permiso para crear `Role`/`RoleBinding` (ni ahí ni en ningún lado) ni ningún recurso cluster-scoped (ClusterRole, CRD, Webhook, Namespace). Verificado con `kubectl auth can-i`.

### Cuota del namespace (`student-quota`)

| Recurso | Límite | Uso actual aproximado que tenemos nosotros |
|---|---|---|
| Pods simultáneos | 15 | 4 permanentes + hasta 5 efímeros durante un build |
| CPU requests / limits | 2 / 4 | ~0.5-1 en reposo |
| Memoria requests / limits | 3Gi / 6Gi | ~1.5-2Gi en reposo |
| Almacenamiento total | 5Gi | 1Gi (`postgres`) + 2Gi (`jenkins`) = 3Gi usados |
| PersistentVolumeClaims | 3 | 2 usadas |
| LoadBalancers | 0 | — (por eso todo es `ClusterIP`, nunca `LoadBalancer`) |

---

## 3. Qué está desplegado ahora mismo

### Aplicación (vía Helm)

#### Qué es Helm y por qué lo usamos

La app no se arma con un solo archivo de Kubernetes, sino con varios: uno para la API, uno para el frontend, uno para la base de datos, uno para las contraseñas, etc. Sin ninguna herramienta de por medio, cada vez que se instala o se actualiza la app habría que aplicar todos esos archivos uno por uno, a mano.

**Helm es la herramienta que resuelve esto**: agarra todos esos archivos juntos y los aplica de una sola vez, con un solo comando, en vez de tener que aplicarlos de a uno.

Un **chart** es, literalmente, la carpeta donde se juntan todos esos archivos — en este proyecto, `helm-chart/`. No es más que eso: una carpeta organizada con todo lo que la app necesita para desplegarse.

Dentro de esos archivos hay valores que cambian según dónde se instala la app (por ejemplo, cuántas copias de la API correr: una en la notebook, posiblemente más en otro entorno). En vez de mantener una carpeta completa distinta por cada entorno, se usa **una sola carpeta** (`helm-chart/`) más un archivo aparte y chico que indica qué valores puntuales usar en cada caso — `values.yaml` tiene los valores por defecto, y `values-dev.yaml`/`values-prod.yaml` pisan solo los que cambian para ese entorno.

El comando que junta todo esto es:

```
helm upgrade --install petcore ./helm-chart -n alumno-team8 -f helm-chart/values-dev.yaml
```

`helm upgrade --install` le dice a Helm "instalá esto si es la primera vez, o actualizalo si ya existe" — un solo comando sirve para los dos casos. Lo que hace, en concreto, es reescribir dentro de Kubernetes el manifest de cada pieza de la app (la API, el frontend) con los valores indicados. A partir de ahí, es **Kubernetes mismo** quien nota que algo cambió y actualiza lo que corresponda.

#### Release actual

Release de Helm `petcore`, instalado/actualizado por el propio pipeline de Jenkins (`helm upgrade --install petcore ./helm-chart -n alumno-team8 -f helm-chart/values-dev.yaml`).

| Recurso | Nombre | Detalle |
|---|---|---|
| Deployment | `api` | imagen `manuelney67/clinica-veterinaria:build-N` |
| Deployment | `frontend` | imagen `manuelney67/clinica-frontend:build-N` |
| StatefulSet | `postgres` | `postgres-0`, 1 réplica |
| Service | `api` | ClusterIP, puerto 8000 |
| Service | `frontend` | ClusterIP, puerto 8080 |
| Service | `db` | ClusterIP (headless), puerto 5432 |
| ConfigMap | `api-config` | config no sensible de la API |
| ConfigMap | `postgres-init` | scripts de `db/init/` montados para el init de Postgres |
| Secret | `jwt-secret` | secreto de firma JWT |
| Secret | `postgres-secret` | credenciales de Postgres |

El tag de imagen (`build-N`) lo fija el `Jenkinsfile.ucu` en cada corrida (`IMAGE_TAG = "build-${BUILD_NUMBER}"`).

Los Secrets y el ConfigMap con datos sensibles no los crea la chart de Helm, porque sería inseguro tenerlos escritos en un `values.yaml` — la idea es que esos datos nunca queden guardados en el repositorio de GitHub. Para el cluster de la UCU, esos valores se declararon manualmente. Como se crean una sola vez a mano, cada build nuevo del pipeline (`helm upgrade`) no los vuelve a crear ni los modifica — solo verifica que ya existan antes de seguir (esto lo fuerza `helm-chart/templates/validaciones.yaml`: si falta algo, corta la instalación con un mensaje claro en vez de dejar los pods trabados sin explicación).

---

## 4. Jenkins en el cluster — decisiones y cómo quedó armado

### 4.2 Por qué no hay Docker dentro de este Jenkins

Para construir una imagen de Docker hace falta un motor de Docker al que pedirle que la arme — Jenkins no sabe construir imágenes por sí solo. En la notebook esto no era un problema porque ya teníamos Docker Desktop instalado: Jenkins simplemente usaba ese mismo Docker de la máquina.

El problema aparece al mover Jenkins adentro del cluster: ahí no hay ningún Docker instalado, así que el pod de Jenkins queda solo, sin forma de construir nada.

Este mismo problema ya lo habíamos visto hace un mes, en el trabajo práctico anterior sobre el cluster (el proyecto Inventario): ahí se resolvió instalando Docker dentro del propio pod de Jenkins (Docker-in-Docker). El problema de esa solución es que el contenedor necesita correr con permisos de administrador sobre el nodo del cluster, no solo sobre sí mismo. Y el cluster que usamos ahora lo compartimos con otros equipos: si le diéramos esos permisos a nuestro contenedor y tuviera un bug o fuera comprometido, el problema podría extenderse más allá de nuestro propio namespace, afectando a otros equipos.

Por eso, para Pet-Core, se decidió no repetir esa solución a pesar de que ya la conocíamos (el cluster técnicamente la permitiría: se probó con `kubectl apply --dry-run=server` que no hay restricción de `PodSecurity` en este namespace). En su lugar, se usó **Kaniko**.

### 4.3 Qué es Kaniko y por qué se integró a mano, sin el plugin de Kubernetes de Jenkins

Kaniko es una herramienta que construye imágenes de Docker **sin necesitar un motor de Docker instalado y sin necesitar permisos de administrador**: lee el `Dockerfile` por su cuenta y arma la imagen capa por capa, corriendo como un contenedor normal. En la práctica, cuando el pipeline necesita construir una imagen, Jenkins lanza un pod aparte y temporal con Kaniko adentro, que clona el código, arma la imagen, la sube a Docker Hub, y se borra solo al terminar.

Lo que dice el propio `Jenkinsfile.ucu` es que lanza Kaniko a mano, como un `Job` de Kubernetes suelto, con `kubectl apply` usando el kubeconfig que el equipo ya tiene. Y como crear un `Job` no requiere ningún `Role` nuevo esto evita tanto el problema de permisos como el de privilegios.

### 4.4 Por qué no hay Ingress para Jenkins

No quisimos de cierta manera "exponer" la administración de Jenkings a internet por eso decidimos dejarlo accesisble solo con `port-forward`.

### 4.5 El manifest (`k8s/jenkins-ucu.yaml`).

- **PVC de 2Gi, no 5Gi**: la quota del namespace limita el almacenamiento total a 5Gi y Postgres ya usa 1Gi, como pensamos que ninguna otra aplicación iba a requerir de este almacenamiento persistente decidimos dejarle 2Gi.
- **`strategy: Recreate`**: el volumen es `ReadWriteOnce` (un solo pod a la vez). Con `RollingUpdate` normal, el pod nuevo quedaría esperando un volumen que el viejo todavía tiene agarrado. El costo: cada vez que se actualiza este manifest, el pod se reinicia — **si hay un build corriendo en ese momento, se interrumpe** (pasó en la práctica más de una vez).
- **`initContainer` "herramientas"**: la imagen `jenkins/jenkins:lts` no trae `kubectl` ni `helm`. Un contenedor que corre antes (`alpine:3.20`) los descarga a un volumen compartido (`/tools`), que el contenedor principal agrega a su `PATH`. Mismo patrón que usó el proyecto Inventario para el mismo problema.
- **Sin sidecar**: a diferencia del proyecto Inventario (que sí tenía un `dind` privilegiado), este Jenkins no tiene ningún contenedor extra — todo el trabajo "pesado" lo hacen Jobs aparte (sección 5).

---

## 5. El `Jenkinsfile.ucu`, etapa por etapa

Este es distinto del `Jenkinsfile` que es el que se utiliza para el cluster local

| Etapa | Qué hace | Corta el pipeline si falla |
|---|---|---|
| 1. Clonación | `checkout scm` + reescribe el kubeconfig para apuntar a la dirección **interna** del cluster (la dirección pública no es alcanzable desde un pod del propio cluster) | — |
| 2. Semgrep | Job efímero (`semgrep/semgrep`), clona el repo con `alpine/git`, analiza y reporta | No — solo informa |
| 3. Snyk | Job efímero (`node:22-alpine`), instala `uv`/`pip`/`npm` y corre `snyk test` sobre backend y frontend | Sí, ante vulnerabilidad crítica |
| 4. Tests | Job efímero (`python:3.13-slim`), `uv sync --locked && uv run pytest -v` | Sí |
| 5. Build + Push | **Dos** Jobs de Kaniko (backend y frontend) **en paralelo**, cada uno clona el repo él mismo (`--context=git://...`, directo desde GitHub) y publica en Docker Hub. Usan `--cache=true --cache-repo=...` para reusar capas entre corridas | Sí |
| 6. Deploy | `helm upgrade --install petcore ...` con las imágenes nuevas — el *rolling update* en sí lo ejecuta Kubernetes solo. | Sí |

**La función `correrJob`** (al final del archivo) centraliza la lógica repetida en las etapas 2 a 5 lo que hace es aplicar el manifest de ese job, trae su log, y decide si cortar el pipeline según el resultado. Es una cuestión de prolijidad del código, no afecta en nada el comportamiento.

---

## 6. Prometheus / Grafana en el cluster

**Desplegados en el cluster** (`k8s/monitoring-ucu.yaml`), adaptados de la versión local (`k8s/prometheus-*.yaml`, `k8s/grafana-*.yaml`). Dos diferencias necesarias respecto a esa versión:

1. **Sin el job `kubernetes-cadvisor`** (el que mide CPU/memoria por contenedor vía cAdvisor): necesita un `ClusterRole`/`ClusterRoleBinding` que el equipo no puede crear en este cluster pero si en el local. Por eso el dashboard de Grafana en este cluster **no tiene** los 2 paneles de "CPU/RAM de la API (% del límite)" que sí existen en la versión local — se sacaron en vez de dejarlos rotos sin datos.
2. **Grafana queda en `ClusterIP`, no `NodePort`**: igual que Jenkins, no conviene exponer un panel con usuario/contraseña por defecto (`admin`/`admin`) a internet. Se accede con `kubectl port-forward`, nunca desde afuera del cluster.

El resto (métricas HTTP de la API — requests, latencia, errores — y las métricas de negocio como turnos creados/cancelados) funciona igual que en local, scrapeando directo `api:8000/metrics`.

---

## 7. Kyverno y Falco: por qué no son trabajo nuestro en este cluster

A diferencia de Prometheus/Grafana, estas dos herramientas no las desplegamos ni las administramos acá — cada una por un motivo distinto.

### Kyverno

Kyverno ya viene instalado en el cluster que nos dio la UCU, lo administran ellos, nosotros no lo tocamos. Intentamos ver qué políticas tiene configuradas (`kubectl auth can-i list clusterpolicies`) y nos dio Forbidden — no tenemos permiso ni para mirarlo. Así que no sabemos exactamente qué reglas tiene activas ni en qué modo están corriendo, solo podemos ver si algo se rechaza o no cuando lo probamos.

### Falco

Decidimos no instalar Falco en el cluster de la UCU, por decisión nuestra, no porque no se pudiera. El tema es que Falco, para vigilar de verdad, necesita acceso a nivel de **nodo** (el servidor físico), no a nivel de nuestro namespace. Y ese nodo lo compartimos con otros equipos de la clase. Si pusiéramos Falco ahí, estaríamos vigilando en tiempo real no solo nuestros contenedores, sino también los de los otros equipos que corren en el mismo nodo — eso no nos corresponde, es meternos donde no deberíamos. Por eso la evidencia de Falco la dejamos en minikube (nuestra propia máquina), donde sí es 100% nuestro.

---

## 8. Guía práctica: hacer un cambio y verlo funcionando, paso a paso

Todo lo anterior explica las piezas. Esta sección es la receta completa: desde que alguien toca código hasta que se ve andando en el cluster, con el comando exacto para cada paso y cómo saber si salió bien.

### 8.1 Hacer el cambio y subirlo

1. Editar el código (backend `app/`, frontend `frontend/src/`, infraestructura `k8s/`, `helm-chart/`, o el propio `Jenkinsfile.ucu`).
2. Commitear y pushear a la rama que tiene configurado el job de Jenkins:
   ```
   git add .
   git commit -m "..."
   git push
   ```
3. El `Jenkinsfile` **local** (el de Docker) y el `Jenkinsfile.ucu` (el del cluster) son archivos distintos — si el cambio es sobre cómo corre el pipeline, hay que tocar el que corresponda al entorno donde se quiere ver el efecto.

### 8.2 Ver que el pipeline se disparó

No hay webhook (Jenkins no es alcanzable desde GitHub) — el disparo es por **polling**, cada 5 minutos, y solo si el commit tocó una ruta relevante (`app/`, `frontend/`, `helm-chart/`, `Jenkinsfile.ucu`, `k8s/`, `db/`, `pyproject.toml`, `uv.lock`).

- Para no esperar: entrar a Jenkins y apretar **Build Now** a mano.
- Para confirmar que arrancó solo (no manual): en Jenkins, la lista de builds del job `petcore-pipeline` muestra una build nueva con "Started by SCM change" en vez de "Started by user ...".

### 8.3 Ver el progreso en vivo (Jenkins)

```
kubectl port-forward svc/jenkins 8081:8080 -n alumno-team8
```
→ `http://127.0.0.1:8081/` → job `petcore-pipeline` → la build en curso → **Console Output** (o `/consoleText` para la versión plana, más liviana por el túnel, que siempre tiene más latencia que un acceso directo).

Mientras corre, se puede mirar en paralelo qué Jobs/pods efímeros hay vivos en ese momento:
```
kubectl get pods -n alumno-team8
kubectl get jobs -n alumno-team8
```
(van a aparecer y desaparecer: `semgrep-N`, `snyk-N`, `pytest-N`, `kaniko-backend-N`, `kaniko-frontend-N`, con `N` = número de build).

### 8.4 Si una etapa falla, cómo ver por qué

- El log de cada etapa en la consola de Jenkins ya incluye el log del Job de Kubernetes correspondiente (lo vuelca `correrJob`, sección 5).
- Si el Job ya se autolimpió (`ttlSecondsAfterFinished: 300`, 5 minutos) y hace falta mirarlo en caliente:
  ```
  kubectl logs job/<nombre-del-job> -n alumno-team8 --all-containers
  kubectl describe pod -n alumno-team8 -l job-name=<nombre-del-job>
  ```
- Los mensajes de error de Kubernetes/Jenkins suelen decir directamente qué falta (por ejemplo, una credencial no cargada, o una imagen que no se pudo bajar) — conviene leer el log completo antes de asumir la causa.

### 8.5 Confirmar que terminó y qué quedó desplegado

```
helm list -n alumno-team8
kubectl get deployment api frontend -n alumno-team8 -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.template.spec.containers[*].image}{"\n"}{end}'
```
El número de revisión de Helm sube, y el tag de imagen (`build-N`) coincide con el número de la build de Jenkins que acaba de correr.

### 8.6 Ver la app funcionando

- **Navegador, directo**: `https://petcore.reto-ucu.net/` — sin túnel, es la URL pública real.
- Para confirmar que lo que se ve es la versión nueva (no una cacheada): abrir en una ventana privada/incógnito, o mirar la Network tab y confirmar el hash del archivo `/assets/index-*.js` cambió respecto a antes.

### 8.7 Ver las métricas de esa corrida

```
kubectl port-forward svc/grafana 3000:3000 -n alumno-team8
```
→ `http://127.0.0.1:3000/` (`admin`/`admin` la primera vez) → Dashboards → carpeta **Pet-Core** → dashboard "Pet-Core — Monitoreo". Si los gráficos están vacíos, es porque no hubo tráfico todavía — navegar la app pública unos segundos y refrescar (scrape cada 15s).

Para ver el estado crudo de Prometheus (qué está scrapeando y si está `up`):
```
kubectl port-forward svc/prometheus 9090:9090 -n alumno-team8
```
→ `http://127.0.0.1:9090/targets`.

### 8.8 Resumen en una tabla: "quiero ver/hacer X, ¿cómo?"

| Quiero... | Comando / URL |
|---|---|
| Ver si el pipeline está corriendo | `kubectl get pods -n alumno-team8` (buscar pods efímeros) |
| Ver el log de Jenkins en vivo | `kubectl port-forward svc/jenkins 8081:8080 -n alumno-team8` → `127.0.0.1:8081` |
| Disparar un build a mano | Jenkins UI → job → **Build Now** |
| Ver qué imagen está desplegada ahora | `kubectl get deployment api frontend -n alumno-team8 -o jsonpath=...` |
| Ver el historial de releases de Helm | `helm history petcore -n alumno-team8` |
| Entrar a la app | `https://petcore.reto-ucu.net/` |
| Ver métricas / dashboard | `kubectl port-forward svc/grafana 3000:3000 -n alumno-team8` → `127.0.0.1:3000` |
| Ver el estado de los scrape targets | `kubectl port-forward svc/prometheus 9090:9090 -n alumno-team8` → `127.0.0.1:9090/targets` |
| Ver cuánta cuota queda libre | `kubectl get resourcequota student-quota -n alumno-team8 -o jsonpath='{.status}'` |
| Revertir a una versión anterior sin esperar un nuevo build | `helm rollback petcore <revisión> -n alumno-team8` |

---

## 9. Comandos de referencia rápida

Todos los comandos que aparecen sueltos en el resto del documento, juntos acá con la explicación de para qué sirve cada uno. Pensado para que cualquiera del equipo (no solo quien lo armó) entienda qué hace cada línea antes de copiarla.

### 9.1 Configurar el acceso — una sola vez por integrante

Antes de poder correr cualquier otro comando de esta lista, hace falta tener el kubeconfig del equipo apuntando a este cluster. Es un archivo que ya existe (no se versiona en el repo, por seguridad) — cada integrante lo guarda en su propia máquina:

```
# Guardar el archivo que te paso el equipo, por ejemplo en:
#   Windows: $HOME\.kube\ucu.yaml
#   Git Bash / Linux/Mac: ~/.kube/ucu.yaml

# Después, para que "kubectl" lo use sin tener que repetir --kubeconfig en cada comando:
export KUBECONFIG=~/.kube/ucu.yaml          # Git Bash
$env:KUBECONFIG = "$HOME\.kube\ucu.yaml"    # PowerShell

# Confirmar que apunta donde corresponde:
kubectl config current-context    # tiene que decir "ucu"
kubectl get pods -n alumno-team8  # si responde con la lista de pods, está bien configurado
```

Esta misma identidad (`team8`) es la que usa Jenkins — está cargada ahí como la credencial `KUBECONFIG_UCU`, no hay que crear una nueva por cada persona.

### 9.2 Entrar a las UIs internas (`kubectl port-forward`)

**Qué es un `port-forward`, en una frase:** abre un túnel entre un puerto de tu propia máquina y un Service de dentro del cluster — mientras el comando queda corriendo en una terminal, podés usar ese puerto local como si el servicio estuviera en tu PC. Ninguna de estas tres UIs tiene URL pública, a propósito, así que esta es la única forma de entrar.

```
# Jenkins: ver y disparar builds del pipeline
kubectl port-forward svc/jenkins 8081:8080 -n alumno-team8
# → abrir http://127.0.0.1:8081

# Grafana: ver el dashboard de métricas
kubectl port-forward svc/grafana 3000:3000 -n alumno-team8
# → abrir http://127.0.0.1:3000  (usuario/contraseña: admin/admin la primera vez)

# Prometheus: ver el estado crudo de qué se está scrapeando
kubectl port-forward svc/prometheus 9090:9090 -n alumno-team8
# → abrir http://127.0.0.1:9090/targets
```

Cada túnel ocupa la terminal donde se corre (queda "colgado" ahí a propósito, mientras lo necesites) — si lo cerrás, se corta, y lo volvés a abrir con el mismo comando. No se puede compartir el link con nadie más: `127.0.0.1` es siempre "esta misma máquina", cada persona necesita correr su propio túnel.

### 9.3 Ver estado / diagnóstico

```
kubectl get pods -n alumno-team8              # qué hay corriendo ahora (incluye los pods efimeros si hay un build activo)
kubectl get jobs -n alumno-team8              # Jobs del pipeline (Semgrep, Snyk, tests, Kaniko)
kubectl get deployment api frontend -n alumno-team8 \
  -o jsonpath='{range .items[*]}{.metadata.name}{" -> "}{.spec.template.spec.containers[*].image}{"\n"}{end}'
                                               # que imagen (tag build-N) tiene cada Deployment ahora mismo
kubectl get resourcequota student-quota -n alumno-team8 -o jsonpath='{.status}'
                                               # cuanto se esta usando de la cuota del namespace vs el limite
kubectl top pod -n alumno-team8               # consumo real de CPU/memoria de cada pod
kubectl logs job/<nombre-del-job> -n alumno-team8 --all-containers
                                               # log completo de un Job (si todavia no se autolimpio)
kubectl describe pod -n alumno-team8 -l job-name=<nombre-del-job>
                                               # eventos del pod de un Job (util cuando no llega a arrancar)
kubectl auth can-i <verbo> <recurso> -n alumno-team8
                                               # confirmar si la cuenta del equipo tiene o no un permiso puntual
```

### 9.4 Helm (qué versión está desplegada, y volver atrás)

```
helm list -n alumno-team8              # release actual, revision, estado
helm history petcore -n alumno-team8   # todas las revisiones anteriores
helm rollback petcore <revisión> -n alumno-team8
                                        # volver a una version anterior sin esperar un build nuevo
```

### 9.5 Git (disparar el pipeline)

```
git add .
git commit -m "..."
git push
```

El `push` es lo que el `Poll SCM` de Jenkins va a detectar (cada 5 minutos, solo si tocó una ruta relevante). Para no esperar, se puede entrar a Jenkins y apretar **Build Now** a mano.
