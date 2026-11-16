# Entregable 4 - Análisis de seguridad

En este entregable revisamos posibles problemas en el código y vulnerabilidades conocidas en las dependencias, usando Semgrep y Snyk. Además, completamos las cuatro políticas de Kyverno que pide la letra y armamos tres scripts de bash que levantan, prueban y borran todo el proyecto, cada uno con un solo comando.

## Semgrep (T8)

Creamos dos reglas propias en el archivo .semgrep.yml. La idea fue buscar situaciones que, aunque no sean vulnerabilidades por sí solas, merecen una revisión porque podrían ser riesgosas si el código cambiara más adelante.

- veterinaria-sqlalchemy-text-fstring: detecta consultas SQL armadas dentro de text() usando f-strings, concatenación con + o .format(). En los repositorios hay consultas SQL escritas manualmente, por lo que este tipo de construcción merece atención: si una parte viniera de un usuario, podría abrir la puerta a una inyección SQL.
- veterinaria-jwt-decode-inseguro: detecta usos de jwt.decode sin indicar los algoritmos permitidos o con la verificación de firma desactivada. Esto es relevante porque, si el token no se verificara correctamente, alguien podría intentar usar un JWT falsificado para acceder al sistema.

Ejecutamos Semgrep dentro de Docker para no tener que instalarlo localmente. El script scripts/semgrep.ps1 analiza la carpeta app/ con las reglas de .semgrep.yml y deja la salida en reports/semgrep-report.txt.

Desde la raíz del proyecto se ejecuta con:

    .\scripts\semgrep.ps1

Internamente, el script utiliza:

    docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep --config /src/.semgrep.yml --metrics=off --output /src/reports/semgrep-report.txt /src/app

### Resultado de Semgrep

La regla de SQL encontró cinco coincidencias posibles. Cuatro aparecen en el reporte; la de Mascotas/repository.py no aparece porque ese caso fue revisado y tiene un comentario nosemgrep que evita volver a reportarlo.

No tratamos estos resultados como vulnerabilidades confirmadas. Semgrep marca las consultas porque hay interpolación de texto, pero en estos casos lo que se agrega al SQL es texto fijo definido por el propio código. Los valores que pueden venir del usuario se envían como parámetros, por ejemplo :nombre, para que PostgreSQL los trate como datos y no como parte de la consulta.

| Archivo | Qué se agrega a la consulta | Por qué se considera seguro |
|---|---|---|
| historial (2 casos) | Un filtro fijo por tipo. | El tipo se envía como parámetro. |
| turnos | Un filtro fijo por período: próximos, pasados o todos. | Solo se puede elegir entre tres opciones escritas en el código. |
| pacientes | Filtros de búsqueda definidos por la aplicación. | El nombre y la especie que ingresa el usuario se envían como parámetros. |
| Mascotas | Los nombres de columnas que se pueden editar. | Se validan contra la lista permitida COLUMNAS_EDITABLES. |

La regla de JWT no tuvo coincidencias. El único jwt.decode del proyecto, en app/Middleware/middleware.py, indica los algoritmos permitidos mediante algorithms=[ALGORITMO_JWT] y no desactiva la verificación de firma.

## Snyk (T9)

Snyk revisa si las versiones de las dependencias utilizadas por el proyecto tienen vulnerabilidades conocidas publicadas.

Antes de ejecutar el script se necesita instalar Snyk e iniciar sesión:

    npm i -g snyk
    snyk auth

Para comprobar que la instalación quedó disponible:

    snyk --version

La revisión se ejecuta con:

    .\scripts\snyk.ps1

El script analiza tanto el backend como el frontend y guarda el resultado en reports/snyk-report.txt.

Snyk no puede analizar uv.lock directamente con la cuenta utilizada. Por eso el script exporta sus dependencias a un requirements.txt temporal, conservando las mismas versiones, y analiza ese archivo. Es una forma de revisar el backend sin cambiar el proyecto ni agregar un segundo archivo de dependencias permanente.

### Resultado de Snyk

| Parte revisada | Qué se analizó | Vulnerabilidades encontradas |
|---|---|---|
| Backend | 54 dependencias exportadas desde uv.lock. | 0 |
| Frontend | 71 dependencias de frontend/package.json y package-lock.json, incluidas las de desarrollo mediante --dev. | 0 |

No se encontraron vulnerabilidades conocidas en las dependencias analizadas, por lo que no fue necesario actualizar paquetes como parte de esta revisión.

### Limitaciones

- uvloop no se incluyó en el análisis. Es una dependencia disponible solo en Linux y no pudo instalarse en Windows para que Snyk la revisara. De todos modos, es parte del entorno del contenedor, no de la ejecución local en Windows.
- Un resultado de cero vulnerabilidades no significa que el proyecto sea invulnerable. Snyk compara las versiones instaladas contra vulnerabilidades ya publicadas; una vulnerabilidad nueva podría aparecer más adelante.

En resumen, Semgrep nos permitió revisar patrones del código que podían ser riesgosos y Snyk confirmó que, al momento de la ejecución, no había vulnerabilidades conocidas en las dependencias analizadas.

## Políticas de Kyverno

Kyverno revisa cada recurso que se intenta crear en el cluster y lo rechaza si no cumple las políticas definidas. Del Entregable 3 ya estaban las tres políticas obligatorias; en este entregable se agregó una cuarta, require-probes. Las cuatro están en k8s/policies/. Son de tipo ClusterPolicy, así que aplican en todos los namespaces salvo kube-system, kyverno y falco, y están en modo Enforce: bloquean el recurso en lugar de solo registrarlo.

| Política | Qué exige |
|---|---|
| disallow-latest-tag | Que ninguna imagen use la etiqueta latest. |
| require-resources | Que todo contenedor defina requests y limits de CPU y memoria. |
| disallow-root | Que runAsNonRoot sea true, a nivel de Pod o en todos los contenedores. |
| require-probes | Que todo contenedor declare livenessProbe y readinessProbe. |

Elegimos require-probes como cuarta política porque es una buena práctica de Kubernetes que el proyecto todavía no exigía: con la livenessProbe, Kubernetes reinicia un contenedor que dejó de responder, y con la readinessProbe no le envía tráfico hasta que esté listo. La política tiene una regla para cada probe, así que el mensaje de error indica exactamente cuál falta.

Para validarlas, en k8s/policies/test/ hay un pod de prueba por política que incumple solo esa política (se agregó pod-solo-sin-probes.yaml para la nueva), uno que no cumple ninguna (pod-no-conforme.yaml) y uno que cumple todas (pod-conforme.yaml, al que se le agregaron probes).

### Resultado de Kyverno

| Manifiesto de prueba | Resultado | Políticas que lo rechazaron |
|---|---|---|
| pod-conforme.yaml | Creado | Ninguna |
| pod-no-conforme.yaml | Rechazado | Las cuatro |
| pod-solo-latest.yaml | Rechazado | disallow-latest-tag |
| pod-solo-root.yaml | Rechazado | disallow-root |
| pod-solo-sin-resources.yaml | Rechazado | require-resources |
| pod-solo-sin-probes.yaml | Rechazado | require-probes |

Las cuatro políticas quedaron en estado Ready, y cada pod de prueba fue rechazado solo por la política que incumplía, con un mensaje que la nombra. La salida completa está en reports/kyverno-validation.log. El archivo del Entregable 3 (reports/entregable-3/kyverno-validacion.txt) se conservó sin cambios.

Para repetir la validación: los manifiestos de prueba usan el namespace clinica-veterinaria, heredado del Entregable 3, que no existe en un cluster levantado con inicializar-todo.sh. Hay que crearlo antes de aplicarlos y borrarlo al terminar:

    minikube kubectl -- create namespace clinica-veterinaria
    minikube kubectl -- apply -f k8s/policies/test/pod-solo-sin-probes.yaml    # debe ser rechazado
    minikube kubectl -- delete namespace clinica-veterinaria

## Scripts de inicialización en bash

Hasta el Entregable 3, levantar el proyecto requería varios scripts de PowerShell (uno por cada parte) y pasos manuales repartidos en distintos documentos. Para la entrega final armamos tres scripts de bash en scripts/4to_entregable/ que son el punto de entrada único: se ejecutan en Git Bash y no necesitan intervención manual. Los scripts .ps1 de scripts/ no se modificaron y quedan como evidencia de los entregables anteriores.

| Script | Qué hace |
|---|---|
| inicializar-todo.sh | Crea las claves locales si faltan, inicia minikube con el addon de Ingress, construye las imágenes, instala el Helm chart petcore, instala Kyverno con sus cuatro políticas, instala Falco y despliega Prometheus y Grafana. Con --con-jenkins también levanta Jenkins. |
| poblar-dashboards.sh | Genera tráfico real contra la API para que los dashboards de Grafana no arranquen vacíos: registra un cliente, falla el login a propósito, crea y cancela reservas, y lista turnos. Con --disparar-alertas supera los umbrales para que las dos alertas pasen a Firing. |
| borrar-todo.sh | Desinstala todo lo anterior, incluidos el disco de PostgreSQL y los webhooks y CRDs que Kyverno deja atrás, y verifica que no queden recursos colgados. Con --borrar-cluster también borra el cluster de minikube. |

Se ejecutan en este orden, desde la raíz del proyecto:

    bash scripts/4to_entregable/inicializar-todo.sh
    bash scripts/4to_entregable/poblar-dashboards.sh
    bash scripts/4to_entregable/borrar-todo.sh

Los tres se pueden volver a correr sin problema: lo que ya existe se actualiza y lo que ya se borró se saltea. Cada uno muestra sus opciones con --ayuda.

Como parte de este trabajo se unificó el monitoreo. Antes, Prometheus y Grafana observaban una copia de la API (api-monitoring) en el namespace clinica-veterinaria, distinta de la que despliega el Helm chart. Ahora se despliegan en el namespace petcore y observan la misma API que usa la aplicación. Las configuraciones que cambian respecto de los entregables anteriores están en k8s/4to_entregable/; el resto de los archivos de k8s/ se reutilizan y el script los adapta al namespace petcore al aplicarlos.

Cómo comprobar que cada componente quedó funcionando está en la sección "Entrega final (D4)" del README.md.