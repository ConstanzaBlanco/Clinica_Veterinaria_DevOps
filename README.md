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
Set-Content -Path db/password.txt -Value "CAMBIAR_POR_UNA_CONTRASEÑA"
```

Reemplazar `CAMBIAR_POR_UNA_CONTRASEÑA` por una contraseña local.

Comprobar que el archivo fue creado:

```powershell
Get-ChildItem db
```

> El archivo `db/password.txt` contiene información sensible y no debe guardarse en Git. Debe estar incluido en `.gitignore`.
>
> Cada integrante del equipo debe crear su propio archivo `db/password.txt` después de descargar el proyecto.

## Ejecutar el proyecto

Construir las imágenes e iniciar los contenedores:

```powershell
docker compose up --build
```

Posteriormente, ingresar a:

- Estado de la API: http://127.0.0.1:8000/health
- Documentación interactiva: http://127.0.0.1:8000/docs

Para detener los contenedores, presionar `Ctrl + C` y ejecutar:

```powershell
docker compose down
```

