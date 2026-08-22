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

## Configurar los secretos del proyecto

El proyecto utiliza archivos locales para proporcionar:

- La contraseña de PostgreSQL.
- La clave secreta utilizada para firmar los tokens JWT.

De esta manera, estos valores no se escriben directamente en `compose.yaml`.

Abrir una terminal en la carpeta del proyecto:

```powershell
cd "C:\ruta\Proyecto_Clinica_Veterinaria"
```

Crear la carpeta `db` si todavía no existe:

```powershell
New-Item -ItemType Directory -Force db
```

### Crear la contraseña de PostgreSQL

```powershell
Set-Content -Path db/password.txt -Value "CAMBIAR_POR_UNA_CONTRASENA" -NoNewline
```

Reemplazar `CAMBIAR_POR_UNA_CONTRASENA` por una contraseña local.

### Crear la clave secreta para JWT

Generar una clave aleatoria:

```powershell
$jwtSecret = uv run python -c "import secrets; print(secrets.token_hex(32))"
```

Guardar la clave:

```powershell
Set-Content -Path db/jwt-secret.txt -Value $jwtSecret -NoNewline
```

Comprobar que los archivos fueron creados:

```powershell
Get-ChildItem db
```

Deben aparecer los siguientes archivos:

```text
password.txt
jwt-secret.txt
```

Estos archivos contienen información sensible y no deben guardarse en Git.

El archivo `.gitignore` debe contener:

```gitignore
db/password.txt
db/jwt-secret.txt
.env
```

> Cada integrante del equipo debe crear sus propios archivos `db/password.txt` y `db/jwt-secret.txt` después de descargar el proyecto.

## Ejecutar el proyecto

Construir las imágenes e iniciar los contenedores:

```powershell
docker compose up --build
```

Para ejecutar los contenedores en segundo plano:

```powershell
docker compose up -d --build
```

Posteriormente, ingresar a:

- Estado de la API: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- Documentación interactiva: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

## Configurar el usuario de conexión a PostgreSQL

FastAPI se conecta a PostgreSQL utilizando el usuario técnico:

```text
petcore_app
```

Este usuario es diferente de los clientes, veterinarios y administradores almacenados en la tabla `usuario`.

La primera vez que se inicia el proyecto, entrar a PostgreSQL:

```powershell
docker compose exec db psql -U postgres -d postgres
```

Cuando aparezca:

```text
postgres=#
```

Crear el usuario técnico:

```sql
CREATE USER petcore_app;
```

Asignarle una contraseña:

```sql
\password petcore_app
```

PostgreSQL solicitará la contraseña dos veces. Se debe ingresar exactamente la misma contraseña guardada en:

```text
db/password.txt
```

Asignar los permisos necesarios:

```sql
GRANT CONNECT ON DATABASE postgres TO petcore_app;
GRANT USAGE ON SCHEMA public TO petcore_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO petcore_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO petcore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO petcore_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO petcore_app;
```

Salir de PostgreSQL:

```sql
\q
```

Reiniciar el servidor:

```powershell
docker compose restart server
```

Si PostgreSQL indica que `petcore_app` ya existe, no se debe volver a crear. Solamente se debe actualizar su contraseña:

```sql
\password petcore_app
```

> Cambiar solamente el contenido de `db/password.txt` no cambia la contraseña dentro de PostgreSQL. También debe ejecutarse `\password petcore_app` y reiniciarse el servidor.

## Autenticación y autorización

La aplicación utiliza tokens JWT para identificar al usuario.

Las peticiones a endpoints protegidos deben incluir el encabezado:

```http
Authorization: Bearer ACCESS_TOKEN
```

Los roles disponibles son:

- `ADMINISTRADOR`
- `CLIENTE`
- `VETERINARIO`

Existen cuatro tipos de acceso:

1. Público.
2. Exclusivo para administradores.
3. Exclusivo para clientes.
4. Exclusivo para veterinarios.

## Registrar el middleware

El middleware JWT debe registrarse en `app/main.py`:

```python
from fastapi import FastAPI

from app.Middleware.middleware import JWTMiddleware


app = FastAPI(
    title="Pet-Core API",
)

app.add_middleware(JWTMiddleware)
```

El middleware se encarga de:

- Leer el token del encabezado `Authorization`.
- Verificar la firma.
- Verificar la fecha de vencimiento.
- Verificar el emisor y la audiencia.
- Obtener el identificador y el rol del usuario.

## Endpoint público

Una ruta pública no utiliza `requerir_rol`.

```python
@router.get("/publico")
def endpoint_publico():
    return {
        "mensaje": "Este endpoint es público."
    }
```

El endpoint de login debe ser público:

```python
router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"],
)
```

No se debe proteger todo el router de autenticación:

```python
# Incorrecto
router = APIRouter(
    prefix="/auth",
    dependencies=[
        Depends(
            requerir_rol("ADMINISTRADOR")
        )
    ],
)
```

Esto impediría iniciar sesión sin tener previamente un token.

## Endpoint para administradores

Para proteger un endpoint sin necesitar los datos del usuario:

```python
from fastapi import Depends

from app.Middleware.middleware import requerir_rol


@router.delete(
    "/{id_elemento}",
    dependencies=[
        Depends(
            requerir_rol("ADMINISTRADOR")
        )
    ],
)
def eliminar_elemento(id_elemento: int):
    return {
        "mensaje": "Elemento eliminado."
    }
```

## Endpoint para clientes

Si el controller necesita conocer el usuario autenticado:

```python
from fastapi import Depends

from app.Middleware.middleware import requerir_rol


@router.get("/mis-turnos")
def listar_mis_turnos(
    usuario=Depends(
        requerir_rol("CLIENTE")
    ),
):
    id_usuario = usuario["id_usuario"]

    return {
        "id_usuario": id_usuario,
        "rol": usuario["rol"],
    }
```

## Endpoint para veterinarios

```python
@router.get("/consultas")
def listar_consultas(
    usuario=Depends(
        requerir_rol("VETERINARIO")
    ),
):
    return {
        "id_veterinario": usuario["id_usuario"],
        "rol": usuario["rol"],
    }
```

## Endpoint para más de un rol

Se puede permitir el acceso a varios roles:

```python
@router.get("/historial")
def obtener_historial(
    usuario=Depends(
        requerir_rol(
            "ADMINISTRADOR",
            "VETERINARIO",
        )
    ),
):
    return {
        "usuario": usuario,
    }
```

## Proteger un controller completo

Si todos los endpoints de un controller requieren el mismo rol, se puede proteger el `APIRouter` completo:

```python
from fastapi import APIRouter, Depends

from app.Middleware.middleware import requerir_rol


router = APIRouter(
    prefix="/administracion",
    tags=["Administración"],
    dependencies=[
        Depends(
            requerir_rol("ADMINISTRADOR")
        )
    ],
)
```

Todas las rutas declaradas en ese controller serán exclusivas para administradores.

Para clientes:

```python
router = APIRouter(
    prefix="/clientes",
    tags=["Clientes"],
    dependencies=[
        Depends(
            requerir_rol("CLIENTE")
        )
    ],
)
```

Para veterinarios:

```python
router = APIRouter(
    prefix="/veterinarios",
    tags=["Veterinarios"],
    dependencies=[
        Depends(
            requerir_rol("VETERINARIO")
        )
    ],
)
```

## Respuestas posibles

La autorización puede devolver:

- `401 Unauthorized`: no se proporcionó un token o el token es inválido o está vencido.
- `403 Forbidden`: el token es válido, pero el rol no tiene acceso.
- `200 OK`: el token y el rol son válidos.

## Probar desde Swagger

Ingresar a:

[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Primero ejecutar:

```text
POST /auth/login
```

Copiar el valor de:

```json
"access_token": "TOKEN_GENERADO"
```

Presionar el botón `Authorize` de Swagger e ingresar el token.

Después se pueden ejecutar los endpoints protegidos.

## Detener el proyecto

Si los contenedores están ejecutándose en primer plano, presionar `Ctrl + C`.

Después ejecutar:

```powershell
docker compose down
```

> No utilizar `docker compose down -v` salvo que se quiera eliminar completamente la información guardada en PostgreSQL.