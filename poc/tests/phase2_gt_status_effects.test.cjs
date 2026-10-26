'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent,assemble}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const mk=(arr)=>({label:'',effects:arr});
const ev=(choices)=>({id:7,section:'random',name:'source text must never escape',choices});
function source(events){
 return {documents:[{kind:'support',id:30001,events_ja:Object.fromEntries(
  events.map((e,i)=>['source'+i,e]))}],
  index:{dataKind:'umasupport-whole-event-provisional-index',
   publicationApproval:false,sourcePins:{gameToraDerived:rev,checker:'pinned'},
   stats:{gameToraEventRecords:events.length},
   cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length},
    {cardId:'30002',sourceMissing:true,gameToraObservedCount:0}]}
 };
}
const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},
 skillById:{'skill:111':{id:'skill:111'}}};
test('GT condition and heal_status stay possible non-scalar operations, with signed stats distinct',()=>{
 const report=analyze(source([ev([mk([
  {type:'guts',value:'+4'},{type:'condition',condition_id:10},
  {type:'heal_status',chance:'0.2'}])])]));
 assert.equal(report.summary.sourceEvents,1);
 assert.equal(report.summary.statusSourceMentions,2);
 assert.equal(report.summary.statusValidMentions,2);
 assert.equal(report.summary.statusInvalidMentions,0);
 assert.equal(report.summary.isolatedPreviewEffectRecords,1);
 assert.equal(report.summary.isolatedPreviewStatusRecords,2);
 assert.equal(report.summary.unrecognizedEffectMentions,0);
 const projected=report.isolatedPreview.cards[0].events[0];
 assert.deepEqual(projected.statusEffects,[
  {kind:'add-condition',conditionId:10,possible:true},
  {kind:'cure-one-bad',possible:true,chance:0.2}
 ]);
 assert.deepEqual(projected.effects,[{kind:'guts',delta:4}]);
 assert.equal(schema.validateCatalog(report.isolatedPreview,model).eventsWithRecords,1);
 const card={id:'30001',events:[projected]};
 const routes=core.directStatusRoutes(card,{choices:{},outcomes:{}});
 assert.equal(routes.length,2);
 assert.ok(routes.every(r=>r.possible&&r.conditional));
 assert.deepEqual(routes.map(r=>r.statusKind),['add-condition','cure-one-bad']);
 assert.equal(routes[1].chance,0.2);
 assert.equal(core.directEffectRoutes(card,{choices:{},outcomes:{}}).length,1);
 assert.equal(core.directRoutes(card,{choices:{},outcomes:{}}).length,0);
 assert.ok(!JSON.stringify(report).includes('source text must never escape'));
});
test('status-only auto and random outcome branches do not fabricate unselected grants',()=>{
 const report=analyze(source([ev([mk([{type:'heal_status'}])]),
  ev([{label:'A',random_either:true,outcomes:[
   [{type:'condition',condition_id:1}],
   [{type:'heal_status'},{type:'energy',value:'-3'}]
  ]}])]));
 assert.equal(report.summary.isolatedPreviewEventRecords,2);
 const card={id:'30001',events:report.isolatedPreview.cards[0].events};
 const [first,second]=card.events;
 assert.equal(first.type,'auto');
 assert.equal(second.type,'choice');
 assert.equal(core.directStatusRoutes(card,{choices:{},outcomes:{}}).length,1);
 const selected=core.directStatusRoutes(card,{choices:{[second.id]:'choice-1'},outcomes:{}});
 assert.equal(selected.length,3);
 assert.ok(selected.filter(r=>r.eventId===second.id).every(x=>x.conditional));
 const picked=core.directStatusRoutes(card,{choices:{[second.id]:'choice-1'},
  outcomes:{[second.id]:'result-2'}});
 assert.deepEqual(picked.map(x=>x.statusKind),['cure-one-bad','cure-one-bad']);
});
test('unknown source status shapes, probability formats and condition IDs quarantine without guessing',()=>{
 const invalids=[
  [{type:'condition',condition_id:null}],
  [{type:'condition',condition_id:-1}],
  [{type:'condition',condition_id:7,value:'1'}],
  [{type:'condition',condition_id:7,chance:'60%'}],
  [{type:'condition',condition_id:7,chance:0}],
  [{type:'condition',condition_id:7,chance:1.3}],
  [{type:'heal_status',condition_id:1}],
  [{type:'heal_status',value:'+1'}]
 ];
 for(const effects of invalids){
  const report=analyze(source([ev([mk(effects)])]));
  assert.equal(report.summary.blockedEvents,1,JSON.stringify(effects));
  assert.equal(report.summary.isolatedPreviewEventRecords,0);
 }
 const bad=(x)=>({schemaVersion:1,cards:[{cardId:'30001',events:[{
  id:'test',name:'test',type:'auto',statusEffects:[x]}]}]});
 for(const x of [
  {kind:'add-condition',conditionId:0,possible:true},
  {kind:'add-condition',conditionId:1,possible:false},
  {kind:'cure-one-bad',possible:true,conditionId:3},
  {kind:'cure-one-bad',possible:true,chance:2},
  {kind:'energy',possible:true}
 ])assert.throws(()=>schema.validateCatalog(bad(x),model),/イベント検証/);
});
test('join preserves skill rewards, source result exclusivity and status branch operations',()=>{
 const skill={id:'gt-30001-event-001',name:'private',type:'choice',choices:[{
  id:'choice-01',label:'choice',outcomes:[
   {id:'route-01-or-1',label:'variant1',rewards:[{skillId:'skill:111',level:1}]},
   {id:'route-01-or-2',label:'variant2',rewards:[]},
   {id:'route-02',label:'failure',rewards:[]}
  ]}]};
 const stat={id:'gt:30001:001:effect-only',name:'anonymous',type:'choice',choices:[{
  id:'choice-1',label:'choice',outcomes:[
   {id:'result-1',label:'pass',statusEffects:[{kind:'add-condition',conditionId:10,possible:true}]},
   {id:'result-2',label:'fail',statusEffects:[{kind:'cure-one-bad',possible:true}],
    effects:[{kind:'speed',delta:1}]}
  ]}]};
 const joined=mergeEvent(skill,stat);
 assert.equal(joined.effectRows,1);
 assert.equal(joined.statusRows,3);
 const card={id:'30001',events:[joined.event]};
 const selected={choices:{[skill.id]:'choice-01'},outcomes:{}};
 const routes=core.directStatusRoutes(card,selected);
 assert.equal(routes.length,3);
 assert.ok(routes.every(r=>r.conditional&&r.possible));
 assert.deepEqual(routes.map(r=>r.statusKind),
  ['add-condition','add-condition','cure-one-bad']);
 const final=core.directStatusRoutes(card,{choices:{[skill.id]:'choice-01'},
  outcomes:{[skill.id]:'route-02'}});
 assert.equal(final.length,1);
 assert.equal(final[0].statusKind,'cure-one-bad');
 assert.deepEqual(core.directRoutes(card,{choices:{[skill.id]:'choice-01'},
  outcomes:{[skill.id]:'route-01-or-1'}}).map(r=>r.skillId),['skill:111']);
});
