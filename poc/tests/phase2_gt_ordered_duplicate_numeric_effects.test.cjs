'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const mk=(effects)=>({label:'',random_either:false,effects});
const ev=(effects)=>({id:9,name:'ORIGINAL_GT_PROSE_DO_NOT_COPY',section:'arrows',
 choices:[mk(effects)]});
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
test('preserve repeated negative/positive energy and mood effects as distinct ordered source entries',()=>{
 const r=analyze(fixture([ev([
  {type:'energy',value:'-30'},
  {type:'mood',value:'+1'},
  {type:'energy',value:'+50'},
  {type:'mood',value:'-1'}
 ])]));
 assert.equal(r.summary.repeatedNumericSourceMentions,2);
 assert.equal(r.summary.eligibleRepeatedNumericSourceMentions,2);
 assert.equal(r.summary.isolatedOrderedRepeatedNumericMentions,2);
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 const event=r.isolatedPreview.cards[0].events[0];
 assert.deepEqual(event.effects,[
  {kind:'energy',delta:-30,sourceEffectOrdinal:1},
  {kind:'mood',delta:1,sourceEffectOrdinal:2},
  {kind:'energy',delta:50,sourceEffectOrdinal:3},
  {kind:'mood',delta:-1,sourceEffectOrdinal:4}
 ]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
 const rows=core.directEffectRoutes({id:'30001',events:[event]});
 assert.deepEqual(rows.map(x=>x.sourceEffectOrdinal),[1,2,3,4]);
 assert.deepEqual(rows.map(x=>x.delta),[-30,1,50,-1]);
 assert.ok(!JSON.stringify(r).includes('ORIGINAL_GT_PROSE_DO_NOT_COPY'));
});
test('all_stats five-component source bundle and individual stat retain original source order without aggregation',()=>{
 const r=analyze(fixture([ev([
  {type:'speed',value:'+3'},
  {type:'all_stats',value:'+5'},
  {type:'speed',value:'-2'},
  {type:'bond',value:'+3',char_id:500},
  {type:'bond',value:'+8',char_id:500},
  {type:'bond',value:'+6',char_id:501}
 ])]));
 assert.equal(r.summary.repeatedNumericSourceMentions,3);
 assert.equal(r.summary.isolatedOrderedRepeatedNumericMentions,3);
 const e=r.isolatedPreview.cards[0].events[0].effects;
 assert.deepEqual(e.filter(x=>x.kind==='speed'),[
  {kind:'speed',delta:3,sourceEffectOrdinal:1},
  {kind:'speed',delta:5,sourceBundle:'all_stats',sourceEffectOrdinal:2},
  {kind:'speed',delta:-2,sourceEffectOrdinal:3}
 ]);
 assert.deepEqual(e.filter(x=>x.kind==='bond'),[
  {kind:'bond',delta:3,recipientCharId:500,sourceEffectOrdinal:4},
  {kind:'bond',delta:8,recipientCharId:500,sourceEffectOrdinal:5},
  {kind:'bond',delta:6,recipientCharId:501}
 ]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,1);
});
test('schema blocks repeated components with missing, backwards, or identical source ordinal',()=>{
 const numeric=[
  {kind:'energy',delta:-3,sourceEffectOrdinal:2},
  {kind:'energy',delta:5,sourceEffectOrdinal:3}
 ];
 const make=effects=>({schemaVersion:1,cards:[{cardId:'30001',
  events:[{id:'evt',name:'anonymous',type:'auto',effects}]}]});
 assert.equal(schema.validateCatalog(make(numeric),model).eventsWithRecords,1);
 for(const mutant of [
  [{kind:'energy',delta:1},{kind:'energy',delta:2}],
  [{kind:'energy',delta:1,sourceEffectOrdinal:2},{kind:'energy',delta:2}],
  [{kind:'energy',delta:1,sourceEffectOrdinal:2},
   {kind:'energy',delta:2,sourceEffectOrdinal:2}],
  [{kind:'energy',delta:1,sourceEffectOrdinal:3},
   {kind:'energy',delta:2,sourceEffectOrdinal:1}],
  [{kind:'energy',delta:1,sourceEffectOrdinal:0}],
  [{kind:'energy',delta:1,sourceEffectOrdinal:1.5}]
 ])assert.throws(()=>schema.validateCatalog(make(mutant),model),/イベント検証/);
});
test('joining repeated effects preserves exact skill award/outcome terminal and individual operation sequence',()=>{
 const skill={id:'gt-30001-event-001',name:'private',type:'choice',choices:[
  {id:'choice-01',label:'continue',rewards:[]},
  {id:'choice-02',label:'stop',rewards:[],terminal:true}]};
 const stat={id:'gt:30001:001:effect-only',name:'anonymous',type:'choice',choices:[
  {id:'choice-1',label:'a',effects:[
   {kind:'energy',delta:-20,sourceEffectOrdinal:1},
   {kind:'energy',delta:15,sourceEffectOrdinal:3}]},
  {id:'choice-2',label:'b',terminal:true,effects:[
   {kind:'guts',delta:3}]}]};
 const a=mergeEvent(skill,stat);
 assert.equal(a.effectRows,3);
 assert.deepEqual(a.event.choices[0].effects,stat.choices[0].effects);
 assert.equal(a.event.choices[1].terminal,true);
 assert.equal(core.directEffectRoutes({id:'30001',events:[a.event]},{
  choices:{[skill.id]:'choice-01'}}).length,2);
 assert.deepEqual(skill.choices[0].effects,undefined);
});
