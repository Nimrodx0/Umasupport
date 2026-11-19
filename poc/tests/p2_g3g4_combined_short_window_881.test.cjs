'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const study=require('../tools/p2_g3g4_combined_short_window_881.cjs');
const before=require('../tools/p2_g3g4_skill_window_decisions.cjs');
const p236=require('../tools/skill_p2_36_remaining_wd.cjs');
const PILOT_PIN=require('../tools/globalsim_position_pilot.cjs').PIN;
const SHORT_SHA=require('../tools/skill_halfphase_two_axis_review.cjs').SHORT_SHA;
const SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const S=['Nige','Senkou','Sasi','Oikomi'];
const directions=(held=false)=>held?
 {status:'held-tie-or-context-reversal',direction:null}:
 {status:'strict-same-direction-in-all-contexts-and-seed-halves',direction:'+'};
const pairKeys=S.flatMap((s,i)=>S.slice(i+1).map(t=>[s,t]));
const models=(distanceType,held=false)=>{
 const narrow=distanceType===1;
 return {distanceType,windowKey:'phase_laterhalf_random:1',
  bandId:narrow?'source-narrow-rank':'top50',
  sourceConditionInterpretation:narrow?
   'original-absolute-and-relative-rank-intersection':
   'original-mutually-exclusive-distance-OR-branch',
  modelCourses:narrow?[10501]:distanceType===3?[10504,10604]:[10506],
  modelOnly:true,productSkillScore:null,
  styles:Object.fromEntries(S.map(s=>[s,{contexts:2,
   WPercent:{min:10,max:40},OPercent:{min:4,max:35},
   DPoints:{min:-25,max:20},DDirection:directions()}])),
  pairs:pairKeys.map(([first,second],i)=>({
   first,second,modelWDirection:directions(held&&i===0),
   modelDDirection:directions()}))};
};
const originalRow=(id,decision,source=true)=>({
 skillId:'skill:'+id,skillName:'Synthetic skill '+id,
 sourceNumericId:source?id:null,
 existingFourStyleEvidence:{'逃げ':'held','先行':'held','差し':'held','追込':'held'},
 decision,wholeSkillSuitability:'not-established',
 eligibleForP3CardScoring:false,cardScore:null});
function fixture(){
 const rows=[
  originalRow('100','conditionally-use-short-window-rank-evidence'),
  originalRow('101','hold-turf-model-transfer'),
  originalRow('102','no-new-short-window-evidence'),
  originalRow('103','no-new-short-window-evidence'),
  originalRow('104','no-new-short-window-evidence',false)];
 const prior={schemaVersion:1,status:before.STATUS,
  source:{originalModelRaces:720,sourceUmaSimSHA256:SHA},
  summary:{appSkills:5,sourceMatched:4,shortWindowSourceCandidates:2,
   conditionalModelEvidenceSkills:1,heldGroundQualifierSkills:1,
   otherSkillsWithoutNewShortWindowEvidence:3,
   modelComparableWPairs:6,stableModelWPairs:4,heldModelWPairs:2,
   productSkillSuitabilityScores:0},rows};
 const sourceRow=(id,decision,branches)=>({
  sourceNumericId:id,skillId:'skill:'+id,
  skillName:'Synthetic skill '+id,sourceStructureDecision:decision,
  studyUse:'conditional-partial-rank-window-model-W-and-D-only',
  branchAnalyses:branches,
  wholeSkillSuitability:'not-established',productSkillScore:null
 });
 const remaining={schemaVersion:1,status:p236.STATUS,
  source:{fixedOriginalSkillSHA256:SHA,
   original720RaceModelRevision:PILOT_PIN,
   originalShortReportSHA256:SHORT_SHA},
  summary:{originalExceptionSkills:2,distanceORSpecialists:1,
   narrowedRankSkills:1,originalDistanceScopedBranches:3,
   modelComparableStylePairs:18,modelStableWPairs:17,heldWPairs:1,
   modelStableDPairs:18,eligibleForP3CardScores:0},
  rows:[
   sourceRow('102','source-logic-adopt-distance-exclusive-OR',
    [models(3),models(4,true)]),
   sourceRow('103','source-logic-adopt-intersection-but-hold-original-W-D',
    [models(1)])
  ]};
 return {prior,remaining};
}
test('P2.41 joins independent source SKILL identities, not independent race trial counts',()=>{
 const {prior,remaining}=fixture();
 const snapshot=JSON.stringify({prior,remaining}),joined=study.join(prior,remaining);
 assert.equal(JSON.stringify({prior,remaining}),snapshot,'P2.41 must be read-only');
 assert.equal(joined.status,study.STATUS);
 assert.equal(joined.rows.length,5);
 assert.deepEqual(joined.summary,{
  appSkills:5,sourceMatched:4,directlyModeledSourceSkills:1,
  sourceExceptionModeledSkills:2,
  uniqueSourceSkillsWithConditionalPartialWDEvidence:3,
  heldOriginalGroundQualifierSkills:1,
  otherSkillsWithoutThisSpecificWindowEvidence:1,
  distanceOrSkills:1,narrowRankSkills:1,
  originalExceptionDistanceBranches:3,
  p234ComparableSkillPairs:6,p234StableSkillWPairs:4,p234HeldSkillWPairs:2,
  p236ComparableBranchPairs:18,p236StableBranchWPairs:17,
  p236HeldBranchWPairs:1,p236StableBranchDPairs:18,
  modeledSkillActivationRates:0,originalFullSkillANDProven:0,
  eligibleForP3CardScores:0,productSkillSuitabilityScores:0
 });
 assert.equal(joined.rows[0].decision,'conditionally-use-short-window-rank-evidence');
 assert.equal(joined.rows[1].decision,'hold-turf-model-transfer');
 assert.equal(joined.rows[2].decision,'conditionally-use-source-exception-branch-W-D');
 assert.deepEqual(joined.rows[2].sourceBranchEvidence.map(x=>x.sourceDistanceType),
  [3,4]);
 assert.equal(joined.rows[3].sourceBranchEvidence[0].sourceDistanceType,1);
 assert.equal(joined.rows[2].sourceBranchEvidence[0].styles.Nige.DPoints.min,-25);
 assert.deepEqual(joined.rows[2].sourceBranchEvidence[1].pairs[0].WDirection,
  {status:'held-context-or-seed-inconsistent',direction:null});
 assert.equal(joined.rows[4].decision,'no-new-short-window-evidence');
 assert(joined.rows.every(x=>x.cardScore===null&&
  x.eligibleForP3CardScoring===false));
});
test('no collision between direct, turf-held and exception source skills',()=>{
 const f=fixture();
 f.remaining.rows[0].sourceNumericId='100';
 f.remaining.rows[0].skillId='skill:100';
 f.remaining.rows[0].skillName='Synthetic skill 100';
 assert.throws(()=>study.join(f.prior,f.remaining),/disjointness mismatch/);
 const g=fixture();
 g.remaining.rows[0].skillName='Different';
 assert.throws(()=>study.join(g.prior,g.remaining),/disjointness mismatch/);
 const h=fixture();
 h.remaining.rows[0].sourceNumericId='103';
 assert.throws(()=>study.join(h.prior,h.remaining),/disjointness mismatch/);
});
test('distance OR, original narrow rank and unknown evidence are fail-closed',()=>{
 const a=fixture();a.remaining.rows[0].branchAnalyses[1].distanceType=3;
 assert.throws(()=>study.join(a.prior,a.remaining),/OR branches/);
 const b=fixture();b.remaining.rows[1].branchAnalyses[0].distanceType=3;
 assert.throws(()=>study.join(b.prior,b.remaining),/narrow rank or distance-OR/);
 const invalidCourse=fixture();
 invalidCourse.remaining.rows[0].branchAnalyses[0].modelCourses=[10506];
 assert.throws(()=>study.join(invalidCourse.prior,invalidCourse.remaining),/distance scope/);
 const c=fixture();c.remaining.rows[0].branchAnalyses[0].pairs[0].modelWDirection=
  {status:'held-tie-or-context-reversal',direction:'+'};
 assert.throws(()=>study.join(c.prior,c.remaining),/held direction must be null/);
 const d=fixture();d.remaining.rows[1].branchAnalyses[0].styles.Senkou.WPercent.max=130;
 assert.throws(()=>study.join(d.prior,d.remaining),/invalid W model range/);
 const e=fixture();e.remaining.rows[0].branchAnalyses[0].pairs.pop();
 assert.throws(()=>study.join(e.prior,e.remaining),/incomplete branch comparisons/);
});
test('no missing source, held ground, source SHA drift or P3 scoring leaks',()=>{
 const a=fixture();a.prior.rows[1].decision='no-new-short-window-evidence';
 assert.throws(()=>study.join(a.prior,a.remaining),/P2.34 classification changed/);
 const b=fixture();b.remaining.source.fixedOriginalSkillSHA256='swapped';
 assert.throws(()=>study.join(b.prior,b.remaining),/P2.36 original W\/D/);
 const c=fixture();c.prior.rows[3].cardScore=20;
 assert.throws(()=>study.join(c.prior,c.remaining),/prior P3 scoring/);
 const d=fixture();d.remaining.rows[0].productSkillScore=22;
 assert.throws(()=>study.join(d.prior,d.remaining),/scoring/);
 const e=fixture();e.remaining.summary.modelStableWPairs=18;
 assert.throws(()=>study.join(e.prior,e.remaining),/branch-level model directions/);
});
