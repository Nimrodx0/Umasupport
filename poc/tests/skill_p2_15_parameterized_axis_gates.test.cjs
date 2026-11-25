'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const x=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
const full=require('../src/skill_full_condition_path_audit.cjs');
const blocker=require('../src/skill_source_path_blocker_impact.cjs');
const omission=require('../src/skill_condition_spec_omission.cjs');
const queue=require('../src/skill_p2_32_research_queue.cjs');
const reuse=require('../src/skill_p2_32_mechanism_reuse.cjs');
const p=(type,operator='==',value=1)=>({type,operator,value});
const inv=(conditions,preConditions=[],index=1)=>({index,conditions,preConditions});
const skill=(n,invokes)=>({id:'skill:'+n,name:'synthetic '+n,
 activationProfile:{status:'source-structure',sourceNumericId:n,invokes}});
function model(){
 const skills=[
  skill('100',[inv([[p('running_style','==',1),p('distance_type','>=',3),
   p('ground_type','==',1),p('order_rate','<=',50)]])]),
  skill('101',[inv([[p('running_style','==',1),p('distance_type','>=',2),
   p('ground_type','==',1),p('order_rate','<=',70)]])]),
  skill('102',[inv([[p('is_overtake')]],[[p('running_style','==',2),
   p('ground_type','==',2)]])]),
  skill('103',[inv([[p('distance_type','==',1)],
   [p('distance_type','==',4)]])]),
  skill('104',[inv([[p('is_overtake')]])]),
  skill('105',[inv([[p('ground_condition','==',1),
   p('ground_condition','==',2)]])]),
  skill('106',[inv([[p('track_id','==',10005)]])]),
  skill('107',[inv([[p('distance_type','==',4),
   p('ground_condition','<=',2)]])]),
  skill('108',[inv([])]),
  {id:'hint:unmatched',name:'unmatched',
   activationProfile:{status:'unavailable',reason:'none'}}
 ];
 return {skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
  cards:[{id:'sample',events:[]}]};
}
function run(m){
 const b=blocker.audit(m,['100','101']);
 const s=omission.audit(m);
 const q=queue.audit(m,{blockerReport:b,specReport:s});
 const g=reuse.audit(m,q);
 return x.audit(m,g);
}
const row=(r,id)=>r.sourceRows.find(s=>s.sourceNumericId===id);
test('reuses original exact numeric thresholds per skill, not a whole-family boolean',()=>{
 const m=model(),before=JSON.stringify(m),r=run(m);
 assert.equal(JSON.stringify(m),before);
 const a=row(r,'100'),b=row(r,'101');
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,1,3,1,1),true);
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,1,2,1,1),false);
 assert.equal(x.groundAllows(b.potentialGroundStateMasks,1,2,1,1),true);
 assert.equal(x.groundAllows(b.potentialGroundStateMasks,1,3,2,1),false);
 assert.equal(a.hasKnownDistanceGateContrast,true);
 assert.equal(b.hasKnownDistanceGateContrast,true);
 assert.equal(a.hasKnownStyleGateContrast,true);
 assert.equal(a.hasKnownSurfaceGateContrast,true);
 const first=r.routeRows.find(q=>q.sourceNumericId==='100');
 const second=r.routeRows.find(q=>q.sourceNumericId==='101');
 assert.equal(first.familyId,second.familyId);
 const fam=r.familyStaticPatternSummaries.find(q=>q.familyId===first.familyId);
 assert.equal(fam.distinctAxisGatePatterns,2);
 assert.equal(fam.independentlyRecheckedEverySourcePredicate,true);
});
test('original precondition AND remains separate, 3 axes and ground condition joint',()=>{
 const r=run(model());
 const a=row(r,'102');
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,2,1,2,1),true);
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,1,1,2,1),false);
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,2,1,1,1),false);
 assert.equal(a.unknownDynamicSourcePredicatesPresent,true);
 assert.equal(a.actualSkillTriggerObserved,false);
 const q=row(r,'107');
 assert.equal(q.potentialGroundStateMasks[x.panelIndex(1,4,1)],3);
 assert.equal(q.potentialGroundStateMasks[x.panelIndex(1,3,1)],0);
 assert.equal(q.potentialGroundStateMasks[x.panelIndex(1,4,2)],3);
});
test('original OR alternatives preserve their own thresholds and are only upper-bound unioned',()=>{
 const r=run(model()),a=row(r,'103');
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,4,1,2,4),true);
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,4,2,2,4),false);
 assert.equal(x.groundAllows(a.potentialGroundStateMasks,4,4,2,4),true);
 assert.equal(r.routeRows.filter(q=>q.sourceNumericId==='103').length,2);
 assert(a.noDynamicConditionsEvaluated);
});
test('contradictory finite ground predicates are never treated as separate satisfiable states',()=>{
 const r=run(model()),a=row(r,'105');
 assert(a.potentialGroundStateMasks.every(v=>v===0));
 assert.equal(a.hasKnownDistanceGateContrast,false);
 assert.equal(a.hasKnownSurfaceGateContrast,false);
 assert.equal(r.routeRows.find(x=>x.sourceNumericId==='105')
  .routeMayBeStaticallyEligibleSomewhere,false);
});
test('unknown track, interactions and empty conditions never become false/activation',()=>{
 const r=run(model()),track=row(r,'106'),unknown=row(r,'104'),empty=row(r,'108');
 assert(track.potentialGroundStateMasks.every(x=>x===15));
 assert(unknown.potentialGroundStateMasks.every(x=>x===15));
 assert.equal(track.unknownDynamicSourcePredicatesPresent,true);
 assert.equal(unknown.unknownDynamicSourcePredicatesPresent,true);
 assert.equal(empty.status,'source-empty-condition-invoke-held');
 assert(empty.potentialGroundStateMasks.every(x=>x===15));
 assert.equal(r.denominators.skillsWithEmptyConditionInvokeHeld,1);
 assert.equal(r.denominators.completedWholeSkillConditionEvaluations,0);
 assert.equal(r.denominators.verifiedGameProcProbabilities,0);
 assert.equal(r.denominators.officialSkillCardSuitabilityScores,0);
});
test('original route cohort covers every matched route, checks independent finite-domain audit',()=>{
 const m=model(),b=blocker.audit(m,['100','101']),s=omission.audit(m);
 const q=queue.audit(m,{blockerReport:b,specReport:s});
 const g=reuse.audit(m,q);
 const r=x.audit(m,g);
 assert.equal(r.denominators.appSkills,10);
 assert.equal(r.denominators.sourceMatchedSkills,9);
 assert.equal(r.denominators.sourceUnavailableSkills,1);
 assert.equal(r.denominators.sourceRouteFamilies,
  q.denominators.originalRouteFamilies);
 assert.equal(r.routeRows.length,r.denominators.sourceRouteFamilies);
 assert.equal(r.familyStaticPatternSummaries.length,
  g.denominators.normalizedMechanismFamilies);
 assert.equal(r.panelDefinition.contexts.length,32);
 const original=structuredClone(g);
 original.mechanismFamilies[0].originalSourceMembers[0].sourceNumericId='999';
 assert.throws(()=>x.audit(m,original),/source skill and reference mismatch/);
 assert.throws(()=>x.panelIndex(0,3,2),/invalid static comparison axes/);
 assert.throws(()=>x.audit(m,null),/mechanism family report required/);
});
test('static source operator evaluation equals original helper on all four domains',()=>{
 for(const val of [1,2,3,4]){
  const xvalue=p('distance_type','>=',3);
  assert.equal(x.maskFor([xvalue],{running_style:2,distance_type:val,
   ground_type:2}),full.check(val,xvalue.operator,xvalue.value)?15:0);
 }
});
