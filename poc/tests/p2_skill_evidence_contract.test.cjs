'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('../data/p2_position_condition32_research.v1.json');
const model=require('../tools/globalsim_roster32.cjs');
const pair=require('../tools/skill_specificity32_research.cjs');
const research=require('../tools/skill_distance_split15_reliability.cjs');
const adapter=require('../src/p2_skill_evidence_contract.cjs');
function makeReport(){
 const profiles=manifest.profiles.filter(p=>p.distanceScope==='all');
 const sourceRows=profiles.flatMap(p=>pair.PAIRS.map(([first,second])=>{
  const valid=adapter.expectedContexts(first,second);
  const comparisons=[...valid].map((key,i)=>{
   const [scenario,head,mode,firstDistance,secondDistance]=key.split('|');
   const observed=first==='Nige'&&second==='Senkou'&&
    p.sourceNumericId===profiles[0].sourceNumericId&&i===0;
   const held=first==='Nige'&&second==='Senkou'&&
    p.sourceNumericId===profiles[0].sourceNumericId&&i===1;
   return {scenario,fieldSize:Number(head),mode,
    distanceClasses:[firstDistance,secondDistance],
    original30:{
     signReversalOrientation:observed?
      'first-style-at-first-distance_to_second-style-at-second-distance':
      null,
     gapShiftOrientation:observed||held?'positive':null
    },
    first15:{
     signReversalOrientation:observed?
      'first-style-at-first-distance_to_second-style-at-second-distance':
      null,
     gapShiftOrientation:observed?'positive':null
    },
    last15:{
     signReversalOrientation:observed?
      'first-style-at-first-distance_to_second-style-at-second-distance':
      null,
     gapShiftOrientation:observed||held?'positive':null
    },
    bothHalvesConfirmOriginal30SignReversal:observed,
    bothHalvesConfirmOriginal30FivePointGapShift:observed};
  });
  return {sourceNumericId:p.sourceNumericId,surface:p.surface,
   distanceScope:p.distanceScope,timing:p.timing,bandId:p.bandId,
   first,second,missingStyleContextCount:
    first==='Nige'||second==='Nige'?4:0,
   comparisons};
 }));
 const turf=sourceRows.filter(x=>x.surface==='turf');
 const summary=x=>{
  const out=adapter.observedStats(x);
  const reformat=z=>({
   original30SourcePairCount:z.original30SourceConditionStylePairs,
   bothHalvesConfirmedSourcePairCount:
    z.confirmedInBoth15SourceConditionStylePairs,
   original30EventContextCount:z.original30ExactContextEvents,
   sameContextAndOrientationConfirmedEventCount:
    z.confirmedInBoth15ExactContextEvents,
   original30OnlyEventContextCount:
    z.notConfirmedInBoth15ExactContextEvents
  });
  return {sourceConditionStylePairs:out.sourceConditionStylePairs,
   comparableEventContextCells:out.comparedContextCells,
   missingStyleRosterHeadModeContextCells:out.missingStyleContextCells,
   strictSignReversal:reformat(out.strictReversal),
   fivePointGapShift:reformat(out.fivePointGapShift)};
 };
 return {
  schemaVersion:1,status:research.STATUS,
  source:{modelRevision:model.PIN,
   umaSimSkillRegistrySha256:model.SOURCE_SHA,
   originalFull30ReportSha256:pair.PINNED},
  design:{originalSourceRankTimingSignatures:10,
   restrictedSourceDistanceProfilesExcluded:22,
   sampleHalfSeeds:['0..14','15..29'],
   noNewIndependentRealGameSamples:true,
   hypotheticalFivePercentagePointMarginNotProductApproved:true},
  summary:{allOriginalEligibleCourses:summary(sourceRows),
   sameVenueTokyoTurf:summary(turf)},
  rows:sourceRows,tokyoTurfRows:turf
 };
}
test('P2.18 preserves source applicability, W-only pairs, and all unverified product gates',()=>{
 const study=makeReport();
 const before=JSON.stringify(study);
 const out=adapter.compile(manifest,study);
 assert.equal(JSON.stringify(study),before);
 assert.equal(adapter.validateEnvelope(out),true);
 assert.equal(out.status,adapter.STATUS);
 assert.equal(out.population.sourceDistanceUnrestrictedSignatures,10);
 assert.equal(out.population.sourceDistanceRestrictedExcluded,22);
 assert.equal(out.population.sourceConditionStylePairRecords,60);
 assert.equal(out.population.matchedConditionComparisons,5040);
 assert.equal(out.population.sourceSkillAppCatalogMatchedRecords,0);
 assert.equal(out.population.verifiedWholeSkillActivationRecords,0);
 assert.equal(out.population.recordsEligibleForProductCardScoring,0);
 assert.equal(out.records.filter(x=>x.styleComparison.W.sameVenueTokyoTurf!==null).length,24);
 assert(out.records.every(x=>x.styleComparison.D.value===null&&
  x.styleComparison.fullSkillActivationRate.value===null&&
  x.promotionGate.cardScore===null&&
  x.promotionGate.suitabilityLabel===null&&
  x.promotionGate.eligibleForP3CardScoring===false&&
  x.subject.appCatalogMatch==='not-evaluated'&&
  x.subject.supportCardAcquisition==='not-evaluated'&&
  x.applicableRaceScope.outsideScope==='not-applicable-never-score-zero'));
 assert.equal(out.researchSummary.allOriginalEligibleCourses.strictReversal.original30ExactContextEvents,1);
 assert.equal(out.researchSummary.allOriginalEligibleCourses.strictReversal.confirmedInBoth15ExactContextEvents,1);
 assert.equal(out.researchSummary.allOriginalEligibleCourses.fivePointGapShift.original30ExactContextEvents,2);
 assert.equal(out.researchSummary.allOriginalEligibleCourses.fivePointGapShift.confirmedInBoth15ExactContextEvents,1);
});
test('source fullAND/OR/Invoke, card score and unobserved D cannot be silently promoted',()=>{
 const out=adapter.compile(manifest,makeReport());
 for(const mutate of [
  x=>{x.records[0].promotionGate.eligibleForP3CardScoring=true},
  x=>{x.records[0].promotionGate.cardScore=0},
  x=>{x.records[0].promotionGate.suitabilityLabel='high'},
  x=>{x.records[0].styleComparison.D.value=0},
  x=>{x.records[0].styleComparison.fullSkillActivationRate.value=0},
  x=>{x.records[0].subject.appCatalogMatch='matched'},
  x=>{x.records[0].subject.supportCardAcquisition='present'},
  x=>{x.records[0].applicableRaceScope.outsideScope='zero-score'},
  x=>{x.records[0].styleComparison.missingRunner='zero'},
  x=>{x.provenance.originalSourceRegistrySha256='not fixed source'},
  x=>{x.population.recordsEligibleForProductCardScoring=1}
 ]){
  const bad=structuredClone(out);
  mutate(bad);
  assert.throws(()=>adapter.validateEnvelope(bad),
   /P2.18 transport rejects/);
 }
});
test('tampered source comparison, missing or duplicate contexts and false seed confirmation fail closed',()=>{
 for(const mutate of [
  x=>{x.source.originalFull30ReportSha256.balanced='modified'},
  x=>{x.design.sampleHalfSeeds=['0..29','0..29']},
  x=>{x.rows[0].sourceNumericId='not-a-source-ID'},
  x=>{x.rows[0].comparisons[0].original30.signReversalOrientation=null},
  x=>{x.rows[0].comparisons.pop()},
  x=>{x.rows[0].comparisons[1]=structuredClone(x.rows[0].comparisons[0])},
  x=>{x.rows[0].missingStyleContextCount=0},
  x=>{x.summary.allOriginalEligibleCourses.strictSignReversal.original30EventContextCount=77},
  x=>{x.tokyoTurfRows[0].surface='dirt'},
  x=>{x.rows[0].comparisons[0].bothHalvesConfirmOriginal30FivePointGapShift=false}
 ]){
  const x=makeReport();
  mutate(x);
  assert.throws(()=>adapter.compile(manifest,x),
   /P2.18 transport rejects/);
 }
});
test('strict original context coverage and noFront style absence are not inferred from another roster',()=>{
 const report=makeReport();
 const r=report.rows.find(r=>r.first==='Nige');
 assert.equal(r.missingStyleContextCount,4);
 assert.equal(r.comparisons.length,72);
 assert(r.comparisons.every(x=>x.scenario!=='noFront'));
 const other=report.rows.find(r=>r.first==='Senkou'&&r.second==='Sasi');
 assert.equal(other.missingStyleContextCount,0);
 assert.equal(other.comparisons.length,96);
 assert(other.comparisons.some(x=>x.scenario==='noFront'));
 const output=adapter.compile(manifest,report);
 const found=output.records.find(x=>x.styleComparison.first==='Nige');
 assert.equal(found.styleComparison.W.allEligibleSameSurfaceCourses.missingStyleScenarioHeadMode,4);
});
