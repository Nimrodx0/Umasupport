'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../src/phase2_chain_plan_build.cjs');
const core=require('../src/core.js');
const PREVIEW=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../preview/phase2-chain-plan.v1.json'),'utf8'));
const release=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.v1.json');
test('source-bound planning data equals generated JSON, without individual route proof',()=>{
 assert.deepEqual(PREVIEW,build());
 assert.equal(PREVIEW.publicationApproved,false);
 assert.equal(PREVIEW.verifiedIndividualContinuations,0);
 assert.equal(PREVIEW.plannedDefaultContinuations,17);
 assert.equal(PREVIEW.eventOccurrenceGuaranteed,false);
 assert.equal(PREVIEW.manualStageArrivalRequired,false);
 assert.equal(PREVIEW.status,'PROSPECTIVE_SKILLS_ONLY');
 assert.equal(PREVIEW.cards.length,5);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events).length,15);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>e.alternatives)).length,22);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>
  e.alternatives.flatMap(a=>a.hints))).length,9);
 const all=PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>e.nextStageEdges));
 assert.equal(all.length,17);
 assert.ok(all.every(x=>x.individuallyVerified===false&&
  x.terminationReported===false&&x.nextEventOccurrenceGuaranteed===false&&
  x.continuation==='ORDINARY_DEFAULT_NO_EXPLICIT_CUTOFF'));
 assert.deepEqual(release,{schemaVersion:1,cards:[]});
 assert.deepEqual(approvals,{schemaVersion:1,entries:[]});
});
test('an explicit choice selects only that skill route, without triggering the next event',()=>{
 const c=PREVIEW.cards.find(c=>c.cardId==='30319');
 const events=c.events.map(e=>e.choiceCount===0?{
  id:e.id,name:e.title,type:'auto',
  rewards:e.alternatives[0].hints.map(h=>({skillId:h[0],level:h[1]}))
 }:{
  id:e.id,name:e.title,type:'choice',
  choices:e.alternatives.map(a=>({
   id:a.id,label:a.id,rewards:a.hints.map(h=>({skillId:h[0],level:h[1]}))
  }))
 });
 const model={id:c.cardId,hints:[],events};
 const settings={stage:4,choices:{[events[0].id]:'option1'},outcomes:{}};
 const actual=core.directRoutes(model,settings).filter(r=>r.source==='event');
 assert.equal(actual.length,2,'only final-stage auto grants are prospects; stage 2 not selected');
 assert.ok(actual.every(r=>r.eventId===events[2].id));
 const missing=core.directRoutes({id:c.cardId,hints:[],
  events:events.slice(0,2)},settings).filter(r=>r.source==='event');
 assert.equal(missing.length,0);
 // The planning client, not the core, prevents adding stage 3 before stage 2.
 const plan=build();
 assert.equal(plan.cards.find(c=>c.cardId==='30319').events[0].nextStageEdges.length,2);
});
test('none of the 17 defaults is a validated chain graph or release approval',()=>{
 const item=JSON.stringify(PREVIEW);
 for(const forbidden of ['"chainTopologyProven":true',
  '"individuallyVerified":true','"nextEventOccurrenceGuaranteed":true',
  '"publicationApproved":true','"terminal":true'])
  assert.ok(!item.includes(forbidden));
 assert.ok(!item.includes('sourceChoiceProse'));
 assert.ok(!item.includes('sourceNarrativeText'));
});
