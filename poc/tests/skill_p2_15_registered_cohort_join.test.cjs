'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const join=require('../src/skill_p2_15_registered_cohort_join.cjs');
const whole=require('../src/skill_source_whole_tick_monitor.cjs');
const rank=require('../src/skill_p2_15_rank_random_same_and_handoff.cjs');
const p=(type,operator,value)=>({type,operator,value});
const make=(id=join.SNAPSHOT.observedRegisteredSkillId)=>({
 id:'skill:'+id,name:'synthetic original source profile fixture',
 activationProfile:{
  status:'source-structure',sourceNumericId:id,
  invokes:[{index:1,conditions:[[
   p('order_rate','>=',50),
   p('phase_random','==',2),
   p('running_style','==',2)
  ]],preConditions:[]}]
 }
});
function setup(skill=make(),included=true){
 const model={skills:[skill],skillById:{[skill.id]:skill}};
 const sourceId=skill.activationProfile.sourceNumericId;
 const candidates=included?[{
  sourceNumericId:sourceId,invokeOffset:0,invokeIndex:1,
  conditionOrIndex:0,preconditionOrIndex:null,
  originalConditionANDSize:3,originalHistoricalPreconditionANDSize:0,
  sourceRouteKey:sourceId+'|0|0|_',
  familyId:'original-family',mechanismKernelId:'common-kernel',
  sameCurrentANDRankRateAndRandom:true,
  supportedRankPanels:[
   {fieldSize:9,projectedRankGateTruePositions:[1,2,3],
    projectedRankGateFalsePositions:[4,5,6,7,8,9],
    heldUnverifiedBoundaryPositions:[],actualPhaseRandomDrawsObserved:0},
   {fieldSize:12,projectedRankGateTruePositions:[1,2,3,4],
    projectedRankGateFalsePositions:[5,6,7,8,9,10,11,12],
    heldUnverifiedBoundaryPositions:[],actualPhaseRandomDrawsObserved:0}
  ]
 }]:[];
 const prior={status:rank.STATUS,denominators:{
  sourceMatchedSkills:1,sameOriginalCurrentANDCandidates:candidates.length,
  sharedMechanismKernelsWithSameAND:candidates.length
 },candidates};
 const reference={...join.SNAPSHOT,
  observedRegisteredSkillId:join.SNAPSHOT.observedRegisteredSkillId,
  originalSourceConditionLogicSha256:join.logicSha256(whole.compile(make()))};
 return {model,prior,reference};
}
test('same original Invoke/OR/preconditions AND source logic digest links only exact source route',()=>{
 const {model,prior,reference}=setup(),m=JSON.stringify(model),q=JSON.stringify(prior);
 const r=join.audit(model,prior,reference);
 assert.equal(JSON.stringify(model),m);assert.equal(JSON.stringify(prior),q);
 assert.equal(r.crossReference.status,
  'exact-original-source-AND-identity-linked-with-rank-unknown');
 assert.equal(r.crossReference.exactInvokeORAndRouteMatches,1);
 assert.equal(r.crossReference.fullOriginalConditionLogicFingerprintMatched,true);
 assert.equal(r.crossReference.originalSourceOrderRateEvaluatedAtAnyObservedTick,false);
 assert.equal(r.crossReference.sameTickOriginalRankAndPhaseBothObserved,false);
 assert.equal(r.noScoringBoundary.sourceOriginalCompleteANDVerified,0);
 assert.equal(r.noScoringBoundary.formalSkillCardSuitabilityRatings,0);
 assert.equal(r.crossReference.modelOnlyNineRunnerRankGate.fieldSize,9);
 assert.equal(r.crossReference.modelOnlyTwelveRunnerRankGate.fieldSize,12);
});
test('without a new JVM fingerprint the earlier registered trace is not exact-linked',()=>{
 const {model,prior}=setup();
 const x=join.audit(model,prior);
 assert.equal(x.crossReference.status,
  'application-matched-ID-has-different-original-structure');
 assert.equal(x.crossReference.exactOriginalSourceStructureComparison,
  'original-JVM-logic-fingerprint-not-yet-available');
 assert.equal(x.crossReference.exactInvokeORAndRouteMatches,0);
 assert.equal(x.crossReference.linkedFamilyId,null);
});
test('same source ID, Invoke, OR, types and AND length but changed threshold must NOT link',()=>{
 const {model,prior,reference}=setup();
 model.skills[0].activationProfile.invokes[0].conditions[0][2].value=3;
 const x=join.audit(model,prior,reference);
 assert.equal(x.crossReference.exactOriginalSourceStructureComparison,
  'different-original-source-condition-logic-fingerprint');
 assert.equal(x.crossReference.exactInvokeORAndRouteMatches,0);
});
test('absent source identity in application does not borrow one of 85 other source skills',()=>{
 const {model,prior,reference}=setup(make('56789'));
 const x=join.audit(model,prior,reference);
 assert.equal(x.crossReference.status,
  'registered-source-skill-absent-from-application-cohort');
 assert.equal(x.crossReference.originalRegistrySkillIn85SourceIdSet,false);
 assert.deepEqual(x.nextCandidateSourceSkillIdsIfNoExactMatch,['56789']);
});
test('same model skill but different original Invoke structure or OR branch does not link',()=>{
 const {model,prior,reference}=setup();
 model.skills[0].activationProfile.invokes[0].index=2;
 let x=join.audit(model,prior,reference);
 assert.equal(x.crossReference.exactOriginalSourceStructureComparison,
  'missing-original-invoke-index');
 model.skills[0].activationProfile.invokes[0].index=1;
 model.skills[0].activationProfile.invokes[0].conditions.push([p('phase','==',2)]);
 x=join.audit(model,prior,reference);
 assert.equal(x.crossReference.exactOriginalSourceStructureComparison,
  'different-conditions-OR-count');
});
test('same source logic but missing 85-cohort OR path is never labeled an exact join',()=>{
 const {model,prior,reference}=setup();
 prior.candidates=[];
 prior.denominators.sameOriginalCurrentANDCandidates=0;
 const r=join.audit(model,prior,reference);
 assert.equal(r.crossReference.status,
  'same-skill-but-no-matching-ranked-random-source-route');
 assert.equal(r.crossReference.exactInvokeORAndRouteMatches,0);
});
test('invalid pinned source provenance, false rank completion and duplicate source matches fail closed',()=>{
 const {model,prior,reference}=setup();
 const broken={...reference,originalOrderRateEvaluatedInSource:1};
 assert.throws(()=>join.audit(model,prior,broken),
  /registered\/85 join/);
 const duplicate=structuredClone(model.skills[0]);duplicate.id='another';
 model.skills.push(duplicate);
 model.skillById.another=duplicate;
 assert.throws(()=>join.audit(model,prior,reference),
  /duplicate registered skill source match/);
});
