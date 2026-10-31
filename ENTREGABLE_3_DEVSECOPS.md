# Seguridad de las imágenes

## 1. Análisis con Trivy: antes y después

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

## 2. Cambios realizados en el backend

- **`Dockerfile`:** se fijó la base en `python:3.13.18-slim-trixie` y se agregó `apt-get update` seguido de `apt-get upgrade` para instalar las actualizaciones disponibles de Debian. Se actualizó uv de `0.12.5` a `0.13.6`, se actualizaron las herramientas de instalación y se eliminó pip después de instalar las dependencias. También se configuró el usuario sin privilegios `10001:10001` y el inicio directo de FastAPI desde `.venv`.
- **`pyproject.toml`:** se actualizaron los requisitos de PyJWT y se establecieron mínimos de seguridad para certifi, dnspython y urllib3.
- **`uv.lock`:** se regeneró con **uv** a partir del TOML para registrar las versiones resueltas: PyJWT `2.15.1`, certifi `2026.10.23`, dnspython `2.9.1` y urllib3 `2.8.0`.

Después de reconstruir y reescanear, desaparecieron los **17 hallazgos de Python: 14 HIGH y 3 CRITICAL**.

## 3. Cambios realizados en el frontend

Se modificó **`frontend/Dockerfile.k8s`**, utilizado para construir la imagen del frontend de monitoring. En la etapa final de Nginx sobre Alpine se agregó la actualización de paquetes mediante `apk update` y `apk upgrade --no-cache`, usando root durante esa operación y conservando **`USER nginx`** para ejecutar el servicio.

Se reconstruyó la imagen con `--pull --no-cache` y se verificaron estas actualizaciones:

| Paquete | Antes | Después |
|---|---|---|
| curl | 8.14.1-r2 | 8.14.1-r4 |
| libcrypto3 / libssl3 | 3.5.4-r0 | 3.5.9-r0 |

El nuevo análisis pasó de **52 HIGH y 2 CRITICAL a 0**. Este resultado corresponde a la imagen construida con `Dockerfile.k8s`; el Dockerfile de desarrollo con Vite requiere su propia comprobación si también se utiliza.

## 4. Por qué quedan 44 hallazgos de Debian

Los **44 HIGH restantes corresponden a 8 CVE distintos**, repetidos en paquetes como util-linux, ncurses, libacl, bibliotecas de systemd y perl-base. El reporte no indica una versión corregida en `Fixed Version`.

El archivo **`debian-versiones.txt`** compara `Installed` y `Candidate` de cinco paquetes representativos, tras actualizar los índices de los repositorios configurados, incluido `trixie-security`. Ambas versiones coinciden en esos cinco casos: al consultar, APT no ofrecía una versión más nueva para ellos.

Se mantienen **documentados como riesgo residual**. Esto no significa que sean seguros ni que no exista una corrección en otra distribución o versión: deberán reevaluarse cuando haya parches disponibles para la base utilizada. Ejecutar sin root reduce ciertos riesgos, pero no elimina estos CVE.

## 5. Comandos de construcción y escaneo

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