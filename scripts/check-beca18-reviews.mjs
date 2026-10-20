import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { packageRoot, readTopics } from './validate-beca18-learning.mjs';
const read=async name=>JSON.parse(await readFile(join(packageRoot,'qa',name),'utf8'));
const a=await read('review-math-a.json'),b=await read('review-math-b-root.json'),v=await read('review-verbal.json');
assert.equal(a.summary.unresolved,0);assert.equal(a.summary.questions,144);assert.equal(b.status,'passed');assert.equal(b.questions,252);assert.equal(b.deepExplanationsReview.status,'passed');assert.equal(v.reviewedQuestions,252);assert.equal(v.issues.length,0);
const reviewed=new Set([...a.questions,...b.questionsReview,...v.results].map(question=>question.id));
assert.equal(reviewed.size,648,'Revisión independiente de todas las preguntas nuevas');
const snapshot=await read('reviewed-content.json');const hashes=new Map(snapshot.questions.map(row=>[row.id,row.sha256]));
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
let count=0;for(const {topic} of await readTopics())if(topic.order>5)for(const step of topic.steps)if(step.type==='question'){
  assert.ok(reviewed.has(step.id),`Pregunta sin revisión: ${step.id}`);
  const hash=createHash('sha256').update(JSON.stringify(canonical(step))).digest('hex');assert.equal(hash,hashes.get(step.id),`Cambió después de la revisión: ${step.id}`);count++;
}
assert.equal(count,648);console.log(JSON.stringify({passed:true,newQuestionsIndependentlyReviewed:count,distractorExplanationsReviewed:1944,unresolved:0},null,2));
