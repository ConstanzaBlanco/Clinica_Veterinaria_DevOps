# Análisis de imágenes Docker

Se analizaron las imágenes con **Deep Dive**, extensión de Docker Desktop basada en Dive.

## Tamaño total y cantidad de capas

| Imagen | Tamaño total | Capas | Espacio desperdiciado estimado |
| --- | ---: | ---: | ---: |
| Backend: `clinica-veterinaria:test` | 250,65 MB | 11 | 17,64 MB |
| Frontend: `clinica-frontend:test` | 64,31 MB | 12 | 25,03 MB |

## Observaciones de optimización posibles

En los resultados obtenidos no se proporcionó un listado de recomendaciones detalladas. La sección **Largest Wasted Files** indicó que no se detectaron archivos eliminados o sobrescritos, aunque **Wasted space** sí mostró una estimación global de desperdicio.

Como observaciones propias del equipo, se proponen estas posibilidades:

- **Backend:** revisar si todas las dependencias y herramientas instaladas son necesarias para ejecutar la aplicación.
- **Frontend:** revisar si la imagen base de Nginx incluye componentes que la aplicación no utiliza.