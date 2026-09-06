import '../v33-integration/js/home-curriculum-data.js';
import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';
import{SourceTextModule}from'node:vm';

const Curriculum=globalThis.DWHomeCurriculum;
assert.ok(Curriculum,'Curriculum data API should load.');
assert.deepEqual(Curriculum.validate(),[]);
assert.equal(Curriculum.SUBJECTS.length,4);
for(const subject of Curriculum.SUBJECTS){
  for(let level=0;level<=4;level++){
    assert.equal(Curriculum.PATHS[subject.id][level].length,2,`${subject.id} level ${level} lesson count`);
    assert.ok(Curriculum.lessonFor(subject.id,level,0));
    assert.notEqual(Curriculum.lessonFor(subject.id,level,0).id,Curriculum.lessonFor(subject.id,level,1).id);
  }
}
assert.equal(Object.values(Curriculum.PATHS).flatMap(subject=>Object.values(subject)).flat().length,40);
assert.equal(Curriculum.clampLevel(-20),0);
assert.equal(Curriculum.clampLevel(9),4);
new SourceTextModule(readFileSync(new URL('../v33-integration/js/home-curriculum-quest.js',import.meta.url),'utf8'),{identifier:'home-curriculum-quest.js'});
console.log('Home curriculum self-test: PASS (40 K–4 lessons across 4 independently leveled subjects)');
