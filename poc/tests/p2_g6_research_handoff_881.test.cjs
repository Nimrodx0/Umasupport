'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const gates=require('../src/skill_p2_15_parameterized_axis_gates.cjs');
const p241=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const p242=require('../tools/p2_g4_dynamic_impact_gates.cjs');
const p243=require('../src/skill_p2_43_original_spurt_candidate_review.cjs');
const g6=require('../src/p2_g6_research_handoff_881.cjs');
const p3=require('../src/p3_g6_research_intake.cjs');
const pins=['203431','204661','210081','200100','200200'];
const all=[...pins,null];
const m=()=>Array(32).fill(15);
function fixture(){
 const rows=all.map((id,i)=>({
  skillId:id===null?'hint:unavailable':'skill:'+id,
  skillName:id===null?'unknown':'synthetic '+id,
  sourceNumericId:id,
  wholeSkillSuitability:'not-established',
  eligibleForP3CardScoring:false,cardScore:null,
  decision:i===3?'conditionally-use-short-window-rank-evidence':
   i===4?'hold-turf-model-transfer':'no-new-short-window-evidence',
  ...(i===3?{scope:{sourceWindow:'phase_random:1',modelCourseIds:[10101]},
   styles:{Nige:{W:1,D:3}},pairs:Array(6).fill({status:'partial'})}:{}),
  ...(i===4?{heldReasons:['explicit-dirt-source-gate-not-model-turf']}:{})
 }));
 const p={schemaVersion:1,status:p241.STATUS,
  sources:{sourceUmaSimSHA256:g6.SOURCE_SHA,modelRaces:720},
  summary:{appSkills:6,sourceMatched:5,directlyModeledSourceSkills:1,
   sourceExceptionModeledSkills:0,
   uniqueSourceSkillsWithConditionalPartialWDEvidence:1,
   heldOriginalGroundQualifierSkills:1,
   otherSkillsWithoutThisSpecificWindowEvidence:4,
   eligibleForP3CardScores:0,productSkillSuitabilityScores:0,
   originalFullSkillANDProven:0},rows};
 const axisRows=all.map((id,i)=>({
  skillId:rows[i].skillId,sourceNumericId:id,
  status:id===null?'unmatched-source-no-gate-inference':
   'static-necessary-gates-only',
  ...(id!==null?{
   potentialGroundStateMasks:m(),
   hasKnownStyleGateContrast:false,hasKnownDistanceGateContrast:false,
   hasKnownSurfaceGateContrast:i===4,
   unknownDynamicSourcePredicatesPresent:i<3,
   noDynamicConditionsEvaluated:true,actualSkillTriggerObserved:false
  }:{})
 }));
 const routes=pins.map((id,i)=>({
  sourceNumericId:id,invokeOffset:0,invokeIndex:1,
  conditionOrIndex:0,preconditionOrIndex:null,
  groundStateEligibilityMasks:m(),
  unknownDynamicTypes:i<3?['is_lastspurt']:[],
  runtimeSourceConditionsVerified:false
 }));
 const a={schemaVersion:1,status:gates.STATUS,
  source:{revision:p243.PIN,skillRegistrySha256:g6.SOURCE_SHA},
  panelDefinition:{contexts:structuredClone(gates.PANEL)},
  denominators:{appSkills:6,sourceMatchedSkills:5,
   sourceUnavailableSkills:1,sourceRouteFamilies:5,
   completedWholeSkillConditionEvaluations:0,
   verifiedGameProcProbabilities:0,
   officialSkillCardSuitabilityScores:0,actualAppliedOmissions:0},
  sourceRows:axisRows,routeRows:routes};
 const dynamicRows=pins.slice(0,3).map(id=>({
  skillId:'skill:'+id,sourceNumericId:id,
  invokeOffset:0,invokeIndex:1,conditionOrIndex:0,preconditionOrIndex:null,
  type:'is_lastspurt',
  originalSourcePredicates:[{side:'conditions',andOffset:0,operator:'==',value:1}],
  originalCurrentANDAdditionalUnknownTypes:['phase_random'],
  sourceCompatibleStyleNames:['逃げ','先行','差し','追込'],
  disposition:'bounded-original-computed-spurt-AND-structure-candidate',
  eligibleForP3CardScoring:false,cardScore:null,
  measuredGameOrModelSkillRate:null,verifiedFourStyleDirection:null,
  fullOriginalSourceANDObserved:false,missingConditionsStillUnknown:true
 }));
 const d={schemaVersion:1,status:p242.STATUS,
  source:{registrySHA256:g6.SOURCE_SHA,registryRevision:p243.PIN},
  denominators:{appSkills:6,sourceMatchedSkills:5,sourceUnavailableSkills:1,
   allOriginalRouteFamilies:5,
   dynamicPredicateRouteRows:3,distinctDynamicSourceRouteIdentities:3,
   originalFullANDProvenHere:0,realGameProcMeasurements:0,
   promotedP3OrP4Ratings:0},
  perType:{is_lastspurt:{sourceRouteFamilies:3}},
  routeDecisions:dynamicRows,
  selectedLimitedStudyRoutes:dynamicRows.map(x=>({
   skillId:x.skillId,sourceNumericId:x.sourceNumericId,
   invokeOffset:0,invokeIndex:1,conditionOrIndex:0,preconditionOrIndex:null
  }))};
 const s={schemaVersion:1,status:p243.STATUS,
  source:{revision:p243.PIN},
  sourceSkillRegistrySHA256:g6.SOURCE_SHA,
  summary:{originalSourceSkillCandidates:3,
   additionalRaceOrSameTickTrials:0,
   originalFullSkillActivationRatesMeasured:0,
   approvedP3OrP4Ratings:0},
  rows:pins.slice(0,3).map((id,i)=>({
   sourceNumericId:id,skillId:'skill:'+id,
   originalSkillName:'synthetic '+id,
   route:{invokeOffset:0,invokeIndex:1,conditionOrIndex:0,
    preconditionOrIndex:null},
   exactOriginalCurrentAND:[
    {type:'is_lastspurt',operator:'==',value:1},
    {type:i===1?'infront_near_lane_time':'phase_random',
     operator:i===1?'>=':'==',value:1}
   ],
   explicitOriginalRaceGates:i===0?
    [{type:'distance_type',operator:'==',value:3}]:[],
   identicalFullCurrentANDToP238Reference:false,
   originalP238SpurtAndWindowPredicatesAllPresent:i===0,
   disposition:i===1?'hold-source-approximate-near-lane-state-not-independent-position-observation':
    'reuse-partial-source-mechanism-only',
   companionTiming:i===1?null:{status:'source-defined'},
   eligibleForP3CardScoring:false,cardScore:null,
   sameSourceTickSkillANDObservedHere:false,
   measuredOriginalModelSkillActivationRate:null,
   validatedFourStyleWOrD:null
  }))};
 return {a,p,d,s};
}
const joined=f=>g6.build(f.a,f.p,f.d,f.s);
test('P2 G6 produces read-only 3-axis, W/D, dynamic and source-exact original-AND handoff',()=>{
 const f=fixture(),before=JSON.stringify(f);
 const x=joined(f);
 assert.equal(JSON.stringify(f),before);
 assert.equal(x.status,g6.STATUS);
 assert.deepEqual(x.denominators,{
  appSkills:6,sourceMatchedSkills:5,sourceUnavailableSkills:1,
  originalSourceRouteRefs:5,
  conditionallyModeledPartialWDSkills:1,
  directPartialWDSkills:1,sourceExceptionPartialWDSkills:0,
  explicitGroundModelHeldSkills:1,
  noNewShortWindowEvidenceSkills:4,
  originalDynamicTypeRouteRows:3,
  originalDynamicDistinctRouteIdentities:3,
  selectedSourceANDReviews:3,
  verifiedFullOriginalSourceANDRates:0,
  observedRealGameActivationRates:0,approvedSkillCardSuitabilityScores:0
 });
 assert.equal(x.rows[0].selectedOriginalANDReview.sourceNumericId,'203431');
 assert.equal(x.rows[1].selectedOriginalANDReview.disposition,
  'hold-source-approximate-near-lane-state-not-independent-position-observation');
 assert.equal(x.rows[3].partialModelWD.evidence.source,'P2.34');
 assert.equal(x.rows[4].partialModelWD.decision,'hold-turf-model-transfer');
 assert.equal(x.rows[4].partialModelWD.evidence,null);
 assert.equal(x.rows[5].explicitThreeAxisNecessaryOnly.potentialGroundStateMasks,null);
 assert.deepEqual(x.rows[3].explicitThreeAxisNecessaryOnly.potentialGroundStateMasks,m());
 assert(x.rows.every(r=>r.evaluationOutcome.cardScore===null&&
  r.evaluationOutcome.eligibleForP3CardScoring===false&&
  r.evaluationOutcome.originalGameActivationRate===null));
});
test('P3 G6 independently verifies all four original source inputs and accepts only research index',()=>{
 const f=fixture(),x=joined(f),before=JSON.stringify(x);
 const z=p3.accept(x,f.a,f.p,f.d,f.s);
 assert.equal(JSON.stringify(x),before);
 assert.equal(z.status,p3.STATUS);
 assert.equal(z.population.appSkills,6);
 assert.equal(z.population.sourceMatchedSkills,5);
 assert.equal(z.population.sourceUnavailableSkills,1);
 assert.equal(z.population.formalSkillSuitabilityScores,0);
 assert.equal(z.population.verifiedCardAcquisitionPaths,0);
 assert(p3.validateReceipt(z,x,f.a,f.p,f.d,f.s));
 assert.equal(p3.lookupBySourceId(z,x,f.a,f.p,f.d,f.s,'203431').status,
  'quarantined-research-not-suitability');
 assert.equal(p3.lookupBySourceId(z,x,f.a,f.p,f.d,f.s,'999999').status,
  'source-ID-outside-this-app-cohort-or-unmatched');
 assert.throws(()=>p3.lookupBySourceId(z,x,f.a,f.p,f.d,f.s,'skill:203431'),
  /only original numeric source ID/);
 const fake=structuredClone(z);fake.sourceAppResearchIndex[0].cardScore=100;
 assert.throws(()=>p3.validateReceipt(fake,x,f.a,f.p,f.d,f.s),/not a reproducible/);
});
test('fail closed when any source ID, static mask, route identity or dynamic hold is corrupted',()=>{
 const a=fixture();a.a.sourceRows[0].sourceNumericId='200200';
 assert.throws(()=>joined(a),/source axis and partial numeric ID mismatch/);
 const b=fixture();b.a.sourceRows[0].potentialGroundStateMasks[7]=16;
 assert.throws(()=>joined(b),/invalid 4-style/);
 const c=fixture();c.a.routeRows[0].conditionOrIndex=2;
 assert.throws(()=>joined(c),/dynamic source route does not match/);
 const d=fixture();d.d.routeDecisions[0].cardScore=0;
 assert.throws(()=>joined(d),/measured source dynamic/);
 const e=fixture();e.p.rows[4].decision='no-new-short-window-evidence';
 assert.throws(()=>joined(e),/G6 category or source cohort partition/);
 const f=fixture();f.a.sourceRows[5].potentialGroundStateMasks=m();
 assert.throws(()=>joined(f),/unmatched source has a fabricated finite mask/);
 const g=fixture();g.s.rows[0].sourceNumericId='204661';
 assert.throws(()=>joined(g),/P2.43 exact original AND/);
 const h=fixture();h.p.rows[0].cardScore=0;
 assert.throws(()=>joined(h),/P2.41 source identity or no-score/);
});
test('preserve original per-route OR alternatives and explicit ineligibility as not-applicable, never zero',()=>{
 const f=fixture();
 f.a.routeRows.push({...f.a.routeRows[3],conditionOrIndex:1,
  groundStateEligibilityMasks:Array(32).fill(0)});
 f.a.denominators.sourceRouteFamilies++;
 f.d.denominators.allOriginalRouteFamilies++;
 const out=joined(f);
 const refs=out.rows[3].explicitThreeAxisNecessaryOnly.sourceRoutes;
 assert.equal(refs.length,2);
 assert(refs.some(r=>r.necessaryGroundStateMasks.every(x=>x===0)));
 assert.equal(out.rows[3].evaluationOutcome.explicitIneligibilityIsNotLowScore,true);
 assert.equal(out.rows[3].evaluationOutcome.cardScore,null);
});
