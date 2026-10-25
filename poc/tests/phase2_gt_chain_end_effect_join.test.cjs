'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const {mergeEvent}=require('../src/phase2_2512_private_effect_join.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const revision='6e38b54af4fad397ff4491e63007a90705a4fe67';
const mk=(v)=>({label:v.label??'',random_either:!!v.random_either,
 ...(v.outcomes?{outcomes:v.outcomes}:{effects:v.effects})});
const ev=(section,choices)=>({id:1,name:'SENSITIVE_SOURCE_PROSE',section,choices});
function fixture(events){
 return {documents:[{kind:'support',id:30001,events_ja:Object.fromEntries(
 events.map((e,i)=>['source'+i,e]))}],
 index:{dataKind:'umasupport-whole-event-provisional-index',
 publicationApproval:false,sourcePins:{gameToraDerived:revision,checker:'test'},
 stats:{gameToraEventRecords:events.length},
 cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length}]}
 };
}
const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},skillById:{}};
test('source-only arrow branch stop remains result-specific; non-skill values on continuing branch are kept',()=>{
 const f=fixture([ev('arrows',[mk({label:'Pick',random_either:true,outcomes:[
  [{type:'guts',value:'+4'}],
  [{type:'wisdom',value:'+2'},{type:'chain_end'}]]})])]);
 const audit=analyze(f);
 assert.equal(audit.summary.chainEndMentions,1);
 assert.equal(audit.summary.chainEndAcceptedSourceMentions,1);
 assert.equal(audit.summary.chainEndRejectedSourceMentions,0);
 assert.equal(audit.summary.isolatedTerminalOutcomeRecords,1);
 assert.equal(audit.summary.eligibleRoutes,2);
 assert.equal(audit.summary.isolatedPreviewEventRecords,1);
 const event=audit.isolatedPreview.cards[0].events[0];
 assert.equal(event.type,'choice');
 const [a,b]=event.choices[0].outcomes;
 assert.equal(a.terminal,undefined);
 assert.equal(b.terminal,true);
 assert.deepEqual(b.effects,[{kind:'wisdom',delta:2}]);
 assert.equal(schema.validateCatalog(audit.isolatedPreview,model).eventsWithRecords,1);
 assert.ok(!JSON.stringify(audit).includes('SENSITIVE_SOURCE_PROSE'));
 const route=core.directEffectRoutes({id:'30001',events:[event]},{
  choices:{[event.id]:'choice-1'},outcomes:{[event.id]:'result-2'}});
 assert.deepEqual(route.map(x=>x.delta),[2]);
});
test('verified leaf terminal must exactly match existing skill runtime terminal including exclusive hint variants',()=>{
 const skill={id:'gt-30001-event-001',name:'private',type:'choice',choices:[{
  id:'choice-01',label:'privateChoice',outcomes:[
   {id:'route-01',label:'continue',rewards:[]},
   {id:'route-02-or-1',label:'stop A',terminal:true,rewards:[]},
   {id:'route-02-or-2',label:'stop B',terminal:true,rewards:[]}
  ]}]};
 const effect={id:'gt:30001:001:effect-only',name:'anonymous',type:'choice',choices:[{
  id:'choice-1',label:'first',outcomes:[
   {id:'result-1',label:'continuing',effects:[{kind:'guts',delta:2}]},
   {id:'result-2',label:'stopped',terminal:true,
    effects:[{kind:'energy',delta:-20}]}]}]};
 const merged=mergeEvent(skill,effect);
 assert.equal(merged.effectRows,3);
 assert.deepEqual(merged.event.choices[0].outcomes.map(x=>x.terminal),
  [undefined,true,true]);
 assert.deepEqual(merged.event.choices[0].outcomes.map(x=>x.effects?.[0]?.delta),
  [2,-20,-20]);
 assert.deepEqual(skill.choices[0].outcomes.map(x=>x.effects),
  [undefined,undefined,undefined]);
 const broken=structuredClone(skill);
 delete broken.choices[0].outcomes[2].terminal;
 assert.deepEqual(mergeEvent(broken,effect),{event:null,reason:'SOURCE_TERMINAL_MISMATCH'});
 const notEnded=structuredClone(effect);
 delete notEnded.choices[0].outcomes[1].terminal;
 assert.deepEqual(mergeEvent(skill,notEnded),{event:null,reason:'SOURCE_TERMINAL_MISMATCH'});
});
test('never promote nonchain, extra fields, duplicate stops or other control markers',()=>{
 const cases=[
  ev('random',[mk({effects:[{type:'chain_end'},{type:'guts',value:'+5'}]})]),
  ev('arrows',[mk({effects:[{type:'chain_end',value:1},{type:'guts',value:'+5'}]})]),
  ev('arrows',[mk({label:'no',effects:[
   {type:'chain_end'},{type:'chain_end'},{type:'guts',value:'+5'}]})]),
  ev('arrows',[mk({effects:[{type:'branch_flag',flag:'brian_tryhard'},
   {type:'guts',value:'+5'}]})]),
  ev('arrows',[mk({effects:[{type:'both_previous_chain_good'},
   {type:'guts',value:'+5'}]})])
 ];
 for(const x of cases){
  const r=analyze(fixture([x]));
  assert.equal(r.summary.blockedEvents,1);
  assert.equal(r.summary.isolatedPreviewEventRecords,0);
  assert.ok(Object.keys(r.blockedReasons).length>0);
 }
});
test('a stop marker alongside another valid choice remains exclusive and never ends all choices',()=>{
 const f=fixture([ev('arrows',[
  mk({label:'stop',effects:[{type:'power',value:'+5'},{type:'chain_end'}]}),
  mk({label:'continue',effects:[{type:'power',value:'+10'}]})
 ])]);
 const r=analyze(f);
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 const e=r.isolatedPreview.cards[0].events[0];
 assert.equal(e.choices[0].terminal,true);
 assert.equal(e.choices[1].terminal,undefined);
 const skill={id:'gt-30001-event-001',name:'private',type:'choice',choices:[
  {id:'choice-01',label:'stopped',terminal:true,rewards:[]},
  {id:'choice-02',label:'continuing',rewards:[]}
 ]};
 assert.equal(mergeEvent(skill,e).effectRows,2);
 const bad=structuredClone(skill);
 bad.choices[1].terminal=true;
 assert.equal(mergeEvent(bad,e).reason,'SOURCE_TERMINAL_MISMATCH');
});
