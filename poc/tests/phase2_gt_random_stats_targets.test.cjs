'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const pinned='6e38b54af4fad397ff4491e63007a90705a4fe67';
function fixture(events){
 return {documents:[{kind:'support',id:30001,events_ja:Object.fromEntries(
  events.map((e,i)=>['source'+i,e]))}],
 index:{dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,sourcePins:{gameToraDerived:pinned,checker:'pinned'},
  stats:{gameToraEventRecords:events.length},
  cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length}]}
 };
}
function ev(choices){return {name:'DO NOT COPY SOURCE PROSE',section:'random',choices};}
const auto=effects=>({label:'',effects,random_either:false});
const rng=(v,n)=>({type:'random_stats',value:v,...(n===undefined?{}:{stat_count:n})});
const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},skillById:{}};
test('random +20 to one distinct stat, -5 to two; never implies a guaranteed stat',()=>{
 const r=analyze(fixture([
  ev([auto([rng('+20',1),{type:'guts',value:'+5'}])]),
  ev([auto([rng('-5',2)])])
 ]));
 assert.equal(r.summary.randomStatMentions,2);
 assert.equal(r.summary.validRandomStatMentions,2);
 assert.equal(r.summary.invalidRandomStatMentions,0);
 assert.equal(r.summary.unrecognizedEffectMentions,0);
 assert.equal(r.summary.isolatedPreviewDynamicRecords,2);
 assert.equal(r.summary.isolatedPreviewEffectRecords,1);
 const events=r.isolatedPreview.cards[0].events;
 assert.deepEqual(events[0].dynamicEffects,
  [{kind:'random-stats',delta:20,statCount:1,targetSelection:'random-distinct'}]);
 assert.deepEqual(events[1].dynamicEffects,
  [{kind:'random-stats',delta:-5,statCount:2,targetSelection:'random-distinct'}]);
 assert.equal(schema.validateCatalog(r.isolatedPreview,model).eventsWithRecords,2);
 const card={id:'30001',events};
 const dynamics=core.directDynamicEffectRoutes(card);
 assert.deepEqual(dynamics.map(x=>x.delta),[20,-5]);
 assert.deepEqual(dynamics.map(x=>x.statCount),[1,2]);
 assert.ok(dynamics.every(x=>x.conditional&&x.unresolvedTargets));
 assert.equal(core.directEffectRoutes(card).length,1);
 assert.equal(core.directRoutes(card).length,0);
 assert.ok(!JSON.stringify(r).includes('DO NOT COPY SOURCE PROSE'));
});
test('random target count follows pinned event_engine clamp for 0/null/>5',()=>{
 const r=analyze(fixture([
  ev([auto([rng('+3')])]),
  ev([auto([rng('+4',null)])]),
  ev([auto([rng('+5',0)])]),
  ev([auto([rng('+6',8)])]),
  ev([auto([rng('+7',-10)])])
 ]));
 assert.equal(r.summary.randomStatMentions,5);
 assert.equal(r.summary.validRandomStatMentions,5);
 assert.deepEqual(r.isolatedPreview.cards[0].events.map(e=>e.dynamicEffects[0].statCount),
  [1,1,1,5,1]);
});
test('in exclusive success/failure, never assign effect to a named stat or unselected choice',()=>{
 const r=analyze(fixture([ev([
  {label:'choose',random_either:true,outcomes:[
   [rng('+10',2),{type:'condition',condition_id:10}],
   [{type:'energy',value:'-10'}]]}
 ])]));
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 const event=r.isolatedPreview.cards[0].events[0];
 assert.equal(event.type,'choice');
 const card={id:'30001',events:[event]};
 assert.equal(core.directDynamicEffectRoutes(card,{choices:{},outcomes:{}}).length,0);
 const selected=core.directDynamicEffectRoutes(card,{choices:{[event.id]:'choice-1'},outcomes:{}});
 assert.equal(selected.length,1);
 assert.equal(selected[0].unresolvedTargets,true);
 assert.ok(selected[0].condition.includes('結果'));
 assert.equal(core.directDynamicEffectRoutes(card,{choices:{[event.id]:'choice-1'},
  outcomes:{[event.id]:'result-2'}}).length,0);
 assert.equal(core.directStatusRoutes(card,{choices:{[event.id]:'choice-1'},
  outcomes:{[event.id]:'result-1'}}).length,1);
});
test('invalid source numeric, extra semantics, and multiple random draws quarantine rather than guessing',()=>{
 const cases=[
  [rng('3/5',1)],[rng('+7','two')],[rng('+4',{x:2})],
  [{...rng('+5',1),condition_id:8}],
  [rng('+10',2),rng('+5',1)],
  [rng('not-known',1)]
 ];
 for(const effects of cases){
  const r=analyze(fixture([ev([auto(effects)])]));
  assert.equal(r.summary.blockedEvents,1,JSON.stringify(effects));
  assert.equal(r.summary.isolatedPreviewEventRecords,0);
 }
 const bad=[
  {kind:'random-stats',delta:5,statCount:0,targetSelection:'random-distinct'},
  {kind:'random-stats',delta:5,statCount:6,targetSelection:'random-distinct'},
  {kind:'random-stats',delta:0,statCount:2,targetSelection:'random-distinct'},
  {kind:'random-stats',delta:5,statCount:2,targetSelection:'chosen'},
  {kind:'speed',delta:5,statCount:2,targetSelection:'random-distinct'}
 ];
 for(const x of bad)assert.throws(()=>schema.validateCatalog({schemaVersion:1,cards:[
  {cardId:'30001',events:[{id:'x',name:'x',type:'auto',dynamicEffects:[x]}]}]},model),/イベント検証/);
});
test('skill result OR variants inherit same dynamic target operation but never duplicate guaranteed stats',()=>{
 const skill={id:'gt-30001-event-001',name:'event',type:'auto',outcomes:[
  {id:'route-01-or-1',label:'hint 1',rewards:[]},
  {id:'route-01-or-2',label:'hint 2',rewards:[]},
  {id:'route-02',label:'failure',rewards:[]}]};
 const effects={id:'gt:30001:001:effect-only',name:'private',type:'auto',
  outcomes:[
   {id:'result-1',label:'success',dynamicEffects:[{kind:'random-stats',
     delta:10,statCount:1,targetSelection:'random-distinct'}]},
   {id:'result-2',label:'fail',effects:[{kind:'energy',delta:-5}]}]};
 const joined=mergeEvent(skill,effects);
 assert.equal(joined.dynamicRows,2);
 assert.equal(joined.effectRows,1);
 assert.deepEqual(joined.event.outcomes.map(o=>o.dynamicEffects?.[0]?.statCount),[1,1,undefined]);
 const picked=core.directDynamicEffectRoutes({id:'30001',events:[joined.event]},
  {outcomes:{[skill.id]:'route-01-or-2'}});
 assert.equal(picked.length,1);
 assert.equal(picked[0].unresolvedTargets,true);
});
