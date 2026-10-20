# Minilecciones Beca 18 · CursoTube

Paquete estático integrable en `/beca18/aprende/`. Incluye 10 temas originales, 240 pasos y 120 preguntas explicadas. Cada tema tiene 3 niveles de 8 pasos, 12 preguntas, base conceptual, ejemplos resueltos y repaso de errores. No requiere cuenta, pago, backend, dependencias de npm ni servicios externos para aprender.

## Integración

1. Copiar **el contenido** de `public/` dentro del `public/` del sitio, conservando sus rutas. Copiar `scripts/` junto al resto de scripts del proyecto (los nombres son exclusivos).
2. Ejecutar `node scripts/build-beca18-learning.mjs` desde el proyecto. Añadirlo al build/predeploy existente. Descubre recursivamente todos los JSON en `public/data/beca18-learning/topics/`, los valida y regenera el catálogo completo; **no se edita HTML, JS ni manifest al agregar otro tema**.
3. Mantener las versiones existentes del sitio de `/js/shared.js`, `/js/ad-slots.js` y `/js/analytics.js`. No se incluyen sus copias ni configuraciones: las aporta el proyecto principal de CursoTube. El HTML ya carga estos tres archivos. En un servidor aislado pueden omitirse; el aprendizaje funciona sin ellos.
4. Ya se prevén los slots manuales `beca18-learning-top` y `beca18-learning-bottom`. El sitio asigna sus IDs reales en `CT_AD_SLOTS` y mantiene `/beca18` y sus rutas excluidos de anuncios automáticos. Los slots permanecen ocultos sin ID y `shared.js` existente solo carga anuncios en los dominios reales; no hay anuncios locales ni intersticiales.
5. Servir por HTTP(S), no como `file://`, porque los temas se leen con fetch. El alojamiento debe servir `/beca18/aprende/index.html` al visitar `/beca18/aprende/`. El Service Worker de CursoTube usa red primero para `/data/`, `/css/` y `/js/`, compatible con este paquete. Las solicitudes locales usan URL estable y `cache: no-store`, por lo que no crean entradas nuevas por cada enfoque. Es recomendable `Cache-Control: no-cache` para `manifest.json`.

Comprobaciones sin instalar paquetes:

```sh
node scripts/validate-beca18-learning.mjs
node scripts/build-beca18-learning.mjs --check
node scripts/test-beca18-learning.mjs
```

El generador falla con la ruta y el motivo de cualquier contenido inválido; no genera un catálogo parcial silenciosamente. Node 18+ es suficiente. No requiere dependencias de npm. Generar el catálogo prepara los archivos; publicar los cambios en el sitio es un paso separado.

## Contrato de contenido

El manifest generado tiene `{schemaVersion:1, revision, courses:[...]}`. `revision` es un resumen determinista del contenido. Cada curso tiene `slug`, `title`, `shortTitle`, `description`, `topics`. Cada entrada de tema contiene `id`, `course`, `slug`, `title`, `description`, `version`, `order`, `estimatedMinutes`, `objectives`, `steps` (conteo), `questionCount`, `file` (ruta relativa segura) y `sha256` (auditoría de build).

Un tema vive en `topics/<course>/<slug>.json` y contiene:

```json
{
  "schemaVersion": 1,
  "id": "matematica/fracciones",
  "course": "matematica",
  "slug": "fracciones",
  "title": "Fracciones",
  "description": "Descripción breve",
  "version": 1,
  "order": 2,
  "estimatedMinutes": 24,
  "objectives": ["Objetivo pedagógico"],
  "steps": []
}
```

`steps` debe incluir al menos 24 pasos y tres niveles. Cada paso: `id` estable, `level` (1–3), `type` (`learn`, `example`, `explore`, `question`, `review`), `title`, `body` (array de párrafos de texto plano). Opcionales: `passage:{title,paragraphs}`, `solution:[pasos]`, `diagram`. Una pregunta exige `prompt`, 3–5 `choices:[{text,explanation}]`, `correct` (índice desde cero), `hint`, `solution`. Cada nivel exige base, ejemplo, repaso y cuatro preguntas. No se acepta HTML del contenido ni se ejecuta código remoto.

Diagramas soportados:

- `fraction`: `numerator`, `denominator` (2–12), controles de numerador y denominador.
- `numberline`: `min` (−30 a 0), `max` (1–30), `value`; recta y valor absoluto.
- `factors`: `value` (2–60); parejas de factores y matriz de unidades.
- `balance`: `offset` (−10 a 10), `total` (−20 a 20); modelo `x + offset = total`, misma resta en ambos lados.
- `textmap`: `nodes:[{label,text}]`, ideas desplegables.
- `highlight`: `fragments:[{text,role}]`, fragmentos que revelan su función al tocarlos.

El catálogo también contiene una pequeña demo de círculo con triángulo/cuadrado/hexágono y radio/apotema/diagonal. Se identifica como muestra futura, no como un undécimo tema. El triángulo explica correctamente por qué no tiene diagonales.

## Actualizaciones y fallback

Por defecto todo se carga desde `/data/beca18-learning/`. Para usar una base remota con CORS, el sitio puede definir **antes del script del reproductor**:

```html
<script>
window.CT_LEARNING_CONFIG = {
  contentBase: "https://raw.githubusercontent.com/ORGANIZACION/REPOSITORIO/main/public/data/beca18-learning/"
};
</script>
```

Es solo un ejemplo de configuración; el módulo no activa una fuente remota por defecto. El manifest se vuelve a pedir al abrir, al recuperar foco y al volver visible la pestaña, con `cache: no-store`; en una base remota el manifest añade además un parámetro de actualización. Los temas nuevos aparecen automáticamente en el catálogo después de publicar los archivos actualizados. Una lección abierta conserva su contenido hasta salir, evitando cambiar una pregunta a mitad del intento. Si falla la base remota, se usa la copia local; si falla la red local se intenta la última copia válida guardada. El fallback no garantiza primera carga sin conexión.

## Progreso y enlaces

`localStorage['ct:learning:v1']` almacena progreso por `id` de tema y `version`, respuestas por `id` de paso, XP, días activos en hora de Lima y preferencia de sonido. Mantener IDs al corregir contenido y aumentar `version` para revisiones pedagógicas. Las versiones anteriores se conservan; una versión nueva comienza su recorrido sin borrar el logro previo, XP ni racha. Agregar temas no modifica el progreso existente. Si el almacenamiento está bloqueado o lleno, la sesión sigue en memoria y avisa en el catálogo.

Se otorgan 10 XP una única vez por pregunta resuelta y 50 XP una única vez por tema. Repetir no infla XP. El resultado usa la primera respuesta; reintentar y repasar errores no alteran ese resultado. Reiniciar el recorrido conserva logros y experiencia. Los sonidos son opcionales, se habilitan después de un gesto y el silencio persiste. No hay vidas que bloqueen.

- Tema: `/beca18/aprende/?course=matematica&topic=fracciones`
- Resultado: `/beca18/aprende/?course=matematica&topic=fracciones&result=1`

El enlace de resultado no contiene nombre, respuestas ni puntaje. En otro dispositivo abre el tema para aprender; no finge que el visitante lo completó. Copiar enlace y WhatsApp pueden repetirse. WhatsApp usa exactamente el protocolo nativo mediante `window.location.href`, sin ventanas nuevas ni diálogos nativos.

Eventos: `window.dispatchEvent(new CustomEvent('ct:analytics', {detail:{name,params}}))`. Nombres `beca18_learning_start`, `beca18_learning_complete`, `beca18_learning_share`. `params` incluye `course_slug`, `topic_id` (slug, sin `/`, compatible con el saneador del sitio), `total` (preguntas del tema), `score` (aciertos al primer intento), `method` (`lesson`, `copy`, `whatsapp`). El sitio principal administra la lista de campos permitidos; los demás se descartan. Este repositorio no contiene la configuración de medición.

## Criterio pedagógico y fuentes de orientación

Matemática reorganiza las bases en números y operaciones, fracciones, divisibilidad, MCM/MCD, ecuaciones e inecuaciones lineales para dar una progresión de prerrequisitos. Lectura sigue los cinco primeros capítulos del mapa suministrado: tipos de texto, textos expositivos, sinonimia contextual, antonimia contextual y relaciones lógicas. Es un primer tramo de preparación, no todo el temario ENP.

Los libros `Prepárate` suministrados se usaron como mapa, sin reproducir sus ejercicios, textos ni dibujos. Textos, contextos, alternativas y diagramas de este paquete son originales. Competencias de referencia: [temario oficial del ENP de Pronabec](https://www.pronabec.gob.pe/temario-examen-preseleccion/) y [portal oficial de preparación](https://www.gob.pe/institucion/pronabec/noticias/1200855-pronabec-lanza-portal-con-ultimos-examenes-nacionales-para-prepararse-y-postular-a-beca-18-2026). Consulta de orientación: 20/10/2026. La selección matemática desarrolla bases para operaciones racionales y ecuaciones; lectura desarrolla propósito, información, contexto y relaciones lógicas.

## Verificación y publicación

Las herramientas incluidas verifican estructura, alternativas, explicaciones, límites de diagramas, correspondencia entre JSON y manifest, hashes y restricciones de interacción. Las comprobaciones numéricas independientes cubren casos relevantes del contenido inicial. Revisar también la exactitud pedagógica y el comportamiento móvil antes de publicar.

Solo `public/` se sirve en el sitio. `scripts/` y la documentación son herramientas de mantenimiento y no necesitan publicarse como contenido web. La integración final en CursoTube se comprobó a 320, 390 y 430 px; las capturas y reportes de esa revisión no forman parte de este módulo.

© 2026 CursoTube. Contenido original; todos los derechos reservados. Este repositorio no concede una licencia de uso o distribución.
