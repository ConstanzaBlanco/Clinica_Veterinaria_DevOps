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