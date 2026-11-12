# Qué hay desplegado en el cluster de la UCU (namespace `alumno-team8`)

> Este archivo es el documento **principal** sobre el cluster de la UCU: qué está desplegado hoy, y también cómo y por qué se armó así (en particular, Jenkins — que es la parte más compleja). No es un entregable en sí mismo ni reemplaza a `ENTREGABLE_4.md` — es la referencia técnica para no perder la cuenta ni confundir esta evidencia con la de minikube local. Se actualiza a mano cada vez que algo cambia.
>
> Para los diagramas de arquitectura física (pod por pod, con quién habla cada uno) ver [`ARQUITECTURA_FISICA_CLUSTER_UCU.md`](./ARQUITECTURA_FISICA_CLUSTER_UCU.md) — ese documento se mantiene aparte porque es largo y centrado en diagramas, no en decisiones.
>
> Última verificación: 2026-11-12, contra `kubectl` con el kubeconfig `KUBECONFIG_UCU` (contexto `ucu`, usuario `team8`, namespace `alumno-team8`).

## Índice

1. [Mapa de componentes](#1-mapa-de-componentes)
2. [Acceso](#2-acceso)
3. [Qué está desplegado ahora mismo](#3-qué-está-desplegado-ahora-mismo)
4. [Jenkins en el cluster — decisiones y cómo quedó armado](#4-jenkins-en-el-cluster--decisiones-y-cómo-quedó-armado)
5. [El `Jenkinsfile.ucu`, etapa por etapa](#5-el-jenkinsfileucu-etapa-por-etapa)
6. [Problemas reales que aparecieron y cómo se resolvieron](#6-problemas-reales-que-aparecieron-y-cómo-se-resolvieron)
7. [Otras herramientas del D4 (Kyverno, Falco, Prometheus/Grafana)](#7-otras-herramientas-del-d4-kyverno-falco-prometheusgrafana)

---

## 1. Mapa de componentes

| Componente | Tipo de recurso | Estado | Se conecta con |
|---|---|---|---|
| `api` | Deployment + Service (ClusterIP) | ✅ Desplegado (`build-8`) | `postgres` (SQL); solo lo alcanza `frontend`, no tiene ruta pública propia |
| `frontend` | Deployment + Service (ClusterIP) | ✅ Desplegado (`build-8`) | `api` (proxy interno); único Service expuesto al público |
| `postgres` | StatefulSet + Service headless (`db`) | ✅ Desplegado | consumido por `api` |
| `jwt-secret`, `postgres-secret` | Secret | ✅ Desplegado | montados en `api` / `postgres` |
| `postgres-init`, `api-config` | ConfigMap | ✅ Desplegado | montados en `postgres` / `api` |
| Jenkins (controlador) | Deployment + PVC (2Gi) + Service | ✅ Desplegado | lanza Jobs efímeros y hace `helm upgrade` |
| Kaniko | Job efímero (backend + frontend, en paralelo) | ✅ Funciona, probado de punta a punta | lo lanza Jenkins, publica en Docker Hub |
| `docker-config-kaniko` | Secret (`dockerconfigjson`) | ✅ Se recrea cada build | lo usa Kaniko para publicar |
| `petcore-route` | ApisixRoute (`k8s/apisix-route-ucu.yaml`) | ✅ Desplegado | expone únicamente `frontend` al público |
| Kyverno (webhook de admisión) | Instalación cluster-wide | ✅ Activo (no administrado por el equipo) | intercepta cualquier `apply`/Helm contra el namespace |
| Prometheus / Grafana | — | 🔜 Evaluando | ver sección 7 |
| Falco | — | ❌ Descartado para este cluster | ver sección 7 |
| `inventory-config`, `inventory-secret` | ConfigMap / Secret | ⚠️ De otro proyecto propio (Inventario), no de Pet-Core | no se conecta a nada de este proyecto |

Leyenda: ✅ desplegado y verificado · 🔜 evaluando, todavía no aplicado · ❌ descartado deliberadamente · ⚠️ existe pero no es de Pet-Core.

---

## 2. Acceso

- **URL pública del frontend**: `https://petcore.reto-ucu.net/` (vía `ApisixRoute` `petcore-route`). `reto-ucu.net` tiene DNS wildcard (`*.reto-ucu.net` resuelve al mismo gateway) — se usa el subdominio propio `petcore` en vez de colgarse de un subdominio ajeno con un path largo. Hay **una sola regla** en la `ApisixRoute`, que manda todo al Service `frontend` — el Service `api` no tiene ninguna ruta pública propia: los clientes solo hablan con el frontend, nunca directo con el backend (las llamadas a `/api/...` las resuelve el propio `nginx.conf` del frontend, reenviando por dentro del namespace). El Ingress nginx que también crea la chart de Helm (`petcore.local`) no sirve para acceso externo: resuelve a una IP interna del cluster.
- **Jenkins**: sin URL pública, a propósito. Se accede con `kubectl port-forward svc/jenkins 8081:8080 -n alumno-team8` y `http://127.0.0.1:8081/` — cada integrante que lo necesite corre su propio túnel con el kubeconfig del equipo. No se puede "compartir" ese link: `127.0.0.1` es la propia máquina de cada uno.
- Cluster: provisto por la UCU, compartido con otros equipos de la materia.
- Namespace asignado al equipo: `alumno-team8`.
- Kubeconfig: archivo propio del equipo (no se versiona en el repo), cargado en Jenkins como credencial `KUBECONFIG_UCU`.
- El usuario del equipo (`team8`) es un ServiceAccount **namespace-scoped**: puede crear Deployments, Services, PVCs, Secrets, ConfigMaps, Jobs y `ApisixRoute` dentro de `alumno-team8`, pero no tiene permiso para crear `Role`/`RoleBinding` (ni ahí ni en ningún lado) ni ningún recurso cluster-scoped (ClusterRole, CRD, Webhook, Namespace). Verificado con `kubectl auth can-i`.
- `frontend/src/app/App.jsx` tiene un `basename` condicional para un prefijo de path (`/alumno-team8-petcore`) que quedó de una versión anterior de la ruta pública. Ya no hace falta con la URL actual (vive en la raíz del subdominio), pero no rompe nada — se puede limpiar sin apuro.

### Cuota del namespace (`student-quota`)

| Recurso | Límite | Uso actual aproximado |
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

El tag de imagen (`build-N`) lo fija el `Jenkinsfile.ucu` en cada corrida (`IMAGE_TAG = "build-${BUILD_NUMBER}"`) — nunca es `latest` (la política Kyverno `disallow-latest-tag`, activa en este cluster, lo rechazaría).

Los Secrets/ConfigMaps de arriba no los crea la chart de Helm (decisión de diseño documentada en `helm-chart/values.yaml`, forzada por `helm-chart/templates/validaciones.yaml`): se crearon una sola vez a mano, siguiendo el mismo patrón que `scripts/4to_entregable/preparar-chart.sh` usa contra minikube, apuntando al namespace `alumno-team8`.

### Recursos que ya existían en el namespace — de un proyecto propio anterior, no de Pet-Core

- ConfigMap `inventory-config`, Secret `inventory-secret`: son del proyecto anterior del equipo, **Inventario** (`C:\Repos\DevOps-InventoryProyect`), que ya usaba este mismo namespace con su propio Jenkins. No tocar: siguen siendo del equipo, pero **no son parte del D4 de Pet-Core** — no mezclar esta evidencia con la de este entregable.

---

## 4. Jenkins en el cluster — decisiones y cómo quedó armado

### 4.1 Por qué adentro del cluster y no solo local

Al principio Jenkins corría únicamente en Docker, en la notebook del equipo (`scripts/4to_entregable/jenkins-up.sh`). Eso funciona, pero si la notebook de quien lo tiene está apagada, nadie más puede ver ni correr el pipeline. Por eso se levantó una segunda instancia, esta vez **dentro del namespace del cluster**, para que no dependa de una PC puntual. Las dos conviven: la local queda como entorno de desarrollo/backup.

### 4.2 Por qué no hay Docker dentro de este Jenkins

En la notebook, Jenkins construía imágenes porque se le montaba el socket de Docker Desktop — se le prestaba el Docker que ya estaba instalado ahí. Adentro de un pod no hay ningún Docker para prestarle. Las formas clásicas de resolver esto (Docker-in-Docker con sidecar privilegiado, o montar el socket real del nodo) requieren que el contenedor corra en modo **privilegiado**, con permisos de administrador sobre el servidor físico. El cluster técnicamente lo permite (se probó con `kubectl apply --dry-run=server` que no hay restricción de `PodSecurity` en este namespace), pero no se hizo: el nodo se comparte con otros equipos, y un contenedor privilegiado ahí es una superficie de ataque sobre infraestructura que no es nuestra. Decisión deliberada, no limitación técnica.

### 4.3 Por qué Kaniko a mano, y no el plugin de Kubernetes de Jenkins

Kaniko construye imágenes leyendo el `Dockerfile` capa por capa, sin daemon de Docker y sin privilegios. La forma "oficial" de integrarlo con Jenkins (el plugin de Kubernetes, que lanza agentes dinámicos) necesita que la cuenta pueda crear `Role`/`RoleBinding` por cada agente — permiso que el equipo **no tiene**. Por este motivo, el proyecto anterior del equipo (Inventario, mismo namespace) había descartado Kaniko y optado por un sidecar privilegiado.

La diferencia acá: el propio `Jenkinsfile.ucu` lanza Kaniko **a mano**, como un `Job` de Kubernetes suelto, con `kubectl apply` usando el kubeconfig que el equipo ya tiene. Crear un `Job` no requiere ningún `Role` nuevo (se verificó: `kubectl auth can-i create jobs` → `yes`). Esto evita tanto el problema de permisos como el de privilegios.

### 4.4 Por qué no hay Ingress para Jenkins

No se pudo confirmar qué `IngressClass` está disponible en este cluster (recurso cluster-scoped, sin permiso para listarlo). En vez de arriesgar un Ingress con una clase que podría no existir, se decidió no publicar Jenkins: se accede solo por `port-forward` (ver sección 2). Esto además evita exponer el panel de administración de Jenkins a internet.

### 4.5 El manifest (`k8s/jenkins-ucu.yaml`), lo no obvio

- **PVC de 2Gi, no 5Gi**: la quota del namespace limita el storage total a 5Gi, y Postgres ya usa 1Gi. Pedir los 5Gi completos hizo fallar el primer intento (`exceeded quota`).
- **`strategy: Recreate`**: el volumen es `ReadWriteOnce` (un solo pod a la vez). Con `RollingUpdate` normal, el pod nuevo quedaría esperando un volumen que el viejo todavía tiene agarrado. El costo: cada vez que se actualiza este manifest, el pod se reinicia — **si hay un build corriendo en ese momento, se interrumpe** (pasó en la práctica más de una vez).
- **`initContainer` "herramientas"**: la imagen `jenkins/jenkins:lts` no trae `kubectl` ni `helm`. Un contenedor que corre antes (`alpine:3.20`) los descarga a un volumen compartido (`/tools`), que el contenedor principal agrega a su `PATH`. Mismo patrón que usó el proyecto Inventario para el mismo problema.
- **Sin sidecar**: a diferencia del proyecto Inventario (que sí tenía un `dind` privilegiado), este Jenkins no tiene ningún contenedor extra — todo el trabajo "pesado" lo hacen Jobs aparte (sección 5).

---

## 5. El `Jenkinsfile.ucu`, etapa por etapa

Vive separado del `Jenkinsfile` de la raíz (el del Jenkins local, con `docker run`). Cada Jenkins usa su propio archivo (`Script Path` en la config del job), para que un cambio en un entorno no rompa el otro.

| Etapa | Qué hace | Corta el pipeline si falla |
|---|---|---|
| 1. Clonación | `checkout scm` + reescribe el kubeconfig para apuntar a la dirección **interna** del cluster (ver sección 6) | — |
| 2. Semgrep | Job efímero (`semgrep/semgrep`), clona el repo con `alpine/git`, analiza y reporta | No — solo informa |
| 3. Snyk | Job efímero (`node:22-alpine`), instala `uv`/`pip`/`npm` y corre `snyk test` sobre backend y frontend | Sí, ante vulnerabilidad crítica |
| 4. Tests | Job efímero (`python:3.13-slim`), `uv sync --locked && uv run pytest -v` | Sí |
| 5. Build + Push | **Dos** Jobs de Kaniko (backend y frontend) **en paralelo**, cada uno clona el repo él mismo (`--context=git://...`, directo desde GitHub) y publica en Docker Hub. Usan `--cache=true --cache-repo=...` para reusar capas entre corridas | Sí |
| 6. Deploy | `helm upgrade --install petcore ...` con las imágenes nuevas — el *rolling update* en sí lo ejecuta Kubernetes solo (estrategia por defecto, sin configuración especial) | Sí |

**La función `correrJob`** (al final del archivo) centraliza la lógica repetida en las etapas 2 a 5: aplica el manifest del Job, espera a que termine (con un *polling* manual de hasta 10 minutos), trae su log, y decide si cortar el pipeline según el resultado. Sin ella, esa lógica se repetiría casi palabra por palabra seis veces.

El `SNYK_TOKEN` se pasa como variable de entorno dentro del propio YAML del Job (igual de expuesto que cuando se pasaba con `docker run -e SNYK_TOKEN=...` en el Jenkinsfile local) — el Job se autolimpia solo (`ttlSecondsAfterFinished: 300`).

---

## 6. Problemas reales que aparecieron y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| `kubectl apply` se cuelga con `dial tcp ...: i/o timeout` contra `kubernetes-main-node.reto-ucu.net` | La credencial `KUBECONFIG_UCU` tiene la dirección **pública** del cluster. Un pod de adentro del cluster no puede alcanzar la IP pública de su propio cluster | Reescribir el kubeconfig para apuntar a `https://kubernetes.default.svc` (dirección interna), conservando el usuario/token original |
| `kubectl apply` falla por validación OpenAPI | Por defecto descarga el esquema OpenAPI del cluster antes de aplicar — esa descarga pega contra la misma IP pública bloqueada | `--validate=false` en todos los `kubectl apply` |
| `helm: command not found` en la etapa de deploy | El `initContainer` solo instalaba `kubectl`, nunca se agregó `helm` | Agregar la descarga de `helm` al mismo `initContainer` |
| El pipeline se interrumpe con `Resuming build ... after Jenkins restart` | Se aplicó un cambio al `Deployment` de Jenkins mientras había un build corriendo — el pod viejo se borró y Jenkins perdió el proceso que esperaba | No tocar el `Deployment` de Jenkins con un build activo (el Job de Kubernetes en sí sobrevive, es un objeto separado) |
| `ERROR: Could not find credentials entry with ID 'SNYK_TOKEN'` | La credencial nunca se cargó en esta instancia de Jenkins (no se comparten entre instancias aunque tengan el mismo ID) | Cargarla de nuevo en System → Global de este Jenkins |
| La app pública cargaba en blanco | `App.jsx` usaba `<BrowserRouter>` sin `basename`; React Router comparaba sus rutas contra una URL que incluía un prefijo que ninguna ruta esperaba | Resuelto de raíz al pasar a la URL por subdominio (`petcore.reto-ucu.net/`, sin prefijo) |
| `kubectl logs` da `unable to retrieve container logs for containerd://...` justo al terminar un Job | Condición de carrera: el runtime todavía no volcó el log a disco | Pequeña espera + reintento en `correrJob` |
| Dos builds corriendo a la vez (`semgrep-8` y `snyk-9` simultáneos) | No se marcó "Do not allow concurrent builds" en la config del job — el `Poll SCM` puede disparar un build nuevo antes de que termine el anterior | Tildar esa opción en **Configure → General** |
| El backend quedaba expuesto directo en internet (`/api/*` en APISIX) | La `ApisixRoute` original tenía una regla extra que mandaba `/api/*` directo al Service `api` | Se sacó esa regla: ahora todo el tráfico público va solo al `frontend`, que ya tiene su propio proxy interno hacia `api` |

---

## 7. Otras herramientas del D4 (Kyverno, Falco, Prometheus/Grafana)

### Kyverno

**No administrado por el equipo, pero activo.** El cluster ya tiene Kyverno instalado y funcionando a nivel cluster (lo gestiona la UCU) — se confirmó que la política `disallow-latest-tag` rechaza un deploy con tag `:latest` contra este namespace. El equipo no tiene permiso para listar ni crear `ClusterPolicy` propias (`kubectl auth can-i list clusterpolicies` → Forbidden). No hay nada que desplegar de nuestra parte; la evidencia es la prueba de que la política activa efectivamente bloquea.

### Falco

**No desplegado, decisión deliberada.** Necesita acceso a nivel de nodo (hostPID, hostNetwork, socket del runtime) para tener visibilidad real. El cluster técnicamente lo permitiría (mismo hallazgo que en 4.2: no hay restricción de `PodSecurity` para esto), pero no se despliega ahí: el nodo es compartido con otros equipos, y de paso solo vería ese nodo en particular — ni sería una demo limpia. La evidencia de Falco se mantiene en minikube local, documentando esta limitación de RBAC/multi-tenant como parte del análisis.

### Prometheus / Grafana

**Todavía no desplegados en este cluster.** La evidencia de monitoreo del D4 hoy vive en minikube local (`k8s/prometheus-*.yaml`, `k8s/grafana-*.yaml`). Evaluando sumarlos acá también — no necesitarían permisos adicionales (alcanza con lo que el namespace ya permite), usando targets estáticos para Prometheus en vez de descubrimiento vía API (que sí necesitaría permisos de lectura que el equipo no puede otorgarle a un ServiceAccount propio, al no poder crear Roles).
