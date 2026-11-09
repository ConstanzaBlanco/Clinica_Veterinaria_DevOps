# Entregable 4 - Análisis de seguridad

En este entregable revisamos dos aspectos del proyecto: posibles problemas en el código y vulnerabilidades conocidas en las dependencias. Para eso utilizamos Semgrep y Snyk.

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

