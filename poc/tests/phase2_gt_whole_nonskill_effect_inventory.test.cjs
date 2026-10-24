'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const schema=require('../src/event_schema.js');
const core=require('../src/core.js');
const rev='6e38b54af4fad397ff4491e63007a90705a4fe67';
const effect=(type,value,char_id)=>({type,value,...(char_id?{char_id}:{})});
const mk=(effects,random_either=false)=>({label:'',random_either,effects});
const ev=(id,choices,section='random')=>({id,name:'private-event',section,choices});
function fixture(events){
 return {
  documents:[{kind:'support',id:30001,events_ja:Object.fromEntries(
   events.map((e,i)=>['evt'+(i+1),e]))}],
  index:{dataKind:'umasupport-whole-event-provisional-index',
   publicationApproval:false,sourcePins:{gameToraDerived:rev,checker:'checker'},
   stats:{gameToraEventRecords:events.length},
   cards:[{cardId:'30001',sourceMissing:false,gameToraObservedCount:events.length},
    {cardId:'30002',sourceMissing:true,gameToraObservedCount:0}]}
 };
}
test('source positions and numeric recipient targets remain distinct, never copied as prose',()=>{
 const a=ev(1,[mk([effect('bond','+5',1003),effect('bond','+2',1004),
  effect('power','-10'),effect('skill_hint','+1')])]);
 const report=analyze(fixture([a]));
 const t=report.summary;
 assert.equal(t.rosterCards,2);
 assert.equal(t.sourceCards,1);
 assert.equal(t.sourceEvents,1);
 assert.equal(t.sourceChoices,1);
 assert.equal(t.expandedRoutes,1);
 assert.equal(t.allEffectMentions,4);
 assert.equal(t.sourceSkillEffectMentions,1);
 assert.equal(t.eligibleNumericEffectMentions,3);
 assert.equal(t.eligibleRoutes,1);
 assert.equal(t.isolatedPreviewEventRecords,1);
 assert.equal(t.isolatedPreviewEffectRecords,3);
 const e=report.isolatedPreview.cards[0].events[0];
 assert.equal(e.name,'非公開元イベント001');
 assert.equal(e.type,'auto');
 assert.deepEqual(e.effects,[
  {kind:'bond',delta:5,recipientCharId:1003},
  {kind:'bond',delta:2,recipientCharId:1004},
  {kind:'power',delta:-10}
 ]);
 const model={cards:[{id:'30001'}],cardById:{'30001':{id:'30001'}},
  skillById:{}};
 assert.equal(schema.validateCatalog(report.isolatedPreview,model).eventsWithRecords,1);
 const routes=core.directEffectRoutes({id:'30001',events:[e]},{
  choices:{},outcomes:{}});
 assert.deepEqual(routes.filter(x=>x.effectKind==='bond').map(x=>x.recipientCharId),
  [1003,1004]);
 assert.equal(core.directRoutes({id:'30001',events:[e]},{
  choices:{},outcomes:{}}).length,0);
 assert.equal(JSON.stringify(report).includes('private-event'),false);
});
test('explicit random_either result groups preserve alternatives, and choice is never implicitly selected',()=>{
 const choice={label:'selected?',random_either:true,outcomes:[
  [effect('guts','+4'),effect('skill_points','+10')],
  [effect('guts','+1'),effect('energy','-5')]
 ]};
 const f=fixture([ev(2,[choice])]),r=analyze(f);
 assert.equal(r.summary.expandedRoutes,2);
 assert.equal(r.summary.eligibleRoutes,2);
 assert.equal(r.summary.isolatedPreviewOutcomeRecords,2);
 const c=r.isolatedPreview.cards[0],event=c.events[0];
 assert.equal(event.type,'choice');assert.equal(event.choices.length,1);
 const runtime={id:'30001',events:c.events};
 assert.equal(core.directEffectRoutes(runtime,{choices:{},outcomes:{}}).length,0);
 const selected=core.directEffectRoutes(runtime,{choices:{[event.id]:'choice-1'},outcomes:{}});
 assert.equal(selected.length,4);
 assert.ok(selected.every(x=>x.conditional));
 const success=core.directEffectRoutes(runtime,{choices:{[event.id]:'choice-1'},
  outcomes:{[event.id]:'result-1'}});
 assert.deepEqual(success.map(x=>x.delta),[4,10]);
});
test('conditional segments, duplicated recipient, undecodable values and unknown effect codes are quarantined',()=>{
 const parts=[
  ev(1,[mk([effect('bond','+5',1003),effect('bond','+2',1003)])]),
  ev(2,[mk([effect('sga','+1'),effect('guts','+2')])]),
  ev(3,[mk([effect('energy','+1/+3')])]),
  ev(4,[{label:'',segments:[
   {when:[{kind:'success'}],effects:[effect('power','+1')]},
   {when:[{kind:'fail'}],effects:[effect('power','+2')]}]}]),
  ev(5,[{label:'',outcomes:[[effect('mood','+1')],[effect('mood','+2')]]}]),
  ev(6,[mk([effect('energy',0),effect('guts','+2')])])
 ];
 const r=analyze(fixture(parts));
 assert.equal(r.summary.sourceEvents,6);
 assert.equal(r.summary.expandedRoutes,8);
 assert.equal(r.summary.blockedEvents,5);
 assert.equal(r.summary.eligibleEvents,1);
 assert.equal(r.summary.isolatedPreviewEventRecords,1);
 assert.equal(r.summary.zeroNonSkillMentions,1);
 assert.equal(r.summary.isolatedPreviewEffectRecords,1);
 assert.ok(r.blockedReasons.DUPLICATE_EFFECT_COMPONENT_UNADJUDICATED>0);
 assert.ok(r.blockedReasons.UNSUPPORTED_EFFECT_TYPE>0);
 assert.ok(r.blockedReasons.NONSCALAR_OR_INVALID_NUMERIC_VALUE>0);
 assert.ok(r.blockedReasons.CONDITIONAL_SEGMENTS_NOT_MODELED>0);
 assert.ok(r.blockedReasons.UNFLAGGED_MULTIPLE_RESULT_ROUTES>0);
 assert.equal(JSON.stringify(r.isolatedPreview).includes('sga'),false);
});
test('unknown or malformed source cards and mismatched audit population fail closed',()=>{
 const base=fixture([ev(1,[mk([effect('guts','+3')])])]);
 assert.throws(()=>analyze(base,{strict:true}),/固定563\/559カード/);
 for(const mutate of [
  x=>{x.index.publicationApproval=true},
  x=>{x.index.sourcePins.gameToraDerived='invalid'},
  x=>{x.index.stats.gameToraEventRecords=3},
  x=>{x.index.cards[0].gameToraObservedCount=2},
  x=>{x.documents.push(structuredClone(x.documents[0]))},
  x=>{x.documents[0].events_ja.evt1.section='unknown'},
  x=>{x.documents[0].events_ja.evt1.choices=[]}
 ]){
  const x=structuredClone(base);mutate(x);
  assert.throws(()=>analyze(x),/GT非スキル全件監査/,mutate.toString());
 }
});
test('route guards remain an isolated blocker even when their raw scalar is numeric',()=>{
 const x=fixture([ev(1,[{
  label:'',segments:[{when:[{kind:'scripted'}],effects:[
   effect('bond','+5',1111),effect('chain_end','+1')]}]
 }])]);
 const a=analyze(x);
 assert.equal(a.summary.blockedRoutes,1);
 assert.equal(a.summary.sourceControlEffectMentions,1);
 assert.equal(a.summary.isolatedPreviewEventRecords,0);
 assert.ok(a.rows[0].issueCodes.includes('SOURCE_ROUTE_GUARD_UNMODELED'));
});
