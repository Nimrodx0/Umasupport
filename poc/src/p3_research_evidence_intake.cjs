'use strict';
/*
 * P3.1 quarantined intake for P2.18 research records.
 *
 * This is an offline research-index reader, NOT product card suitability.
 * Never equate a source skill ID with an app skill ID or a card skill route.
 */
const crypto=require('node:crypto');
const model=require('../tools/globalsim_roster32.cjs');
const pair=require('../tools/skill_specificity32_research.cjs');
const p2=require('./p2_skill_evidence_contract.cjs');
const STATUS='P3.1-quarantined-source-partial-research-not-card-suitability';
const DISTANCES=['sprint','mile','middle','long'];
const BLOCKERS=Object.freeze([
 'original-full-AND-OR-Invoke-not-verified',
 'temporal-preConditions-not-verified',
 'original-skill-proc-not-measured',
 'app-catalog-source-join-not-verified',
 'support-card-acquisition-not-verified',
 'D-specificity-not-measured-in-this-study',
 'suitability-classification-threshold-not-approved',
 'real-game-validity-not-verified'
]);
const fail=(condition,reason)=>{
 if(!condition)throw Error('P3.1 quarantined intake: '+reason);
};
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const signature=x=>[x.originalSourceNumericId,x.groundType,x.distanceScope,
 x.timing,x.bandId].join('|');
const pairIndex=(first,second)=>pair.PAIRS.findIndex(([a,b])=>
 a===first&&b===second);
function manifestSources(manifest){
 model.verifyManifest(manifest);
 const profiles=manifest.profiles.filter(p=>p.distanceScope==='all');
 fail(profiles.length===10,'original distance-unrestricted cohort drift');
 const byKey=new Map();
 for(const p of profiles){
  const key=signature({
   originalSourceNumericId:p.sourceNumericId,groundType:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId
  });
  fail(!byKey.has(key),'duplicate original source condition');
  byKey.set(key,p);
 }
 return byKey;
}
function summary(x){
 if(x===null)return null; // No Tokyo turf study for dirt, not zero.
 const output={
  contextComparisons:x.contextComparisons,
  missingStyleScenarioFieldMode:x.missingStyleScenarioHeadMode,
  original30StrictReversals:x.strictlyReversed.original30Contexts,
  confirmedBoth15StrictReversals:
   x.strictlyReversed.confirmedExactContextAndDirectionInBoth15,
  original30HypotheticalFivePointShifts:
   x.hypotheticalFivePointGapShift.original30Contexts,
  confirmedBoth15FivePointShifts:
   x.hypotheticalFivePointGapShift.confirmedExactContextAndDirectionInBoth15
 };
 fail(Object.values(output).every(Number.isSafeInteger),
  'untrusted/nonintegral W research counts');
 return output;
}
function build(manifest,envelope){
 const allowed=manifestSources(manifest);
 fail(p2.validateEnvelope(envelope)===true,
  'invalid SHA-pinned P2.18 envelope');
 fail(envelope.provenance?.evidenceStage===
  'original-source-partial-rank-time-window-observation'&&
  envelope.provenance.independentRealGameSamples===false&&
  envelope.population.recordsEligibleForProductCardScoring===0,
  'source research was promoted to product scoring');
 const group=new Map();
 for(const record of envelope.records){
  const id={
   originalSourceNumericId:record.subject.originalSourceNumericId,
   groundType:record.applicableRaceScope.groundType,
   distanceScope:record.applicableRaceScope.sourceDistanceRestriction,
   timing:record.subject.sourceCondition.timing,
   bandId:record.subject.sourceCondition.bandId
  },key=signature(id);
  fail(allowed.has(key),'unmatched original source condition '+key);
  fail(record.kind==='original-source-partial-condition-style-comparison'&&
   record.subject.appCatalogMatch==='not-evaluated'&&
   record.subject.supportCardAcquisition==='not-evaluated'&&
   record.subject.fullSourceSkillTrigger==='not-verified'&&
   record.applicableRaceScope.status==='race-filter-not-style-score'&&
   record.applicableRaceScope.outsideScope==='not-applicable-never-score-zero'&&
   JSON.stringify(record.applicableRaceScope.assessedDistanceClasses)===
    JSON.stringify(DISTANCES),
   'source, acquisition or race applicability boundary changed');
  const c=record.styleComparison,gate=record.promotionGate;
  fail(c.metric==='W-first-minus-second-partial-rank-window'&&
   c.W?.status==='fixed-model-partial-condition-only'&&
   c.D.status==='not-measured-in-this-study'&&c.D.value===null&&
   c.fullSkillActivationRate.status==='not-measured'&&
   c.fullSkillActivationRate.value===null&&
   c.skillEffectUtility.status==='not-measured'&&
   c.skillEffectUtility.value===null&&
   gate.eligibleForP3CardScoring===false&&
   gate.cardScore===null&&gate.suitabilityLabel===null&&
   gate.originalFullAND==='not-verified'&&
   gate.originalORAndInvoke==='not-verified'&&
   gate.temporalPreConditions==='not-verified'&&
   gate.cardSkillAcquisition==='not-verified',
   'unverified original condition or D/skill/card result was silently promoted');
  const index=pairIndex(c.first,c.second);
  fail(index>=0,'unknown source running-style pair');
  if(!group.has(key)){
   group.set(key,{
    originalSourceCondition:id,
    raceApplicability:{
     status:'race-filter-not-style-score',
     groundType:id.groundType,
     sourceDistanceRestriction:'all',
     outsideScope:'not-applicable-never-score-zero',
     studiedDistanceClasses:[...DISTANCES]
    },
    W:{status:'original-source-partial-condition-only',
     stylePairObservations:[]},
    D:{status:'not-measured-in-this-study',value:null},
    originalFullSkillActivationRate:{status:'not-measured',value:null},
    acquiredFromSupportCard:{status:'not-evaluated',cardId:null},
    currentAppCatalogJoin:{status:'not-evaluated',appSkillId:null},
    productDecision:{
     status:'quarantined-research-not-suitability',
     blockers:[...BLOCKERS],
     eligibleForP3CardScoring:false,
     cardScore:null,suitabilityLabel:null
    }
   });
  }
  const item=group.get(key);
  fail(!item.W.stylePairObservations.some(x=>x.first===c.first&&
   x.second===c.second),'duplicate original source running-style pair');
  item.W.stylePairObservations.push({
   first:c.first,second:c.second,
   metric:'W-first-minus-second-partial-rank-window',
   allEligibleSameSurfaceCourses:summary(c.W.allEligibleSameSurfaceCourses),
   sameVenueTokyoTurf:summary(c.W.sameVenueTokyoTurf),
   interpretation:'distance-and-course-context-associated-not-causal',
   classificationThreshold:'hypothetical-five-points-not-product-approved',
   score:null
  });
 }
 fail(group.size===10,'source skill cohort incomplete');
 const entries=[...group.entries()].sort(([a],[b])=>a.localeCompare(b))
  .map(([,item])=>{
   const arr=item.W.stylePairObservations;
   fail(arr.length===6,'missing original source style-pair observations');
   arr.sort((a,b)=>pairIndex(a.first,a.second)-
    pairIndex(b.first,b.second));
   fail(arr.every((x,i)=>x.first===pair.PAIRS[i][0]&&
    x.second===pair.PAIRS[i][1]),
   'source style-pair identities drift');
   return item;
  });
 const receipt={
  schemaVersion:1,status:STATUS,
  provenance:{
   sourceEnvelopeStatus:p2.STATUS,
   sourceEnvelopeSha256:sha(envelope),
   sourceModelRevision:envelope.provenance.fixedModelRevision,
   originalSourceRegistrySha256:envelope.provenance.originalSourceRegistrySha256,
   original30SeedReportsSha256:
    structuredClone(envelope.provenance.fixedOriginal30ReportsSha256),
   originalHalfSeedWindows:structuredClone(envelope.provenance.fixedSeedPartitions),
   independentRealGameSamples:false
  },
  population:{
   originalSourcePartialConditions:10,
   observedSourceConditionStylePairs:60,
   originalDistanceRestrictedConditionsExcluded:22,
   studiedDistanceContextComparisons:5040,
   verifiedCardSkillAcquisitionRoutes:0,
   verifiedWholeSkillProcRecords:0,
   acceptedProductSuitabilityScores:0
  },
  sourceConditionEvidence:entries,
  restrictions:{
   noCardSuitabilityScoring:true,
   noSourceToAppJoinWithoutSeparateEvidence:true,
   noSupportCardAcquisitionInference:true,
   noWAsSpecificityD:true,
   noUnknownOrAbsentAsZero:true,
   noOutsideScopeAsLowStyleSuitability:true,
   noCausalDistanceAttribution:true
  }
 };
 return receipt;
}
function validateReceipt(receipt,manifest,envelope){
 const expected=build(manifest,envelope);
 fail(JSON.stringify(receipt)===JSON.stringify(expected),
  'receipt is not identical to independently recompiled locked source evidence');
 return true;
}
function readBySourceId(receipt,manifest,envelope,originalSourceNumericId){
 validateReceipt(receipt,manifest,envelope);
 fail(typeof originalSourceNumericId==='string'&&
  /^\d+$/.test(originalSourceNumericId),
  'source numeric ID query required; app skill ID or card ID not accepted');
 const found=receipt.sourceConditionEvidence.filter(x=>
  x.originalSourceCondition.originalSourceNumericId===
   originalSourceNumericId);
 if(!found.length)return {
  status:'outside-studied-original-source-partial-condition-cohort',
  originalSourceNumericId,evidence:null,
  eligibleForP3CardScoring:false
 };
 return {status:'research-only-not-graded',
  originalSourceNumericId,evidence:structuredClone(found),
  eligibleForP3CardScoring:false};
}
module.exports={STATUS,BLOCKERS,manifestSources,build,validateReceipt,
 readBySourceId};
