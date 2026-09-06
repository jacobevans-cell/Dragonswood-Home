import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [portal,runtime,arcadeFunction,coachFunction,arcadePage]=await Promise.all([
  read('v33-integration/js/student-app.js'),
  read('v33-integration/js/integration/home-runtime.js'),
  read('functions-arcade-access/index.js'),
  read('functions-academic-ai/index.js'),
  read('arcade/index.html')
]);

assert.match(portal,/Dragon Arcade','Open anytime • no tokens/);
assert.match(portal,/data-writing-coach/);
assert.match(runtime,/httpsCallable\(functions,'coachHomeWriting'\)/);
assert.match(arcadeFunction,/homeAccess\?'home-family'/);
assert.match(arcadeFunction,/freeAccess=homeAccess\|\|testerOverride/);
assert.match(arcadePage,/No Tokens needed/);

const schema=coachFunction.match(/const HOME_WRITING_SCHEMA=(.*);\nconst homeWritingLevel/s)?.[1]||'';
assert.ok(schema,'Home writing schema must exist.');
assert.doesNotMatch(schema,/score|grade|rank/i);
assert.match(schema,/celebration/);
assert.match(schema,/nextStep/);
assert.match(schema,/tryThis/);
assert.match(coachFunction,/Coach; never score, grade, rank/);
assert.match(coachFunction,/store:false/);
assert.match(coachFunction,/safety_identifier:hash\(uid\)/);

console.log('Home Arcade + writing coach self-test: PASS');
