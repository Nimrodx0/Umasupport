'use strict';
/*
 * P3.4a: research-only, provenance-preserving interpretation of the P2.44
 * 881-app-skill P3 receipt. DO NOT score or infer whole-skill suitability.
 *
 * Three independent axes remain explicit:
 *   (1) static necessary applicability (32 source cells x 4 condition bits),
 *   (2) partial W and D model comparisons per original source branch,
 *   (3) unknown original AND/preconditions, source approximations and card grant.
 * Tie vs reversal cannot be split using P2.41 held direction summaries.
 */
const g6=require('./p2_g6_research_handoff_881.cjs');
const p3=require('./p3_g6_research_intake.cjs');
const source=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const STYLE_PAIRS=source.STYLES.flatMap((s,i)=>
 source.STYLES.slice(i+1).map(t=>s+'|'+t));
const VALID_PAIRS=new Set(STYLE_PAIRS);
const STATUS='P3.4a-uncertainty-interpreted-source-research-only-no-scoring-policy';
const fail=(ok,detail)=>{if(!ok)throw Error('P3.4a research semantics: '+detail)};
function contextApplicability(row,context){
 const x=row?.explicitThreeAxisNecessaryOnly;
 fail(x&&context&&[context.runningStyle,context.distanceType,
  context.groundType,context.groundCondition].every(Number.isSafeInteger)&&
  [context.runningStyle,context.distanceType].every(v=>v>=1&&v<=4)&&
  context.groundType>=1&&context.groundType<=2&&
  context.groundCondition>=1&&context.groundCondition<=4,
  'invalid source necessary-condition panel query');
 if(x.status==='source-unavailable'){
  fail(x.potentialGroundStateMasks===null,'unknown source mask must be null');
  return 'source-unmatched-applicability-unknown';
 }
 fail(Array.isArray(x.potentialGroundStateMasks)&&
  x.potentialGroundStateMasks.length===32,
  'source matched three-axis necessary mask absent');
 const index=g6Key(context),mask=x.potentialGroundStateMasks[index];
 fail(Number.isSafeInteger(mask)&&mask>=0&&mask<=15,'invalid source mask bit');
 return mask&(1<<(context.groundCondition-1))?
  'not-excluded-by-known-source-static-gates-dynamic-unknown':
  'excluded-in-this-context-by-known-source-static-necessary-gates';
}
function g6Key(x){
 return ((x.runningStyle-1)*4+(x.distanceType-1))*2+(x.groundType-1);
}
function staticSummary(row){
 if(row.originalNumericSourceId===null){
  fail(row.explicitThreeAxisNecessaryOnly?.status==='source-unavailable'&&
   row.explicitThreeAxisNecessaryOnly.potentialGroundStateMasks===null,
   'unmatched original source must not be projected as ineligible');
  return {sourceMatch:'unmatched',possibleContextsFromKnownStatic:null,
   excludedContextsFromKnownStatic:null,possibleIsActivation:false,
   fullSourceEligibilityKnown:false};
 }
 const a=row.explicitThreeAxisNecessaryOnly;
 fail(['static-necessary-gates-only','source-empty-condition-invoke-held']
  .includes(a?.status)&&Array.isArray(a.potentialGroundStateMasks)&&
  a.potentialGroundStateMasks.length===32,
  'source-known necessary mask missing');
 let possible=0;
 for(const n of a.potentialGroundStateMasks){
  fail(Number.isSafeInteger(n)&&n>=0&&n<=15,
   'malformed original static bitmask');
  for(let i=0;i<4;i++)if(n&(1<<i))possible++;
 }
 fail(possible>=0&&possible<=128,'impossible static total');
 return {sourceMatch:'matched',
  possibleContextsFromKnownStatic:possible,
  excludedContextsFromKnownStatic:128-possible,
  possibleIsActivation:false,fullSourceEligibilityKnown:false};
}
function direction(value){
 fail(value&&typeof value==='object','partial model direction required');
 if(value.status==='model-only-same-direction'){
  fail(['+','-'].includes(value.direction),'model direction sign missing');
  return {status:'direction-repeated-in-fixed-model-only',
   higher:value.direction==='+'?'first':'second',
   numericGameProbability:null,wholeSkillStyleRank:null};
 }
 fail(value.status==='held-context-or-seed-inconsistent'&&
  value.direction===null,
  'unknown or fabricated stable direction must be rejected');
 return {status:'held-tie-reversal-or-context-seed-instability-undifferentiated',
  higher:null,numericGameProbability:null,wholeSkillStyleRank:null};
}
function comparisons(pairs,sourceName){
 fail(Array.isArray(pairs)&&pairs.length===6,
  'source model original pairs incomplete');
 const seen=new Set();
 return pairs.map(p=>{
  const name=p?.first+'|'+p?.second;
  fail(VALID_PAIRS.has(name)&&!seen.has(name),
   'original source pair order or identity changed');
  seen.add(name);
  if(p.status==='not-comparable-explicit-style-eligibility'){
   fail(sourceName==='P2.34'&&p.WDirection===undefined&&
    p.DDirection===undefined,
    'explicit original style exclusion cannot be converted to W=0');
   return {first:p.first,second:p.second,
    status:'source-style-explicitly-not-comparable',
    W:null,D:null,modelOnly:true};
  }
  fail((sourceName==='P2.34'&&
     p.status==='partial-original-rank-window-model-comparison')||
    (sourceName==='P2.36'&&
     p.status==='fixed-model-partial-rank-window-evidence-only'),
   'original source pair is not model-partial W/D');
  const w=direction(p.WDirection),d=direction(p.DDirection);
  return {first:p.first,second:p.second,
   status:'conditional-model-source-window-pair-not-whole-skill',
   W:w,D:d,modelOnly:true,
   oppositeWAndDDirections:
    w.higher!==null&&d.higher!==null&&w.higher!==d.higher,
   note:'W opportunity and D=O-U are separate measures; difference is not an error or a game-rate claim'};
 });
}
function scopedModel(row){
 const p=row.partialModelWD;
 fail(p?.originalWholeSkillANDNotEstablished===true&&
  p.sourceScopeMustBeRetained===true,
  'prior partial source window scope/whole AND unknown changed');
 if(p.decision==='conditionally-use-short-window-rank-evidence'){
  fail(p.evidence?.source==='P2.34'&&p.evidence.scope&&
   Array.isArray(p.evidence.stylePairComparisons),
   'P2.34 direct window scope missing');
  return {status:'partial-source-window-research-only',
   branches:[{origin:'P2.34',sourceDistanceType:null,
    scope:structuredClone(p.evidence.scope),
    WAndD:comparisons(p.evidence.stylePairComparisons,'P2.34')}],
   transferableToUnstudiedCourse:false,realGameActivationRate:null};
 }
 if(p.decision==='conditionally-use-source-exception-branch-W-D'){
  const e=p.evidence;
  fail(e?.source==='P2.36'&&
   ['source-logic-adopt-distance-exclusive-OR',
    'source-logic-adopt-intersection-but-hold-original-W-D']
    .includes(e.originalP235Decision)&&
   Array.isArray(e.independentlyInterpretedSourceBranches)&&
   [1,2].includes(e.independentlyInterpretedSourceBranches.length),
   'source distance OR/narrow rank branch evidence lost');
  const seen=new Set();
  const branches=e.independentlyInterpretedSourceBranches.map(b=>{
   fail([1,3,4].includes(b?.sourceDistanceType)&&
    !seen.has(b.sourceDistanceType)&&b.scope&&
    typeof b.sourceWindow==='string'&&
    typeof b.sourceRankBand==='string',
    'original distance OR branch scope lost');
   seen.add(b.sourceDistanceType);
   return {origin:'P2.36',
    sourceDistanceType:b.sourceDistanceType,
    originalWindow:b.sourceWindow,
    originalRankBand:b.sourceRankBand,
    scope:structuredClone(b.scope),
    WAndD:comparisons(b.pairs,'P2.36')};
  });
  if(branches.length===2)
   fail(seen.has(3)&&seen.has(4),
    'two mutually exclusive source branches must remain middle/long');
  return {status:'partial-source-window-research-only',
   originalDistanceInterpretation:e.originalP235Decision,
   branches,transferableToUnstudiedCourse:false,
   originalSeparateBranchesMayNotBeAveraged:true,
   realGameActivationRate:null};
 }
 fail(p.decision==='hold-turf-model-transfer'||
  p.decision==='no-new-short-window-evidence',
  'unhandled original partial source study status');
 fail(p.evidence===null,'held or unstudied branch must not carry a measurement');
 if(p.decision==='hold-turf-model-transfer'){
  fail(Array.isArray(p.heldOriginalGroundQualifierReasons)&&
   p.heldOriginalGroundQualifierReasons.length>0,
   'original ground hold has no reason');
  return {status:'held-source-ground-not-covered-by-model',
   reasons:[...p.heldOriginalGroundQualifierReasons],
   branches:[],realGameActivationRate:null};
 }
 return {status:'no-additional-short-window-study',
  branches:[],realGameActivationRate:null};
}
function interpret(handoff,receipt,axes,partial,dynamic,selected){
 p3.validateReceipt(receipt,handoff,axes,partial,dynamic,selected);
 fail(handoff?.status===g6.STATUS&&
  handoff.denominators?.approvedSkillCardSuitabilityScores===0&&
  receipt?.population?.formalSkillSuitabilityScores===0&&
  receipt.provenance?.sourceFixedModelRevision===
   handoff.source.fixedOriginalSourceRevision,
  'P2/P3 research scoring boundary changed');
 const decisions={},modelStats={pairSlots:0,notComparable:0,
  comparable:0,WStrictModelOnly:0,WHeld:0,DStrictModelOnly:0,DHeld:0,
  modelWDOppositeDirection:0};
 const rows=handoff.rows.map(r=>{
  fail(r.evaluationOutcome?.eligibleForP3CardScoring===false&&
   r.evaluationOutcome.cardScore===null&&
   r.evaluationOutcome.suitabilityLabel===null&&
   r.evaluationOutcome.wholeOriginalANDOrInvoke==='unknown'&&
   r.evaluationOutcome.originalGameActivationRate===null,
   'official suitability/probability improperly present');
  const staticEvidence=staticSummary(r),modelWD=scopedModel(r);
  decisions[modelWD.status]=(decisions[modelWD.status]||0)+1;
  for(const branch of modelWD.branches)for(const p of branch.WAndD){
   modelStats.pairSlots++;
   if(p.status==='source-style-explicitly-not-comparable'){
    modelStats.notComparable++;continue;
   }
   modelStats.comparable++;
   modelStats[p.W.status==='direction-repeated-in-fixed-model-only'?
    'WStrictModelOnly':'WHeld']++;
   modelStats[p.D.status==='direction-repeated-in-fixed-model-only'?
    'DStrictModelOnly':'DHeld']++;
   if(p.oppositeWAndDDirections)modelStats.modelWDOppositeDirection++;
  }
  const limitations=[
   'full-original-AND-OR-Invoke-unverified',
   'real-game-proc-rate-not-measured',
   'card-acquisition-not-confirmed-by-this-intake',
   'official-skill-card-suitability-rule-not-approved'
  ];
  if(staticEvidence.sourceMatch==='unmatched')
   limitations.push('source-condition-identity-not-matched');
  if(modelWD.status==='no-additional-short-window-study')
   limitations.push('partial-window-research-not-available');
  if(modelWD.status==='held-source-ground-not-covered-by-model')
   limitations.push('original-surface-model-coverage-held');
  if(modelWD.status==='partial-source-window-research-only')
   limitations.push('observed-W-D-not-full-skill-or-universal-race-scope');
  if(r.originalDynamicSourceResearch.length)
   limitations.push('source-dynamic-AND-or-model-approximation-unverified');
  if(r.selectedOriginalANDReview)
   limitations.push('source-exact-mechanism-review-not-game-rate');
  return {appSkillId:r.appSkillId,sourceNumericId:r.originalNumericSourceId,
   originalName:r.originalName,
   staticSourceApplicability:staticEvidence,
   modelPartialWD:modelWD,
   dynamicSourceDispositions:r.originalDynamicSourceResearch.map(d=>({
    type:d.type,sourceRoute:structuredClone(d.originalRouteRef),
    disposition:d.evidenceDecision,
    originalSourceModelFrequencyIsGameFrequency:false
   })),
   selectedSourceANDDisposition:r.selectedOriginalANDReview?.disposition??null,
   unresolvedReasons:limitations,
   officialGameProcRate:null,wholeSkillSuitability:null,
   suitabilityLabel:null,cardScore:null,eligibleForP3CardScoring:false
  };
 });
 fail(rows.length===handoff.denominators.appSkills&&
  new Set(rows.map(x=>x.appSkillId)).size===rows.length,
  'missing/duplicated application skill evidence');
 fail(modelStats.pairSlots===
  handoff.denominators.directPartialWDSkills*6+
   partial.summary.p236ComparableBranchPairs,
  'pair slots must reflect original source OR branch count');
 fail(modelStats.comparable===
  partial.summary.p234ComparableSkillPairs+
   partial.summary.p236ComparableBranchPairs&&
  modelStats.WStrictModelOnly===
   partial.summary.p234StableSkillWPairs+
    partial.summary.p236StableBranchWPairs&&
  modelStats.WHeld===
   partial.summary.p234HeldSkillWPairs+
    partial.summary.p236HeldBranchWPairs&&
  modelStats.comparable+modelStats.notComparable===modelStats.pairSlots&&
  modelStats.WStrictModelOnly+modelStats.WHeld===modelStats.comparable&&
  modelStats.DStrictModelOnly+modelStats.DHeld===modelStats.comparable,
  'W/D same-model direction cohort or explicit-ineligibility drift');
 return {schemaVersion:1,status:STATUS,
  provenance:{sourceOriginalRegistrySHA256:
   handoff.source.fixedOriginalSkillRegistrySHA256,
   sourceP2G6Status:handoff.status,
   sourceP3QuarantinedReceiptStatus:receipt.status,
   sameFrozenModelStudy:true,officialPolicyApproved:false},
  denominators:{
   appSkills:rows.length,
   sourceMatchedSkills:handoff.denominators.sourceMatchedSkills,
   sourceUnavailableSkills:handoff.denominators.sourceUnavailableSkills,
   perPartialEvidenceState:decisions,
   modelPairSlotsNotIndependentTrials:modelStats,
   actualGameRates:0,
   fullyVerifiedSourceSkillAND:0,
   officialSkillOrCardScores:0},
  proposalScope:{
   contextGrid:'4 styles x 4 distances x 2 grounds x 4 ground conditions=128 source-static necessary contexts per matched skill',
   tieAndReversal:'P2.41 summarized held directions do not separate ties, reversals, seed or context instability; keep grouped until raw observations are explicitly reviewed',
   strictDirection:'model-only within exact source study scope, not four-style whole skill rank',
   WAndD:'separate; opposite model W vs D does not permit an aggregated winner',
   sourceNotExcluded:'static prerequisite has not ruled out the skill; does not establish proc or all original race gates',
   notMeasured:'not zero, and never apply unknown 63 source masks as all-15',
   modelHeldGround:'no turf W/D transfer to original dirt restricted skills',
   modelBranch:'OR middle/long source branches never pooled or reweighted',
   gameAndCard:'no game rate, source whole AND, acquisition certainty or P3 scoring',
   notYetDecided:['product-UI-labels','suitability-high-medium-low',
    'numeric-score-weights-or-thresholds','tie-versus-reversal-split-without-raw-evidence',
    'card-aggregation-of-unknowns']
  },
  rows};
}
module.exports={STATUS,STYLE_PAIRS,contextApplicability,
 direction,comparisons,scopedModel,staticSummary,interpret};
