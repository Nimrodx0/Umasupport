'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS}=require('../src/official_gametora_probe.cjs');
const {validateTargets,summarizeEvents}=
 require('../tools/probe_official_gametora_new_cards.cjs');
test('fixed allowlist permits only 30322 and 30323, never 30001 or custom URL',()=>{
 const targets=TARGETS.filter(t=>t.cardId!=='30001');
 assert.deepEqual(validateTargets(targets).map(x=>x.cardId),['30322','30323']);
 assert.throws(()=>validateTargets(TARGETS),/固定2枚/);
 assert.throws(()=>validateTargets([targets[1],targets[0]]),/固定2枚/);
 assert.throws(()=>validateTargets([{cardId:'30322',slug:'fake'},targets[1]]),/固定2枚/);
});
test('rendered observation is strictly structural and never approves event contents',()=>{
 const info=summarizeEvents({accordionButtons:8,trainingSections:1,
  chainSections:1,randomSections:1,outingSections:0});
 assert.equal(info.supportEventAccordions,8);
 assert.equal(info.eventRewardRoutesVerified,false);
 assert.equal(info.choiceWordingVerified,false);
 assert.equal(info.independentSkillIdVerified,false);
 assert.equal(info.publicationApproved,false);
 assert.deepEqual(Object.values(info).filter(x=>typeof x==='string'),[]);
});
test('unobserved fields do not become a false empty event catalog',()=>{
 assert.throws(()=>summarizeEvents({accordionButtons:0}),/不正/);
 const empty=summarizeEvents({accordionButtons:0,trainingSections:0,
  chainSections:0,randomSections:0,outingSections:0});
 assert.equal(empty.supportEventAccordions,0);
 assert.equal(empty.eventRewardRoutesVerified,false);
});
