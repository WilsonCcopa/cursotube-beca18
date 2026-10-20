(() => {
  'use strict';
  const CONFIG = window.CT_LEARNING_CONFIG || {};
  const LOCAL_BASE = '/data/beca18-learning/';
  const KEY = 'ct:learning:v1';
  const LEVELS = ['Desde cero', 'Conecta y aplica', 'Acepta el reto'];
  const TYPE_NAMES = { learn: 'Una idea a la vez', example: 'Ejemplo resuelto', explore: 'Míralo antes de resolver', question: 'Ahora te toca', review: 'Repaso de errores' };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const paragraphs = (items) => (items || []).map((item) => `<p>${esc(item)}</p>`).join('');
  const app = $('#app');
  const actionBar = $('#lesson-action');
  let storageOK = true, state, manifest, currentTopic = null, currentProgress = null;
  let selectedCourse = 'matematica', stepIndex = 0, selectedChoice = null, routeToken = 0;
  let reviewQueue = null, reviewAnswers = {}, transientRetry = false, newCount = 0;
  let manifestPromise = null, audioContext = null, noticeTimer = 0;
  const memory = new Map();
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { storageOK = false; return memory.get(key) ?? fallback; }
  }
  function write(key, value) {
    memory.set(key, value);
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { storageOK = false; return false; }
  }
  state = read(KEY, null);
  if (!state || state.schemaVersion !== 1 || !state.topics || !Array.isArray(state.awards) || !Array.isArray(state.days)) {
    state = { schemaVersion: 1, topics: {}, awards: [], xp: 0, days: [], muted: false };
  }
  function save() { write(KEY, state); syncHeader(); }
  function dayKey(date = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  }
  function recordDay() { const key = dayKey(); if (!state.days.includes(key)) state.days.push(key); }
  function streak() {
    const date = new Date(); let count = 0;
    if (!state.days.includes(dayKey(date))) date.setUTCDate(date.getUTCDate() - 1);
    while (state.days.includes(dayKey(date))) { count++; date.setUTCDate(date.getUTCDate() - 1); }
    return count;
  }
  function award(key, xp) { if (!state.awards.includes(key)) { state.awards.push(key); state.xp += xp; } }
  function syncHeader() {
    $('#xp').textContent = `${state.xp} XP`;
    $('#sound').textContent = state.muted ? '♪̸' : '♪';
    $('#sound').setAttribute('aria-pressed', String(state.muted));
    $('#sound').setAttribute('aria-label', state.muted ? 'Activar sonidos' : 'Silenciar sonidos');
  }
  function notice(text) {
    clearTimeout(noticeTimer); $('#notice').textContent = text; $('#notice').hidden = false;
    noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 3800);
  }
  function activateAudio() {
    if (state.muted) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  function sound(kind) {
    if (state.muted || !audioContext || audioContext.state !== 'running') return;
    const notes = kind === 'correct' ? [523.25, 659.25] : kind === 'finish' ? [523.25, 659.25, 783.99] : [220, 196];
    try {
      notes.forEach((frequency, i) => {
        const osc = audioContext.createOscillator(), gain = audioContext.createGain();
        const start = audioContext.currentTime + i * .12;
        osc.type = 'sine'; osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.065, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .19);
        osc.connect(gain); gain.connect(audioContext.destination); osc.start(start); osc.stop(start + .2);
      });
    } catch { /* Keep learning if the device cannot play sound. */ }
  }
  function event(name, method = 'lesson') {
    if (!currentTopic) return;
    const total = currentTopic.steps.filter((step) => step.type === 'question').length;
    const score = Object.values(currentProgress?.answers || {}).filter((answer) => answer.firstCorrect).length;
    window.dispatchEvent(new CustomEvent('ct:analytics', { detail: { name, params: { course_slug: currentTopic.course, topic_id: currentTopic.slug, total, score, method } } }));
  }
  function baseURL(value) {
    try {
      const url = new URL(value || LOCAL_BASE, location.origin);
      if (!['http:', 'https:'].includes(url.protocol) || (url.origin !== location.origin && url.protocol !== 'https:')) return new URL(LOCAL_BASE, location.origin).href;
      url.search = ''; url.hash = ''; return url.href.replace(/\/?$/, '/');
    } catch { return new URL(LOCAL_BASE, location.origin).href; }
  }
  const preferredBase = baseURL(CONFIG.contentBase);
  const localBase = baseURL(LOCAL_BASE);
  async function getJSON(base, file) {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const url = new URL(file, base);
      // The site's worker uses network first. Stable local URLs avoid unbounded worker cache entries.
      if (url.origin !== location.origin && file === 'manifest.json') url.searchParams.set('_ct', String(Date.now()));
      const response = await fetch(url, { cache: 'no-store', signal: controller.signal, credentials: url.origin === location.origin ? 'same-origin' : 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Archivo demasiado grande');
      const raw = await response.text(); if (raw.length > 2_000_000) throw new Error('Archivo demasiado grande');
      return JSON.parse(raw);
    } finally { clearTimeout(timeout); }
  }
  function validManifest(value) {
    if (value?.schemaVersion !== 1 || !Array.isArray(value.courses) || !value.courses.length) return false;
    const ids = new Set();
    return value.courses.every((course) => /^[a-z][a-z0-9-]*$/.test(course.slug) && typeof course.title === 'string' && Array.isArray(course.topics) && course.topics.every((topic) => {
      if (ids.has(topic.id)) return false; ids.add(topic.id);
      return topic.course === course.slug && topic.id === `${course.slug}/${topic.slug}` && /^[a-z][a-z0-9-]*$/.test(topic.slug) && topic.file === `topics/${course.slug}/${topic.slug}.json` && Number.isInteger(topic.version) && topic.version > 0 && typeof topic.title === 'string' && Number.isInteger(topic.steps) && topic.steps > 0 && Number.isInteger(topic.questionCount) && topic.questionCount > 0 && Number.isFinite(topic.estimatedMinutes) && topic.estimatedMinutes > 0;
    }));
  }
  function validTopic(value, entry) {
    if (value?.schemaVersion !== 1 || value.id !== entry.id || value.slug !== entry.slug || value.course !== entry.course || value.version !== entry.version || !Array.isArray(value.steps) || value.steps.length !== entry.steps) return false;
    const ids = new Set();
    return value.steps.every((step) => {
      if (!step.id || ids.has(step.id)) return false; ids.add(step.id);
      return typeof step.title === 'string' && Array.isArray(step.body) && step.body.every((text) => typeof text === 'string') && [1, 2, 3].includes(step.level) && Object.hasOwn(TYPE_NAMES, step.type) && (!step.passage || (typeof step.passage.title === 'string' && Array.isArray(step.passage.paragraphs) && step.passage.paragraphs.every((text) => typeof text === 'string'))) && (!step.solution || (Array.isArray(step.solution) && step.solution.every((text) => typeof text === 'string'))) && (step.type !== 'question' || (typeof step.prompt === 'string' && Array.isArray(step.choices) && step.choices.length >= 3 && step.choices.every((choice) => typeof choice.text === 'string' && typeof choice.explanation === 'string') && Number.isInteger(step.correct) && step.correct >= 0 && step.correct < step.choices.length));
    });
  }
  const allTopics = (value = manifest) => value?.courses.flatMap((course) => course.topics) || [];
  async function refreshManifest(quiet = false) {
    if (manifestPromise) return manifestPromise;
    manifestPromise = (async () => {
      let next, origin = preferredBase;
      for (const base of [...new Set([preferredBase, localBase])]) {
        try { const value = await getJSON(base, 'manifest.json'); if (!validManifest(value)) throw new Error('Manifest inválido'); next = value; origin = base; break; } catch { /* Try the bundled source. */ }
      }
      if (!next) { const cached = read('ct:learning:manifest', null); if (validManifest(cached)) next = cached; }
      if (!next) { if (!quiet) renderError('No pudimos cargar el catálogo.', 'Revisa tu conexión e inténtalo de nuevo. Tus avances guardados siguen en este dispositivo.'); return false; }
      const oldIds = new Set(allTopics().map((topic) => topic.id));
      newCount = manifest ? allTopics(next).filter((topic) => !oldIds.has(topic.id)).length : 0;
      manifest = next; manifest._base = origin; write('ct:learning:manifest', manifest);
      if (quiet && !currentTopic) renderCatalog();
      if (quiet && newCount && currentTopic) notice(`${newCount} tema${newCount === 1 ? '' : 's'} nuevo${newCount === 1 ? '' : 's'} en el catálogo.`);
      return true;
    })().finally(() => { manifestPromise = null; });
    return manifestPromise;
  }
  async function loadTopic(entry) {
    for (const base of [...new Set([manifest._base || preferredBase, localBase])]) {
      try {
        const value = await getJSON(base, entry.file);
        if (validTopic(value, entry)) { write(`ct:learning:content:${entry.id}:${entry.version}`, value); return value; }
        if (base === localBase && value?.id === entry.id) {
          const localManifest = await getJSON(localBase, 'manifest.json');
          const localEntry = validManifest(localManifest) && allTopics(localManifest).find((topic) => topic.id === entry.id);
          if (localEntry && validTopic(value, localEntry)) { notice('Estás viendo la versión disponible en este sitio.'); return value; }
        }
      } catch { /* Try local, then the last valid saved topic. */ }
    }
    const cached = read(`ct:learning:content:${entry.id}:${entry.version}`, null);
    if (validTopic(cached, entry)) { notice('Cargamos la copia guardada en este dispositivo.'); return cached; }
    throw new Error('No se pudo cargar el tema');
  }
  function topicState(topic) {
    state.topics[topic.id] ||= { versions: {}, completed: false, bestScore: 0 };
    const stored = state.topics[topic.id]; stored.versions ||= {};
    stored.versions[topic.version] ||= { cursor: 0, visited: [], answers: {}, completedAt: null };
    return stored.versions[topic.version];
  }
  function topicURL(topic = currentTopic, result = false) {
    const url = new URL('/beca18/aprende/', location.origin);
    if (topic) { url.searchParams.set('course', topic.course); url.searchParams.set('topic', topic.slug); if (result) url.searchParams.set('result', '1'); }
    return url.href;
  }
  function setURL(url, replace = false) { history[replace ? 'replaceState' : 'pushState']({}, '', url); }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' }); }
  function focusHeading() { const heading = $('#view-heading'); if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); } }
  function heroSVG() {
    return `<svg class="hero-art" viewBox="0 0 220 220" aria-hidden="true"><rect x="34" y="29" width="152" height="166" rx="28" fill="#f0eeff" transform="rotate(8 110 110)"/><rect x="26" y="21" width="152" height="166" rx="28" fill="white" stroke="#d9d3fb" stroke-width="2"/><rect x="49" y="49" width="107" height="13" rx="6" fill="#e5e1fa"/><rect x="49" y="78" width="77" height="9" rx="4" fill="#e5e1fa"/><circle cx="77" cy="130" r="29" fill="#dff6ee"/><path d="m63 130 10 10 19-22" fill="none" stroke="#088575" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M125 115h25m-25 17h20m-20 17h27" stroke="#c8c0f0" stroke-width="7" stroke-linecap="round"/><circle cx="178" cy="41" r="20" fill="#ffdf77"/><path d="m178 29 3 8 9 1-7 6 2 9-7-5-8 5 2-9-6-6 9-1z" fill="#9b711a"/><circle cx="30" cy="182" r="12" fill="#24b49f"/></svg>`;
  }
  function catalogProgress(entry) {
    const saved = state.topics[entry.id]; const version = saved?.versions?.[entry.version];
    return { done: !!saved?.completed, count: version?.visited?.length || 0, version };
  }
  function renderCatalog() {
    currentTopic = null; currentProgress = null; reviewQueue = null;
    document.body.classList.remove('in-lesson'); actionBar.hidden = true;
    document.title = 'Minilecciones Beca 18 gratis | CursoTube';
    const courses = manifest.courses;
    if (!courses.some((course) => course.slug === selectedCourse)) selectedCourse = courses[0].slug;
    const course = courses.find((item) => item.slug === selectedCourse);
    const topics = allTopics(), steps = topics.reduce((sum, topic) => sum + topic.steps, 0), completed = topics.filter((topic) => state.topics[topic.id]?.completed).length;
    app.innerHTML = `${!storageOK ? '<p class="storage-warning">Tu navegador no permite guardar cambios. Puedes aprender; mantén esta pestaña abierta para conservar el avance de esta sesión.</p>' : ''}
      <section class="hero"><div><span class="eyebrow">Tu preparación para Beca 18</span><h1 id="view-heading">Aprende a tu ritmo.<br><span>Un paso a la vez.</span></h1><p>Entiende la idea, explora y practica. Cada respuesta tiene una explicación.</p><div class="pill-row"><span class="pill">100% gratis</span><span class="pill">Sin registro</span><span class="pill">Desde cero</span></div></div>${heroSVG()}</section>
      <div class="stats" aria-label="Tu recorrido"><div class="stat"><strong>${topics.length}</strong><span>temas completos</span></div><div class="stat"><strong>${steps}</strong><span>pasos para aprender</span></div><div class="stat"><strong>${completed}/${topics.length}</strong><span>temas logrados</span></div></div>
      ${newCount ? `<p class="new-content" role="status">Hay ${newCount} tema${newCount === 1 ? '' : 's'} nuevo${newCount === 1 ? '' : 's'}. Tu progreso sigue aquí.</p>` : ''}
      <section aria-labelledby="courses-title"><div class="section-head"><h2 id="courses-title">Elige tu camino</h2><small>${streak() ? `${streak()} día${streak() === 1 ? '' : 's'} de racha` : 'Cada paso cuenta'}</small></div>
      <div class="course-tabs" role="tablist" aria-label="Cursos">${courses.map((item, index) => `<button type="button" role="tab" class="course-tab" id="tab-${esc(item.slug)}" aria-selected="${item.slug === selectedCourse}" aria-controls="topic-panel" tabindex="${item.slug === selectedCourse ? 0 : -1}" data-action="course" data-course="${esc(item.slug)}"><span aria-hidden="true">${index ? 'Aa' : '∑'}</span><span>${esc(item.shortTitle || item.title)}</span></button>`).join('')}</div>
      <div role="tabpanel" id="topic-panel" aria-labelledby="tab-${esc(selectedCourse)}"><p class="course-description">${esc(course.description)}</p><div class="topic-grid">${course.topics.map((topic, i) => {
        const progress = catalogProgress(topic); const percent = Math.min(100, Math.round(progress.count / topic.steps * 100));
        return `<article class="topic-card"><div class="topic-top"><span class="topic-num">${String(i + 1).padStart(2, '0')}</span><span class="topic-tag">${progress.done ? '✓ Logro guardado' : progress.count ? `${percent}% recorrido` : '3 niveles'}</span></div><h3>${esc(topic.title)}</h3><p>${esc(topic.description)}</p><div class="topic-meta"><span>${topic.steps} pasos</span><span>${topic.questionCount} preguntas</span><span>≈ ${topic.estimatedMinutes} min</span></div>${progress.count ? `<div class="mini-progress" aria-label="${percent}% recorrido"><span style="width:${percent}%"></span></div>` : ''}<button type="button" class="primary" data-action="open" data-id="${esc(topic.id)}">${progress.version?.completedAt ? 'Ver mi resultado' : progress.count ? 'Continuar' : 'Empezar tema'} <span aria-hidden="true">→</span></button></article>`;
      }).join('') || '<p class="empty-state">Pronto aparecerán nuevos temas aquí.</p>'}</div></div></section>
      <p class="catalog-note">Avanza en tres niveles: <strong>desde cero, aplicación y reto</strong>. Puedes equivocarte, consultar pistas y repetir sin límites. Tu progreso y tus logros se guardan en este dispositivo.</p>
      <details class="demo"><summary>Laboratorio visual · un vistazo a geometría</summary><p class="explainer">Esta exploración es una muestra para futuros temas de geometría. No cuenta como tema ni otorga progreso.</p><div class="explorer" id="geometry-demo"></div></details>
      <div class="next-links"><a class="secondary" href="/beca18/reto/">Ir al reto diario →</a><a class="text-button" href="/beca18/">Practicar un simulacro</a></div>`;
    mountGeometry($('#geometry-demo'));
    window.CT?.ads?.sync();
  }
  function renderError(title, description, topicId = '') {
    currentTopic = null; currentProgress = null; reviewQueue = null;
    document.body.classList.remove('in-lesson'); actionBar.hidden = true;
    app.innerHTML = `<div class="error-card"><h2 id="view-heading">${esc(title)}</h2><p>${esc(description)}</p><button type="button" class="primary" data-action="${topicId ? 'open' : 'reload'}" data-id="${esc(topicId)}">Volver a intentar</button><button type="button" class="text-button" data-action="catalog">Volver al catálogo</button></div>`;
  }
  async function openTopic(id, resultRequested = false, updateURL = true) {
    const token = ++routeToken;
    const entry = allTopics().find((topic) => topic.id === id);
    if (!entry) { renderError('Este tema aún no está disponible.', 'Puedes elegir otro tema o actualizar el catálogo.'); return; }
    actionBar.hidden = true;
    app.innerHTML = '<div class="loading" role="status"><span class="loading-dot"></span>Abriendo tu siguiente paso…</div>';
    try {
      const topic = await loadTopic(entry); if (token !== routeToken) return;
      currentTopic = topic; selectedCourse = topic.course; currentProgress = topicState(topic);
      reviewQueue = null; reviewAnswers = {}; transientRetry = false;
      if (updateURL) setURL(topicURL(topic, !!currentProgress.completedAt));
      document.title = `${topic.title} · Beca 18 | CursoTube`;
      event('beca18_learning_start');
      if (currentProgress.completedAt) renderResult();
      else { stepIndex = Math.min(Math.max(currentProgress.cursor || 0, 0), topic.steps.length - 1); renderStep(); if (resultRequested) notice('Este enlace abre el tema para que tú también puedas aprender.'); }
      scrollTop(); focusHeading();
    } catch { if (token === routeToken) renderError('No pudimos abrir el tema.', 'Revisa tu conexión. Conservamos tu avance y puedes volver a intentarlo.', id); }
  }
  function activeSteps() { return reviewQueue ? reviewQueue.map((index) => currentTopic.steps[index]) : currentTopic.steps; }
  function currentStep() { return activeSteps()[stepIndex]; }
  function answerFor(step) { return reviewQueue ? reviewAnswers[step.id] : currentProgress.answers[step.id]; }
  function renderStep() {
    document.body.classList.add('in-lesson'); actionBar.hidden = false;
    const steps = activeSteps(), step = steps[stepIndex]; selectedChoice = null; transientRetry = false;
    const answer = answerFor(step); const isQuestion = step.type === 'question';
    const percent = Math.round(stepIndex / steps.length * 100);
    app.innerHTML = `<div class="lesson-top"><div class="lesson-nav"><button class="back-button" type="button" data-action="catalog" aria-label="Volver al catálogo">‹</button><div class="progress-wrap"><div class="progress-head"><span>${reviewQueue ? 'Repaso de tus errores' : `Nivel ${step.level} de 3`}</span><span>Paso ${stepIndex + 1} de ${steps.length}</span></div><div class="progress-track" role="progressbar" aria-label="Avance del tema" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${stepIndex}"><div class="progress-fill" style="width:${percent}%"></div></div></div><button type="button" class="icon-button" data-action="share-panel" aria-label="Compartir este tema">↗</button></div><p class="lesson-topic">${esc(currentTopic.title)}</p></div>
      <div class="level-label"><span class="level-dots" aria-hidden="true">${'●'.repeat(step.level)}${'○'.repeat(3 - step.level)}</span>${esc(LEVELS[step.level - 1])}</div>
      <article class="step"><p class="step-type">${esc(TYPE_NAMES[step.type])}</p><h1 id="view-heading" class="step-heading">${esc(step.title)}</h1><div class="step-body">${paragraphs(step.body)}</div>
      ${step.passage ? `<section class="passage" aria-label="Texto de lectura"><h3>${esc(step.passage.title || 'Lee con atención')}</h3>${paragraphs(step.passage.paragraphs)}</section>` : ''}
      ${step.diagram ? '<div id="step-explorer" class="explorer"></div>' : ''}
      ${!isQuestion && step.solution?.length ? `<section class="solution-box"><h3>Así se resuelve</h3><ol>${step.solution.map((text) => `<li>${esc(text)}</li>`).join('')}</ol></section>` : ''}
      ${isQuestion ? `<p class="question-prompt">${esc(step.prompt)}</p><div class="choices" role="group" aria-label="Opciones de respuesta">${step.choices.map((choice, index) => `<button type="button" class="choice" data-action="choose" data-choice="${index}" aria-pressed="false"><span class="choice-letter" aria-hidden="true">${String.fromCharCode(65 + index)}</span><span>${esc(choice.text)}</span></button>`).join('')}</div>${step.hint ? `<details class="hint"><summary>Necesito una pista</summary><p>${esc(step.hint)}</p></details>` : ''}<div id="feedback" aria-live="polite"></div>` : ''}
      <div id="inline-share" hidden></div></article>`;
    if (step.diagram) mountDiagram($('#step-explorer'), step.diagram);
    if (answer) showFeedback(step, answer); else renderAction();
  }
  function renderAction() {
    const step = currentStep(), answer = answerFor(step), needsCheck = step.type === 'question' && (!answer || transientRetry);
    const last = stepIndex === activeSteps().length - 1;
    actionBar.innerHTML = `<div class="action-inner">${stepIndex > 0 ? '<button type="button" class="secondary" data-action="previous" aria-label="Paso anterior">←</button>' : ''}<button type="button" class="primary" data-action="${needsCheck ? 'check' : 'next'}" ${needsCheck && selectedChoice === null ? 'disabled' : ''}>${needsCheck ? 'Comprobar respuesta' : last ? reviewQueue ? 'Terminar repaso' : 'Completar tema' : 'Siguiente paso'} <span aria-hidden="true">${needsCheck ? '✓' : '→'}</span></button></div><p class="action-note">${needsCheck ? 'Elige una opción. Puedes consultar la pista.' : 'Tu avance se guarda en este dispositivo.'}</p>`;
  }
  function choose(index) {
    const step = currentStep(); if (step.type !== 'question' || (answerFor(step) && !transientRetry)) return;
    selectedChoice = index;
    document.querySelectorAll('.choice').forEach((button, i) => { button.classList.toggle('selected', i === index); button.setAttribute('aria-pressed', String(i === index)); });
    renderAction();
  }
  function checkAnswer() {
    const step = currentStep(); if (selectedChoice === null || step.type !== 'question') return;
    const old = answerFor(step), correct = selectedChoice === step.correct;
    const answer = { selected: selectedChoice, correct, attempts: (old?.attempts || 0) + 1, firstCorrect: old ? old.firstCorrect : correct };
    if (reviewQueue) reviewAnswers[step.id] = answer; else currentProgress.answers[step.id] = answer;
    if (correct) award(`${currentTopic.id}/${step.id}`, 10);
    recordDay(); save(); transientRetry = false; sound(correct ? 'correct' : 'error'); showFeedback(step, answer);
    $('#feedback').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
  }
  function showFeedback(step, answer) {
    document.querySelectorAll('.choice').forEach((button, i) => {
      button.disabled = true; button.classList.remove('selected'); button.classList.toggle('correct', i === step.correct); button.classList.toggle('incorrect', i === answer.selected && !answer.correct); button.setAttribute('aria-pressed', String(i === answer.selected));
    });
    $('#feedback').innerHTML = `<section class="feedback ${answer.correct ? '' : 'error'}"><h3>${answer.correct ? '¡Esa es la idea!' : 'Vamos a entenderlo'}</h3><p>${esc(step.choices[answer.selected].explanation)}</p>${step.solution?.length ? `<ol>${step.solution.map((text) => `<li>${esc(text)}</li>`).join('')}</ol>` : ''}<details class="option-review"><summary>Por qué funciona cada alternativa</summary>${step.choices.map((choice, index) => `<p><strong>${String.fromCharCode(65 + index)}. ${esc(choice.text)}${index === step.correct ? ' ✓' : ''}</strong><br>${esc(choice.explanation)}</p>`).join('')}</details>${!answer.correct ? '<button type="button" class="secondary" data-action="retry-question">Practicar esta pregunta otra vez</button>' : ''}</section>`;
    renderAction();
  }
  function retryQuestion() {
    transientRetry = true; selectedChoice = null;
    document.querySelectorAll('.choice').forEach((button) => { button.disabled = false; button.classList.remove('correct', 'incorrect', 'selected'); button.setAttribute('aria-pressed', 'false'); });
    $('#feedback').innerHTML = '<p class="completion-note">Tienes otro intento. El resultado conserva tu primera respuesta; cada intento te ayuda a aprender.</p>';
    renderAction(); document.querySelector('.choice')?.focus();
  }
  function nextStep() {
    const step = currentStep(); if (step.type === 'question' && !answerFor(step)) return;
    if (!reviewQueue) { if (!currentProgress.visited.includes(step.id)) currentProgress.visited.push(step.id); recordDay(); }
    if (stepIndex === activeSteps().length - 1) {
      if (reviewQueue) { reviewQueue = null; reviewAnswers = {}; save(); notice('Repaso terminado. Puedes repetirlo cuando quieras.'); renderResult(); }
      else completeTopic();
    } else {
      stepIndex++; if (!reviewQueue) currentProgress.cursor = stepIndex; save(); renderStep(); scrollTop(); focusHeading();
    }
  }
  function completeTopic() {
    const questions = currentTopic.steps.filter((step) => step.type === 'question');
    if (questions.some((step) => !currentProgress.answers[step.id])) { const missing = currentTopic.steps.findIndex((step) => step.type === 'question' && !currentProgress.answers[step.id]); stepIndex = missing; renderStep(); return; }
    const score = questions.filter((step) => currentProgress.answers[step.id]?.firstCorrect).length;
    currentProgress.completedAt = new Date().toISOString(); currentProgress.score = score;
    const stored = state.topics[currentTopic.id]; stored.completed = true; stored.bestScore = Math.max(stored.bestScore || 0, score / questions.length);
    award(`${currentTopic.id}/completed`, 50); recordDay(); save(); event('beca18_learning_complete'); sound('finish');
    setURL(topicURL(currentTopic, true), true); renderResult(); scrollTop(); focusHeading();
  }
  function shareHTML(result = false) {
    return `<section class="share-box"><h3>${result ? 'Aprender también se comparte' : 'Invita a alguien a aprender'}</h3><p>Comparte un enlace a este tema. Tu progreso y tus respuestas se quedan en este dispositivo.</p><div class="share-buttons"><button type="button" class="secondary" data-action="copy" data-result="${result}">Copiar enlace</button><button type="button" class="secondary whatsapp" data-action="whatsapp" data-result="${result}">WhatsApp ↗</button></div><div id="copy-fallback"></div></section>`;
  }
  function renderResult() {
    document.body.classList.remove('in-lesson'); actionBar.hidden = true;
    const questions = currentTopic.steps.filter((step) => step.type === 'question');
    const score = questions.filter((step) => currentProgress.answers[step.id]?.firstCorrect).length;
    const mistakes = questions.filter((step) => currentProgress.answers[step.id] && !currentProgress.answers[step.id].firstCorrect).length;
    const course = manifest.courses.find((item) => item.slug === currentTopic.course);
    const courseTopics = course?.topics || [];
    const courseDone = courseTopics.length > 0 && courseTopics.every((topic) => state.topics[topic.id]?.completed);
    const next = courseTopics.find((topic) => !state.topics[topic.id]?.versions?.[topic.version]?.completedAt && topic.id !== currentTopic.id);
    app.innerHTML = `<section class="result"><svg class="result-art" viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="68" fill="#f0eeff"/><circle cx="80" cy="80" r="51" fill="#e1dcff"/><path d="m80 40 12 25 28 4-20 20 5 28-25-14-25 14 5-28-20-20 28-4z" fill="#ffd363" stroke="#cc9b30" stroke-width="2"/><path d="m67 81 10 10 19-22" stroke="#936a13" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="38" r="6" fill="#24b49f"/><circle cx="137" cy="110" r="5" fill="#24b49f"/><path d="m129 28 2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="#9c8ae5"/></svg><span class="eyebrow">${courseDone ? '¡Completaste este curso!' : 'Un nuevo logro en tu camino'}</span><h1 id="view-heading">¡Tema completado!</h1><p>${esc(currentTopic.title)}<br>El esfuerzo de hoy ya forma parte de tu avance.</p><div class="result-stats"><div class="result-stat"><strong>${score}/${questions.length}</strong><span>aciertos al primer intento</span></div><div class="result-stat"><strong>${state.xp} XP</strong><span>experiencia acumulada</span></div></div><p class="completion-note">${currentTopic.steps.length} pasos recorridos · Logro guardado en este dispositivo</p>${mistakes ? `<button type="button" class="primary" data-action="review-errors">Repasar ${mistakes} pregunta${mistakes === 1 ? ' que costó' : 's que costaron'} →</button>` : '<p class="completion-note">¡Resolviste todas las preguntas al primer intento!</p>'}${next ? `<button type="button" class="${mistakes ? 'secondary' : 'primary'}" data-action="open" data-id="${esc(next.id)}">Siguiente: ${esc(next.title)} →</button>` : '<a class="primary" href="/beca18/reto/">Llevar lo aprendido al reto diario →</a>'}<button type="button" class="secondary" data-action="restart">Volver a recorrer este tema</button>${shareHTML(true)}<button type="button" class="text-button" data-action="catalog">← Ver todos los temas</button><a class="text-button" href="/beca18/">Ir a los simulacros</a></section>`;
    window.CT?.ads?.sync();
  }
  function reviewErrors() {
    reviewQueue = currentTopic.steps.map((step, index) => step.type === 'question' && currentProgress.answers[step.id] && !currentProgress.answers[step.id].firstCorrect ? index : -1).filter((index) => index >= 0);
    if (!reviewQueue.length) return; reviewAnswers = {}; stepIndex = 0; renderStep(); scrollTop(); focusHeading();
  }
  function restart() {
    currentProgress = { cursor: 0, visited: [], answers: {}, completedAt: null };
    state.topics[currentTopic.id].versions[currentTopic.version] = currentProgress;
    reviewQueue = null; stepIndex = 0; save(); setURL(topicURL(), true); renderStep(); scrollTop(); focusHeading();
  }
  async function copyLink(result) {
    const link = topicURL(currentTopic, result); let copied = false;
    try { await navigator.clipboard.writeText(link); copied = true; } catch {
      const area = document.createElement('textarea'); area.value = link; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
      try { copied = document.execCommand('copy'); } catch { /* Offer selectable text. */ } area.remove();
    }
    if (copied) { notice('Enlace copiado. Compártelo cuando quieras.'); event('beca18_learning_share', 'copy'); }
    else { const fallback = $('#copy-fallback'); if (fallback) fallback.innerHTML = `<p class="inline-error">Mantén pulsado el enlace para copiarlo:</p><span class="link-fallback">${esc(link)}</span>`; }
  }
  function whatsapp(result) {
    const text = `Estoy aprendiendo ${currentTopic.title} en CursoTube. Minilecciones gratis, con práctica explicada: ${topicURL(currentTopic, result)}`;
    const tu_variable_texto = encodeURIComponent(text);
    event('beca18_learning_share', 'whatsapp');
    window.location.href = "whatsapp://send?text=" + tu_variable_texto;
  }
  function backCatalog(push = true) { ++routeToken; if (push) setURL('/beca18/aprende/'); renderCatalog(); scrollTop(); focusHeading(); }
  async function route() {
    const params = new URLSearchParams(location.search), slug = params.get('topic'), course = params.get('course');
    if (slug && course) await openTopic(`${course}/${slug}`, params.get('result') === '1', false);
    else { if (course && manifest.courses.some((item) => item.slug === course)) selectedCourse = course; backCatalog(false); }
  }
  document.addEventListener('click', async (click) => {
    const button = click.target.closest('[data-action]'); if (!button || button.disabled) return;
    activateAudio();
    switch (button.dataset.action) {
      case 'course': selectedCourse = button.dataset.course; renderCatalog(); $(`#tab-${selectedCourse}`)?.focus({ preventScroll: true }); break;
      case 'open': await openTopic(button.dataset.id); break;
      case 'catalog': if (manifest) backCatalog(); else if (await refreshManifest()) backCatalog(); break;
      case 'reload': if (await refreshManifest()) route(); break;
      case 'choose': choose(Number(button.dataset.choice)); break;
      case 'check': checkAnswer(); break;
      case 'next': nextStep(); break;
      case 'previous': if (stepIndex > 0) { stepIndex--; if (!reviewQueue) { currentProgress.cursor = stepIndex; save(); } renderStep(); scrollTop(); focusHeading(); } break;
      case 'retry-question': retryQuestion(); break;
      case 'review-errors': reviewErrors(); break;
      case 'restart': restart(); break;
      case 'share-panel': { const panel = $('#inline-share'); panel.hidden = !panel.hidden; if (!panel.hidden) { panel.innerHTML = shareHTML(); panel.scrollIntoView({ block: 'start', behavior: 'smooth' }); } break; }
      case 'copy': await copyLink(button.dataset.result === 'true'); break;
      case 'whatsapp': whatsapp(button.dataset.result === 'true'); break;
    }
  });
  document.addEventListener('keydown', (key) => {
    const tab = key.target.closest('[role=tab]'); if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key.key)) return;
    key.preventDefault(); const courses = manifest.courses; const index = courses.findIndex((course) => course.slug === selectedCourse);
    const next = key.key === 'Home' ? 0 : key.key === 'End' ? courses.length - 1 : (index + (key.key === 'ArrowRight' ? 1 : -1) + courses.length) % courses.length;
    selectedCourse = courses[next].slug; renderCatalog(); $(`#tab-${selectedCourse}`)?.focus({ preventScroll: true });
  });
  $('#sound').addEventListener('click', () => { state.muted = !state.muted; save(); if (!state.muted) { activateAudio(); sound('correct'); } notice(state.muted ? 'Sonidos silenciados.' : 'Sonidos activados.'); });
  window.addEventListener('popstate', () => { if (manifest) route(); });
  window.addEventListener('focus', () => { refreshManifest(true); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshManifest(true); });

  // All diagrams use bounded numbers and escaped text. No content-provided HTML is executed.
  function number(value, fallback, min, max) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
  const svg = (body, label, viewBox = '0 0 360 200') => `<svg viewBox="${viewBox}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  function mountDiagram(host, diagram) {
    if (!host) return;
    if (diagram.kind === 'fraction') mountFraction(host, diagram);
    else if (diagram.kind === 'numberline') mountNumberline(host, diagram);
    else if (diagram.kind === 'factors') mountFactors(host, diagram);
    else if (diagram.kind === 'balance') mountBalance(host, diagram);
    else if (diagram.kind === 'textmap') mountTextmap(host, diagram);
    else if (diagram.kind === 'highlight') mountHighlight(host, diagram);
  }
  function mountFraction(host, config) {
    let denominator = Math.round(number(config.denominator, 4, 2, 12)), numerator = Math.round(number(config.numerator, 3, 0, denominator));
    host.innerHTML = '<h3>Construye una fracción</h3><div data-graphic></div><label>Partes iguales del entero <input aria-label="Denominador" data-den type="range" min="2" max="12"></label><label>Partes que tomas <input aria-label="Numerador" data-num type="range" min="0"></label><output aria-live="polite"></output><p class="explainer">El denominador indica en cuántas partes iguales dividimos el entero. El numerador cuenta cuántas tomamos.</p>';
    const draw = () => {
      $('[data-den]', host).value = denominator; $('[data-num]', host).max = denominator; $('[data-num]', host).value = numerator;
      const width = 304 / denominator;
      $('[data-graphic]', host).innerHTML = svg(Array.from({ length: denominator }, (_, i) => `<rect x="${28 + i * width}" y="42" width="${width}" height="70" fill="${i < numerator ? '#7462df' : '#fff'}" stroke="#5147a9" stroke-width="2"/>`).join('') + `<text x="180" y="155" text-anchor="middle" fill="#17223b" font-size="25" font-weight="800">${numerator} / ${denominator}</text>`, `${numerator} de ${denominator} partes iguales coloreadas`);
      const decimal = numerator / denominator;
      const sign = Math.abs(decimal - Math.round(decimal * 1000) / 1000) > 1e-12 ? '≈' : '=';
      $('output', host).textContent = `${numerator}/${denominator} ${sign} ${decimal.toLocaleString('es-PE', { maximumFractionDigits: 3 })} del entero`;
    };
    $('[data-den]', host).addEventListener('input', (e) => { denominator = Number(e.target.value); numerator = Math.min(numerator, denominator); draw(); });
    $('[data-num]', host).addEventListener('input', (e) => { numerator = Number(e.target.value); draw(); }); draw();
  }
  function mountNumberline(host, config) {
    let min = Math.round(number(config.min, -10, -30, 0)), max = Math.round(number(config.max, 10, 1, 30)), value = number(config.value, 0, min, max);
    host.innerHTML = `<h3>Muévete en la recta</h3><div data-graphic></div><label>Elige un número <input aria-label="Número en la recta" type="range" min="${min}" max="${max}" value="${value}" step="1"></label><output aria-live="polite"></output><p class="explainer">A la derecha los números aumentan; a la izquierda disminuyen. La distancia hasta cero es el valor absoluto.</p>`;
    const draw = () => {
      const x = (n) => 28 + (n - min) / (max - min) * 304;
      const spacing = Math.max(1, Math.ceil((max - min) / 10));
      let ticks = ''; for (let n = min; n <= max; n++) if (n === 0 || n % spacing === 0) ticks += `<path d="M${x(n)} 84v14" stroke="#a4aec3"/><text x="${x(n)}" y="121" text-anchor="middle" fill="#526078" font-size="13">${n}</text>`;
      $('[data-graphic]', host).innerHTML = svg(`<path d="M20 90h320" stroke="#8090ad" stroke-width="3"/><path d="M${x(0)} 90H${x(value)}" stroke="#7462df" stroke-width="6"/>${ticks}<circle cx="${x(value)}" cy="90" r="9" fill="#5147d9"/><text x="${x(value)}" y="62" text-anchor="middle" fill="#5147d9" font-size="23" font-weight="800">${value}</text>`, `Punto en ${value}, a ${Math.abs(value)} unidades de cero`);
      $('output', host).textContent = `${value} · distancia a cero: ${Math.abs(value)}`;
    }; $('input', host).addEventListener('input', (e) => { value = Number(e.target.value); draw(); }); draw();
  }
  function mountFactors(host, config) {
    let value = Math.round(number(config.value, 24, 2, 60));
    host.innerHTML = `<h3>Encuentra parejas de factores</h3><label>Número que vamos a descomponer <input aria-label="Número para explorar factores" type="range" min="2" max="60" value="${value}"></label><div data-graphic></div><output aria-live="polite"></output><p class="explainer">Cada pareja multiplica exactamente el número. Sus componentes son divisores positivos. Un primo solo tiene la pareja 1 × él mismo.</p>`;
    const draw = () => {
      const pairs = []; for (let n = 1; n <= Math.sqrt(value); n++) if (value % n === 0) pairs.push([n, value / n]);
      $('[data-graphic]', host).innerHTML = `<div class="control-row">${pairs.map(([a, b], i) => `<button type="button" data-pair="${i}" aria-pressed="${i === 0}">${a} × ${b}</button>`).join('')}</div><div data-array></div>`;
      const choose = (index) => {
        const [rows, columns] = pairs[index]; const size = Math.min(16, 300 / columns); const start = (360 - columns * size) / 2;
        $('[data-array]', host).innerHTML = svg(Array.from({ length: value }, (_, i) => `<rect x="${start + i % columns * size}" y="${35 + Math.floor(i / columns) * size}" width="${size - 2}" height="${size - 2}" rx="2" fill="#7462df"/>`).join(''), `${rows} filas y ${columns} columnas: ${value} unidades`, '0 0 360 160');
        host.querySelectorAll('[data-pair]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
        $('output', host).textContent = `${rows} × ${columns} = ${value} · ${pairs.length} pareja${pairs.length === 1 ? '' : 's'}`;
      }; host.querySelectorAll('[data-pair]').forEach((button) => button.addEventListener('click', () => choose(Number(button.dataset.pair)))); choose(0);
    }; $('input', host).addEventListener('input', (e) => { value = Number(e.target.value); draw(); }); draw();
  }
  function mountBalance(host, config) {
    const offset = Math.round(number(config.offset, 3, -10, 10)), total = Math.round(number(config.total, 11, -20, 20)); let removed = false;
    host.innerHTML = `<h3>La igualdad se cuida en ambos lados</h3><div data-graphic></div><div class="control-row"><button type="button" data-operation>Restar ${offset} en ambos lados</button><button type="button" data-reset>Restablecer</button></div><output aria-live="polite"></output><p class="explainer">Una misma operación en ambos miembros conserva la igualdad. Aquí la incógnita vale ${total - offset}; al quitar ${offset} de ambos lados queda aislada.</p>`;
    const draw = () => {
      const left = removed ? 'x' : `x ${offset < 0 ? '−' : '+'} ${Math.abs(offset)}`, right = removed ? total - offset : total;
      $('[data-graphic]', host).innerHTML = svg(`<path d="m180 80-32 96h64z" fill="#ddd8f6"/><path d="M60 72h240" stroke="#67748e" stroke-width="6" stroke-linecap="round"/><path d="M80 72v65m200-65v65" stroke="#a6adc0" stroke-width="3"/><rect x="27" y="120" width="107" height="43" rx="14" fill="#edeaff"/><rect x="227" y="120" width="107" height="43" rx="14" fill="#e2f4ec"/><text x="80" y="148" text-anchor="middle" font-size="21" fill="#3930af" font-weight="800">${left}</text><text x="280" y="148" text-anchor="middle" font-size="23" fill="#087f76" font-weight="800">${right}</text><text x="180" y="46" text-anchor="middle" fill="#17223b" font-size="23" font-weight="800">${left} = ${right}</text>`, `${left} es igual a ${right}`);
      $('output', host).textContent = removed ? `x = ${total - offset}. Comprobación: ${total - offset} + (${offset}) = ${total}.` : `x + (${offset}) = ${total}`;
      $('[data-operation]', host).disabled = removed;
    }; $('[data-operation]', host).addEventListener('click', () => { removed = true; draw(); }); $('[data-reset]', host).addEventListener('click', () => { removed = false; draw(); }); draw();
  }
  function mountTextmap(host, config) {
    const nodes = Array.isArray(config.nodes) ? config.nodes.slice(0, 12) : [];
    host.innerHTML = `<h3>Abre el mapa de ideas</h3><p class="explainer">Toca cada idea para descubrir cómo se organiza el texto.</p><div class="text-nodes">${nodes.map((node, i) => `<button type="button" class="text-node" aria-expanded="false" data-node="${i}">${esc(node.label)}<span class="node-text" hidden>${esc(node.text)}</span></button>`).join('')}</div>`;
    host.querySelectorAll('[data-node]').forEach((button) => button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); $('.node-text', button).hidden = !open; }));
  }
  function mountHighlight(host, config) {
    const fragments = Array.isArray(config.fragments) ? config.fragments.slice(0, 20) : [];
    host.innerHTML = `<h3>Lee las piezas del texto</h3><p class="explainer">Selecciona un fragmento para descubrir su función o sentido.</p><div class="fragment-list">${fragments.map((fragment, i) => `<button type="button" class="fragment" aria-pressed="false" data-fragment="${i}">${esc(fragment.text)}</button>`).join('')}</div><output aria-live="polite">Toca un fragmento para explorarlo.</output>`;
    host.querySelectorAll('[data-fragment]').forEach((button) => button.addEventListener('click', () => { host.querySelectorAll('[data-fragment]').forEach((item) => item.setAttribute('aria-pressed', String(item === button))); $('output', host).textContent = fragments[Number(button.dataset.fragment)].role; }));
  }
  function mountGeometry(host) {
    let n = 6, measure = 'radius';
    host.innerHTML = '<h3>Un polígono dentro de un círculo</h3><div class="control-row" aria-label="Polígono"><button type="button" data-n="3" aria-pressed="false">Triángulo</button><button type="button" data-n="4" aria-pressed="false">Cuadrado</button><button type="button" data-n="6" aria-pressed="true">Hexágono</button></div><div data-graphic></div><div class="control-row" aria-label="Segmento destacado"><button type="button" data-measure="radius" aria-pressed="true">Radio</button><button type="button" data-measure="apothem" aria-pressed="false">Apotema</button><button type="button" data-measure="diagonal" aria-pressed="false">Diagonal</button></div><output aria-live="polite"></output><p class="explainer" data-explanation></p>';
    const draw = () => {
      const points = Array.from({ length: n }, (_, i) => { const angle = -Math.PI / 2 + i * 2 * Math.PI / n; return [180 + 82 * Math.cos(angle), 102 + 82 * Math.sin(angle)]; });
      let segment = '', text = '', description = '';
      if (measure === 'radius') { segment = `<path d="M180 102L${points[0].join(' ')}"/>`; text = 'Radio = 2 unidades'; description = 'El radio va del centro a un punto de la circunferencia. Todos los vértices están a la misma distancia del centro.'; }
      if (measure === 'apothem') { const midpoint = [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2]; segment = `<path d="M180 102L${midpoint.join(' ')}"/>`; text = `Apotema ${n === 3 ? '=' : '≈'} ${(2 * Math.cos(Math.PI / n)).toLocaleString('es-PE', { maximumFractionDigits: 3 })} unidades`; description = 'La apotema une el centro con el punto medio de un lado y es perpendicular a ese lado. En un polígono regular es menor que el radio.'; }
      if (measure === 'diagonal') { if (n === 3) { text = 'El triángulo no tiene diagonales'; description = 'Una diagonal une dos vértices no consecutivos. En un triángulo todos los pares de vértices son consecutivos.'; } else { segment = `<path d="M${points[0].join(' ')}L${points[2].join(' ')}"/>`; text = `Esta diagonal ${n === 4 ? '=' : '≈'} ${(4 * Math.sin(2 * Math.PI / n)).toLocaleString('es-PE', { maximumFractionDigits: 3 })} unidades`; description = 'Una diagonal une dos vértices no consecutivos. En el hexágono hay diagonales de distintas longitudes; aquí se salta un vértice.'; } }
      $('[data-graphic]', host).innerHTML = svg(`<circle cx="180" cy="102" r="82" fill="#e5f5fa" stroke="#8bc6d9" stroke-width="2"/><polygon points="${points.map((point) => point.join(',')).join(' ')}" fill="#d1eaf055" stroke="#309ab9" stroke-width="2"/><g stroke="#dd8e21" stroke-width="5" stroke-linecap="round">${segment}</g>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#167f9b"/>`).join('')}<circle cx="180" cy="102" r="4" fill="#17223b"/>`, `${n} lados, círculo de radio 2. ${text}`, '0 0 360 205');
      $('output', host).textContent = text; $('[data-explanation]', host).textContent = description;
      host.querySelectorAll('[data-n]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.n) === n)));
      host.querySelectorAll('[data-measure]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.measure === measure)));
    }; host.querySelectorAll('[data-n]').forEach((button) => button.addEventListener('click', () => { n = Number(button.dataset.n); draw(); })); host.querySelectorAll('[data-measure]').forEach((button) => button.addEventListener('click', () => { measure = button.dataset.measure; draw(); })); draw();
  }
  syncHeader();
  refreshManifest().then((loaded) => { if (loaded) route(); });
})();
