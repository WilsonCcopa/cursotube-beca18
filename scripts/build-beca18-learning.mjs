import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readTopics, dataRoot } from './validate-beca18-learning.mjs';

const definitions = {
  matematica: { title: 'Matemática', shortTitle: 'Matemática', description: 'De los números al álgebra: entiende las bases y úsalas para resolver problemas.' },
  lectura: { title: 'Competencia lectora y razonamiento verbal', shortTitle: 'Lectura y verbal', description: 'Lee con intención, interpreta el contexto y descubre las relaciones entre ideas.' }
};
try {
  const topics = await readTopics();
  topics.sort((a, b) => a.topic.course.localeCompare(b.topic.course) || a.topic.order - b.topic.order || a.topic.slug.localeCompare(b.topic.slug));
  const revision = createHash('sha256').update(topics.map(({ file, raw }) => `${file}\n${raw}`).join('\n')).digest('hex').slice(0, 20);
  const slugs = [...new Set(topics.map(({ topic }) => topic.course))].sort((a, b) => (a === 'matematica' ? -1 : b === 'matematica' ? 1 : a.localeCompare(b)));
  const courses = slugs.map((slug) => ({ slug, ...(definitions[slug] || { title: slug, shortTitle: slug, description: 'Aprende con ejemplos y práctica explicada.' }), topics: topics.filter(({ topic }) => topic.course === slug).map(({ topic, file, raw }) => ({
    id: topic.id, course: topic.course, slug: topic.slug, title: topic.title, description: topic.description, version: topic.version, order: topic.order, estimatedMinutes: topic.estimatedMinutes, objectives: topic.objectives, steps: topic.steps.length, questionCount: topic.steps.filter((step) => step.type === 'question').length, file, sha256: createHash('sha256').update(raw).digest('hex')
  })) }));
  const manifest = { schemaVersion: 1, revision, courses };
  const output = JSON.stringify(manifest, null, 2) + '\n'; const path = join(dataRoot, 'manifest.json');
  if (process.argv.includes('--check')) {
    const existing = await readFile(path, 'utf8'); if (existing !== output) throw new Error('Manifest desactualizado. Ejecuta node scripts/build-beca18-learning.mjs');
    console.log(`Manifest vigente: ${topics.length} temas; revisión ${revision}.`);
  } else { await writeFile(path, output); console.log(`Manifest generado: ${topics.length} temas; revisión ${revision}.`); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
