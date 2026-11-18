#!/usr/bin/env node
'use strict';
/*
 * P2.36: 10 distance-exclusive OR skills -> existing 11-band fixed short
 * report, 2 order>=2/relative-top50 skills -> one extra measured rank band
 * from the SAME 720 fixed races. Split 15+15, original race eligibility,
 * AND/OR and distinct W vs D are preserved. NO real proc or P3 rating.
 */
const fs=require('node:fs');
const p228=require('./skill_halfphase_two_axis_review.cjs');
const p235=require('../src/skill_p2_35_short_window_exception_decisions.cjs');
const narrow=require('./skill_p2_36_narrow_rank_observer.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const bounds=require('../src/skill_order_rate_bounds.cjs');
const STYLES=p228.STYLES;
const STATUS='P2.36-source-skill-distance-OR-and-narrow-rank-two-axis-model-only';
const fail=(ok,msg)=>{if(!ok)throw Error('P2.36 model reuse: '+msg)};
const round=n=>Number(n.toFixed(6));
const key=x=>[x.courseId,x.fieldSize,x.mode,x.windowKey,x.bandId,x.style].join('|');
const norm=xs=>xs.map(x=>[x.type,x.operator,x.value].join('|')).sort().join('&&');
const COURSE_TYPE={sprint:1,mile:2,'mile-alternate-track':2,middle:3,
 'middle-alternate-track':3,long:4};
const range=(cs,f)=>({min:round(Math.min(...cs.map(x=>x[f]))),
 max:round(Math.max(...cs.map(x=>x[f])))});
function validateNarrow(extra){
 fail(extra?.status===narrow.STATUS&&extra.schemaVersion===1&&
  extra.originalModelRaces===720&&extra.sourceModelRevision===expanded.PIN&&
  JSON.stringify(extra.sourceRankPredicates)===JSON.stringify([
   {type:'order',operator:'>=',value:2},
   {type:'order_rate',operator:'<=',value:50}])&&
  extra.sourceTimePredicate?.type==='phase_laterhalf_random'&&
  extra.sourceTimePredicate?.value===1&&
  Array.isArray(extra.contextRows)&&extra.contextRows.length===16,
  'missing or changed same-replay source rank-intersection evidence');
 const byKey=new Map();
 for(const x of extra.contextRows){
  fail(x.courseId===10501&&x.windowKey===narrow.windowKey&&
   x.bandId===narrow.bandId&&[9,12].includes(x.fieldSize)&&
   ['equal','jitter10'].includes(x.mode)&&STYLES.includes(x.style)&&
   JSON.stringify(x.ranks)===JSON.stringify(narrow.eligibleRanks(x.fieldSize)),
   'narrow model source scope or field rank changed');
  for(const k of ['all','first15','last15']){
   const v=x[k];
   fail(Number.isInteger(v?.runners)&&v.runners>=15&&
    [v.W,v.O,v.U,v.D].every(y=>Number.isFinite(y))&&
    v.W+0.00001>=v.O&&v.W<=100&&v.O>=0&&
    Math.abs(v.D-(v.O-v.U))<0.00001,
    'invalid narrow rank W/O/D or seed split');
  }
  fail(x.all.runners===x.first15.runners+x.last15.runners&&
   Math.abs((x.first15.W*x.first15.runners+
    x.last15.W*x.last15.runners)/x.all.runners-x.all.W)<0.00001&&
   Math.abs((x.first15.O*x.first15.runners+
    x.last15.O*x.last15.runners)/x.all.runners-x.all.O)<0.00001,
   'narrow source split mismatch');
  const k=key(x);
  fail(!byKey.has(k),'duplicate narrow model context');
  byKey.set(k,x);
 }
 fail(byKey.size===16,'missing narrow 4-style context');
 return byKey;
}
function sourceMetrics(record,band,fieldSize){
 const ranks=bounds.andProjection(band.predicates,fieldSize);
 fail(ranks.status==='rank-subcondition-projection'&&
  ranks.positions?.length,'unavailable original rank projection');
 const U=100*ranks.positions.length/fieldSize;
 const run=x=>({W:x.random10mOpportunityPercent,
  O:x.pointPercent,U:round(U),D:round(x.pointPercent-U)});
 return {all:run(record.all),first15:run(record.first15),
  last15:run(record.last15)};
}
function compare(contextByStyle){
 const pairs=[];
 for(const [first,second] of p228.PAIRS){
  const A=contextByStyle[first],B=contextByStyle[second];
  fail(A.length===B.length&&A.length>0&&A.every((x,i)=>
   x.courseId===B[i].courseId&&x.fieldSize===B[i].fieldSize&&
   x.mode===B[i].mode),'original model context mismatch across styles');
  const dir=metric=>p228.stableDirection(A.flatMap((x,i)=>{
   const y=B[i];
   return ['all','first15','last15'].map(h=>x[h][metric]-y[h][metric]);
  }));
  pairs.push({first,second,modelWDirection:dir('W'),
   modelDDirection:dir('D')});
 }
 return pairs;
}
function summarizeContexts(contexts){
 const all=contexts.map(x=>x.all);
 return {contexts:contexts.length,
  WPercent:range(all,'W'),OPercent:range(all,'O'),
  DPoints:range(all,'D'),
  DDirection:p228.stableDirection(contexts.flatMap(x=>
   [x.all.D,x.first15.D,x.last15.D]))};
}
function analyzeBranch(row,branch,cs,hs,extra){
 const time=branch.originalTimingCode+':'+branch.originalTimingValue;
 const distance=branch.distanceType;
 const isNarrow=row.decision==='source-logic-adopt-intersection-but-hold-original-W-D';
 let bandId=branch.originalRankBandId,b=null;
 if(isNarrow){
  fail(distance===1&&time===narrow.windowKey&&
   row.sourceAbsoluteRankPredicate?.operator==='>='&&
   row.sourceAbsoluteRankPredicate?.value===2&&
   row.sourceRankRatePredicate?.operator==='<='&&
   row.sourceRankRatePredicate?.value===50,
   'narrow row source conditions no longer match measured intersection');
  bandId=narrow.bandId;
 }else{
  b=bands.find(x=>x.id===bandId);
  fail(b&&norm([...b.predicates,{type:branch.originalTimingCode,
   operator:'==',value:branch.originalTimingValue}])===row.mechanismKey,
   'distance-OR source rank/window shape not in fixed reference model');
 }
 const courses=expanded.COURSES.filter(c=>COURSE_TYPE[c.group]===distance);
 fail(courses.length>0&&courses.every(x=>x.group==='sprint'||x.group==='middle'||
  x.group==='middle-alternate-track'||x.group==='long'),
  'no modeled source distance or unsupported model course');
 const byStyle={};
 for(const style of STYLES){
  const contexts=[];
  for(const course of courses)for(const fieldSize of [9,12])
   for(const mode of ['equal','jitter10']){
    const k=key({courseId:course.id,fieldSize,mode,windowKey:time,bandId,style});
    let vals;
    if(isNarrow){
     const x=extra.get(k);
     fail(x,'narrow model context missing');
     vals={all:x.all,first15:x.first15,last15:x.last15};
     fail(JSON.stringify(row.projectedRanksByFieldSize[fieldSize]
      .sourceConjunctionRankPositions)===JSON.stringify(x.ranks),
      'original skill/source narrow rank differs from observed band');
    }else{
     const all=cs.get(k),first15=hs.get(k+'|first15'),
      last15=hs.get(k+'|last15');
     fail(all&&first15&&last15,'missing pinned short-window model row');
     vals=sourceMetrics({all,first15,last15},b,fieldSize);
    }
    contexts.push({courseId:course.id,fieldSize,mode,...vals});
   }
  byStyle[style]=contexts;
 }
 const pairs=compare(byStyle);
 return {distanceType:distance,windowKey:time,bandId,
  sourceConditionInterpretation:isNarrow?
   'original-absolute-and-relative-rank-intersection':
   'original-mutually-exclusive-distance-OR-branch',
  modelCourses:courses.map(x=>x.id),
  styles:Object.fromEntries(STYLES.map(s=>[s,summarizeContexts(byStyle[s])])),
  pairs,
  modelOnly:true,productSkillScore:null,
  observationContextsByStyle:byStyle};
}
function audit(short,split,half,exceptions,extra){
 const {cs,hs}=p228.validate(short,split,half);
 fail(exceptions?.schemaVersion===1&&exceptions.status===p235.STATUS&&
  exceptions.source?.sha256===p235.SOURCE_SHA&&
  exceptions.summary?.sourceExceptionSkills===12&&
  exceptions.summary?.sourceDistanceExclusiveOR===10&&
  exceptions.summary?.originalRankIntersection===2&&
  exceptions.summary?.otherHeld===0&&
  Array.isArray(exceptions.rows)&&exceptions.rows.length===12,
  'unverified P2.35 source AND/OR exception review');
 const narrowByKey=validateNarrow(extra);
 const bySource=new Map(half.examples.map(x=>[x.sourceNumericId,x]));
 const seen=new Set();
 const rows=exceptions.rows.map(r=>{
  const origin=bySource.get(r.sourceNumericId);
  fail(origin&&origin.skillId===r.skillId&&origin.name===r.skillName&&
   !seen.has(r.sourceNumericId),'unmatched/duplicate P2.27 source skill ID or name');
  seen.add(r.sourceNumericId);
  let branches;
  if(r.decision==='source-logic-adopt-distance-exclusive-OR'){
   fail(r.modelWAndD==='not-calculated-for-this-source-skill'&&
    JSON.stringify(r.permittedDistanceTypes)==='[3,4]'&&
    r.branches?.length===2&&
    r.branches.every(x=>[3,4].includes(x.distanceType)),
    'original distance source branches changed');
   branches=r.branches;
  }else{
   fail(r.decision==='source-logic-adopt-intersection-but-hold-original-W-D'&&
    r.modelWAndD==='not-calculated-for-conjoined-rank-band'&&
    r.distanceType===1,'original narrowed rank source changed');
   branches=[{distanceType:1,originalTimingCode:r.originalTimingCode,
    originalTimingValue:r.originalTimingValue,
    originalRankBandId:null}];
  }
  const evaluated=branches.map(x=>analyzeBranch(r,x,cs,hs,narrowByKey));
  return {sourceNumericId:r.sourceNumericId,skillId:r.skillId,
   skillName:r.skillName,sourceStructureDecision:r.decision,
   studyUse:'conditional-partial-rank-window-model-W-and-D-only',
   branchAnalyses:evaluated,
   wholeSkillSuitability:'not-established',productSkillScore:null};
 });
 const analyses=rows.flatMap(x=>x.branchAnalyses);
 const pairs=analyses.flatMap(x=>x.pairs);
 const stable=(type)=>pairs.filter(p=>
  p[type].status==='strict-same-direction-in-all-contexts-and-seed-halves').length;
 const distinct=new Set(analyses.map(x=>[
  x.windowKey,x.bandId,x.distanceType
 ].join('|'))).size;
 return {schemaVersion:1,status:STATUS,
  source:{fixedOriginalSkillSHA256:p235.SOURCE_SHA,
   original720RaceModelRevision:expanded.PIN,
   originalShortReportSHA256:p228.SHORT_SHA,
   p235SourceDecisionsStatus:exceptions.status,
   narrowSourceObservationStatus:extra.status},
  summary:{originalExceptionSkills:rows.length,
   distanceORSpecialists:rows.filter(x=>
    x.sourceStructureDecision==='source-logic-adopt-distance-exclusive-OR').length,
   narrowedRankSkills:rows.filter(x=>
    x.sourceStructureDecision==='source-logic-adopt-intersection-but-hold-original-W-D').length,
   originalDistanceScopedBranches:analyses.length,
   distinctOriginalModeledProfiles:distinct,
   modelComparableStylePairs:pairs.length,
   modelStableWPairs:stable('modelWDirection'),
   heldWPairs:pairs.length-stable('modelWDirection'),
   modelStableDPairs:stable('modelDDirection'),
   eligibleForP3CardScores:0},
  rows,
  limitations:[
   'W and D are separately calculated from the same 720 skill-free artificial balanced turf model races, not full skill activation or real-game trigger rates.',
   'Model directions are strict per matching course, field size, capacity mode and both 15-seed halves. Non-strict differences remain held.',
   'Distance branches are conditionally adopted only within each original middle/long race eligibility; the branches are never summed or averaged.',
   'The narrowed rank intersection is independently measured from the identical model race trajectories, never by subtracting 10m-window rates.',
   'Two original skills may reuse the same model rank/window/distance evidence; they are not independent game observations.',
   'Source original order_rate conversion is based on referenced secondary explanation, not independent live JP engine validation.',
   'No new real-world representative roster, experimental threshold, complete original AND activation or card suitability score.'
  ]};
}
if(require.main===module)try{
 if(process.argv.length!==8)throw Error('Usage: short.json split.json half.json p235.json narrow.json output.json');
 const [a,b,c,d,e,f]=process.argv.slice(2);
 const read=x=>JSON.parse(fs.readFileSync(x,'utf8'));
 const result=audit(read(a),read(b),read(c),read(d),read(e));
 fs.writeFileSync(f,JSON.stringify(result,null,2)+'\n');
 console.log('P2_36_SHORT_WINDOW_REUSE='+JSON.stringify(result.summary));
}catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,validateNarrow,analyzeBranch,audit};
