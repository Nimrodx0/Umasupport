'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const auto=effects=>({label:'',random_either:false,effects});
const ev=choices=>({id:1,name:'DO_NOT_COPY_GAME_TORA_TEXT',section:'random',choices});
function fixture(events){
 return {documents:[{kind:'support',id:30001,events_ja:Object.fromEntries(
  events.map((e,i)=>['source'+i,e]))}],
 index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:rev,checker:'pinned'},
  stats:{gameToraEventRecords:events.length},
  cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length}]}
 };
}
const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},skillById:{}};
test('same healing operation twice stays two possible consecutive one-bad cures, not a guaranteed cure-all',()=>{
 const r=analyze(fixture([ev([auto([
  {type:'heal_status'}, {type:'guts',value:'+3'},
  {type:'heal_status',chance:0.2}
 ])])]));
 assert.equal(r.summary.repeatedStatusSourceMentions,1);
 assert.equal(r.summary.eligibleRepeatedStatusSourceMentions,1);
 assert.equal(r.summary.isolatedOrderedRepeatedStatusMentions,1);
 assert.equal(r.summary.blockedEvents,0);
 assert.equal(r.summary.isolatedPreviewStatusRecords,2);
 const e=r.isolatedPreview.cards[0].events[0];
 assert.deepEqual(e.statusEffects,[
  {kind:'cure-one-bad',possible:true,sourceEffectOrdinal:1},
  {kind:'cure-one-bad',possible:true,chance:0.2,sourceEffectOrdinal:3}
 ]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
 const routes=core.directStatusRoutes({id:'30001',events:[e]});
 assert.equal(routes.length,2);
 assert.deepEqual(routes.map(x=>x.sourceEffectOrdinal),[1,3]);
 assert.ok(routes.every(x=>x.possible===true&&x.conditional===true));
 assert.ok(!JSON.stringify(r).includes('DO_NOT_COPY_GAME_TORA_TEXT'));
});
test('repeated condition ID preserves separate chance and ordered source records, without conflating IDs',()=>{
 const r=analyze(fixture([ev([auto([
  {type:'condition',condition_id:10},
  {type:'condition',condition_id:11},
  {type:'condition',condition_id:10,chance:'0.7'}
 ])])]));
 const e=r.isolatedPreview.cards[0].events[0];
 assert.equal(r.summary.isolatedOrderedRepeatedStatusMentions,1);
 assert.deepEqual(e.statusEffects,[
  {kind:'add-condition',conditionId:10,possible:true,sourceEffectOrdinal:1},
  {kind:'add-condition',conditionId:11,possible:true},
  {kind:'add-condition',conditionId:10,possible:true,chance:0.7,sourceEffectOrdinal:3}
 ]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
});
test('source-ordinal validation rejects absent, duplicate, descending and invalid values',()=>{
 const e=(xs)=>({schemaVersion:1,cards:[{cardId:'30001',
  events:[{id:'evt',name:'evt',type:'auto',statusEffects:xs}]}]});
 const cure=(ordinal)=>({kind:'cure-one-bad',possible:true,
  ...(ordinal===undefined?{}:{sourceEffectOrdinal:ordinal})});
 for(const effects of [
  [cure(),cure()],[cure(1),cure()],[cure(1),cure(1)],
  [cure(3),cure(2)],[cure(0)],[cure(1.5)],[cure(-1)]
 ])assert.throws(()=>schema.validateCatalog(e(effects),model),/イベント検証/);
 assert.equal(schema.validateCatalog(e([cure(1),cure(3)]),model).eventsWithRecords,1);
});
test('duplicate status operations in exclusive outcomes stay choice/result guarded when merged with skill routes',()=>{
 const doc=ev([{label:'pick',random_either:true,outcomes:[
  [{type:'heal_status'},{type:'heal_status'}],
  [{type:'condition',condition_id:9}]
 ]}]);
 const r=analyze(fixture([doc]));
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 const eff=r.isolatedPreview.cards[0].events[0];
 assert.equal(eff.choices[0].outcomes[0].statusEffects.length,2);
 const skill={id:'gt-30001-event-001',name:'private',type:'choice',choices:[{
  id:'choice-01',label:'choose',outcomes:[
   {id:'route-01',label:'success',rewards:[]},
   {id:'route-02',label:'fail',rewards:[]}
  ]}]};
 const joined=mergeEvent(skill,eff);
 assert.ok(joined.event);
 assert.equal(joined.statusRows,3);
 assert.deepEqual(skill.choices[0].outcomes.map(o=>o.statusEffects),[undefined,undefined]);
 const card={id:'30001',events:[joined.event]};
 assert.equal(core.directStatusRoutes(card,{choices:{}}).length,0);
 const success=core.directStatusRoutes(card,{choices:{[skill.id]:'choice-01'},
   outcomes:{[skill.id]:'route-01'}});
 assert.deepEqual(success.map(o=>o.statusKind),['cure-one-bad','cure-one-bad']);
 assert.ok(success.every(o=>o.possible===true));
 const failure=core.directStatusRoutes(card,{choices:{[skill.id]:'choice-01'},
   outcomes:{[skill.id]:'route-02'}});
 assert.deepEqual(failure.map(o=>o.conditionId),[9]);
});
test('source row shape still rejects unsupported status fields, chance formats and conditions',()=>{
 for(const effects of [
  [{type:'heal_status',value:2}],
  [{type:'condition',condition_id:10,chance:'10%'}],
  [{type:'condition',condition_id:0}],
  [{type:'heal_status',condition_id:10}]
 ]){
  const r=analyze(fixture([ev([auto(effects)])]));
  assert.equal(r.summary.blockedEvents,1);
  assert.equal(r.summary.isolatedPreviewEventRecords,0);
 }
});
