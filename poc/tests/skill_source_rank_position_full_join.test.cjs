'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const rank=require('../src/skill_source_rank_tick_bridge.cjs');
const stage=require('../src/skill_source_position_stage_facts.cjs');
const full=require('../src/skill_source_whole_tick_monitor.cjs');
const combined=require('../tools/globalsim_p2_15_source_rank_position_full_join.cjs');
const distance=require('../tools/globalsim_p2_15_source_distance_rate_ticks.cjs');
const OP=32;
const pack=(a,b,c,d,e,f)=>[a,b,c,d,e,f].reduce((s,v)=>s*OP+v,0);
const p=(type,operator,value)=>({type,operator,value});
const skill=(id,conditions,preConditions=[])=>({
 status:'source-structure',sourceNumericId:id,
 invokes:[{index:0,conditions,preConditions}]
});
function fixture(profiles){
 const n=9,seed=123;
 const plan={seed,fieldSize:n,course:{id:10502,distance:1600,
  distanceType:2,surface:'turf'},scenario:'balanced',mode:'equal',
  strategies:['Nige','Nige','Senkou','Senkou','Sasi','Sasi','Sasi','Oikomi','Oikomi']};
 const a={seed,skillEvents:[],frames:[]},b=structuredClone(a),
  c=structuredClone(a);
 for(let t=0;t<3;t++){
  const fA={t,horses:[]},fP={t,horses:[]},fR={t,horses:[]};
  for(let i=0;i<n;i++){
   const now=101-i*10+t,previous=now-1,k=i+1;
   const base=[now,13.5,100,0.2,0,-1];
   fA.horses.push([...base]);
   fP.horses.push(t?[...base.slice(0,4),previous,previous]:[...base]);
   fR.horses.push(t?[...base.slice(0,4),t===1?k:0,
    pack(k,t===1?0:k,k,t===1?0:k,k,k)]:[...base]);
  }
  a.frames.push(fA);b.frames.push(fP);c.frames.push(fR);
 }
 const e=stage.verifyPinnedSources(
  stage.CHECKER_ANCHORS.join('\n')+'x'.repeat(1300),
  stage.STATE_ANCHORS.join('\n')+'x'.repeat(1300),
  stage.CALCULATOR_ANCHORS.join('\n')+'x'.repeat(1300));
 return {plans:[plan],original:[a],positions:[b],ranks:[c],
  profiles,positionSourceEvidence:e};
}
test('absolute order facts retain original predicate indexes and operators without rate rounding',()=>{
 const ast=full.compile(skill('100001',[
  [p('order','<=',3),p('order','>',1),p('order_rate','<=',50),
   p('order','==',0),p('order','>=',12)]],
  [[p('order','!=',2)]]));
 const facts=rank.observedAbsoluteOrderFacts(ast,2,9);
 assert.deepEqual(facts.map(x=>[x.side,x.predicateIndex,x.satisfied]),[
  ['conditions',0,true],['conditions',1,true],['preConditions',0,false]]);
 assert.deepEqual(rank.observedAbsoluteOrderFacts(ast,null,9),[]);
 assert.equal(rank.observedAbsoluteOrderFacts(ast,9,12).length,4);
 assert.equal(rank.observedAbsoluteOrderFacts(ast,3,12)[0].satisfied,true);
 assert.throws(()=>rank.observedAbsoluteOrderFacts(ast,13,12),/rank outside/);
 assert.throws(()=>rank.observedAbsoluteOrderFacts(ast,1,18),/only previously verified|rank outside/);
 assert.equal(rank.observedOrderRateFacts(ast,5,9).length,1,
  'existing order_rate mapping remains separate and unchanged');
});
test('same stage, same runner original AND combines rate, phase, order_rate and order',()=>{
 const f=fixture([skill('100001',[
  [p('running_style','==',1),p('distance_rate','>=',1),
   p('phase','==',0),p('order_rate','<=',50),p('order','<=',1)]
 ])]);
 const e=rank.buildEvidence(f.plans,f.original,f.positions,f.ranks);
 const before=distance.analyze(f.plans,f.original,f.positions,f.profiles,
  {rankEvidence:e,positionSourceEvidence:f.positionSourceEvidence});
 const after=distance.analyze(f.plans,f.original,f.positions,f.profiles,
  {rankEvidence:e,positionSourceEvidence:f.positionSourceEvidence,
   includeAbsoluteOrder:true,unknownRouteTriage:true});
 assert.equal(before.totals.modelRunnerPriorityTicks,18);
 assert.equal(before.raceOpportunity.totals.verdicts['observed-at-least-once-true'],0);
 assert.equal(before.raceOpportunity.totals.verdicts['observed-unknown-without-true'],2);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-at-least-once-true'],1);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-unknown-without-true'],0);
 assert.equal(after.raceOpportunity.totals.verdicts['observed-all-false'],8);
 assert.equal(after.denominators.sourceAbsoluteOrderSkillsAmongDistanceRate,1);
 assert.equal(after.denominators.sourceAbsoluteOrderPredicateOccurrences,1);
 assert.equal(after.totals.modelAbsoluteOrderPredicateFacts,18);
 assert.equal(after.gates.originalUmaSimAbsoluteOrderConditionImplemented,false);
 const delta=combined.compare(before,after,e);
 assert.equal(delta.changedOriginalSkillStyleCells,1);
 assert.equal(delta.extraAbsoluteOrderModelTickOutcomes.unknown,-4);
 assert.equal(delta.trueGameSkillProcObserved,false);
 assert.equal(delta.gameRate,null);
 assert.equal(delta.P3CardScore,null);
});
test('unobserved source dynamic AND and historical precondition remain unknown after both ranks',()=>{
 const f=fixture([skill('100002',[
  [p('running_style','==',1),p('distance_rate','>=',1),
   p('phase','==',0),p('order_rate','<=',50),p('order','<=',1),
   p('is_overtake','==',1)]
 ],[[p('corner','==',2)]])]);
 const result=combined.analyze(f.plans,f.original,f.positions,f.ranks,
  f.profiles,f.positionSourceEvidence);
 assert.equal(result.comparison.modelRunnerRaceVerdictsAfterAbsoluteOrder[
  'observed-at-least-once-true'],0);
 assert(result.comparison.modelRunnerRaceVerdictsAfterAbsoluteOrder[
  'observed-unknown-without-true']>0);
 assert(result.unknownRouteTriage.byCandidateGate.some(x=>
  x.gateKind==='precondition-latch-unknown'));
 assert.equal(result.gates.historicalPreconditionsStillTernary,true);
 assert.equal(result.gates.actualGameSkillProcRateMeasured,false);
 assert.equal(result.gates.P3CardScoringApproved,false);
});
test('missing rank evidence and forged position evidence are rejected instead of imputed',()=>{
 const f=fixture([skill('100001',[
  [p('distance_rate','>=',1),p('order','==',1)]])]);
 assert.throws(()=>distance.analyze(f.plans,f.original,f.positions,f.profiles,{
  includeAbsoluteOrder:true,positionSourceEvidence:f.positionSourceEvidence
 }),/requires direct rank evidence/);
 assert.throws(()=>combined.analyze(f.plans,f.original,f.positions,f.ranks,
  f.profiles,{...f.positionSourceEvidence,originalUmaSimRaceStateObserved:true}),
  /unverified/);
 const forged=structuredClone(f.ranks);
 forged[0].frames[2].horses[1][5]=pack(2,2,3,2,2,2);
 assert.throws(()=>combined.analyze(f.plans,f.original,f.positions,forged,
  f.profiles,f.positionSourceEvidence),/rank stage is not identical/);
});
