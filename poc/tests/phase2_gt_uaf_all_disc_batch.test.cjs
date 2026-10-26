'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const ev=(n,effects)=>({id:n,name:'THIRD_PARTY_TITLE_UNUSED',
 section:'dates',choices:[{label:'',random_either:false,effects}]});
const mk=(effects)=>({
 index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:rev},
  stats:{gameToraEventRecords:effects.length},
  cards:[{cardId:'10104',sourceMissing:false,gameToraObservedCount:effects.length}]},
 documents:[{id:10104,kind:'support',events_ja:Object.fromEntries(
  effects.map((rows,i)=>['e'+i,ev(i+1,rows)]))}]
});
test('all_disc is one UAF-only all-15-discipline effect, not five guaranteed stats',()=>{
 const x=mk([[{type:'energy',value:'+35'},
  {type:'all_disc',value:'+1'},{type:'bond',value:'+5',char_id:9044}]]);
 const r=analyze(x),event=r.isolatedPreview.cards[0].events[0];
 assert.equal(r.summary.uafAllDiscMentions,1);
 assert.equal(r.summary.validUafAllDiscMentions,1);
 assert.equal(r.summary.blockedEvents,0);
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 assert.deepEqual(event.dynamicEffects,[{kind:'uaf-all-disciplines',
  delta:1,scenario:'uaf',possible:true,
  targetSelection:'all-15-sports-disciplines'}]);
 assert.deepEqual(event.effects.map(e=>e.kind),['energy','bond']);
 const summary=core.directDynamicEffectRoutes({id:'10104',events:[event]},
  {choices:{},outcomes:{}});
 assert.equal(summary.length,1);
 assert.equal(summary[0].conditional,true);
 assert.equal(summary[0].possible,true);
 assert.equal(summary[0].unresolvedTargets,true);
 assert.equal(summary[0].scenario,'uaf');
 assert.equal(core.directEffectRoutes({id:'10104',events:[event]},
  {choices:{},outcomes:{}}).length,2);
 assert.equal(core.directRoutes({id:'10104',events:[event],hints:[]},
  {choices:{},outcomes:{}}).length,0);
 const model={cards:[{id:'10104'}],cardById:{'10104':{id:'10104'}},
  skillById:{}};
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
 assert.equal(JSON.stringify(r).includes('THIRD_PARTY_TITLE_UNUSED'),false);
});
test('UAF all_disc is batch processed across events, source ordinals, and signed magnitudes',()=>{
 const x=mk([
  [{type:'all_disc',value:'+1'}],
  [{type:'all_disc',value:'+2'}],
  [{type:'all_disc',value:'-1'}]
 ]);
 const r=analyze(x);
 assert.equal(r.summary.eligibleEvents,3);
 assert.equal(r.summary.validUafAllDiscMentions,3);
 assert.deepEqual(r.isolatedPreview.cards[0].events.map(e=>e.dynamicEffects[0].delta),
  [1,2,-1]);
});
test('UAF all_disc unknown context, malformed source or duplicate operations remain quarantined',()=>{
 for(const sourceEffects of [
  [{type:'all_disc',value:'+1/+2'}],
  [{type:'all_disc',value:'???'}],
  [{type:'all_disc',value:'+1',extra:1}],
  [{type:'all_disc',value:'+1'},{type:'all_disc',value:'+2'}]
 ]){
  const r=analyze(mk([sourceEffects]));
  assert.equal(r.summary.blockedEvents,1);
  assert.equal(r.summary.isolatedPreviewEventRecords,0);
  assert.equal(r.publicationApproved,false);
 }
 const model={cards:[{id:'10104'}],cardById:{'10104':{id:'10104'}},
  skillById:{}};
 const data={schemaVersion:1,cards:[{cardId:'10104',events:[{id:'e',name:'e',
  type:'auto',dynamicEffects:[{kind:'uaf-all-disciplines',delta:1,
    possible:true,scenario:'uaf',targetSelection:'all-15-sports-disciplines'}]}]}]};
 assert.equal(schema.validateCatalog(data,model).eventsWithRecords,1);
 for(const change of [
  x=>x.scenario='any',
  x=>x.targetSelection='five-stats',
  x=>x.possible=false,
  x=>x.delta=0,
  x=>x.sourceEffectOrdinal=1
 ]){
  const copy=structuredClone(data);change(copy.cards[0].events[0].dynamicEffects[0]);
  assert.throws(()=>schema.validateCatalog(copy,model),/イベント検証/);
 }
});
