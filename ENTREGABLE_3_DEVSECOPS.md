# 2. Seguridad en el código

# 3. Seguridad de las imágenes

## 3.1. Análisis con Trivy: antes y después

Se utilizó **Trivy** para analizar los paquetes del sistema operativo y las dependencias incluidas en `clinica-veterinaria:test` y `clinica-frontend:test`, considerando las severidades **HIGH y CRITICAL**.

| Imagen | HIGH iniciales | CRITICAL iniciales | HIGH finales | CRITICAL finales |
|---|---:|---:|---:|---:|
| Backend | 58 | 3 | 44 | 0 |
| Frontend | 52 | 2 | 0 | 0 |
| **Total** | **110** | **5** | **44** | **0** |

Se pasó de **115 a 44 hallazgos**: se eliminaron 71, incluidas las 5 apariciones críticas. Son hallazgos por paquete; no representan necesariamente CVE distintos.

Los archivos permiten consultar el antes y el después:

| Evidencia | Antes | Después |
|---|---|---|
| Backend | `reports/trivy-backend-inicial.txt` | `reports/trivy-backend.txt` |
| Frontend | `reports/trivy-frontend-inicial.txt` | `reports/trivy-frontend.txt` |

## 3.2. Cambios realizados en el backend

- **`Dockerfile`:** se fijó la base en `python:3.13.18-slim-trixie` y se agregó `apt-get update` seguido de `apt-get upgrade` para instalar las actualizaciones disponibles de Debian. Se actualizó uv de `0.12.5` a `0.13.6`, se actualizaron las herramientas de instalación y se eliminó pip después de instalar las dependencias. También se configuró el usuario sin privilegios `10001:10001` y el inicio directo de FastAPI desde `.venv`.
- **`pyproject.toml`:** se actualizaron los requisitos de PyJWT y se establecieron mínimos de seguridad para certifi, dnspython y urllib3.
- **`uv.lock`:** se regeneró con **uv** a partir del TOML para registrar las versiones resueltas: PyJWT `2.15.1`, certifi `2026.10.23`, dnspython `2.9.1` y urllib3 `2.8.0`.

Después de reconstruir y reescanear, desaparecieron los **17 hallazgos de Python: 14 HIGH y 3 CRITICAL**.

## 3.3. Cambios realizados en el frontend

Se modificó **`frontend/Dockerfile.k8s`**, utilizado para construir la imagen del frontend de monitoring. En la etapa final de Nginx sobre Alpine se agregó la actualización de paquetes mediante `apk update` y `apk upgrade --no-cache`, usando root durante esa operación y conservando **`USER nginx`** para ejecutar el servicio.

Se reconstruyó la imagen con `--pull --no-cache` y se verificaron estas actualizaciones:

| Paquete | Antes | Después |
|---|---|---|
| curl | 8.14.1-r2 | 8.14.1-r4 |
| libcrypto3 / libssl3 | 3.5.4-r0 | 3.5.9-r0 |

El nuevo análisis pasó de **52 HIGH y 2 CRITICAL a 0**. Este resultado corresponde a la imagen construida con `Dockerfile.k8s`; el Dockerfile de desarrollo con Vite requiere su propia comprobación si también se utiliza.

## 3.4. Por qué quedan 44 hallazgos de Debian

Los **44 HIGH restantes corresponden a 8 CVE distintos**, repetidos en paquetes como util-linux, ncurses, libacl, bibliotecas de systemd y perl-base. El reporte no indica una versión corregida en `Fixed Version`.

El archivo **`debian-versiones.txt`** compara `Installed` y `Candidate` de cinco paquetes representativos, tras actualizar los índices de los repositorios configurados, incluido `trixie-security`. Ambas versiones coinciden en esos cinco casos: al consultar, APT no ofrecía una versión más nueva para ellos.

Se mantienen **documentados como riesgo residual**. Esto no significa que sean seguros ni que no exista una corrección en otra distribución o versión: deberán reevaluarse cuando haya parches disponibles para la base utilizada. Ejecutar sin root reduce ciertos riesgos, pero no elimina estos CVE.

## 3.5. Comandos de construcción y escaneo

Ejecutar en **PowerShell, desde la raíz del repositorio**, con Docker Desktop iniciado y configurado para contenedores Linux.

### Preparar la carpeta de reportes

~~~powershell
New-Item -ItemType Directory -Force -Path .\reports | Out-Null
$reportsPath = (Resolve-Path .\reports).Path
~~~

### Construir las imágenes

**Backend**, usando el `Dockerfile` de la raíz:

~~~powershell
docker build --pull --no-cache -t clinica-veterinaria:test .
~~~

**Frontend de monitoring**, usando `frontend/Dockerfile.k8s` y su configuración de Nginx:

~~~powershell
docker build --pull --no-cache -f .\frontend\Dockerfile.k8s --build-arg NGINX_CONF=nginx-monitoring.conf -t clinica-frontend:test .\frontend
~~~

`--pull` consulta las imágenes base y `--no-cache` reconstruye las capas sin reutilizar la caché de construcción.

### Escanear y guardar los reportes

**Backend:**

~~~powershell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$($reportsPath):/reports" -v petcore-trivy-cache:/root/.cache/ aquasec/trivy:0.76.1 image --image-src docker --scanners vuln --severity HIGH,CRITICAL --format table --output /reports/trivy-backend.txt clinica-veterinaria:test
~~~

**Frontend:**

~~~powershell
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$($reportsPath):/reports" -v petcore-trivy-cache:/root/.cache/ aquasec/trivy:0.76.1 image --image-src docker --scanners vuln --severity HIGH,CRITICAL --format table --output /reports/trivy-frontend.txt clinica-frontend:test
~~~

Trivy analiza las imágenes locales de Docker. `--output` guarda el reporte de vulnerabilidades en la carpeta `reports` del proyecto. El volumen `petcore-trivy-cache` conserva la caché de Trivy; es independiente de la caché utilizada al construir las imágenes.

Estos comandos generan los **reportes finales**. Conservar los archivos iniciales con nombres distintos para mantener la comparación.

# 4. Seguridad en Kubernetes

Esta sección cubre la seguridad de los manifiestos y del clúster. Primero se endurecieron los manifiestos de los despliegues (4.1) y luego se definieron políticas que impiden desplegar recursos que no cumplan esas reglas (4.2). El análisis con KubeLinter se documenta en la sección 4.3.

## 4.1 Hardening de manifiestos

### Objetivo, herramientas y alcance

Un manifiesto de Kubernetes sin ajustes explícitos ejecuta los contenedores con el usuario que defina la imagen (con frecuencia root), sin límites de CPU ni de memoria y con privilegios que casi ninguna aplicación necesita. El hardening consiste en declarar esas restricciones de forma explícita en cada manifiesto, para reducir el daño posible si un contenedor falla o es comprometido.

Herramientas utilizadas:

- **Minikube:** clúster de Kubernetes local donde se despliega y se prueba el proyecto, dentro del namespace `clinica-veterinaria`.
- **kubectl**, ejecutado como `minikube kubectl --`: aplica los manifiestos (`apply`), espera a que terminen los despliegues (`rollout status`), lista los pods (`get pods`) y ejecuta comandos dentro de ellos (`exec`), por ejemplo `id` para comprobar con qué usuario corre realmente el proceso.
- **Git:** cada manifiesto endurecido se guardó en un commit propio.
- **`scripts/k8s-up-monitoring.ps1`:** levanta el entorno completo, y se usó para comprobar que todo arranca con los manifiestos nuevos.

Estas herramientas ya formaban parte del entorno del proyecto, por lo que no requirieron instalación adicional.

**Alcance.** Se endurecieron los nueve manifiestos que crean pods: ocho `Deployment` (`prometheus`, `grafana`, `frontend-monitoring`, `api-monitoring`, `api-blue`, `api-green`, `frontend-blue` y `frontend-green`) y el `StatefulSet` de PostgreSQL. No se modificaron los Services, los ConfigMaps, el namespace, los permisos de Prometheus (`prometheus-rbac.yaml`) ni `falco-values.yaml`, porque ninguno define pods.

**Método.** Para cada manifiesto se repitió el mismo ciclo: agregar `resources` y `securityContext`, aplicar el cambio con `kubectl apply`, esperar el despliegue con `rollout status`, comprobar que el pod quedara en `Running` y con el usuario esperado, y guardar el cambio en un commit. Se avanzó de menor a mayor riesgo: Prometheus, Grafana, PostgreSQL, frontend y API.

### Tags de imagen fijos

Los manifiestos de Grafana y Prometheus usaban la etiqueta `latest`, que no identifica una versión concreta: el contenido de la imagen puede cambiar entre despliegues y el resultado no es reproducible. Se reemplazó por la versión exacta que ya estaba corriendo en el clúster, de modo que el comportamiento no cambia.

Para no adivinar la versión, se consultó directamente a los pods en ejecución:

```powershell
minikube kubectl -- exec deploy/grafana -n clinica-veterinaria -- wget -qO- http://localhost:3000/api/health
minikube kubectl -- exec deploy/prometheus -n clinica-veterinaria -- prometheus --version
```

| Manifiesto | Antes | Después |
|---|---|---|
| `k8s/grafana-deployment.yaml` | `grafana/grafana:latest` | `grafana/grafana:13.2.4` |
| `k8s/prometheus-deployment.yaml` | `prom/prometheus:latest` | `prom/prometheus:v3.15.0` |

Se fijó el número de versión de la imagen oficial, y no un tag propio con la fecha, porque esos registries no publican tags por fecha y un tag propio sobre una imagen de terceros no garantiza qué contenido tiene.

Tras aplicar los cambios con `kubectl apply`, se comprobó con `rollout status` que ambos Deployments se actualizaron y que los pods quedaron en estado `Running`.

### Límites de recursos y contexto de seguridad

A cada contenedor se le agregaron límites de recursos y un `securityContext`. Estos son los conceptos aplicados:

- **`resources.requests` y `resources.limits`:** los *requests* son la CPU y la memoria que el planificador reserva para el pod; los *limits* son el máximo que puede consumir. Sin ellos, un pod con un error puede agotar los recursos del nodo y afectar a los demás.
- **`runAsNonRoot`, `runAsUser` y `runAsGroup`:** obligan a que el proceso corra con un usuario sin privilegios, con un UID explícito que Kubernetes puede verificar.
- **`fsGroup`:** asigna un grupo propietario a los volúmenes montados, para que un proceso sin root pueda leerlos y escribirlos.
- **`seccompProfile: RuntimeDefault`:** restringe las llamadas al sistema que el contenedor puede hacer al conjunto estándar del runtime.
- **`allowPrivilegeEscalation: false`:** impide que un proceso obtenga más privilegios que los de su proceso padre.
- **`capabilities.drop: ALL`:** quita al contenedor todas las capacidades especiales de Linux, que ninguno de estos servicios necesita.
- **`readOnlyRootFilesystem`:** hace de solo lectura el sistema de archivos del contenedor. Solo se aplica donde la aplicación no necesita escribir en él.

#### Prometheus

Se definió `requests` de 100m de CPU y 256Mi de memoria, y `limits` de 500m y 512Mi. El proceso corre con el usuario `nobody` (UID y GID 65534), que es el predeterminado de la imagen, con `fsGroup` igual para que pueda leer el token del ServiceAccount y el ConfigMap montados.

No se activó `readOnlyRootFilesystem`: Prometheus escribe su base de datos de series temporales en `/prometheus`, dentro del sistema de archivos del contenedor, y hacerlo de solo lectura impediría que funcione.

Tras aplicar el cambio, el pod quedó en `Running` sin reinicios, el proceso se ejecuta con UID 65534 y Prometheus siguió recolectando métricas de todos sus targets, incluido cAdvisor, que depende del token del ServiceAccount.

#### Grafana

Se definió `requests` de 100m de CPU y 128Mi de memoria, y `limits` de 500m y 512Mi. El límite de memoria es más holgado que en los demás servicios porque Grafana tiene un consumo mayor durante el arranque, cuando migra su base interna y carga plugins y el contenido provisionado.

El proceso corre con el usuario `grafana` (UID 472), el predeterminado de la imagen oficial, con `fsGroup` igual para que pueda leer los ConfigMaps montados con el datasource, el dashboard y las reglas de alerta. Ya tenía deshabilitado el montaje automático del token del ServiceAccount, porque Grafana no necesita acceder a la API de Kubernetes.

No se activó `readOnlyRootFilesystem`: Grafana guarda su base de datos SQLite y sus plugins en `/var/lib/grafana`, dentro del sistema de archivos del contenedor.

Luego de aplicado el cambio, el pod quedó en `Running`, corre con UID 472 y siguen cargando el dashboard y las dos reglas de alerta.

#### PostgreSQL

Se definió `requests` de 100m de CPU y 256Mi de memoria, y `limits` de 500m y 512Mi. El servidor corre con el usuario `postgres` (UID y GID 999) de la imagen oficial, con `fsGroup` igual para acceder al volumen de datos. Al iniciar ya con ese usuario, el script de arranque de la imagen omite el paso que requiere root (cambiar el dueño de los archivos y bajar privilegios con `gosu`), por lo que el contenedor nunca se ejecuta como root.

Como el cambio recrea el pod, se verificó que los datos persistentes se conservaran: la cantidad de filas de la tabla `usuario` fue la misma antes y después de aplicar el manifiesto, y el volumen persistente no se modificó.

No se activó `readOnlyRootFilesystem`: además del directorio de datos, PostgreSQL escribe el socket y los archivos de bloqueo en `/var/run/postgresql`, dentro del sistema de archivos del contenedor.

#### Frontend (monitoring)

Se definió `requests` de 50m de CPU y 64Mi de memoria, y `limits` de 250m y 128Mi, suficientes para un servidor Nginx que solo entrega archivos estáticos.

La imagen se construye sobre `nginx-unprivileged`, que ya ejecuta el servicio con el usuario `nginx` y escucha en el puerto 8080, por lo que no necesita privilegios para abrir puertos. Como el `Dockerfile` declara el usuario por nombre y no por número, Kubernetes no puede comprobar que no sea root; por eso se fijó explícitamente `runAsUser: 101`, con lo que `runAsNonRoot` queda verificable. No se definió `fsGroup` porque el pod no monta volúmenes de datos.

No se activó `readOnlyRootFilesystem`: Nginx escribe archivos temporales y su PID en `/tmp`, por lo que requeriría montar un volumen `emptyDir` en esa ruta y repetir las pruebas. Queda como mejora futura.

Tras aplicar el cambio, el pod quedó en `Running`, el proceso corre con UID 101 y la aplicación siguió funcionando de punta a punta (inicio de sesión y listado de turnos a través de la API de monitoreo).

#### API de monitoreo

El manifiesto ya definía `requests` de 100m de CPU y 128Mi de memoria, y `limits` de 1 CPU y 512Mi. Se mantuvieron sin cambios porque los indicadores de CPU y RAM del dashboard calculan el porcentaje de uso respecto de esos límites.

La imagen se construye con un usuario sin privilegios (`10001:10001`) y arranca directamente con él. Se fijó el mismo UID de forma explícita en el pod con `runAsUser: 10001` y `runAsNonRoot: true`, de modo que Kubernetes lo exija y lo verifique. Además se agregaron `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false` y la eliminación de todas las capacidades de Linux. No se definió `fsGroup` porque los únicos volúmenes son Secrets montados en solo lectura.

No se activó `readOnlyRootFilesystem`: no se probó la aplicación con el sistema de archivos en solo lectura, y requeriría al menos un volumen `emptyDir` en `/tmp`. Queda como mejora futura.

Tras aplicar el cambio, el pod quedó en `Running` sin reinicios, Prometheus siguió recolectando sus métricas y la aplicación funcionó de punta a punta (inicio de sesión y listado de turnos).

#### Despliegues Blue/Green

Los cuatro Deployments de las versiones Blue y Green (`api-blue`, `api-green`, `frontend-blue` y `frontend-green`) pertenecen al Entregable 1 y el script de monitoreo no los despliega, pero se endurecieron con los mismos criterios que los demás para que cualquier despliegue posterior cumpla las políticas de la sección 4.2.

Las APIs usan los mismos recursos que la API de monitoreo (requests de 100m y 128Mi, limits de 1 CPU y 512Mi) y el UID 10001; los frontends usan los mismos valores que el frontend de monitoring (requests de 50m y 64Mi, limits de 250m y 128Mi) y el UID 101. Todos agregan `runAsNonRoot`, `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false` y `drop: ALL`. Las etiquetas `v1` y `v2` de las imágenes ya eran explícitas.

**Estado de cada uno.** `frontend-blue` se aplicó en el clúster y quedó en `Running`. `api-blue`, `api-green` y `frontend-green` se validaron con `kubectl apply --dry-run=server` y Kyverno los aceptó (sección 4.2), pero no se aplicaron: siguen corriendo con los manifiestos anteriores. Tampoco se comprobó que las imágenes `clinica-veterinaria:v1` y `v2` arranquen con el UID 10001, porque se construyeron antes de que el `Dockerfile` creara ese usuario sin privilegios (sección 3). Antes de aplicar esos manifiestos conviene verificarlo con `kubectl exec ... -- id`. Esto queda registrado como limitación.

### Resumen por manifiesto

| Manifiesto | Tag | Resources | securityContext | Notas |
|---|---|---|---|---|
| `prometheus-deployment.yaml` | `latest` → `v3.15.0` | requests 100m/256Mi, limits 500m/512Mi | UID/GID 65534, `runAsNonRoot`, `fsGroup`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | `readOnlyRootFilesystem` no aplicado: escribe la base TSDB en `/prometheus` |
| `grafana-deployment.yaml` | `latest` → `13.2.4` | requests 100m/128Mi, limits 500m/512Mi | UID/GID 472, `runAsNonRoot`, `fsGroup`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | `readOnlyRootFilesystem` no aplicado: escribe SQLite y plugins en `/var/lib/grafana`. Ya tenía el token del ServiceAccount deshabilitado |
| `postgres-statefulset.yaml` | `postgres:18` (ya tenía tag fijo) | requests 100m/256Mi, limits 500m/512Mi | UID/GID 999, `runAsNonRoot`, `fsGroup`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | `readOnlyRootFilesystem` no aplicado: escribe en `/var/run/postgresql`. Verificada la persistencia de datos tras el cambio |
| `frontend-monitoring-deployment.yaml` | `clinica-frontend:monitoring` (ya tenía tag explícito) | requests 50m/64Mi, limits 250m/128Mi | UID/GID 101, `runAsNonRoot`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | Sin `fsGroup`: no monta volúmenes. `readOnlyRootFilesystem` no aplicado: Nginx necesitaría un `emptyDir` en `/tmp`; mejora futura |
| `api-monitoring-deployment.yaml` | `clinica-veterinaria:monitoring` (ya tenía tag explícito) | requests 100m/128Mi, limits 1/512Mi (ya definidos, sin cambios) | UID/GID 10001, `runAsNonRoot`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | Sin `fsGroup`: solo monta Secrets de solo lectura. `readOnlyRootFilesystem` no aplicado: no se probó la aplicación en solo lectura; mejora futura |
| `api-blue-deployment.yaml` / `api-green-deployment.yaml` | `clinica-veterinaria:v1` / `v2` (ya eran explícitos) | requests 100m/128Mi, limits 1/512Mi | UID/GID 10001, `runAsNonRoot`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | Sin `fsGroup`: solo Secrets de solo lectura. Validados con dry-run del servidor, no aplicados en el clúster. Falta comprobar que las imágenes `v1`/`v2` arranquen con UID 10001. `readOnlyRootFilesystem` no aplicado |
| `frontend-blue-deployment.yaml` / `frontend-green-deployment.yaml` | `clinica-frontend:v1` / `v2` (ya eran explícitos) | requests 50m/64Mi, limits 250m/128Mi | UID/GID 101, `runAsNonRoot`, seccomp `RuntimeDefault`, sin escalada, `drop: ALL` | Sin `fsGroup`: no monta volúmenes. `frontend-blue` aplicado y en `Running`; `frontend-green` solo validado con dry-run. `readOnlyRootFilesystem` no aplicado |

### Verificación final

Tras aplicar el hardening, los pods de monitoreo (`api-monitoring`, `frontend-monitoring`, `grafana`, `prometheus` y `postgres-0`) quedaron en `Running` con `READY 1/1`; `api-monitoring`, `frontend-monitoring`, `grafana` y `prometheus` con 0 reinicios. Los manifiestos también fueron aceptados por las políticas de Kyverno de la sección 4.2.

### Limitaciones del hardening

- **`readOnlyRootFilesystem` no se aplicó en ningún manifiesto.** Cada aplicación escribe en alguna ruta de su sistema de archivos; habilitarlo requiere montar volúmenes `emptyDir` en esas rutas y repetir las pruebas. Queda como mejora futura.
- **Los valores de CPU y memoria son valores de partida** para un entorno de pruebas y no se calibraron con pruebas de carga.
- **Blue/Green:** tres de los cuatro manifiestos endurecidos no se aplicaron en el clúster, y falta comprobar que las imágenes `v1` y `v2` arranquen con un usuario sin privilegios.

## 4.2 Políticas con Kyverno

### Herramientas

**Kyverno** es un motor de políticas para Kubernetes. Las políticas se escriben como recursos de Kubernetes en YAML, sin aprender un lenguaje adicional, y Kyverno las aplica como controlador de admisión: intercepta cada solicitud que llega a la API antes de que el objeto se guarde y la valida contra las políticas definidas. Con la acción `Enforce`, una solicitud que incumple una política se rechaza y el recurso no se crea. Kyverno se compone de varios controladores (admisión, segundo plano, informes y limpieza) que se despliegan en su propio namespace.

**Helm** es el gestor de paquetes de Kubernetes. Instala aplicaciones completas a partir de *charts* (conjuntos de manifiestos parametrizables) con un solo comando y permite fijar la versión instalada. Se usó para instalar Kyverno y también se usa para Falco (sección 5).

### Instalación

**Helm.** En Windows, sin `winget` ni `scoop` disponibles, se instaló descargando el binario oficial de Helm 3 (`helm.exe`) en una carpeta del usuario y agregándola al `PATH`:

```powershell
$v = "v3.21.0"
$dest = "$env:USERPROFILE\tools\helm"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Invoke-WebRequest -Uri "https://get.helm.sh/helm-$v-windows-amd64.zip" -OutFile "$env:TEMP\helm.zip"
Expand-Archive -Path "$env:TEMP\helm.zip" -DestinationPath "$env:TEMP\helm-extract" -Force
Copy-Item "$env:TEMP\helm-extract\windows-amd64\helm.exe" -Destination $dest -Force
[Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path","User") + ";$dest", "User")
$env:Path += ";$dest"
helm version
```

**Kyverno.** Se instaló con Helm en el namespace `kyverno`, fijando la versión del chart:

```powershell
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm search repo kyverno/kyverno --versions | Select-Object -First 12
helm install kyverno kyverno/kyverno -n kyverno --create-namespace --version 3.9.2
```

`helm search` lista los charts disponibles junto con la versión de Kyverno que trae cada uno. Se eligió el chart `3.9.2`, que corresponde a Kyverno `v1.19.2`, el último parche de la serie 1.19 al momento de la instalación. La versión se fijó porque `ClusterPolicy`, el tipo de recurso usado en las políticas, está marcado como deprecado desde Kyverno 1.17; la 1.19 es la última versión con soporte completo y su eliminación está prevista para la 1.20. Sin fijar la versión, una instalación futura podría no aceptar las políticas.

Para comprobar la instalación:

```powershell
helm list -n kyverno
minikube kubectl -- get pods -n kyverno
minikube kubectl -- get crd | Select-String "clusterpolicies"
```

`helm list` muestra el chart `kyverno-3.9.2` con versión de aplicación `v1.19.2`, los pods del namespace `kyverno` quedaron en `Running` y existe la definición de recurso `clusterpolicies.kyverno.io`.

### Políticas definidas

Las tres políticas están en `k8s/policies/` como `ClusterPolicy`:

| Política | Archivo | Qué exige |
|---|---|---|
| `disallow-latest-tag` | `disallow-latest-tag.yaml` | Dos reglas: la imagen debe declarar un tag (patrón `*:*`) y ese tag no puede ser `latest` (patrón `!*:latest`). |
| `require-resources` | `require-resources.yaml` | Cada contenedor debe definir `requests` y `limits` de CPU y de memoria. |
| `disallow-root` | `disallow-root.yaml` | `runAsNonRoot` debe ser `true` a nivel de Pod o en todos los contenedores (`anyPattern` con las dos opciones). |

Configuración común a las tres:

- **`validationFailureAction: Enforce`:** el recurso incumplidor se rechaza, no solo se registra.
- **`match` sobre `Pod`:** Kyverno genera automáticamente las reglas equivalentes para Deployments y StatefulSets, que crean los Pods.
- **`exclude` de los namespaces `kube-system`, `kyverno` y `falco`:** son los pods del sistema, el propio Kyverno y Falco, que necesita privilegios para su driver y no cumpliría la política de root.
- **`background: true`:** además de validar las solicitudes nuevas, evalúa los recursos ya existentes y lo informa.

Tras aplicarlas con `kubectl apply`, las tres quedaron en estado `Ready`:

```text
NAME                  ADMISSION   BACKGROUND   READY   AGE   MESSAGE
disallow-latest-tag   true        true         True    8s    Ready
disallow-root         true        true         True    7s    Ready
require-resources     true        true         True    8s    Ready
```

Cada comando que usa `ClusterPolicy` muestra además el aviso `kyverno.io/v1 ClusterPolicy is deprecated and will be removed in a future release`. No es un error: las políticas se crean y funcionan con la versión fijada.

### Validación con manifiestos no conformes

Se probaron cinco manifiestos de Pod en `k8s/policies/test/`. El de referencia (`pod-conforme.yaml`) cumple las tres políticas; los demás se obtuvieron quitándole una cosa a la vez, excepto `pod-no-conforme.yaml`, que incumple las tres juntas.

| # | Manifiesto | Qué incumple | Resultado |
|---|---|---|---|
| 1 | `pod-no-conforme.yaml` | Las tres políticas (`nginx:latest`, sin recursos, sin `securityContext`) | Rechazado por las tres políticas |
| 2 | `pod-solo-latest.yaml` | Solo el tag `latest` | Rechazado únicamente por `disallow-latest-tag` |
| 3 | `pod-solo-sin-resources.yaml` | Solo la falta de `requests` y `limits` | Rechazado únicamente por `require-resources` |
| 4 | `pod-solo-root.yaml` | Solo la falta de `runAsNonRoot` | Rechazado únicamente por `disallow-root` |
| 5 | `pod-conforme.yaml` | Nada | Creado y en `Running`; luego eliminado |

Mensaje real del rechazo del manifiesto no conforme:

```text
Error from server: error when creating "k8s\\policies\\test\\pod-no-conforme.yaml": admission webhook "validate.kyverno.svc-fail" denied the request:

resource Pod/clinica-veterinaria/pod-no-conforme was blocked due to the following policies

disallow-latest-tag:
  validate-image-tag: 'validation error: No se permite el tag ''latest''. rule validate-image-tag failed at path /spec/containers/0/image/'
disallow-root:
  require-run-as-non-root: 'validation error: No se permite ejecutar como root: runAsNonRoot debe ser true a nivel de Pod o en todos los contenedores. rule require-run-as-non-root[0] failed at path /spec/securityContext/runAsNonRoot/ rule require-run-as-non-root[1] failed at path /spec/containers/0/securityContext/'
require-resources:
  validate-resources: 'validation error: Todos los contenedores deben definir requests y limits de cpu y memoria. rule validate-resources failed at path /spec/containers/0/resources/limits/'
```

Kyverno enumera cada política violada con el mensaje definido y la ruta del campo que falló. En `disallow-root` fallan las dos opciones del `anyPattern` (la del Pod y la de los contenedores), y en `require-resources` la ruta indica el primer campo faltante.

Para mostrar que las políticas actúan de forma independiente, este es el rechazo del manifiesto que solo usa el tag `latest` (prueba 2), donde aparece únicamente `disallow-latest-tag`:

```text
Error from server: error when creating "k8s\\policies\\test\\pod-solo-latest.yaml": admission webhook "validate.kyverno.svc-fail" denied the request:

resource Pod/clinica-veterinaria/pod-solo-latest was blocked due to the following policies

disallow-latest-tag:
  validate-image-tag: 'validation error: No se permite el tag ''latest''. rule validate-image-tag failed at path /spec/containers/0/image/'
```

### Manifiestos del proyecto

Se verificó que los manifiestos reales del proyecto cumplen las políticas, enviándolos a la validación de Kyverno sin crear nada:

```powershell
minikube kubectl -- apply --dry-run=server -f k8s/<manifiesto>.yaml
```

Los nueve (`api-blue`, `api-green`, `api-monitoring`, `frontend-blue`, `frontend-green`, `frontend-monitoring`, `grafana`, `prometheus` y `postgres`) fueron aceptados; ninguno fue rechazado. El resultado de cada comando fue `configured` o `unchanged` (server dry run), según si el manifiesto difiere o no del recurso desplegado. Esto confirma que el hardening de la sección 4.1 alcanza para cumplir las tres políticas. Los pods ya en ejecución no fueron afectados por la instalación de las políticas.

### Cómo reproducir las pruebas

Con Kyverno instalado y desde la raíz del repositorio:

```powershell
minikube kubectl -- apply -f k8s/policies/disallow-latest-tag.yaml
minikube kubectl -- apply -f k8s/policies/require-resources.yaml
minikube kubectl -- apply -f k8s/policies/disallow-root.yaml
minikube kubectl -- get clusterpolicy

minikube kubectl -- apply -f k8s/policies/test/pod-no-conforme.yaml        # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-latest.yaml        # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-sin-resources.yaml # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-root.yaml          # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-conforme.yaml           # debe crearse
minikube kubectl -- delete pod pod-conforme -n clinica-veterinaria
```

Para guardar cada salida en `reports/kyverno-validacion.txt` con texto limpio, se usó esta función de PowerShell, que ejecuta el comando, muestra el resultado y lo agrega al archivo en UTF-8:

```powershell
function Probar($titulo, $cmd) {
  $log = "reports\kyverno-validacion.txt"
  "`n=== $titulo ===" | Out-File $log -Append -Encoding utf8
  "> $cmd" | Out-File $log -Append -Encoding utf8
  $salida = cmd /c "$cmd 2>&1"
  $salida | Out-File $log -Append -Encoding utf8
  $salida
}
```

Por ejemplo: `Probar "1. Pod no conforme" "minikube kubectl -- apply -f k8s\policies\test\pod-no-conforme.yaml"`.

Para quitar las políticas y Kyverno: `minikube kubectl -- delete clusterpolicy --all` y `helm uninstall kyverno -n kyverno`.

### Limitaciones

- **`ClusterPolicy` está deprecado** desde Kyverno 1.17, y su eliminación está prevista para la 1.20. Las políticas funcionan con la versión fijada (1.19.2); la migración a `ValidatingPolicy` (`policies.kyverno.io`, basada en CEL) queda como trabajo futuro.
- **Las políticas validan que los campos estén declarados, no su valor.** No evalúan, por ejemplo, si los límites de memoria son razonables.
- **Las reglas de tag y de recursos revisan solo `containers`,** no `initContainers`, que este proyecto no utiliza.
- **Las políticas actúan al crear o actualizar un recurso:** no eliminan los pods que ya estaban corriendo cuando se instalaron.

## 4.3. KubeLinter

# 5. Seguridad en tiempo de ejecución: Falco

## Herramienta e instalación

Falco detecta actividades sospechosas mientras los contenedores funcionan. A diferencia de Semgrep, npm audit y Trivy, que analizan código, dependencias o imágenes, observa eventos durante la ejecución. Genera alertas; por sí solo no bloquea acciones.

La instalación se automatizó en `scripts/k8s-up-falco.ps1`, usando el driver `modern_ebpf` para observar eventos del kernel Linux de Minikube.

Con Minikube iniciado, desde la raíz del proyecto se ejecuta:

```powershell
.\scripts\k8s-up-falco.ps1
```

También se puede iniciar todo mediante monitoring, que llama al script de Falco:

```powershell
.\scripts\k8s-up-monitoring.ps1
```

Internamente, el script comprueba que Helm esté instalado y ejecuta `helm repo add`, `helm repo update` y `helm upgrade --install`. Instala o actualiza Falco, aplica `k8s/falco-values.yaml`, habilita alertas JSON de prioridad Notice o superior y verifica los pods.

**Para guardar las alertas en `reports/falco-event.log`, el script debe permanecer ejecutándose.** Guarda las alertas JSON sin duplicar líneas idénticas y muestra en pantalla las shells del backend. Si se cierra o se interrumpe, se detiene la copia al archivo del proyecto. Falco continúa detectando y sus logs quedan en el nodo de Minikube, como logs del contenedor consultables con `kubectl logs`, sujetos a rotación.


## Verificación y prueba

Para comprobar pods en `Running` y logs sin errores del driver:

```powershell
minikube kubectl -- get pods -n falco
minikube kubectl -- logs -n falco -l app.kubernetes.io/name=falco -c falco --tail=50
```

Se abrió una shell interactiva en el backend:

```powershell
minikube kubectl -- exec -it -n clinica-veterinaria deployment/api-monitoring -- /bin/sh
```

Dentro se ejecutaron `id`, `pwd` y `exit`.

## Alerta e interpretación

Extracto del mensaje real:

```text
20:11:45.433541418: Notice A shell was spawned in a container with an attached terminal
```

| Campo | Valor |
| --- | --- |
| Fecha UTC | 2026-10-31T20:11:45.433541418Z |
| Regla / prioridad | Terminal shell in container / Notice |
| Pod | api-monitoring-8f7c8d45d-26vtp |
| Namespace | clinica-veterinaria |
| Proceso / UID | sh / 10001 |

Falco detectó la apertura de una shell con terminal dentro del contenedor. Fue una prueba intencional; en otro contexto puede requerir investigación.

## Problemas y personalización

Se corrigió la continuación de líneas de PowerShell para incluir `--values` dentro del comando Helm.
PostgreSQL generaba alertas `Read sensitive file untrusted` cada diez segundos. El comando y la frecuencia coinciden con su chequeo de disponibilidad.
Se definió en `k8s/falco-values.yaml` una excepción limitada al pod, namespace, imagen, comando, archivo, UID y ejecución sin terminal observados. 

