# Qué hay desplegado en el cluster de la UCU (namespace `alumno-team8`)

> Este archivo es un registro del **estado real y actual** del cluster compartido que nos dio la UCU. No es un entregable en sí mismo ni reemplaza a `ENTREGABLE_4.md` — es la foto de "qué está corriendo ahí ahora" para no perder la cuenta ni confundirlo con lo que corre en minikube local. Se actualiza a mano cada vez que algo cambia en el cluster.
>
> Última verificación: 2026-11-11, contra `kubectl` con el kubeconfig `KUBECONFIG_UCU` (contexto `ucu`, usuario `team8`, namespace `alumno-team8`).

## Mapa de componentes (para el diagrama final)

Tabla pensada para poder dibujar el diagrama de componentes del cluster al final: qué nodo del diagrama es, en qué estado está, y con qué otros componentes se conecta. Se actualiza cada vez que algo cambia de estado.

| Componente | Tipo de recurso | Estado | Namespace | Se conecta con |
|---|---|---|---|---|
| `api` | Deployment + Service (ClusterIP) | ✅ Desplegado | alumno-team8 | `postgres` (SQL), expuesto a `frontend` |
| `frontend` | Deployment + Service (ClusterIP) | ✅ Desplegado | alumno-team8 | `api` (HTTP) |
| `postgres` | StatefulSet + Service headless | ✅ Desplegado | alumno-team8 | consumido por `api` |
| `jwt-secret`, `postgres-secret` | Secret | ✅ Desplegado | alumno-team8 | montados en `api` / `postgres` |
| `postgres-init`, `api-config` | ConfigMap | ✅ Desplegado | alumno-team8 | montados en `postgres` / `api` |
| Kyverno (webhook de admisión) | Instalación cluster-wide | ✅ Activo (no administrado por el equipo) | cluster-scope | intercepta cualquier `kubectl apply`/Helm contra el namespace |
| Jenkins (controlador) | Deployment + PVC (2Gi) + Service | ✅ Desplegado | alumno-team8 | dispara builds (Kaniko) y despliegues (Helm → `api`/`frontend`) |
| `petcore-route` | ApisixRoute (`k8s/apisix-route-ucu.yaml`) | ✅ Desplegado | alumno-team8 | expone `frontend` al público vía el gateway APISIX del laboratorio |
| Kaniko | Job (efímero, por build) | 🔜 Planeado | alumno-team8 | lo lanza Jenkins, publica imagen en Docker Hub (externo) |
| Docker Hub | Registry externo | ✅ Ya en uso | — (externo) | `api`/`frontend` hacen `imagePullPolicy` desde ahí; Kaniko publica ahí |
| Prometheus | Deployment + ConfigMap + Service | 🔜 Planeado | alumno-team8 | scrapea `/metrics` de `api` (targets estáticos) |
| Grafana | Deployment + ConfigMap + Service | 🔜 Planeado | alumno-team8 | consulta a `prometheus` como datasource |
| Falco | DaemonSet (nivel de nodo) | ❌ Descartado para este cluster | — | — (evidencia se mantiene en minikube local) |
| `inventory-config`, `inventory-secret` | ConfigMap / Secret | ⚠️ Preexistente, de otro proyecto propio (Inventario) | alumno-team8 | no se conecta a nada de Pet-Core |

Leyenda: ✅ desplegado y verificado · 🔜 planeado, todavía no aplicado · ❌ descartado deliberadamente · ⚠️ existe pero no es de Pet-Core.

## Acceso

- **URL pública del frontend**: `https://equipo2-proyecto4.reto-ucu.net/alumno-team8-petcore/` (vía `ApisixRoute` `petcore-route`, ver `k8s/apisix-route-ucu.yaml`). El Ingress nginx que crea la chart de Helm (`petcore.local`) no sirve para esto: resuelve a una IP interna del cluster, no alcanzable desde afuera.
  - La `ApisixRoute` tiene reglas adicionales para `/assets/*`, `/favicon.svg` y `/api/*`: el frontend (Vite build) pide esos recursos en rutas absolutas, sin el prefijo `/alumno-team8-petcore/`, así que se reenvían aparte — `/api/*` además le sacan el prefijo antes de llegar al backend (que no espera "/api" en sus rutas, igual que hace `nginx.conf` del frontend en local/minikube). Ocupan esas rutas para todo el dominio compartido, no solo bajo nuestro prefijo — riesgo aceptado porque hoy no hay otra ruta activa en ese dominio.
- Cluster: provisto por la UCU, compartido con otros equipos de la materia.
- Namespace asignado al equipo: `alumno-team8`.
- Kubeconfig: archivo propio del equipo (no se versiona en el repo), cargado en Jenkins como credencial `KUBECONFIG_UCU`.
- El usuario del equipo (`team8`) es un ServiceAccount **namespace-scoped**: no tiene permisos para crear Roles/RoleBindings (ni siquiera dentro de su propio namespace) ni ningún recurso cluster-scoped (ClusterRole, ClusterRoleBinding, CRD, Webhook, Namespace). Verificado con `kubectl auth can-i` el 2026-11-11.

## Qué está desplegado ahora mismo

### Aplicación (vía Helm)

Release de Helm `petcore`, instalado con `helm upgrade --install petcore ./helm-chart -n alumno-team8 -f helm-chart/values-dev.yaml`.

| Recurso | Nombre | Imagen / detalle |
|---|---|---|
| Deployment | `api` | `manuelney67/clinica-veterinaria:build-16` |
| Deployment | `frontend` | `manuelney67/clinica-frontend:build-16` |
| StatefulSet | `postgres` | `postgres-0`, 1 réplica |
| Service | `api` | ClusterIP, puerto 8000 |
| Service | `frontend` | ClusterIP, puerto 8080 |
| Service | `db` | ClusterIP (headless), puerto 5432 |
| ConfigMap | `api-config` | config no sensible de la API |
| ConfigMap | `postgres-init` | scripts de `db/init/` montados para el init de Postgres |
| Secret | `jwt-secret` | secreto de firma JWT |
| Secret | `postgres-secret` | credenciales de Postgres |

El tag de imagen (`build-16`) lo fija el Jenkinsfile en cada corrida (`IMAGE_TAG = "build-${BUILD_NUMBER}"`); el número va a ir subiendo con cada pipeline que se corra. **Nunca es `latest`** — la política Kyverno `disallow-latest-tag`, activa en este cluster, lo rechazaría.

Los Secrets/ConfigMaps de arriba no los crea la chart de Helm (es una decisión de diseño documentada en `helm-chart/values.yaml` y forzada por `helm-chart/templates/validaciones.yaml`): se crean una sola vez a mano siguiendo el mismo patrón que `scripts/4to_entregable/preparar-chart.sh` usa contra minikube, pero apuntando al namespace `alumno-team8`.

### Recursos que ya existían en el namespace — de un proyecto propio anterior, no de Pet-Core

- ConfigMap `inventory-config`, Secret `inventory-secret` (antigüedad: 21 días, de antes de empezar a trabajar en este cluster con Pet-Core). Son del proyecto anterior del equipo, **Inventario** (`C:\Repos\DevOps-InventoryProyect`), que ya usaba este mismo namespace `alumno-team8` con su propio Jenkins (ver ese repo, `docs/arquitectura.md`, para el detalle de esa implementación). No tocar ni borrar: siguen siendo del equipo, pero **no son parte del D4 de Pet-Core** — no mezclar esta evidencia con la de este entregable.

### Jenkins

**Desplegado dentro del cluster** (`k8s/jenkins-ucu.yaml`): Deployment + PVC de 2Gi + Service, sin sidecar de Docker-in-Docker ni socket montado. Acceso a la UI vía `kubectl port-forward svc/jenkins 8080:8080 -n alumno-team8` (no tiene Ingress, ver nota en el manifest). Como no tiene Docker disponible, las etapas del Jenkinsfile que antes hacían `docker run ...` (Semgrep, Snyk, tests, build/push de imagen) se están migrando a lanzar Jobs de Kubernetes en vez de contenedores Docker locales — en curso.

La instancia local (Docker, en la notebook, `scripts/4to_entregable/jenkins-up.sh`) sigue existiendo en paralelo mientras se termina de migrar todo; una vez que el pipeline corra entero desde la instancia del cluster, la local queda como respaldo/desarrollo.

### Prometheus / Grafana

**Todavía no desplegados en este cluster.** La evidencia de monitoreo del D4 hoy vive en minikube local (`k8s/prometheus-*.yaml`, `k8s/grafana-*.yaml`). Evaluando sumarlos acá también, sin necesidad de permisos adicionales (alcanza con lo que el namespace ya permite).

### Kyverno

**No administrado por el equipo, pero activo.** El cluster ya tiene Kyverno instalado y funcionando a nivel cluster (lo gestiona la UCU, no nosotros) — se confirmó que la política `disallow-latest-tag` rechaza un deploy con tag `:latest` contra este namespace. El equipo no tiene permiso para listar ni crear `ClusterPolicy` propias (confirmado: `kubectl auth can-i list clusterpolicies` → Forbidden). No hay nada que desplegar de nuestra parte; la evidencia es la prueba de que la política activa efectivamente bloquea.

### Falco

**No desplegado, decisión deliberada.** Requiere acceso a nivel de nodo (hostPID, hostNetwork, socket del runtime de contenedores) para tener visibilidad real de syscalls. El cluster técnicamente lo permitiría (se probó con `--dry-run=server` que no hay restricción de PodSecurity en este namespace para pods privilegiados/hostPath/hostPID), pero no se va a desplegar ahí: el nodo es compartido con otros equipos, y un agente con esos privilegios expone una superficie de ataque sobre infraestructura que no es nuestra. La evidencia de Falco para el D4 se mantiene en minikube local, documentando esta limitación de RBAC/multi-tenant como parte del análisis.

## Decisiones pendientes

- **Jenkins in-cluster**: se evalúa mover el controlador de Jenkins al cluster (Deployment + PVC + Service, sin sidecar privilegiado). El punto sin resolver es el build de imágenes Docker sin un daemon disponible — la opción en curso es Kaniko (build de imágenes sin privilegios, vía un Job de Kubernetes lanzado desde el propio pipeline).
