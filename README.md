# Pet-Core

Sistema de gestión para una clínica veterinaria: backend en FastAPI con PostgreSQL y frontend en React (servido con Nginx), con tres roles (cliente, veterinario y administrador). Se despliega en Kubernetes (Minikube) con una Helm chart, y se automatiza y asegura con Jenkins, Semgrep, Snyk, Kyverno y Falco.

**Para levantar el proyecto, seguir en orden [Levantar el proyecto](#levantar-el-proyecto-entrega-final).** El resto del documento es de consulta.

## Índice

- [Levantar el proyecto (entrega final)](#levantar-el-proyecto-entrega-final)
  - [1. Requisitos](#1-requisitos)
  - [2. Clonar y levantar todo](#2-clonar-y-levantar-todo)
  - [3. Entrar a la aplicación](#3-entrar-a-la-aplicación)
  - [4. Comprobar que cada pieza funciona](#4-comprobar-que-cada-pieza-funciona)
  - [5. Generar datos para Grafana](#5-generar-datos-para-grafana)
  - [6. Borrar todo](#6-borrar-todo)
- [Demo (entorno local)](#demo-entorno-local)
- [Jenkins (pipeline de CI/CD local)](#jenkins-pipeline-de-cicd-local)
- [Falco](#falco)
- [Operar la aplicación con Helm](#operar-la-aplicación-con-helm)
  - [Instalar solo la aplicación](#instalar-solo-la-aplicación)
  - [Actualizar, volver atrás y borrar](#actualizar-volver-atrás-y-borrar)
- [Datos de prueba](#datos-de-prueba)
- [Entregables anteriores (referencia)](#entregables-anteriores-referencia)
  - [Ejecutar con Kubernetes y Minikube (Blue/Green)](#ejecutar-con-kubernetes-y-minikube)
  - [Monitoreo con Prometheus y Grafana](#monitoreo-con-prometheus-y-grafana)
  - [DevSecOps y reproducción de pruebas](#devsecops-y-reproducción-de-pruebas)

## Levantar el proyecto (entrega final)

Todo el entorno local (la aplicación, Kyverno con sus 4 políticas, Falco, Prometheus y Grafana, y opcionalmente Jenkins) se levanta con scripts de bash sobre Minikube.

**Los scripts se ejecutan en Git Bash, no en PowerShell.** En PowerShell, `bash` abre WSL y los scripts fallan.

### 1. Requisitos

| Programa | Para qué | Cómo instalarlo |
| --- | --- | --- |
| Git (incluye Git Bash) | Clonar el repositorio y ejecutar los scripts | `winget install --id Git.Git -e` |
| Docker Desktop | Motor donde corre Minikube | Descargarlo de docker.com e iniciarlo |
| minikube | Cluster de Kubernetes local | `winget install --id Kubernetes.minikube -e` |
| kubectl | Consultar el cluster | Viene con Docker Desktop |
| Helm | Instalar la chart | `winget install --id Helm.Helm -e` |

Después de instalar, cerrar y abrir Git Bash para que reconozca los programas nuevos. Comprobar con:

```bash
git --version
docker info --format '{{.ServerVersion}}'
minikube version
helm version
```

Docker Desktop tiene que estar abierto antes de seguir.

### 2. Clonar y levantar todo

**Clonar el repositorio** (se puede hacer en PowerShell o en Git Bash):

```bash
git clone https://github.com/ConstanzaBlanco/Clinica_Veterinaria_DevOps.git
cd Clinica_Veterinaria_DevOps
```

**Levantar todo.** El script es de bash y **debe ejecutarse en Git Bash** (menú Inicio), dentro de la carpeta del proyecto:

```bash
bash scripts/4to_entregable/inicializar-todo.sh
```

En PowerShell ese `bash` abre WSL y falla. Si se prefiere seguir en PowerShell, llamar a Git Bash explícitamente:

```powershell
& "$env:ProgramFiles\Git\bin\bash.exe" ./scripts/4to_entregable/inicializar-todo.sh
```

Para levantar también Jenkins, agregar `--con-jenkins` (ver [Jenkins](#jenkins-pipeline-de-cicd-local)).

El script, en este orden:

1. Crea las claves locales `db/password.txt` y `db/jwt-secret.txt` con valores aleatorios, solo si no existen (no están en Git).
2. Inicia Minikube con el addon de Ingress.
3. Construye las imágenes dentro de Minikube, crea los Secrets y el ConfigMap de la base (`preparar-chart.sh`) e instala la chart `petcore`.
4. Instala Kyverno con sus 4 políticas.
5. Instala Falco.
6. Despliega Prometheus y Grafana en el namespace `petcore`.

La primera vez tarda varios minutos. Se puede volver a ejecutar sin problema: lo que ya existe se actualiza. Cada script de `scripts/4to_entregable/` muestra sus opciones con `--ayuda`.

> Hay **una sola API**: Prometheus y Grafana corren en el namespace `petcore` y miden el `api` que instala la chart.

### 3. Entrar a la aplicación

En una terminal de Git Bash, dejar corriendo (la terminal queda ocupada mientras se use la aplicación):

```bash
minikube kubectl -- port-forward svc/frontend 8081:8080 -n petcore
```

Abrir <http://localhost:8081> e iniciar sesión con un usuario de prueba (ver [Datos de prueba](#datos-de-prueba)), por ejemplo `ana.cliente@petcore.com` / `Password123!`.

**Alternativa con `petcore.local`** (opcional, pasa por el Ingress): agregar el nombre al archivo `hosts` de Windows, una sola vez, en PowerShell **como administrador**:

```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 petcore.local"
```

Después dejar corriendo `minikube tunnel` en otra terminal de Git Bash (puede pedir permisos de administrador) y abrir <http://petcore.local>.

**Puertos y direcciones de cada servicio** (los `port-forward` dejan la terminal ocupada: abrir una por servicio):

| Servicio | Qué es | Puerto en el cluster | Cómo entrar desde el navegador |
| --- | --- | --- | --- |
| Aplicación (frontend) | La página web de la clínica (React servida con Nginx) | 8080 | `minikube kubectl -- port-forward svc/frontend 8081:8080 -n petcore` y <http://localhost:8081> (o <http://petcore.local> con `minikube tunnel` y la línea en `hosts`) |
| API | El backend (FastAPI). Su documentación interactiva (Swagger) está en `/docs` | 8000 | `minikube kubectl -- port-forward svc/api 8000:8000 -n petcore` y <http://localhost:8000/docs> |
| Prometheus | Recolecta las métricas de la API | 9090 | `minikube kubectl -- port-forward svc/prometheus 9090:9090 -n petcore` y <http://localhost:9090> |
| Grafana (`admin` / `admin`) | Muestra los dashboards y las alertas | 3000 | `minikube service grafana -n petcore --url` (muestra la URL; dejar la terminal abierta) |
| PostgreSQL | La base de datos | 5432 | Solo accesible dentro del cluster, no se abre al navegador |
| Jenkins (solo con `--con-jenkins`) | El pipeline de CI/CD | 8080 de la máquina | <http://localhost:8080> |

### 4. Comprobar que cada pieza funciona

| Pieza | Comando | Resultado esperado |
| --- | --- | --- |
| Aplicación | `minikube kubectl -- get pods -n petcore` | `api`, `frontend`, `postgres-0`, `prometheus` y `grafana` en `1/1 Running` |
| Releases de Helm | `helm list -A` | `petcore`, `kyverno` y `falco` en `deployed` |
| Kyverno (políticas) | `minikube kubectl -- get clusterpolicy` | `disallow-latest-tag`, `require-resources`, `disallow-root` y `require-probes` con `READY True` |
| Kyverno (bloqueo) | `minikube kubectl -- run prueba --image=nginx:latest -n petcore` | **Tiene que dar error**: `admission webhook "validate.kyverno.svc-fail" denied the request`, citando las 4 políticas (`disallow-latest-tag`, `disallow-root`, `require-probes` y `require-resources`). Si el Pod se crea, Kyverno no está funcionando |
| Falco | `minikube kubectl -- exec -it -n petcore deploy/api -- sh` (escribir `exit`) y después `minikube kubectl -- logs -n falco -l app.kubernetes.io/name=falco -c falco --tail=20` | Alerta `Terminal shell in container` con `k8s.ns.name=petcore` |
| Prometheus | `minikube kubectl -- port-forward svc/prometheus 9090:9090 -n petcore` y abrir <http://localhost:9090/targets> | El target de la API en estado `UP` |
| Grafana | `minikube service grafana -n petcore --url` (usuario `admin` / `admin`) | Dashboards, carpeta Pet-Core, **Pet-Core - Monitoreo**, con datos unos 30 s después de correr el script de la sección 5 |
| Alertas | `bash scripts/4to_entregable/poblar-dashboards.sh --disparar-alertas` (en Git Bash) y, en Grafana, Alerting, Alert rules | Las 2 reglas en `Firing` a los 15 a 45 s |
| Jenkins (solo si se ejecutó `inicializar-todo.sh` con la opción `--con-jenkins`) | `docker ps --filter name=petcore-jenkins` y abrir <http://localhost:8080> | Contenedor `Up` y la pantalla de Jenkins. Si el script se ejecutó sin esa opción, no aparece nada y es lo normal: Jenkins no se levantó |

### 5. Generar datos para Grafana

El script es de bash y **debe ejecutarse en Git Bash**, dentro de la carpeta del proyecto:

```bash
bash scripts/4to_entregable/poblar-dashboards.sh
```

Genera tráfico real contra la API (registra un cliente, falla logins a propósito, reserva y cancela turnos) para que los paneles tengan datos. Con `--disparar-alertas` hace 12 reservas y 4 logins fallidos, que superan los umbrales de las 2 alertas (más de 10 turnos en 5 minutos y más de 3 logins fallidos en 1 minuto), y las alertas pasan a `Firing` en menos de un minuto (Grafana las evalúa cada 30 segundos). Para que funcione, tiene que haber horarios libres para las 12 reservas: si al final el script muestra `AVISO: solo pude crear X de 12 turnos` con X menor o igual a 10, la alerta de turnos no se dispara. Las reservas y el cliente registrado quedan guardados en la base.

### 6. Borrar todo

El script también debe ejecutarse en Git Bash:

```bash
bash scripts/4to_entregable/borrar-todo.sh
```

Borra la aplicación, sus discos, Kyverno, Falco, Prometheus, Grafana y el addon de Ingress, y verifica que no quede nada. Opciones: `--con-jenkins` (también borra Jenkins y su volumen) y `--borrar-cluster` (hace `minikube delete` al final). Si todo salió bien, todas las líneas dicen `[OK]` y termina con `Todo borrado.`

## Demo (entorno local)

**0. Levantar todo.** En Git Bash, desde la raíz del proyecto:

```bash
bash scripts/4to_entregable/inicializar-todo.sh
```

Para mostrar también Jenkins, usar `bash scripts/4to_entregable/inicializar-todo.sh --con-jenkins`.

**1. La aplicación**

```bash
minikube kubectl -- port-forward svc/frontend 8081:8080 -n petcore
```

Abrir <http://localhost:8081>. Iniciar sesión con `ana.cliente@petcore.com` / `Password123!` (cliente) o con `carla.admin@petcore.com` / `Password123!` (administrador).

**2. Grafana**

```bash
minikube kubectl -- port-forward svc/grafana 3000:3000 -n petcore
```

Abrir <http://localhost:3000> (usuario `admin` / `admin`), Dashboards, carpeta Pet-Core, **Pet-Core - Monitoreo**.

**3. Generar tráfico y disparar las 2 alertas**

```bash
bash scripts/4to_entregable/poblar-dashboards.sh --disparar-alertas
```

A los 30 a 45 segundos, en <http://localhost:3000>, Alerting, Alert rules: las 2 reglas aparecen en `Firing`. Los paneles del dashboard se llenan con los datos.

**4. Kyverno bloquea un Pod que incumple las políticas**

```bash
minikube kubectl -- run prueba --image=nginx:latest -n petcore
```

Tiene que dar error: `admission webhook "validate.kyverno.svc-fail" denied the request`. Para ver las 4 políticas activas:

```bash
minikube kubectl -- get clusterpolicy
```

**5. Falco detecta actividad sospechosa**

En una terminal, dejar corriendo la captura de alertas:

```bash
bash scripts/4to_entregable/guardar-falco.sh
```

En otra terminal, abrir una shell en la API y crear un enlace simbólico a un archivo sensible:

```bash
minikube kubectl -- exec -it -n petcore deploy/api -- sh
# dentro de la shell:
ln -s /etc/shadow /tmp/falco-prueba
exit
```

Las alertas aparecen en la primera terminal y quedan guardadas en `reports/falco-event.log` (el script agrega líneas al final del archivo).

**6. Jenkins** (solo si se levantó con `--con-jenkins`)

Abrir <http://localhost:8080>, entrar al Job `petcore-pipeline` y presionar Build Now (hacen falta las credenciales cargadas, ver [Jenkins](#jenkins-pipeline-de-cicd-local)).

**Resumen de puertos**

| Qué | Dirección |
| --- | --- |
| Aplicación | <http://localhost:8081> |
| Grafana | <http://localhost:3000> |
| Jenkins | <http://localhost:8080> |
| Swagger de la API (opcional) | <http://localhost:8000/docs> con `minikube kubectl -- port-forward svc/api 8000:8000 -n petcore` |
| Prometheus (opcional) | <http://localhost:9090> con `minikube kubectl -- port-forward svc/prometheus 9090:9090 -n petcore` |

## Jenkins (pipeline de CI/CD local)

Jenkins corre en un contenedor Docker (`petcore-jenkins`, imagen `jenkins/jenkins:lts`) fuera de Minikube. Ejecuta el `Jenkinsfile` de la raíz: clona el repositorio, corre Semgrep, Snyk (corta ante vulnerabilidades críticas) y los tests, construye y publica las imágenes en Docker Hub (tag `build-N`) y despliega con Helm en Minikube.

1. Levantarlo, con Minikube ya corriendo y `inicializar-todo.sh` ejecutado antes (crea los Secrets que el despliegue necesita):

   ```bash
   bash scripts/4to_entregable/inicializar-todo.sh --con-jenkins
   # o, si el entorno ya está levantado:
   bash scripts/4to_entregable/jenkins-up.sh
   ```

2. Abrir <http://localhost:8080>. En ambiente local **no pide usuario ni contraseña**, y el Job `petcore-pipeline` ya está creado.
3. Cargar **una sola vez** las credenciales en Manage Jenkins, Credentials:
   - `SNYK_TOKEN` (Secret text): el token de la cuenta de Snyk.
   - `DOCKER_REGISTRY_CREDS` (Username and password): usuario y contraseña de Docker Hub.
4. Ejecutar el Job con Build Now.

`jenkins-up.sh` se puede volver a correr: reutiliza el contenedor y conserva plugins, Job y credenciales. Genera en cada arranque el kubeconfig que Jenkins usa para llegar a Minikube, así que cada integrante usa su propio cluster.

Para borrar Jenkins junto con todo lo demás (en Git Bash):

```bash
bash scripts/4to_entregable/borrar-todo.sh --con-jenkins
```

## Falco

`inicializar-todo.sh` ya instala Falco. Para **guardar las alertas del namespace `petcore`** en `reports/falco-event.log`, ejecutar desde la raíz del repositorio y dejar la terminal abierta (detener con `Ctrl+C`):

```bash
bash scripts/4to_entregable/guardar-falco.sh
```

En PowerShell: `& "$env:ProgramFiles\Git\bin\bash.exe" ./scripts/4to_entregable/guardar-falco.sh`.

Mientras tanto, desde otra terminal, provocar una alerta (por ejemplo, abrir una shell en el pod de la API y crear un enlace simbólico a un archivo sensible):

```bash
minikube kubectl -- exec -it -n petcore deploy/api -- sh
# dentro de la shell: ln -s /etc/shadow /tmp/falco-prueba, y después exit
```

**Instalar Falco a mano** (opcional; el script ya lo hace, con los mismos parámetros):

```bash
helm repo add falcosecurity https://falcosecurity.github.io/charts --force-update
helm repo update
helm upgrade --install falco falcosecurity/falco --version 9.2.2 --kube-context minikube --namespace falco --create-namespace --set driver.kind=modern_ebpf --set tty=true --set falco.json_output=true --set falco.priority=notice --set falco.buffered_outputs=false --set falco.stdout_output.enabled=true --values k8s/4to_entregable/falco-values.yaml --wait --timeout 5m
```

`k8s/4to_entregable/falco-values.yaml` es la configuración de la entrega final: la excepción del chequeo de PostgreSQL apunta al namespace `petcore`. Para ver las alertas en tiempo real: `minikube kubectl -- logs -n falco -l app.kubernetes.io/name=falco -c falco --follow`.

## Operar la aplicación con Helm

### Instalar solo la aplicación

Si se quiere instalar únicamente la aplicación (API, frontend y PostgreSQL), sin Kyverno, Falco ni monitoreo:

```bash
minikube start --driver=docker
minikube addons enable ingress
bash scripts/4to_entregable/preparar-chart.sh
helm upgrade --install petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml
kubectl get pods -n petcore -w
```

`preparar-chart.sh` crea el namespace `petcore`, los Secrets (`postgres-secret`, `jwt-secret`), el ConfigMap `postgres-init` y construye las imágenes dentro de Minikube. Requiere que existan `db/password.txt` y `db/jwt-secret.txt` (no están en Git). `inicializar-todo.sh` los crea solos; para crearlos a mano, en Git Bash:

```bash
mkdir -p db
[ -s db/password.txt ] || printf '%s' "$(openssl rand -hex 16)" > db/password.txt
[ -s db/jwt-secret.txt ] || printf '%s' "$(openssl rand -hex 32)" > db/jwt-secret.txt
```

Durante el arranque, el pod de la API pasa por `Init:0/1` mientras espera a PostgreSQL. Salir con `Ctrl+C` cuando `api`, `frontend` y `postgres-0` estén en `1/1 Running`.

La chart tiene tres juegos de valores: `values.yaml` (por defecto, que usa `inicializar-todo.sh`), `values-dev.yaml` (desarrollo) y `values-prod.yaml` (producción: más réplicas y recursos, sesiones más cortas y bloqueos más largos). Se elige con `-f helm-chart/values-dev.yaml` o `-f helm-chart/values-prod.yaml`.

### Actualizar, volver atrás y borrar

| Acción | Comando |
| --- | --- |
| Aplicar cambios de la chart o de los valores | `helm upgrade petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml` |
| Reconstruir las imágenes después de cambiar código | `bash scripts/4to_entregable/preparar-chart.sh` y luego `kubectl rollout restart deployment -n petcore` |
| Ver el historial de versiones | `helm history petcore -n petcore` |
| Volver a la versión anterior | `helm rollback petcore -n petcore` |
| Desinstalar la aplicación | `helm uninstall petcore -n petcore` |
| Borrar también los datos de PostgreSQL | `kubectl delete pvc --all -n petcore` |
| Borrar todo el namespace | `kubectl delete namespace petcore` |

`helm uninstall` no borra el disco de PostgreSQL, a propósito, para no perder datos. Los SQL de `db/init/` solo se ejecutan cuando ese disco está vacío: para volver a cargar los datos de prueba hay que borrar el PVC.

## Datos de prueba

La primera vez que se levanta el proyecto (con el volumen de PostgreSQL vacío), se cargan usuarios y datos de ejemplo desde `db/init/04_datos_prueba.sql`.

La contraseña de todos los usuarios de prueba es `Password123!`:

| Correo | Rol |
| --- | --- |
| ana.cliente@petcore.com | CLIENTE |
| bruno.vet@petcore.com | VETERINARIO |
| carla.admin@petcore.com | ADMINISTRADOR |

También incluye 2 mascotas, 3 tipos de atención, la disponibilidad semanal del veterinario y un turno ya agendado.

Si el volumen ya existía antes de agregar este archivo, hay que recrearlo para que los datos se carguen. Hay que borrar el PVC de PostgreSQL (ver [Actualizar, volver atrás y borrar](#actualizar-volver-atrás-y-borrar)).

## Entregables anteriores (referencia)

Las secciones siguientes documentan los entregables 1 a 3 (Blue/Green en Kubernetes, monitoreo en el namespace `clinica-veterinaria` y DevSecOps con scripts de PowerShell). **No hacen falta para levantar ni evaluar la entrega final**: los scripts `.ps1` de `scripts/` quedan como evidencia de esos entregables y la entrega final los reemplaza por los scripts de bash de `scripts/4to_entregable/`.

### Ejecutar con Kubernetes y Minikube

Esta configuración permite ejecutar PostgreSQL, FastAPI y el frontend dentro de un clúster local de Kubernetes. También implementa un despliegue Blue/Green que mantiene las versiones `v1` y `v2` ejecutándose al mismo tiempo.

#### Requisitos de Kubernetes

Docker Desktop debe estar abierto y funcionando.

Comprobar que `kubectl` y Minikube estén instalados:

```powershell
kubectl version --client
minikube version
```

Si todavía no están instalados:

```powershell
winget install -e --id Kubernetes.kubectl
winget install -e --id Kubernetes.minikube
```

Después de instalarlos, cerrar y volver a abrir la terminal.

#### Iniciar o comprobar Minikube

Los scripts de Blue y Green inician o reanudan Minikube automáticamente. Este paso manual es opcional y sirve para comprobar el clúster antes de ejecutar los scripts.

Desde la carpeta del proyecto:

```powershell
minikube start --driver=docker
```

Comprobar el estado:

```powershell
minikube status
minikube kubectl -- get nodes
```

#### Preparación local

Antes de ejecutar los scripts, crear los siguientes archivos (ver [Instalar solo la aplicación](#instalar-solo-la-aplicación)):

```text
db/password.txt
db/jwt-secret.txt
```

Estos archivos son locales, no se guardan en Git y cada integrante debe crear los suyos.

#### Versiones utilizadas

| Versión | Rama | Imágenes | Deployments |
| --- | --- | --- | --- |
| Blue | `blue` | `clinica-veterinaria:v1` y `clinica-frontend:v1` | `api-blue` y `frontend-blue` |
| Green | `green` | `clinica-veterinaria:v2` y `clinica-frontend:v2` | `api-green` y `frontend-green` |

La rama `blue` conserva la primera versión. La rama `green` contiene las funcionalidades nuevas y la infraestructura necesaria para ejecutar ambas versiones.

#### Paso 1: levantar Blue

Si la rama Blue ya existe localmente, cambiar a ella y actualizarla:

```powershell
git switch blue
git pull
```

Si la rama Blue todavía no existe localmente, obtener las referencias de GitHub y crearla siguiendo `origin/blue`:

```powershell
git fetch origin
git switch -c blue --track origin/blue
```

Desde la carpeta principal del proyecto, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up.ps1
```

El script:

- inicia Minikube;
- construye las imágenes Blue `v1` de FastAPI y del frontend;
- crea o actualiza los Secrets y el ConfigMap;
- levanta PostgreSQL con su almacenamiento persistente;
- crea los Deployments Blue;
- crea los Services de la API y del frontend;
- espera que todos los componentes estén disponibles.

La versión de `k8s-up.ps1` presente en la rama Green se encuentra protegida para impedir que se construya accidentalmente código Green con la etiqueta `v1`.

#### Paso 2: acceder y probar Blue

Comprobar que los Services seleccionen Blue:

```powershell
minikube kubectl -- get service api --namespace=clinica-veterinaria -o jsonpath="{.spec.selector.version}"
minikube kubectl -- get service frontend --namespace=clinica-veterinaria -o jsonpath="{.spec.selector.version}"
```

Ambos comandos deben mostrar `blue`.

Para probar el frontend, abrir otra terminal, ejecutar el siguiente comando y mantenerla abierta:

```powershell
minikube service frontend --namespace=clinica-veterinaria --url
```

Para probar la API, utilizar otra terminal y mantenerla abierta:

```powershell
minikube service api --namespace=clinica-veterinaria --url
```

Agregar `/docs` al final de la URL de la API para abrir la documentación interactiva de FastAPI. Después de comprobar Blue, presionar `Ctrl+C` en las terminales de los túneles antes de continuar. Al iniciar nuevamente Minikube, las URLs locales pueden cambiar.

#### Paso 3: desplegar Green junto a Blue

Sin eliminar los recursos de Minikube, cambiar a la rama Green. Si ya existe localmente:

```powershell
git switch green
git pull
```

Si la rama Green todavía no existe localmente:

```powershell
git fetch origin
git switch -c green --track origin/green
```

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up-green.ps1
```

El script `k8s-up-green.ps1`:

- comprueba que Blue y PostgreSQL ya estén desplegados;
- espera que Blue esté saludable;
- mantiene el tráfico en Blue durante la actualización;
- construye las imágenes Green `v2`;
- crea o actualiza `api-green` y `frontend-green`;
- espera que los Pods Green estén disponibles;
- deja Green preparado, pero sin enviarle todavía el tráfico principal.

Los manifiestos nuevos utilizados por este script son:

| Archivo | Función |
| --- | --- |
| `k8s/api-green-deployment.yaml` | Ejecuta FastAPI `v2` con las etiquetas `app: clinica-api` y `version: green`. |
| `k8s/frontend-green-deployment.yaml` | Ejecuta el frontend `v2` con las etiquetas `app: clinica-frontend` y `version: green`. |

#### Paso 4: comprobar Blue y Green

Mostrar los Pods y su versión:

```powershell
minikube kubectl -- get pods -L version --namespace=clinica-veterinaria
```

Se deben ver simultáneamente `api-blue`, `api-green`, `frontend-blue`, `frontend-green` y `postgres-0`.

Mostrar las imágenes utilizadas:

```powershell
minikube kubectl -- get deployments api-blue api-green frontend-blue frontend-green --namespace=clinica-veterinaria -o "custom-columns=DEPLOYMENT:.metadata.name,IMAGEN:.spec.template.spec.containers[*].image,DISPONIBLES:.status.readyReplicas"
```

#### Paso 5: cambiar el tráfico a Green

Ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-switch-green.ps1
```

Este script cambia los selectores de los Services `api` y `frontend` de `version: blue` a `version: green`. Blue continúa ejecutándose, pero las solicitudes nuevas son enviadas a Green.

Comprobar los selectores:

```powershell
minikube kubectl -- get service api --namespace=clinica-veterinaria -o jsonpath="{.spec.selector.version}"
minikube kubectl -- get service frontend --namespace=clinica-veterinaria -o jsonpath="{.spec.selector.version}"
```

Ambos comandos deben mostrar `green`.

#### Paso 6: acceder y probar Green

En Windows con el driver de Docker, Minikube crea túneles locales para acceder a los Services. Las URLs de una ejecución anterior pueden dejar de funcionar después de reiniciar Minikube, por lo que deben obtenerse nuevamente.

Abrir una terminal nueva, ejecutar el siguiente comando y mantenerla abierta:

```powershell
minikube service frontend --namespace=clinica-veterinaria --url
```

La URL mostrada corresponde al frontend Green porque el paso anterior cambió el selector del Service `frontend`.

Para abrir la documentación de FastAPI, utilizar otra terminal y mantenerla abierta:

```powershell
minikube service api --namespace=clinica-veterinaria --url
```

Agregar `/docs` al final de la URL obtenida. Por ejemplo, si Minikube muestra `http://127.0.0.1:55000`, la documentación estará en `http://127.0.0.1:55000/docs`.

#### Paso 7: realizar rollback a Blue

Si Green presenta un problema, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-switch-blue.ps1
```

Este script devuelve los selectores de ambos Services a `version: blue`. El rollback no necesita reconstruir imágenes, eliminar Green ni reiniciar PostgreSQL. Los túneles pueden permanecer abiertos: al actualizar el navegador, los mismos Services dirigirán las solicitudes nuevamente a Blue.

> [!NOTE]
> Si quiere ver inmediatmaente el cambio, debe de desactivar el cache del navegador web. En caso de no desactivarlo puede tardar unos minutos en que la pagina cargue.

#### Base de datos compartida

Blue y Green utilizan el mismo StatefulSet de PostgreSQL y el mismo volumen persistente. No existe un volumen diferente para cada versión y el volumen no se guarda en Git.

Los archivos de `db/init/` permiten reconstruir la base inicial en un volumen nuevo. Las modificaciones de base realizadas para Green deben ser compatibles con Blue para que el rollback continúe funcionando.

### Monitoreo con Prometheus y Grafana

> Documento completo (qué se mide, por qué, arquitectura y cómo probar cada parte) en
> [`ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md`](ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md).
> Esta sección es solo cómo levantarlo y entrar.

#### No depende de Blue/Green

El monitoreo tiene su **propio Deployment de la API** (`api-monitoring`, sin versiones
`blue`/`green`), así que no hace falta tener Blue/Green desplegado ni mergeado a ninguna
rama para probarlo. Solo hace falta que la rama que tengas en este momento tenga estos
archivos (los ves con `git status` o mirando si existe `k8s\api-monitoring-deployment.yaml`).

Para levantar todo (Postgres + `api-monitoring` + Prometheus + Grafana) de punta a punta:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up-monitoring.ps1
```

Este script no revisa en qué rama estás (a diferencia de `k8s-up.ps1`/`k8s-up-green.ps1`,
que exigen `blue`/`green`) y reusa el mismo Postgres si ya existe. Si en algún momento
esto se mergea a `blue` o `green`, también queda disponible automáticamente al correr esos
scripts de siempre (aplican toda la carpeta `k8s/`), pero no hace falta esperar a eso.

#### Acceder al dashboard

Prometheus queda **interno** (`ClusterIP`, sin URL propia) a propósito: nadie del equipo
necesita entrar ahí para el día a día, eso lo hace Grafana. Para abrir Grafana:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-open-grafana.ps1
```

Dejar la terminal abierta (igual que con `frontend` o `api`) y abrir la URL que muestra.
Usuario y contraseña por defecto de la imagen: `admin` / `admin` (pide cambiarla en el
primer login).

> **Grafana no tiene almacenamiento persistente**: cada vez que se reinicia el Pod (por
> ejemplo, al volver a correr `k8s-up-monitoring.ps1` o si alguien hace
> `rollout restart`), la contraseña vuelve a `admin`/`admin`, aunque la hayas cambiado
> antes. No es un bug: es el mismo motivo por el que el dashboard y el datasource
> aparecen solos (se vuelven a provisionar desde los ConfigMaps en cada arranque).

Para probar la API de monitoreo directamente (Swagger, sin pasar por Grafana):

```powershell
minikube service api-monitoring --namespace=clinica-veterinaria --url
```

#### Generar actividad real para ver los paneles y las alertas moverse

**Importante**: el frontend de Blue/Green (el de siempre, `localhost:8080`) habla con la
API de Blue/Green, **no** con `api-monitoring`. Nada de lo que hagas ahí va a aparecer en
Grafana. Para eso existe `frontend-monitoring`: la misma app, pero ya apuntada a
`api-monitoring`. `scripts\k8s-up-monitoring.ps1` lo construye y lo despliega solo, no
hace falta ningún paso manual. Para abrirlo:

```powershell
minikube service frontend-monitoring --namespace=clinica-veterinaria --url
```

Abrir la URL que muestra: es la app de siempre (entrar, reservar turnos, cancelar,
registrar un cliente, fallar un login a propósito, etc.), pero esta copia sí está
conectada a la API que Prometheus observa.

Guía paso a paso completa (incluye cómo disparar cada alerta a propósito, qué esperar ver
en cada panel, y qué hacer si algo muestra "No data") en
[`ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md`](ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md).

#### Qué incluye

Grafana ya arranca con el dashboard **"Pet-Core - Monitoreo"** armado (carpeta "Pet-Core"),
con 10 paneles: turnos creados, logins fallidos, tasa de requests por endpoint, latencia
p95 por endpoint, errores 5xx, turnos cancelados, clientes nuevos registrados, CPU y RAM
del pod, y la correlación entre latencia del endpoint y duración de la query a Postgres,
todo provisionado como código, sin clickear nada en la UI. **Las 2 reglas de alerta
también están implementadas y verificadas llegando a `Firing` con datos reales**
(turnos > 10 en 5 min, logins fallidos > 3 en 1 min).

### DevSecOps y reproducción de pruebas

Esta guía permite repetir las pruebas documentadas en el [Entregable 3 DevSecOps](ENTREGABLE_3_DEVSECOPS.md). El informe contiene las explicaciones y los resultados obtenidos; aquí se reúnen las instrucciones de ejecución y los resultados esperados.

El recorrido es: preparar las herramientas y claves locales, revisar el código, analizar las imágenes, desplegar el entorno de monitoreo, validar las políticas y comprobar Falco. Los enlaces de preparación remiten a los pasos generales del README sin repetirlos aquí.

#### Preparar el entorno para las pruebas DevSecOps

Los pasos siguientes están pensados para Windows de 64 bits y PowerShell. Ejecutar los comandos desde la raíz del repositorio. Primero comprobar cada herramienta: si ya está instalada y funciona, no hace falta volver a instalarla. Después de una instalación, cerrar y volver a abrir PowerShell para que reconozca los nuevos comandos.

##### 1. Usar el clúster local

La instalación de Minikube ya está explicada en [Requisitos de Kubernetes](#requisitos-de-kubernetes), y su inicio y verificación en [Iniciar o comprobar Minikube](#iniciar-o-comprobar-minikube). Completar esos pasos si todavía no se hicieron. Para estas pruebas alcanza con tener el nodo en estado `Ready`; no hace falta desplegar Blue ni Green.

Los comandos de esta guía usan `minikube kubectl --`, incluido con Minikube.

Helm debe apuntar al mismo clúster. Comprobar el contexto y seleccionarlo si hace falta:

```powershell
minikube kubectl -- config current-context
minikube kubectl -- config use-context minikube
```

El contexto utilizado para estas pruebas es `minikube`.

##### 2. Helm, Node.js y KubeLinter

Helm, Node.js (con npm) y KubeLinter se instalan con sus instaladores habituales (por ejemplo `winget install --id Helm.Helm -e`). Si se quiere usar exactamente las mismas versiones de las pruebas (Helm 3.21.0 y KubeLinter 0.8.3), los comandos de descarga e instalación manual están en `ENTREGABLE_3_DEVSECOPS.md`, sección 9 "Anexo: instalar a mano las herramientas de las pruebas" (opcional). Para comprobar que están disponibles:

```powershell
helm version
node --version
npm --version
kube-linter version
```

##### 3. Herramientas que no se instalan directamente en Windows

| Herramienta o servicio | Cómo se prepara |
|---|---|
| Semgrep y Trivy | Los comandos de análisis descargan y ejecutan sus imágenes con Docker. |
| Kyverno | Se instala con los comandos de Helm del apartado de seguridad en Kubernetes. |
| Falco | Lo instala el script `scripts/k8s-up-falco.ps1`, también llamado por el script de monitoring. |
| FastAPI, PostgreSQL, Nginx, Prometheus y Grafana | Se construyen o descargan como imágenes y se despliegan mediante `scripts/k8s-up-monitoring.ps1`. |

No hace falta instalar Python o PostgreSQL directamente en Windows para este recorrido con Docker y Kubernetes.

##### 4. Comprobar los archivos locales y preparar los reportes

La creación de las claves está explicada en [Instalar solo la aplicación](#instalar-solo-la-aplicación). Si ya se crearon, conservar los archivos existentes; no hace falta generarlos otra vez.

Comprobar que ambos están disponibles y preparar la carpeta de reportes:

```powershell
Test-Path .\db\password.txt
Test-Path .\db\jwt-secret.txt
New-Item -ItemType Directory -Force -Path .\reports\entregable-3 | Out-Null
```

Los dos primeros comandos deben devolver `True`. Si alguno devuelve `False`, completar la sección de configuración correspondiente antes de continuar.

La preparación está completa cuando el nodo de Minikube está `Ready`, Helm, Node/npm y KubeLinter muestran sus versiones y existen los dos archivos de claves. A continuación se pueden ejecutar las pruebas. Los comandos de análisis escriben los reportes finales en `reports/entregable-3/`; los archivos iniciales se conservan para comparar.

#### Revisar la seguridad del código

Estos comandos repiten la revisión de las dependencias del frontend y del código propio. Las salidas se guardan como reportes finales; los archivos iniciales se conservan para mantener la comparación.

```powershell
cd frontend
npm ci
cmd /c "npm audit > ..\reports\entregable-3\npm-audit.txt"
cd ..

docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep --config auto --output /src/reports/entregable-3/semgrep.txt /src/app /src/frontend/src
```

#### Analizar las imágenes

Los comandos para reconstruir las imágenes y analizarlas con Trivy están en `ENTREGABLE_3_DEVSECOPS.md`, sección 3.5 "Comandos utilizados para construir y analizar las imágenes".

#### Validar la seguridad en Kubernetes

La comprobación comienza levantando el entorno con los manifiestos ajustados. Después se instalan las políticas, se prueban los rechazos esperados y se genera el reporte de KubeLinter. Se busca verificar tanto la aplicación de las reglas como la configuración declarada en los YAML.

**Desplegar con el hardening ya aplicado:**

```powershell
.\scripts\k8s-up-monitoring.ps1
```

**Instalar y aplicar Kyverno en otra terminal:** el script de monitoring queda capturando alertas de Falco, por lo que no devuelve el prompt mientras la captura está activa.

```powershell
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update
helm upgrade --install kyverno kyverno/kyverno -n kyverno --create-namespace --version 3.9.2 --wait

minikube kubectl -- apply -f k8s/policies/disallow-latest-tag.yaml
minikube kubectl -- apply -f k8s/policies/require-resources.yaml
minikube kubectl -- apply -f k8s/policies/disallow-root.yaml
minikube kubectl -- get clusterpolicy
```

**Validar con manifiestos de prueba:**

```powershell
minikube kubectl -- apply -f k8s/policies/test/pod-no-conforme.yaml        # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-latest.yaml        # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-sin-resources.yaml # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-solo-root.yaml          # debe ser rechazado
minikube kubectl -- apply -f k8s/policies/test/pod-conforme.yaml           # debe crearse
minikube kubectl -- delete pod pod-conforme -n clinica-veterinaria
```

**KubeLinter:**

```powershell
kube-linter lint k8s\*.yaml > reports\entregable-3\kubelinter.txt
```

#### Probar la detección de Falco

La prueba se realiza con dos terminales: una mantiene activa la captura de alertas y la otra abre la shell dentro de la API. Se busca que la acción quede registrada en el log mientras ocurre.

En una terminal, iniciar la captura y dejarla abierta. Si ya está activa desde el script de monitoring, no hace falta iniciarla otra vez:

```powershell
.\scripts\k8s-up-falco.ps1
```

En otra terminal, comprobar los pods y abrir la shell:

```powershell
minikube kubectl -- get pods -n falco
minikube kubectl -- exec -it -n clinica-veterinaria deployment/api-monitoring -- /bin/sh
# dentro de la shell: id, pwd, exit

minikube kubectl -- logs -n falco -l app.kubernetes.io/name=falco -c falco --tail=50
```

#### Comprobar el estado y los usuarios de los servicios

Consultar el estado de los pods:

```powershell
minikube kubectl -- get pods -n clinica-veterinaria
```

Los servicios deben estar en `Running` y listos para atender solicitudes. Para comprobar que se ejecutan con el usuario configurado, consultar su identificación:

```powershell
minikube kubectl -- exec deploy/prometheus -n clinica-veterinaria -- id
minikube kubectl -- exec deploy/grafana -n clinica-veterinaria -- id
minikube kubectl -- exec postgres-0 -n clinica-veterinaria -- id
minikube kubectl -- exec deploy/frontend-monitoring -n clinica-veterinaria -- id
minikube kubectl -- exec deploy/api-monitoring -n clinica-veterinaria -- id
```

Los usuarios esperados son `nobody` (65534), `grafana` (472), `postgres` (999), `nginx` (101) y `app` (10001), respectivamente. La explicación de cada resultado se encuentra en la sección 4.1 del [Entregable 3 DevSecOps](ENTREGABLE_3_DEVSECOPS.md).
