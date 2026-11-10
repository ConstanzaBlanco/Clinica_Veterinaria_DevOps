# Pet-Core

## Índice

- [Requisitos](#requisitos)
  - [Instalar uv para desarrollo local](#instalar-uv-para-desarrollo-local)
- [Configurar la contraseña de PostgreSQL](#configurar-la-contraseña-de-postgresql)
  - [Configurar la clave secreta JWT](#configurar-la-clave-secreta-jwt)
- [Ejecutar con Docker Compose (opcional)](#ejecutar-con-docker-compose-opcional)
- [Lab 4: levantar Pet-Core con Helm (desde cero)](#lab-4-levantar-pet-core-con-helm-desde-cero)
- [Ejecutar con Kubernetes y Minikube](#ejecutar-con-kubernetes-y-minikube)
  - [Requisitos de Kubernetes](#requisitos-de-kubernetes)
  - [Iniciar o comprobar Minikube](#iniciar-o-comprobar-minikube)
  - [Preparación local](#preparación-local)
  - [Versiones utilizadas](#versiones-utilizadas)
  - [Paso 1: levantar Blue](#paso-1-levantar-blue)
  - [Paso 2: acceder y probar Blue](#paso-2-acceder-y-probar-blue)
  - [Paso 3: desplegar Green junto a Blue](#paso-3-desplegar-green-junto-a-blue)
  - [Paso 4: comprobar Blue y Green](#paso-4-comprobar-blue-y-green)
  - [Paso 5: cambiar el tráfico a Green](#paso-5-cambiar-el-tráfico-a-green)
  - [Paso 6: acceder y probar Green](#paso-6-acceder-y-probar-green)
  - [Paso 7: realizar rollback a Blue](#paso-7-realizar-rollback-a-blue)
  - [Base de datos compartida](#base-de-datos-compartida)
- [Monitoreo con Prometheus y Grafana](#monitoreo-con-prometheus-y-grafana)
- [DevSecOps y reproducción de pruebas](#devsecops-y-reproducción-de-pruebas)
  - [Preparar el entorno para las pruebas DevSecOps](#preparar-el-entorno-para-las-pruebas-devsecops)
- [Datos de prueba](#datos-de-prueba)
- [Proteger endpoints con el middleware](#proteger-endpoints-con-el-middleware)

## Requisitos

Antes de comenzar, comprobar que Git y Docker Desktop estén instalados:

```powershell
git --version
docker --version
docker compose version
docker info
```

Docker Desktop debe estar abierto y funcionando antes de iniciar el proyecto.

### Instalar uv para desarrollo local

`uv` no es necesario para levantar el proyecto con Docker, porque se instala dentro de la imagen. Sin embargo, es necesario para ejecutar el proyecto, agregar dependencias o utilizar herramientas de Python directamente desde Windows.

```powershell
winget install --id astral-sh.uv -e
```

Después de instalarlo, cerrar y volver a abrir la terminal. Comprobar la instalación:

```powershell
uv --version
```

> No es necesario instalar PostgreSQL ni FastAPI manualmente. Docker Compose o los scripts de Kubernetes preparan los servicios según la forma de ejecución elegida.

## Configurar la contraseña de PostgreSQL

El proyecto utiliza un archivo local para proporcionar la contraseña de PostgreSQL sin escribirla directamente en `compose.yaml`.

Abrir una terminal en la carpeta del proyecto:

```powershell
cd "C:\ruta\Proyecto_Clínica_Veterinaria"
```

Crear la carpeta `db` si todavía no existe:

```powershell
New-Item -ItemType Directory -Force db
```

Crear el archivo de contraseña:

```powershell
Set-Content -Path db/password.txt -Value "CAMBIAR_POR_UNA_CONTRASENA"
```

Reemplazar `CAMBIAR_POR_UNA_CONTRASENA` por una contraseña local.

Comprobar que el archivo fue creado:

```powershell
Get-ChildItem db
```

> El archivo `db/password.txt` contiene información sensible y no debe guardarse en Git. Debe estar incluido en `.gitignore`.
>
> Cada integrante del equipo debe crear su propio archivo `db/password.txt` después de descargar el proyecto.

### Configurar la clave secreta JWT

Crear una clave aleatoria para firmar los tokens JWT. El comando conserva el archivo si ya existe y no requiere instalar Python ni uv:

```powershell
if (-not (Test-Path .\db\jwt-secret.txt)) {
    $jwtBytes = New-Object byte[] 32
    $jwtGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $jwtGenerator.GetBytes($jwtBytes) } finally { $jwtGenerator.Dispose() }
    $jwtSecret = [BitConverter]::ToString($jwtBytes).Replace('-', '').ToLowerInvariant()
    [IO.File]::WriteAllText((Join-Path $PWD.Path 'db\jwt-secret.txt'), $jwtSecret, [Text.UTF8Encoding]::new($false))
}
```

El archivo `db/jwt-secret.txt` contiene información sensible y no debe guardarse en Git.

Agregarlo al archivo `.gitignore`:

```gitignore
db/password.txt
db/jwt-secret.txt
```

> Cada integrante del equipo debe crear su propio archivo `db/jwt-secret.txt`.

## Ejecutar con Docker Compose (opcional)

Docker Compose ofrece una forma sencilla de ejecutar una sola versión del proyecto durante el desarrollo local. Esta sección es opcional y no forma parte del procedimiento Blue/Green.

Si se utilizará Kubernetes con Minikube, omitir esta sección y continuar en **Ejecutar con Kubernetes y Minikube**. No es necesario ejecutar Docker Compose y Kubernetes al mismo tiempo. Docker Desktop sí debe permanecer abierto porque Minikube utiliza el driver de Docker.

Construir las imágenes e iniciar los contenedores:

```powershell
docker compose up --build
```

Posteriormente, ingresar a:

- Estado de la API: http://127.0.0.1:8000/
- Documentación interactiva: http://127.0.0.1:8000/docs
- Prometheus: http://127.0.0.1:9090/
- Grafana: http://127.0.0.1:3000/ (usuario/contraseña por defecto: `admin` / `admin`)

> **Esto no es lo que se entrega.** La consigna pide Kubernetes, y eso ya está resuelto
> aparte en `k8s/` (ver más abajo). Prometheus y Grafana acá son solo una copia para
> desarrollo rápido, completamente independiente de Kubernetes y de Blue/Green: no hace
> falta tener ninguna rama desplegada ni mergeada para probarlos, con
> `docker compose up --build` alcanza. Sirve para validar rápido que las métricas nuevas
> (`turnos_creados_total`, `logins_fallidos_total`) funcionan, sin depender de Minikube ni
> arriesgar nada de lo que ya está desplegado ahí. Ver
> [Monitoreo con Prometheus y Grafana](#monitoreo-con-prometheus-y-grafana)
> para la versión que sí corre en Kubernetes.

Para detener los contenedores, presionar `Ctrl + C` y ejecutar:

```powershell
docker compose down
```

## Lab 4: levantar Pet-Core con Helm (desde cero)

Guía para levantar la aplicación completa (API, frontend y PostgreSQL) en un
cluster local de minikube usando la Helm chart de `helm-chart/`, partiendo de
una PC sin nada instalado del proyecto.

**Todos los comandos se ejecutan en Git Bash**, desde la carpeta del proyecto.
En PowerShell, `bash` ejecuta WSL en lugar de Git Bash y los scripts fallan.

### 1. Requisitos

| Programa | Para qué | Cómo instalarlo |
| --- | --- | --- |
| Git (incluye Git Bash) | Clonar el repositorio y ejecutar los scripts | `winget install --id Git.Git -e` |
| Docker Desktop | Motor donde corre minikube | Descargarlo de docker.com e iniciarlo |
| minikube | Cluster de Kubernetes local | `winget install --id Kubernetes.minikube -e` |
| kubectl | Consultar el cluster | Viene con Docker Desktop |
| Helm | Instalar la chart | `winget install --id Helm.Helm -e` |

Después de instalar, cerrar y abrir Git Bash para que reconozca los programas
nuevos. Comprobar con:

```bash
docker info --format '{{.ServerVersion}}'
minikube version
helm version
```

Docker Desktop tiene que estar abierto antes de seguir.

### 2. Clonar el repositorio

```bash
git clone https://github.com/ConstanzaBlanco/Clinica_Veterinaria_DevOps.git
cd Clinica_Veterinaria_DevOps
```

### 3. Crear las claves locales

La contraseña de PostgreSQL y la clave que firma los tokens JWT se guardan en dos
archivos que **no están en git** (`.gitignore` los excluye). Estos comandos los
crean con valores aleatorios, solo si todavía no existen:

```bash
mkdir -p db
[ -s db/password.txt ] || printf '%s' "$(openssl rand -hex 16)" > db/password.txt
[ -s db/jwt-secret.txt ] || printf '%s' "$(openssl rand -hex 32)" > db/jwt-secret.txt
```

La clave JWT tiene 64 caracteres; la aplicación exige al menos 32.

### 4. Iniciar minikube y habilitar el Ingress

```bash
minikube start --driver=docker
minikube addons enable ingress
```

El addon `ingress` instala el Ingress controller (nginx), que es el que permite
entrar a la app desde el navegador. Se habilita una sola vez por cluster.

### 5. Preparar lo que la chart no crea

```bash
bash scripts/4to_entregable/preparar-chart.sh
```

El script crea el namespace `petcore`, los Secrets (`postgres-secret`,
`jwt-secret`), el ConfigMap `postgres-init` con los SQL de `db/init/`, y
construye las imágenes `clinica-veterinaria` y `clinica-frontend` dentro de
minikube. La primera vez tarda unos minutos. Termina con:

```
==> Listo. Recursos creados en petcore:
```

### 6. Instalar la chart

```bash
helm upgrade --install petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml
```

`upgrade --install` instala si no existe y actualiza si ya existe. Al terminar,
Helm muestra `STATUS: deployed` y un mensaje con los pasos siguientes. Para la
configuración de producción se usa `-f helm-chart/values-prod.yaml`.

### 7. Esperar a que los pods estén listos

```bash
kubectl get pods -n petcore -w
```

Resultado esperado (los sufijos de los nombres cambian en cada instalación):

```
NAME                        READY   STATUS    RESTARTS   AGE
api-78cf9df9b6-tbw96        1/1     Running   0          40s
frontend-5bd96bc648-g74cw   1/1     Running   0          40s
postgres-0                  1/1     Running   0          40s
```

Durante el arranque, el pod de la API pasa por `Init:0/1` mientras espera a
PostgreSQL. Salir con `Ctrl + C` cuando los tres estén en `1/1 Running`.

### 8. Acceder a la aplicación

**Desde el navegador:**

1. En otra terminal de Git Bash, dejar corriendo (puede pedir permisos de administrador):

   ```bash
   minikube tunnel
   ```

2. Agregar el nombre `petcore.local` al archivo `hosts` de Windows: abrir el
   Bloc de notas **como administrador**, abrir
   `C:\Windows\System32\drivers\etc\hosts` (elegir "Todos los archivos" en el
   diálogo) y agregar al final:

   ```
   127.0.0.1 petcore.local
   ```

3. Entrar a <http://petcore.local> e iniciar sesión con un usuario de prueba
   (ver [Datos de prueba](#datos-de-prueba)), por ejemplo
   `ana.cliente@petcore.com` / `Password123!`.

**Sin navegador** (con `minikube tunnel` corriendo):

```bash
curl -s -H "Host: petcore.local" http://127.0.0.1/api/health
```

Resultado esperado: `{"status":"ok"}`.

**Swagger de la API** (en otra terminal, dejarla abierta):

```bash
kubectl port-forward svc/api 8000:8000 -n petcore
```

Abrir <http://localhost:8000/docs>.

### 9. Actualizar, volver atrás y borrar

| Acción | Comando |
| --- | --- |
| Aplicar cambios de la chart o de los values | `helm upgrade petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml` |
| Reconstruir las imágenes después de cambiar código | `bash scripts/4to_entregable/preparar-chart.sh` y luego `kubectl rollout restart deployment -n petcore` |
| Ver el historial de versiones | `helm history petcore -n petcore` |
| Volver a la versión anterior | `helm rollback petcore -n petcore` |
| Desinstalar la app | `helm uninstall petcore -n petcore` |
| Borrar también los datos de PostgreSQL | `kubectl delete pvc --all -n petcore` |
| Borrar todo el namespace | `kubectl delete namespace petcore` |

`helm uninstall` no borra el disco de PostgreSQL, a propósito, para no perder
datos. Los SQL de `db/init/` solo se ejecutan cuando ese disco está vacío: para
volver a cargar los datos de prueba hay que borrar el PVC.

### 10. Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `WSL ... execvpe(/bin/bash) failed` | El script se ejecutó desde PowerShell | Usar Git Bash |
| `helm install` falla con "Faltan recursos en el namespace" | No se ejecutó el paso 5 | Ejecutar `bash scripts/4to_entregable/preparar-chart.sh` |
| Pod en `ErrImageNeverPull` | La imagen no está construida dentro de minikube | Ejecutar el paso 5 |
| `minikube status` muestra un error o `Stopped` | minikube está apagado o su contenedor se borró | `minikube start --driver=docker` |
| <http://petcore.local> no abre | Falta `minikube tunnel` o la línea en `hosts` | Revisar el paso 8 |
| El login falla después de cambiar `db/password.txt` | PostgreSQL guardó la contraseña anterior en su disco | `helm uninstall`, `kubectl delete pvc --all -n petcore` y volver a los pasos 5 y 6 |

## Ejecutar con Kubernetes y Minikube

Esta configuración permite ejecutar PostgreSQL, FastAPI y el frontend dentro de un clúster local de Kubernetes. También implementa un despliegue Blue/Green que mantiene las versiones `v1` y `v2` ejecutándose al mismo tiempo.

### Requisitos de Kubernetes

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

### Iniciar o comprobar Minikube

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

### Preparación local

Antes de ejecutar los scripts, crear los siguientes archivos como se explica en las secciones anteriores:

```text
db/password.txt
db/jwt-secret.txt
```

Estos archivos son locales, no se guardan en Git y cada integrante debe crear los suyos.

### Versiones utilizadas

| Versión | Rama | Imágenes | Deployments |
| --- | --- | --- | --- |
| Blue | `blue` | `clinica-veterinaria:v1` y `clinica-frontend:v1` | `api-blue` y `frontend-blue` |
| Green | `green` | `clinica-veterinaria:v2` y `clinica-frontend:v2` | `api-green` y `frontend-green` |

La rama `blue` conserva la primera versión. La rama `green` contiene las funcionalidades nuevas y la infraestructura necesaria para ejecutar ambas versiones.

### Paso 1: levantar Blue

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

### Paso 2: acceder y probar Blue

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

> No ejecutar `docker compose up` durante esta prueba. Docker Compose crea otro ambiente independiente y no participa en el despliegue Blue/Green.

### Paso 3: desplegar Green junto a Blue

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

### Paso 4: comprobar Blue y Green

Mostrar los Pods y su versión:

```powershell
minikube kubectl -- get pods -L version --namespace=clinica-veterinaria
```

Se deben ver simultáneamente `api-blue`, `api-green`, `frontend-blue`, `frontend-green` y `postgres-0`.

Mostrar las imágenes utilizadas:

```powershell
minikube kubectl -- get deployments api-blue api-green frontend-blue frontend-green --namespace=clinica-veterinaria -o "custom-columns=DEPLOYMENT:.metadata.name,IMAGEN:.spec.template.spec.containers[*].image,DISPONIBLES:.status.readyReplicas"
```

### Paso 5: cambiar el tráfico a Green

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

### Paso 6: acceder y probar Green

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

> No ejecutar `docker compose up` durante esta prueba. Docker Compose crea otro ambiente independiente y no levanta ni modifica los Pods de Kubernetes.

### Paso 7: realizar rollback a Blue

Si Green presenta un problema, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-switch-blue.ps1
```

Este script devuelve los selectores de ambos Services a `version: blue`. El rollback no necesita reconstruir imágenes, eliminar Green ni reiniciar PostgreSQL. Los túneles pueden permanecer abiertos: al actualizar el navegador, los mismos Services dirigirán las solicitudes nuevamente a Blue.

> [!NOTE]
> Si quiere ver inmediatmaente el cambio, debe de desactivar el cache del navegador web. En caso de no desactivarlo puede tardar unos minutos en que la pagina cargue.

### Base de datos compartida

Blue y Green utilizan el mismo StatefulSet de PostgreSQL y el mismo volumen persistente. No existe un volumen diferente para cada versión y el volumen no se guarda en Git.

Los archivos de `db/init/` permiten reconstruir la base inicial en un volumen nuevo. Las modificaciones de base realizadas para Green deben ser compatibles con Blue para que el rollback continúe funcionando.

## Monitoreo con Prometheus y Grafana

> Documento completo (qué se mide, por qué, arquitectura y cómo probar cada parte) en
> [`ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md`](ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md).
> Esta sección es solo cómo levantarlo y entrar.

### No depende de Blue/Green

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

### Acceder al dashboard

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
> antes. No es un bug — es el mismo motivo por el que el dashboard y el datasource
> aparecen solos (se vuelven a provisionar desde los ConfigMaps en cada arranque). Si
> alguna vez Grafana no te deja entrar con ninguna contraseña, reseteala directo:
> `minikube kubectl -- exec deploy/grafana --namespace=clinica-veterinaria -- grafana cli admin reset-admin-password <nueva>`.

> Si alguna vez hace falta entrar directo a la UI de Prometheus para debuggear un scrape
> target, se hace puntualmente con:
> `minikube kubectl -- port-forward svc/prometheus 9090:9090 --namespace=clinica-veterinaria`
> y abriendo `http://localhost:9090` en el navegador.

Para probar la API de monitoreo directamente (Swagger, sin pasar por Grafana):

```powershell
minikube service api-monitoring --namespace=clinica-veterinaria --url
```

### Generar actividad real para ver los paneles y las alertas moverse

**Importante**: el frontend de Blue/Green (el de siempre, `localhost:8080`) habla con la
API de Blue/Green, **no** con `api-monitoring`. Nada de lo que hagas ahí va a aparecer en
Grafana. Para eso existe `frontend-monitoring`: la misma app, pero ya apuntada a
`api-monitoring` — `scripts\k8s-up-monitoring.ps1` lo construye y lo despliega solo, no
hace falta ningún paso manual. Para abrirlo:

```powershell
minikube service frontend-monitoring --namespace=clinica-veterinaria --url
```

Abrir la URL que muestra — es la app de siempre (entrar, reservar turnos, cancelar,
registrar un cliente, fallar un login a propósito, etc.), pero esta copia sí está
conectada a la API que Prometheus observa.

Guía paso a paso completa (incluye cómo disparar cada alerta a propósito, qué esperar ver
en cada panel, y qué hacer si algo muestra "No data") en
[`ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md`](ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md).

### Qué hay hoy y qué falta

Grafana ya arranca con el dashboard **"Pet-Core — Monitoreo"** armado (carpeta "Pet-Core"),
con 10 paneles: turnos creados, logins fallidos, tasa de requests por endpoint, latencia
p95 por endpoint, errores 5xx, turnos cancelados, clientes nuevos registrados, CPU y RAM
del pod, y la correlación entre latencia del endpoint y duración de la query a Postgres —
todo provisionado como código, sin clickear nada en la UI. **Las 2 reglas de alerta
también están implementadas y verificadas llegando a `Firing` con datos reales**
(turnos > 10 en 5 min, logins fallidos > 3 en 1 min).

Lo único que queda pendiente es reunir capturas reales del dashboard y de una alerta en
`Firing`, y cerrar el informe final — ver
[`ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md`](ENTREGABLE_2_GRAFANA_PROMETHEUS_MONITOREO_Y_ALERTAS.md#qué-queda-pendiente).

## DevSecOps y reproducción de pruebas

Esta guía permite repetir las pruebas documentadas en el [Entregable 3 DevSecOps](ENTREGABLE_3_DEVSECOPS.md). El informe contiene las explicaciones y los resultados obtenidos; aquí se reúnen las instrucciones de ejecución y los resultados esperados.

El recorrido es: preparar las herramientas y claves locales, revisar el código, analizar las imágenes, desplegar el entorno de monitoreo, validar las políticas y comprobar Falco. Los enlaces de preparación remiten a los pasos generales del README sin repetirlos aquí.

### Preparar el entorno para las pruebas DevSecOps

Los pasos siguientes están pensados para Windows de 64 bits y PowerShell. Ejecutar los comandos desde la raíz del repositorio. Primero comprobar cada herramienta: si ya está instalada y funciona, no hace falta volver a instalarla. Después de una instalación, cerrar y volver a abrir PowerShell para que reconozca los nuevos comandos.

#### 1. Usar el clúster local

La instalación de Minikube ya está explicada en [Requisitos de Kubernetes](#requisitos-de-kubernetes), y su inicio y verificación en [Iniciar o comprobar Minikube](#iniciar-o-comprobar-minikube). Completar esos pasos si todavía no se hicieron. Para estas pruebas alcanza con tener el nodo en estado `Ready`; no hace falta desplegar Blue ni Green.

Los comandos de esta guía usan `minikube kubectl --`, incluido con Minikube.

Helm debe apuntar al mismo clúster. Comprobar el contexto y seleccionarlo si hace falta:

```powershell
minikube kubectl -- config current-context
minikube kubectl -- config use-context minikube
```

El contexto utilizado para estas pruebas es `minikube`.

#### 2. Helm

Helm instala Kyverno y Falco dentro del clúster. Comprobar si ya está disponible:

```powershell
helm version
```

Para utilizar la misma versión de Helm 3 empleada en las pruebas, descargar el binario oficial para Windows y agregar su carpeta a la lista de ubicaciones donde Windows busca comandos (`PATH`):

```powershell
$helmFolder = Join-Path $env:USERPROFILE 'tools\helm'
$helmArchive = Join-Path $env:TEMP 'petcore-helm-v3.21.0.zip'
$helmExtract = Join-Path $env:TEMP 'petcore-helm-v3.21.0'
New-Item -ItemType Directory -Force -Path $helmFolder | Out-Null
Invoke-WebRequest -Uri 'https://get.helm.sh/helm-v3.21.0-windows-amd64.zip' -OutFile $helmArchive
Expand-Archive -LiteralPath $helmArchive -DestinationPath $helmExtract -Force
Copy-Item -LiteralPath (Join-Path $helmExtract 'windows-amd64\helm.exe') -Destination $helmFolder -Force
[string]$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $helmFolder) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $helmFolder), 'User')
}
$env:Path = $helmFolder + ';' + $env:Path
helm version
```

El resultado debe identificar Helm `v3.21.0`. Este procedimiento sigue la [instalación mediante binarios oficiales de Helm](https://helm.sh/docs/v3/intro/install/).

#### 3. Node.js y npm

Node.js y npm se utilizan para instalar las dependencias del frontend y ejecutar `npm audit`. Comprobar ambos:

```powershell
node --version
npm --version
```

Si no están instalados, usar el instalador **LTS** de la [página oficial de Node.js](https://nodejs.org/en/download). npm viene incluido con esa instalación, como explica la [guía de npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/). También se puede instalar Node.js LTS con el paquete de Windows:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

Después de abrir una terminal nueva, repetir los comandos de versión. Para las pruebas del frontend, instalar las dependencias registradas en el proyecto con `npm ci`, como se muestra en el apartado de seguridad del código.

Si PowerShell bloquea `npm.ps1`, usar `npm.cmd` en su lugar, por ejemplo `npm.cmd --version` y `npm.cmd ci`. Esto permite ejecutar npm sin cambiar la configuración de seguridad de PowerShell.

#### 4. KubeLinter

KubeLinter revisa los archivos YAML de Kubernetes. Comprobar si está instalado:

```powershell
kube-linter version
```

Si falta, descargar el ejecutable oficial de la versión `0.8.3`, utilizada para el reporte del proyecto:

```powershell
$kubeLinterFolder = Join-Path $env:USERPROFILE 'tools\kube-linter'
New-Item -ItemType Directory -Force -Path $kubeLinterFolder | Out-Null
Invoke-WebRequest -Uri 'https://github.com/stackrox/kube-linter/releases/download/v0.8.3/kube-linter.exe' -OutFile (Join-Path $kubeLinterFolder 'kube-linter.exe')
[string]$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $kubeLinterFolder) {
    [Environment]::SetEnvironmentVariable('Path', ($userPath.TrimEnd(';') + ';' + $kubeLinterFolder), 'User')
}
$env:Path = $kubeLinterFolder + ';' + $env:Path
kube-linter version
```

La salida debe mostrar la versión `0.8.3`. El ejecutable proviene de la [publicación oficial de KubeLinter](https://github.com/stackrox/kube-linter/releases/tag/v0.8.3), siguiendo su [guía de instalación](https://docs.kubelinter.io/).

#### 5. Herramientas que no se instalan directamente en Windows

| Herramienta o servicio | Cómo se prepara |
|---|---|
| Semgrep y Trivy | Los comandos de análisis descargan y ejecutan sus imágenes con Docker. |
| Kyverno | Se instala con los comandos de Helm del apartado de seguridad en Kubernetes. |
| Falco | Lo instala el script `scripts/k8s-up-falco.ps1`, también llamado por el script de monitoring. |
| FastAPI, PostgreSQL, Nginx, Prometheus y Grafana | Se construyen o descargan como imágenes y se despliegan mediante `scripts/k8s-up-monitoring.ps1`. |

No hace falta instalar Python o PostgreSQL directamente en Windows para este recorrido con Docker y Kubernetes. Para el desarrollo local con Python, la instalación de `uv` ya está explicada en [Instalar uv para desarrollo local](#instalar-uv-para-desarrollo-local).

#### 6. Comprobar los archivos locales y preparar los reportes

La creación de las claves está explicada en [Configurar la contraseña de PostgreSQL](#configurar-la-contraseña-de-postgresql) y [Configurar la clave secreta JWT](#configurar-la-clave-secreta-jwt). Si ya se crearon, conservar los archivos existentes; no hace falta generarlos otra vez.

Comprobar que ambos están disponibles y preparar la carpeta de reportes:

```powershell
Test-Path .\db\password.txt
Test-Path .\db\jwt-secret.txt
New-Item -ItemType Directory -Force -Path .\reports\entregable-3 | Out-Null
```

Los dos primeros comandos deben devolver `True`. Si alguno devuelve `False`, completar la sección de configuración correspondiente antes de continuar.

La preparación está completa cuando el nodo de Minikube está `Ready`, Helm, Node/npm y KubeLinter muestran sus versiones y existen los dos archivos de claves. A continuación se pueden ejecutar las pruebas. Los comandos de análisis escriben los reportes finales en `reports/entregable-3/`; los archivos iniciales se conservan para comparar.

### Revisar la seguridad del código

Estos comandos repiten la revisión de las dependencias del frontend y del código propio. Las salidas se guardan como reportes finales; los archivos iniciales se conservan para mantener la comparación.

```powershell
cd frontend
npm ci
cmd /c "npm audit > ..\reports\entregable-3\npm-audit.txt"
cd ..

docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep --config auto --output /src/reports/entregable-3/semgrep.txt /src/app /src/frontend/src
```

### Analizar las imágenes

Primero se reconstruyen las imágenes con los Dockerfile actuales y después se analizan con Trivy. Se busca que los reportes correspondan al contenido construido con los cambios, no a una imagen anterior.

```powershell
New-Item -ItemType Directory -Force -Path .\reports\entregable-3 | Out-Null
$reportsPath = (Resolve-Path .\reports\entregable-3).Path

docker build --pull --no-cache -t clinica-veterinaria:test .
docker build --pull --no-cache -f .\frontend\Dockerfile.k8s --build-arg NGINX_CONF=nginx-monitoring.conf -t clinica-frontend:test .\frontend

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$($reportsPath):/reports" -v petcore-trivy-cache:/root/.cache/ aquasec/trivy:0.76.1 image --image-src docker --scanners vuln --severity HIGH,CRITICAL --format table --output /reports/trivy-backend.txt clinica-veterinaria:test
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$($reportsPath):/reports" -v petcore-trivy-cache:/root/.cache/ aquasec/trivy:0.76.1 image --image-src docker --scanners vuln --severity HIGH,CRITICAL --format table --output /reports/trivy-frontend.txt clinica-frontend:test
```

### Validar la seguridad en Kubernetes

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

### Probar la detección de Falco

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

### Comprobar el estado y los usuarios de los servicios

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

## Datos de prueba

La primera vez que se levanta el proyecto (con el volumen de PostgreSQL vacío), se cargan usuarios y datos de ejemplo desde `db/init/04_datos_prueba.sql`.

La contraseña de todos los usuarios de prueba es `Password123!`:

| Correo | Rol |
| --- | --- |
| ana.cliente@petcore.com | CLIENTE |
| bruno.vet@petcore.com | VETERINARIO |
| carla.admin@petcore.com | ADMINISTRADOR |

> *Aclaración:* El rol administrador no tiene panel implementado en la rama Blue. En Green se agregó una ruta /admin con un aviso de "en construcción" para evitar que el login quede en un estado inconsistente.

También incluye 2 mascotas, 3 tipos de atención, la disponibilidad semanal del veterinario y un turno ya agendado.

Si el volumen ya existía antes de agregar este archivo, hay que recrearlo para que los datos se carguen:

```powershell
docker compose down
docker volume rm clinica_veterinaria_devops_postgres_data
docker compose up
```

## Proteger endpoints con el middleware

El middleware JWT debe estar registrado en `app/main.py`:

```python
from app.Middleware.middleware import JWTMiddleware

app.add_middleware(JWTMiddleware)
```

Para proteger un endpoint, importar `Depends` y `requerir_rol`:

```python
from fastapi import Depends

from app.Middleware.middleware import requerir_rol
```

Ejemplo de endpoint exclusivo para administradores:

```python
@app.get(
    "/",
    dependencies=[
        Depends(
            requerir_rol("ADMINISTRADOR")
        )
    ],
)
def hello() -> str:
    return "Hello, administrador!"
```

Los roles disponibles son:

```text
ADMINISTRADOR
CLIENTE
VETERINARIO
```

Una ruta pública no debe incluir `requerir_rol`. El endpoint `/auth/login` debe permanecer público.

Para acceder a una ruta protegida se debe enviar el token obtenido en el login:

```http
Authorization: Bearer ACCESS_TOKEN
```
