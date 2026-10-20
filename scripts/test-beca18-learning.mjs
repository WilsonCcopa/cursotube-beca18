import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readTopics, dataRoot, packageRoot, validateTopic } from './validate-beca18-learning.mjs';

const topics = await readTopics();
const manifest = JSON.parse(await readFile(join(dataRoot, 'manifest.json'), 'utf8'));
const entries = manifest.courses.flatMap((course) => course.topics);
assert.equal(entries.length, topics.length, 'Cada tema debe aparecer automáticamente en manifest');
for (const { topic, raw, file } of topics) {
  const entry = entries.find((item) => item.id === topic.id);
  assert.ok(entry, `Falta ${topic.id}`);
  assert.equal(entry.file, file);
  assert.equal(entry.steps, topic.steps.length);
  assert.equal(entry.questionCount, topic.steps.filter((step) => step.type === 'question').length);
  assert.equal(entry.sha256, createHash('sha256').update(raw).digest('hex'));
  assert.equal(entry.version, topic.version);
}
const baseline = topics[0].topic;
const brokenAnswer = structuredClone(baseline);
brokenAnswer.steps.find((step) => step.type === 'question').correct = 99;
assert.ok(validateTopic(brokenAnswer).some((message) => message.includes('correct fuera de rango')));
const brokenDuplicate = structuredClone(baseline);
brokenDuplicate.steps[1].id = brokenDuplicate.steps[0].id;
assert.ok(validateTopic(brokenDuplicate).some((message) => message.includes('id único')));
const brokenExplanation = structuredClone(baseline);
brokenExplanation.steps.find((step) => step.type === 'question').choices[0].explanation = '';
assert.ok(validateTopic(brokenExplanation).some((message) => message.includes('explicar cada')));
const brokenDiagram = structuredClone(baseline);
brokenDiagram.steps.find((step) => step.type === 'explore').diagram = { kind: 'fraction', numerator: 9, denominator: 0 };
assert.ok(validateTopic(brokenDiagram).some((message) => message.includes('fracción fuera')));
const future = structuredClone(baseline);
future.slug = 'tema-futuro'; future.id = `${future.course}/${future.slug}`; future.version = 2;
assert.deepEqual(validateTopic(future), [], 'El contrato admite nuevos temas sin cambiar el reproductor');
const code = await readFile(join(packageRoot, 'public/js/beca18-learning.js'), 'utf8');
assert.doesNotMatch(code, /\b(?:alert|confirm|prompt)\s*\(|window\.open\s*\(|target\s*=\s*["']_blank/);
assert.ok(code.includes('window.location.href = "whatsapp://send?text=" + tu_variable_texto;'));
// Independent boundary checks for the highest-risk numeric content.
for (let x = -20; x <= 20; x++) assert.equal(-3 * x + 6 >= 15, x <= -3);
const validDigits = Array.from({ length: 10 }, (_, digit) => digit).filter((digit) => (306 + digit * 10) % 4 === 0 && (306 + digit * 10) % 9 === 0);
assert.deepEqual(validDigits, [9]);
assert.equal(80 * 3 / 4 * 2 / 3, 40);
const coincidences = Array.from({ length: 180 }, (_, index) => index + 1).filter((minute) => minute % 15 === 0 && minute % 20 === 0);
assert.deepEqual(coincidences, [60, 120, 180]);
for (const n of [3, 4, 6]) assert.ok(2 * Math.cos(Math.PI / n) < 2);
assert.ok(Math.abs(2 * Math.cos(Math.PI / 4) - Math.sqrt(2)) < 1e-12);
console.log(JSON.stringify({ passed: true, topics: topics.length, steps: topics.reduce((sum, { topic }) => sum + topic.steps.length, 0), questions: entries.reduce((sum, entry) => sum + entry.questionCount, 0), checks: ['manifest completeness and SHA-256', 'reject invalid answers and duplicate IDs', 'require alternative explanations and bounded diagrams', 'future content contract', 'WhatsApp and native-dialog restrictions', 'numeric boundary checks'] }, null, 2));
