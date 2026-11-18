'use strict';
/*
 * P2 G4: close source-logic questions in the 12 short-window exceptions of
 * P2.27 by inspecting the SAME source AND/OR rows and P2.32 route identities.
 * No full-skill proc, no new race experiment, no reweighted suitability.
 */
const rank=require('./skill_order_rate_bounds.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STATUS='P2-G4-fixed-source-short-window-12-exceptions-logic-not-ratings';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.35 source logic: '+msg)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const conditionKey=x=>[x.type,x.operator,x.value].join('|');
const norm=x=>x.map(conditionKey).sort().join('&&');
function structuralPair(q,paths){
 return q.routeFamilies.length===paths.length&&
  q.routeFamilies.every(f=>f.invokeOffset===0&&f.conditionOrCount===paths.length&&
   f.preconditionOrCount===0&&f.preconditionOrIndex===null&&
   !f.hasOtherInvokes)&&
  paths.every(p=>q.routeFamilies.some(f=>f.conditionOrIndex===p.orIndex&&
   f.invokeIndex===p.invokeIndex&&f.finiteCompatibleStyles.length===4));
}
function distanceOR(paths,q){
 if(paths.length!==2||!structuralPair(q,paths)||paths.some(p=>
  p.direct||!p.hasAlternativePaths||p.extraAndTypes.length||
  p.eligibleStyles.length!==4||p.sourceConditions.some(c=>![
   'distance_type','order_rate','phase_firsthalf_random',
   'phase_laterhalf_random'].includes(c.type))))return null;
 const distances=[],signatures=[];
 for(const p of paths){
  const ds=p.sourceConditions.filter(c=>c.type==='distance_type');
  if(ds.length!==1||ds[0].operator!=='=='||
   ![3,4].includes(ds[0].value))return null;
  distances.push(ds[0].value);
  signatures.push(norm(p.sourceConditions.filter(c=>c.type!=='distance_type')));
  if(p.orIndex<0||p.orIndex>1)return null;
 }
 if(!same([...distances].sort(),[3,4])||
  signatures[0]!==signatures[1]||
  paths[0].timeType!==paths[1].timeType||
  paths[0].phaseIndex!==paths[1].phaseIndex||
  paths[0].bandId!==paths[1].bandId||
  new Set(paths.map(p=>p.orIndex)).size!==2)return null;
 return {decision:'source-logic-adopt-distance-exclusive-OR',
  assessmentUse:'apply-original-distance-eligibility-branchwise-no-OR-dynamic-penalty',
  reason:'Both alternatives have identical original rank/window predicates, differ only in source distance_type==3/4, and are mutually exclusive for a fixed race.',
  originalBranchCount:2,
  modelWAndD:'not-calculated-for-this-source-skill',
  permittedDistanceTypes:[3,4],
  branches:paths.slice().sort((a,b)=>a.orIndex-b.orIndex).map(p=>({
   invokeIndex:p.invokeIndex,conditionOrIndex:p.orIndex,
   distanceType:p.sourceConditions.find(c=>c.type==='distance_type').value,
   originalTimingCode:p.timeType,originalTimingValue:p.phaseIndex,
   originalRankBandId:p.bandId
  })),
  mechanismKey:signatures[0],
  nextStep:'reuse-existing-rank-window-model-per-matching-distance-before-any-W-D-claim'};
}
function rankIntersection(paths,q){
 if(paths.length!==1||q.routeFamilies.length!==1||
  !structuralPair(q,paths)||paths[0].direct||
  paths[0].hasAlternativePaths||
  !same(paths[0].extraAndTypes,['order']))return null;
 const p=paths[0];
 if(p.sourceConditions.some(c=>![
  'distance_type','order_rate','order','phase_firsthalf_random',
  'phase_laterhalf_random'].includes(c.type)))return null;
 const rs=p.sourceConditions.filter(c=>c.type==='order_rate');
 const abs=p.sourceConditions.filter(c=>c.type==='order');
 const distance=p.sourceConditions.filter(c=>c.type==='distance_type');
 if(rs.length!==1||abs.length!==1||distance.length!==1||
  distance[0].operator!=='=='||distance[0].value!==1||
  !['==','!=','<','<=','>','>='].includes(abs[0].operator))return null;
 const positions={};
 for(const n of rank.FIELDS){
  const original=rank.andProjection(rs,n);
  if(original.status!=='rank-subcondition-projection')return null;
  const restricted=original.positions.filter(pos=>
   rank.compare(pos,abs[0].operator,abs[0].value));
  if(!restricted.length||restricted.length===original.positions.length)return null;
  positions[n]={unrestrictedRankOnly:original.positions,
   sourceConjunctionRankPositions:restricted};
 }
 return {decision:'source-logic-adopt-intersection-but-hold-original-W-D',
  assessmentUse:'replace-top50-rank-band-with-original-order-and-order-rate-conjunction-before-model-reuse',
  reason:'Absolute order and rounded order_rate describe the same one-indexed rank, so their AND is an exact rank-set intersection under the documented 9/12 field conversion.',
  originalBranchCount:1,
  modelWAndD:'not-calculated-for-conjoined-rank-band',
  distanceType:1,
  originalTimingCode:p.timeType,originalTimingValue:p.phaseIndex,
  sourceAbsoluteRankPredicate:{operator:abs[0].operator,value:abs[0].value},
  sourceRankRatePredicate:{operator:rs[0].operator,value:rs[0].value},
  projectedRanksByFieldSize:positions,
  mechanismKey:norm(p.sourceConditions),
  nextStep:'check-W-D-for-restricted-rank-band-only-if-needed-for-style-assessment'};
}
function audit(half,queue){
 fail(half?.status==='P2-source-only-half-phase-rank-feasibility-not-style-rating'&&
  half?.source?.sha256===SOURCE_SHA&&Array.isArray(half.examples)&&
  half.baseline?.appSkills===881&&half.baseline?.sourceMatched===818,
  'unverified original P2.27 source cohort');
 fail(queue?.status==='P2.32-source-route-research-selection-not-complete-skill-suitability'&&
  queue.denominators?.appSkills===881&&
  queue.denominators?.sourceMatchedSkills===818&&
  Array.isArray(queue.rows),
  'unverified P2.32 source route structural guard');
 const queueIds=new Map(queue.rows.filter(x=>x.sourceNumericId)
  .map(x=>[x.sourceNumericId,x]));
 fail(queueIds.size===818,'duplicate source IDs in P2.32 source routes');
 const extras=half.examples.filter(x=>
  x.paths?.some(p=>p.direct===false));
 const rows=extras.map(x=>{
  fail(x.paths.every(p=>p.direct===false)&&
   typeof x.sourceNumericId==='string'&&
   typeof x.skillId==='string'&&typeof x.name==='string',
   'mixed direct/exception or malformed source skill');
  const q=queueIds.get(x.sourceNumericId);
  fail(q&&q.skillId===x.skillId&&
   q.routeFamilies.length===x.paths.length,
   'unmatched original source skill/OR path identity');
  const decision=distanceOR(x.paths,q)||rankIntersection(x.paths,q);
  return {skillId:x.skillId,skillName:x.name,
   sourceNumericId:x.sourceNumericId,
   ...(decision||{decision:'hold-other-source-branch-interaction',
    assessmentUse:'no-automatic-transfer-of-partial-rank-evidence',
    modelWAndD:'unverified',
    nextStep:'inspect-exact-source-AND-OR-before-limited-mechanism-pilot'}),
   eligibleForP3CardScoring:false,wholeSkillSuitability:'not-established'};
 });
 fail(new Set(rows.map(x=>x.sourceNumericId)).size===rows.length,
  'source cohort duplicated');
 const categories={};
 for(const x of rows)categories[x.decision]=(categories[x.decision]||0)+1;
 return {schemaVersion:1,status:STATUS,
  source:{sha256:SOURCE_SHA,referenceFieldSizes:rank.FIELDS,
   originalP227SourceStatus:half.status,originalP232SourceStatus:queue.status},
  summary:{sourceMatchedSkills:818,sourceWindowCandidateSkills:half.counts.halfTimeAndExactBand,
   alreadyDirectSourceCandidateSkills:half.counts.halfTimeExactBandDirect,
   sourceExceptionSkills:rows.length,
   sourceDistanceExclusiveOR:categories['source-logic-adopt-distance-exclusive-OR']||0,
   originalRankIntersection:categories['source-logic-adopt-intersection-but-hold-original-W-D']||0,
   otherHeld:categories['hold-other-source-branch-interaction']||0,
   distinctDistanceORRankTimingMechanisms:new Set(rows.filter(x=>
    x.decision==='source-logic-adopt-distance-exclusive-OR').map(x=>x.mechanismKey)).size,
   distinctRankIntersectionMechanisms:new Set(rows.filter(x=>
    x.decision==='source-logic-adopt-intersection-but-hold-original-W-D').map(x=>x.mechanismKey)).size,
   productSuitabilityScores:0},
  rows,limitations:[
   'Finite source distance_type alternatives do not require an independent stochastic OR interaction model, but per-distance W/D has not been computed for these exact skills.',
   'For the original order>=2 AND order_rate<=50, the rank-set intersection is source-meaning interpretation, not an observed skill activation or source-JVM rank event.',
   'Original skill source predicate IDs and OR branches are preserved. Never combine disjoint distance eligibility into a sum of rates.',
   'The 9/12 rank mapping is secondary-source referenced and was not independently confirmed against the live Japanese game engine.',
   'No full-AND activation, real-game proc rate, validated 4-style card suitability or published skill score is provided.'
  ]};
}
module.exports={SOURCE_SHA,STATUS,distanceOR,rankIntersection,audit};
