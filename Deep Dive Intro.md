# Deep Dive

Dive permite explorar el contenido y las capas de una imagen Docker y estimar el espacio desperdiciado. En este proyecto se utiliza **Deep Dive**, una extensión gráfica de Docker Desktop basada en Dive.

## Instalación

1. Abrir Docker Desktop.
2. Ir a **Extensions**, buscar **Deep Dive**, de `prizz`, e instalarla.
3. Abrir la extensión desde el menú lateral.

## Qué significan los indicadores

| Indicador | Significado |
| --- | --- |
| **Total Size** | Tamaño total de la imagen informado por el análisis. |
| **Layers analyzed** | Cantidad de capas analizadas. |
| **Wasted space** | Estimación de espacio desperdiciado. |
| **Final Image Efficiency** | Porcentaje estimado de espacio aprovechado. |
| **Dive Efficiency Score** | Puntaje que evalúa la eficiencia entre capas y penaliza repeticiones o modificaciones de rutas. Es una métrica distinta de Final Image Efficiency. |

## Qué muestran las listas

| Sección | Qué muestra y para qué sirve |
| --- | --- |
| **Layer file tree** | Árbol de carpetas y archivos asociado a la capa seleccionada. Permite explorar su contenido y, según la vista, los cambios respecto de otras capas. |
| **Largest Files** | Lista de rutas con espacio y cantidad de referencias, presentada por la extensión como archivos de mayor tamaño. Sirve para investigar dónde se concentra espacio; no demuestra que esos archivos sobren. |
| **Largest Wasted Files** | Desglose de archivos eliminados o sobrescritos que la extensión identifica como contribuyentes al desperdicio. En los análisis obtenidos esta sección apareció vacía, aunque existía una estimación global de desperdicio. |
| **Layers** | Tabla con el índice, identificador, tamaño y comando de construcción de cada capa. Permite relacionar el espacio con instrucciones como `RUN` o `COPY`. |
