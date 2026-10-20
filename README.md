# Minilecciones Beca 18 de CursoTube

Código y materiales originales del módulo gratuito de minilecciones de [CursoTube](https://cursotube.com/beca18/aprende/). Contiene **2 cursos, 64 temas, 1536 pasos y 768 preguntas explicadas**, con tres niveles por tema: 38 temas de Matemática y 26 de Competencia lectora y razonamiento verbal. Conserva los diez temas iniciales y añade 54.

El módulo usa HTML, CSS y JavaScript sin framework. Incluye búsqueda de temas, diagramas SVG interactivos, ejemplos resueltos, retroalimentación por alternativa, repaso de errores, XP, progreso local y sonidos opcionales. Está diseñado para móviles y no requiere registro ni pago.

Este repositorio contiene el módulo de aprendizaje. La portada, el reto diario, los simulacros, la infraestructura de publicación y la configuración privada del sitio se mantienen en el proyecto principal de CursoTube.

## Archivos

```text
public/
  beca18/aprende/index.html
  css/beca18-learning.css
  js/beca18-learning.js
  js/beca18-learning-diagrams.js
  data/beca18-learning/
    manifest.json
    topics/matematica/*.json
    topics/lectura/*.json
scripts/
  build-beca18-learning.mjs
  validate-beca18-learning.mjs
  test-beca18-learning.mjs
  check-beca18-coverage.mjs
  check-beca18-reviews.mjs
qa/
  published-baseline.json
  review-math-a.json
  review-math-b-root.json
  review-verbal.json
  reviewed-content.json
  browser-report.json
  diagrams-report.json
  edge-report.json
  editorial-report.json
BECA18-CONTENIDO.md
BECA18-INTEGRACION.md
COVERAGE.md
coverage-matrix.json
```

La documentación del contrato JSON, los tipos de paso, los diagramas y el progreso está en [BECA18-CONTENIDO.md](BECA18-CONTENIDO.md). La ampliación del motor se explica en [BECA18-INTEGRACION.md](BECA18-INTEGRACION.md). La matriz [COVERAGE.md](COVERAGE.md) y su versión [JSON](coverage-matrix.json) relacionan 48 capítulos de los dos libros de orientación y 43 indicadores del temario ENP consultado con temas y pasos concretos.

## Validar y generar el catálogo

Se necesita Node.js 18 o superior. No hay dependencias de npm que instalar.

```sh
npm run validate
npm run build
npm test
```

`build` descubre y valida todos los temas JSON y genera `manifest.json` con el catálogo, la revisión del contenido y las sumas SHA-256. `test` valida los contenidos, comprueba que el catálogo esté actualizado y ejecuta las pruebas del contrato, las restricciones de interacción, la matriz de cobertura y los registros de revisión cruzada de las 648 preguntas nuevas.

Todos los archivos de texto usan finales de línea LF, definidos en `.gitattributes`. Regenerar el manifest después de normalizar el contenido: sus hashes corresponden a los bytes de los JSON. No es necesario instalar paquetes ni herramientas de navegador para ejecutar estas pruebas.

## Integración con cursotube.com

1. Copiar el contenido de `public/` al directorio público del sitio, conservando las rutas. Copiar los cinco scripts de herramientas a `scripts/` y conservar la matriz y los informes JSON de revisión para ejecutar las comprobaciones.
2. Incorporar `node scripts/build-beca18-learning.mjs` al proceso de construcción del sitio, antes de validar y publicar sus archivos estáticos.
3. Mantener los scripts compartidos que proporciona el sitio: `/js/shared.js`, `/js/ad-slots.js` y `/js/analytics.js`. El HTML los referencia para anuncios y medición. No se incluyen sus configuraciones ni identificadores en este repositorio. El reproductor de aprendizaje también puede funcionar sin esos servicios.
4. Mantener únicamente los bloques manuales `beca18-learning-top` y `beca18-learning-bottom`, situados arriba y abajo de la experiencia. El sitio administra sus identificadores y la exclusión de `/beca18` de los anuncios automáticos.
5. Servir `public/` por HTTP(S) desde la raíz y abrir `/beca18/aprende/`. Las rutas son absolutas; no abrir el HTML con `file://` ni tratar el repositorio como una página autónoma bajo un subdirectorio de GitHub Pages. Los enlaces de simulacros y reto diario los resuelve el sitio principal.
6. Cargar `/js/beca18-learning-diagrams.js` antes de `/js/beca18-learning.js`, como hace el HTML incluido. La biblioteca añade gráficas de funciones, intervalos, barras y geometría; los seis exploradores anteriores permanecen en el motor. La búsqueda consulta títulos, descripciones y objetivos, sin diferenciar tildes.

La página conserva el dominio y los enlaces públicos de CursoTube. No se incluyen archivos de Firebase, credenciales, configuración de Analytics, identificadores publicitarios, libros, PDF ni métricas privadas.

## Agregar o corregir un tema

1. Crear o editar `public/data/beca18-learning/topics/<course>/<slug>.json`, siguiendo el contrato de contenido. Usar `course: "matematica"` o `course: "lectura"` para los dos cursos actuales.
2. Mantener los identificadores estables. Aumentar `version` cuando una revisión de contenido deba iniciar un recorrido nuevo; los logros y versiones anteriores permanecen guardados en el dispositivo.
3. Ejecutar `npm run build` y `npm test`. Revisar también la claridad de las explicaciones, la respuesta correcta y la experiencia móvil; la validación estructural no sustituye la revisión pedagógica.
4. Integrar y publicar los JSON, el nuevo `manifest.json` y cualquier cambio del módulo mediante el proceso de publicación del sitio.

No hay que editar el HTML ni el reproductor para agregar otro tema compatible. Una vez publicado el catálogo actualizado, el módulo lo vuelve a consultar al abrirse y al recuperar foco o visibilidad. Los temas nuevos aparecen automáticamente. Guardar o subir archivos a GitHub por sí solo no publica cambios en cursotube.com.

Por defecto los contenidos se cargan desde `/data/beca18-learning/` del propio sitio. `CT_LEARNING_CONFIG.contentBase` permite una fuente remota opcional con CORS, descrita en el contrato; este repositorio no activa esa configuración ni un despliegue automático.

La matriz y el verificador de revisión registran el alcance de esta entrega de 64 temas. Al ampliar ese alcance o corregir una pregunta revisada, actualizar también la matriz y sus evidencias después de la revisión correspondiente. El verificador detecta cambios de contenido posteriores a las huellas registradas; no editar las huellas para omitir una revisión pendiente.

## Cobertura y evidencia de QA

`npm run check:coverage` verifica los 64 temas, las referencias a pasos de 48 capítulos y 43 indicadores, y que los diez temas publicados inicialmente conserven su contenido. `npm run check:reviews` comprueba la revisión de las 648 preguntas nuevas, sus 1944 alternativas explicadas y las huellas del contenido final, sin pendientes.

Los cinco JSON de baseline y revisión en `qa/` son necesarios para esas comprobaciones. Los otros cuatro informes resumen el recorrido móvil, diagramas, casos de red/versiones/sonido/WhatsApp y comprobaciones editoriales. Se incluyen registros de evidencia; las capturas y las herramientas externas de navegador no forman parte de este repositorio. Solo `public/` se sirve como contenido web.

## Progreso y compartir

El progreso se guarda en `localStorage` del dispositivo. Los enlaces compartidos incluyen el curso y el tema, sin respuestas, puntajes ni datos del estudiante. Copiar muestra una confirmación dentro de la página; WhatsApp usa el protocolo nativo mediante `window.location.href`. No se usan ventanas nuevas ni alertas nativas.

## Derechos

© 2026 CursoTube. Todos los derechos reservados. El código y los materiales se publican para su gestión y revisión; no se concede una licencia de uso, reproducción o distribución. El acceso gratuito a las minilecciones en CursoTube no modifica estos derechos.

CursoTube es una plataforma educativa independiente de Pronabec. La cobertura corresponde al mapa de los dos libros y al temario oficial consultado el 20 de octubre de 2026; la matriz permite revisar su alcance y mantenerlo al actualizar las fuentes.
