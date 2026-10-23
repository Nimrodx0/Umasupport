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
 assert.equal(PREVIEW.enabledContinuationFlags,17);
 assert.equal(PREVIEW.flagSetUnlessTerminated,true);
 assert.equal(PREVIEW.manualStageArrivalRequired,false);
 assert.equal(PREVIEW.status,'CHOICE_DEPENDENT_CHAIN_FLAGS');
 assert.equal(PREVIEW.cards.length,5);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events).length,15);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>e.alternatives)).length,22);
 assert.equal(PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>
  e.alternatives.flatMap(a=>a.hints))).length,9);
 const all=PREVIEW.cards.flatMap(c=>c.events.flatMap(e=>e.nextStageEdges));
 assert.equal(all.length,17);
 assert.ok(all.every(x=>x.setsNextStageFlag===true&&
  x.terminal===false&&x.rule==='NO_EXPLICIT_CHAIN_END'&&
  x.continuation==='ORDINARY_DEFAULT_NO_EXPLICIT_CUTOFF'));
 assert.deepEqual(release,{schemaVersion:1,cards:[]});
 assert.deepEqual(approvals,{schemaVersion:1,entries:[]});
});
test('event flags are enforced by the real core, regardless of event appearance RNG',()=>{
 const c=PREVIEW.cards.find(c=>c.cardId==='30319');
 const events=c.events.map((e,i)=>{
  const prev=i?{requires:{all:[{eventId:c.events[i-1].id}]}}:{};
  return e.choiceCount===0?{
   id:e.id,name:e.title,type:'auto',...prev,
   rewards:e.alternatives[0].hints.map(h=>({skillId:h[0],level:h[1]}))
  }:{
   id:e.id,name:e.title,type:'choice',...prev,
   choices:e.alternatives.map(a=>({
    id:a.id,label:a.id,rewards:a.hints.map(h=>({skillId:h[0],level:h[1]}))
   }))
  };
 });
 const model={id:c.cardId,hints:[],events};
 const get=choices=>core.directRoutes(model,{stage:4,choices,outcomes:{}})
  .filter(r=>r.source==='event');
 assert.equal(get({}).length,0,'no prior choice sets a flag');
 assert.equal(get({[events[0].id]:'option1'}).length,0,
  'stage 3 locked before stage 2 is chosen');
 const all=get({[events[0].id]:'option1',[events[1].id]:'option1'});
 assert.equal(all.length,3,'stage 2 hint plus both stage 3 hints');
 assert.equal(all.filter(r=>r.eventId===events[2].id).length,2);
 events[0].choices[0].terminal=true;
 assert.equal(get({[events[0].id]:'option1',[events[1].id]:'option1'}).length,0,
  'explicitly terminated predecessor must clear all downstream flags');
 assert.equal(get({[events[0].id]:'option2',[events[1].id]:'option1'}).length,3,
  'nonterminal alternative still sets the next-stage flag');
 const autoCard=PREVIEW.cards.find(c=>c.cardId==='30221');
 const autoEvents=autoCard.events.map((e,i)=>({
  id:e.id,name:e.title,type:'auto',
  ...(i?{requires:{all:[{eventId:autoCard.events[i-1].id}]}}:{}),
  rewards:e.alternatives[0].hints.map(h=>({skillId:h[0],level:h[1]}))
 }));
 const skill=core.directRoutes({id:'30221',hints:[],events:autoEvents},
  {stage:4,choices:{},outcomes:{}}).filter(r=>r.source==='event');
 assert.deepEqual(skill.map(r=>r.skillId),['skill:201351']);
});
test('all 17 ordinary edges turn on flags, but no public release approval is inferred',()=>{
 const item=JSON.stringify(PREVIEW);
 for(const forbidden of ['"publicationApproved":true','"terminal":true',
  '"setsNextStageFlag":false'])
  assert.ok(!item.includes(forbidden));
 assert.ok(!item.includes('sourceChoiceProse'));
 assert.ok(!item.includes('sourceNarrativeText'));
});
