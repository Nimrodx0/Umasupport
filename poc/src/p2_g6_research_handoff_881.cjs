'use strict';
/* P2.44 / G6: fail-closed P2 research handoff for ALL app skills.
 * Four independent FIXED source reports are joined by app ID and exact
 * source numeric ID. Only static necessary gates and partial-model W/D are
 * carried: never infer whole-source AND, proc rate, card route, or P3 score.
 */
const axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const p241=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const p242=require('../tools/p2_g4_dynamic_impact_gates.cjs');
const p243=require('./skill_p2_43_original_spurt_candidate_review.cjs');
const SOURCE_SHA=p242.SOURCE_SHA;
const STATUS='P2.44-G6-quarantined-three-axis-partial-W-D-source-intake-not-product';
const fail=(ok,reason)=>{if(!ok)throw Error('P2.44 G6: '+reason)};
const clone=x=>x===undefined?undefined:structuredClone(x);
const key=r=>[r.sourceNumericId,r.invokeOffset,
 r.conditionOrIndex,r.preconditionOrIndex??'_'].join('|');
const checkMasks=(m,what)=>{
 fail(Array.isArray(m)&&m.length===32&&
  m.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=15),
  'invalid 4-style x 4-distance x 2-ground static mask for '+what);
};
const checked=(map,k,what)=>{
 const x=map.get(k);fail(x,'missing '+what+': '+k);return x;
};
function build(gates,partial,dynamic,selected){
 fail(gates?.schemaVersion===1&&gates.status===axis.STATUS&&
  gates.source?.skillRegistrySha256===SOURCE_SHA&&
  gates.source?.revision===p243.PIN&&
  gates.denominators?.completedWholeSkillConditionEvaluations===0&&
  gates.denominators?.verifiedGameProcProbabilities===0&&
  gates.denominators?.officialSkillCardSuitabilityScores===0&&
  gates.denominators?.actualAppliedOmissions===0&&
  gates.panelDefinition?.contexts?.length===32&&
  JSON.stringify(gates.panelDefinition.contexts)===JSON.stringify(axis.PANEL)&&
  Array.isArray(gates.sourceRows)&&Array.isArray(gates.routeRows),
  'P2.15 original static necessary axis source/meaning drift');
 fail(partial?.schemaVersion===1&&partial.status===p241.STATUS&&
  partial.sources?.sourceUmaSimSHA256===SOURCE_SHA&&
  partial.summary?.eligibleForP3CardScores===0&&
  partial.summary?.productSkillSuitabilityScores===0&&
  partial.summary?.originalFullSkillANDProven===0&&
  Array.isArray(partial.rows),'P2.41 model-only evidence drift');
 fail(dynamic?.schemaVersion===1&&dynamic.status===p242.STATUS&&
  dynamic.source?.registrySHA256===SOURCE_SHA&&
  dynamic.source?.registryRevision===p243.PIN&&
  dynamic.denominators?.originalFullANDProvenHere===0&&
  dynamic.denominators?.realGameProcMeasurements===0&&
  dynamic.denominators?.promotedP3OrP4Ratings===0&&
  Array.isArray(dynamic.routeDecisions),'P2.42 source dynamic decisions drift');
 fail(selected?.schemaVersion===1&&selected.status===p243.STATUS&&
  selected.source?.revision===p243.PIN&&
  selected.sourceSkillRegistrySHA256===SOURCE_SHA&&
  selected.summary?.additionalRaceOrSameTickTrials===0&&
  selected.summary?.originalFullSkillActivationRatesMeasured===0&&
  selected.summary?.approvedP3OrP4Ratings===0&&
  Array.isArray(selected.rows),'P2.43 source-exact decision drift');
 const n=partial.rows.length;
 fail(n===gates.denominators.appSkills&&
  n===dynamic.denominators.appSkills&&
  gates.sourceRows.length===n&&
  partial.summary.appSkills===n&&
  gates.denominators.sourceMatchedSkills===
   partial.summary.sourceMatched&&
  gates.denominators.sourceMatchedSkills===
   dynamic.denominators.sourceMatchedSkills&&
  gates.denominators.sourceUnavailableSkills===
   dynamic.denominators.sourceUnavailableSkills&&
  gates.denominators.sourceRouteFamilies===
   dynamic.denominators.allOriginalRouteFamilies&&
  gates.routeRows.length===gates.denominators.sourceRouteFamilies,
  'four original source cohort denominators inconsistent');
 const sourceIds=new Set(),byId=new Map(),axisById=new Map();
 for(const r of partial.rows){
  fail(typeof r?.skillId==='string'&&!byId.has(r.skillId)&&
   (r.sourceNumericId===null||
    typeof r.sourceNumericId==='string'&&/^\d+$/.test(r.sourceNumericId))&&
   r.wholeSkillSuitability==='not-established'&&
   r.eligibleForP3CardScoring===false&&r.cardScore===null,
   'P2.41 source identity or no-score guard');
  if(r.sourceNumericId!==null){
   fail(!sourceIds.has(r.sourceNumericId),'duplicate original numeric ID');
   sourceIds.add(r.sourceNumericId);
  }
  byId.set(r.skillId,r);
 }
 for(const g of gates.sourceRows){
  fail(typeof g?.skillId==='string'&&!axisById.has(g.skillId),
   'duplicated source axis row');
  const ref=checked(byId,g.skillId,'original axis skill');
  fail(g.sourceNumericId===ref.sourceNumericId,
   'source axis and partial numeric ID mismatch');
  if(g.sourceNumericId===null){
   fail(g.status==='unmatched-source-no-gate-inference'&&
    g.potentialGroundStateMasks===undefined,
    'unmatched source has a fabricated finite mask');
  }else{
   fail(['static-necessary-gates-only','source-empty-condition-invoke-held']
    .includes(g.status)&&g.noDynamicConditionsEvaluated===true&&
    g.actualSkillTriggerObserved===false&&
    typeof g.unknownDynamicSourcePredicatesPresent==='boolean'&&
    ['hasKnownStyleGateContrast','hasKnownDistanceGateContrast',
     'hasKnownSurfaceGateContrast'].every(k=>typeof g[k]==='boolean'),
    'P2.15 static gate not a necessary-condition-only result');
   checkMasks(g.potentialGroundStateMasks,g.skillId);
   if(g.status==='source-empty-condition-invoke-held')
    fail(g.potentialGroundStateMasks.every(x=>x===15),
     'empty-invoke source was incorrectly statically excluded');
  }
  axisById.set(g.skillId,g);
 }
 const originalRoutes=new Map(),byNumeric=new Map();
 for(const x of gates.routeRows){
  fail(typeof x?.sourceNumericId==='string'&&
   sourceIds.has(x.sourceNumericId)&&
   Number.isSafeInteger(x.invokeOffset)&&x.invokeOffset>=0&&
   Number.isSafeInteger(x.conditionOrIndex)&&
   (x.preconditionOrIndex===null||
    Number.isSafeInteger(x.preconditionOrIndex))&&
   x.runtimeSourceConditionsVerified===false&&
   Array.isArray(x.unknownDynamicTypes),
   'malformed original source route reference');
  checkMasks(x.groundStateEligibilityMasks,'original route');
  const k=key(x);
  fail(!originalRoutes.has(k),'duplicate original Invoke/OR route');
  originalRoutes.set(k,x);
  if(!byNumeric.has(x.sourceNumericId))byNumeric.set(x.sourceNumericId,[]);
  byNumeric.get(x.sourceNumericId).push({
   invokeOffset:x.invokeOffset,invokeIndex:x.invokeIndex,
   conditionOrIndex:x.conditionOrIndex,
   preconditionOrIndex:x.preconditionOrIndex,
   necessaryGroundStateMasks:[...x.groundStateEligibilityMasks],
   unresolvedPredicateTypes:[...x.unknownDynamicTypes],
   runtimeFullOriginalANDProven:false
  });
 }
 const byDyn=new Map(),typeRows=new Map();
 for(const d of dynamic.routeDecisions){
  fail(typeof d?.skillId==='string'&&
   typeof d.sourceNumericId==='string'&&
   d.eligibleForP3CardScoring===false&&d.cardScore===null&&
   d.measuredGameOrModelSkillRate===null&&
   d.verifiedFourStyleDirection===null&&
   d.fullOriginalSourceANDObserved===false&&
   d.missingConditionsStillUnknown===true&&
   typeof d.disposition==='string'&&
   Array.isArray(d.originalSourcePredicates),
   'P2.42 measured source dynamic must remain unresolved');
  const r=checked(byId,d.skillId,'dynamic source app ID');
  fail(r.sourceNumericId===d.sourceNumericId&&
   originalRoutes.has(key(d)),
   'dynamic source route does not match exact P2.15 source/OR');
  const typ=(typeRows.get(d.type)||0)+1;typeRows.set(d.type,typ);
  if(!byDyn.has(d.skillId))byDyn.set(d.skillId,[]);
  const existing=byDyn.get(d.skillId);
  fail(!existing.some(x=>x.type===d.type&&key(x)===key(d)),
   'duplicate original dynamic type at same route');
  existing.push({
   type:d.type,
   originalRouteRef:{invokeOffset:d.invokeOffset,
    invokeIndex:d.invokeIndex,conditionOrIndex:d.conditionOrIndex,
    preconditionOrIndex:d.preconditionOrIndex},
   originalMatchedPredicates:clone(d.originalSourcePredicates),
   unresolvedAdditionalTypes:[...d.originalCurrentANDAdditionalUnknownTypes],
   finiteCompatibleStyles:[...d.sourceCompatibleStyleNames],
   evidenceDecision:d.disposition,
   requiresReassessmentForWholeSkill:true,
   sourceModelFrequencyIsGameFrequency:false
  });
 }
 fail(dynamic.denominators.dynamicPredicateRouteRows===
  [...typeRows.values()].reduce((a,b)=>a+b,0),
  'dynamic predicates per-type row denominator mismatch');
 for(const [type,x] of Object.entries(dynamic.perType)){
  fail(typeRows.get(type)===x.sourceRouteFamilies,
   'dynamic type report incomplete: '+type);
 }
 const reviews=new Map(),candidates=dynamic.selectedLimitedStudyRoutes||[];
 fail(selected.rows.length===selected.summary.originalSourceSkillCandidates&&
  selected.rows.length===p243.TARGETS.length&&
  candidates.length===selected.rows.length,
  'P2.43 selected original route count disagreement');
 for(const [i,x] of selected.rows.entries()){
  const c=candidates[i],expected=p243.TARGETS[i];
  fail(x.sourceNumericId===expected.sourceNumericId&&
   c?.sourceNumericId===x.sourceNumericId&&
   c.skillId===x.skillId&&
   c.invokeOffset===x.route?.invokeOffset&&
   c.conditionOrIndex===x.route.conditionOrIndex&&
   c.preconditionOrIndex===x.route.preconditionOrIndex&&
   !reviews.has(x.skillId)&&
   x.eligibleForP3CardScoring===false&&
   x.cardScore===null&&
   x.sameSourceTickSkillANDObservedHere===false&&
   x.measuredOriginalModelSkillActivationRate===null&&
   x.validatedFourStyleWOrD===null,
   'P2.43 exact original AND / P2.42 source candidate mismatch');
  const old=checked(byId,x.skillId,'P2.43 source app');
  fail(old.sourceNumericId===x.sourceNumericId&&
   old.skillName===x.originalSkillName,
   'reviewed original source name or ID mismatch');
  reviews.set(x.skillId,{
   sourceNumericId:x.sourceNumericId,
   exactOriginalAND:clone(x.exactOriginalCurrentAND),
   originalRaceGates:clone(x.explicitOriginalRaceGates),
   referenceP238WholeANDIdentical:x.identicalFullCurrentANDToP238Reference,
   referenceP238PartialANDReused:
    x.originalP238SpurtAndWindowPredicatesAllPresent,
   disposition:x.disposition,
   sourceWindow:clone(x.companionTiming),
   evidenceOnlyNoNewRaceExecution:true
  });
 }
 let nDirect=0,nException=0,nHeld=0,nOther=0;
 const rows=partial.rows.map(r=>{
  const a=checked(axisById,r.skillId,'full G6 axis row');
  const dyn=byDyn.get(r.skillId)||[];
  const rev=reviews.get(r.skillId)||null;
  const status=r.decision;
  let modelEvidence=null;
  if(status==='conditionally-use-short-window-rank-evidence'){
   nDirect++;
   fail(r.scope&&r.styles&&Array.isArray(r.pairs)&&
    r.pairs.length===6&&!r.sourceBranchEvidence,
    'direct model-partial W/D lost original scope or source style exclusion');
   modelEvidence={source:'P2.34',scope:clone(r.scope),
    styles:clone(r.styles),stylePairComparisons:clone(r.pairs)};
  }else if(status==='conditionally-use-source-exception-branch-W-D'){
   nException++;
   fail(Array.isArray(r.sourceBranchEvidence)&&
    [1,2].includes(r.sourceBranchEvidence.length)&&
    r.originalP235Decision,
    'original exception OR distance/rank branches lost');
   modelEvidence={source:'P2.36',
    originalP235Decision:r.originalP235Decision,
    independentlyInterpretedSourceBranches:
     clone(r.sourceBranchEvidence)};
  }else if(status==='hold-turf-model-transfer'){
   nHeld++;
   fail(Array.isArray(r.heldReasons)&&r.heldReasons.length>0,
    'original ground model transfer held without reason');
  }else{
   fail(status==='no-new-short-window-evidence',
    'unsupported G6 model evidence disposition');
   nOther++;
  }
  const sourceMatched=r.sourceNumericId!==null;
  return {
   appSkillId:r.skillId,
   originalNumericSourceId:r.sourceNumericId,
   originalName:r.skillName,
   originalSourceRef:sourceMatched?{
    revision:p243.PIN,skillRegistrySHA256:SOURCE_SHA,
    sourceNumericId:r.sourceNumericId,
    fullRawANDOrInvokeNeedsIndependentRecheck:true
   }:null,
   explicitThreeAxisNecessaryOnly:sourceMatched?{
    status:a.status,axisOrder:'style[1..4] x distance[1..4] x surface[1..2]',
    groundConditionBits:'1..4',
    potentialGroundStateMasks:[...a.potentialGroundStateMasks],
    knownExplicitContrast:{
     style:a.hasKnownStyleGateContrast,
     distance:a.hasKnownDistanceGateContrast,
     surface:a.hasKnownSurfaceGateContrast
    },
    sourceRoutes:clone(byNumeric.get(r.sourceNumericId)||[]),
    unknownDynamicSourcePredicatesPresent:
     a.unknownDynamicSourcePredicatesPresent,
    dynamicConditionsProven:false,
    fullSkillTriggerProven:false
   }:{status:'source-unavailable',potentialGroundStateMasks:null,
     noEligibilityInferred:true},
   partialModelWD:{
    decision:status,
    evidence:modelEvidence,
    heldOriginalGroundQualifierReasons:
     status==='hold-turf-model-transfer'?[...r.heldReasons]:null,
    WDefinition:'10m-window-rank-opportunity-partial-source-condition-only',
    DDefinition:'model-point-rank-occupancy-minus-uniform-rank-baseline-O-minus-U',
    sourceScopeMustBeRetained:true,
    originalWholeSkillANDNotEstablished:true
   },
   originalDynamicSourceResearch:dyn,
   selectedOriginalANDReview:rev,
   evaluationOutcome:{
    status:'P3-research-intake-only-not-approved-skill-or-card-suitability',
    explicitIneligibilityIsNotLowScore:true,
    nonStudiedOrHeldIsNotZeroProbability:true,
    wholeOriginalANDOrInvoke:'unknown',
    originalGameActivationRate:null,
    cardSkillAcquisition:'not-evaluated-in-this-P2-G6-intake',
    acquiredFromAnyCard:null,
    suitabilityLabel:null,
    eligibleForP3CardScoring:false,cardScore:null
   }
  };
 });
 fail(nDirect===partial.summary.directlyModeledSourceSkills&&
  nException===partial.summary.sourceExceptionModeledSkills&&
  nDirect+nException===
    partial.summary.uniqueSourceSkillsWithConditionalPartialWDEvidence&&
  nHeld===partial.summary.heldOriginalGroundQualifierSkills&&
  nOther===partial.summary.otherSkillsWithoutThisSpecificWindowEvidence&&
  nDirect+nException+nHeld+nOther===n&&
  sourceIds.size===partial.summary.sourceMatched&&
  reviews.size===selected.rows.length,
  'P2.41/P2.43 G6 category or source cohort partition mismatch');
 return {
  schemaVersion:1,status:STATUS,
  source:{
   fixedOriginalSourceRevision:p243.PIN,
   fixedOriginalSkillRegistrySHA256:SOURCE_SHA,
   fixedGlobalSimRaceStudyCount:partial.sources.modelRaces,
   priorStatuses:{staticAxes:gates.status,partialWD:partial.status,
    dynamicSource:dynamic.status,selectedOriginalAND:selected.status},
   originalCommercialGameEngineObserved:false
  },
  denominators:{
   appSkills:n,sourceMatchedSkills:sourceIds.size,
   sourceUnavailableSkills:n-sourceIds.size,
   originalSourceRouteRefs:originalRoutes.size,
   conditionallyModeledPartialWDSkills:nDirect+nException,
   directPartialWDSkills:nDirect,sourceExceptionPartialWDSkills:nException,
   explicitGroundModelHeldSkills:nHeld,
   noNewShortWindowEvidenceSkills:nOther,
   originalDynamicTypeRouteRows:dynamic.routeDecisions.length,
   originalDynamicDistinctRouteIdentities:
    dynamic.denominators.distinctDynamicSourceRouteIdentities,
   selectedSourceANDReviews:reviews.size,
   verifiedFullOriginalSourceANDRates:0,observedRealGameActivationRates:0,
   approvedSkillCardSuitabilityScores:0
  },
  g6Decision:{
   threeAxisExplicitNecessaryGates:'transferred-only-not-activation',
   originalSourcePredicates:'refer-by-pinned-ID-and-route-no-complete-AST-copy',
   relativeStyleAndAbsoluteW:'partial-fixed-model-only-not-whole-skill',
   WAndD:'distinct-model-observations-no-aggregation-to-one-score',
   unknownANDAndPreconditions:'held-never-assume-true',
   proximityAndOvertakeRandomApproximation:'never-real-game-observation',
   distanceAndGround:'explicit-eligibility-preserved-no-implicit-generalization',
   P3Use:'quarantined-data-validation-only',
   G6ParentPass:false
  },
  rows,
  limitations:[
   'P2.15 static masks are NECESSARY compatibility bounds across four style, four distance and two ground axes, NOT a skill activation rate.',
   'All original AND/OR/Invoke raw terms remain in the pinned source registry; this receipt does not claim to copy full source AST for all 881 skills.',
   'P2.41 partial W/D uses skill-free artificial model trajectories and must not be applied outside original source race gates or model contexts.',
   'Source-static ineligibility is not zero suitability; missing data and held dynamic preconditions are unknown, not false.',
   'P2.42/43 model approximations are not real game observations, while P2.39 natural spurt was only a controlled third-party source model.',
   'P3.1 historic ten-source-condition research and this 881-app-skill G6 handoff are separate cohorts, not independent or automatically joinable.',
   'Source identity does not mean any specific support card offers this skill, nor that an event branch is selected.',
   'No product skill/card scoring, official game rates, effectiveness or P4 UI approval is granted.'
  ]
 };
}
module.exports={SOURCE_SHA,STATUS,key,build};
