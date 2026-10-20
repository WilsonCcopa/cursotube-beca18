# Integración de la ampliación completa

El módulo conserva los diez JSON iniciales y añade 54: total 64 temas, 1536 pasos y 768 preguntas. Esta guía describe cómo incorporar la ampliación en el proyecto principal de CursoTube; guardar los archivos en GitHub no los publica automáticamente en el sitio.

## Qué integrar

1. Copiar los 54 JSON nuevos desde `public/data/beca18-learning/topics/` sin alterar los existentes. Mantener `schemaVersion:1`, IDs y versiones. Copiar el generador y validador actualizados y ejecutar el build: no editar manifest a mano. Las revisiones pueden variar tras normalizar LF/CRLF; regenerar después de la copia o checkout.
2. Añadir `public/js/beca18-learning-diagrams.js` y cargarlo con `defer` **antes** de `beca18-learning.js`. El HTML del paquete ya contiene el orden y versiones de caché renovadas.
3. El cambio necesario en el motor existente es la última rama de `mountDiagram(host, diagram)`:

```js
else window.CTLearningDiagrams?.mount(host, diagram);
```

4. El motor del paquete también añade búsqueda de temas mediante `searches`, `mountCatalogSearch(course)` y su llamada al final de `renderCatalog`. El CSS añade `.catalog-search`, `.formula-label` y `.data-table`. La lógica de progreso, IDs, XP, racha, sonido y compartir se conserva. La igualdad decimal del explorador de fracciones usa `(numerator * 1000) % denominator === 0 ? '=' : '≈'`.
5. Integrar por comparación los archivos del motor, CSS y HTML si la fuente principal tiene cambios externos. Conservar configuración de anuncios, analítica, `contentBase`, exclusión de Auto Ads y hooks de build ya establecidos. No se incluyen copias de `shared.js`, `ad-slots.js` ni `analytics.js`.

La nueva librería de diagramas es necesaria para `function`, `interval`, `bars` y `geometry`. Los seis tipos anteriores siguen funcionando igual. Los gráficos porcentuales parten de cero y llegan al menos a100%; no se calculan porcentajes sobre respuestas superpuestas salvo una partición explícita `partOfWhole:true`.

## Comprobaciones

```sh
node scripts/build-beca18-learning.mjs
node scripts/validate-beca18-learning.mjs
node scripts/build-beca18-learning.mjs --check
node scripts/test-beca18-learning.mjs
node scripts/check-beca18-coverage.mjs
node scripts/check-beca18-reviews.mjs
```

Para cobertura conservar `coverage-matrix.json` y `qa/published-baseline.json`: verifica48capítulos,43indicadores,64temas,subtemas con IDs reales y los diez archivos originales intactos, normalizando únicamente finales de línea. Para revisión conservar los informes `qa/review-*.json` y `qa/reviewed-content.json`: verifica648preguntas nuevas sin pendientes y detecta cambios posteriores a su revisión. No hace falta servir esta evidencia al público.

`COVERAGE.md` permite revisar el alcance y los JSON seleccionados en `qa/` guardan la evidencia de contenido, revisión cruzada y pruebas móviles. Solo `public/` es contenido web. La integración y publicación se realizan mediante el proceso del sitio principal; este repositorio no configura CI ni un despliegue automático.
