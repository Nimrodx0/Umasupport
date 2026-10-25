'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const revision='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(events){
 return {documents:[{kind:'support',id:30001,
  events_ja:Object.fromEntries(events.map((e,i)=>['event-'+(i+1),e]))}],
 index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,
  sourcePins:{gameToraDerived:revision,checker:'fixed'},
  stats:{gameToraEventRecords:events.length},
  cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length}]}
 };
}
const makeEvent=choices=>({name:'UNLICENSED_SOURCE_NAME_NOT_COPIED',
 section:'special',choices});
const auto=effects=>({label:'',random_either:false,effects});
const mt=value=>({type:'mt',value});
const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},skillById:{}};
test('Grand Live mt is a scenario-guarded lowest-performance effect, not a named stat',()=>{
 const r=analyze(fixture([makeEvent([auto([
  {type:'guts',value:'+3'},mt('+20'),{type:'bond',value:'+5',char_id:23}
 ])])]));
 assert.equal(r.summary.scenarioCurrencyMentions,1);
 assert.equal(r.summary.validScenarioCurrencyMentions,1);
 assert.equal(r.summary.invalidScenarioCurrencyMentions,0);
 assert.equal(r.summary.unrecognizedEffectMentions,0);
 assert.equal(r.summary.isolatedPreviewDynamicRecords,1);
 const event=r.isolatedPreview.cards[0].events[0];
 assert.deepEqual(event.dynamicEffects,[{kind:'grand-live-lowest-performance',
  delta:20,scenario:'grand-live',possible:true,
  targetSelection:'lowest-performance-at-runtime'}]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
 const card={id:'30001',events:[event]};
 const dynamic=core.directDynamicEffectRoutes(card);
 assert.equal(dynamic.length,1);
 assert.equal(dynamic[0].scenario,'grand-live');
 assert.equal(dynamic[0].delta,20);
 assert.equal(dynamic[0].unresolvedTargets,true);
 assert.equal(dynamic[0].possible,true);
 assert.equal(dynamic[0].conditional,true);
 assert.ok(dynamic[0].condition.includes('グランドライブ限定'));
 assert.equal(core.directEffectRoutes(card).length,2);
 assert.equal(core.directRoutes(card).length,0);
 assert.equal(JSON.stringify(r).includes('UNLICENSED_SOURCE_NAME_NOT_COPIED'),false);
});
test('full_energy restores to current max, not fixed +100 or an increase to max-energy',()=>{
 const r=analyze(fixture([makeEvent([auto([{type:'full_energy'}])])]));
 assert.equal(r.summary.fullEnergyMentions,1);
 assert.equal(r.summary.validFullEnergyMentions,1);
 assert.equal(r.summary.isolatedPreviewDynamicRecords,1);
 const event=r.isolatedPreview.cards[0].events[0],card={id:'30001',events:[event]};
 assert.deepEqual(event.dynamicEffects,[{kind:'restore-current-max-energy',
  possible:true,targetSelection:'current-max-energy'}]);
 const dyn=core.directDynamicEffectRoutes(card);
 assert.equal(dyn.length,1);
 assert.equal(dyn[0].delta,undefined);
 assert.equal(dyn[0].unresolvedTargets,true);
 assert.equal(dyn[0].conditional,true);
 assert.equal(dyn[0].possible,true);
 assert.equal(core.directEffectRoutes(card).length,0);
 assert.equal(core.directStatusRoutes(card).length,0);
});
test('exclusive mt result cannot be obtained on a different outcome or before choice selection',()=>{
 const r=analyze(fixture([makeEvent([{
  label:'choose',random_either:true,outcomes:[
   [mt('+20'),{type:'guts',value:'+2'}],
   [{type:'full_energy'}]
  ]}])]));
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 const ev=r.isolatedPreview.cards[0].events[0],card={id:'30001',events:[ev]};
 assert.equal(core.directDynamicEffectRoutes(card,{choices:{}}).length,0);
 const selected=core.directDynamicEffectRoutes(card,{choices:{[ev.id]:'choice-1'}});
 assert.equal(selected.length,2);
 assert.ok(selected.every(x=>x.conditional));
 const alt=core.directDynamicEffectRoutes(card,{choices:{[ev.id]:'choice-1'},
  outcomes:{[ev.id]:'result-2'}});
 assert.equal(alt.length,1);
 assert.equal(alt[0].dynamicKind,'restore-current-max-energy');
 assert.equal(alt[0].delta,undefined);
 assert.equal(core.directEffectRoutes(card,{choices:{[ev.id]:'choice-1'},
  outcomes:{[ev.id]:'result-2'}}).length,0);
});
test('reject source unknown fields, non-integer amounts, zero, mixed duplicates',()=>{
 for(const effects of [
  [mt('unknown')],[mt('10/20')],[mt('+20'),mt('+10')],
  [{type:'mt',value:'+20',stat_count:2}],
  [{type:'full_energy',value:'+100'}],
  [{type:'full_energy',chance:1}],
  [{type:'full_energy'},{type:'full_energy'}]
 ]){
  const r=analyze(fixture([makeEvent([auto(effects)])]));
  assert.equal(r.summary.blockedEvents,1,JSON.stringify(effects));
  assert.equal(r.summary.isolatedPreviewEventRecords,0);
 }
 const zero=analyze(fixture([makeEvent([auto([mt('0'),{type:'power',value:'+1'}])])]));
 assert.equal(zero.summary.zeroScenarioCurrencyMentions,1);
 assert.equal(zero.summary.isolatedPreviewDynamicRecords,0);
 for(const effect of [
  {kind:'grand-live-lowest-performance',delta:20,targetSelection:'lowest-performance-at-runtime',possible:true},
  {kind:'grand-live-lowest-performance',delta:20,scenario:'ura',possible:true,targetSelection:'lowest-performance-at-runtime'},
  {kind:'grand-live-lowest-performance',delta:20,scenario:'grand-live',possible:false,targetSelection:'lowest-performance-at-runtime'},
  {kind:'restore-current-max-energy',targetSelection:'current-max-energy',delta:100,possible:true},
  {kind:'restore-current-max-energy',targetSelection:'current-max-energy',possible:false}
 ]){
  assert.throws(()=>schema.validateCatalog({schemaVersion:1,cards:[{
   cardId:'30001',events:[{id:'private',name:'private',type:'auto',
    dynamicEffects:[effect]}]}]},model),/イベント検証/);
 }
});
test('joined named source result preserves both dynamic operations without changing any skill reward',()=>{
 const skill={id:'gt-30001-event-001',name:'private',type:'auto',outcomes:[
  {id:'route-01',label:'success',rewards:[]},
  {id:'route-02',label:'fail',rewards:[]}
 ]};
 const effect={id:'gt:30001:001:effect-only',type:'auto',name:'anonymous',
  outcomes:[
   {id:'result-1',label:'success',dynamicEffects:[
    {kind:'grand-live-lowest-performance',delta:20,
     scenario:'grand-live',possible:true,targetSelection:'lowest-performance-at-runtime'}]},
   {id:'result-2',label:'fail',dynamicEffects:[
    {kind:'restore-current-max-energy',possible:true,targetSelection:'current-max-energy'}]}
  ]};
 const merged=mergeEvent(skill,effect);
 assert.equal(merged.dynamicRows,2);
 assert.equal(merged.event.outcomes[0].rewards.length,0);
 assert.equal(merged.event.outcomes[1].rewards.length,0);
 assert.equal(core.directDynamicEffectRoutes({id:'30001',events:[merged.event]},
  {outcomes:{[skill.id]:'route-01'}})[0].scenario,'grand-live');
 assert.equal(core.directDynamicEffectRoutes({id:'30001',events:[merged.event]},
  {outcomes:{[skill.id]:'route-02'}})[0].dynamicKind,'restore-current-max-energy');
});
