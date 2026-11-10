# Lab 4 — Pet-Core: qué estamos haciendo y cómo funciona

**Fecha:** 9 de noviembre de 2026

## 1. Primero, ¿qué busca este laboratorio?

En este laboratorio no estamos haciendo una aplicación desde 0 ni nada similar. Seguimos trabajando con **Pet-Core**, que es un sistema para una clínica veterinaria. La aplicación tiene una página web, una API y una base de datos.

Lo que busca el entregable 4 es que podamos mostrar cómo se prepara y se mantiene funcionando una aplicación de este tipo. No es solamente que el codigo funcione en nuestra computadora: también tenemos que poder instalarlo, actualizarlo, revisar si está funcionando bien y controlar que no tenga problemas de seguridad.

Para esto mismo se van a utilizar distintas herramientas. Lo bueno de cada una es que tiene un propósito particular para el resultado final.

¿Qué hace cada herramienta y para qué la usamos?

- Docker: nos permite empaquetar una aplicación en una imagen, que es como una plantilla que contiene el código, las dependencias y todo lo necesario para ejecutarla. A partir de esa imagen se crean los contenedores, que son las instancias donde la aplicación realmente se ejecuta. Por ejemplo, podemos tener un contenedor para el frontend, otro para la API y otro para la base de datos. Esto permite que cada parte funcione de la misma manera sin importar en qué computadora o entorno la ejecutemos.

- Kubernetes: es un orquestador de contenedores, es decir, una herramienta que se encarga de administrar cómo se ejecutan y funcionan los contenedores. Permite iniciarlos, controlar que sigan funcionando y mantener la cantidad de instancias que configuramos. Por ejemplo, si un contenedor de la API deja de funcionar, Kubernetes puede detectar el problema y crear uno nuevo para reemplazarlo. También permite organizar los distintos componentes de la aplicación y gestionar cómo se comunican entre sí. En el proyecto lo utilizamos para administrar el frontend, la API y PostgreSQL.

- Helm: es una herramienta que facilita la instalación y administración de aplicaciones en Kubernetes. Permite agrupar los archivos de configuración de una aplicación en un paquete llamado chart, que contiene las instrucciones que Kubernetes necesita para crear y configurar sus recursos. A partir de ese paquete podemos instalar la aplicación, actualizar su configuración o eliminarla. También permite reutilizar los mismos archivos con diferentes configuraciones, por ejemplo, para tener distintos entornos de desarrollo y producción.

- Jenkins: es una herramienta de automatización que permite ejecutar tareas de forma ordenada y automática. Para eso, se definen una serie de pasos, llamados pipeline, que pueden ejecutarse cuando ocurre algún evento, como una actualización del código. Por ejemplo, Jenkins puede descargar el código del repositorio, compilarlo, ejecutar pruebas y realizar controles para comprobar que todo funcione correctamente. Si se cumplen las condiciones establecidas, también puede continuar con el despliegue de la aplicación. De esta manera, evita tener que realizar todos esos pasos manualmente cada vez que se actualiza el proyecto.

- Prometheus: es una herramienta de monitoreo que recopila y almacena métricas sobre el funcionamiento de un sistema. Por ejemplo, permite conocer cuánta memoria y CPU se están utilizando, cuántas solicitudes recibe una API, cuánto demora en responder y cuántos errores se producen. Esta información se va registrando a lo largo del tiempo, lo que permite analizar el comportamiento del sistema, detectar problemas y observar si su rendimiento empeora.

- Grafana: es una herramienta de visualización y monitoreo que permite consultar la información recopilada por herramientas como Prometheus y mostrarla mediante gráficos y paneles. Por ejemplo, podemos crear un panel que muestre cómo varía el uso de CPU y memoria, cuántas solicitudes recibe una API o cuántos errores se producen. Esto permite interpretar las métricas más fácilmente, observar cómo evoluciona el sistema y detectar posibles problemas sin tener que revisar los datos uno por uno.

- Semgrep: es una herramienta de análisis estático de código que permite detectar posibles errores y problemas de seguridad sin necesidad de ejecutar la aplicación. Para eso, analiza el código buscando patrones que puedan representar riesgos, como el uso de funciones inseguras, consultas que podrían permitir una inyección SQL o un manejo incorrecto de datos sensibles. También permite definir reglas propias para buscar problemas específicos. De esta manera, podemos revisar el código e identificar posibles vulnerabilidades antes de que lleguen a la aplicación en funcionamiento.

Refactorizar esto:
- Snyk: se utiliza principalmente para identificar vulnerabilidades en las dependencias que utiliza nuestro proyecto. Muchas veces una aplicación incorpora bibliotecas o paquetes desarrollados por terceros para resolver determinadas funcionalidades. El problema es que esas dependencias también pueden contener vulnerabilidades conocidas. Snyk analiza los paquetes utilizados y los compara con bases de datos de vulnerabilidades para identificar si estamos utilizando alguna versión que tenga problemas de seguridad. Por ejemplo, si nuestra API utiliza una biblioteca que tiene una vulnerabilidad conocida, Snyk puede advertirnos y sugerir una versión corregida. Esto nos permite controlar no solamente la seguridad del código que escribimos nosotros, sino también la de los componentes externos de los que depende Pet-Core.

- Trivy: analiza las imágenes de Docker y otros componentes relacionados con la infraestructura, buscando vulnerabilidades conocidas. Una imagen puede contener el sistema operativo base, herramientas y bibliotecas que necesitamos para ejecutar nuestra aplicación. Aunque nuestro código esté bien escrito, alguno de esos componentes puede tener una vulnerabilidad. Trivy revisa el contenido de la imagen y lo compara con información de vulnerabilidades conocidas para indicarnos qué componentes presentan riesgos y qué tan graves pueden ser esos problemas. Así podemos detectar vulnerabilidades antes de utilizar una imagen para desplegar la aplicación.

- Dive: permite inspeccionar cómo está construida una imagen de Docker, mostrando las distintas capas que la componen y los archivos que se incorporan en cada una. Esto es útil porque una imagen puede terminar incluyendo archivos que realmente no necesitamos, como herramientas de desarrollo, archivos temporales o contenido que quedó de pasos anteriores de la construcción. Con Dive podemos revisar qué contiene la imagen, cuánto espacio ocupa cada capa y si estamos incluyendo elementos innecesarios. A diferencia de Trivy, que se enfoca en encontrar vulnerabilidades, Dive nos ayuda principalmente a entender y optimizar el contenido de las imágenes.

- Kyverno: permite establecer reglas que Kubernetes debe cumplir antes de aceptar determinados recursos. Por ejemplo, podemos definir que los contenedores no puedan ejecutarse como usuario administrador, que las imágenes deban utilizar una política determinada o que ciertos recursos incluyan configuraciones obligatorias. Cuando intentamos crear o modificar un recurso en Kubernetes, Kyverno puede revisar si cumple esas reglas y rechazarlo si no las respeta. Esto es importante porque permite aplicar criterios de seguridad de manera automática, evitando que se desplieguen configuraciones que puedan representar un riesgo para el sistema.

- Falco: permite observar lo que sucede mientras los contenedores y el sistema están funcionando, prestando atención a los eventos que ocurren durante la ejecución. A diferencia de las herramientas que analizan el código o las imágenes antes del despliegue, Falco trabaja sobre el sistema en funcionamiento. Por ejemplo, puede detectar si un contenedor intenta ejecutar un proceso inesperado, acceder a archivos sensibles o realizar determinadas acciones que no deberían formar parte de su comportamiento normal. Cuando identifica un evento que coincide con alguna de sus reglas, genera una alerta para que podamos investigar qué ocurrió. Esto permite detectar comportamientos sospechosos incluso después de que la aplicación ya está desplegada.

La idea general es cubrir distintas etapas: desde revisar el código hasta controlar la aplicación cuando ya está funcionando. A esto se le suele llamar **DevSecOps**: integrar el desarrollo, la operación y la seguridad en el mismo proceso.

## 2. Cómo está formada Pet-Core

Antes de hablar de las herramientas, conviene entender qué partes tiene nuestra aplicación.

Pet-Core se puede separar en tres componentes principales:

1. **Frontend:** es la página que ve y utiliza la persona desde el navegador. Está hecha con React.
2. **API:** recibe las solicitudes del frontend, aplica la lógica del sistema y se comunica con la base de datos. Está hecha con Python y FastAPI.
3. **Base de datos:** utiliza PostgreSQL y guarda la información, por ejemplo, mascotas, turnos y otros datos del sistema.

El recorrido normal sería algo así:

1. Abrimos Pet-Core desde el navegador.
2. El navegador carga el frontend.
3. Cuando hacemos una acción que necesita información, el frontend envía una solicitud a la API.
4. La API procesa esa solicitud y, si necesita consultar o guardar información, se comunica con PostgreSQL.
5. La API devuelve una respuesta y el frontend muestra el resultado.

Por eso, aunque hablemos de tres partes, todas tienen que poder comunicarse entre sí. Si la página no encuentra la API, o la API no encuentra la base de datos, algunas funciones de la aplicación no van a funcionar.

## 3. Qué teníamos y qué nos faltaba

Lo primero que hicimos fue comparar el estado del repositorio con lo que pide la letra del laboratorio. Así pudimos separar lo que ya estaba hecho de lo que todavía teníamos que agregar.

Ya teníamos varias cosas de entregas anteriores:

- Los Dockerfiles para construir las imágenes de la aplicación.
- Parte del monitoreo con Prometheus y Grafana.
- Tres políticas de Kyverno.
- Semgrep y Falco instalados.

En cambio, todavía faltaban partes importantes:

- **Helm:** no teníamos una chart para instalar Pet-Core de forma organizada.
- **Jenkins:** había muy poco preparado para automatizar el proceso.
- **Snyk:** todavía no estaba incorporado.
- **Scripts Bash:** algunos scripts anteriores estaban hechos en PowerShell, pero para esta entrega necesitábamos scripts de Bash.

También había que completar algunos detalles: una cuarta política de Kyverno, reglas propias para Semgrep, un evento distinto para Falco, nuevos paneles de Grafana y los reportes con los nombres y ubicaciones que pide la letra.

Esto es importante porque no todo lo que aparece en el laboratorio lo hicimos desde cero. Parte ya existía y la revisamos o la adaptamos; otra parte sí tuvimos que construirla.

---

## 5. Las herramientas principales, explicadas desde el principio

### 5.1 Docker: preparar la aplicación

Docker permite empaquetar una aplicación junto con lo que necesita para ejecutarse. Ese paquete se llama **imagen**.

A partir de una imagen se crean los **contenedores**, que son las instancias que realmente se ejecutan.

En nuestro caso tenemos imágenes para la API y para el frontend. La idea es que no dependamos de tener instaladas manualmente todas las herramientas y librerías en cada computadora: construimos una imagen y ejecutamos la aplicación a partir de ella.

Una forma simple de pensarlo:

- La imagen es el molde o paquete preparado.
- El contenedor es una ejecución de ese paquete.

Docker se ocupa de construir y ejecutar esos contenedores. Pero cuando tenemos varios componentes y queremos que sigan funcionando, necesitamos algo que los administre. Ahí entra Kubernetes.

### 5.2 Kubernetes: mantener la aplicación funcionando

Kubernetes administra contenedores. En lugar de decirle solamente que ejecute algo una vez, le indicamos cómo queremos que quede el sistema.

Por ejemplo, podemos pedirle que haya una copia de la API y una copia del frontend. Kubernetes intenta mantener ese estado. Si un contenedor deja de funcionar, puede crear otro para reemplazarlo.

En nuestro laboratorio usamos **minikube**, que permite ejecutar un entorno Kubernetes localmente, en nuestra propia computadora. No estamos desplegando en un cluster de producción real: usamos minikube para desarrollar y probar la configuración.

Algunos conceptos de Kubernetes que aparecen en nuestra configuración:

- **Cluster:** es el entorno administrado por Kubernetes. En nuestro caso, minikube nos da un cluster local.
- **Namespace:** sirve para separar recursos dentro del cluster, como si fuera una carpeta. Creamos el namespace `petcore` para mantener agrupados los recursos de nuestra aplicación.
- **Pod:** es la unidad más pequeña que Kubernetes ejecuta. Normalmente contiene uno o más contenedores que trabajan juntos.
- **Deployment:** describe cuántas copias de una aplicación queremos y se encarga de mantener esa cantidad. Lo usamos para la API y el frontend, porque si una instancia se rompe puede ser reemplazada por otra.
- **StatefulSet:** se parece a un Deployment, pero está pensado para aplicaciones que necesitan mantener una identidad y almacenamiento estable. Lo usamos para PostgreSQL, porque la base tiene datos que no podemos perder cuando se reinicia.
- **Service:** ofrece un nombre y un punto de acceso estable para comunicarse con los Pods. Las direcciones internas de los Pods pueden cambiar, pero el Service mantiene un nombre conocido.
- **ConfigMap:** guarda configuración que no es secreta, como el nombre del servicio de base de datos o algunos parámetros de la API.
- **Secret:** guarda información sensible, como contraseñas o claves. No es lo mismo que un ConfigMap, porque su contenido debe tratarse como información confidencial.
- **PVC (PersistentVolumeClaim):** es una solicitud de almacenamiento persistente. En nuestro caso permite que PostgreSQL tenga un disco donde conservar sus datos.
- **Ingress:** define cómo entra el tráfico desde fuera del cluster hacia los servicios de la aplicación. En nuestro caso permite acceder usando `petcore.local`.

### 5.3 Helm: instalar todo sin aplicar archivo por archivo

Antes teníamos varios archivos YAML de Kubernetes y había que aplicarlos por separado, acordándonos del orden correcto. Eso es fácil de hacer mal: podemos olvidarnos de un archivo o intentar levantar un componente antes de que exista algo que necesita.

Helm nos permite agrupar esa configuración en una **chart**. La chart funciona como un paquete que contiene las plantillas de los recursos de Kubernetes y los valores que queremos utilizar.

Para entenderlo, podemos separar tres cosas:

- **`templates/`:** contiene las plantillas. Ahí definimos qué recursos de Kubernetes se tienen que crear, pero dejamos algunos valores preparados para poder cambiarlos.
- **`values.yaml`:** contiene los valores que completan esas plantillas, por ejemplo, la cantidad de copias, las imágenes, los puertos y los recursos de CPU y memoria.
- **Helm:** toma las plantillas y los valores, genera los archivos de Kubernetes completos y los aplica al cluster.

Entonces, si queremos instalar Pet-Core, no tenemos que ejecutar quince comandos distintos. Podemos instalar la chart con un comando y Helm se encarga de gestionar los recursos que forman parte de esa instalación.

Helm también lleva un historial de las instalaciones y actualizaciones. Esto permite:

- `helm install`: instalar la aplicación por primera vez.
- `helm upgrade`: actualizar una instalación existente.
- `helm rollback`: volver a una revisión anterior.
- `helm uninstall`: desinstalar la release.

Una **release** es una instalación concreta de una chart. En nuestro caso la llamamos `petcore`.

La ventaja principal es que tenemos una sola configuración organizada y podemos cambiar sus valores sin tener que modificar todas las plantillas.

### 5.4 Jenkins: automatizar el proceso

Jenkins es una herramienta de automatización. La idea es que ciertas tareas que normalmente haríamos a mano se ejecuten automáticamente siguiendo una secuencia.

Por ejemplo, cuando alguien sube cambios al repositorio, un pipeline de Jenkins puede ejecutar controles, construir imágenes y desplegar la aplicación.

Todavía no es la parte que desarrollamos primero: en el estado de este avance, la chart de Helm era la base que necesitábamos preparar para que Jenkins pudiera utilizarla después.

La relación entre ambos es importante: Helm sabe instalar la aplicación en Kubernetes y Jenkins puede ejecutar los comandos de Helm como parte de un proceso automático. Así no dependemos de que una persona recuerde todos los pasos cada vez.

### 5.5 Prometheus y Grafana: saber cómo está funcionando

No alcanza con instalar la aplicación y asumir que está todo bien. También necesitamos información sobre su funcionamiento.

**Prometheus** recopila métricas de los componentes que puede consultar. Por ejemplo, puede obtener datos sobre el uso de CPU, memoria o el estado de determinados servicios.

**Grafana** utiliza esos datos para mostrarlos en paneles y gráficos. En vez de tener que revisar números sueltos, podemos ver la evolución del sistema y detectar más fácilmente si algo está funcionando mal.

En nuestro proyecto ya teníamos una parte del monitoreo de entregas anteriores. Para este laboratorio había que completar y ajustar paneles. También revisamos que ciertos cambios locales no eliminaran la configuración que permitía observar CPU y memoria.

### 5.6 Herramientas de seguridad: cada una revisa algo distinto

No todas las herramientas de seguridad miran el mismo lugar. Por eso usamos varias.

- **Semgrep:** analiza el código fuente buscando patrones que puedan indicar problemas de seguridad o malas prácticas. También podemos definir reglas propias para revisar situaciones concretas de nuestro proyecto.
- **Snyk:** revisa dependencias y componentes que utiliza el proyecto para detectar vulnerabilidades conocidas. Esto importa porque podemos escribir nuestro código correctamente y aun así usar una librería que tenga un problema de seguridad.
- **Trivy:** puede analizar imágenes de contenedores y encontrar vulnerabilidades en los paquetes que contienen.
- **Dive:** permite inspeccionar cómo está construida una imagen de Docker y ver qué archivos y capas contiene. Sirve para entender si estamos incluyendo cosas que no necesitamos.
- **Kyverno:** aplica políticas sobre los recursos de Kubernetes. Por ejemplo, puede rechazar una configuración que no cumpla las reglas de seguridad que definimos.
- **Falco:** observa eventos mientras el sistema está funcionando. Puede detectar comportamientos que no esperamos, como determinadas acciones dentro de un contenedor.

La diferencia importante es el momento en el que actúa cada herramienta. Semgrep y Snyk revisan el código y sus dependencias; Trivy y Dive miran las imágenes; Kyverno controla los recursos que queremos instalar en Kubernetes; Falco observa lo que sucede durante la ejecución.

La idea de usar varias capas es que un problema que no se detectó en una etapa todavía pueda ser detectado en otra. A eso se le llama **defensa en profundidad**.

---

## 6. Lo que hicimos nosotros: la Helm chart

Esta fue nuestra parte principal hasta este avance. Trabajamos en las tareas T0 a T3 y creamos la carpeta `helm-chart/`.

La chart instala los tres componentes de Pet-Core:

1. La API.
2. PostgreSQL.
3. El frontend.

También crea los recursos necesarios para que puedan comunicarse y para que podamos entrar desde el navegador.

### 6.1 Cómo se comunican los componentes

El recorrido de una solicitud queda así:

1. Entramos desde el navegador a `http://petcore.local`.
2. El **Ingress** recibe esa solicitud y la dirige al frontend.
3. El frontend muestra la aplicación.
4. Cuando necesita consultar o modificar información, envía una solicitud a la API.
5. La API se conecta a PostgreSQL usando el nombre interno `db`.
6. La base responde y la API devuelve el resultado al frontend.

En esta configuración usamos nombres internos como `api` y `db`. Esos nombres corresponden a Services de Kubernetes.

¿Por qué no usamos directamente la dirección IP de cada Pod? Porque los Pods pueden reiniciarse y recibir otra dirección. Si guardáramos esa IP en la configuración, tendríamos que actualizarla cada vez que cambiara. El Service funciona como un nombre estable: la aplicación se conecta a `db` y Kubernetes se encarga de encontrar el Pod correcto.

### 6.2 Por qué la API y la base de datos se crean de manera diferente

La API y el frontend no necesitan conservar una identidad particular. Si una instancia deja de funcionar, Kubernetes puede crear otra. Por eso usamos Deployments.

La base de datos es diferente. PostgreSQL guarda información importante. Si se reinicia, tiene que volver a utilizar el almacenamiento donde están esos datos. Por eso usamos un StatefulSet junto con almacenamiento persistente.

En otras palabras:

- Para la API, lo importante es que haya una instancia funcionando. Puede ser reemplazada por otra.
- Para PostgreSQL, además de que vuelva a funcionar, necesitamos que siga teniendo sus datos.

Si la base arrancara con un disco vacío, perderíamos la información que tenía guardada. Por eso el almacenamiento persistente es una parte fundamental de esta configuración.

### 6.3 Por qué agregamos un contenedor que espera a PostgreSQL

Cuando Kubernetes inicia los componentes, no significa que todos estén listos al mismo tiempo. La API puede intentar arrancar antes de que PostgreSQL esté aceptando conexiones.

Eso nos generaba errores durante el inicio: la API intentaba conectarse, no encontraba la base y fallaba.

Para evitarlo agregamos un **initContainer**, que es un contenedor que se ejecuta antes del contenedor principal del Pod. Su trabajo es consultar cada cierto tiempo si la base de datos ya responde.

Cuando PostgreSQL está disponible, el contenedor de espera termina y Kubernetes puede iniciar la API.

Esto no reemplaza los controles de salud de la API. Resuelve otro problema: evita que la API intente iniciar antes de que su dependencia principal esté lista.

### 6.4 Los chequeos de salud

También configuramos chequeos para que Kubernetes pueda saber si la API está lista y si sigue funcionando.

Hay dos ideas distintas:

- **Readiness:** indica si la aplicación está preparada para recibir solicitudes. Si todavía no está lista, Kubernetes no debería enviarle tráfico.
- **Liveness:** permite detectar si la aplicación dejó de funcionar correctamente. Si falla este chequeo, Kubernetes puede reiniciar el contenedor.

En nuestra API estos chequeos consultan la ruta `/health`.

Esto ayuda a que Kubernetes no mande solicitudes a una instancia que todavía está arrancando y a que pueda recuperarse si la aplicación se queda trabada.

### 6.5 Por qué tenemos una configuración de desarrollo y otra de producción

No siempre queremos ejecutar la aplicación con los mismos recursos y parámetros.

Cuando trabajamos en nuestra computadora, nos conviene usar una configuración más liviana. En producción, en cambio, buscamos tener más capacidad y algunas opciones más estrictas.

Para resolverlo usamos la misma chart con dos archivos de valores:

| Configuración | Desarrollo (`values-dev.yaml`) | Producción (`values-prod.yaml`) |
|---|---:|---:|
| Copias de la API | 1 | 2 |
| Copias del frontend | 1 | 2 |
| Memoria | Menor | Mayor |
| Disco de PostgreSQL | 1 GB | 5 GB |
| Duración de sesión | 60 minutos | 15 minutos |
| Intentos de login | 10 | 5 |

La idea no es tener dos charts diferentes. Tenemos las mismas plantillas y cambiamos solamente los valores que necesitan ser distintos.

Por ejemplo, en desarrollo usamos una sola copia de la API para no consumir tantos recursos. En producción dejamos dos copias, de modo que si una deja de funcionar la otra pueda seguir atendiendo solicitudes.

Antes de definir dos copias de la API, revisamos que no dependiera de información guardada solamente en la memoria de una instancia. Lo importante se guarda en la base de datos, por lo que otra instancia puede atender las solicitudes.

### 6.6 Por qué las contraseñas no están dentro de la chart

La chart contiene archivos que subimos al repositorio. Por eso no debemos escribir directamente ahí las contraseñas reales.

Si guardáramos una contraseña en un archivo de configuración y lo subiéramos a GitHub, otras personas con acceso al repositorio podrían verla. Además, aunque después la borráramos, podría seguir apareciendo en el historial de Git.

Por eso usamos **Secrets de Kubernetes**. La chart espera que esos Secrets ya existan y hace referencia a ellos, pero no contiene sus valores.

Un script local toma los archivos con las credenciales y crea los Secrets en Kubernetes. Esos archivos con las contraseñas no se suben al repositorio.

La separación queda así:

- La chart indica qué Secret necesita.
- El script crea el Secret.
- Kubernetes guarda el valor y se lo entrega al contenedor cuando corresponde.

### 6.7 Por qué el script prepara cosas antes de instalar la chart

La chart no se encarga de absolutamente todo. Hay algunos elementos que preparamos antes de instalarla, como las contraseñas, los archivos SQL y las imágenes locales.

Para eso creamos `scripts/4to_entregable/preparar-chart.sh`.

El script realiza estos pasos:

1. Comprueba que Docker y minikube estén instalados y que minikube esté iniciado.
2. Crea el namespace `petcore`, si todavía no existe.
3. Crea los Secrets con la contraseña de PostgreSQL y la clave utilizada para los logins.
4. Prepara los archivos SQL que necesita la base de datos.
5. Construye las imágenes de la API y del frontend dentro del entorno de minikube.

La idea es que una persona del equipo pueda ejecutar un único script para dejar preparados los requisitos y después instalar la chart.

También intentamos que el script se pueda ejecutar más de una vez. Si algo ya existe, lo actualiza o comprueba su estado en vez de fallar simplemente porque ya lo habíamos creado.

Lo escribimos en Bash porque la letra pide scripts de ese tipo. Para ejecutarlo en Windows usamos Git Bash, no PowerShell.

### 6.8 Qué pasa con los archivos SQL y los datos de PostgreSQL

Los archivos SQL sirven para preparar la base de datos: crean las tablas y cargan los datos iniciales o de prueba.

No los pusimos dentro de la chart porque ya existen en otra parte del proyecto y no queríamos duplicarlos. Además, Helm no puede leer directamente archivos que estén fuera de la carpeta de la chart de la manera en que lo necesitábamos.

El script se ocupa de preparar esos archivos para que Kubernetes pueda utilizarlos.

Hay un detalle importante: los SQL de inicialización se ejecutan cuando PostgreSQL inicializa por primera vez un directorio de datos vacío. Si la base ya tiene un disco persistente con información, reiniciarla no significa que vuelva a ejecutar todos los SQL desde cero.

También dejamos el disco persistente separado de la instalación de la chart. La intención es evitar que al desinstalar la aplicación se borren accidentalmente los datos de PostgreSQL.

### 6.9 Qué pasa si alguien intenta instalar sin preparar los requisitos

Antes podía pasar que ejecutáramos la instalación sin haber creado las contraseñas o preparado los SQL. Helm podía avanzar, pero después los Pods quedaban sin poder iniciar correctamente.

Para evitar eso agregamos una validación previa. Antes de instalar, la chart comprueba si existen los Secrets y la configuración que necesita.

Si falta algo, se detiene y muestra qué elemento falta y qué script hay que ejecutar.

Esto es mejor que descubrir el problema varios pasos después, cuando Kubernetes ya intentó crear los componentes.

Hay una excepción: cuando usamos `helm template`, Helm solamente genera los manifiestos para revisarlos; no se conecta al cluster. Por eso esa validación que consulta recursos existentes no se ejecuta de la misma manera en ese caso.

---

## 7. Qué contiene cada archivo de la Helm chart

La carpeta quedó organizada de esta forma:

```text
helm-chart/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
└── templates/
    ├── _helpers.tpl
    ├── _validaciones.tpl
    ├── validaciones.yaml
    ├── api-configmap.yaml
    ├── api-deployment.yaml
    ├── api-service.yaml
    ├── postgres-statefulset.yaml
    ├── postgres-service.yaml
    ├── frontend-deployment.yaml
    ├── frontend-service.yaml
    ├── ingress.yaml
    └── NOTES.txt
```

### `Chart.yaml`

Es el archivo que identifica a la chart. Define su nombre, la versión de la chart y la versión de la aplicación que instala.

En nuestro caso centralizamos ahí la versión de la aplicación (`appVersion`). Así evitamos tener que escribir el mismo número en varios archivos y correr el riesgo de que las imágenes queden con versiones distintas.

### `values.yaml`

Tiene los valores que utilizan las plantillas. Por ejemplo:

- Qué imagen utilizar para cada componente.
- Cuántas copias queremos.
- Cuánta CPU y memoria asignar.
- Qué puertos utilizar.
- Qué parámetros de configuración recibe la API.
- Qué nombre tendrá el sitio.
- Con qué usuario se ejecutarán los contenedores.

Es la configuración por defecto. Si queremos cambiar alguno de esos valores, en general podemos hacerlo desde este archivo o desde uno de los archivos específicos del entorno, sin modificar la plantilla.

### `values-dev.yaml` y `values-prod.yaml`

Definen las diferencias entre desarrollo y producción.

No repiten toda la configuración. Solamente indican los valores que cambian con respecto a `values.yaml`.

Por ejemplo, desarrollo utiliza menos recursos y permite sesiones más largas. Producción utiliza más copias, más almacenamiento y parámetros de sesión y login más estrictos.

### `templates/_helpers.tpl`

Contiene funciones de Helm que reutilizamos en otros archivos.

En nuestro caso sirve, entre otras cosas, para generar etiquetas comunes para los recursos. Las etiquetas permiten identificar qué recursos pertenecen a Pet-Core y a qué componente corresponden.

Por ejemplo, un Service puede buscar los Pods que tengan la etiqueta `component=api`. Si escribiéramos esas etiquetas manualmente en muchos archivos, sería más fácil equivocarnos. Al definirlas en un solo lugar mantenemos el mismo criterio.

El guion bajo al principio del nombre indica que es un archivo auxiliar: define funciones, pero no genera por sí mismo un recurso de Kubernetes.

### `templates/_validaciones.tpl` y `templates/validaciones.yaml`

Se encargan de comprobar que estén preparados los recursos que la chart necesita antes de instalar.

El archivo `_validaciones.tpl` contiene la lógica de la comprobación. `validaciones.yaml` hace que esa lógica se ejecute como parte del renderizado de la chart.

Si falta un Secret o la configuración necesaria para PostgreSQL, la instalación se detiene y muestra un mensaje para que sepamos cómo corregirlo.

### `templates/api-configmap.yaml`

Crea el ConfigMap de la API.

Ahí se guardan valores de configuración que no son secretos, como el nombre del servicio de la base de datos, el usuario y algunos parámetros relacionados con las sesiones y los intentos de login.

La API recibe esos valores como variables de entorno. De esta manera podemos cambiar la configuración sin tener que modificar el código de la aplicación.

### `templates/api-deployment.yaml`

Define cómo se ejecuta la API en Kubernetes.

Indica la imagen que se utiliza, cuántas copias queremos, los recursos de CPU y memoria, el usuario con el que se ejecuta y los valores de configuración que recibe.

También incluye algunas decisiones que agregamos:

- Un `initContainer` que espera a que PostgreSQL responda antes de iniciar la API.
- Los chequeos de salud sobre `/health`.
- La configuración para que las instancias vuelvan a tomar los valores si cambia el ConfigMap.
- La ejecución con el usuario `10001`, sin privilegios de administrador y sin permisos adicionales que no necesita.

Esto último es importante para cumplir las políticas de seguridad de Kyverno.

### `templates/api-service.yaml`

Crea el Service llamado `api`, que permite acceder a la API por el puerto `8000`.

El frontend utiliza ese nombre para comunicarse con la API. Por eso tiene que coincidir con la dirección que está configurada en `nginx.conf`.

### `templates/postgres-statefulset.yaml`

Define cómo se ejecuta PostgreSQL.

Además de indicar la imagen de la base de datos, solicita almacenamiento persistente y monta los archivos necesarios para la inicialización.

Usamos un StatefulSet porque la base necesita conservar una identidad y un disco estable. La versión de la imagen está fijada en `18.6`, en lugar de dejar solamente `18`, para que las instalaciones utilicen una versión concreta y no cambien inesperadamente al reconstruirlas.

Un detalle: los scripts SQL de inicialización se ejecutan cuando el directorio de datos está vacío. Si la base ya fue inicializada y tiene datos, no se vuelven a ejecutar automáticamente.

### `templates/postgres-service.yaml`

Crea el Service llamado `db`, que permite que la API encuentre a PostgreSQL por ese nombre en el puerto `5432`.

Es un Service headless, una modalidad que se utiliza junto con StatefulSets para resolver directamente la identidad de sus Pods.

### `templates/frontend-deployment.yaml`

Define cómo se ejecuta el frontend.

La página está construida con React y se sirve mediante Nginx. El Deployment indica qué imagen utilizar, cuántas copias ejecutar y los recursos y permisos del contenedor.

### `templates/frontend-service.yaml`

Crea el Service llamado `frontend`, que permite dirigir el tráfico hacia los Pods del frontend.

El frontend se sirve en el puerto `8080`. Elegimos ese puerto para poder ejecutar Nginx sin necesitar privilegios de administrador: en Linux, los puertos menores a `1024` normalmente requieren permisos especiales.

### `templates/ingress.yaml`

Define la entrada a la aplicación desde el navegador.

Cuando alguien accede a `petcore.local`, el Ingress dirige el tráfico al frontend. Después, el propio frontend se comunica con la API para las solicitudes que correspondan.

Esto evita tener que abrir un túnel distinto para cada componente. También permite tener una dirección de entrada más clara para la aplicación.

Se puede deshabilitar mediante el valor `ingress.enabled`.

### `templates/NOTES.txt`

Es un archivo con instrucciones que Helm muestra al terminar una instalación.

Incluye cómo revisar si los Pods están funcionando, cómo acceder a la aplicación, cómo abrir Swagger y cómo volver a una versión anterior.

La idea es que cualquier integrante del equipo pueda instalar la chart y sepa qué hacer después, sin tener que conocer de memoria todos los comandos.

---

## 8. Cómo probamos que la chart funcionara

No nos quedamos solamente con escribir los YAML. También instalamos la chart en minikube y comprobamos que los componentes pudieran funcionar juntos.

Las pruebas que hicimos fueron:

1. Ejecutamos el script de preparación para dejar listos el namespace, los Secrets, los SQL y las imágenes.
2. Instalamos la chart con Helm en minikube.
3. Revisamos que los Pods de la API, PostgreSQL y el frontend quedaran funcionando.
4. Hicimos un login de prueba contra la API. Funcionó, lo que nos permitió comprobar que la API podía comunicarse con la base y que los datos iniciales estaban disponibles.
5. Actualizamos la instalación con `helm upgrade` para agregar el frontend y los recursos de entrada.
6. Durante la actualización vimos que Kubernetes levantaba la nueva instancia de la API y esperaba a que estuviera lista antes de retirar la anterior.
7. Entramos a la aplicación desde el navegador usando `http://petcore.local`.
8. Abrimos Swagger, que es la interfaz donde podemos consultar y probar los endpoints de la API.
9. Revisamos con Kyverno que los recursos de la chart cumplieran las políticas de seguridad que ya teníamos.

Estas pruebas nos sirven para comprobar distintas cosas: que Helm pueda instalar los recursos, que Kubernetes pueda ejecutarlos, que los componentes se comuniquen y que las reglas de seguridad no rechacen la configuración.

## 9. Otros archivos y cambios que hicimos

Además de la chart, hubo otros cambios para ordenar el repositorio y preparar el resto del laboratorio.

### `scripts/4to_entregable/preparar-chart.sh`

Es el script Bash que prepara minikube antes de instalar la chart.

Comprueba las herramientas necesarias, crea el namespace, prepara los Secrets, carga la configuración SQL y construye las imágenes de la API y del frontend.

Lo ubicamos en `scripts/4to_entregable/` para separar los scripts de este laboratorio de los scripts anteriores, que estaban hechos en PowerShell.

### `scripts/k8s-up-falco.ps1`

Este script ya existía y pertenece al entregable 3. Lo modificamos para que guarde los eventos de Falco de esa entrega en `reports/entregable-3/`.

El motivo es que el Lab 4 necesita generar un reporte nuevo llamado `reports/falco-event.log`. Si seguíamos guardando todo en la misma ubicación, podíamos mezclar los resultados de dos entregas diferentes.

### `.gitattributes`

Agregamos este archivo para indicar cómo Git debe guardar los finales de línea de los archivos `.sh`.

Esto importa porque trabajamos en Windows, pero los scripts se ejecutan con Bash. Windows y Linux pueden representar los finales de línea de forma distinta. Si un script queda con el formato incorrecto, Bash puede mostrar errores extraños, por ejemplo `$'\r': command not found`.

Con esta configuración evitamos que los scripts se guarden con un formato que después dé problemas al ejecutarlos.

### `reports/entregable-3/`

Movimos a esta carpeta los reportes que correspondían al entregable 3 y agregamos un `README.md` para explicar qué contiene.

En total se movieron 13 reportes relacionados con herramientas como Semgrep, Trivy, Kyverno, Falco, KubeLinter y npm audit.

Usamos `git mv` para moverlos, de modo que Git pueda reconocer que son los mismos archivos en otra ubicación y conservar su historial.

La razón principal fue separar los reportes viejos de los nuevos. El Lab 4 pide generar reportes en `reports/`, y algunos tienen nombres parecidos a los anteriores. Si los dejábamos mezclados, podía ser difícil saber a qué entrega pertenecía cada uno.

### `README.md` y `ENTREGABLE_3_DEVSECOPS.md`

Actualizamos las referencias a los reportes que habíamos movido. Había 46 menciones a las rutas anteriores, así que las cambiamos para que apunten a `reports/entregable-3/`.

También revisamos que las rutas mencionadas en los documentos existieran. De lo contrario, la documentación y los comandos del entregable anterior habrían quedado apuntando a archivos que ya no estaban en ese lugar.

### Cambios de monitoreo que revisamos

También revisamos `k8s/api-monitoring-deployment.yaml` y `k8s/prometheus-configmap.yaml`.

Había cambios locales que eliminaban parte de la configuración de seguridad de la API y la lectura de métricas de CPU y memoria. Los corregimos y dejamos esos archivos como estaban en `main`.

Si hubiéramos mantenido esos cambios, Kyverno podía rechazar la API y los paneles de monitoreo podían quedarse sin datos de CPU y memoria.

### La función de historial de peso de las mascotas

También revisamos una funcionalidad de Pet-Core que no desarrollamos nosotros en este trabajo: permite que el veterinario registre el peso de una mascota durante una atención y que el cliente consulte su historial de pesos.

Antes de que se integrara, probamos los nueve tests, compilamos el frontend e hicimos diez pruebas contra la API. Entre ellas comprobamos que un administrador no pudiera consultar ese historial.

Las pruebas funcionaron y la funcionalidad se integró mediante la PR #44. La revisamos porque integrar cambios sin probarlos puede afectar el trabajo del resto del equipo.

---

## 10. Qué probamos y qué problemas aparecieron

Durante el trabajo aparecieron algunos problemas que tuvimos que resolver:

| Problema | Qué estaba pasando | Cómo lo resolvimos |
|---|---|---|
| Al ejecutar `bash script.sh` desde PowerShell aparecía un error relacionado con WSL. | En ese entorno, el comando `bash` no estaba usando el entorno que necesitábamos. | Ejecutamos los scripts desde Git Bash. |
| Helm no podía utilizar directamente los SQL del proyecto. | Los archivos estaban fuera de la carpeta de la chart y no queríamos duplicarlos. | El script prepara esos archivos antes de instalar. |
| Los Pods quedaban trabados si faltaban las contraseñas. | Kubernetes necesitaba Secrets que todavía no existían. | Agregamos una validación previa que indica qué falta. |
| La API fallaba durante el inicio. | Intentaba conectarse a PostgreSQL antes de que estuviera disponible. | Agregamos el initContainer que espera a la base. |
| Un comentario rompía la chart. | Helm interpreta las expresiones `{{ }}` aunque aparezcan en comentarios de las plantillas. | Modificamos el comentario para que no contuviera esa expresión. |
| Swagger no abría correctamente con `minikube service`. | En Windows ese túnel no se comportaba de forma confiable y podía cambiar el puerto. | Utilizamos `kubectl port-forward`. |
| Se agregaron archivos Word por error a un commit. | Se había incluido una carpeta que no correspondía. | Corregimos el commit antes de subirlo a GitHub. |
| Minikube apareció vacío al día siguiente. | El contenedor que utilizaba minikube se había eliminado. | Lo volvimos a crear con `minikube start`. Esto también mostró por qué necesitamos scripts que preparen el entorno desde cero. |

---

## 11. Comandos que usamos y para qué sirve cada uno

Los siguientes comandos los ejecutamos desde Git Bash.

| Qué queremos hacer | Comando |
|---|---|
| Revisar el estado de minikube | `minikube status` |
| Iniciar minikube usando Docker | `minikube start --driver=docker` |
| Preparar los requisitos de la chart | `bash scripts/4to_entregable/preparar-chart.sh` |
| Instalar Pet-Core por primera vez | `helm install petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml` |
| Actualizar una instalación existente | `helm upgrade petcore ./helm-chart -n petcore -f helm-chart/values-dev.yaml` |
| Ver los Pods y actualizar la salida mientras cambian | `kubectl get pods -n petcore -w` |
| Consultar las revisiones de Helm | `helm history petcore -n petcore` |
| Volver a la revisión anterior | `helm rollback petcore -n petcore` |
| Generar los manifiestos sin instalarlos | `helm template petcore ./helm-chart` |
| Revisar la chart en busca de errores comunes | `helm lint ./helm-chart` |
| Abrir Swagger mediante un túnel local | `kubectl port-forward svc/api 8000:8000 -n petcore` |
| Entrar a Swagger después de ejecutar el comando anterior | `http://localhost:8000/docs` |
| Habilitar el acceso local mediante Ingress | `minikube tunnel` |
| Abrir Pet-Core | `http://petcore.local` |

Una aclaración: `helm template` no instala nada. Solamente genera la configuración final a partir de las plantillas y los valores. Es útil para revisar qué produciría Helm antes de aplicarlo.

---

## 12. En qué orden fuimos trabajando

### 8 de noviembre

1. Comparamos el repositorio con la letra del Lab 4 y anotamos qué estaba hecho, qué estaba incompleto y qué faltaba.
2. Revisamos cambios locales en `k8s/` que estaban quitando configuraciones de seguridad y métricas. Dejamos esos archivos como estaban en `main`.
3. Probamos la funcionalidad del historial de peso de las mascotas antes de integrarla. Pasaron los tests, la compilación y las pruebas contra la API.
4. Decidimos trabajar localmente con minikube.
5. Empezamos la chart de Helm, primero con la API y después con PostgreSQL.
6. Repasamos conceptos de Kubernetes como cluster, namespace y Pod.
7. Agregamos las validaciones y el script de preparación.
8. Hicimos la primera instalación real con `helm install`. Los Pods quedaron en estado `Running` y el login de prueba funcionó.
9. Armamos el primer plan de trabajo y la plantilla del informe.

### 9 de noviembre

1. Ordenamos los reportes del entregable 3 dentro de `reports/entregable-3/` y esos cambios se integraron a `main` mediante la PR #45.
2. Cambiamos la organización del trabajo: pasamos de repartir áreas entre personas a manejar tareas con dependencias, desde T0 hasta T25.
3. Pedimos que se avanzara en paralelo con Semgrep (T8) y Snyk (T9), porque esas tareas no dependían de nuestra chart.
4. Completamos la parte del frontend, el Ingress y el contenedor que espera a PostgreSQL. Actualizamos con `helm upgrade` y comprobamos que la aplicación seguía atendiendo durante la actualización.
5. Agregamos las configuraciones de desarrollo y producción y el archivo `NOTES.txt`.
6. Cambiamos la forma de abrir Swagger: en vez de depender de `minikube service`, usamos `kubectl port-forward`.
7. Corregimos un commit que había incluido archivos Word que no correspondían.
8. Escribimos este resumen para dejar documentado qué hicimos y por qué.

---

## 13. Qué nos queda por hacer

En este punto, la parte de Helm estaba prácticamente terminada, pero todavía quedaba cerrar su integración con el resto del equipo:

1. Terminar de subir los últimos cambios de la chart a `main`, actualizar nuestra rama y abrir la Pull Request correspondiente (T3).
2. Continuar con los scripts del laboratorio (T21 y T22): uno para levantar el entorno completo desde cero —minikube, Kyverno, Falco, monitoreo y aplicación— y otro para eliminarlo.
3. Integrar el trabajo del resto del equipo: Semgrep, Snyk, Jenkins, Docker y Dive, Kyverno, monitoreo y Falco.
4. Cuando las partes estén conectadas, ejecutar la prueba final del flujo completo.

La idea es que al final no tengamos que preparar y ejecutar todo manualmente. Queremos que el proceso esté automatizado y que además genere los controles y reportes que pide la entrega.

## 14. Diccionario de términos

- **Imagen:** paquete preparado a partir del cual se crean contenedores.
- **Contenedor:** ejecución de una imagen.
- **Cluster:** entorno de Kubernetes que administra los recursos.
- **Namespace:** separación lógica dentro del cluster. El nuestro se llama `petcore`.
- **Pod:** unidad que Kubernetes ejecuta; contiene uno o más contenedores.
- **Deployment:** mantiene la cantidad deseada de instancias de una aplicación.
- **StatefulSet:** administra aplicaciones que necesitan identidad y almacenamiento estables, como nuestra base de datos.
- **Service:** nombre y punto de acceso estable para encontrar Pods.
- **ConfigMap:** configuración que no contiene información secreta.
- **Secret:** recurso para almacenar información sensible, como contraseñas y claves.
- **PVC:** solicitud de almacenamiento persistente.
- **Ingress:** regla de entrada para acceder a servicios del cluster desde fuera.
- **Chart:** paquete de Helm con plantillas y valores para instalar una aplicación.
- **Release:** instalación concreta de una chart. La nuestra se llama `petcore`.
- **Revisión:** versión de una release. Las actualizaciones van generando nuevas revisiones.
- **Pipeline:** secuencia de pasos automatizados, por ejemplo, controles y despliegue.
- **Métrica:** dato que permite observar el comportamiento del sistema, como CPU o memoria.
- **Vulnerabilidad:** debilidad que podría ser aprovechada para afectar la seguridad.
- **Política:** regla que se debe cumplir. Kyverno permite controlar políticas sobre recursos de Kubernetes.
- **Branch o rama:** línea de trabajo separada del código principal.
- **Commit:** registro de un conjunto de cambios en Git.
- **Pull Request (PR):** propuesta para integrar una rama con otra, que el equipo puede revisar antes de aceptar.

---

## 15. La idea general para quedarse

Lo que estamos haciendo con el Lab 4 es preparar todo lo que rodea a Pet-Core para que no dependa de pasos manuales ni de que alguien esté pendiente de cada detalle.

Docker prepara los componentes; Kubernetes los ejecuta y trata de mantenerlos disponibles; Helm organiza la instalación; Jenkins permitirá automatizar el proceso; Prometheus y Grafana nos ayudan a observar el funcionamiento; y las herramientas de seguridad revisan distintas partes, desde el código hasta lo que sucede cuando la aplicación está corriendo.

Nuestra primera parte fue la chart de Helm. La construimos para poder instalar la API, la base de datos y el frontend como una sola aplicación, con configuraciones diferentes para desarrollo y producción. También agregamos las validaciones y el script que prepara lo que Helm necesita.

En resumen, no estamos cambiando qué hace Pet-Core para el usuario. Estamos trabajando en cómo se instala, cómo se mantiene funcionando, cómo se actualiza y cómo comprobamos que esté funcionando de forma segura.
