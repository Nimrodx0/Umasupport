'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../src/phase2_chain_pages_preview_artifact.cjs');
const {audit,replay}=require('../src/phase2_chain_manual_replay.cjs');
const core=require('../src/core.js');
const published=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.v1.json');
const output=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../preview/phase2-chain-stages.v1.json'),'utf8'));
test('publicly viewable but nonapproved numeric preview matches the curated 12-stage source exactly',()=>{
 const expected=build();
 assert.deepEqual(output,expected);
 assert.equal(expected.formallyApproved,false);
 assert.equal(expected.gameplayReproductionClaimed,false);
 assert.equal(expected.inferredChainTransitions,0);
 assert.equal(expected.unresolvedPossibleTransitions,15);
 assert.equal(expected.sourceNarrativeOrChoiceProseIncluded,false);
 const stages=expected.cards.flatMap(c=>c.events);
 assert.equal(stages.length,12);
 assert.equal(stages.flatMap(s=>s.alternatives).length,19);
 assert.equal(stages.flatMap(s=>s.alternatives.flatMap(a=>a.hints)).length,8);
 assert.equal(stages.filter(s=>s.choiceCount===0).length,5);
 assert.deepEqual(expected.cards.map(c=>c.events.map(e=>e.choiceCount)),[
  [2,2,0],[2,2,0],[2,2,0],[2,0,0]
 ]);
 assert.ok(stages.every(s=>s.manualReachedRequired&&s.priorStageDependenceVerified===false));
 assert.deepEqual(published,{schemaVersion:1,cards:[]});
 assert.deepEqual(approvals,{schemaVersion:1,entries:[]});
});
test('all 12 numeric stages remain isolated from their unverified preceding stages',()=>{
 const facts=audit();
 const data=build();
 for(const card of data.cards){
  for(const stage of card.events){
   const staged=card.events.filter(e=>e.id===stage.id);
   const s=staged[0];
   const event={id:s.id,name:'連続段階'+s.ordinal,
    ...(s.choiceCount===0?{
     type:'auto',rewards:s.alternatives[0].hints.map(x=>({
      skillId:x[0],level:x[1]}))
    }:{
     type:'choice',choices:s.alternatives.map(a=>({
      id:a.id,label:a.id,rewards:a.hints.map(x=>({skillId:x[0],level:x[1]}))
     }))
    })};
   const model={id:card.cardId,hints:[],events:[]};
   assert.equal(core.directRoutes(model,{stage:4,choices:{},outcomes:{}})
    .filter(r=>r.source==='event').length,0);
   model.events=[event];
   for(const alt of stage.alternatives){
    const settings={stage:4,choices:s.choiceCount?{[s.id]:alt.id}:{},outcomes:{}};
    const routes=core.directRoutes(model,settings).filter(r=>r.source==='event');
    assert.deepEqual(routes.map(r=>[r.skillId,r.level]),
     alt.hints.map(h=>[h[0],h[1]]));
    const replayed=replay({
     cardId:card.cardId,stageOrdinal:s.ordinal,observed:true,
     selectedOptionOrdinal:s.choiceCount?Number(alt.id.slice(6)):null
    });
    assert.deepEqual(routes.map(r=>[r.skillId,r.level]),
     replayed.routes.map(r=>[r.skillId,r.level]));
   }
  }
 }
 assert.equal(facts.summary.establishedTransitions,0);
 assert.equal(facts.summary.unresolvedPossibleTransitions,15);
});
test('no made-up skill names or branch edges appear in static review data',()=>{
 const raw=JSON.stringify(output);
 for(const forbidden of ['continuationVerified":true','chainPrerequisitesVerified":true',
  'manualStageAssertionOnly":false','publicationApproved":true',
  'sourceNarrativeText','sourceChoiceProse'])
  assert.ok(!raw.includes(forbidden),forbidden);
 const names=output.cards.flatMap(c=>c.events.flatMap(e=>
  e.alternatives.flatMap(a=>a.hints)));
 assert.ok(names.some(h=>h[0]==='skill:201463'&&h[2]==='月影円刃'));
 assert.ok(names.some(h=>h[0]==='skill:204412'&&h[2]==='スキルID 204412'));
});
