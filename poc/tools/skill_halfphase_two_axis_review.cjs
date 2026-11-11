#!/usr/bin/env node
'use strict';
/*
 * P2.28: reuse exactly the pinned BALANCED 720-race short-window model.
 *
 * W: 10m-window rank-band intersection;
 * O: rank-band point occupancy;
 * U: exact projected integer rank-band width / entrant field;
 * D: O - U (never W - U).
 *
 * This adapter uses original single-AND/OR candidate paths from P2.27,
 * requires source-eligible courses, and retains 15+15 directional checks.
 * It does not invent high/medium/low thresholds or model a full skill proc.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const expanded=require('./globalsim_position_expanded.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const projection=require('../src/skill_order_rate_bounds.cjs');
const STYLES=expanded.STYLES;
const PAIRS=STYLES.flatMap((s,i)=>STYLES.slice(i+1).map(t=>[s,t]));
const SHORT_SHA='206d9db77299189f91fea649a40effbe9ca2d2203c9d0b69c7873bfacee04c27';
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const TINY=0.00001; // Numerical compare tolerance ONLY, never a rating threshold.
const round=x=>Number(x.toFixed(6));
const ids=[...new Set(expanded.COURSES.map(c=>c.id))];
const allowed=(v,op,x)=>{
 if(!Number.isSafeInteger(v)||!Number.isSafeInteger(x))
  throw Error('Non-integral source race gate');
 if(op==='==')return v===x;
 if(op==='!=')return v!==x;
 if(op==='>=')return v>=x;
 if(op==='<=')return v<=x;
 if(op==='>')return v>x;
 if(op==='<')return v<x;
 throw Error('Unsupported original race gate operator');
};
const sign=x=>x>TINY?'+':x< -TINY?'-':'=';
const k=x=>[x.courseId,x.fieldSize,x.mode,x.windowKey,x.bandId,x.style].join('|');
const h=x=>k(x)+'|'+x.half;
function validate(short,split,cohort){
 if(short?.status!=='research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate'||
  short.sourceRevision!==expanded.PIN||short.scenario!=='balanced'||
  short.simulations!==720||short.seedsPerCell!==30||
  short.contextsPerWindow!==24||short.perContextRows!==4224||
  !Array.isArray(short.contextRows)||short.contextRows.length!==4224)
  throw Error('Not the pinned balanced 720-race model report');
 if(split?.status!=='p2-fixed-15-plus-15-short-window-bands-not-game-activation'||
  split.sourceRevision!==expanded.PIN||split.seedsPerHalf!==15||
  split.baseRaces!==720||split.perContextRows!==8448||
  !Array.isArray(split.contextRows)||split.contextRows.length!==8448)
  throw Error('Missing exact 15+15 pinned seed-split W/O data');
 if(cohort?.status!=='P2-source-only-half-phase-rank-feasibility-not-style-rating'||
  cohort?.source?.sha256!==SOURCE_SHA||cohort?.baseline?.appSkills!==881||
  cohort?.baseline?.sourceMatched!==818||
  cohort?.counts?.halfTimeExactBandDirect!==75||
  !Array.isArray(cohort.examples))
  throw Error('Unverified original 75-skill source candidate cohort');
 const cs=new Map(),hs=new Map();
 for(const [source,rows,map] of [['full',short.contextRows,cs],
  ['split',split.contextRows,hs]]){
  for(const x of rows){
   if(!ids.includes(x.courseId)||![9,12].includes(x.fieldSize)||
    !['equal','jitter10'].includes(x.mode)||!STYLES.includes(x.style)||
    !Number.isSafeInteger(x.runners)||x.runners<=0||
    !short.windows.some(w=>w.key===x.windowKey)||
    !bands.some(b=>b.id===x.bandId))
    throw Error('Invalid model '+source+' context key');
   if(source==='split'&&!['first15','last15'].includes(x.half))
    throw Error('Invalid source split half');
   for(const key of ['pointPercent','random10mOpportunityPercent']){
    if(!Number.isFinite(x[key])||x[key]<0||x[key]>100)
     throw Error('Invalid W/O observed number');
   }
   if(x.pointPercent>x.random10mOpportunityPercent+1e-5)
    throw Error('10m event W cannot be smaller than point occupancy O');
   const id=source==='full'?k(x):h(x);
   if(map.has(id))throw Error('Duplicate original '+source+' context');
   map.set(id,x);
  }
 }
 if(cs.size!==4224||hs.size!==8448)
  throw Error('Incomplete model context or seed-half pairing');
 for(const x of cs.values()){
  const a=hs.get(k(x)+'|first15'),b=hs.get(k(x)+'|last15');
  if(!a||!b||x.runners!==a.runners+b.runners)
   throw Error('Unpaired fixed-seed half observations');
  const o=(a.pointPercent*a.runners+b.pointPercent*b.runners)/x.runners;
  const w=(a.random10mOpportunityPercent*a.runners+
   b.random10mOpportunityPercent*b.runners)/x.runners;
  if(Math.abs(o-x.pointPercent)>0.00001||
    Math.abs(w-x.random10mOpportunityPercent)>0.00001)
   throw Error('Split W/O do not reconstruct published 30-seed model row');
 }
 return {cs,hs};
}
const courseType={sprint:1,mile:2,'mile-alternate-track':2,
 middle:3,'middle-alternate-track':3,long:4};
function sourceCourses(path){
 if(!path||!Array.isArray(path.sourceConditions)||
  !Array.isArray(path.eligibleStyles))
  throw Error('Incomplete original source direct path');
 const constraints=path.sourceConditions.filter(c=>![
  'order_rate','running_style','phase_firsthalf_random',
  'phase_laterhalf_random'].includes(c.type));
 const reasons=[];
 for(const c of constraints)
  if(!['distance_type','ground_type'].includes(c.type))
   reasons.push('unmeasured-extra-source-condition:'+c.type);
 // GlobalSim fixed balanced course set is TURF ONLY.
 for(const c of constraints.filter(c=>c.type==='ground_type')){
  if(c.operator!=='=='||c.value!==1)
   reasons.push('unsupported-source-ground-type');
 }
 const restricted=constraints.filter(c=>c.type==='distance_type');
 if(restricted.some(c=>!['==','!=','<','<=','>','>='].includes(c.operator)||
  !Number.isSafeInteger(c.value)))
  reasons.push('unsupported-distance-type-operator');
 const courses=expanded.COURSES.filter(c=>
  restricted.every(p=>allowed(courseType[c.group],p.operator,p.value)));
 if(!courses.length)reasons.push('no-matching-fixed-model-courses');
 return {status:reasons.length?'held-source-race-qualifier':'matched',
  reasons,courses:courses.map(c=>c.id),
  sourceRaceGates:constraints};
}
function stableDirection(values){
 if(!values.length||values.some(x=>!Number.isFinite(x)))
  return {status:'unresolved-data',direction:null};
 const chars=values.map(sign);
 const distinct=new Set(chars);
 if(distinct.size!==1||distinct.has('='))
  return {status:'held-tie-or-context-reversal',direction:null,
   signs:{positive:chars.filter(x=>x==='+').length,
    negative:chars.filter(x=>x==='-').length,
    tied:chars.filter(x=>x==='=').length}};
 return {status:'strict-same-direction-in-all-contexts-and-seed-halves',
  direction:chars[0]};
}
function metricRange(rows,field){
 return {min:round(Math.min(...rows.map(x=>x[field]))),
  max:round(Math.max(...rows.map(x=>x[field])))};
}
function evaluate(short,split,cohort){
 const {cs,hs}=validate(short,split,cohort);
 const result=[];
 const windows=new Set(short.windows.map(w=>w.key));
 const direct=cohort.examples.flatMap(skill=>skill.paths.filter(p=>p.direct)
  .map(path=>({skill,path})));
 if(direct.length!==75||
  new Set(direct.map(x=>x.skill.skillId)).size!==75)
  throw Error('Original direct 75-skill set unexpectedly changed');
 for(const {skill,path} of direct){
  const windowKey=path.timeType+':'+path.phaseIndex;
  if(!windows.has(windowKey)||
   !bands.find(b=>b.id===path.bandId)||
   path.extraAndTypes.length||path.hasAlternativePaths)
   throw Error('Original 75-skill path is not directly modelable');
  const gate=sourceCourses(path);
  if(gate.status!=='matched'){
   result.push({skillId:skill.skillId,sourceNumericId:skill.sourceNumericId,
    skillName:skill.name,windowKey,bandId:path.bandId,
    status:gate.status,heldReasons:gate.reasons,
    sourceRaceGates:gate.sourceRaceGates});
   continue;
  }
  const evidence={};
  const band=bands.find(x=>x.id===path.bandId);
  for(const style of STYLES){
   if(!path.eligibleStyles.includes({
    Nige:'逃げ',Senkou:'先行',Sasi:'差し',Oikomi:'追込'}[style])){
    evidence[style]={status:'explicit-style-ineligible'};continue;
   }
   const contexts=[];
   for(const courseId of gate.courses)
    for(const fieldSize of [9,12])
     for(const mode of ['equal','jitter10']){
      const key=k({courseId,fieldSize,mode,windowKey,
       bandId:path.bandId,style});
      const item=cs.get(key),first=hs.get(key+'|first15'),
       last=hs.get(key+'|last15');
      if(!item||!first||!last)throw Error('Missing matched source model');
      const ranks=projection.andProjection(band.predicates,fieldSize);
      if(ranks.status!=='rank-subcondition-projection'||!ranks.positions?.length)
       throw Error('Original rank predicate cannot project to integer ranks');
      const U=100*ranks.positions.length/fieldSize;
      const f=x=>({W:x.random10mOpportunityPercent,
       O:x.pointPercent,U:round(U),D:round(x.pointPercent-U)});
      contexts.push({courseId,fieldSize,mode,all:f(item),
       first15:f(first),last15:f(last)});
     }
   const all=contexts.map(c=>c.all);
   const splitValues=contexts.flatMap(c=>[c.first15.D,c.last15.D]);
   evidence[style]={status:'model-contexts-only',
    contexts:contexts.length,
    byFieldSize:Object.fromEntries([9,12].map(n=>{
     const cells=contexts.filter(c=>c.fieldSize===n);
     return [n,{contextCount:cells.length,
      WPercent:metricRange(cells.map(c=>c.all),'W'),
      OPercent:metricRange(cells.map(c=>c.all),'O'),
      UPercent:metricRange(cells.map(c=>c.all),'U'),
      DPoints:metricRange(cells.map(c=>c.all),'D'),
      deviationDirection:stableDirection(cells.flatMap(c=>
       [c.all.D,c.first15.D,c.last15.D]))}];
    })),
    deviationDirection:stableDirection([...all.map(x=>x.D),...splitValues]),
    detail:contexts};
  }
  const pairs=PAIRS.map(([first,second])=>{
   if(evidence[first].status!=='model-contexts-only'||
    evidence[second].status!=='model-contexts-only')
    return {first,second,status:'held-explicit-ineligible-pair'};
   const A=evidence[first].detail,B=evidence[second].detail;
   if(A.length!==B.length||A.some((x,i)=>x.courseId!==B[i].courseId||
    x.fieldSize!==B[i].fieldSize||x.mode!==B[i].mode))
    throw Error('Inconsistent matched contexts between styles');
   const dimension=(metric,source)=>
    stableDirection(A.flatMap((a,i)=>{
     const b=B[i];
     return source.map(s=>a[s][metric]-b[s][metric]);
    }));
   return {first,second,status:'model-rank-component-pair-comparison-only',
    WDirection:dimension('W',['all','first15','last15']),
    DDirection:dimension('D',['all','first15','last15']),
    // W and D represent distinct quantities and remain separate.
    contextCount:A.length};
  });
  result.push({skillId:skill.skillId,sourceNumericId:skill.sourceNumericId,
   skillName:skill.name,windowKey,bandId:path.bandId,
   status:'model-two-axis-partial-original-condition-only',
   sourceRaceGates:gate.sourceRaceGates,
   modelCourses:gate.courses,eligibleStyles:path.eligibleStyles,
   styles:evidence,pairs});
 }
 const stats={
  directCandidates:result.length,
  modeled:result.filter(x=>x.status==='model-two-axis-partial-original-condition-only').length,
  heldRaceQualifiers:result.filter(x=>x.status==='held-source-race-qualifier').length,
  modeledPairs:result.flatMap(x=>x.pairs||[]).filter(x=>x.status==='model-rank-component-pair-comparison-only').length,
  stableW:result.flatMap(x=>x.pairs||[]).filter(x=>
   x.WDirection?.status==='strict-same-direction-in-all-contexts-and-seed-halves').length,
  heldW:result.flatMap(x=>x.pairs||[]).filter(x=>
   x.status==='model-rank-component-pair-comparison-only'&&
   x.WDirection?.status!=='strict-same-direction-in-all-contexts-and-seed-halves').length,
  stableD:result.flatMap(x=>x.pairs||[]).filter(x=>
   x.DDirection?.status==='strict-same-direction-in-all-contexts-and-seed-halves').length,
  skillsWithStableWPair:result.filter(x=>x.pairs?.some(p=>
   p.WDirection?.status==='strict-same-direction-in-all-contexts-and-seed-halves')).length
 };
 if(stats.modeled+stats.heldRaceQualifiers!==75)
  throw Error('Missing source skills from P2.28 review');
 return {schemaVersion:1,
  status:'P2.28-balanced-two-axis-source-short-window-model-not-game-proc',
  source:{globalSimRevision:expanded.PIN,sourceUmaSimSHA256:SOURCE_SHA,
   sourceShortWindowReportSHA256:SHORT_SHA,
   originalModelRaces:720,splitRacesPerContext:[15,15]},
  summary:stats,
  definitions:{W:'10m random window intersects original rank band',
   O:'one point in original window occupies rank band',
   U:'100 * integer rank-band count / field size',
   D:'O-U (percentage points), NEVER W-U',
   relativeW:'signed per-source-window pairwise contrast across original matching courses, field sizes and equal/jitter10 15+15 seeds',
   specificitySign:'per-style sign of D across source contexts and both seed halves; zero, reversal and missing stay held'},
  items:result,
  limitations:[
   'Model W/O/D are descriptive simulated rank subcondition metrics and not a skill proc probability or effect utility.',
   'No threshold for high/medium/low is defined; strict direction is model-only, not a formal confidence interval.',
   'A comparison with one style explicitly ineligible is not a numeric comparison or zero-rate observation.',
   'Unverified ground/surface/race qualifiers and missing model courses are held, not projected to turf by assumption.',
   '9- and 12-horse races vary both entry count and fixed style roster; context effects are not isolated causal field-size effects.',
   'The uniform rank U is a virtual single-position baseline and MUST NOT be subtracted from window event W.',
   'Pairs within a skill and duplicate gold/white rank bands are not independent observations.',
   'No UI, P3 support-card ratings, acquisition paths or full AND/OR skill activation logic is modified.'
  ]};
}
function main(args){
 if(args.length!==4)throw Error('Usage: short.json split15.json p2-halfphase-source.json output.json');
 const [shortP,splitP,sourceP,outP]=args;
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const sh=fs.readFileSync(shortP);
 const digest=crypto.createHash('sha256').update(sh).digest('hex');
 if(digest!==SHORT_SHA)throw Error('Pinned short-window 720 model SHA drift: '+digest);
 const answer=evaluate(JSON.parse(sh),read(splitP),read(sourceP));
 fs.writeFileSync(outP,JSON.stringify(answer,null,2)+'\n');
 console.log(JSON.stringify({status:answer.status,summary:answer.summary,
  examples:answer.items.filter(x=>x.status==='model-two-axis-partial-original-condition-only')
   .slice(0,5).map(x=>({name:x.skillName,window:x.windowKey,
    stableWpairs:x.pairs.filter(p=>p.WDirection?.direction).map(p=>({
     pair:[p.first,p.second],sign:p.WDirection.direction})),
    dSample:x.styles.Senkou?.byFieldSize}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={SHORT_SHA,SOURCE_SHA,STYLES,PAIRS,TINY,sign,stableDirection,
 sourceCourses,validate,evaluate,main};
