'use strict';
/*
 * P2.15 cross-run RESEARCH EVIDENCE JOIN.
 *
 * A previous pinned JVM Actions run actually equipped registered source skill
 * 105401211. An independent fixed app-model source audit identified 85
 * order_rate + phase_random *same original AND* routes. Compare these
 * datasets by source skill ID AND original Invoke/OR/AND identity, never by
 * predicate mechanism alone, and never assume same-race/same-tick rank.
 *
 * This module replays NO race, imports NO source registry, and makes no
 * claims that source UmaSim evaluated order_rate or the real game's proc.
 */
const source=require('./skill_source_whole_tick_monitor.cjs');
const {createHash}=require('node:crypto');
const rank=require('./skill_p2_15_rank_random_same_and_handoff.cjs');
const MODEL_REVISION='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const SOURCE_REGISTRY_BLOB='0c6ea6d72b037b24ee40860f73b0e86db47aab1d';
const STATUS='P2.15-source-registered-JVM-vs-85-app-route-identity-only';
const EVIDENCE_STATUS='P2.15-original-registered-source-skill-actual-race-phase-only';
/*
 * Review snapshot from successful separate pinned source JVM Actions run
 * https://github.com/Nimrodx0/Umasupport/actions/runs/43459950609
 * Original trace artifact is retained only for 14 days. This is an immutable
 * provenance summary; it does NOT recreate or re-observe its race frames.
 */
const SNAPSHOT=Object.freeze({
 status:EVIDENCE_STATUS,
 pinnedUmaSimRevision:MODEL_REVISION,
 sourceRegistryBlobSha:SOURCE_REGISTRY_BLOB,
 observedRegisteredSkillId:'105401211',
 originalInvokeCount:1,
 originalInvokeIndex:1,
 originalORCount:1,
 originalORIndex:0,
 originalANDSize:3,
 originalPreconditionORCount:0,
 // This is inserted only after the UPDATED pinned original JVM CI
 // independently records it. Until then, no exact-route proof is possible.
 originalSourceConditionLogicSha256:null,
 sourceRaceCount:3,
 originalPhaseRandomCheckerCalls:1893,
 sourceModelEvents:3,
 originalOrderRateEvaluatedInSource:0,
 originalFullANDProven:0,
 gameProcProbabilityMeasurements:0,
 approvedSuitabilityRatings:0,
 sourceEvidenceRunUrl:'https://github.com/Nimrodx0/Umasupport/actions/runs/43459950609'
});
const fail=(ok,why)=>{if(!ok)throw Error('P2.15 registered/85 join: '+why)};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const numeric=x=>typeof x==='string'&&/^[0-9]+$/.test(x);
function validatedReference(e){
 fail(isObj(e)&&e.status===EVIDENCE_STATUS&&
  e.pinnedUmaSimRevision===MODEL_REVISION&&
  e.sourceRegistryBlobSha===SOURCE_REGISTRY_BLOB&&
  numeric(e.observedRegisteredSkillId)&&
  Number.isSafeInteger(e.originalInvokeCount)&&e.originalInvokeCount>0&&
  Number.isSafeInteger(e.originalInvokeIndex)&&e.originalInvokeIndex>=0&&
  Number.isSafeInteger(e.originalORCount)&&e.originalORCount>0&&
  Number.isSafeInteger(e.originalORIndex)&&e.originalORIndex>=0&&
  e.originalORIndex<e.originalORCount&&
  (e.originalSourceConditionLogicSha256===null||
   typeof e.originalSourceConditionLogicSha256==='string'&&
   /^[a-f0-9]{64}$/.test(e.originalSourceConditionLogicSha256))&&
  Number.isSafeInteger(e.originalANDSize)&&e.originalANDSize>=2&&
  Number.isSafeInteger(e.originalPreconditionORCount)&&e.originalPreconditionORCount>=0&&
  e.sourceRaceCount===3&&e.originalPhaseRandomCheckerCalls>0&&
  e.sourceModelEvents>=0&&
  e.originalOrderRateEvaluatedInSource===0&&
  e.originalFullANDProven===0&&
  e.gameProcProbabilityMeasurements===0&&
  e.approvedSuitabilityRatings===0&&
  typeof e.sourceEvidenceRunUrl==='string'&&
  e.sourceEvidenceRunUrl.startsWith('https://github.com/Nimrodx0/Umasupport/actions/runs/'),
  'verified original JVM snapshot provenance or no-rating boundary mismatch');
 return e;
}
function logicSha256(compiled){
 const normalized=compiled.invokes.map(inv=>[
  inv.invokeIndex,
  inv.conditions.map(row=>row.map(ref=>[ref.type,ref.operator,ref.value])),
  inv.preConditions.map(row=>row.map(ref=>[ref.type,ref.operator,ref.value]))
 ]);
 return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
function compareStructure(compiled,e){
 if(compiled.invokes.length!==e.originalInvokeCount)
  return 'different-invoke-count';
 const inv=compiled.invokes.find(x=>x.invokeIndex===e.originalInvokeIndex);
 if(!inv)return 'missing-original-invoke-index';
 if(inv.conditions.length!==e.originalORCount)
  return 'different-conditions-OR-count';
 if(inv.preConditions.length!==e.originalPreconditionORCount)
  return 'different-preconditions-OR-count';
 const row=inv.conditions[e.originalORIndex];
 if(!Array.isArray(row)||row.length!==e.originalANDSize)
  return 'different-selected-AND-size';
 if(!row.some(x=>x.type==='order_rate')||
    !row.some(x=>x.type==='phase_random'&&x.operator==='=='&&x.value===2))
  return 'different-selected-AND-predicate-shape';
 // Counts and two predicate types alone are NOT sufficient to prove the
 // unobserved third predicate, its numeric threshold, other OR alternatives,
 // or any preconditions match the JVM model's original source registry.
 if(!e.originalSourceConditionLogicSha256)
  return 'original-JVM-logic-fingerprint-not-yet-available';
 if(logicSha256(compiled)!==e.originalSourceConditionLogicSha256)
  return 'different-original-source-condition-logic-fingerprint';
 return 'same-source-route-logic-fingerprint';
}
function audit(model,prior,reference=SNAPSHOT){
 const e=validatedReference(reference);
 fail(isObj(model)&&Array.isArray(model.skills)&&isObj(model.skillById)&&
  prior?.status===rank.STATUS&&Array.isArray(prior.candidates)&&
  prior?.denominators?.sourceMatchedSkills>=1,
  'complete app model and source rank-random cohort required');
 const start=JSON.stringify(model), before=JSON.stringify(prior);
 const matches=model.skills.filter(s=>s.activationProfile?.status==='source-structure'&&
  s.activationProfile.sourceNumericId===e.observedRegisteredSkillId);
 fail(matches.length<=1,'duplicate registered skill source match in application');
 const chosen=matches[0]??null;
 const current=prior.candidates.filter(c=>
  c.sourceNumericId===e.observedRegisteredSkillId);
 fail(current.every(c=>c.sameCurrentANDRankRateAndRandom===true)&&
  prior.candidates.length===prior.denominators.sameOriginalCurrentANDCandidates,
  'damaged same-AND source cohort');
 let appStructure=null;
 if(chosen)appStructure=compareStructure(source.compile(chosen),e);
 // Even if the original registry skill is the same, a different Invoke or
 // precondition structure is NOT a matched evidence route.
 const exactMatches=appStructure==='same-source-route-logic-fingerprint'?
  current.filter(c=>c.invokeIndex===e.originalInvokeIndex&&
   c.conditionOrIndex===e.originalORIndex&&
   c.originalConditionANDSize===e.originalANDSize&&
   c.originalHistoricalPreconditionANDSize===0&&
   c.preconditionOrIndex===null):[];
 const exact=exactMatches.length===1?exactMatches[0]:null;
 fail(exactMatches.length<=1,'multiple purported original AND matches');
 const status=!chosen?'registered-source-skill-absent-from-application-cohort':
  appStructure!=='same-source-route-logic-fingerprint'?
  'application-matched-ID-has-different-original-structure':
  !exact?'same-skill-but-no-matching-ranked-random-source-route':
  'exact-original-source-AND-identity-linked-with-rank-unknown';
 const appCandidates=[...new Set(prior.candidates.map(c=>c.sourceNumericId))].sort(
  (a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const result={
  schemaVersion:1,status:STATUS,
  pinnedUmaSimRevision:MODEL_REVISION,
  pinnedSkillRegistryGitBlob:SOURCE_REGISTRY_BLOB,
  priorJvmObservationSource:{
   originalRegisteredSourceSkillId:e.observedRegisteredSkillId,
   sourceEvidenceRunUrl:e.sourceEvidenceRunUrl,
   sourceRaceCount:e.sourceRaceCount,
   sourcePhaseRandomCheckerCalls:e.originalPhaseRandomCheckerCalls,
   sourceModelSkillEvents:e.sourceModelEvents,
   originalSourceConditionsFingerprintAvailable:!!e.originalSourceConditionLogicSha256,
   notReobservedInThisFixedSourceAudit:true
  },
  cohort:{
   applicationSkills:model.skills.length,
   sourceMatchedApplicationSkills:prior.denominators.sourceMatchedSkills,
   originalRankAndRandomRoutes:prior.denominators.sameOriginalCurrentANDCandidates,
   distinctOriginalRankAndRandomSourceSkillIds:appCandidates.length,
   rankAndRandomKernelCount:prior.denominators.sharedMechanismKernelsWithSameAND
  },
  crossReference:{
   originalRegistrySkillFoundInAppSourceCohort:chosen!==null,
   originalRegistrySkillIn85SourceIdSet:appCandidates.includes(e.observedRegisteredSkillId),
   exactOriginalSourceStructureComparison:appStructure??'app-source-skill-not-present',
   exactInvokeORAndRouteMatches:exactMatches.length,
   status,
   linkedSourceRouteKey:exact?.sourceRouteKey??null,
   linkedFamilyId:exact?.familyId??null,
   linkedMechanismKernelId:exact?.mechanismKernelId??null,
   originalSourceANDPredicateCount:exact?.originalConditionANDSize??null,
   fullOriginalConditionLogicFingerprintMatched:!!exact,
   modelOnlyNineRunnerRankGate:exact?
    exact.supportedRankPanels.find(p=>p.fieldSize===9):null,
   modelOnlyTwelveRunnerRankGate:exact?
    exact.supportedRankPanels.find(p=>p.fieldSize===12):null,
   sourceRegisteredOriginalPhaseRandomWasActuallyObserved:true,
   originalSourceOrderRateEvaluatedAtAnyObservedTick:false,
   sameTickOriginalRankAndPhaseBothObserved:false,
   unobservedOriginalRankRemainsUnknown:true,
   originalFullANDActivationProven:false
  },
  nextCandidateSourceSkillIdsIfNoExactMatch:exact?
   []:appCandidates.filter(x=>x!==e.observedRegisteredSkillId).slice(0,12),
  noScoringBoundary:{
   sourceOriginalCompleteANDVerified:0,
   japaneseGameSkillProcProbabilities:0,
   formalSkillCardSuitabilityRatings:0,
   sourceRankPredicateMeasurements:0,
   sourceWindowObservationsCopiedToOtherSkills:0
  },
  limitations:[
   'The JVM source trace is a provenance snapshot from a separate successful run, NOT the same model evaluation as this fixed app cohort audit.',
   'Only the exact source skill ID and original Invoke/OR/AND structure may be linked. Matching mechanism TYPE alone is not sufficient.',
   'No original rank predicate was executed in pinned UmaSim; any model-only 9/12 rank truth table is NOT a real source same-tick rank observation.',
   'This join never copies a random window coordinate from the JVM trace into another skill, or declares an actual game proc or official suitability.'
  ]
 };
 fail(JSON.stringify(model)===start&&JSON.stringify(prior)===before,
  'original source app model or prior cohort mutated');
 return result;
}
/*
 * Unlike audit()'s deliberately separate historical 105401211 snapshot,
 * this variant runs AFTER a current pinned JVM test and a fixed app cohort
 * audit in the SAME Actions job. Validate the exact original registry bytes
 * by source sha256 and compare the complete logical fingerprint, not merely
 * the ID, operator TYPE, or AND size. The original skill record is used
 * read-only in memory and not returned.
 */
function auditSameRun(originalJvmTrace,appCohort,registryText){
 const jvm=require('./skill_p2_15_registered_source_race_trace.cjs');
 const verified=jvm.audit(originalJvmTrace);
 fail(appCohort?.status===rank.STATUS&&
  appCohort?.source?.revision===MODEL_REVISION&&
  appCohort?.denominators?.sameOriginalCurrentANDCandidates===85&&
  appCohort?.denominators?.distinctSourceSkillsWithSameAND===85&&
  appCohort?.denominators?.sharedMechanismKernelsWithSameAND===2&&
  typeof registryText==='string'&&registryText.length>100000,
  'same-job pinned app 85 route cohort and original registry required');
 const sha=createHash('sha256').update(registryText).digest('hex');
 fail(sha===appCohort.source.skillRegistrySha256,
  'app cohort and JVM registry bytes use different original source');
 const registry=JSON.parse(registryText);
 fail(Array.isArray(registry),'fixed source registry must be an array');
 const id=verified.observedRegisteredSkillId;
 const sourceSkills=registry.filter(x=>x?.id===id);
 fail(sourceSkills.length===1,'registered JVM skill missing/duplicated in source registry');
 const record=sourceSkills[0];
 const compiled=source.compile({
  status:'source-structure',sourceNumericId:id,
  // Kotlin @Serializable Invoke defaults missing preConditions and
  // conditions to empty lists. Preserve the source schema defaults before
  // comparing with the app's normalized full source conditions; never
  // synthesize or replace any existing original predicate values.
  invokes:record.invokes.map(inv=>({
   index:inv.index,conditions:inv.conditions??[],
   preConditions:inv.preConditions??[]
  }))
 });
 fail(logicSha256(compiled)===
  verified.preservedStructure.originalSourceConditionLogicSha256,
  'JVM original registered source conditions diverge from independent JS digest');
 const sameAnd=appCohort.candidates.filter(c=>c.sourceNumericId===id&&
  c.invokeIndex===verified.preservedStructure.originalInvokeIndex&&
  c.conditionOrIndex===verified.preservedStructure.originalSelectedORIndex&&
  c.originalConditionANDSize===
    verified.preservedStructure.originalSelectedANDPredicateCount&&
  c.preconditionOrIndex===null&&
  c.originalHistoricalPreconditionANDSize===0);
 fail(sameAnd.length===1,'registered source skill not a unique original app 85 current AND');
 const candidate=sameAnd[0];
 const inv=compiled.invokes.find(x=>x.invokeIndex===candidate.invokeIndex);
 fail(inv&&inv.conditions.length===
   verified.preservedStructure.originalCurrentConditionORCount&&
  inv.preConditions.length===
   verified.preservedStructure.originalPreconditionORCount&&
  inv.conditions[candidate.conditionOrIndex].some(x=>x.type==='order_rate')&&
  inv.conditions[candidate.conditionOrIndex].some(x=>
    x.type==='phase_random'&&x.operator==='=='&&x.value===2),
  'app cohort matching source AND changed or lost exact phase random value');
 // Reuse the existing three-valued ORIGINAL source-AND evaluator on actual
 // registered source-checker frames. Only phase_random was measured in the
 // original JVM. Rank and the other AND predicates remain UNKNOWN. This is
 // a per-branch necessary-condition bound, not a rank simulation.
 const selectedAND=inv.conditions[candidate.conditionOrIndex];
 const phaseTerms=selectedAND.filter(x=>x.type==='phase_random'&&
  x.operator==='=='&&x.value===2);
 fail(phaseTerms.length===1&&selectedAND.some(x=>x.type==='order_rate'),
  'source pilot needs one unambiguous phase window and ignored rank');
 // The third original predicate for the pinned representative is
 // distance_type. Unlike order_rate, pinned SkillChecker.kt implements it
 // directly from RaceSetting.trackDetail.distanceType. Read that exact
 // setting from EACH actual source JVM race, not from another simulator.
 const distanceTerms=selectedAND.filter(x=>x.type==='distance_type');
 fail(distanceTerms.length===1&&selectedAND.length===3,
  'registered source representative no longer has exactly one distance_type gate');
 const andStates={false:0,unknown:0,true:0},distanceTypes=[],staticGateTrue=[];
 let expectedFalse=0,expectedUnknown=0;
 for(const trial of originalJvmTrace.trials){
  const raceContext={distance_type:trial.sourceDistanceType};
  const distanceState=source.staticValue(raceContext,distanceTerms[0]);
  fail(distanceState!==source.UNKNOWN,
   'original source race distance type not measured');
  distanceTypes.push(trial.sourceDistanceType);
  staticGateTrue.push(distanceState===source.TRUE);
  for(const tick of trial.ticks){
   const facts=source.observationMap(compiled,[
    {...phaseTerms[0],satisfied:tick.phasePredicateHit}
   ]);
   const state=source.evalMatrix([selectedAND],raceContext,facts).status;
   andStates[state]++;
   if(!tick.phasePredicateHit||distanceState===source.FALSE)expectedFalse++;
   else expectedUnknown++;
  }
 }
 fail(andStates.false===expectedFalse&&
  andStates.unknown===expectedUnknown&&
  andStates.true===0,
  'original distance/phase gates falsely completed unobserved rank AND');
 fail(verified.counts.originalRegisteredSkillEquippedInThreeSourceRaces===3&&
  verified.counts.originalOrderRatePredicateEvaluatedInSource===0&&
  verified.counts.fullOriginalRankAndWindowANDProven===0&&
  verified.counts.officialP3P4Ratings===0,
  'real model skill rank condition falsely promoted');
 return {
  schemaVersion:1,
  status:'P2.15-JVM-original-registered-skill-exact-app-85-AND-linked-no-rank',
  provenance:{
   pinnedUmaSimRevision:MODEL_REVISION,
   pinnedSourceRegistryGitBlob:SOURCE_REGISTRY_BLOB,
   sourceRegistrySHA256:sha,
   sameActionsRunHasTwoIndependentParsers:true,
   currentPinnedJVMSourceModelRaceObserved:true,
   fullConditionsOriginalFingerprintMatched:true,
   originalSourceRegistryRedistributed:false
  },
  linked:{
   sourceNumericId:id,
   invokeIndex:candidate.invokeIndex,conditionOrIndex:candidate.conditionOrIndex,
   sourceRouteKey:candidate.sourceRouteKey,
   exactFamilyId:candidate.familyId,
   sharedMechanismKernelId:candidate.mechanismKernelId,
   originalANDCount:candidate.originalConditionANDSize,
   modelNineRunnerRankGate:candidate.supportedRankPanels.find(x=>x.fieldSize===9),
   modelTwelveRunnerRankGate:candidate.supportedRankPanels.find(x=>x.fieldSize===12)
  },
  observedModel:{
   originalRegisteredSourceRaces:3,
   phasePredicateSourceTickChecks:verified.counts.sourceOriginalPhaseRandomCheckerTicks,
   phasePredicateTrueSourceTickChecks:verified.counts.originalSourcePhasePredicateTrueCalls,
   phasePredicateFalseSourceTickChecks:verified.counts.originalSourcePhasePredicateFalseCalls,
   sourceModelSkillEvents:verified.counts.sourceModelSkillEvents,
   selectedOriginalANDPhaseOnly:{
    scope:'selected-current-condition-AND-with-original-race-distance-type',
    observedSourceCheckerTicks:verified.counts.sourceOriginalPhaseRandomCheckerTicks,
    sourceDistanceTypeByRace:distanceTypes,
    distanceTypeGateTrueByRace:staticGateTrue,
    falseEvenWithoutRank:andStates.false,
    unknownIncludingUnobservedRank:andStates.unknown,
    trueWithAllPredicatesObserved:andStates.true
   }
  },
  noScoringBoundary:{
   originalOrderRatePredicateSourceRuntimeObservations:0,
   sourceOriginalRankAndPhaseSameTickJointMeasurements:0,
   sourceAllOriginalANDConditionsVerified:0,
   sourceRankPositionIndependentFieldSizeObservations:0,
   japaneseGameSkillProcProbabilityMeasurements:0,
   approvedP3P4SuitabilityScores:0,
   otherSkillRuntimeDrawsCopied:0
  },
  limitations:[
   'The full original source Invoke logic digest and source ID now match a member of the audited 85 app source condition rows; this does not prove the game activates that skill.',
   'Original UmaSim ignores order_rate. We measured one skill random window in actual source RaceCalculator frames, NOT a same-tick observed rank and random conjunction.',
   'The 9/12-place projections are independent model-only rank geometry from a different evidence stream. We do not attach a model rank to any observed race frame.',
   'Source registered skill event counts are never interpreted as real-game proc rates or P3/P4 suitability.'
  ]
 };
}

module.exports={STATUS,EVIDENCE_STATUS,SNAPSHOT,logicSha256,compareStructure,validatedReference,audit,auditSameRun};
