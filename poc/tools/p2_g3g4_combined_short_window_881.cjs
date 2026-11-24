#!/usr/bin/env node
'use strict';
/*
 * P2.41 G3/G4: combine source-ID verified P2.34 (69/6 of direct 75)
 * and P2.36 (12 original exception skills, 22 independent SOURCE BRANCHES,
 * not independent trial samples) into a single fixed 881-skill decision ledger.
 * Do not modify either upstream source, assume a real game activation rate,
 * merge disjoint distance OR branches, or produce any P3/P4 skill/card score.
 */
const fs=require('node:fs');
const original=require('./p2_g3g4_skill_window_decisions.cjs');
const exception=require('./skill_p2_36_remaining_wd.cjs');
const p228=require('./skill_halfphase_two_axis_review.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const modelPin=require('./globalsim_position_pilot.cjs').PIN;
const DISTANCE_OF_GROUP={sprint:1,mile:2,'mile-alternate-track':2,
 middle:3,'middle-alternate-track':3,long:4};
const STATUS='P2.41-G3G4-source-ID-joined-881-skill-partial-W-D-evidence-not-suitability';
const STYLES=original.STYLES;
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.41 G3/G4 join: '+msg)};
const pairsExpected=new Set(STYLES.flatMap((s,i)=>
 STYLES.slice(i+1).map(t=>s+'|'+t)));
const metricRange=(x,label,{negative=false}={})=>{
 fail(x&&Number.isFinite(x.min)&&Number.isFinite(x.max)&&
  x.min<=x.max&&x.max<=100&&(negative?x.min>=-100:x.min>=0),
  'invalid '+label+' model range');
 return {min:x.min,max:x.max};
};
function branchView(branch){
 fail([1,3,4].includes(branch?.distanceType)&&
  typeof branch.windowKey==='string'&&branch.windowKey.length>0&&
  typeof branch.bandId==='string'&&branch.bandId.length>0&&
  Array.isArray(branch.modelCourses)&&branch.modelCourses.length>0&&
  new Set(branch.modelCourses).size===branch.modelCourses.length&&
  branch.modelCourses.every(Number.isSafeInteger)&&
  branch.modelOnly===true&&branch.productSkillScore===null,
  'source branch eligibility or model-only boundary');
 const expectedCourses=expanded.COURSES.filter(c=>
  DISTANCE_OF_GROUP[c.group]===branch.distanceType).map(c=>c.id);
 fail(expectedCourses.length>0&&
  JSON.stringify(branch.modelCourses)===JSON.stringify(expectedCourses),
  'original distance scope or fixed model courses changed');
 fail([
  'original-absolute-and-relative-rank-intersection',
  'original-mutually-exclusive-distance-OR-branch'
 ].includes(branch.sourceConditionInterpretation),
 'unsupported source AND/OR interpretation');
 const narrow=branch.sourceConditionInterpretation===
  'original-absolute-and-relative-rank-intersection';
 fail((narrow&&branch.distanceType===1)||
  (!narrow&&[3,4].includes(branch.distanceType)),
 'narrow rank or distance-OR branch reused outside original eligible distance');
 fail(branch.styles&&Object.keys(branch.styles).length===STYLES.length&&
  STYLES.every(s=>Object.hasOwn(branch.styles,s)),
 'missing model style');
 const styles={};
 for(const style of STYLES){
  const m=branch.styles[style];
  fail(Number.isSafeInteger(m?.contexts)&&m.contexts>0,
   'missing source branch context count');
  styles[style]={
   contextCount:m.contexts,
   WPercent:metricRange(m.WPercent,'W'),
   OPercent:metricRange(m.OPercent,'O'),
   DPoints:metricRange(m.DPoints,'D',{negative:true}),
   DDirection:original.projectedDirection(m.DDirection)
  };
 }
 fail(Array.isArray(branch.pairs)&&branch.pairs.length===pairsExpected.size,
  'incomplete branch comparisons');
 const seen=new Set(),pairs=branch.pairs.map(p=>{
  const key=p.first+'|'+p.second;
  fail(pairsExpected.has(key)&&!seen.has(key),'invalid/duplicate model style pair');
  seen.add(key);
  return {first:p.first,second:p.second,
   WDirection:original.projectedDirection(p.modelWDirection),
   DDirection:original.projectedDirection(p.modelDDirection),
   status:'fixed-model-partial-rank-window-evidence-only'};
 });
 fail(seen.size===pairsExpected.size,'incomplete model style pairs');
 return {sourceDistanceType:branch.distanceType,
  sourceWindow:branch.windowKey,sourceRankBand:branch.bandId,
  sourceConditionInterpretation:branch.sourceConditionInterpretation,
  scope:{modelCourseIds:[...branch.modelCourses],
   modelSource:'same-fixed-720-skill-free-balanced-turf-races',
   fixedDistanceScopeOnly:true,otherOriginalANDUnchecked:true},
  styles,pairs};
}
function join(earlier,remaining){
 fail(earlier?.schemaVersion===1&&earlier.status===original.STATUS&&
  Array.isArray(earlier.rows)&&
  earlier.source?.originalModelRaces===720&&
  earlier.source?.sourceUmaSimSHA256===SOURCE_SHA&&
  earlier.summary?.appSkills===earlier.rows.length&&
  earlier.summary?.sourceMatched>=0&&
  earlier.summary?.shortWindowSourceCandidates===
   earlier.summary?.conditionalModelEvidenceSkills+
   earlier.summary?.heldGroundQualifierSkills&&
  earlier.summary?.otherSkillsWithoutNewShortWindowEvidence===
   earlier.rows.length-earlier.summary.shortWindowSourceCandidates&&
  earlier.summary?.productSkillSuitabilityScores===0,
  'P2.34 fixed source and decision cohort not verified');
 fail(remaining?.schemaVersion===1&&remaining.status===exception.STATUS&&
  remaining.source?.fixedOriginalSkillSHA256===SOURCE_SHA&&
  remaining.source?.original720RaceModelRevision===modelPin&&
  remaining.source?.originalShortReportSHA256===p228.SHORT_SHA&&
  remaining.summary?.originalExceptionSkills===remaining.rows?.length&&
  remaining.summary?.distanceORSpecialists+
   remaining.summary?.narrowedRankSkills===remaining.rows.length&&
  remaining.summary?.eligibleForP3CardScores===0,
  'P2.36 original W/D exception cohort not verified');
 const bySkill=new Map();
 let modeled=0,held=0,unchanged=0;
 for(const row of earlier.rows){
  fail(row&&typeof row.skillId==='string'&&
   typeof row.skillName==='string'&&!bySkill.has(row.skillId)&&
   row.cardScore===null&&row.eligibleForP3CardScoring===false&&
   row.wholeSkillSuitability==='not-established',
   'duplicate app identity or prior P3 scoring');
  fail(['conditionally-use-short-window-rank-evidence',
   'hold-turf-model-transfer','no-new-short-window-evidence'].includes(row.decision),
   'unexpected prior P2.34 decision');
  if(row.decision==='conditionally-use-short-window-rank-evidence')modeled++;
  else if(row.decision==='hold-turf-model-transfer')held++;
  else unchanged++;
  bySkill.set(row.skillId,row);
 }
 fail(modeled===earlier.summary.conditionalModelEvidenceSkills&&
  held===earlier.summary.heldGroundQualifierSkills&&
  unchanged===earlier.summary.otherSkillsWithoutNewShortWindowEvidence,
  'P2.34 classification changed');
 const projected=new Map(),seenSource=new Set();
 let distance=0,narrow=0,branches=0,pairRows=0,stableW=0,heldW=0,stableD=0;
 for(const row of remaining.rows){
  fail(row&&typeof row.skillId==='string'&&typeof row.sourceNumericId==='string'&&
   !projected.has(row.skillId)&&!seenSource.has(row.sourceNumericId)&&
   row.wholeSkillSuitability==='not-established'&&row.productSkillScore===null&&
   row.studyUse==='conditional-partial-rank-window-model-W-and-D-only',
   'duplicate exception identity or scoring');
  seenSource.add(row.sourceNumericId);
  const base=bySkill.get(row.skillId);
  fail(base&&base.sourceNumericId===row.sourceNumericId&&
   base.skillName===row.skillName&&
   base.decision==='no-new-short-window-evidence'&&
   base.existingFourStyleEvidence&&
   Object.keys(base.existingFourStyleEvidence).length===4,
   'P2.34 / P2.36 original ID, name, or disjointness mismatch');
  const isOr=row.sourceStructureDecision===
   'source-logic-adopt-distance-exclusive-OR';
  const isNarrow=row.sourceStructureDecision===
   'source-logic-adopt-intersection-but-hold-original-W-D';
  fail((isOr||isNarrow)&&Array.isArray(row.branchAnalyses)&&
   row.branchAnalyses.length===(isOr?2:1),
   'original exception source structure changed');
  const views=row.branchAnalyses.map(branchView);
  fail(isOr?
   views.map(v=>v.sourceDistanceType).sort().join(',')==='3,4'&&
   views.every(v=>v.sourceConditionInterpretation===
    'original-mutually-exclusive-distance-OR-branch'):
   views[0].sourceDistanceType===1&&
   views[0].sourceConditionInterpretation===
    'original-absolute-and-relative-rank-intersection',
   'OR branches, original distance or narrow rank were lost');
  if(isOr)distance++;else narrow++;
  branches+=views.length;pairRows+=views.length*pairsExpected.size;
  for(const view of views)for(const p of view.pairs){
   if(p.WDirection.status==='model-only-same-direction')stableW++;else heldW++;
   if(p.DDirection.status==='model-only-same-direction')stableD++;
  }
  projected.set(row.skillId,{...base,
   decision:'conditionally-use-source-exception-branch-W-D',
   originalP235Decision:row.sourceStructureDecision,
   sourceBranchEvidence:views,
   nextAction:'retain-original-distance-OR-or-rank-intersection-and-per-branch-W-D; do-not-aggregate-into-skill-score'});
 }
 fail(distance===remaining.summary.distanceORSpecialists&&
  narrow===remaining.summary.narrowedRankSkills&&
  branches===remaining.summary.originalDistanceScopedBranches&&
  pairRows===remaining.summary.modelComparableStylePairs&&
  stableW===remaining.summary.modelStableWPairs&&
  heldW===remaining.summary.heldWPairs&&
  stableD===remaining.summary.modelStableDPairs,
  'P2.36 branch-level model directions or original count changed');
 const rows=earlier.rows.map(r=>projected.get(r.skillId)||r);
 fail(rows.length===bySkill.size&&
  new Set(rows.map(x=>x.skillId)).size===rows.length&&
  projected.size===remaining.rows.length&&
  rows.every(x=>x.cardScore===null&&
   x.eligibleForP3CardScoring===false&&
   x.wholeSkillSuitability==='not-established'),
 'full-app source identity loss or product score leakage');
 return {schemaVersion:1,status:STATUS,
  sources:{p234Status:earlier.status,p236Status:remaining.status,
   sourceUmaSimSHA256:SOURCE_SHA,
   modelRaces:720,modelRevision:remaining.source.original720RaceModelRevision,
   referenceShortReportSHA256:remaining.source.originalShortReportSHA256},
  summary:{appSkills:rows.length,sourceMatched:earlier.summary.sourceMatched,
   directlyModeledSourceSkills:modeled,
   sourceExceptionModeledSkills:projected.size,
   uniqueSourceSkillsWithConditionalPartialWDEvidence:modeled+projected.size,
   heldOriginalGroundQualifierSkills:held,
   otherSkillsWithoutThisSpecificWindowEvidence:unchanged-projected.size,
   distanceOrSkills:distance,narrowRankSkills:narrow,
   originalExceptionDistanceBranches:branches,
   p234ComparableSkillPairs:earlier.summary.modelComparableWPairs,
   p234StableSkillWPairs:earlier.summary.stableModelWPairs,
   p234HeldSkillWPairs:earlier.summary.heldModelWPairs,
   p236ComparableBranchPairs:pairRows,
   p236StableBranchWPairs:stableW,p236HeldBranchWPairs:heldW,
   p236StableBranchDPairs:stableD,
   modeledSkillActivationRates:0,originalFullSkillANDProven:0,
   eligibleForP3CardScores:0,productSkillSuitabilityScores:0},
  rows,
  limitations:[
   'All models are skill-free balanced artificial turf runs, not commercial Uma Musume source skill activation frequencies.',
   'The 69 previous direct source skills and 12 original exception skills are disjoint; the six original ground holds stay unresolved.',
   'The 22 original exception branches are separate source eligibility alternatives, NOT 22 independent measured skill activations.',
   'Distance type 3/4 OR branches are mutually exclusive in one race and cannot be summed, averaged or reweighted into one rate.',
   'Rank intersection is measured on the original narrow band; a top-50 partial W cannot be substituted.',
   'W is 10m-window opportunity, O is point occupancy, U is uniform-rank baseline, D is O-U, never W-U.',
   'Source conditions beyond the measured rank/window part and precondition history are not proven by a positive model direction.',
   'No missing source records, modeled zeros, tie/reversal holds, and explicit source exclusions are turned into low-suitability labels.',
   'Reused source condition profiles, gold and white skills, and branch-pair comparisons are not independent game trials.',
   'P2 G1-G6 and all P3/P4 formal acceptance, user decisions and real game verification remain open.'
  ]};
}
if(require.main===module)try{
 fail(process.argv.length===5,
  'usage: p2_g3g4_combined_short_window_881.cjs earlier69-hold6.json p236-exception12.json out.json');
 const [a,b,out]=process.argv.slice(2);
 const r=join(JSON.parse(fs.readFileSync(a,'utf8')),
  JSON.parse(fs.readFileSync(b,'utf8')));
 fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');
 console.log('P2_41_JOINED_SOURCE_SKILL_DECISIONS='+JSON.stringify(r.summary));
}catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,STYLES,metricRange,branchView,join};
