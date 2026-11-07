#!/usr/bin/env node
'use strict';
/*
 * P2 descriptive research only: compare model 10m rank-condition opportunities
 * across 6 course × 9/12 runner × equal/jitter10 balanced source contexts.
 * Never interprets these numbers as skill activation probabilities.
 * No high/middle/low thresholds are adopted for product use.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const turfFullAudit=require('./skill_phase10_cohort_review.cjs');
const turfShortAudit=require('./skill_subphase10_cohort_review.cjs');
const dirtAudit=require('./skill_dirt17_opportunity_review.cjs');
const STYLES=Object.keys(turfFullAudit.STYLE_IDS);
const THRESHOLD_CANDIDATES=Object.freeze([
 Object.freeze({id:'20-80',low:20,high:80}),
 Object.freeze({id:'10-90',low:10,high:90}),
 Object.freeze({id:'5-95',low:5,high:95})
]);
const round=x=>Number(x.toFixed(6));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const medianOf=(sorted,q)=>{
 if(!sorted.length)return null;
 const t=(sorted.length-1)*q,lo=Math.floor(t),hi=Math.ceil(t);
 return sorted[lo]+(sorted[hi]-sorted[lo])*(t-lo);
};
const category=(x,low,high)=>x<low?'low':x>=high?'high':'middle';
const LABELS=['low','middle','high'];
function thresholds(values){
 if(!Array.isArray(values)||!values.length||
  values.some(x=>!Number.isFinite(x)||x<0||x>100))
  throw Error('Unverified 0..100 research opportunity samples');
 const sorted=[...values].sort((a,b)=>a-b);
 const average=mean(values);
 const result={};
 for(const t of THRESHOLD_CANDIDATES){
  const observed=values.map(x=>category(x,t.low,t.high));
  const groups=Object.fromEntries(LABELS.map(x=>
   [x,observed.filter(z=>z===x).length]));
  const label=category(average,t.low,t.high);
  result[t.id]={meanLabel:label,contextClasses:groups,
   contextsSameLabel:groups[label]===values.length,
   contextsAgreeingWithMean:groups[label],
   fractionSameAsMean:round(groups[label]/values.length),
   minLabel:category(sorted[0],t.low,t.high),
   maxLabel:category(sorted.at(-1),t.low,t.high)};
 }
 return result;
}
function validatePriors({turfAudit,dirt17,turfFull,turfShort,dirtModel}){
 if(!turfAudit||turfAudit.schemaVersion!==1||
  turfAudit.status!=='research-77-skills-full-plus-short-10m-rank-condition-only'||
  turfAudit.counts?.skills!==77||turfAudit.counts?.eligibleModelledPaths!==64||
  turfAudit.counts?.distinctConditionSignatures!==26||
  turfAudit.source?.revision!==turfFullAudit.REV||
  turfAudit.source?.sha256!==turfFullAudit.SOURCE_SHA||
  !Array.isArray(turfAudit.items)||turfAudit.items.length!==77)
  throw Error('Source-verified 77 cohort is unavailable');
 if(!dirt17||dirt17.schemaVersion!==1||
  dirt17.status!=='research-17-dirt-skill-rank-only-opportunity-not-game-activation'||
  dirt17.counts?.sourceSkills!==17||
  dirt17.counts?.uniqueConditionSignatures!==6||
  dirt17.source?.sha256!==turfAudit.source.sha256||
  !Array.isArray(dirt17.items)||dirt17.items.length!==17)
  throw Error('Source-verified 17 dirt cohort is unavailable');
 if(turfAudit.model?.fullPhaseReportSha256!==turfShortAudit.FULL_SHA||
  dirt17.model?.referencedTurfFullSha256!==turfShortAudit.FULL_SHA||
  dirt17.model?.referenceShortSha256!==turfAudit.model?.shortWindowReportSha256)
  throw Error('Prior model provenance does not match');
 const index={
  turfFull:turfFullAudit.indexModel(turfFull),
  turfShort:turfShortAudit.indexSubphase(turfShort),
  dirtFull:dirtAudit.indexModel(dirtModel.fullPhase,
   {type:'full',courses:dirtModel.courses}),
  dirtShort:dirtAudit.indexModel(dirtModel.shortWindows,
   {type:'short',courses:dirtModel.courses})
 };
 if(dirtModel.sourceRevision!==turfFullAudit.MODEL_REV||
  dirtModel.surface!==2||dirtModel.simulations!==720||
  dirtModel.status!=='research-GlobalSim-v77-dirt-10m-rank-opportunity-not-game-activation'||
  dirt17.model?.dirtReportSha256===null)
  throw Error('The independent dirt source model is unverified');
 return index;
}
function oneProfile({sourceNumericId,skillName,surface,timing,bandId,
 courseIds,style,refMean,rows}){
 if(!Array.isArray(courseIds)||!courseIds.length||
  new Set(courseIds).size!==courseIds.length||
  !Array.isArray(rows)||rows.length!==courseIds.length*4)
  throw Error('Wrong number of model contexts for source course-gated skill');
 const filtered=rows.filter(r=>courseIds.includes(r.courseId));
 const combos=new Set(filtered.map(r=>[r.courseId,r.fieldSize,r.mode].join('|')));
 if(filtered.length!==courseIds.length*4||
  combos.size!==filtered.length||
  filtered.some(r=>r.bandId!==bandId||r.style!==style||
   ![9,12].includes(r.fieldSize)||
   !['equal','jitter10'].includes(r.mode)||
   !Number.isFinite(r.random10mOpportunityPercent)||
   r.random10mOpportunityPercent<0||
   r.random10mOpportunityPercent>100))
  throw Error('Missing/duplicated fixed model context');
 const numbers=filtered.map(r=>r.random10mOpportunityPercent);
 const avg=mean(numbers);
 if(!Number.isFinite(refMean)||Math.abs(avg-refMean)>0.00002)
  throw Error('Context mean does not match previous source reviewed skill '+JSON.stringify({
   sourceNumericId,style,timing,refMean,computed:avg}));
 const sorted=[...numbers].sort((a,b)=>a-b);
 const meanBy=(field,value)=>round(mean(filtered.filter(r=>
  r[field]===value).map(r=>r.random10mOpportunityPercent)));
 const courseMeans=courseIds.map(courseId=>({
  courseId,meanPercent:meanBy('courseId',courseId)}));
 const head9=meanBy('fieldSize',9),head12=meanBy('fieldSize',12);
 const equal=meanBy('mode','equal'),jitter10=meanBy('mode','jitter10');
 const loo=courseIds.length>=2?courseIds.map(courseId=>({
  omittedCourseId:courseId,
  meanPercent:round(mean(filtered.filter(r=>r.courseId!==courseId)
   .map(r=>r.random10mOpportunityPercent)))})):null;
 const maxCourse=round(Math.max(...courseMeans.map(c=>c.meanPercent))-
  Math.min(...courseMeans.map(c=>c.meanPercent)));
 const courseHighest=courseMeans.reduce((a,b)=>
  b.meanPercent>a.meanPercent?b:a);
 const courseLowest=courseMeans.reduce((a,b)=>
  b.meanPercent<a.meanPercent?b:a);
 return {
  sourceNumericId,skillName,surface,timing,bandId,style,
  courseIds:[...courseIds],contexts:filtered.length,
  meanPercent:round(avg),
  minPercent:round(sorted[0]),p10Percent:round(medianOf(sorted,.1)),
  p25Percent:round(medianOf(sorted,.25)),
  medianPercent:round(medianOf(sorted,.5)),
  p75Percent:round(medianOf(sorted,.75)),
  p90Percent:round(medianOf(sorted,.9)),
  maxPercent:round(sorted.at(-1)),
  rangePoints:round(sorted.at(-1)-sorted[0]),
  standardDeviationPoints:round(Math.sqrt(mean(numbers.map(v=>
   (v-avg)**2)))),
  byHeadcount:{'9':head9,'12':head12,
   absoluteDifferencePoints:round(Math.abs(head9-head12)),
   signed12Minus9Points:round(head12-head9)},
  byMode:{equal,jitter10,
   absoluteDifferencePoints:round(Math.abs(equal-jitter10)),
   signedJitterMinusEqualPoints:round(jitter10-equal)},
  byCourse:{means:courseMeans,rangePoints:maxCourse,
   highest:courseHighest,lowest:courseLowest,
   leaveOneCourseOut:loo,
   leaveOneCourseOutMeanRangePoints:loo?
    round(Math.max(...loo.map(x=>x.meanPercent))-
     Math.min(...loo.map(x=>x.meanPercent))):null},
  candidateThresholds:thresholds(numbers)
 };
}
function produce({turfAudit,dirt17,turfFull,turfShort,dirtModel}){
 const indexes=validatePriors({turfAudit,dirt17,turfFull,turfShort,dirtModel});
 const entries=[],unique=new Map();
 let turfPaths=0,dirtPaths=0;
 const add=(args)=>{
  const value=oneProfile(args);
  entries.push(value);
  const uniqueKey=[value.surface,value.timing,value.bandId,
   value.courseIds.join(','),value.style].join('|');
  if(unique.has(uniqueKey)){
   const prior=unique.get(uniqueKey);
   if(JSON.stringify({...value,sourceNumericId:null,skillName:null})!==
    JSON.stringify({...prior,sourceNumericId:null,skillName:null}))
    throw Error('Same source condition maps to non-identical model profiles');
  }else unique.set(uniqueKey,value);
 };
 for(const item of turfAudit.items)for(const p of item.paths){
  if(!p.status.startsWith('modeled-'))continue;
  turfPaths++;
  const isFull=p.sourceTiming.startsWith('phase_random:');
  const window=isFull?p.sourceTiming.split(':')[1]:p.sourceTiming;
  if(!p.bandId||!Array.isArray(p.modelCourseIds)||!p.modelCourseIds.length)
   throw Error('Missing original turf rank/gate scope');
  for(const style of STYLES){
   const original=p.byStyle[style];
   const rows=(isFull?indexes.turfFull:indexes.turfShort)
    .get([window,p.bandId,style].join('|'));
   add({sourceNumericId:item.sourceNumericId,skillName:item.skillName,
    surface:'turf',timing:p.sourceTiming,bandId:p.bandId,
    courseIds:p.modelCourseIds,style,
    refMean:original.opportunityPercent,
    rows:rows?.filter(r=>p.modelCourseIds.includes(r.courseId))});
  }
 }
 for(const item of dirt17.items){
  dirtPaths++;
  const isFull=item.modelType==='full';
  const key=item.modelWindow;
  const timing=isFull?'phase_random:'+key:key;
  for(const style of STYLES){
   const rows=(isFull?indexes.dirtFull:indexes.dirtShort)
    .get([key,item.rankBandId,style].join('|'));
   add({sourceNumericId:item.sourceNumericId,skillName:item.skillName,
    surface:'dirt',timing,bandId:item.rankBandId,
    courseIds:item.modelDirtCourseIds,style,
    refMean:item.byStyle[style].opportunityPercent,
    rows:rows?.filter(r=>item.modelDirtCourseIds.includes(r.courseId))});
  }
 }
 if(turfPaths!==64||dirtPaths!==17||
  entries.length!==81*STYLES.length||unique.size!==32*STYLES.length)
  throw Error('Expected exactly 64 turf + 17 dirt source paths, 32 independent signatures');
 const bySig=[...unique.values()].sort((a,b)=>
  a.surface.localeCompare(b.surface)||
  a.timing.localeCompare(b.timing)||
  a.bandId.localeCompare(b.bandId)||
  a.courseIds.join(',').localeCompare(b.courseIds.join(','))||
  a.style.localeCompare(b.style));
 const summary={};
 for(const t of THRESHOLD_CANDIDATES){
  const byStyle={};
  const bySurface={};
  const subsetSummary=xs=>({
   total:xs.length,
   stable:xs.filter(x=>x.candidateThresholds[t.id].contextsSameLabel).length,
   unstable:xs.filter(x=>!x.candidateThresholds[t.id].contextsSameLabel).length,
   labelCounts:Object.fromEntries(LABELS.map(label=>[
    label,xs.filter(x=>x.candidateThresholds[t.id].meanLabel===label).length]))
  });
  for(const style of STYLES)
   byStyle[style]=subsetSummary(bySig.filter(x=>x.style===style));
  for(const surface of ['turf','dirt'])
   bySurface[surface]=subsetSummary(bySig.filter(x=>x.surface===surface));
  summary[t.id]={thresholds:{low:t.low,high:t.high},
   independentConditions:subsetSummary(bySig),
   byStyle,bySurface};
 }
 const sortedRange=[...bySig].sort((a,b)=>b.rangePoints-a.rangePoints);
 const sortedHead=[...bySig].sort((a,b)=>
  b.byHeadcount.absoluteDifferencePoints-a.byHeadcount.absoluteDifferencePoints);
 const sortedMode=[...bySig].sort((a,b)=>
  b.byMode.absoluteDifferencePoints-a.byMode.absoluteDifferencePoints);
 const sortedCourse=[...bySig].sort((a,b)=>
  b.byCourse.rangePoints-a.byCourse.rangePoints);
 const findExample=(id,style)=>entries.find(x=>
  x.sourceNumericId===id&&x.style===style);
 const examples=[
  ['200681','Sasi'],['202671','Sasi'],
  ['202001','Senkou'],['202261','Sasi'],
  ['202951','Oikomi'],['201052','Sasi']
 ].map(([id,style])=>findExample(id,style)).filter(Boolean);
 return {
  schemaVersion:1,
  status:'p2-research-only-context-sensitivity-for-77-source-skill-rank-conditions',
  source:{revision:turfAudit.source.revision,
   skillSha256:turfAudit.source.sha256,
   modelRevision:turfFullAudit.MODEL_REV,
   turfFullReportSha256:turfShortAudit.FULL_SHA,
   turfShortReportSha256:turfAudit.model.shortWindowReportSha256,
   dirtReportSha256:dirt17.model.dirtReportSha256},
  design:{scenario:'balanced',sourceSkills:77,
   sourcePaths:turfPaths+dirtPaths,turfPaths,dirtPaths,
   sourceStyleCases:entries.length,
   distinctSourceConditions:bySig.length/STYLES.length,
   distinctConditionStyleCases:bySig.length,
   styleNames:STYLES,
   comparisonUnit:'24 equally weighted contexts at most: 6 courses × 9/12 runners × equal/jitter10 mode; filtered by original source distance conditions',
   candidateThresholds:THRESHOLD_CANDIDATES},
  candidateThresholdSummary:summary,
  broadVariability:{
   uniqueConditionStyleCases:bySig.length,
   contextRangeAbove10Points:bySig.filter(x=>x.rangePoints>10).length,
   contextRangeAbove20Points:bySig.filter(x=>x.rangePoints>20).length,
   headcountGapAbove5Points:bySig.filter(x=>
    x.byHeadcount.absoluteDifferencePoints>5).length,
   modeGapAbove5Points:bySig.filter(x=>
    x.byMode.absoluteDifferencePoints>5).length,
   courseMeanRangeAbove5Points:bySig.filter(x=>
    x.byCourse.rangePoints>5).length,
   oneCourseOnly:bySig.filter(x=>x.courseIds.length===1).length},
  extremes:{
   largestContextRanges:sortedRange.slice(0,12),
   largestHeadcountGaps:sortedHead.slice(0,12),
   largestModeGaps:sortedMode.slice(0,12),
   largestCourseMeanRanges:sortedCourse.slice(0,12)
  },
  examples,
  uniqueConditionProfiles:bySig,
  limitations:[
   'The 128 independently deduplicated entries are 32 selected original condition signatures × four styles, not a random population sample of all skills.',
   'Context means and min/max refer to the fixed model course × field size × equal/jitter10 settings, each aggregating correlated runners and 30 seeds.',
   'Context variations are not independent race-level probability confidence intervals; SD and quantiles describe model settings, not sampling uncertainty.',
   'Course contrast mixes geometries, gradients and other course attributes. Turf/dirt are analyzed separately, never as a matched surface causal effect.',
   'A single modeled course cannot support leave-one-course-out sensitivity and is explicitly null rather than zero.',
   '20/80, 10/90 and 5/95 are experimental candidate label boundaries only, not approved thresholds or production grades.',
   'Rank-subcondition 10m opportunities omit actual game wisdom lottery, real-time discrete checks, other AND conditions, OR union and effect utility.',
   'No P3/P4 app labels, user settings, card scores or deployed data are changed.'
  ]
 };
}
function main([turf77Path,dirt17Path,turfFullPath,turfShortPath,dirtModelPath,outPath]){
 if(!outPath)throw Error('Usage: skill_context_stability_77.cjs turf77.json dirt17.json turfFull.json turfShort.json dirtModel.json result.json');
 const load=p=>fs.readFileSync(p);
 const t=load(turf77Path),d=load(dirt17Path),tf=load(turfFullPath),
  ts=load(turfShortPath),dm=load(dirtModelPath);
 const turfAudit=JSON.parse(t),dirt17=JSON.parse(d),
  turfFull=JSON.parse(tf),turfShort=JSON.parse(ts),
  dirtModel=JSON.parse(dm);
 if(hash(tf)!==turfShortAudit.FULL_SHA||
  hash(ts)!==turfAudit.model.shortWindowReportSha256||
  hash(dm)!==dirt17.model.dirtReportSha256)
  throw Error('Pinned source model report SHA drift');
 const result=produce({turfAudit,dirt17,turfFull,turfShort,dirtModel});
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({source:result.source,design:result.design,
  candidates:result.candidateThresholdSummary,
  variability:result.broadVariability,
  examples:result.examples.map(x=>({
   name:x.skillName,style:x.style,mean:x.meanPercent,min:x.minPercent,
   max:x.maxPercent,fieldGap:x.byHeadcount.absoluteDifferencePoints,
   modeGap:x.byMode.absoluteDifferencePoints,
   courseMeanRange:x.byCourse.rangePoints}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={THRESHOLD_CANDIDATES,category,thresholds,oneProfile,
 validatePriors,produce,main};
