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

> No es necesario instalar PostgreSQL ni FastAPI manualmente. Docker Compose prepara ambos servicios utilizando la configuración del proyecto.

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

## Ejecutar el proyecto

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

Esta configuración permite ejecutar PostgreSQL y la API de FastAPI dentro de un clúster local de Kubernetes.

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

### Iniciar Minikube

Desde la carpeta del proyecto:

```powershell
minikube start --driver=docker
```

Comprobar el estado:

```powershell
minikube status
minikube kubectl -- get nodes
```

### Levantar el proyecto automáticamente

Antes de ejecutar el script, crear `db/password.txt` como se explica en la sección de configuración de PostgreSQL.

Desde la carpeta principal del proyecto, ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up.ps1
```

El script inicia Minikube, construye la imagen Blue `v1`, crea o actualiza los Secrets y el ConfigMap, aplica los manifiestos y espera a que PostgreSQL y FastAPI estén disponibles.

Para obtener una URL local de la API:

```powershell
minikube service api --namespace=clinica-veterinaria --url
```

En Windows con el driver de Docker, mantener abierta la terminal que ejecuta este último comando. Presionar `Ctrl+C` para cerrar solamente el túnel.
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
