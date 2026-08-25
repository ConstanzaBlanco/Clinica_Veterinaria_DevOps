# Arquitectura e infraestructura del proyecto Pet-Core

Este documento explica, en lenguaje sencillo, cómo está organizado el proyecto y cómo se relacionan Docker, Docker Compose, Kubernetes, FastAPI y PostgreSQL.

El objetivo no es explicar cada endpoint, sino entender **cómo se prepara y ejecuta el sistema completo**.

## 1. Idea general

El proyecto tiene tres partes principales:

- **Frontend:** interfaz realizada con React y Vite.
- **API:** backend realizado con Python y FastAPI.
- **Base de datos:** PostgreSQL.

Docker permite empaquetar cada parte con todo lo que necesita para ejecutarse. Docker Compose permite levantar varias partes juntas en una computadora. Kubernetes administra los contenedores como Pods dentro de un clúster.

### Conceptos básicos

| Concepto | Explicación sencilla |
| --- | --- |
| Código fuente | Los archivos escritos por el equipo, por ejemplo los archivos Python de `app/`. |
| Imagen Docker | Una plantilla que contiene el código, Python y las dependencias necesarias. |
| Contenedor | Una instancia en ejecución de una imagen Docker. |
| Pod | La unidad mínima que administra Kubernetes. En este proyecto cada Pod contiene un contenedor principal. |
| Manifiesto | Un archivo YAML que declara cómo queremos que Kubernetes cree un recurso. |
| Service de Kubernetes | Una dirección estable que permite encontrar uno o varios Pods aunque sean reemplazados y cambien de IP. |
| Volumen | Almacenamiento separado del contenedor. Permite conservar datos. |

## 2. Vista general de la estructura

```text
Proyecto_Clínica_Veterinaria/
|
|-- app/                              Código de FastAPI
|   |-- Auth/                         Login, registro y usuario autenticado
|   |-- Middleware/                   Validación de tokens JWT
|   |-- tipos_atencion/               Funcionalidad de tipos de atención
|   |-- config.py                     Lee la configuración del entorno
|   |-- database.py                   Crea la conexión y las sesiones de base de datos
|   `-- main.py                       Punto de entrada de FastAPI
|
|-- db/
|   |-- init/                         SQL ejecutados al crear una base vacía
|   |   |-- 01_schema.sql
|   |   |-- 02_permisos.sql
|   |   |-- 03_excepcion_disponibilidad.sql
|   |   `-- 04_datos_prueba.sql
|   |-- password.txt                  Contraseña local; no se guarda en Git
|   `-- jwt-secret.txt                Clave JWT local; no se guarda en Git
|
|-- frontend/                         Aplicación React y Vite
|   |-- Dockerfile                    Imagen del frontend
|   |-- package.json                  Dependencias generales de JavaScript
|   |-- package-lock.json             Versiones exactas de esas dependencias
|   `-- src/                          Código del frontend
|
|-- k8s/                              Manifiestos de Kubernetes
|   |-- namespace.yaml
|   |-- postgres-service.yaml
|   |-- postgres-statefulset.yaml
|   |-- api-blue-deployment.yaml
|   `-- api-service.yaml
|
|-- scripts/
|   `-- k8s-up.ps1                    Automatiza el inicio en Minikube
|
|-- Dockerfile                        Imagen de la API
|-- compose.yaml                      Entorno local con Docker Compose
|-- pyproject.toml                    Datos y dependencias directas de Python
|-- uv.lock                           Versiones exactas de dependencias de Python
|-- .dockerignore                     Archivos que Docker no recibe al construir
|-- .gitignore                        Archivos que Git no debe guardar
`-- README.md                         Instrucciones para ejecutar el proyecto
```

## 3. Qué hace cada archivo principal

### `Dockerfile`

Construye la imagen Docker de la API. No levanta PostgreSQL ni Kubernetes: solamente define cómo preparar FastAPI.

Su recorrido es el siguiente:

1. `FROM python:3.13-slim` usa una imagen liviana con Python 3.13.
2. `WORKDIR /app` crea o selecciona `/app` como carpeta de trabajo dentro de la imagen.
3. `RUN pip install ... uv` instala `uv` dentro de la imagen.
4. `COPY pyproject.toml uv.lock ./` copia primero la definición de dependencias.
5. `RUN uv sync --locked` instala las versiones exactas registradas en `uv.lock`.
6. `COPY app ./app` copia el código de FastAPI.
7. `EXPOSE 8000` documenta que la aplicación escucha en el puerto 8000. Por sí solo no publica el puerto en Windows.
8. `CMD [...]` define el comando que inicia FastAPI cuando se crea un contenedor desde la imagen.

El resultado es una imagen que puede recibir un nombre como `clinica-veterinaria:v1`. Docker Compose o Kubernetes pueden ejecutar contenedores a partir de ella.

### `.dockerignore`

Cuando se construye una imagen, Docker recibe una carpeta llamada **contexto de construcción**. Este archivo evita enviar elementos que no se necesitan, por ejemplo:

- `.venv`;
- caché de Python;
- `.env`;
- información interna de Git.

Esto reduce el contexto y evita copiar accidentalmente archivos locales dentro de una imagen.

### `pyproject.toml`

Describe el proyecto Python:

- nombre y versión del proyecto;
- versión de Python requerida;
- dependencias directas, como FastAPI, Psycopg, PyJWT y Pydantic Settings.

Es el archivo que se modifica mediante comandos como `uv add nombre-paquete`.

### `uv.lock`

Guarda la resolución completa y las versiones exactas de las dependencias directas y de sus dependencias internas.

Por ejemplo, el equipo declara FastAPI en `pyproject.toml`, pero FastAPI necesita otros paquetes. Es normal que `uv.lock` sea mucho más largo. Su función es que todos instalen el mismo conjunto de versiones.

No se edita manualmente y sí se guarda en Git.

### `.gitignore`

Indica qué archivos locales no deben entrar en los commits. En este proyecto protege especialmente:

- `.venv/`;
- cachés de Python;
- `.env`;
- `db/password.txt`;
- `db/jwt-secret.txt`.

`db/password.txt` y `db/jwt-secret.txt` contienen secretos. Cada integrante debe crear sus propios archivos después de descargar el proyecto.

### `compose.yaml`

Describe el entorno de desarrollo local. Actualmente define tres servicios:

#### Servicio `frontend`

- Construye la imagen usando `frontend/Dockerfile`.
- Publica el puerto `5173` de Vite en el puerto `5173` de Windows.
- Monta `frontend/` dentro del contenedor para mostrar cambios sin reconstruir constantemente la imagen.
- Conserva `node_modules` dentro del entorno del contenedor.

#### Servicio `server`

- Construye la API usando el `Dockerfile` de la raíz.
- Publica el puerto `8000`.
- entrega a `app/config.py` las variables necesarias para encontrar PostgreSQL.
- Le entrega el archivo de contraseña y la clave JWT mediante Secrets.
- Usa `depends_on` con `service_healthy` para esperar a que PostgreSQL acepte conexiones.

La dirección de la base no es `localhost`. Es `db`, porque ese es el nombre del servicio de PostgreSQL dentro de la red de Compose.

#### Servicio `db`

- Usa la imagen oficial `postgres:18`.
- Publica PostgreSQL en `5432:5432` para permitir pruebas desde Windows.
- Lee su contraseña desde `/run/secrets/db-password`.
- Ejecuta los SQL montados en `/docker-entrypoint-initdb.d` cuando encuentra una base vacía.
- Usa `pg_isready` como comprobación de salud.
- Guarda los datos reales en el volumen `postgres_data`.

#### Volumen `postgres_data`

Se encuentra separado del contenedor. Si el contenedor de PostgreSQL se reemplaza, los datos permanecen mientras el volumen no sea eliminado.

Por esa misma razón, los archivos de inicialización SQL no vuelven a ejecutarse cada vez que se reinicia el contenedor.

#### Secrets de Compose

Esta última sección declara de dónde obtiene Docker Compose cada secreto:

- `db-password` se obtiene desde `db/password.txt`.
- `jwt-secret` se obtiene desde `db/jwt-secret.txt`.

En esta sección solamente se define el origen de cada secreto; todavía no se entrega a ningún contenedor.

Después, dentro de cada servicio, la propiedad `secrets` indica cuáles puede utilizar. Docker Compose coloca esos secretos como archivos dentro del contenedor:

- FastAPI recibe `db-password` y `jwt-secret`.
- PostgreSQL recibe solamente `db-password`, porque no necesita la clave JWT.

### `frontend/Dockerfile`

Construye el entorno del frontend:

1. Usa Node 22.
2. Selecciona `/app` como carpeta de trabajo.
3. Copia `package.json` y `package-lock.json`.
4. Ejecuta `npm ci` para instalar versiones exactas.
5. Copia el código restante.
6. Inicia Vite en el puerto 5173.

Actualmente este Dockerfile se usa desde Docker Compose. El frontend todavía no tiene un Deployment ni un Service en Kubernetes.

## 4. Carpeta `app`: cómo se organiza FastAPI

Aunque el foco de este documento es la infraestructura, estos archivos explican qué recibe el contenedor de la API.

### `app/main.py`

Es el punto de entrada. Crea la aplicación FastAPI y registra:

- CORS para permitir solicitudes del frontend local;
- el middleware JWT;
- los routers de login, registro, usuario autenticado y tipos de atención;
- la ruta `/`, utilizada actualmente por la comprobación de disponibilidad de Kubernetes.

### `app/config.py`

Lee variables de entorno y archivos de secretos. Con esos valores:

- obtiene servidor, puerto, usuario, contraseña y base de PostgreSQL;
- construye la dirección de conexión;
- lee la clave usada para firmar y validar JWT;
- lee los límites de intentos y tiempo de bloqueo del login.

Este archivo permite usar el mismo código en Compose y Kubernetes. Lo que cambia es quién proporciona la configuración.

### `app/database.py`

Crea el motor de conexión a PostgreSQL y entrega una sesión a los endpoints que la necesiten.

Las funcionalidades actuales usan esa sesión para ejecutar consultas SQL escritas en los repositorios.

### Carpetas de funcionalidades

Las funcionalidades están separadas en carpetas como `Auth/` y `tipos_atencion/`. Dentro de ellas se sigue esta idea:

| Archivo | Responsabilidad |
| --- | --- |
| `controller.py` | Declara la URL y el método HTTP. Recibe la petición y devuelve la respuesta. |
| `dto.py` | Define qué campos entran o salen y valida su formato. |
| `service.py` | Contiene reglas del negocio y decide qué operación realizar. |
| `repository.py` | Ejecuta las consultas SQL contra PostgreSQL. |

El recorrido habitual es:

```text
Petición HTTP
    -> controller
    -> service
    -> repository
    -> database.py
    -> PostgreSQL
```

La respuesta vuelve en el orden contrario.

## 5. Carpeta `db/init`

Los archivos tienen prefijos numéricos para definir su orden de ejecución:

### `01_schema.sql`

Crea la estructura principal de la base: tablas, claves, restricciones e índices.

### `02_permisos.sql`

Crea o actualiza el usuario de aplicación `petcore_app` usando la contraseña del Secret. Después le entrega los permisos que necesita.

FastAPI se conecta como `petcore_app`, no como el superusuario `postgres`. Esto limita lo que puede hacer la aplicación.

También retira permisos de modificación o eliminación sobre registros que deben conservarse, como la auditoría.

### `03_excepcion_disponibilidad.sql`

Agrega la estructura para ausencias puntuales de veterinarios. Se separó del esquema inicial para representar una ampliación posterior de la base.

### `04_datos_prueba.sql`

Carga datos de desarrollo:

- tres usuarios con distintos roles;
- mascotas;
- tipos de atención;
- disponibilidad;
- un turno de ejemplo.

### Regla importante de inicialización

La imagen oficial de PostgreSQL ejecuta los archivos de `/docker-entrypoint-initdb.d` en orden solamente cuando el directorio de datos está vacío.

Reiniciar un Pod o un contenedor no vuelve a cargar estos SQL porque el volumen conserva la base anterior. Para probar una inicialización completamente nueva es necesario eliminar intencionalmente el volumen. Esa operación también elimina todos sus datos.

## 6. Kubernetes: qué crea cada archivo

Kubernetes recibe archivos YAML declarativos. Cada archivo dice **qué estado queremos** y Kubernetes intenta mantenerlo.

### `k8s/namespace.yaml`

Crea el Namespace `clinica-veterinaria`.

El Namespace agrupa y separa los recursos de este proyecto de otros recursos que puedan existir en el mismo Minikube.

Dentro de él se crean la API, PostgreSQL, los Services, los Secrets y el ConfigMap.

### `k8s/postgres-service.yaml`

Crea un Service interno llamado `db`.

Su selector busca Pods con la etiqueta:

```yaml
app: postgres
```

El StatefulSet asigna esa misma etiqueta al Pod de PostgreSQL. De esa forma, el Service sabe a qué Pod dirigir las conexiones.

`clusterIP: None` lo convierte en un **Headless Service**. Kubernetes no le asigna una IP virtual para balanceo, pero crea el DNS interno necesario para encontrar directamente el Pod.

FastAPI utiliza `db:5432`; no necesita conocer la IP cambiante de `postgres-0`.

### `k8s/postgres-statefulset.yaml`

Crea y administra PostgreSQL mediante un StatefulSet.

Un **StatefulSet** es un recurso de Kubernetes utilizado para administrar aplicaciones que necesitan conservar una identidad y datos estables.

En este proyecto se usa para PostgreSQL.

Los Pods pueden eliminarse y volver a crearse. Si PostgreSQL guardara sus datos solamente dentro del Pod, al reemplazarlo podríamos perder información.

El StatefulSet permite relacionar PostgreSQL con almacenamiento persistente.

Se usa un StatefulSet porque PostgreSQL tiene estado: sus datos deben conservarse aunque el Pod se reemplace.

Sus partes principales son:

- `serviceName: db`: lo relaciona con el Headless Service.
- `replicas: 1`: solicita un Pod de PostgreSQL.
- `selector` y `labels`: permiten que el StatefulSet y el Service reconozcan ese Pod.
- `image: postgres:18`: define la imagen del contenedor.
- `env`: configura la base y le indica dónde está el archivo de contraseña.
- `volumeMounts`: coloca los Secrets, SQL y datos en rutas internas del contenedor.
- `readinessProbe`: ejecuta `pg_isready` para saber si PostgreSQL acepta conexiones.
- `volumeClaimTemplates`: solicita 1 GiB de almacenamiento persistente.

Los tres montajes cumplen funciones diferentes:

| Montaje dentro del contenedor | Procedencia | Uso |
| --- | --- | --- |
| `/run/secrets` | Secret `postgres-secret` | Contraseña de PostgreSQL. |
| `/docker-entrypoint-initdb.d` | ConfigMap `postgres-init` | Archivos SQL de inicialización. |
| `/var/lib/postgresql` | PVC `postgres-data-postgres-0` | Datos reales y persistentes de PostgreSQL. |

`ReadWriteOnce` permite que el volumen sea utilizado para lectura y escritura desde un nodo de Kubernetes a la vez. En este proyecto es suficiente porque Minikube tiene un nodo y PostgreSQL utiliza una sola réplica.

### `k8s/api-blue-deployment.yaml`

Crea y administra el Pod de FastAPI de la versión Blue.

Se usa un Deployment porque la API no guarda sus datos dentro del Pod. Si el Pod se reemplaza, otro puede ejecutar la misma imagen y conectarse a PostgreSQL.

Sus partes principales son:

- `replicas: 1`: solicita una instancia de la API.
- `image: clinica-veterinaria:v1`: utiliza la imagen Blue construida con el Dockerfile.
- `imagePullPolicy: Never`: obliga a utilizar la imagen guardada dentro de Minikube en vez de buscarla en un registro externo.
- etiquetas `app: clinica-api` y `version: blue`: identifican la aplicación y su versión.
- variables `POSTGRES_*`: permiten que `app/config.py` construya la conexión a `db:5432`.
- variables `JWT_*` y `LOGIN_*`: configuran autenticación y bloqueo.
- montajes de Secrets: proporcionan la contraseña y la clave JWT como archivos de solo lectura.
- `readinessProbe`: consulta `/` en el puerto 8000.

La comprobación actual de la API demuestra que FastAPI responde por HTTP. No comprueba directamente una consulta a PostgreSQL.

### `k8s/api-service.yaml`

Crea una dirección estable para acceder a la API.

Es de tipo `NodePort`, por lo que puede exponerse fuera del clúster local. Su selector actual es:

```yaml
app: clinica-api
version: blue
```

Esto significa que solamente envía tráfico a Pods Blue que estén marcados como preparados.

El Service recibe tráfico en su puerto 8000 y lo dirige al puerto llamado `http` del contenedor de FastAPI, que también corresponde al 8000.

## Recursos de Kubernetes creados automáticamente

Algunos son creados por `scripts/k8s-up.ps1` a partir de archivos locales:

| Recurso | Se crea desde | Para qué sirve |
| --- | --- | --- |
| Secret `postgres-secret` | `db/password.txt` | Entrega la contraseña a PostgreSQL y FastAPI. |
| Secret `jwt-secret` | `db/jwt-secret.txt` | Entrega la clave de firma JWT a FastAPI. |
| ConfigMap `postgres-init` | Archivos de `db/init/` | Coloca los SQL dentro del Pod de PostgreSQL. |

Otros son creados automáticamente por Kubernetes:

- El Deployment crea un ReplicaSet.
- El ReplicaSet crea el Pod de FastAPI.
- El StatefulSet crea el Pod `postgres-0` y solicita un PVC.
- Minikube proporciona el PersistentVolume solicitado por el PVC.

## 7. `scripts/k8s-up.ps1`: flujo automatizado

Este script evita que cada integrante tenga que recordar y ejecutar todos los comandos manualmente.

Su recorrido completo es:

1. Comprueba que Docker y Minikube estén instalados.
2. Comprueba que existan los manifiestos, SQL y archivos secretos requeridos.
3. Comprueba que la contraseña no esté vacía y que la clave JWT tenga al menos 32 caracteres.
4. Verifica que Docker Desktop esté funcionando.
5. Inicia Minikube usando Docker como driver.
6. Construye `clinica-veterinaria:v1` dentro de Minikube.
7. Crea el Namespace.
8. Crea o actualiza los Secrets desde los archivos locales.
9. Crea o actualiza el ConfigMap desde `db/init/`.
10. Aplica todos los manifiestos de `k8s/`.
11. Reinicia el Deployment Blue para que use la imagen recién construida.
12. Espera a que PostgreSQL y FastAPI estén preparados.
13. Muestra el estado final de los recursos.

El script puede ejecutarse con:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\k8s-up.ps1
```

El script actualiza los recursos, pero no borra el volumen existente. Por lo tanto, repetirlo no elimina la base ni vuelve a ejecutar automáticamente los SQL de inicialización.

## 8. Flujo completo con Docker Compose

El inicio local se realiza con:

```powershell
docker compose up --build
```

El flujo es:

```text
compose.yaml
    |-- construye el frontend con frontend/Dockerfile
    |-- construye FastAPI con Dockerfile
    `-- descarga o reutiliza postgres:18

PostgreSQL inicia
    -> monta postgres_data
    -> si la base está vacía, ejecuta db/init/*.sql
    -> pg_isready lo marca como saludable

FastAPI inicia
    -> lee los Secrets y variables
    -> encuentra PostgreSQL usando db:5432
    -> queda disponible en localhost:8000

Frontend inicia
    -> queda disponible en localhost:5173
    -> llama a la API en localhost:8000
```

Compose crea automáticamente una red para que los servicios se encuentren por nombre.

## 9. Flujo completo con Kubernetes

```mermaid
flowchart LR
    D[Dockerfile] --> I[Imagen clinica-veterinaria:v1]
    I --> AB[Deployment api-blue]
    AB --> PAPI[Pod FastAPI Blue]

    U[Usuario o Swagger] --> MS[minikube service]
    MS --> SAPI[Service api NodePort]
    SAPI -->|selector version: blue| PAPI

    SP[Secret PostgreSQL] --> PAPI
    SJ[Secret JWT] --> PAPI

    PAPI -->|db:5432| SDB[Service db]
    SDB --> PDB[Pod postgres-0]

    CM[ConfigMap con SQL] --> PDB
    SP --> PDB
    PDB --> PVC[PVC y volumen persistente]
```

Explicado paso a paso:

1. El script construye la imagen Blue desde el Dockerfile.
2. El Deployment usa esa imagen para crear un Pod de FastAPI.
3. El StatefulSet crea `postgres-0` y su almacenamiento persistente.
4. El ConfigMap coloca los SQL dentro de PostgreSQL.
5. El Secret coloca la contraseña dentro de PostgreSQL.
6. Si el volumen está vacío, la imagen de PostgreSQL ejecuta los SQL.
7. El Service `db` permite que FastAPI encuentre PostgreSQL como `db:5432`.
8. FastAPI lee sus variables y Secrets, y crea la conexión.
9. El Service `api` selecciona el Pod cuya versión es `blue`.
10. `minikube service ... --url` crea o muestra una URL local para llegar al Service.
11. Una petición entra por el Service, llega a FastAPI y, si necesita datos, continúa hasta PostgreSQL.

Para obtener la URL:

```powershell
minikube service api --namespace=clinica-veterinaria --url
```

En Windows con el driver Docker, la terminal que mantiene ese túnel debe permanecer abierta.

## 10. Qué le proporciona cada componente al siguiente

| Componente | Consume | Proporciona |
| --- | --- | --- |
| `pyproject.toml` | Decisiones del equipo sobre dependencias | Lista general de paquetes Python. |
| `uv.lock` | `pyproject.toml` y resolución de `uv` | Versiones exactas reproducibles. |
| `Dockerfile` | Código de `app/`, `pyproject.toml` y `uv.lock` | Imagen ejecutable de FastAPI. |
| `compose.yaml` | Dockerfiles, imagen de PostgreSQL, Secrets y SQL | Entorno local completo de tres servicios. |
| `namespace.yaml` | Nombre elegido para el proyecto | Espacio separado dentro del clúster. |
| Secrets | Archivos secretos locales | Contraseña y clave JWT montadas en los Pods. |
| ConfigMap | Archivos de `db/init/` | SQL montados dentro del Pod de PostgreSQL. |
| StatefulSet | Imagen PostgreSQL, Secret, ConfigMap y almacenamiento | Pod estable de PostgreSQL. |
| Service `db` | Pods con `app: postgres` | Nombre estable `db:5432`. |
| Deployment Blue | Imagen `v1`, variables y Secrets | Pod de FastAPI con etiqueta `version: blue`. |
| Service `api` | Pods preparados con etiquetas coincidentes | Punto de entrada estable hacia Blue. |
| `k8s-up.ps1` | Todos los archivos anteriores | Automatización que construye y aplica el entorno. |

## 11. Estado actual de Blue/Green

Actualmente está implementada solamente la infraestructura **Blue**:

- imagen `clinica-veterinaria:v1`;
- Deployment `api-blue`;
- etiqueta `version: blue`;
- Service `api` apuntando a `version: blue`.

Esto deja preparado el mecanismo para agregar Green, pero todavía no constituye un cambio Blue/Green completo.

Cuando la versión 2 esté desarrollada, la idea será:

1. Construir otra imagen, por ejemplo `clinica-veterinaria:v2`.
2. Crear `api-green` con la etiqueta `version: green`.
3. Mantener Blue y Green ejecutándose al mismo tiempo.
4. Probar Green sin enviarle todavía el tráfico principal.
5. Cambiar únicamente el selector del Service `api` de `version: blue` a `version: green`.
6. Aplicar el Service para dirigir las nuevas solicitudes a Green.
7. Si aparece un problema, devolver el selector a Blue.

No es necesario duplicar el código en dos carpetas. Las dos versiones quedan representadas por imágenes Docker distintas.

Para demostrarlo al docente se podrán mostrar:

```powershell
minikube kubectl -- get pods -L version --namespace=clinica-veterinaria
minikube kubectl -- get service api --namespace=clinica-veterinaria -o yaml
```

El primer comando mostrará ambos Pods y sus versiones. El segundo permitirá ver qué versión está seleccionando el Service.

## 12. Diferencia entre Compose y Kubernetes en este proyecto

| Docker Compose | Kubernetes con Minikube |
| --- | --- |
| Pensado para desarrollo local sencillo. | Pensado para practicar orquestación y despliegues. |
| Levanta frontend, API y PostgreSQL. | Actualmente levanta API Blue y PostgreSQL. |
| `compose.yaml` concentra toda la definición. | La configuración se divide en varios manifiestos. |
| Usa contenedores directamente. | Administra los contenedores dentro de Pods. |
| Usa `postgres_data` como volumen nombrado. | Usa PVC y PV para PostgreSQL. |
| Los nombres de servicios permiten la comunicación interna. | Los Services y el DNS interno permiten la comunicación. |
| Usa Secrets definidos en Compose. | Usa objetos Secret del Namespace. |

## 13. Aclaraciones importantes

- Un Dockerfile **construye una imagen**; no crea por sí solo todo el sistema.
- Compose y Kubernetes consumen imágenes, pero organizan su ejecución de forma diferente.
- Un Pod puede ser reemplazado y cambiar de IP; un Service proporciona una dirección estable.
- La API es administrada por un Deployment porque no guarda datos locales importantes.
- PostgreSQL es administrado por un StatefulSet porque necesita identidad y almacenamiento estable.
- Los Secrets no deben quedar escritos en el código ni subirse a Git.
- Un ConfigMap se utiliza para datos no confidenciales, como los SQL de inicialización.
- El PVC permite que los datos sobrevivan al reemplazo del Pod.
- Una readiness probe decide si un Pod está preparado para recibir tráfico; no es lo mismo que una liveness probe.
- Los SQL de inicialización solamente se ejecutan sobre una base vacía.
- `minikube stop` detiene el clúster, pero no está pensado para borrar los datos persistentes.
- La infraestructura de Kubernetes todavía no incluye el frontend ni el Deployment Green.

## 14. Documentación oficial utilizada

Las fuentes se agrupan según la parte del proyecto para la que fueron utilizadas.

### 14.1. FastAPI y administración del proyecto Python

- [Primeros pasos de FastAPI](https://fastapi.tiangolo.com/tutorial/first-steps/): se utilizó para crear la aplicación, levantar el servidor de desarrollo y acceder a la documentación automática en `/docs`.
- [FastAPI dentro de un contenedor Docker](https://fastapi.tiangolo.com/deployment/docker/): se utilizó para definir cómo iniciar FastAPI desde el Dockerfile.
- [Caché durante la construcción de FastAPI](https://fastapi.tiangolo.com/deployment/docker/#docker-cache): se utilizó como referencia para copiar primero los archivos de dependencias y aprovechar la caché de Docker.
- [Iniciar el contenedor de FastAPI](https://fastapi.tiangolo.com/deployment/docker/#start-the-docker-container): se utilizó como referencia para `docker run`, el nombre del contenedor y la publicación del puerto 8000.
- [Proyectos administrados con uv](https://docs.astral.sh/uv/guides/projects/): se utilizó para crear el proyecto y agregar dependencias con `uv add`.
- [Estructura de proyectos y `uv.lock`](https://docs.astral.sh/uv/concepts/projects/layout/): se utilizó para explicar la función de `pyproject.toml`, `.venv` y `uv.lock`.
- [Integración de uv con Docker](https://docs.astral.sh/uv/guides/integration/docker/#installing-uv): se utilizó para instalar y ejecutar uv dentro de la imagen de la API.

### 14.2. Dockerfile, archivos ignorados y Docker Compose

- [Guía oficial de Docker para Python](https://docs.docker.com/guides/python/): se utilizó como referencia para `.gitignore`, `.dockerignore`, la estructura inicial del Dockerfile, el servicio de FastAPI y la conexión con PostgreSQL.
- [Referencia oficial de Dockerfile](https://docs.docker.com/reference/dockerfile/): se utilizó para explicar `FROM`, `WORKDIR`, `RUN`, `COPY`, `EXPOSE` y `CMD`.
- [Modelo de aplicación de Docker Compose](https://docs.docker.com/compose/intro/compose-application-model/): se utilizó para explicar servicios, redes, volúmenes y el funcionamiento general de `compose.yaml`.
- [Servicios de Docker Compose](https://docs.docker.com/reference/compose-file/services/): se utilizó para `build`, `ports`, `volumes`, `environment`, `depends_on` y `healthcheck`.
- [Secrets en Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/): se utilizó para declarar `db-password` y `jwt-secret`, entregarlos solamente a los servicios que los necesitan y montarlos como archivos.
- [Guía oficial de PostgreSQL con Docker Compose](https://docs.docker.com/guides/postgresql/#docker-compose-configuration): se utilizó para definir el servicio `db`, su imagen, puerto, nombre y volumen.

### 14.3. Imagen oficial de PostgreSQL e inicialización de la base

- [Imagen oficial de PostgreSQL](https://hub.docker.com/_/postgres): se utilizó para las variables `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD_FILE` y para montar los SQL en `/docker-entrypoint-initdb.d`.
- [Variables de entorno de la imagen PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md#environment-variables): se utilizó para configurar el contenedor de PostgreSQL.
- [Docker Secrets en la imagen PostgreSQL](https://github.com/docker-library/docs/blob/master/postgres/README.md#docker-secrets): se utilizó para leer la contraseña desde un archivo mediante `POSTGRES_PASSWORD_FILE`.

La documentación de la imagen oficial también establece que los archivos de `/docker-entrypoint-initdb.d` se ejecutan en orden solamente cuando el directorio de datos está vacío. Esta regla explica por qué no se vuelven a ejecutar los SQL al reiniciar un contenedor o Pod que conserva su volumen.

### 14.4. Instalación y preparación de Kubernetes con Minikube

- [Instalar kubectl en Windows](https://kubernetes.io/es/docs/tasks/tools/install-kubectl-windows/#install-on-windows-using-chocolatey-o-scoop): se utilizó para instalar kubectl y comprobar su versión.
- [Comando `minikube version`](https://minikube.sigs.k8s.io/docs/commands/version/): se utilizó para comprobar la instalación de Minikube.
- [Driver Docker de Minikube](https://minikube.sigs.k8s.io/docs/drivers/docker/#verify-docker-container-type-is-linux): se utilizó para comprobar que Docker ejecuta contenedores Linux y para iniciar el clúster con `minikube start --driver=docker`.
- [Comando `minikube status`](https://minikube.sigs.k8s.io/docs/commands/status/): se utilizó para comprobar el estado del clúster.
- [Usar kubectl incluido en Minikube](https://minikube.sigs.k8s.io/docs/handbook/kubectl/): se utilizó para ejecutar comandos mediante `minikube kubectl --` y evitar problemas de diferencia de versiones.
- [Interactuar con el clúster de Minikube](https://minikube.sigs.k8s.io/docs/start/): se utilizó como referencia para consultar nodos y Pods.
- [Construir imágenes dentro de Minikube](https://minikube.sigs.k8s.io/docs/handbook/pushing/#8-building-images-to-in-cluster-container-runtime): se utilizó para construir `clinica-veterinaria:v1` dentro del runtime del clúster.
- [Comandos de imágenes de Minikube](https://minikube.sigs.k8s.io/docs/commands/image/): se utilizó para `minikube image build` y `minikube image ls`.
- [Comando `minikube service`](https://minikube.sigs.k8s.io/docs/commands/service/): se utilizó para obtener una URL local del Service `api`.

### 14.5. Namespace, aplicación de manifiestos y recursos de configuración

- [Crear y consultar Namespaces](https://kubernetes.io/docs/tasks/administer-cluster/namespaces/): se utilizó para crear `namespace.yaml` y comprobar el Namespace `clinica-veterinaria`.
- [`kubectl apply`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/): se utilizó para validar, crear y actualizar los recursos declarados en los manifiestos YAML.
- [`kubectl get`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_get/): se utilizó para consultar Pods, Services, StatefulSets, Deployments, PVC, ConfigMaps y Secrets.
- [`kubectl create secret generic`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_secret_generic/): se utilizó para generar `postgres-secret` y `jwt-secret` desde los archivos locales.
- [Administrar Secrets con kubectl](https://kubernetes.io/docs/tasks/configmap-secret/managing-secret-using-kubectl/): se utilizó para crear y comprobar los Secrets del Namespace.
- [`kubectl create configmap`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_configmap/): se utilizó para generar `postgres-init` desde la carpeta `db/init`.
- [Concepto de ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/): se utilizó para explicar por qué los SQL no confidenciales se almacenan separados de la imagen.
- [Concepto de Secret](https://kubernetes.io/docs/concepts/configuration/secret/): se utilizó para explicar el almacenamiento de contraseñas y claves sensibles fuera de los manifiestos y de la imagen.

### 14.6. Service y StatefulSet de PostgreSQL

- [Services de Kubernetes](https://kubernetes.io/docs/concepts/services-networking/service/): se utilizó para crear el Service `db`, relacionarlo con el Pod mediante etiquetas y explicar el DNS interno `db:5432`.
- [Headless Services](https://kubernetes.io/docs/concepts/services-networking/service/#headless-services): se utilizó específicamente para `clusterIP: None` en `postgres-service.yaml`.
- [Componentes de un StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#components): se utilizó para crear `postgres-statefulset.yaml`, su selector, plantilla y relación con el Service.
- [Plantillas de volúmenes de StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#volume-claim-templates): se utilizó para `volumeClaimTemplates` y la creación del PVC de PostgreSQL.
- [Volúmenes de Kubernetes](https://kubernetes.io/docs/concepts/storage/volumes/): se utilizó para explicar `volumes`, `volumeMounts` y `mountPath`.
- [Volúmenes de tipo Secret](https://kubernetes.io/docs/concepts/storage/volumes/#secret): se utilizó para montar `postgres-secret` como archivo dentro del Pod.
- [Volúmenes de tipo ConfigMap](https://kubernetes.io/docs/concepts/storage/volumes/#configmap): se utilizó para montar `postgres-init` en `/docker-entrypoint-initdb.d`.
- [Volúmenes persistentes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/): se utilizó para explicar PV, PVC, capacidad, persistencia y `ReadWriteOnce`.
- [Probes de Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/probes/): se utilizó para configurar y explicar la `readinessProbe` de PostgreSQL.
- [`pg_isready` de PostgreSQL](https://www.postgresql.org/docs/18/app-pg-isready.html): se utilizó como comando para comprobar si PostgreSQL acepta conexiones.

### 14.7. Pruebas, inicialización limpia y acceso a PostgreSQL

- [`psql` de PostgreSQL](https://www.postgresql.org/docs/18/app-psql.html): se utilizó para ejecutar manualmente SQL, comprobar tablas, verificar el rol `petcore_app` y probar la conexión a la base.
- [Escalar un StatefulSet](https://kubernetes.io/docs/tasks/run-application/scale-stateful-set/): se utilizó para reducir PostgreSQL a cero Pods antes de eliminar de forma controlada su almacenamiento de prueba.
- [`kubectl delete`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_delete/): se utilizó para eliminar el PVC durante la prueba de inicialización limpia. Eliminar el PVC también elimina los datos asociados cuando la política del volumen es `Delete`.
- [`kubectl exec`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_exec/): se utilizó para ejecutar `psql`, `pg_isready` y otros comandos dentro del Pod de PostgreSQL.
- [`kubectl rollout status`](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/): se utilizó para esperar y comprobar que PostgreSQL y FastAPI quedaran disponibles.

### 14.8. Deployment Blue y Service de la API

- [Deployments de Kubernetes](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/): se utilizó para crear `api-blue`, administrar el Pod de FastAPI y mantener la cantidad de réplicas solicitada.
- [Política de descarga de imágenes](https://kubernetes.io/docs/concepts/containers/images/#image-pull-policy): se utilizó para `imagePullPolicy: Never`, ya que la imagen se construye dentro de Minikube y no se descarga desde un registro.
- [Variables de entorno en contenedores](https://kubernetes.io/docs/tasks/inject-data-application/define-environment-variable-container/): se utilizó para entregar la configuración `POSTGRES_*`, `JWT_*` y `LOGIN_*` a FastAPI.
- [Entregar credenciales de forma segura](https://kubernetes.io/docs/tasks/inject-data-application/distribute-credentials-secure/): se utilizó para montar `postgres-secret` y `jwt-secret` dentro del Pod de la API.
- [Readiness, liveness y startup probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/): se utilizó para configurar la comprobación HTTP de disponibilidad de FastAPI.
- [Services de Kubernetes](https://kubernetes.io/docs/concepts/services-networking/service/): se utilizó para crear `api-service.yaml`, exponer la API mediante `NodePort` y dirigir el tráfico utilizando las etiquetas `app` y `version`.

### 14.9. Automatización y preparación de Blue/Green

`scripts/k8s-up.ps1` no fue copiado de una sola página. Reúne en orden los comandos oficiales ya mencionados para construir la imagen, crear los recursos, aplicar los manifiestos y esperar los rollouts.

La preparación de Blue/Green combina dos mecanismos documentados por Kubernetes:

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/): permiten mantener Pods Blue y Green como cargas separadas.
- [Selectores de Services](https://kubernetes.io/docs/concepts/services-networking/service/): permiten decidir si el tráfico se dirige a Pods con `version: blue` o `version: green`.

El diseño Blue/Green explicado en este documento es la aplicación conjunta de esos mecanismos al proyecto. La versión Green todavía no está implementada.
