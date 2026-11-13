'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const join=require('../src/skill_p2_15_registered_cohort_join.cjs');
const {createHash}=require('node:crypto');
const jvm=require('../src/skill_p2_15_registered_source_race_trace.cjs');
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


function sameRunFixture(){
 const {model,prior}=setup();
 const original=model.skills[0];
 const registry=JSON.stringify([{
  id:original.activationProfile.sourceNumericId,
  invokes:original.activationProfile.invokes
 }])+' '.repeat(100500);
 const digest=join.logicSha256(whole.compile(original));
 const tickData=Array.from({length:3},(_,trial)=>({
  trial,raceFrameCount:750,originalCheckerCalls:2,
  phasePredicateTrueCalls:1,phasePredicateFalseCalls:1,
  modelSkillEvents:1,originalPhaseRandomWindowWasChecked:true,
  ticks:[
   {tick:200,position:150,start:150,end:160,phasePredicateHit:true},
   {tick:201,position:161,start:150,end:160,phasePredicateHit:false}
  ]
 }));
 const raw={
  schemaVersion:1,status:jvm.TRACE,
  sourceSkillId:original.activationProfile.sourceNumericId,
  sourceOriginalInvokeIndex:1,sourceOriginalORIndex:0,
  sourceOriginalInvokeCount:1,sourceOriginalConditionsORCount:1,
  sourceOriginalSelectedANDSize:3,sourceOriginalPreconditionORCount:0,
  sourceOriginalCurrentANDHasOrderRate:true,
  sourceOriginalCurrentANDHasPhaseRandom2:true,
  originalSkillRecordEquippedUnmodified:true,
  originalInvokeConditionsUsedUnmodified:true,
  originalSourceConditionLogicSha256:digest,
  originalOrderRateWasIgnoredBySource:true,
  actualSourceCheckerTickCount:6,
  phasePredicateTrueCalls:3,phasePredicateFalseCalls:3,
  sourceModelSkillEventCount:3,realGameSkillProcObserved:false,
  trials:tickData
 };
 prior.source={revision:join.SNAPSHOT.pinnedUmaSimRevision,
  skillRegistrySha256:createHash('sha256').update(registry).digest('hex')};
 // 1 true synthetic route plus 84 independent app candidates, preserving
 // exactly the original fixed source cohort totals for the join contract.
 for(let i=0;i<84;i++){
  const id=String(300000+i);
  prior.candidates.push({...prior.candidates[0],
   sourceNumericId:id,sourceRouteKey:id+'|0|0|_'});
 }
 prior.denominators.sameOriginalCurrentANDCandidates=85;
 prior.denominators.distinctSourceSkillsWithSameAND=85;
 prior.denominators.sharedMechanismKernelsWithSameAND=2;
 return {raw,prior,registry};
}
test('same-workflow original JVM + pinned registry parser + exact app 85 route proof, still zero rank',()=>{
 const x=sameRunFixture();
 const out=join.auditSameRun(x.raw,x.prior,x.registry);
 assert.equal(out.linked.sourceNumericId,join.SNAPSHOT.observedRegisteredSkillId);
 assert.equal(out.provenance.fullConditionsOriginalFingerprintMatched,true);
 assert.equal(out.observedModel.phasePredicateSourceTickChecks,6);
 assert.equal(out.noScoringBoundary.originalOrderRatePredicateSourceRuntimeObservations,0);
 assert.equal(out.noScoringBoundary.sourceOriginalRankAndPhaseSameTickJointMeasurements,0);
 assert.equal(out.noScoringBoundary.approvedP3P4SuitabilityScores,0);
});
test('same-workflow cross-source gate rejects changed registry data, excluded app ID or forged JVM digest',()=>{
 for(const alter of [
  x=>x.raw.originalSourceConditionLogicSha256='b'.repeat(64),
  x=>x.prior.candidates=x.prior.candidates.filter(c=>
   c.sourceNumericId!==join.SNAPSHOT.observedRegisteredSkillId),
  x=>x.prior.source.skillRegistrySha256='a'.repeat(64),
  x=>x.raw.sourceModelSkillEventCount=-1,
  x=>x.raw.originalOrderRateWasIgnoredBySource=false
 ]){
  const x=sameRunFixture();alter(x);
  assert.throws(()=>join.auditSameRun(x.raw,x.prior,x.registry),
   /P2.15/);
 }
});
