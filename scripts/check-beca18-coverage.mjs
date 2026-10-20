import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { packageRoot, dataRoot, readTopics } from './validate-beca18-learning.mjs';

const coverage=JSON.parse(await readFile(join(packageRoot,'coverage-matrix.json'),'utf8'));
const topics=await readTopics(); const byId=new Map(topics.map(({topic})=>[topic.id,topic]));
assert.equal(coverage.schemaVersion,1);
assert.equal(coverage.chapters.length,48,'Deben estar los24capítulos de cada libro');
assert.equal(coverage.officialIndicators.length,43,'Se cubren los43indicadores de la fuente consultada');
assert.equal(coverage.topics.length,64,'38 temas matemáticos y26 de lectura');
assert.equal(topics.length,coverage.topics.length,'No debe faltar ni sobrar un tema fuera de la matriz');
for(const row of coverage.topics){
  const topic=byId.get(row.id);assert.ok(topic,`Falta ${row.id}`);assert.equal(row.status,'complete',`${row.id} pendiente`);assert.equal(topic.order,row.order);
  assert.ok(row.subtopics.length>=3,`${row.id}: matriz de subtemas insuficiente`);
  const steps=new Set(topic.steps.map(s=>s.id));
  for(const sub of row.subtopics){assert.ok(sub.label&&sub.stepIds.length,`${row.id}: subtema sin evidencia`);for(const id of sub.stepIds)assert.ok(steps.has(id),`${row.id}: paso inexistente ${id}`);}
}
for(const row of [...coverage.chapters,...coverage.officialIndicators]){
  assert.equal(row.status,'complete',`Cobertura pendiente: ${row.course||''} ${row.chapter||row.code}`);
  for(const id of row.topicIds)assert.ok(byId.has(id),`Referencia a tema inexistente: ${id}`);
  if(row.subtopics)for(const sub of row.subtopics)for(const id of sub.stepIds)assert.ok(byId.get(sub.topicId).steps.some(step=>step.id===id),`Paso no encontrado en capítulo: ${id}`);
}
const baseline=JSON.parse(await readFile(join(packageRoot,'qa/published-baseline.json'),'utf8'));
assert.equal(baseline.topics.length,10);
for(const row of baseline.topics){const raw=await readFile(join(dataRoot,row.file));const normalized=raw.toString('utf8').replace(/\r\n/g,'\n');assert.equal(createHash('sha256').update(row.normalizedSha256?normalized:raw).digest('hex'),row.normalizedSha256||row.sha256,`Se alteró el tema publicado ${row.id}`);assert.equal(byId.get(row.id).version,1);}
console.log(JSON.stringify({passed:true,topics:topics.length,chapters:48,officialIndicators:43,publishedTopicsUnchanged:10,subtopics:coverage.topics.reduce((sum,row)=>sum+row.subtopics.length,0)},null,2));
