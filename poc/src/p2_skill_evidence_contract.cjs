'use strict';
/*
 * P2.18 research-only evidence transport contract.
 *
 * This adapter intentionally exports only partial source-condition × style-pair
 * W research. It cannot grant a skill suitability verdict, activation rate or
 * support-card acquisition. Source presence and card acquisition are different.
 *
 * Future P3 support-card code must never consider this envelope a product
 * rating input without an additional, explicitly approved promotion gate.
 */
const model=require('../tools/globalsim_roster32.cjs');
const pair=require('../tools/skill_specificity32_research.cjs');
const prior=require('../tools/skill_distance_split15_reliability.cjs');
const STATUS='P2.18-original-partial-condition-research-transport-not-P3-suitability';
const NO='not-assessed';
const DISTANCES=['sprint','mile','middle','long'];
const REVERSALS=[
 'first-style-at-first-distance_to_second-style-at-second-distance',
 'second-style-at-first-distance_to_first-style-at-second-distance'];
const SHIFTS=['positive','negative'];
const PROPS=['sourceNumericId','surface','distanceScope','timing','bandId'];
const sourceKey=x=>PROPS.map(k=>String(x[k])).join('|');
const pairKey=x=>[sourceKey(x),x.first,x.second].join('|');
const compareKey=x=>[
 x.scenario,x.fieldSize,x.mode,...x.distanceClasses].join('|');
function invariant(ok,message){
 if(!ok)throw Error('P2.18 transport rejects '+message);
}
function expectedContexts(first,second){
 const out=new Set();
 const hasNige=first==='Nige'||second==='Nige';
 for(const scenario of model.SCENARIOS){
  if(hasNige&&scenario==='noFront')continue;
  for(const fieldSize of [9,12])for(const mode of model.MODES)
   for(let i=0;i<DISTANCES.length;i++)
    for(let j=i+1;j<DISTANCES.length;j++)
     out.add([scenario,fieldSize,mode,
      DISTANCES[i],DISTANCES[j]].join('|'));
 }
 return out;
}
function isOrientation(value,options){
 return value===null||options.includes(value);
}
function validateComparison(c){
 invariant(c&&model.SCENARIOS.includes(c.scenario)&&
  [9,12].includes(c.fieldSize)&&model.MODES.includes(c.mode)&&
  Array.isArray(c.distanceClasses)&&c.distanceClasses.length===2&&
  DISTANCES.indexOf(c.distanceClasses[0])>=0&&
  DISTANCES.indexOf(c.distanceClasses[0])<
   DISTANCES.indexOf(c.distanceClasses[1]),
  'unrecognized original distance/roster/ability comparison');
 const get=k=>c[k],o=get('original30'),a=get('first15'),b=get('last15');
 invariant([o,a,b].every(v=>v&&
  isOrientation(v.signReversalOrientation,REVERSALS)&&
  isOrientation(v.gapShiftOrientation,SHIFTS))&&
  typeof c.bothHalvesConfirmOriginal30SignReversal==='boolean'&&
  typeof c.bothHalvesConfirmOriginal30FivePointGapShift==='boolean',
  'missing 30/15/15 signs or unknown comparison status');
 invariant(c.bothHalvesConfirmOriginal30SignReversal===
  (o.signReversalOrientation!==null&&
   o.signReversalOrientation===a.signReversalOrientation&&
   o.signReversalOrientation===b.signReversalOrientation)&&
  c.bothHalvesConfirmOriginal30FivePointGapShift===
   (o.gapShiftOrientation!==null&&
    o.gapShiftOrientation===a.gapShiftOrientation&&
    o.gapShiftOrientation===b.gapShiftOrientation),
  'split confirmation that does not match original orientation');
 // Passing BOTH individual 15-seed halves in the same orientation while
 // the original pooled 30-seed does not pass is mathematically inconsistent
 // with a conservative first-minus-second source aggregate.
 for(const key of ['signReversalOrientation','gapShiftOrientation'])
  invariant(!(o[key]===null&&a[key]!==null&&a[key]===b[key]),
   'both halves pass but source30 event is absent');
}
function validateRow(row,profile){
 invariant(row&&profile&&PROPS.every(k=>row[k]===profile[k])&&
  pair.PAIRS.some(([a,b])=>row.first===a&&row.second===b)&&
  row.distanceScope==='all'&&
  Array.isArray(row.comparisons)&&
  Number.isSafeInteger(row.missingStyleContextCount),
  'unknown source condition/style row');
 const valid=expectedContexts(row.first,row.second);
 invariant(row.comparisons.length===valid.size&&
  row.missingStyleContextCount===
    (row.first==='Nige'||row.second==='Nige'?4:0),
  'missing style/roster or source comparison contexts');
 const unique=new Set();
 for(const item of row.comparisons){
  validateComparison(item);
  const k=compareKey(item);
  invariant(valid.has(k)&&!unique.has(k),
   'duplicated or missing original source context '+k);
  unique.add(k);
 }
}
function observedStats(rows){
 const cells=rows.flatMap(r=>r.comparisons);
 const event=(orig,confirmed)=>{
  const positive=cells.filter(x=>x.original30[orig]!==null);
  const both=positive.filter(x=>x[confirmed]);
  return {
   original30SourceConditionStylePairs:rows.filter(r=>
    r.comparisons.some(x=>x.original30[orig]!==null)).length,
   confirmedInBoth15SourceConditionStylePairs:rows.filter(r=>
    r.comparisons.some(x=>x[confirmed])).length,
   original30ExactContextEvents:positive.length,
   confirmedInBoth15ExactContextEvents:both.length,
   notConfirmedInBoth15ExactContextEvents:positive.length-both.length
  };
 };
 return {sourceConditionStylePairs:rows.length,
  comparedContextCells:cells.length,
  missingStyleContextCells:rows.reduce((a,r)=>
   a+r.missingStyleContextCount,0),
  strictReversal:event('signReversalOrientation',
   'bothHalvesConfirmOriginal30SignReversal'),
  fivePointGapShift:event('gapShiftOrientation',
   'bothHalvesConfirmOriginal30FivePointGapShift')};
}
function crosscheckStats(actual,ref){
 invariant(actual.sourceConditionStylePairs===ref.sourceConditionStylePairs&&
  actual.comparedContextCells===ref.comparableEventContextCells&&
  actual.missingStyleContextCells===
   ref.missingStyleRosterHeadModeContextCells,
  'original cohort or missing-style denominators');
 for(const [key,r] of [
  ['strictReversal',ref.strictSignReversal],
  ['fivePointGapShift',ref.fivePointGapShift]]){
  const x=actual[key];
  invariant(x.original30SourceConditionStylePairs===
    r.original30SourcePairCount&&
   x.confirmedInBoth15SourceConditionStylePairs===
    r.bothHalvesConfirmedSourcePairCount&&
   x.original30ExactContextEvents===r.original30EventContextCount&&
   x.confirmedInBoth15ExactContextEvents===
    r.sameContextAndOrientationConfirmedEventCount&&
   x.notConfirmedInBoth15ExactContextEvents===
    r.original30OnlyEventContextCount,
   'reported pair-vs-context split evidence '+key);
 }
}
function validateOriginal(manifest,report){
 model.verifyManifest(manifest);
 invariant(report?.schemaVersion===1&&report.status===prior.STATUS&&
  report.source?.modelRevision===model.PIN&&
  report.source?.umaSimSkillRegistrySha256===model.SOURCE_SHA&&
  JSON.stringify(report.source?.originalFull30ReportSha256)===
   JSON.stringify(pair.PINNED)&&
  report.design?.originalSourceRankTimingSignatures===10&&
  report.design?.restrictedSourceDistanceProfilesExcluded===22&&
  JSON.stringify(report.design?.sampleHalfSeeds)===
   JSON.stringify(['0..14','15..29'])&&
  report.design?.noNewIndependentRealGameSamples===true&&
  report.design?.hypotheticalFivePercentagePointMarginNotProductApproved===true,
  'source provenance or permitted study scope');
 const original=manifest.profiles.filter(p=>p.distanceScope==='all');
 invariant(original.length===10,'distance-restricted source profile used');
 const profiles=new Map(original.map(p=>[sourceKey(p),p]));
 invariant(profiles.size===10,'duplicate source profile');
 const all=report.rows,tokyo=report.tokyoTurfRows;
 invariant(Array.isArray(all)&&all.length===60&&
  Array.isArray(tokyo)&&tokyo.length===24&&
  report.summary?.allOriginalEligibleCourses&&
  report.summary?.sameVenueTokyoTurf,'missing 60/24 source observations');
 const expected=new Set(original.flatMap(p=>pair.PAIRS.map(([first,second])=>
  [sourceKey(p),first,second].join('|'))));
 const seen=new Set();
 for(const row of all){
  const key=pairKey(row);
  invariant(expected.has(key)&&!seen.has(key),
   'duplicated/unrelated source comparison');
  validateRow(row,profiles.get(sourceKey(row)));
  seen.add(key);
 }
 invariant(seen.size===expected.size,'not all original 10×6 source pairs');
 const tokyoIds=new Set();
 for(const row of tokyo){
  const key=pairKey(row);
  invariant(row.surface==='turf'&&seen.has(key)&&!tokyoIds.has(key),
   'non-Tokyo/duplicate source sensitivity');
  validateRow(row,profiles.get(sourceKey(row)));
  tokyoIds.add(key);
 }
 invariant(tokyoIds.size===24,'incomplete same-venue turf cohort');
 const overall=observedStats(all),venue=observedStats(tokyo);
 crosscheckStats(overall,report.summary.allOriginalEligibleCourses);
 crosscheckStats(venue,report.summary.sameVenueTokyoTurf);
 return {overall,venue};
}
function events(row){
 const arr=row.comparisons;
 const count=(field,yes)=>arr.filter(c=>yes(c[field])).length;
 return {
  contextComparisons:arr.length,
  missingStyleScenarioHeadMode:row.missingStyleContextCount,
  strictlyReversed:{
   original30Contexts:count('original30',c=>c.signReversalOrientation!==null),
   confirmedExactContextAndDirectionInBoth15:
    count('bothHalvesConfirmOriginal30SignReversal',Boolean)
  },
  hypotheticalFivePointGapShift:{
   original30Contexts:count('original30',c=>c.gapShiftOrientation!==null),
   confirmedExactContextAndDirectionInBoth15:
    count('bothHalvesConfirmOriginal30FivePointGapShift',Boolean)
  }
 };
}
function record(row,tokyo){
 return {
  kind:'original-source-partial-condition-style-comparison',
  subject:{
   originalSourceNumericId:row.sourceNumericId,
   sourceCondition:{timing:row.timing,bandId:row.bandId},
   fullSourceSkillTrigger:'not-verified',
   appCatalogMatch:'not-evaluated',
   supportCardAcquisition:'not-evaluated'
  },
  applicableRaceScope:{
   status:'race-filter-not-style-score',
   groundType:row.surface,
   sourceDistanceRestriction:'all',
   assessedDistanceClasses:DISTANCES,
   outsideScope:'not-applicable-never-score-zero'
  },
  styleComparison:{
   first:row.first,second:row.second,
   missingRunner:'not-observed-never-zero',
   metric:'W-first-minus-second-partial-rank-window',
   W: {status:'fixed-model-partial-condition-only',
    allEligibleSameSurfaceCourses:events(row),
    sameVenueTokyoTurf:tokyo?events(tokyo):null},
   D: {status:'not-measured-in-this-study',value:null},
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
   suitabilityLabel:null,
   cardScore:null
  }
 };
}
function compile(manifest,study){
 const validated=validateOriginal(manifest,study);
 const venueMap=new Map(study.tokyoTurfRows.map(r=>[pairKey(r),r]));
 const records=study.rows.map(r=>record(r,venueMap.get(pairKey(r))));
 const out={
  schemaVersion:1,status:STATUS,
  provenance:{
   originalSourceRegistrySha256:study.source.umaSimSkillRegistrySha256,
   fixedModelRevision:study.source.modelRevision,
   fixedOriginal30ReportsSha256:study.source.originalFull30ReportSha256,
   fixedSeedPartitions:['0..14','15..29'],
   sourceStudyStatus:study.status,
   evidenceStage:'original-source-partial-rank-time-window-observation',
   independentRealGameSamples:false
  },
  population:{
   sourceDistanceUnrestrictedSignatures:10,
   sourceDistanceRestrictedExcluded:22,
   sourceConditionStylePairRecords:records.length,
   matchedConditionComparisons:validated.overall.comparedContextCells,
   sourceSkillAppCatalogMatchedRecords:0,
   verifiedWholeSkillActivationRecords:0,
   recordsEligibleForProductCardScoring:0
  },
  researchSummary:{
   allOriginalEligibleCourses:validated.overall,
   sameVenueTokyoTurf:validated.venue
  },
  records,
  limitations:[
   'Every record is a source partial rank/time W style-pair observation. It does not establish the original skill AND/OR/invoke/precondition trigger, acquisition path, proc probability, or actual skill benefit.',
   'The existence of an original source condition ID does not prove the skill is in the app catalog nor obtainable from any support card.',
   'Applicability is a race filter; outside-scope outcomes and absent running styles are not zero suitability scores.',
   'W and D=O−U are distinct: this P2.17b evidence has W only; D is genuinely unmeasured in these exported records.',
   'Sign reversal is not confirmed in both halves for this pinned study. Magnitude evidence is course-and-distance associated, not a causal distance_type effect.',
   'No P3 rating, support-card suitability label or numeric score can be inferred from this unqualified contract.'
  ]
 };
 validateEnvelope(out);
 return out;
}
function validateEnvelope(out){
 invariant(out?.schemaVersion===1&&out.status===STATUS&&
  out.provenance?.originalSourceRegistrySha256===model.SOURCE_SHA&&
  out.provenance?.fixedModelRevision===model.PIN&&
  JSON.stringify(out.provenance.fixedOriginal30ReportsSha256)===
   JSON.stringify(pair.PINNED)&&
  out.provenance.independentRealGameSamples===false&&
  Array.isArray(out.records)&&out.records.length===60&&
  out.population?.sourceConditionStylePairRecords===60&&
  out.population?.sourceSkillAppCatalogMatchedRecords===0&&
  out.population?.verifiedWholeSkillActivationRecords===0&&
  out.population?.recordsEligibleForProductCardScoring===0,
  'unapproved research envelope provenance or product population');
 const ids=new Set();
 for(const e of out.records){
  const subj=e.subject,scope=e.applicableRaceScope,
   style=e.styleComparison,gate=e.promotionGate;
  const id=[subj?.originalSourceNumericId,
   scope?.groundType,subj?.sourceCondition?.timing,
   subj?.sourceCondition?.bandId,
   style?.first,style?.second].join('|');
  invariant(!ids.has(id)&&/^\d+$/.test(subj?.originalSourceNumericId)&&
   pair.PAIRS.some(([a,b])=>a===style.first&&b===style.second),
   'duplicate/unknown source partial condition style record');
  ids.add(id);
  invariant(subj.fullSourceSkillTrigger==='not-verified'&&
   subj.appCatalogMatch==='not-evaluated'&&
   subj.supportCardAcquisition==='not-evaluated'&&
   scope.status==='race-filter-not-style-score'&&
   ['turf','dirt'].includes(scope.groundType)&&
   scope.sourceDistanceRestriction==='all'&&
   JSON.stringify(scope.assessedDistanceClasses)===
    JSON.stringify(DISTANCES)&&
   scope.outsideScope==='not-applicable-never-score-zero'&&
   style.missingRunner==='not-observed-never-zero'&&
   style.metric==='W-first-minus-second-partial-rank-window'&&
   style.W?.status==='fixed-model-partial-condition-only'&&
   style.D?.status==='not-measured-in-this-study'&&
   style.D.value===null&&
   style.fullSkillActivationRate?.status==='not-measured'&&
   style.fullSkillActivationRate.value===null&&
   style.skillEffectUtility?.status==='not-measured'&&
   style.skillEffectUtility.value===null,
   'missing data converted to zero or partial W promoted');
  for(const cohort of ['allEligibleSameSurfaceCourses',
   'sameVenueTokyoTurf']){
   const v=style.W[cohort];
   invariant(cohort==='sameVenueTokyoTurf'&&scope.groundType==='dirt'?
     v===null:!!v&&Number.isSafeInteger(v.contextComparisons)&&
     v.contextComparisons>0&&
     [v.strictlyReversed,v.hypotheticalFivePointGapShift].every(a=>
      Number.isSafeInteger(a?.original30Contexts)&&
      Number.isSafeInteger(a.confirmedExactContextAndDirectionInBoth15)&&
      a.original30Contexts>=a.confirmedExactContextAndDirectionInBoth15),
    'missing/nonexistent venue evidence substituted');
  }
  invariant(e.contextInteraction?.status===
   'observed-but-distance-confounded-with-course-geometry'&&
   e.contextInteraction.signReversalIsOnlyCandidateWhenSameContextAndOrientationAcrossBoth15===true&&
   e.contextInteraction.first15AndLast15AreIndependentRealRaceSamples===false&&
   gate&&gate.originalFullAND==='not-verified'&&
   gate.originalORAndInvoke==='not-verified'&&
   gate.temporalPreConditions==='not-verified'&&
   gate.originalSkillEquippedAndProc==='not-verified'&&
   gate.sourceToAppSkillJoin==='not-verified'&&
   gate.cardSkillAcquisition==='not-verified'&&
   gate.productSuitabilityDecision==='not-approved'&&
   gate.eligibleForP3CardScoring===false&&
   gate.suitabilityLabel===null&&gate.cardScore===null,
   'unapproved full skill/card suitability promotion');
 }
 invariant(ids.size===60,'incomplete partial-condition transport');
 return true;
}
module.exports={STATUS,sourceKey,pairKey,expectedContexts,
 validateComparison,validateOriginal,validateEnvelope,observedStats,
 compile};
