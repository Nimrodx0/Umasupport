'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {analyzeStage,compareCheckerStop,historicalStageIndex,historicPairEvidence}=require('../tools/audit_whole_chain_topology.cjs');
const ev=(choices)=>({section:'arrows',id:44,choices});
const out=(effects)=>({effects});
const p={sourceKey:'checker:30001:abc',choiceCountAgreement:true};
const c=(stops)=>({sourceKey:p.sourceKey,choices:stops.map(x=>({results:[{terminalObserved:x}]}))});
const rows=(labels)=>labels.map((choiceLabelStatus,i)=>({sourceKey:p.sourceKey,choiceOrdinal:i+1,choiceLabelStatus}));

test('stage order and next identifiers are metadata not edges',()=>{
 const x=analyzeStage(ev([out([{type:'speed',value:'+5'}])]),3,2);
 assert.equal(x.sourceOrdinal,3);
 assert.equal(x.chainOrdinal,2);
 assert.equal(x.sourceLocalEventId,44);
 assert.equal(x.terminalRouteCount,0);
 assert.equal(x.choices[0].terminalExtent,'not-explicitly-terminal');
});
test('outcome-specific chain end never collapses to whole-choice end',()=>{
 const x=analyzeStage(ev([{outcomes:[
  [{type:'speed',value:'+5'}],[{type:'chain_end'}]]}]),7,1);
 assert.equal(x.choiceCount,1);
 assert.equal(x.routeCount,2);
 assert.equal(x.terminalRouteCount,1);
 assert.equal(x.choicesWithMixedTermination,1);
 assert.deepEqual(x.choices[0].terminalOutcomes,[2]);
 assert.equal(x.choices[0].terminalExtent,'mixed-outcome-termination');
});
test('explicit terminal for both choices counts as stop on all routes',()=>{
 const x=analyzeStage(ev([out([{type:'chain_end'}]),out([{type:'chain_end'}])]),4,1);
 assert.equal(x.terminalRouteCount,2);
 assert.equal(x.routeCount,2);
 assert.equal(x.choices[0].terminalExtent,'all-outcomes-explicitly-terminal');
});
test('conditional previous results are markers not proven event accessibility gates',()=>{
 const x=analyzeStage(ev([out([
  {type:'both_previous_chain_good'},{type:'skill_hint',skill_id:20123,value:'+3'},
  {type:'one_previous_chain_good'},{type:'skill_hint',skill_id:20123,value:'+2'},
  {type:'both_previous_chain_bad'},{type:'skill_hint',skill_id:20123,value:'+1'}
 ])]),5,3);
 assert.equal(x.priorMarkerCount,3);
 assert.equal(x.terminalRouteCount,0);
 assert.deepEqual(x.priorMarkerKinds,['both_previous_chain_bad',
  'both_previous_chain_good','one_previous_chain_good']);
});
test('guarded segments and guards-as-predecessor are detected without flattening',()=>{
 const x=analyzeStage(ev([{segments:[
  {when:[{kind:'success'}],outcomes:[[{type:'chain_end'}]]},
  {when:[{kind:'fail'}],outcomes:[[{type:'speed',value:'+1'}]]}
 ]}]),2,1);
 assert.equal(x.guard_route_count,undefined);
 assert.equal(x.guardedRouteCount,2);
 assert.equal(x.priorMarkerCount,2);
 assert.equal(x.choicesWithMixedTermination,1);
});
test('Checker/GameTora stop presence comparison requires label-aligned choice',()=>{
 const stage=analyzeStage(ev([out([{type:'chain_end'}]),
  out([{type:'speed',value:'+5'}])]),3,2);
 const aligned=compareCheckerStop(stage,p,rows(['label-exact-provisional','label-typographic-provisional']),c([true,true]));
 assert.equal(aligned.choiceStopPresenceAgree,1);
 assert.equal(aligned.choiceStopPresenceDisagree,1);
 assert.deepEqual(aligned.issues,[{choiceOrdinal:2,checkerObservedStop:true,sourceObservedStop:false}]);
 const unknown=compareCheckerStop(stage,p,rows(['label-not-comparable','label-disagreement']),c([true,true]));
 assert.equal(unknown.choicesNotIdentityAligned,2);
 assert.equal(unknown.choiceStopPresenceDisagree,0);
});
test('a missing Checker or conflicting choice cardinality is never cross-verified',()=>{
 const stage=analyzeStage(ev([out([{type:'chain_end'}])]),1,1);
 assert.equal(compareCheckerStop(stage,p,[],null).status,'source-only-event');
 assert.equal(compareCheckerStop(stage,{...p,choiceCountAgreement:false},rows([]),c([true])).status,'choice-count-conflict');
});
test('malformed chain stage rejects untyped effects and missing choice array',()=>{
 assert.throws(()=>analyzeStage({section:'random',choices:[]},1,1),/invalid chain/);
 assert.throws(()=>analyzeStage(ev([out([{bad:1}])]),1,1),/malformed effect/);
});

test('2025 unique stage-order evidence distinguishes supported adjacency from mismatch',()=>{
 const group=(events)=>({structuralStatus:'stage-complete-unique',chainMax:3,
   events:events.map(([sourceKey,stage])=>({sourceKey,stage}))});
 const historic={dataKind:'provisional-historical-chain-stage-audit',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',forSkillGrant:false,
  totals:{stageGroups:2},
  chainGroups:[group([['a',1],['b',2],['c',3]]),group([['d',1]])]};
 const h=historicalStageIndex(historic);
 assert.equal(historicPairEvidence('a','b',h),'2025-structural-stage-order-agrees');
 assert.equal(historicPairEvidence('b','a',h),'2025-stage-order-disagrees');
 assert.equal(historicPairEvidence('a','d',h),'2025-groups-differ-or-ambiguous');
 assert.equal(historicPairEvidence('a','missing',h),'missing-2025-stage-evidence');
 assert.throws(()=>historicalStageIndex({...historic,chainGroups:[group([['a',1]]),group([['a',1]])]}),/collision/);
});
