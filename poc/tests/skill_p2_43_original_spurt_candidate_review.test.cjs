'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const x=require('../src/skill_p2_43_original_spurt_candidate_review.cjs');
const p237=require('../src/skill_p2_37_dynamic_state_evidence.cjs');
const p238=require('../src/skill_p2_38_original_spurt_phase_same_and.cjs');
const p232=require('../src/skill_p2_32_research_queue.cjs');
const STYLES=['逃げ','先行','差し','追込'];
function sourceCode(){
 return {revision:x.PIN,checker:[
  '"is_lastspurt" -> condition.checkInRaceBool { isInSpurt() }',
  '"phase_firsthalf_random" -> checkInRandom(',
  'baseSetting.initPhaseRandom(condition.value, 0.0 to 0.5)',
  '"phase_random" -> checkInRandom(',
  'baseSetting.initPhaseRandom(condition.value)',
  '"infront_near_lane_time" -> condition.checkSpecialState(-1)',
  'val key = approximateTypeToState[type]',
  'simulation.specialState[key] ?: 0'
 ].join('\n'),skillData:[
  '"infront_near_lane_time" to "infront_near_lane"',
  '"infront_near_lane" to ApproximateMultiCondition(',
  'class ApproximateStartContinue(',
  'Random.nextDouble() < start',
  'Random.nextDouble() < continuation'
 ].join('\n')};
}
function fixture(){
 const orig=x.TARGETS.map((target,i)=>({
  id:target.sourceNumericId,other:target.otherType,
  value:i===0?3:i===2?2:1
 }));
 const skills=orig.map(t=>{
  const conditions=[[{type:'is_lastspurt',operator:'==',value:1},
   {type:t.other,operator:'==',value:t.value}]];
  const profile={status:'source-structure',sourceNumericId:t.id,
   invokes:[{index:1,conditions,preConditions:[]}]};
  return {id:'skill:'+t.id,name:'synthetic '+t.id,activationProfile:profile};
 });
 const expected=818;
 for(let i=0;i<expected-orig.length;i++)
  skills.push({id:'skill:'+String(800000+i),name:'filler',
   activationProfile:{status:'source-structure',
    sourceNumericId:String(800000+i),invokes:[]}});
 while(skills.length<881){
  const n=skills.length;
  skills.push({id:'hint:unavailable-'+n,name:'none',
   activationProfile:{status:'unavailable',invokes:[]}});
 }
 const model={skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s]))};
 const qrows=skills.map(s=>{
  const matched=s.activationProfile.status==='source-structure';
  const target=orig.find(t=>t.id===s.activationProfile.sourceNumericId);
  return {skillId:s.id,sourceNumericId:matched?s.activationProfile.sourceNumericId:null,
   routeFamilies:target?[{invokeOffset:0,invokeIndex:1,
    conditionOrIndex:0,preconditionOrIndex:null,conditionOrCount:1,
    preconditionOrCount:0,hasOtherInvokes:false,
    finiteCompatibleStyles:STYLES,unverifiedTypes:['is_lastspurt',target.other]}]:[]};
 });
 const queue={status:p232.STATUS,denominators:{
  appSkills:881,sourceMatchedSkills:818,originalRouteFamilies:970},rows:qrows};
 const observed=orig.map(t=>({
  sourceNumericId:t.id,skillId:'skill:'+t.id,invokeOffset:0,invokeIndex:1,
  conditionOrIndex:0,preconditionOrIndex:null,
  hasOtherInvokes:false,probabilityOrScore:null,
  wholeSkillSuitability:'not-established',
  sourcePredicates:[{side:'conditions',andOffset:0,operator:'==',value:1}],
  finiteCompatibleStyles:STYLES,otherUnverifiedTypes:[t.other]
 }));
 while(observed.length<61)observed.push({sourceNumericId:'other-'+observed.length});
 const dynamic={status:p237.STATUS,source:{revision:x.PIN,
  mechanismSourceVerified:true},summary:{originalFullSourceANDProven:0},
  rows:{is_lastspurt:observed}};
 const precedent={status:p238.STATUS,source:{originalUmaSimRevision:x.PIN},
  summary:{skills:2,sourceOriginalANDMatched:2},
  rows:['200511','200512'].map(id=>({sourceNumericId:id,
   sourceANDPredicates:[{type:'is_lastspurt',operator:'==',value:1},
    {type:'phase_firsthalf_random',operator:'==',value:3}]}))};
 return {model,queue,dynamic,precedent,source:sourceCode()};
}
const audit=f=>x.audit(f.model,f.queue,f.dynamic,f.precedent,f.source);
test('fixed 3 source AND routes: 203431 reuse; 204661 near-lane approximation; 210081 different phase window',()=>{
 const f=fixture(),old=JSON.stringify(f);
 const r=audit(f);
 assert.equal(JSON.stringify(f),old,'research must never mutate original source');
 assert.equal(r.status,x.STATUS);
 assert.deepEqual(r.summary,{
  originalSourceSkillCandidates:3,exactOriginalCurrentANDReviewed:3,
  nearLaneSourceApproximationHeld:1,otherTwoOriginalRandomWindowMechanisms:2,
  exactCurrentANDReusedFromP238:1,
  additionalRaceOrSameTickTrials:0,originalFullSkillActivationRatesMeasured:0,
  officialGameSkillProcRatesMeasured:0,approvedP3OrP4Ratings:0
 });
 assert.deepEqual(r.rows.map(v=>v.sourceNumericId),['203431','204661','210081']);
 assert.equal(r.rows[0].identicalFullCurrentANDToP238Reference,true);
 assert.equal(r.rows[0].disposition,
  'reuse-identical-original-source-AND-mechanism-only-not-style-W');
 assert.equal(r.rows[0].companionTiming.windows[0].phase,3);
 assert.equal(r.rows[1].disposition,
  'hold-source-approximate-near-lane-state-not-independent-position-observation');
 assert.equal(r.rows[1].companionTiming,null);
 assert.equal(r.rows[2].companionTiming.kind,'random-within-phase');
 assert.equal(r.rows[2].identicalFullCurrentANDToP238Reference,false);
 assert(r.rows.every(y=>y.cardScore===null&&
  y.measuredOriginalModelSkillActivationRate===null&&
  y.eligibleForP3CardScoring===false&&
  y.sameSourceTickSkillANDObservedHere===false));
});
test('source Kotlin checker and randomized special state path must be present exactly',()=>{
 const f=fixture();
 f.source.checker=f.source.checker.replace(
  '"infront_near_lane_time" -> condition.checkSpecialState(-1)',
  '"infront_near_lane_time" -> condition.checkInRaceBool');
 assert.throws(()=>audit(f),/original checker or approximate model drift/);
 const g=fixture();
 g.source.skillData=g.source.skillData.replace(
  '"infront_near_lane" to ApproximateMultiCondition(',
  '"infront_near_lane" to SourcePhysicalLaneObserved(');
 assert.throws(()=>audit(g),/original checker or approximate model drift/);
});
test('original source AND value, extra term, OR and source identity regressions fail closed',()=>{
 const f=fixture();f.model.skills[0].activationProfile.invokes[0]
  .conditions[0][0].value=0;
 assert.throws(()=>audit(f),/source lastspurt \+ other condition pair shifted/);
 const g=fixture();g.model.skills[0].activationProfile.invokes[0]
  .conditions[0][1].value=5;
 assert.throws(()=>audit(g),/original phase window type\/operator/);
 const h=fixture();h.model.skills[1].activationProfile.invokes[0]
  .preConditions=[[{type:'motivation',operator:'==',value:5}]];
 assert.throws(()=>audit(h),/source original current AND no longer isolated|source Invoke\/OR/);
 const j=fixture();j.queue.rows[0].routeFamilies[0].conditionOrCount=2;
 assert.throws(()=>audit(j),/source Invoke\/OR/);
 const k=fixture();k.dynamic.rows.is_lastspurt[2].sourceNumericId='203431';
 assert.throws(()=>audit(k),/one spurt route missing/);
});
test('additional original source conditions remain visible; do not falsely mark a full skill rate',()=>{
 const f=fixture();f.model.skills[2].activationProfile.invokes[0]
  .conditions[0].push({type:'distance_type',operator:'==',value:3});
 const r=audit(f),z=r.rows[2];
 assert.equal(z.identicalFullCurrentANDToP238Reference,false);
 assert.deepEqual(z.otherSourceANDTerms,[{
  type:'distance_type',operator:'==',value:3
 }]);
 assert.equal(z.measuredOriginalModelSkillActivationRate,null);
});
