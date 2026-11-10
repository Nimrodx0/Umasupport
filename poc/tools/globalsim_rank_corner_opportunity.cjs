#!/usr/bin/env node
'use strict';
/* P2 model-only replay of SOURCE-MATCHED 1-index absolute rank and original
 * corner_random AND order_rate subconditions. Not complete skill activation.
 *
 * The fixed UmaSim source uses the last four corners, left padded with nulls;
 * chooseRandom selects a 10m window with a final 2m start-position clamp.
 * This script measures the corresponding mathematical opportunity on fixed
 * skill-free GlobalSim position trajectories. NEVER map to skill/card grades.
 */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const source=require('../src/skill_rank_corner_source_cohort.cjs');
const roster=require('./globalsim_roster32.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const geometry=require('./globalsim_phase_random_10m.cjs');
const framesCheck=require('./globalsim_position_pilot.cjs');
const rank=require('../src/skill_order_rate_bounds.cjs');
const PHASE=[0,1/6,2/3,5/6,1];
const ALLOWED=new Set(['source-absolute-rank-phase-random-subcondition-candidate',
 'source-corner-rank-subcondition-candidate']);
const round=x=>Number(x.toFixed(6));
const key=(...x)=>x.join('|');
function verifyCandidates(x){
 if(!x||x.schemaVersion!==1||x.status!==
 'P2-absolute-order-and-corner-rank-source-path-feasibility-not-proc-rate'||
 x.sourceRecords!==818||x.source?.sha256!==roster.SOURCE_SHA||
 !Array.isArray(x.paths)||
 x.summary?.absoluteOrder?.distinctSkills!==34||
 x.summary?.cornerRank?.distinctSkills!==13)
  throw Error('Untrusted or changed original source candidate cohort');
 const supported=x.paths.filter(p=>ALLOWED.has(p.feasibility));
 if(supported.filter(p=>p.candidate==='absolute-order').length!==12||
    supported.filter(p=>p.candidate==='corner-with-rank-rate').length!==20)
  throw Error('Original 12 absolute and 20 corner paths changed');
 const seen=new Set();
 for(const p of supported){
  const k=pathKey(p);
  if(seen.has(k)||p.side!=='conditions'||p.fullyModeledSkill!==false||
   !Array.isArray(p.rankPredicates)||!p.rankPredicates.length||
   !Array.isArray(p.explicitPredicates)||!Array.isArray(p.otherAndTypes))
   throw Error('Untrustworthy study path '+k);
  seen.add(k);
 }
 return supported;
}
function pathKey(p){
 return key(p.sourceNumericId,p.invokeOffset,p.side,p.orIndex,p.candidate);
}
function courseMeta(course,meta){
 if(!course||!meta||meta.distance!==course.distance||
    meta.surface!==(course.surface==='turf'?1:2)||
    meta.distanceType!==course.distanceType||
    !Array.isArray(meta.corners)||!Number.isSafeInteger(meta.raceTrackId))
  throw Error('Model course differs from source course metadata');
 return meta;
}
function pred(actual,op,val){
 return rank.compare(actual,op,val);
}
function explicitMatch(p,course,meta,style){
 let anyUnsupported=false;
 for(const c of p.explicitPredicates){
  let actual=null;
  switch(c.type){
   case 'running_style':actual=roster.STYLES.indexOf(style)+1;break;
   case 'distance_type':actual=course.distanceType;break;
   case 'ground_type':actual=course.surface==='turf'?1:2;break;
   case 'track_id':actual=meta.raceTrackId;break;
   case 'rotation':actual=meta.turn;break;
   case 'course_distance':actual=course.distance;break;
   default:anyUnsupported=true;
  }
  if(anyUnsupported)return 'held-unverified-explicit-scope';
  if(!pred(actual,c.operator,c.value))return 'not-in-source-race-scope';
 }
 return 'eligible-in-source-race-scope';
}
function supportedWindow(p,course,meta){
 if(p.candidate==='corner-with-rank-rate'){
  if(p.sourceCornerIndex.length!==1||
     p.sourceCornerIndex[0].operator!=='=='||
     ![1,2,3,4].includes(p.sourceCornerIndex[0].value))
   return {status:'held-corner-index-not-supported'};
  const cornerNum=p.sourceCornerIndex[0].value,
   corners=meta.corners.slice(-4);
  while(corners.length<4)corners.unshift(null);
  const c=corners[cornerNum-1];
  if(!c)return {status:'held-selected-corner-absent'};
  const start=c.start,end=c.start+c.length;
  if(!Number.isFinite(start)||!Number.isFinite(end)||
     start<0||end>course.distance+1e-6||end-start<=10)
   return {status:'held-corner-range-invalid'};
  return {status:'model-zone-only',kind:'corner-random-10m',
   start,end,cornerNumber:cornerNum};
 }
 if(p.candidate==='absolute-order'){
  if(p.timingPredicates.length!==1||
     !['phase_random','phase_firsthalf_random','phase_laterhalf_random',
       'phase_firstquarter_random'].includes(p.timingPredicates[0].type))
   return {status:'held-unsupported-absolute-rank-window'};
  const t=p.timingPredicates[0];
  if(t.operator!=='=='||t.value<0||t.value>3)
   return {status:'held-unsupported-absolute-rank-window'};
  const phase=t.value,startRate=PHASE[phase],width=PHASE[phase+1]-startRate;
  const frac=t.type==='phase_firsthalf_random'?.5:
   t.type==='phase_laterhalf_random'?.5:
   t.type==='phase_firstquarter_random'?.25:1;
  const offset=t.type==='phase_laterhalf_random'?.5:0;
  const start=(startRate+width*offset)*course.distance,
   end=(startRate+width*(offset+frac))*course.distance;
  if(end-start<=10)return {status:'held-too-short-random-zone'};
  return {status:'model-zone-only',kind:t.type+'-10m',
   start,end,cornerNumber:null};
 }
 throw Error('Unrecognized fixed source cohort path');
}
function exactAllowed(p,n){
 const allowed=[];
 for(let order=1;order<=n;order++){
  let ok=true;
  for(const c of p.rankPredicates){
   if(c.type==='order'){
    if(!pred(order,c.operator,c.value)){ok=false;break}
   }else if(c.type==='order_rate'){
    const one=rank.predicate(c,n);
    if(one.status!=='projected-relative-to-sourced-integer-rounding')
     return {status:one.status,allowed:null};
    if(!one.positions.includes(order)){ok=false;break}
   }else throw Error('Unexpected original source rank type');
  }
  if(ok)allowed.push(order);
 }
 return {status:'integer-rank-subcondition-only',allowed};
}
function measurement(groups,p,plan,style,win,allowed,trace){
 const identity=pathKey(p);
 const k=key(identity,plan.course.id,plan.fieldSize,plan.mode,style);
 let g=groups.get(k);
 if(!g){
  g={sourceNumericId:p.sourceNumericId,candidate:p.candidate,
   sourcePathId:identity,
   courseId:plan.course.id,surface:plan.course.surface,
   distanceType:plan.course.distanceType,
   fieldSize:plan.fieldSize,mode:plan.mode,style,
   windowKind:win.kind,
   otherAndTypes:[...p.otherAndTypes],
   hasAlternativeOR:p.siblingORCount>1,
   hasPreconditions:p.preconditionsGroups>0,
   hasMultipleInvokes:p.invokeCount>1,
   rankPositions:allowed.size,
   runners:0,unresolved:0,
   sumW:0,sumO:0,
   halves:[{runners:0,unresolved:0,sumW:0,sumO:0},
    {runners:0,unresolved:0,sumW:0,sumO:0}]};
  groups.set(k,g);
 }
 const half=plan.rep<15?0:1;
 g.runners++;g.halves[half].runners++;
 if(trace.status!=='estimate'){
  if(!['held-tied-position','held-incomplete-distance'].includes(trace.status))
   throw Error('Unhandled race trajectory status');
  g.unresolved++;g.halves[half].unresolved++;
  return;
 }
 const m=geometry.measureWindows(trace.segments,allowed,
  win.start,win.end);
 g.sumW+=100*m.tenMetreWindowOpportunity;
 g.sumO+=100*m.pointOccupancy;
 g.halves[half].sumW+=100*m.tenMetreWindowOpportunity;
 g.halves[half].sumO+=100*m.pointOccupancy;
}
function observe(groups,candidates,courseData,plan,frames){
 framesCheck.checkFrames(frames,plan.fieldSize);
 const meta=courseMeta(plan.course,courseData[String(plan.course.id)]);
 const cache=new Map();
 for(const p of candidates){
  const win=supportedWindow(p,plan.course,meta);
  if(win.status!=='model-zone-only')continue;
  const allowedValue=exactAllowed(p,plan.fieldSize);
  if(allowedValue.status!=='integer-rank-subcondition-only')continue;
  const allowed=new Set(allowedValue.allowed);
  for(let runner=0;runner<plan.fieldSize;runner++){
   const style=plan.strategies[runner];
   if(explicitMatch(p,plan.course,meta,style)!==
      'eligible-in-source-race-scope')continue;
   const zone=key(runner,win.start,win.end);
   if(!cache.has(zone))cache.set(zone,geometry.rankSegments(
    frames,runner,win.start,win.end,{validated:true}));
   measurement(groups,p,plan,style,win,allowed,cache.get(zone));
  }
 }
}
function toBounded(g){
 const result=g.halves.map(x=>({
  runners:x.runners,unresolved:x.unresolved,
  WlowerPercent:round(x.sumW/x.runners),
  WupperPercent:round((x.sumW+100*x.unresolved)/x.runners),
  WmeanPercent:x.unresolved?null:round(x.sumW/x.runners),
  OmeanPercent:x.unresolved?null:round(x.sumO/x.runners)}));
 const U=100*g.rankPositions/g.fieldSize;
 return {
  sourceNumericId:g.sourceNumericId,candidate:g.candidate,
  sourcePathId:g.sourcePathId,
  courseId:g.courseId,surface:g.surface,distanceType:g.distanceType,
  fieldSize:g.fieldSize,mode:g.mode,style:g.style,windowKind:g.windowKind,
  sourceRankPositions:g.rankPositions,
  modelUniformPointReferenceUPercent:round(U),
  runners:g.runners,unresolvedRunners:g.unresolved,
  W10mOpportunityPercent:g.unresolved?null:round(g.sumW/g.runners),
  W10mLowerPercent:round(g.sumW/g.runners),
  W10mUpperPercent:round((g.sumW+100*g.unresolved)/g.runners),
  OPointOccupancyPercent:g.unresolved?null:round(g.sumO/g.runners),
  DPointMinusUniformPercentPoints:g.unresolved?null:
   round(g.sumO/g.runners-U),
  split15SeedGroups:result,
  sourceOtherAndTypes:g.otherAndTypes,
  sourceHasAlternativeOr:g.hasAlternativeOR,
  sourceHasPreconditions:g.hasPreconditions,
  sourceHasMultipleInvokes:g.hasMultipleInvokes,
  inferenceStatus:'source-rank-subcondition-only-not-skill-rating'
 };
}
function report(candidates,groups,plans){
 const cells=[...groups.values()].map(toBounded).sort((a,b)=>
  a.sourcePathId.localeCompare(b.sourcePathId)||a.fieldSize-b.fieldSize||
  a.courseId-b.courseId||a.mode.localeCompare(b.mode)||
  roster.STYLES.indexOf(a.style)-roster.STYLES.indexOf(b.style));
 if(!cells.length)throw Error('No source-matched model context measured');
 if(cells.some(x=>x.runners<=0||!Number.isFinite(x.W10mLowerPercent)||
  x.W10mLowerPercent>x.W10mUpperPercent+1e-5||
  x.split15SeedGroups.some(s=>s.runners<=0||
   s.WlowerPercent>s.WupperPercent+1e-5)||
  (x.W10mOpportunityPercent!==null&&
    (x.OPointOccupancyPercent>x.W10mOpportunityPercent+1e-5||
     x.W10mOpportunityPercent>100+1e-5))))
  throw Error('Model rank window summary inconsistent');
 const count=(field,val)=>cells.filter(c=>c[field]===val).length;
 return {schemaVersion:1,
  status:'P2-fixed-GlobalSim-original-rank-corner-10m-partial-opportunity-only',
  globalSimRevision:roster.PIN,
  sourceUmaSimSha256:roster.SOURCE_SHA,
  scenario:'balanced-reference-not-real-population',
  seedsPerCourseFieldMode:30,
  modelCourseCount:roster.COURSES.length,
  simulations:plans.length,
  eligibleSourcePaths:candidates.length,
  matchedContextCells:cells.length,
  absoluteContextCells:count('candidate','absolute-order'),
  cornerContextCells:count('candidate','corner-with-rank-rate'),
  unresolvedContextCells:cells.filter(x=>x.unresolvedRunners>0).length,
  seedHalfPopulationsArePaired:true,
  contextCells:cells,
  limitations:[
   'W is the fraction of 10m random trigger-window start opportunities that intersect the source rank condition along synthetic skill-free trajectories; NOT real game skill activation probability.',
   'O is the distinct one-point rank occupancy; D=O-U, never W-U. Context and 9/12 runner sizes are not pooled.',
   'Only source-exact original order/ order_rate AND source phase_random or corner_random subconditions; other AND, OR, preConditions or separate Invokes are NOT modeled.',
   'Source race style/ground/distance constraints are respected and missing styles or missing corner geometry are not replaced with zeros.',
   'Uniform rank U is hypothetical; model corner geometry and Japanese game source timing/ tie rules still require independent validation.',
   'No skill effect utility, skill/card suitability label, card score or user-facing UI is implied.'
  ]};
}
async function execute(cohort,courseData,template,engine){
 const candidates=verifyCandidates(cohort);
 const plans=roster.plans('balanced',{seedsPerCell:30});
 const groups=new Map();
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 let stderr='',writeError=null;
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',x=>{stderr=(stderr+x).slice(-5000)});
 child.stdin.on('error',e=>{writeError=e});
 const done=new Promise(resolve=>child.once('close',(code,signal)=>
  resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const feed=(async()=>{
  for(const p of plans){
   if(child.killed||child.stdin.destroyed||child.exitCode!==null)break;
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>{
     const finish=()=>{
      child.stdin.off('drain',finish);child.stdin.off('close',finish);
      child.off('close',finish);resolve();
     };
     child.stdin.once('drain',finish);
     child.stdin.once('close',finish);
     child.once('close',finish);
    });
  }
  if(!child.stdin.destroyed)child.stdin.end();
 })();
 let received=0,failure=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(received>=plans.length)throw Error('Too many fixed GlobalSim replies');
   const p=plans[received],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==p.seed)
    throw Error('Simulator source-matched reply failed '+received);
   observe(groups,candidates,courseData,p,reply.frames);
   received++;
  }
  await feed;
 }catch(e){failure=e;child.kill()}
 const exit=await done;
 if(failure)throw failure;
 if(writeError&&writeError.code!=='EPIPE')throw writeError;
 if(exit.code!==0||received!==plans.length)
  throw Error('Incomplete frozen model replay '+
   JSON.stringify({exit,received,expected:plans.length,stderr}));
 return report(candidates,groups,plans);
}
async function main([cohortFile,courseDataFile,templateFile,engine,outFile]){
 if(!outFile)throw Error('Usage: globalsim_rank_corner_opportunity.cjs '+
  'original-cohort.json course_data.json frozen-template.jsonl engine output.json');
 const cohort=JSON.parse(fs.readFileSync(cohortFile,'utf8'));
 const courseData=JSON.parse(fs.readFileSync(courseDataFile,'utf8'));
 const text=fs.readFileSync(templateFile,'utf8').trim().split(/\r?\n/);
 if(text.length!==1)throw Error('Exactly one original no-skill template required');
 const result=await execute(cohort,courseData,JSON.parse(text[0]),engine);
 fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,simulations:result.simulations,
  eligibleSourcePaths:result.eligibleSourcePaths,
  matchedContextCells:result.matchedContextCells,
  absoluteContextCells:result.absoluteContextCells,
  cornerContextCells:result.cornerContextCells,
  unresolvedContextCells:result.unresolvedContextCells,
  selectedExamples:result.contextCells.filter(x=>
   x.fieldSize===9&&x.mode==='equal'&&
   ['200712','202742','202522','203982'].includes(x.sourceNumericId))
   .slice(0,12)},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={verifyCandidates,courseMeta,explicitMatch,supportedWindow,
 exactAllowed,observe,report,execute,main};
