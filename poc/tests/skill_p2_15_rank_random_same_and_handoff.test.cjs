'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const handoff=require('../src/skill_p2_15_rank_random_same_and_handoff.cjs');
const blocker=require('../src/skill_source_path_blocker_impact.cjs');
const spec=require('../src/skill_condition_spec_omission.cjs');
const queue=require('../src/skill_p2_32_research_queue.cjs');
const reuse=require('../src/skill_p2_32_mechanism_reuse.cjs');
const axis=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
const pred=(type,operator='==',value=1)=>({type,operator,value});
const inv=(conditions,preConditions=[],index=2)=>({index,conditions,preConditions});
const skill=(n,invokes)=>({id:'skill:'+n,name:'synthetic '+n,
 activationProfile:{status:'source-structure',sourceNumericId:n,invokes}});
function fixture(){
 const skills=[
  skill('100',[inv([[pred('order_rate','<=',50),pred('phase_random','==',2)]])]),
  skill('101',[inv([[pred('order_rate','<=',80),pred('phase_random','==',2)]])]),
  // Rank and window in different OR rows must NOT be combined.
  skill('102',[inv([[pred('order_rate','<=',50)],
   [pred('phase_random','==',2)]])]),
  // Rank and window on separate sides of historical precondition: also no.
  skill('103',[inv([[pred('phase_random','==',2)]],
   [[pred('order_rate','<=',50)]])]),
  skill('104',[inv([[pred('order_rate','<=',50),
   pred('phase_random','==',2),pred('track_id','==',10005)]],
   [[pred('is_overtake','==',1)]],11)]),
  skill('105',[inv([[pred('order_rate','<=',1),
   pred('phase_random','==',2),pred('running_style','==',1)]])]),
  skill('106',[inv([[pred('order_rate','>=',90),
   pred('phase_random','==',2)]])]),
  // Two rank expressions in the very same AND, not alternative gates.
  skill('107',[inv([[pred('order_rate','<=',50),
   pred('order_rate','>=',70),pred('phase_random','==',2)]])]),
  {id:'hint:unmatched',name:'unmatched',
   activationProfile:{status:'unavailable',reason:'no-source'}}
 ];
 return {skills,skillById:Object.fromEntries(skills.map(x=>[x.id,x])),
  cards:[{id:'synthetic-card',events:[]}]};
}
function prepare(m){
 const blockers=blocker.audit(m,['100','101']);
 const specReport=spec.audit(m);
 const q=queue.audit(m,{blockerReport:blockers,specReport});
 const reuseReport=reuse.audit(m,q);
 return axis.audit(m,reuseReport);
}
function inspect(m){return handoff.audit(m,prepare(m));}
const find=(r,id)=>r.candidates.find(x=>x.sourceNumericId===id);
const ctx={running_style:2,distance_type:2,ground_type:1,
 ground_condition:1,track_id:10005};
const frame=(t,rank,other={})=>({tickIndex:t,rank,fieldSize:9,
 raceKey:'one-model-race',runnerKey:'single-runner',staticContext:ctx,
 ...other});
test('same original AND is required; neither other OR nor historical precondition is borrowed',()=>{
 const m=fixture(),before=JSON.stringify(m),r=inspect(m);
 assert.equal(JSON.stringify(m),before);
 assert.deepEqual(r.candidates.map(x=>x.sourceNumericId).sort(),
  ['100','101','104','105','106','107']);
 assert.equal(r.denominators.sameOriginalCurrentANDCandidates,6);
 assert.equal(r.denominators.distinctSourceSkillsWithSameAND,6);
 assert.equal(r.denominators.sourceMatchedSkills,8);
 assert.equal(r.denominators.sourceUnavailableSkills,1);
 assert.equal(r.denominators.modelRuntimeSameTickJoinedRouteObservations,0);
 assert.equal(r.denominators.observedOriginalSourceRandomDraws,0);
 assert.equal(r.denominators.provenCompleteOriginalSkillActivation,0);
 assert(find(r,'104').historicalPreconditionTypesNotJoined.includes('is_overtake'));
 assert(find(r,'104').otherCurrentUnknownOrContextTypes.includes('track_id'));
});
test('the original threshold changes rank eligibility even within one mechanism',()=>{
 const r=inspect(fixture()),a=find(r,'100'),b=find(r,'101');
 assert.equal(a.familyId,b.familyId);
 assert.deepEqual(a.supportedRankPanels[0].projectedRankGateTruePositions,
  [1,2,3,4,5]);
 assert.deepEqual(b.supportedRankPanels[0].projectedRankGateTruePositions,
  [1,2,3,4,5,6,7]);
 assert.deepEqual(a.supportedRankPanels[1].projectedRankGateTruePositions,
  [1,2,3,4,5,6]);
 assert(a.supportedRankPanels.every(x=>x.actualPhaseRandomDrawsObserved===0));
 assert.deepEqual(find(r,'107').supportedRankPanels[0].projectedRankGateTruePositions,[]);
 assert.equal(find(r,'107').supportedRankPanels[0].projectedRankGateFalsePositions.length,9);
});
test('percent boundary at zero remains UNKNOWN, not a fabricated rank gate',()=>{
 const r=inspect(fixture()),p=find(r,'105');
 assert.equal(p.supportedRankPanels[0].heldUnverifiedBoundaryPositions.length,9);
 assert.deepEqual(p.supportedRankPanels[0].projectedRankGateFalsePositions,[]);
 assert.deepEqual(p.supportedRankPanels[0].projectedRankGateTruePositions,[]);
});
test('rank false can close same AND, true still cannot turn phase_random into true',()=>{
 const s=fixture().skills[0];
 const r=handoff.replayRankOnlyModelTicks(s,[frame(0,7),frame(1,3)]);
 assert.deepEqual(r.tallies,{true:0,false:1,unknown:1});
 assert.equal(r.results[0].invokes[0].conditionAlternatives[0],'false');
 assert.equal(r.results[1].invokes[0].conditionAlternatives[0],'unknown');
 assert.equal(r.results[1].overallCondition,'unknown');
 assert.equal(r.phaseRandomFactsSupplied,0);
 assert.equal(r.actualSourceRandomDraws,0);
 assert.equal(r.gameProcRate,null);
 assert.equal(r.P3CardSuitabilityApproved,false);
});
test('even rank false in one OR cannot exclude a different unknown OR or Invoke',()=>{
 const s=skill('115',[inv([
  [pred('order_rate','<=',50),pred('phase_random','==',2)],
  [pred('is_overtake','==',1)]
 ])]);
 const r=handoff.replayRankOnlyModelTicks(s,[frame(0,9)]);
 assert.equal(r.results[0].invokes[0].conditionAlternatives[0],'false');
 assert.equal(r.results[0].invokes[0].conditionAlternatives[1],'unknown');
 assert.equal(r.results[0].overallCondition,'unknown');
});
test('rank evidence does not secretly assert precondition history or random draws',()=>{
 const s=fixture().skills[4];
 const r=handoff.replayRankOnlyModelTicks(s,[frame(0,7),frame(1,3)]);
 assert.equal(r.tallies.true,0);
 assert.equal(r.results[0].invokes[0].preconditionLatched,'unknown');
 assert.equal(r.results[1].invokes[0].preconditionLatched,'unknown');
 assert.equal(r.results[1].overallCondition,'unknown');
});
test('unknown rank, mixed runner/race/field, and changed static source context stay fail-closed',()=>{
 const s=fixture().skills[0];
 const r=handoff.replayRankOnlyModelTicks(s,[frame(0,null)]);
 assert.equal(r.tallies.unknown,1);
 for(const bad of [
  frame(1,2,{runnerKey:'other'}),
  frame(1,2,{raceKey:'another'}),
  frame(1,2,{fieldSize:12}),
  frame(1,2,{staticContext:{...ctx,running_style:3}}),
  frame(2,2),
  frame(1,50),
  frame(1,2,{staticContext:null})
 ])
  assert.throws(()=>handoff.replayRankOnlyModelTicks(s,[frame(0,7),bad]),
   /one race, one runner|fixed race\/runner/);
 assert.throws(()=>handoff.audit(fixture(),null),/source static axis audit required/);
 const m=fixture(),ax=prepare(m);
 ax.routeRows[0].sourceNumericId='999';
 assert.throws(()=>handoff.audit(m,ax),/source numeric identity or route alignment/);
});
