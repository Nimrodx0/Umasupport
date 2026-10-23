'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {digest}=require('../src/event_release_gate.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const {apply}=require('../src/phase2_30080_runtime_overlay.cjs');
function fixture(){
 const old={id:'gt-30080-event-006',name:'元GameToraの見出し',type:'auto',
  availabilityKind:'special-trigger',rewards:[{
   skillId:'skill:201591',verifiedSkillName:'仮のスキル名',level:3
  }]};
 return {
  catalog:{schemaVersion:1,cards:[{cardId:'30080',coverageStatus:'partial',events:[
   {id:'unchanged',name:'別イベント',type:'auto',rewards:[]},old
  ]}]},
  normalized:{dataKind:'gametora-whole-event-numeric-candidate',
   releaseApproved:false,
   sourcePins:{gameToraDerived:'a'.repeat(40)},
   cards:[{cardId:'30080',events:[{
    sourceOrdinal:6,eventId:'gt-30080-event-006',sourceLocalEventId:1392,
    section:'special',
    choices:[{sourceLabelWasEmpty:true,routes:[{
     numericHintFacts:[{skillNumericId:'201591',level:3}]
    }]}]
   }]}]},
  review:{dataKind:'gametora-2488-unsigned-publication-review-queue',
   automaticallyReleaseApproved:false,
   sourcePins:{gameToraDerived:'a'.repeat(40)},
   rows:[{cardId:'30080',sourceOrdinal:6,eventId:old.id,
    eventSha256:digest(old),releaseApproved:false,
    status:'PENDING_HUMAN_PUBLICATION_REVIEW'}]}
 };
}
test('one GT auto row becomes three real selections with the SAME stable ID and special trigger',()=>{
 const f=fixture(),original=structuredClone(f);
 const r=apply(f),e=r.catalog.cards[0].events[1];
 assert.equal(e.id,'gt-30080-event-006');
 assert.equal(e.name,'元GameToraの見出し');
 assert.equal(e.type,'choice');
 assert.equal(e.availabilityKind,'special-trigger');
 assert.equal(e.rewards,undefined);
 assert.deepEqual(e.choices.map(x=>x.id),['option1','option2','option3']);
 assert.ok(e.choices.every(x=>x.rewards.length===1&&x.rewards[0].skillId==='skill:201591'&&
  x.rewards[0].level===3));
 assert.deepEqual(r.reviewEvidence.runtimeSelectedHintRoutes,[0,1,1,1]);
 assert.equal(r.reviewEvidence.conditionalSpecialTriggerPreserved,true);
 assert.equal(r.reviewEvidence.publicationApproved,false);
 assert.equal(r.reviewEvidence.automaticRuntimeRelease,false);
 assert.notEqual(r.reviewEvidence.beforeEventSha256,r.reviewEvidence.afterEventSha256);
 assert.deepEqual(f,original,'original audit and schema projection must not be mutated');
 assert.equal(r.catalog.cards[0].events.length,2);
 assert.equal(r.catalog.cards[0].events[0].id,'unchanged');
 const model={cards:[{id:'30080'}],cardById:{'30080':{id:'30080'}},
  skillById:{'skill:201591':{id:'skill:201591'}}};
 assert.equal(schema.validateCatalog(r.catalog,model).eventsWithRecords,2);
});
test('two slots of the same card still yield one provider',()=>{
 const patched=apply(fixture()).catalog.cards[0].events;
 const ev=patched[1].id;
 const model={cardById:{'30080':{id:'30080',hints:[],events:patched}}};
 const deck={slots:[
  {cardId:'30080',stage:4,choices:{[ev]:'option1'},outcomes:{}},
  {cardId:'30080',stage:4,choices:{[ev]:'option3'},outcomes:{}}
 ]};
 const result=core.aggregate(deck,model);
 assert.equal(result['skill:201591'].count,1);
 assert.equal(Object.keys(result['skill:201591'].providers).length,2);
 assert.ok(Object.values(result['skill:201591'].providers).every(p=>p.routes.length===1&&
  p.routes[0].conditional===true));
});
test('source, canonical row, signed content hash or special context changes cause rejection',()=>{
 for(const change of [
  f=>{f.catalog.cards[0].events[1].id='faked'},
  f=>{f.catalog.cards[0].events[1].type='choice'},
  f=>{f.catalog.cards[0].events[1].availabilityKind=undefined},
  f=>{f.catalog.cards[0].events[1].rewards[0].level=4},
  f=>{f.catalog.cards[0].events[1].rewards.push({skillId:'skill:1',level:1})},
  f=>{f.review.rows[0].eventSha256='0'.repeat(64)},
  f=>{f.review.rows[0].releaseApproved=true},
  f=>{f.normalized.cards[0].events[0].sourceLocalEventId=1393},
  f=>{f.normalized.cards[0].events[0].section='random'},
  f=>{f.normalized.cards[0].events[0].choices.push({})},
  f=>{f.normalized.cards[0].events[0].choices[0].routes[0].numericHintFacts[0].skillNumericId='201592'},
  f=>{f.normalized.cards[0].events[0].choices[0].routes[0].numericHintFacts[0].level=1},
  f=>{f.normalized.sourcePins.gameToraDerived='b'.repeat(40)}
 ]) {
  const f=fixture();change(f);
  assert.throws(()=>apply(f),/30080実行候補の3択統合|イベント出典裁定規則/);
 }
});
test('the actual public event DB and approvals are never touched',()=>{
 apply(fixture());
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
