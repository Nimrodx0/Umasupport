'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_eight_pages_preview_artifact.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.v1.json');
const dataPath=path.join(__dirname,'../preview/phase2-eight-events.v1.json');
test('static browser preview matches exactly the audited eight-event source',()=>{
 const actual=JSON.parse(fs.readFileSync(dataPath,'utf8')),expected=build();
 assert.deepEqual(actual,expected);
 assert.equal(actual.previewOnly,true);
 assert.equal(actual.formallyApproved,false);
 assert.equal(actual.sourceNarrativeOrChoiceProseIncluded,false);
 const rows=actual.cards.flatMap(card=>card.events.flatMap(ev=>
  ev.choices.map(c=>[card.cardId,ev.ordinal,c.id,
   c.hints.map(h=>[h[0],h[1],h[2]])])));
 assert.equal(actual.cards.length,4);
 assert.equal(rows.length,16);
 assert.deepEqual(rows.filter(x=>x[3].length>0),[
  ['30318',5,'option2',[['skill:200152',1,'良バ場○']]],
  ['30319',5,'option2',[['skill:201641',1,'一匹狼']]],
  ['30320',5,'option1',[['skill:202082',1,'ワンチャンス']]],
  ['30321',5,'option2',[['skill:202602',1,'イグニッション']]]
 ]);
});
test('static preview explicitly contains no published event approval, source prose or extra stages',()=>{
 const p=build();
 assert.deepEqual(catalog,{schemaVersion:1,cards:[]});
 assert.deepEqual(approvals,{schemaVersion:1,entries:[]});
 assert.equal(verifyRelease(catalog,approvals).publicEvents,0);
 for(const c of p.cards){
  assert.deepEqual(c.events.map(e=>e.ordinal),[4,5]);
  assert.ok(c.events.every(e=>e.choices.length===2));
 }
 const raw=JSON.stringify(p);
 assert.ok(!raw.includes('chainPrerequisitesVerified'));
 assert.ok(!raw.includes('publicationApproved":true'));
 assert.ok(!raw.includes('manualStageAssertionOnly'));
});
