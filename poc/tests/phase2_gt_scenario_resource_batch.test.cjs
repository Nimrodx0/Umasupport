'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
const e=(type,value)=>({type,value});
function source(cards){
 const documents=cards.map(({id,events})=>({
  kind:'support',id,events_ja:Object.fromEntries(events.map((v,j)=>
   ['source-'+j,v]))
 }));
 return {documents,index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:REV},
  stats:{gameToraEventRecords:cards.reduce((s,c)=>s+c.events.length,0)},
  cards:cards.map(c=>({cardId:String(c.id),sourceMissing:false,
   gameToraObservedCount:c.events.length}))}};
}
const evt=(ordinal,choices,section='dates')=>({id:ordinal,
 name:'PROPRIETARY_EVENT_TITLE_NOT_EXPORTED',section,
 choices:choices.map((effects,i)=>({
  label:i?'THIRD_PARTY_CHOICE_2':'THIRD_PARTY_CHOICE_1',
  random_either:false,effects}))});
const item=(id,events)=>({id,events});
const model=ids=>({
 cards:ids.map(id=>({id:String(id)})),
 cardById:Object.fromEntries(ids.map(id=>[String(id),{id:String(id)}])),
 skillById:{}
});
test('vegetables +40 and secret ingredients +2 retain separate typed scenario resources',()=>{
 const f=source([
  item(10109,[evt(1,[[
   e('energy','+30'),e('veggies','+40'),
   {type:'bond',value:'+5',char_id:9002}
  ]])]),
  item(30305,[evt(2,[[
   e('mood','+1'),e('ken_ing','+2'),e('all_stats','+6')
  ]])])
 ]);
 const r=analyze(f);
 assert.equal(r.summary.sourceEvents,2);
 assert.equal(r.summary.eligibleEvents,2);
 assert.equal(r.summary.scenarioResourceMentions,2);
 assert.equal(r.summary.validScenarioResourceMentions,2);
 assert.deepEqual(r.summary.scenarioResourceTypes,{ken_ing:1,veggies:1});
 assert.equal(r.summary.unrecognizedEffectMentions,0);
 const veg=r.isolatedPreview.cards[0].events[0];
 const secret=r.isolatedPreview.cards[1].events[0];
 assert.deepEqual(veg.choices[0].dynamicEffects,[{
  kind:'great-food-festival-all-vegetables',scenario:'great-food-festival',
  targetSelection:'all-five-vegetables',delta:40,possible:true}]);
 assert.deepEqual(secret.choices[0].dynamicEffects,[{
  kind:'scenario14-secret-ingredients',scenario:'scenario-14',
  targetSelection:'secret-ingredient-count',delta:2,possible:true}]);
 assert.deepEqual(secret.choices[0].effects.map(x=>x.kind),
  ['mood','speed','stamina','power','guts','wisdom']);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model([10109,30305])).eventsWithRecords,2);
 for(const [card,evt,choice,scenario] of [
  ['10109',veg,'choice-1','great-food-festival'],
  ['30305',secret,'choice-1','scenario-14']
 ]){
  const runtime={id:card,events:[evt]};
  assert.equal(core.directDynamicEffectRoutes(runtime,{choices:{},outcomes:{}}).length,0);
  const direct=core.directDynamicEffectRoutes(runtime,{
   choices:{[evt.id]:choice},outcomes:{}});
  assert.equal(direct.length,1);
  assert.equal(direct[0].delta,card==='10109'?40:2);
  assert.equal(direct[0].scenario,scenario);
  assert.equal(direct[0].conditional,true);
  assert.equal(direct[0].unresolvedTargets,true);
  assert.equal(direct[0].possible,true);
  assert.equal(core.directRoutes(runtime,{choices:{[evt.id]:choice},outcomes:{}}).length,0);
 }
 assert.equal(JSON.stringify(r).includes('PROPRIETARY_EVENT_TITLE_NOT_EXPORTED'),false);
 assert.equal(JSON.stringify(r).includes('THIRD_PARTY_CHOICE'),false);
});
test('vegetables on separate player choices are NOT double-counted or auto-awarded',()=>{
 const r=analyze(source([item(10109,[
  evt(1,[[e('veggies','+40')],[e('veggies','+40'),e('guts','+29')]])
 ])]));
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 assert.equal(r.summary.validScenarioResourceMentions,2);
 const p=r.isolatedPreview.cards[0].events[0],card={id:'10109',events:[p]};
 assert.equal(core.directDynamicEffectRoutes(card,{choices:{},outcomes:{}}).length,0);
 for(const choiceId of ['choice-1','choice-2']){
  const xs=core.directDynamicEffectRoutes(card,{choices:{[p.id]:choiceId},outcomes:{}});
  assert.equal(xs.length,1);
  assert.equal(xs[0].delta,40);
 }
});
test('both scenario resource codes reject mixed code values, extras, duplicated source effects',()=>{
 for(const type of ['veggies','ken_ing']){
  for(const effects of [
   [{type,value:'+1/+3'}],
   [{type,value:'MYSTERY'}],
   [{type,value:'+5',char_id:999}],
   [{type,value:'+5'},{type,value:'+2'}]
  ]){
   const r=analyze(source([item(10109,[evt(1,[effects])])]));
   assert.equal(r.summary.blockedEvents,1);
   assert.equal(r.summary.isolatedPreviewEventRecords,0);
   assert.equal(r.publicationApproved,false);
  }
 }
 const x=analyze(source([item(10109,[evt(1,[[{type:'veggies',value:'0'}]])])]));
 assert.equal(x.summary.zeroScenarioResourceMentions,1);
 assert.equal(x.summary.isolatedPreviewDynamicRecords,0);
});
test('scenario resource schema rejects scenario mismatch, missing context, wrong count and extra fields',()=>{
 const ms=model([10109]);
 for(const [kind,scenario,target] of [
  ['great-food-festival-all-vegetables','great-food-festival','all-five-vegetables'],
  ['scenario14-secret-ingredients','scenario-14','secret-ingredient-count']
 ]){
  const c={schemaVersion:1,cards:[{cardId:'10109',events:[{
   id:'manual',name:'manual',type:'auto',dynamicEffects:[{
    kind,scenario,targetSelection:target,delta:2,possible:true
   }]
  }]}]};
  assert.equal(schema.validateCatalog(c,ms).eventsWithRecords,1);
  for(const mutate of [
   x=>{x.scenario='generic'},
   x=>{x.targetSelection='base-stats'},
   x=>{x.possible=false},
   x=>{x.delta=0},
   x=>{x.delta=1.3},
   x=>{x.sourceEffectOrdinal=1}
  ]){
   const broken=structuredClone(c);
   mutate(broken.cards[0].events[0].dynamicEffects[0]);
   assert.throws(()=>schema.validateCatalog(broken,ms),/イベント検証/);
  }
 }
});
