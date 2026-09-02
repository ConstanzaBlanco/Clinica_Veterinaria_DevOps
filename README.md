# Pet-Core - Demostración de tácticas de arquitectura

Este proyecto utiliza una API REST desarrollada con FastAPI para demostrar tácticas de disponibilidad y seguridad. La demostración de disponibilidad combina replicación de la API, balanceo mediante Nginx y reintentos cuando una réplica no responde.

## Índice

- [Requisitos](#requisitos)
- [Preparación local](#preparación-local)
- [Levantar la aplicación](#levantar-la-aplicación)
- [Estructura](#estructura)
- [Importar las peticiones en Postman](#importar-las-peticiones-en-postman)
- [Demostración manual con Postman](#demostración-manual-con-postman)
- [Demostración de reintentos con Postman](#demostración-de-reintentos-con-postman)
- [Demostración automática](#demostración-automática)
- [Detener la aplicación](#detener-la-aplicación)
- [Datos de prueba](#datos-de-prueba)

## Requisitos

Comprobar que Git y Docker Desktop estén instalados:

```powershell
git --version
docker --version
docker compose version
docker info
```

Docker Desktop debe estar abierto. No es necesario instalar PostgreSQL, FastAPI ni Nginx manualmente.

## Preparación local

Abrir PowerShell en la carpeta del proyecto:

```powershell
cd "C:\ruta\Proyecto_Clínica_Veterinaria"
```

Crear la contraseña local de PostgreSQL:

```powershell
New-Item -ItemType Directory -Force db
Set-Content -Path db/password.txt -Value "CAMBIAR_POR_UNA_CONTRASENA"
```

Crear una clave aleatoria para los tokens JWT utilizando PowerShell:

```powershell
$bytes = New-Object byte[] 32
$generador = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$generador.GetBytes($bytes)
$generador.Dispose()
$jwtSecret = ([BitConverter]::ToString($bytes)).Replace("-", "").ToLower()
Set-Content -Path db/jwt-secret.txt -Value $jwtSecret -NoNewline
```

`db/password.txt` y `db/jwt-secret.txt` contienen información sensible, no se guardan en Git y cada integrante debe crear los suyos.

## Levantar la aplicación

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\andis-up.ps1
```

El script construye las imágenes y levanta PostgreSQL, el frontend, Nginx y dos réplicas de FastAPI.

- Frontend: http://localhost:5173
- API: http://localhost:8000
- Documentación: http://localhost:8000/docs

Comprobar los contenedores:

```powershell
docker compose ps
```

Deben aparecer dos contenedores pertenecientes al servicio `server`.

## Estructura

```text
Postman
   |
   v
Nginx :8000
   |------> FastAPI replica 1 :8000
   |------> FastAPI replica 2 :8000
                       |
                       v
                  PostgreSQL
```

Nginx distribuye las solicitudes entre las réplicas. Si una conexión falla, intenta enviar la solicitud a la otra disponible.

El endpoint de demostración es:

```http
GET /demo/instancia
```

Ejemplo de respuesta:

```json
{
  "instancia": "dc0948ef34a5"
}
```

El valor es el hostname asignado por Docker al contenedor que respondió. Cada réplica tiene uno diferente.

## Importar las peticiones en Postman

1. Abrir Postman y seleccionar **Import**.
2. Seleccionar `postman/Pet-Core-ANDIS.postman_collection.json` y `postman/Re-intentos_Collection.json`.
3. Abrir la colección que se quiera utilizar.
4. Ejecutar primero **Autenticación > Iniciar sesión**. La prueba de Postman guarda automáticamente el token recibido.
5. Ejecutar **Disponibilidad > Identificar instancia**.

La colección utiliza `base_url = http://localhost:8000` y las credenciales del cliente incluido en los datos de prueba. El endpoint de demostración requiere un token válido, pero acepta cualquier rol autenticado.

## Demostración manual con Postman

### 1. Comprobar el balanceo

Levantar la aplicación:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\andis-up.ps1
```

Ejecutar primero **Autenticación > Iniciar sesión** y luego ejecutar varias veces:

```http
GET http://localhost:8000/demo/instancia
```

Las respuestas deben alternar entre dos identificadores porque existen dos contenedores ejecutando la misma API. Nginx utiliza de forma predeterminada un balanceo llamado *round-robin*: envía la primera solicitud a una réplica, la siguiente a la otra y luego vuelve a comenzar. El endpoint devuelve el hostname del contenedor que atendió cada solicitud, por eso se observan dos valores diferentes aunque ambos contenedores ejecuten el mismo código.

Por ejemplo:

```text
Solicitud 1 -> replica 1 -> dc0948ef34a5
Solicitud 2 -> replica 2 -> bdd5ee22fea7
Solicitud 3 -> replica 1 -> dc0948ef34a5
Solicitud 4 -> replica 2 -> bdd5ee22fea7
```

En **Headers** se pueden observar:

```text
X-Upstream-Addr
X-Upstream-Status
```

`X-Upstream-Addr` identifica el servidor interno utilizado y `X-Upstream-Status` muestra el resultado obtenido desde la API.

### 2. Provocar la falla de una réplica

Mostrar los nombres de los contenedores:

```powershell
docker compose ps
```

Detener una réplica, sustituyendo el nombre del ejemplo si fuera diferente:

```powershell
docker stop proyecto_clnica_veterinaria-server-1
docker compose ps -a
```

Una réplica debe aparecer como `Exited` y la otra como `Up`.

### 3. Comprobar la continuidad y los reintentos

Sin recuperar la réplica detenida, volver a ejecutar varias veces en Postman:

```http
GET http://localhost:8000/demo/instancia
```

Las solicitudes deben continuar respondiendo con `200 OK` desde la réplica activa. Cuando Nginx intenta primero acceder a la que acaba de fallar, los encabezados pueden mostrar:

```text
X-Upstream-Status: 502, 200
```

Esto indica que el primer intento falló y el siguiente fue atendido por la otra réplica. Si Nginx ya marcó temporalmente la réplica como no disponible, puede aparecer directamente `200`.

La evidencia conjunta es:

- Docker muestra una réplica detenida;
- Postman continúa recibiendo `200 OK`;
- el cuerpo identifica la réplica activa;
- los encabezados muestran el servidor utilizado y, cuando ocurre, el reintento.

### 4. Recuperar las dos réplicas

```powershell
docker compose up -d --scale server=2 server
docker compose up -d --no-deps --force-recreate balanceador
docker compose ps
```

## Demostración de reintentos con Postman

Esta demostración utiliza la colección **Pet-Core Re-intentos**, guardada en `postman/Re-intentos_Collection.json`.

Las peticiones están numeradas en el orden en que deben ejecutarse:

1. **Iniciar sesion** autentica al cliente y guarda automáticamente el JWT en `access_token`.
2. **Simular fallas de conexion** configura cinco fallas mediante `POST /debug/simular-falla-conexion?veces=5`.
3. **Ejecutar operacion con reintentos** llama a `GET /mascotas`, que accede a la base de datos y activa la lógica de reintentos.
4. **Consultar ultimo intento** llama a `GET /debug/ultimo-intento-conexion` para observar la información registrada durante la prueba.

### Paso a paso

1. Levantar el ambiente:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\andis-up.ps1
```

2. Importar `postman/Re-intentos_Collection.json` en Postman.
3. Ejecutar **1 - Iniciar sesion** y comprobar que responda `200 OK`. La pestaña **Test Results** debe indicar que el inicio fue correcto.
4. Ejecutar **2 - Simular fallas de conexion**. El parámetro `veces=5` determina cuántas fallas se simulan.
5. Ejecutar **3 - Ejecutar operacion con reintentos**. Esta solicitud intenta obtener las mascotas mientras está activa la simulación.
6. Ejecutar **4 - Consultar ultimo intento** para observar el resultado y la cantidad de intentos registrados.

Las tres peticiones posteriores al login envían automáticamente:

```http
Authorization: Bearer {{access_token}}
```

La colección queda preparada para enviar autenticación en toda la demostración. Cuando se integre el código de los endpoints `debug`, también se debe comprobar que sus controladores validen el usuario actual y respondan `401 Unauthorized` cuando no reciben un token.

> Los endpoints `/debug/simular-falla-conexion` y `/debug/ultimo-intento-conexion` todavía no están presentes en la rama `andis`. La demostración quedará operativa cuando se integre el código correspondiente de la rama de reintentos.

## Demostración automática

La consigna solicita scripts para iniciar la aplicación y demostrar las tácticas:

| Script | Uso |
| --- | --- |
| `scripts/andis-up.ps1` | Construye y levanta el ambiente con dos réplicas. |
| `scripts/demo-replicacion.ps1` | Provoca una falla, comprueba la continuidad y recupera la réplica. |

Ejecutar la demostración automática:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\demo-replicacion.ps1
```

## Detener la aplicación

```powershell
docker compose down
```

Este comando conserva el volumen de PostgreSQL. `docker compose down --volumes` elimina también los datos.

## Datos de prueba

La primera vez que se crea el volumen de PostgreSQL, `db/init/` carga el esquema y los datos de prueba. La contraseña de estos usuarios es `Password123!`:

| Correo | Rol |
| --- | --- |
| `ana.cliente@petcore.com` | Cliente |
| `bruno.vet@petcore.com` | Veterinario |
| `carla.admin@petcore.com` | Administrador |

Para reconstruir la base desde cero:

```powershell
docker compose down --volumes
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\andis-up.ps1
```
