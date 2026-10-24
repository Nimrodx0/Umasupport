'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../src/event_schema.js');
const C=require('../src/core.js');
const {preview}=require('../src/phase2_mei_overseas_nonskill_preview.cjs');
const facts=require('../data/curation/adjudicated/phase2_p1_scenario_event_facts.v1.json');
const model={cards:[{id:'X'}],cardById:{X:{id:'X'}},
  skillById:{'skill:101':{id:'skill:101'}}};
function catalog(events){
 return {schemaVersion:1,cards:[{cardId:'X',coverageStatus:'partial',events}]};
}
function validate(events){return S.validateCatalog(catalog(events),model);}
const config=(choices={},outcomes={})=>({stage:4,choices,outcomes});

test('GameWith-reviewed overseas Mei outcomes project to exactly 2 isolated R/SSR preview events',()=>{
 const original=structuredClone(facts),r=preview();
 assert.equal(r.dataKind,'phase2-two-card-mei-overseas-nonskill-outcome-preview');
 assert.deepEqual(r.summary,{cards:2,previewOnlyEventRecords:2,
  conditionalOutcomePaths:4,effectComponentRoutes:22,
  skillRoutesAdded:0,publicEventsAdded:0,publishedEvents:0});
 assert.equal(r.noAutomaticRuntimeAdoption,true);
 assert.equal(r.publicationApproved,false);
 assert.deepEqual(r.catalog.cards.map(x=>x.cardId),['10094','30160']);
 for(const entry of r.catalog.cards){
  const event=entry.events[0];
  assert.equal(event.id,'usl:'+entry.cardId+':larc:overseas-cheer');
  assert.equal(event.availabilityKind,'scenario-overseas');
  assert.equal(event.type,'auto');
  assert.equal(event.terminal,undefined,'unreported chain termination must not be invented');
  assert.deepEqual(event.outcomes.map(x=>x.id),['great-success','success']);
  assert.deepEqual(event.outcomes.map(x=>x.effects.length),[6,5]);
  const card={id:entry.cardId,hints:[],events:entry.events};
  assert.deepEqual(C.directRoutes(card,config()),[],
   'no scalar stat, mood, bond, scenario points is a skill provider');
  const both=C.directEffectRoutes(card,config());
  assert.equal(both.length,11);
  assert.ok(both.every(x=>x.conditional&&x.condition.includes('海外')));
  assert.equal(both.filter(x=>x.outcomeId==='great-success').length,6);
  assert.equal(both.filter(x=>x.outcomeId==='success').length,5);
  const selected=C.directEffectRoutes(card,config({}, {[event.id]:'great-success'}));
  assert.equal(selected.length,6);
  assert.ok(selected.every(x=>x.outcomeId==='great-success'));
  const bond=selected.filter(x=>x.effectKind==='bond');
  assert.deepEqual(bond.map(x=>[x.sourceComponent,x.delta]),
   [['event-result',5],['scenario-bonus',2]]);
  assert.deepEqual(selected.filter(x=>x.effectKind==='mood').map(x=>x.delta),[1]);
  assert.deepEqual(selected.filter(x=>x.effectKind==='aptitude_points').map(x=>x.delta),[50]);
  const success=C.directEffectRoutes(card,config({}, {[event.id]:'success'}));
  assert.equal(success.length,5);
  assert.equal(success.some(x=>x.effectKind==='mood'),false,
   'zero change is absent, not fabricated +0 effect');
  assert.equal(C.directEffectRoutes(card,config({}, {[event.id]:'unknown'})).length,0);
 }
 assert.deepEqual(facts,original);
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),
  {schemaVersion:1,entries:[]});
});

test('general v1 schema accepts mixed skill and non-skill rewards without adding effects to skill coverage',()=>{
 const event={id:'a',name:'sample',type:'choice',choices:[
  {id:'go',label:'go',rewards:[{skillId:'skill:101',level:2}],
   effects:[{kind:'energy',delta:10},{kind:'mood',delta:-1}]},
  {id:'stop',label:'stop',terminal:true,rewards:[],
   effects:[{kind:'bond',delta:5}]}
 ]};
 assert.equal(validate([event]).eventsWithRecords,1);
 const card={id:'X',hints:[],events:[event]};
 assert.equal(C.directRoutes(card,config({a:'go'})).length,1);
 assert.equal(C.directEffectRoutes(card,config({a:'go'})).length,2);
 assert.equal(C.directEffectRoutes(card,config({a:'stop'})).length,1);
 assert.equal(C.directEffectRoutes(card,config()).length,0,
  'no player option selected yields no stat bonus');
 const subsequent={id:'later',name:'later',type:'auto',
  requires:{all:[{eventId:'a',choiceId:'go'}]},
  effects:[{kind:'power',delta:5}]};
 assert.equal(validate([event,subsequent]).eventsWithRecords,2);
 const extended={...card,events:[event,subsequent]};
 assert.equal(C.directEffectRoutes(extended,config({a:'stop'}))
  .some(x=>x.eventId==='later'),false);
 assert.equal(C.directEffectRoutes(extended,config({a:'go'}))
  .some(x=>x.eventId==='later'),true);
});

test('random outcome results remain conditional until result selected, with prerequisite blocks',()=>{
 const start={id:'start',name:'start',type:'choice',choices:[
  {id:'continue',label:'continue',rewards:[]},
  {id:'stop',label:'stop',terminal:true,rewards:[]}
 ]};
 const event={id:'out',name:'out',type:'auto',requires:{all:[
  {eventId:'start',choiceId:'continue'}]},
  outcomes:[
   {id:'hit',label:'hit',effects:[{kind:'guts',delta:7}]},
   {id:'miss',label:'miss',effects:[{kind:'guts',delta:1}]}
  ]};
 assert.equal(validate([start,event]).eventsWithRecords,2);
 const card={id:'X',hints:[],events:[start,event]};
 assert.equal(C.directEffectRoutes(card,config({start:'stop'})).length,0);
 assert.equal(C.directEffectRoutes(card,config({start:'continue'})).length,2);
 const unspecified=C.directEffectRoutes(card,config({start:'continue'}));
 assert.ok(unspecified.every(x=>x.conditional));
 assert.ok(unspecified.every(x=>x.condition.includes('結果時')));
 const chosen=C.directEffectRoutes(card,config({start:'continue'},{out:'hit'}));
 assert.deepEqual(chosen.map(x=>x.delta),[7]);
 assert.equal(chosen[0].conditional,false);
 assert.equal(C.directRoutes(card,config({start:'continue'})).length,0);
});

test('effect array validator rejects forged kind, decimals, silent changes, wrong source component and duplicates',()=>{
 const invalid=[
  [{kind:'stamina',delta:0}],
  [{kind:'stamina',delta:0.3}],
  [{kind:'stamina',delta:NaN}],
  [{kind:'unknown',delta:2}],
  [{kind:'bond',delta:'5'}],
  [{kind:'bond',delta:2,sourceComponent:'wrong'}],
  [{kind:'bond',delta:2,probability:1}],
  [{kind:'guts',delta:2},{kind:'guts',delta:3}],
  [{kind:'bond',delta:2,sourceComponent:'event-result'},
   {kind:'bond',delta:3,sourceComponent:'event-result'}],
  [],
  {}
 ];
 for(const effects of invalid){
  assert.throws(()=>validate([{id:'a',name:'a',type:'auto',effects}]),
   /イベント検証/,JSON.stringify(effects));
 }
 for(const e of [
  {id:'a',name:'a',type:'auto',effects:[{kind:'guts',delta:1}],
   outcomes:[{id:'win',label:'win',effects:[{kind:'guts',delta:5}]},
    {id:'lose',label:'lose',effects:[{kind:'guts',delta:1}]}]},
  {id:'a',name:'a',type:'auto',outcomes:[
    {id:'win',label:'win'}, {id:'lose',label:'lose',effects:[{kind:'bond',delta:1}]}]}
 ])assert.throws(()=>validate([e]),/イベント検証/);
});

test('source drift, invented skills, two-card narrowing, unknown chain termination or publication bypass fails',()=>{
 const mutators=[
  l=>{l.publicationApproved=true;},
  l=>{l.runtimeCatalogAdoption=true;},
  l=>{l.baselinePrivateEventCount=2513;},
  l=>{l.overseasSeparate.cardIds=['30160'];},
  l=>{l.overseasSeparate.results.SUCCESS.guts=5;},
  l=>{l.overseasSeparate.results.GREAT_SUCCESS.mood=0;},
  l=>{l.overseasSeparate.projectLarcAdditionalEffects.bond=0;},
  l=>{l.overseasSeparate.skillHints=[{skillId:'201641',level:5}];},
  l=>{l.overseasSeparate.chainEnd=true;},
  l=>{l.overseasSeparate.context='ANYWHERE';},
  l=>{l.sourcePins.checker='0'.repeat(40);}
 ];
 for(const mutate of mutators){
  const copy=structuredClone(facts);mutate(copy);
  assert.throws(()=>preview({ledger:copy}),/佐岳メイ非スキル効果試作/,
   mutate.toString());
 }
});
