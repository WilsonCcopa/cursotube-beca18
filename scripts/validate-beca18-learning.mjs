import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dataRoot = join(packageRoot, 'public/data/beca18-learning');
const slugPattern = /^[a-z][a-z0-9-]*$/;
const kinds = new Set(['learn', 'example', 'explore', 'question', 'review']);
const diagramKinds = new Set(['fraction', 'numberline', 'factors', 'balance', 'textmap', 'highlight']);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.length > 0 && value.every(text);
export function validateTopic(topic, file = 'topic.json') {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(`${file}: ${message}`); };
  check(topic?.schemaVersion === 1, 'schemaVersion debe ser 1');
  check(slugPattern.test(topic?.course || ''), 'course inválido');
  check(slugPattern.test(topic?.slug || ''), 'slug inválido');
  check(topic?.id === `${topic?.course}/${topic?.slug}`, 'id debe ser course/slug');
  for (const field of ['title', 'description']) check(text(topic?.[field]), `${field} requerido`);
  check(Number.isInteger(topic?.version) && topic.version >= 1, 'version debe ser entero positivo');
  check(Number.isInteger(topic?.order) && topic.order >= 1, 'order debe ser entero positivo');
  check(Number.isFinite(topic?.estimatedMinutes) && topic.estimatedMinutes > 0, 'estimatedMinutes debe ser positivo');
  check(list(topic?.objectives), 'objectives requiere textos');
  check(Array.isArray(topic?.steps) && topic.steps.length >= 24, 'mínimo 24 pasos completos');
  if (!Array.isArray(topic?.steps)) return errors;
  const ids = new Set(); let questions = 0;
  for (const [index, step] of topic.steps.entries()) {
    const label = `paso ${index + 1}`;
    check(text(step.id) && slugPattern.test(step.id) && !ids.has(step.id), `${label}: id único válido requerido`); ids.add(step.id);
    check(kinds.has(step.type), `${label}: type no soportado`);
    check([1, 2, 3].includes(step.level), `${label}: level debe ser 1, 2 o 3`);
    check(text(step.title), `${label}: title requerido`);
    check(Array.isArray(step.body) && step.body.every(text), `${label}: body debe ser array de párrafos`);
    if (step.type !== 'question') check(step.body?.length > 0, `${label}: explicación vacía`);
    if (step.passage) check(text(step.passage.title) && list(step.passage.paragraphs), `${label}: lectura incompleta`);
    if (step.type === 'question') {
      questions++;
      check(text(step.prompt), `${label}: prompt requerido`);
      check(Array.isArray(step.choices) && step.choices.length >= 3 && step.choices.length <= 5, `${label}: 3 a 5 alternativas requeridas`);
      check(step.choices?.every((choice) => text(choice.text) && text(choice.explanation)), `${label}: explicar cada alternativa`);
      check(new Set(step.choices?.map((choice) => choice.text.trim().toLocaleLowerCase()) || []).size === step.choices?.length, `${label}: alternativas duplicadas`);
      check(Number.isInteger(step.correct) && step.correct >= 0 && step.correct < (step.choices?.length || 0), `${label}: correct fuera de rango`);
      check(text(step.hint) && list(step.solution), `${label}: pista y solución razonada requeridas`);
    }
    if (step.type === 'explore') check(!!step.diagram, `${label}: explore necesita diagrama`);
    if (step.diagram) {
      const d = step.diagram;
      check(diagramKinds.has(d.kind), `${label}: diagrama no soportado`);
      if (d.kind === 'fraction') check(Number.isInteger(d.denominator) && d.denominator >= 2 && d.denominator <= 12 && Number.isInteger(d.numerator) && d.numerator >= 0 && d.numerator <= d.denominator, `${label}: fracción fuera de límites`);
      if (d.kind === 'numberline') check(Number.isInteger(d.min) && Number.isInteger(d.max) && d.min <= 0 && d.min >= -30 && d.max > 0 && d.max <= 30 && Number.isInteger(d.value) && d.value >= d.min && d.value <= d.max, `${label}: recta inválida`);
      if (d.kind === 'factors') check(Number.isInteger(d.value) && d.value >= 2 && d.value <= 60, `${label}: factores entre 2 y 60`);
      if (d.kind === 'balance') check(Number.isInteger(d.offset) && d.offset >= -10 && d.offset <= 10 && Number.isInteger(d.total) && d.total >= -20 && d.total <= 20, `${label}: balanza fuera de límites`);
      if (d.kind === 'textmap') check(Array.isArray(d.nodes) && d.nodes.length > 1 && d.nodes.length <= 12 && d.nodes.every((node) => text(node.label) && text(node.text)), `${label}: mapa incompleto`);
      if (d.kind === 'highlight') check(Array.isArray(d.fragments) && d.fragments.length > 1 && d.fragments.length <= 20 && d.fragments.every((fragment) => text(fragment.text) && text(fragment.role)), `${label}: fragmentos incompletos`);
    }
  }
  check(questions >= 12, 'mínimo 12 preguntas con explicación');
  for (const level of [1, 2, 3]) {
    const steps = topic.steps.filter((step) => step.level === level);
    check(steps.length >= 8, `nivel ${level}: mínimo 8 pasos`);
    check(steps.some((step) => step.type === 'learn'), `nivel ${level}: base conceptual requerida`);
    check(steps.some((step) => step.type === 'example'), `nivel ${level}: ejemplo resuelto requerido`);
    check(steps.some((step) => step.type === 'review'), `nivel ${level}: repaso de errores requerido`);
    check(steps.filter((step) => step.type === 'question').length >= 4, `nivel ${level}: mínimo 4 preguntas`);
  }
  return errors;
}
async function discover(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`No se admiten enlaces simbólicos: ${path}`);
    if (entry.isDirectory()) files.push(...await discover(path));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path);
  }
  return files;
}
export async function readTopics(root = dataRoot) {
  const files = await discover(join(root, 'topics')); const topics = []; const errors = []; const ids = new Set();
  for (const path of files) {
    const file = relative(root, path).replaceAll('\\', '/');
    try {
      const raw = await readFile(path, 'utf8'); const topic = JSON.parse(raw.replace(/^\uFEFF/, ''));
      errors.push(...validateTopic(topic, file));
      if (ids.has(topic.id)) errors.push(`${file}: id repetido entre archivos`); ids.add(topic.id);
      if (file !== `topics/${topic.course}/${topic.slug}.json`) errors.push(`${file}: ruta no coincide con course/slug`);
      topics.push({ topic, file, raw });
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  if (!topics.length) errors.push('No se encontraron temas JSON.');
  if (errors.length) throw new Error(errors.join('\n'));
  return topics;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const topics = await readTopics();
    console.log(JSON.stringify({ valid: true, topics: topics.length, steps: topics.reduce((sum, { topic }) => sum + topic.steps.length, 0), questions: topics.reduce((sum, { topic }) => sum + topic.steps.filter((step) => step.type === 'question').length, 0) }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
