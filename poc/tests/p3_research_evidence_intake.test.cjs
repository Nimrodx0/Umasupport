'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const p2=require('../src/p2_skill_evidence_contract.cjs');
const intake=require('../src/p3_research_evidence_intake.cjs');
const model=require('../tools/globalsim_roster32.cjs');
const pairs=require('../tools/skill_specificity32_research.cjs');
const seed=require('../tools/skill_distance_split15_reliability.cjs');

function fakeEnvelope(){
 const ids=manifest.profiles.filter(x=>x.distanceScope==='all');
 const rows=ids.flatMap(p=>pairs.PAIRS.map(([first,second])=>{
  const n=p2.expectedContexts(first,second).size;
  const missing=first==='Nige'||second==='Nige'?4:0;
  const w=()=>({contextComparisons:n,
   missingStyleScenarioHeadMode:missing,
   strictlyReversed:{original30Contexts:0,
    confirmedExactContextAndDirectionInBoth15:0},
   hypotheticalFivePointGapShift:{original30Contexts:0,
    confirmedExactContextAndDirectionInBoth15:0}});
  const main=w(),tokyo=p.surface==='turf'?w():null;
  return {
   kind:'original-source-partial-condition-style-comparison',
   subject:{
    originalSourceNumericId:p.sourceNumericId,
    sourceCondition:{timing:p.timing,bandId:p.bandId},
    fullSourceSkillTrigger:'not-verified',
    appCatalogMatch:'not-evaluated',
    supportCardAcquisition:'not-evaluated'
   },
   applicableRaceScope:{
    status:'race-filter-not-style-score',groundType:p.surface,
    sourceDistanceRestriction:'all',
    assessedDistanceClasses:['sprint','mile','middle','long'],
    outsideScope:'not-applicable-never-score-zero'
   },
   styleComparison:{
    first,second,missingRunner:'not-observed-never-zero',
    metric:'W-first-minus-second-partial-rank-window',
    W:{status:'fixed-model-partial-condition-only',
     allEligibleSameSurfaceCourses:main,sameVenueTokyoTurf:tokyo},
    D:{status:'not-measured-in-this-study',value:null},
    fullSkillActivationRate:{status:'not-measured',value:null},
    skillEffectUtility:{status:'not-measured',value:null}
   },
   contextInteraction:{
    status:'observed-but-distance-confounded-with-course-geometry',
    evidenceThreshold:'hypothetical-five-percentage-points-not-product-approved',
    signReversalIsOnlyCandidateWhenSameContextAndOrientationAcrossBoth15:true,
    first15AndLast15AreIndependentRealRaceSamples:false
   },
   promotionGate:{
    originalFullAND:'not-verified',
    originalORAndInvoke:'not-verified',
    temporalPreConditions:'not-verified',
    originalSkillEquippedAndProc:'not-verified',
    sourceToAppSkillJoin:'not-verified',
    cardSkillAcquisition:'not-verified',
    productSuitabilityDecision:'not-approved',
    eligibleForP3CardScoring:false,
    suitabilityLabel:null,cardScore:null
   }
  };
 }));
 function stats(sourceRows){
  const events=(name)=>({
   original30SourceConditionStylePairs:sourceRows.filter(x=>
    x.styleComparison.W.allEligibleSameSurfaceCourses[name].original30Contexts>0).length,
   confirmedInBoth15SourceConditionStylePairs:sourceRows.filter(x=>
    x.styleComparison.W.allEligibleSameSurfaceCourses[name]
     .confirmedExactContextAndDirectionInBoth15>0).length,
   original30ExactContextEvents:sourceRows.reduce((n,x)=>n+
    x.styleComparison.W.allEligibleSameSurfaceCourses[name].original30Contexts,0),
   confirmedInBoth15ExactContextEvents:sourceRows.reduce((n,x)=>n+
    x.styleComparison.W.allEligibleSameSurfaceCourses[name]
     .confirmedExactContextAndDirectionInBoth15,0)
  });
  const st=events('strictlyReversed'),sh=events('hypotheticalFivePointGapShift');
  const extend=x=>({...x,notConfirmedInBoth15ExactContextEvents:
   x.original30ExactContextEvents-x.confirmedInBoth15ExactContextEvents});
  return {sourceConditionStylePairs:sourceRows.length,
   comparedContextCells:sourceRows.reduce((n,x)=>n+
    x.styleComparison.W.allEligibleSameSurfaceCourses.contextComparisons,0),
   missingStyleContextCells:sourceRows.reduce((n,x)=>n+
    x.styleComparison.W.allEligibleSameSurfaceCourses.missingStyleScenarioHeadMode,0),
   strictReversal:extend(st),fivePointGapShift:extend(sh)};
 }
 const project=x=>{
  const rows=x.map(r=>structuredClone(r));
  for(const y of rows){
   y.styleComparison.W.allEligibleSameSurfaceCourses=
    y.styleComparison.W.sameVenueTokyoTurf;
  }
  return stats(rows);
 };
 return {
  schemaVersion:1,status:p2.STATUS,
  provenance:{
   originalSourceRegistrySha256:model.SOURCE_SHA,
   fixedModelRevision:model.PIN,
   fixedOriginal30ReportsSha256:structuredClone(pairs.PINNED),
   fixedSeedPartitions:['0..14','15..29'],
   sourceStudyStatus:seed.STATUS,
   evidenceStage:'original-source-partial-rank-time-window-observation',
   independentRealGameSamples:false
  },
  population:{
   sourceDistanceUnrestrictedSignatures:10,
   sourceDistanceRestrictedExcluded:22,
   sourceConditionStylePairRecords:60,
   matchedConditionComparisons:5040,
   sourceSkillAppCatalogMatchedRecords:0,
   verifiedWholeSkillActivationRecords:0,
   recordsEligibleForProductCardScoring:0
  },
  researchSummary:{
   allOriginalEligibleCourses:stats(rows),
   sameVenueTokyoTurf:project(rows.filter(x=>
    x.applicableRaceScope.groundType==='turf'))
  },
  records:rows,
  limitations:['synthetic research only']
 };
}
test('P3.1 accepts exactly 10 original-source conditions, six pairs each and zero graded cards',()=>{
 const envelope=fakeEnvelope(),original=JSON.stringify(envelope);
 assert.equal(p2.validateEnvelope(envelope),true);
 const received=intake.build(manifest,envelope);
 assert.equal(JSON.stringify(envelope),original,'input remains immutable');
 assert.equal(intake.validateReceipt(received,manifest,envelope),true);
 assert.equal(received.status,intake.STATUS);
 assert.deepEqual(received.population,{
  originalSourcePartialConditions:10,
  observedSourceConditionStylePairs:60,
  originalDistanceRestrictedConditionsExcluded:22,
  studiedDistanceContextComparisons:5040,
  verifiedCardSkillAcquisitionRoutes:0,
  verifiedWholeSkillProcRecords:0,
  acceptedProductSuitabilityScores:0
 });
 assert.equal(received.sourceConditionEvidence.length,10);
 assert(received.sourceConditionEvidence.every(x=>
  x.W.stylePairObservations.length===6&&
  x.W.stylePairObservations.every(p=>
   p.D===undefined&&p.score===null&&p.W===undefined)&&
  x.D.value===null&&x.originalFullSkillActivationRate.value===null&&
  x.productDecision.eligibleForP3CardScoring===false&&
  x.productDecision.cardScore===null&&x.productDecision.suitabilityLabel===null&&
  x.acquiredFromSupportCard.cardId===null&&
  x.currentAppCatalogJoin.appSkillId===null&&
  x.productDecision.blockers.length===8));
 assert(received.sourceConditionEvidence.filter(x=>
  x.raceApplicability.groundType==='turf').every(x=>
   x.W.stylePairObservations.every(y=>y.sameVenueTokyoTurf!==null)));
 assert(received.sourceConditionEvidence.filter(x=>
  x.raceApplicability.groundType==='dirt').every(x=>
   x.W.stylePairObservations.every(y=>y.sameVenueTokyoTurf===null)));
});
test('P3.1 lookup returns research-only evidence for exact original source ID and null for outside cohort',()=>{
 const env=fakeEnvelope(),receipt=intake.build(manifest,env);
 const original=manifest.profiles.find(x=>x.distanceScope==='all').sourceNumericId;
 const value=intake.readBySourceId(receipt,manifest,env,original);
 assert.equal(value.status,'research-only-not-graded');
 assert.equal(value.originalSourceNumericId,original);
 assert.equal(value.evidence.length,1);
 assert.equal(value.evidence[0].W.stylePairObservations.length,6);
 assert.equal(value.eligibleForP3CardScoring,false);
 value.evidence[0].productDecision.cardScore=999;
 assert.equal(receipt.sourceConditionEvidence.find(x=>
  x.originalSourceCondition.originalSourceNumericId===original)
  .productDecision.cardScore,null,'query result is detached clone');
 const outside=intake.readBySourceId(receipt,manifest,env,'99999999999');
 assert.deepEqual(outside,{status:'outside-studied-original-source-partial-condition-cohort',
  originalSourceNumericId:'99999999999',evidence:null,
  eligibleForP3CardScoring:false});
 for(const bad of ['skill:'+original,32,{cardId:original},null,'Nige'])
  assert.throws(()=>intake.readBySourceId(receipt,manifest,env,bad),
   /P3.1 quarantined intake/);
});
test('P3.1 rejects false catalog/card attribution, missing evidence and made-up W zero',()=>{
 const bad=[
  x=>{x.records[0].subject.appCatalogMatch='matched'},
  x=>{x.records[0].subject.supportCardAcquisition='available'},
  x=>{x.records[0].promotionGate.cardScore=0},
  x=>{x.records[0].promotionGate.eligibleForP3CardScoring=true},
  x=>{x.records[0].styleComparison.D.value=0},
  x=>{x.records[0].styleComparison.fullSkillActivationRate.value=0},
  x=>{x.records[0].applicableRaceScope.outsideScope='low-style-score'},
  x=>{x.records[0].subject.originalSourceNumericId='99999999999'},
  x=>{x.records[1]=structuredClone(x.records[0])},
  x=>{x.records.pop()},
  x=>{x.provenance.originalSourceRegistrySha256='wrong-version'},
  x=>{x.population.recordsEligibleForProductCardScoring=1},
  x=>{x.records[0].styleComparison.W.allEligibleSameSurfaceCourses.contextComparisons=0}
 ];
 for(const mutate of bad){
  const e=fakeEnvelope();mutate(e);
  assert.throws(()=>intake.build(manifest,e));
 }
});
test('P3.1 detects unauthorized modifications of output receipt and changed original evidence',()=>{
 const envelope=fakeEnvelope(),receipt=intake.build(manifest,envelope);
 for(const mutate of [
  r=>{r.population.acceptedProductSuitabilityScores=1},
  r=>{r.sourceConditionEvidence[0].productDecision.eligibleForP3CardScoring=true},
  r=>{r.sourceConditionEvidence[0].productDecision.cardScore=0},
  r=>{r.sourceConditionEvidence[0].originalSourceCondition.originalSourceNumericId='0'},
  r=>{r.sourceConditionEvidence[0].D.value=0},
  r=>{r.sourceConditionEvidence[0].W.stylePairObservations[0]
   .allEligibleSameSurfaceCourses.confirmedBoth15FivePointShifts=17},
  r=>{r.provenance.sourceEnvelopeSha256='different'},
  r=>{r.sourceConditionEvidence.pop()}
 ]){
  const testReceipt=structuredClone(receipt);mutate(testReceipt);
  assert.throws(()=>intake.validateReceipt(testReceipt,manifest,envelope),
   /P3.1 quarantined intake/);
 }
 const clonedEnvelope=structuredClone(envelope);
 clonedEnvelope.records[0].styleComparison.W.allEligibleSameSurfaceCourses
  .strictlyReversed.original30Contexts=2;
 assert.throws(()=>intake.validateReceipt(receipt,manifest,clonedEnvelope));
});
