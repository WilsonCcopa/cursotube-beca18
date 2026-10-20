# Minilecciones Beca 18 de CursoTube

Código y materiales originales del módulo gratuito de minilecciones de [CursoTube](https://cursotube.com/beca18/aprende/). La versión inicial contiene **2 cursos, 10 temas, 240 pasos y 120 preguntas explicadas**, con tres niveles por tema.

El módulo usa HTML, CSS y JavaScript sin framework. Incluye diagramas SVG interactivos, ejemplos resueltos, retroalimentación por alternativa, repaso de errores, XP, progreso local y sonidos opcionales. Está diseñado para móviles y no requiere registro ni pago.

Este repositorio contiene el módulo de aprendizaje. La portada, el reto diario, los simulacros, la infraestructura de publicación y la configuración privada del sitio se mantienen en el proyecto principal de CursoTube.

## Archivos

```text
public/
  beca18/aprende/index.html
  css/beca18-learning.css
  js/beca18-learning.js
  data/beca18-learning/
    manifest.json
    topics/matematica/*.json
    topics/lectura/*.json
scripts/
  build-beca18-learning.mjs
  validate-beca18-learning.mjs
  test-beca18-learning.mjs
BECA18-CONTENIDO.md
```

La documentación del contrato JSON, los tipos de paso, los diagramas y el progreso está en [BECA18-CONTENIDO.md](BECA18-CONTENIDO.md).

## Validar y generar el catálogo

Se necesita Node.js 18 o superior. No hay dependencias de npm que instalar.

```sh
npm run validate
npm run build
npm test
```

`build` descubre y valida todos los temas JSON y genera `manifest.json` con el catálogo, la revisión del contenido y las sumas SHA-256. `test` valida los contenidos, comprueba que el catálogo esté actualizado y ejecuta las pruebas del contrato y de las restricciones de interacción.

## Integración con cursotube.com

1. Copiar el contenido de `public/` al directorio público del sitio, conservando las rutas. Copiar los tres scripts de herramientas a `scripts/`.
2. Incorporar `node scripts/build-beca18-learning.mjs` al proceso de construcción del sitio, antes de validar y publicar sus archivos estáticos.
3. Mantener los scripts compartidos que proporciona el sitio: `/js/shared.js`, `/js/ad-slots.js` y `/js/analytics.js`. El HTML los referencia para anuncios y medición. No se incluyen sus configuraciones ni identificadores en este repositorio. El reproductor de aprendizaje también puede funcionar sin esos servicios.
4. Mantener únicamente los bloques manuales `beca18-learning-top` y `beca18-learning-bottom`, situados arriba y abajo de la experiencia. El sitio administra sus identificadores y la exclusión de `/beca18` de los anuncios automáticos.
5. Servir `public/` por HTTP(S) desde la raíz y abrir `/beca18/aprende/`. Las rutas son absolutas; no abrir el HTML con `file://` ni tratar el repositorio como una página autónoma bajo un subdirectorio de GitHub Pages. Los enlaces de simulacros y reto diario los resuelve el sitio principal.

La página conserva el dominio y los enlaces públicos de CursoTube. No se incluyen archivos de Firebase, credenciales, configuración de Analytics, identificadores publicitarios, libros, PDF ni métricas privadas.

## Agregar o corregir un tema

1. Crear o editar `public/data/beca18-learning/topics/<course>/<slug>.json`, siguiendo el contrato de contenido. Usar `course: "matematica"` o `course: "lectura"` para los dos cursos actuales.
2. Mantener los identificadores estables. Aumentar `version` cuando una revisión de contenido deba iniciar un recorrido nuevo; los logros y versiones anteriores permanecen guardados en el dispositivo.
3. Ejecutar `npm run build` y `npm test`. Revisar también la claridad de las explicaciones, la respuesta correcta y la experiencia móvil; la validación estructural no sustituye la revisión pedagógica.
4. Integrar y publicar los JSON, el nuevo `manifest.json` y cualquier cambio del módulo mediante el proceso de publicación del sitio.

No hay que editar el HTML ni el reproductor para agregar otro tema compatible. Una vez publicado el catálogo actualizado, el módulo lo vuelve a consultar al abrirse y al recuperar foco o visibilidad. Los temas nuevos aparecen automáticamente. Guardar o subir archivos a GitHub por sí solo no publica cambios en cursotube.com.

Por defecto los contenidos se cargan desde `/data/beca18-learning/` del propio sitio. `CT_LEARNING_CONFIG.contentBase` permite una fuente remota opcional con CORS, descrita en el contrato; este repositorio no activa esa configuración ni un despliegue automático.

## Progreso y compartir

El progreso se guarda en `localStorage` del dispositivo. Los enlaces compartidos incluyen el curso y el tema, sin respuestas, puntajes ni datos del estudiante. Copiar muestra una confirmación dentro de la página; WhatsApp usa el protocolo nativo mediante `window.location.href`. No se usan ventanas nuevas ni alertas nativas.

## Derechos

© 2026 CursoTube. Todos los derechos reservados. El código y los materiales se publican para su gestión y revisión; no se concede una licencia de uso, reproducción o distribución. El acceso gratuito a las minilecciones en CursoTube no modifica estos derechos.

CursoTube es una plataforma educativa independiente de Pronabec. Estos diez temas constituyen un primer tramo de preparación y no cubren todo el temario del examen.
