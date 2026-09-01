# Pet-Core

## Índice

- [Requisitos](#requisitos)
  - [Instalar uv para desarrollo local](#instalar-uv-para-desarrollo-local)
- [Configurar la contraseña de PostgreSQL](#configurar-la-contraseña-de-postgresql)
  - [Configurar la clave secreta JWT](#configurar-la-clave-secreta-jwt)
- [Ejecutar con Docker Compose (opcional)](#ejecutar-con-docker-compose-opcional)
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

Crear una clave aleatoria para firmar los tokens JWT:

```powershell
$jwtSecret = uv run python -c "import secrets; print(secrets.token_hex(32))"
Set-Content -Path db/jwt-secret.txt -Value $jwtSecret -NoNewline
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

Para detener los contenedores, presionar `Ctrl + C` y ejecutar:

```powershell
docker compose down
```

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

### Base de datos compartida

Blue y Green utilizan el mismo StatefulSet de PostgreSQL y el mismo volumen persistente. No existe un volumen diferente para cada versión y el volumen no se guarda en Git.

Los archivos de `db/init/` permiten reconstruir la base inicial en un volumen nuevo. Las modificaciones de base realizadas para Green deben ser compatibles con Blue para que el rollback continúe funcionando.

## Datos de prueba

La primera vez que se levanta el proyecto (con el volumen de PostgreSQL vacío), se cargan usuarios y datos de ejemplo desde `db/init/04_datos_prueba.sql`.

La contraseña de todos los usuarios de prueba es `Password123!`:

| Correo | Rol |
| --- | --- |
| ana.cliente@petcore.com | CLIENTE |
| bruno.vet@petcore.com | VETERINARIO |
| carla.admin@petcore.com | ADMINISTRADOR |

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
