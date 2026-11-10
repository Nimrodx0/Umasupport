#!/usr/bin/env node
'use strict';
/*
 * P2 ONLY. Audit fixed model-only rank/corner opportunity separately for:
 *  - W: 10 m overlap opportunity, NOT skill activation probability
 *  - O: single-position occupancy; D=O-U, never W-U.
 *
 * Two disjoint 15-seed groups provide descriptive direction consistency,
 * NOT statistical significance or independent skill observations.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const STATUS='P2-fixed-GlobalSim-original-rank-corner-10m-partial-opportunity-only';
const MODEL='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const SOURCE='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const PIN='0ad669a4dca52ca652009a0702037281a2044bd7ba0c5d1a057a053b954df7bd';
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const AXES={
 W:{full:'W10mOpportunityPercent',half:'WmeanPercent'},
 O:{full:'OPointOccupancyPercent',half:'OmeanPercent'}
};
const EPS=1e-6;
const near=(a,b,tol=3e-5)=>Math.abs(a-b)<=tol;
const sign=n=>n>EPS?1:n< -EPS?-1:0;
const sortedPairs=[];
for(let i=0;i<STYLES.length;i++)for(let j=i+1;j<STYLES.length;j++)
 sortedPairs.push([STYLES[i],STYLES[j]]);
function validate(source){
 if(!source||source.schemaVersion!==1||source.status!==STATUS||
  source.globalSimRevision!==MODEL||source.sourceUmaSimSha256!==SOURCE||
  source.simulations!==1440||source.eligibleSourcePaths!==32||
  source.matchedContextCells!==1632||source.absoluteContextCells!==576||
  source.cornerContextCells!==1056||source.unresolvedContextCells!==0||
  source.seedsPerCourseFieldMode!==30||
  !Array.isArray(source.contextCells)||source.contextCells.length!==1632)
  throw Error('Not the verified pinned source-specific W/O model dataset');
 const seen=new Set(),groups=new Map(),paths=new Set();
 for(const c of source.contextCells){
  if(!c||typeof c.sourcePathId!=='string'||!c.sourcePathId.includes('|')||
    !['absolute-order','corner-with-rank-rate'].includes(c.candidate)||
    !STYLES.includes(c.style)||![9,12].includes(c.fieldSize)||
    !['equal','jitter10'].includes(c.mode)||
    c.inferenceStatus!=='source-rank-subcondition-only-not-skill-rating'||
    !Number.isSafeInteger(c.courseId)||!Number.isSafeInteger(c.runners)||c.runners<=0||
    c.unresolvedRunners!==0||!Number.isSafeInteger(c.sourceRankPositions)||
    c.sourceRankPositions<0||c.sourceRankPositions>c.fieldSize||
    !Array.isArray(c.split15SeedGroups)||c.split15SeedGroups.length!==2)
   throw Error('Invalid source style context and hold state');
  const id=[c.sourcePathId,c.courseId,c.fieldSize,c.mode,c.style].join('|');
  if(seen.has(id))throw Error('Duplicate source style context '+id);
  seen.add(id);paths.add(c.sourcePathId);
  const U=100*c.sourceRankPositions/c.fieldSize;
  for(const a of ['W10mOpportunityPercent','OPointOccupancyPercent',
    'DPointMinusUniformPercentPoints','modelUniformPointReferenceUPercent']){
    if(!Number.isFinite(c[a]))throw Error('Non-finite source W/O/U/D');
  }
  if(!near(U,c.modelUniformPointReferenceUPercent)||
   !near(c.OPointOccupancyPercent-c.modelUniformPointReferenceUPercent,
    c.DPointMinusUniformPercentPoints)||c.OPointOccupancyPercent< -EPS||
   c.W10mOpportunityPercent>100+EPS||
   c.OPointOccupancyPercent>c.W10mOpportunityPercent+EPS)
   throw Error('Original independent W/O/U/D definition drift');
  const n=c.split15SeedGroups.map(s=>{
   if(!s||s.runners<=0||s.unresolved!==0||
      !Number.isSafeInteger(s.runners)||
      !Number.isFinite(s.WmeanPercent)||!Number.isFinite(s.OmeanPercent)||
      s.WlowerPercent>s.WupperPercent+EPS||
      s.WmeanPercent+EPS<s.OmeanPercent)
    throw Error('Insufficient or incorrect disjoint seed half');
   return s.runners;
  });
  if(n[0]+n[1]!==c.runners||!near(
    c.split15SeedGroups.reduce((sum,s)=>sum+s.WmeanPercent*s.runners,0)/c.runners,
    c.W10mOpportunityPercent)||
    !near(c.split15SeedGroups.reduce((sum,s)=>sum+s.OmeanPercent*s.runners,0)/c.runners,
    c.OPointOccupancyPercent))
   throw Error('Seed halves are not coherent with complete model mean');
  const groupId=[c.sourcePathId,c.courseId,c.fieldSize,c.mode].join('|');
  if(!groups.has(groupId))groups.set(groupId,{
   sourcePathId:c.sourcePathId,courseId:c.courseId,fieldSize:c.fieldSize,
   mode:c.mode,candidate:c.candidate,styles:new Map()});
  const g=groups.get(groupId);
  if(g.candidate!==c.candidate||g.styles.has(c.style))
   throw Error('Non-unique model style population');
  g.styles.set(c.style,c);
 }
 if(paths.size!==32||groups.size!==456)
  throw Error('Unexpected source path and model context population');
 return groups;
}
function pair(g,styleA,styleB,axis){
 const a=g.styles.get(styleA),b=g.styles.get(styleB),f=AXES[axis];
 if(!a||!b)return null;
 const halves=[0,1].map(i=>Number((
  a.split15SeedGroups[i][f.half]-
  b.split15SeedGroups[i][f.half]).toFixed(6)));
 const signs=halves.map(sign);
 const mean=Number((a[f.full]-b[f.full]).toFixed(6));
 const status=signs[0]===signs[1]&&signs[0]!==0?
   'strict-direction-repeated':
  signs[0]===0&&signs[1]===0?'both-halves-tied':
  signs[0]*signs[1]<0?'direction-reversed-between-halves':
   'at-least-one-half-tied';
 return {sourcePathId:g.sourcePathId,candidate:g.candidate,
  courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,
  styleA,styleB,axis,
  fullMeanGapPoints:mean,
  split15MeanGapsPoints:halves,
  status,direction:status==='strict-direction-repeated'?
    (signs[0]>0?styleA:styleB):null,
  uncertainForProduct:true};
}
function compareSizes(a,b){
 if(a.sourcePathId!==b.sourcePathId||a.courseId!==b.courseId||
    a.mode!==b.mode||a.styleA!==b.styleA||a.styleB!==b.styleB||
    a.axis!==b.axis||a.fieldSize!==9||b.fieldSize!==12)
  throw Error('Mismatched paired field-size comparison');
 const strict='strict-direction-repeated';
 const status=a.status===strict&&b.status===strict?
   a.direction===b.direction?'same-strict-direction-both-field-sizes':
    'strict-direction-reversed-between-field-sizes':
   'held-at-least-one-field-size';
 return {sourcePathId:a.sourcePathId,candidate:a.candidate,
  courseId:a.courseId,mode:a.mode,
  styleA:a.styleA,styleB:a.styleB,axis:a.axis,
  nine:a.status,twelve:b.status,
  status,notGameActivation:true};
}
function count(rows,property,values){
 return Object.fromEntries(values.map(v=>[v,rows.filter(x=>x[property]===v).length]));
}
function audit(source){
 const groups=validate(source),pairs=[],fullFour=[];
 const pairStatus=['strict-direction-repeated','both-halves-tied',
  'at-least-one-half-tied','direction-reversed-between-halves'];
 for(const g of groups.values()){
  const forW=[],forO=[];
  for(const [a,b] of sortedPairs){
   if(!g.styles.has(a)||!g.styles.has(b))continue;
   for(const axis of ['W','O']){
    const entry=pair(g,a,b,axis);pairs.push(entry);
    (axis==='W'?forW:forO).push(entry);
   }
  }
  if(g.styles.size===4)fullFour.push({
   sourcePathId:g.sourcePathId,candidate:g.candidate,
   courseId:g.courseId,fieldSize:g.fieldSize,mode:g.mode,
   strictW:forW.length===6&&forW.every(x=>x.status==='strict-direction-repeated'),
   strictO:forO.length===6&&forO.every(x=>x.status==='strict-direction-repeated')
  });
 }
 const headcount=[];
 const indexes=new Map(pairs.map(p=>[
  [p.sourcePathId,p.courseId,p.mode,p.fieldSize,p.styleA,p.styleB,p.axis].join('|'),p]));
 for(const p of pairs){
  if(p.fieldSize!==9)continue;
  const q=indexes.get([p.sourcePathId,p.courseId,p.mode,12,
   p.styleA,p.styleB,p.axis].join('|'));
  if(q)headcount.push(compareSizes(p,q));
 }
 const summarizeAxis=axis=>{
  const per=pairs.filter(x=>x.axis===axis);
  const stable=per.filter(x=>x.status==='strict-direction-repeated');
  const gap=r=>Math.abs(r.fullMeanGapPoints);
  return {pairedStyleComparisons:per.length,
   bySplitHalfStatus:count(per,'status',pairStatus),
   repeatedStrictWithMeanGapLE1Point:stable.filter(r=>gap(r)<=1).length,
   repeatedStrictWithMeanGapLT5Points:stable.filter(r=>gap(r)<5).length,
   meanGapLE1Point:per.filter(r=>gap(r)<=1).length,
   strictCompleteFourStyleContexts:fullFour.filter(x=>axis==='W'?x.strictW:x.strictO).length,
   fullFourStyleContexts:fullFour.length,
   byCandidate:Object.fromEntries(['absolute-order','corner-with-rank-rate'].map(c=>[
    c,count(per.filter(x=>x.candidate===c),'status',pairStatus)])),
   representativeReversals:per.filter(x=>x.status==='direction-reversed-between-halves')
    .slice(0,12).map(x=>({sourcePathId:x.sourcePathId,courseId:x.courseId,
     fieldSize:x.fieldSize,mode:x.mode,styleA:x.styleA,styleB:x.styleB,
     meanGapPoints:x.fullMeanGapPoints,split15:x.split15MeanGapsPoints}))};
 };
 const counts=Object.fromEntries(['W','O'].map(a=>[a,summarizeAxis(a)]));
 const status=['same-strict-direction-both-field-sizes',
  'held-at-least-one-field-size',
  'strict-direction-reversed-between-field-sizes'];
 const between=Object.fromEntries(['W','O'].map(axis=>[
  axis,count(headcount.filter(x=>x.axis===axis),'status',status)]));
 return {
  schemaVersion:1,
  status:'P2-original-rank-corner-two-axis-split15-direction-audit-not-game-grade',
  provenance:{modelRevision:MODEL,sourceDictionarySha256:SOURCE,
   sourceModelReportSha256:PIN},
  design:{
   raceCount:1440,
   sourcePaths:32,
   sourcePathContextGroups:groups.size,
   measuredStyleContextCells:source.contextCells.length,
   styleNames:STYLES,
   axes:{W:'model 10m rank-window intersection opportunity',
    O:'model single-point rank occupancy; D=O-U; never W-U'},
   split:'exactly original rep 0..14 vs rep 15..29; paired by course, mode, headcount, scenario',
   criterion:'strict direction ONLY if the same ordered style has >1e-6 point advantage in BOTH disjoint halves',
   scope:'each original source path/course/headcount/mode separately; no uniform averaging or pooled opponent composition'
  },
  axis:counts,
  crossHeadcount:between,
  crossHeadcountComparedPairs:headcount.length/2,
  fullFourContextCount:fullFour.length,
  maximumAbsoluteSingleStyleW15SplitDeltaPoints:Number(Math.max(
   ...source.contextCells.map(c=>Math.abs(c.split15SeedGroups[0].WmeanPercent-
    c.split15SeedGroups[1].WmeanPercent))).toFixed(6)),
  caveats:[
   'Direction agreement across two 15-seed groups is a descriptive sensitivity check, not a confidence interval or statistical significance.',
   'Pairs, contexts and gold/white original paths use correlated underlying races and may duplicate identical source rank conditions. Counts are NOT independent sample counts.',
   'Equal/jitter10, fixed courses, artificially balanced 9/12 rosters and a skill-free model do not establish Japanese-game proc rates.',
   'No automatic style grade: very small nonzero margins may be direction-consistent but practically negligible. Record 1/5-point descriptive diagnostics only.',
   'Field-size comparison is within separate matched synthetic rosters, not an isolated causal effect of number of runners.',
   'Known extra AND, alternative OR, preconditions and multiple Invoke are NOT combined. Unstudied predicates are neither neutral nor zero.',
   'No effect usefulness, card ranking, final P2/P3 suitability threshold or user-facing change is asserted.'
  ]
 };
}
function main([path,out]){
 if(!out)throw Error('Usage: skill_rank_corner_split_stability.cjs fixed-1440.json output-summary.json');
 const bytes=fs.readFileSync(path);
 const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 if(sha!==PIN)throw Error('Unpinned 1440-race rank/corner report SHA: '+sha);
 const result=audit(JSON.parse(bytes.toString('utf8')));
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({
  status:result.status,
  population:{styleCells:result.design.measuredStyleContextCells,
   fourStyleContexts:result.fullFourContextCount,
   pairsPerAxis:result.axis.W.pairedStyleComparisons},
  W:result.axis.W,
  O:result.axis.O,
  crossHeadcountW:result.crossHeadcount.W,
  crossHeadcountO:result.crossHeadcount.O,
  maxStyleHalfDelta:result.maximumAbsoluteSingleStyleW15SplitDeltaPoints
 },null,2));
}
if(require.main===module){
 try{main(process.argv.slice(2))}
 catch(error){console.error(error.stack||error);process.exitCode=1}
}
module.exports={STATUS,MODEL,SOURCE,PIN,STYLES,AXES,EPS,validate,pair,
 compareSizes,audit,main};
