# Análisis de imágenes Docker

Se analizaron las imágenes con **Deep Dive**, extensión de Docker Desktop basada en Dive.

## Tamaño total y cantidad de capas

| Imagen | Tamaño total | Capas | Espacio desperdiciado estimado |
| --- | ---: | ---: | ---: |
| Backend, una etapa: `clinica-veterinaria:test` | 250,65 MB | 11 | 17,64 MB |
| Backend, multi-stage: `clinica-veterinaria:multistage-test` | 195,77 MB | 9 | 6,26 MB (3,2 %) |
| Frontend: `clinica-frontend:test` | 64,31 MB | 12 | 25,03 MB |

Al pasar el backend a multi-stage (la primera etapa instala las dependencias y la segunda solo las copia, sin `uv` ni `pip`), la imagen bajó unos 55 MB, de 11 a 9 capas, y el espacio desperdiciado pasó de 17,64 MB a 6,26 MB. Dive Efficiency Score de la imagen nueva: 98 %.

## Observaciones de optimización posibles

En los resultados obtenidos no se proporcionó un listado de recomendaciones detalladas. La sección **Largest Wasted Files** indicó que no se detectaron archivos eliminados o sobrescritos, aunque **Wasted space** sí mostró una estimación global de desperdicio.

Como observación propia del equipo, queda por revisar en el **frontend** si la imagen base de Nginx incluye componentes que la aplicación no utiliza.