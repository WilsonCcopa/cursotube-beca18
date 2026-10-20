# Evidencia de validación de las minilecciones

Esta carpeta conserva únicamente informes JSON seleccionados de la validación del módulo. No contiene datos de estudiantes, métricas privadas, libros ni configuración del sitio.

## Archivos necesarios para las pruebas

- `published-baseline.json`: huellas de los diez temas iniciales; permite comprobar que su contenido no cambió al ampliar el catálogo, normalizando únicamente finales de línea.
- `review-math-a.json`, `review-math-b-root.json` y `review-verbal.json`: registros de revisión cruzada de las 648 preguntas nuevas, alternativas y explicaciones.
- `reviewed-content.json`: huellas del contenido final revisado; detecta cambios posteriores a esa revisión.

`npm run check:coverage` y `npm run check:reviews`, incluidos en `npm test`, necesitan estos cinco archivos. Mantenerlos en el control de versiones junto con los temas y la matriz.

## Informes complementarios

- `browser-report.json`: recorrido móvil del catálogo y las lecciones.
- `diagrams-report.json`: comprobaciones de los exploradores interactivos.
- `edge-report.json`: red, versiones de contenido, sonido y compartir.
- `editorial-report.json`: comprobaciones editoriales y de duplicados.

Los informes se conservan como registros originales. Los nombres de PNG que aparecen en `browser-report.json` corresponden a capturas del paquete local de validación; esas imágenes no están incluidas en este repositorio y no constituyen enlaces a archivos disponibles aquí. Tampoco se incluyen las herramientas externas de navegador empleadas para generar los informes.

Solo `public/` se sirve como contenido web. Esta carpeta aporta evidencia y soporte a las pruebas del contenido.
