'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const PIN='6e38b54af4fad397ff4491e63007a90705a4fe67';
const source=(entries)=>({
 index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:PIN},
  stats:{gameToraEventRecords:entries.length},
  cards:[{cardId:'30241',sourceMissing:false,gameToraObservedCount:entries.length}]},
 documents:[{id:30241,kind:'support',events_ja:Object.fromEntries(
  entries.map((event,i)=>['source-'+(i+1),event]))}]
});
const effect=(type,value)=>({type,value});
const event=(n,choices,section='random')=>({
 id:n,name:'THIRD_PARTY_EVENT_PRIVATE',section,
 choices:choices.map((effects,i)=>({
  label:i?'PROPRIETARY_CHOICE_B':'PROPRIETARY_CHOICE_A',
  random_either:false,effects}))
});
const model={cards:[{id:'30241'}],cardById:{'30241':{id:'30241'}},skillById:{}};
const routes=(event,choiceId)=>core.directDynamicEffectRoutes(
 {id:'30241',events:[event]},{
  choices:choiceId?{[event.id]:choiceId}:{},outcomes:{}
 });
test('Seven all-guide events and two chosen-guide events use distinct effects and retain +1/+2/+3/+8',()=>{
 const input=source([
  event(1,[[effect('ttl_gauge_all','+3'),effect('bond','+5')]]),
  event(2,[[effect('ttl_gauge_all','+3')]]),
  event(3,[
   [effect('ttl_gauge','+1'),effect('speed','+5')],
   [effect('ttl_gauge','+1'),effect('energy','+3')],
   [effect('ttl_gauge','+1'),effect('wisdom','+3')]]),
  event(4,[[effect('ttl_gauge_all','+2')]]),
  event(5,[[effect('ttl_gauge_all','+3')]],'dates_random'),
  event(6,[[effect('ttl_gauge_all','+3')]],'dates_random'),
  event(7,[[effect('ttl_gauge_all','+3')]],'dates_random'),
  event(8,[
   [effect('ttl_gauge','+8'),effect('speed','+5')],
   [effect('ttl_gauge','+8'),effect('energy','+3')],
   [effect('ttl_gauge','+8'),effect('wisdom','+3')]],'dates_random'),
  event(9,[[effect('ttl_gauge_all','+3')]],'dates_random')
 ]);
 const report=analyze(input),events=report.isolatedPreview.cards[0].events;
 assert.equal(report.summary.sourceEvents,9);
 assert.equal(report.summary.eligibleEvents,9);
 assert.equal(report.summary.blockedEvents,0);
 assert.equal(report.summary.validScenarioResourceMentions,13);
 assert.equal(report.summary.scenarioResourceTypes.ttl_gauge_all,7);
 assert.equal(report.summary.scenarioResourceTypes.ttl_gauge,6);
 assert.equal(report.summary.isolatedPreviewDynamicRecords,13);
 assert.equal(schema.validateCatalog(report.isolatedPreview,model).eventsWithRecords,9);
 for(const n of [0,1,3,4,5,6,8]){
  const e=events[n],res=routes(e,'choice-1');
  assert.equal(res.length,1);
  assert.equal(res[0].dynamicKind,'legends-all-guide-gauges');
  assert.equal(res[0].delta,n===3?2:3);
  assert.equal(res[0].targetSelection,'all-three-legend-guides');
  assert.equal(res[0].scenario,'legends');
  assert.equal(res[0].conditional,true);
  assert.equal(res[0].unresolvedTargets,true);
  assert.equal(routes(e).length,0);
 }
 for(const n of [2,7]){
  const e=events[n];
  assert.equal(routes(e).length,0);
  assert.equal(routes(e,'no-such-choice').length,0);
  for(const c of ['choice-1','choice-2','choice-3']){
   const res=routes(e,c);
   assert.equal(res.length,1,'one player choice -> one member gauge');
   assert.equal(res[0].dynamicKind,'legends-choice-guide-gauge');
   assert.equal(res[0].delta,n===2?1:8);
   assert.equal(res[0].targetSelection,'chosen-legend-from-event-choice');
   assert.equal(res[0].choiceId,c);
   assert.equal(res[0].conditional,true);
   assert.equal(res[0].scenario,'legends');
  }
 }
 assert.equal(JSON.stringify(report).includes('THIRD_PARTY_EVENT_PRIVATE'),false);
 assert.equal(JSON.stringify(report).includes('PROPRIETARY_CHOICE'),false);
 assert.equal(report.automaticRuntimeAdoption,false);
 assert.equal(report.publicationApproved,false);
});
test('legends gauge source rejects unknown target field, ranges, missing values, duplicated same-kind effect',()=>{
 for(const kind of ['ttl_gauge_all','ttl_gauge']){
  for(const bad of [
   [{type:kind,value:'+2/+4'}],
   [{type:kind,value:'?'}],
   [{type:kind}],
   [{type:kind,value:'+3',char_id:102}],
   [{type:kind,value:'+3'}, {type:kind,value:'+2'}]
  ]){
   const r=analyze(source([event(1,[bad])]));
   assert.equal(r.summary.blockedEvents,1,JSON.stringify(bad));
   assert.equal(r.summary.isolatedPreviewEventRecords,0);
  }
 }
});
test('new schema types preserve Legends scenario, target selection and signed nonzero integer delta',()=>{
 const variants=[
  {kind:'legends-all-guide-gauges',delta:3,scenario:'legends',
   targetSelection:'all-three-legend-guides',possible:true},
  {kind:'legends-choice-guide-gauge',delta:1,scenario:'legends',
   targetSelection:'chosen-legend-from-event-choice',possible:true}
 ];
 for(const item of variants){
  const valid={schemaVersion:1,cards:[{cardId:'30241',events:[{
   id:'test',name:'test',type:'auto',dynamicEffects:[item]
  }]}]};
  assert.equal(schema.validateCatalog(valid,model).eventsWithRecords,1);
  for(const edit of [
   x=>x.scenario='generic',x=>x.targetSelection='other-target',
   x=>x.delta=0,x=>x.delta=1.25,x=>x.possible=false,
   x=>x.sourceOrdinal=1
  ]){
   const invalid=structuredClone(valid);
   edit(invalid.cards[0].events[0].dynamicEffects[0]);
   assert.throws(()=>schema.validateCatalog(invalid,model),/イベント検証/);
  }
 }
});
