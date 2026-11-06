#!/usr/bin/env node
'use strict';
/* P2 RESEARCH, not production. Evaluate the geometry of a 10 m random
 * trigger window against a rank predicate on a SKILL-FREE GlobalSim trace.
 * This approximates the pinned UmaSim SkillChecker.kt mechanism, not the
 * proprietary game engine, pre-race wisdom lot, or complete skill activation.
 *
 * Sample U uniformly over the phase zone [a,b]. SkillChecker constructs
 * s=min(U,b-2) and tests other conditions throughout [s,min(s+10,b)].
 * For eligible rank-distance set S, this study calculates the measure of
 * U for which the window intersects S, using piecewise-linear race frames.
 */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const dist=require('./globalsim_rank_distribution.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const bounds=require('../src/skill_order_rate_bounds.cjs');
const PIN=pilot.PIN;
const STYLES=expanded.STYLES;
const WINDOW_METRES=10;
const TAIL_CLAMP_METRES=2;
const EPS=1e-9;
const round=x=>Number(x.toFixed(6));
const pos=h=>Array.isArray(h)?h[0]:h?.pos;
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
function rankSegments(frames,runner,zoneStart,zoneEnd,{validated=false}={}){
 const n=frames?.[0]?.horses?.length;
 if(!Number.isSafeInteger(n)||n<2||!Number.isSafeInteger(runner)||
  runner<0||runner>=n||!Number.isFinite(zoneStart)||
  !Number.isFinite(zoneEnd)||zoneEnd-zoneStart<=10)
  throw Error('Bad rank trajectory inputs');
 if(!validated)pilot.checkFrames(frames,n);
 const fragments=[];
 let covered=0,ambiguous=0;
 for(let k=1;k<frames.length;k++){
  const prev=frames[k-1].horses,next=frames[k].horses;
  const a=pos(prev[runner]),b=pos(next[runner]),travel=b-a;
  if(travel< -EPS)throw Error('Backwards runner');
  if(travel<=EPS||b<zoneStart-EPS||a>zoneEnd+EPS)continue;
  const lo=clamp((zoneStart-a)/travel,0,1);
  const hi=clamp((zoneEnd-a)/travel,0,1);
  if(hi<=lo+1e-12)continue;
  const cuts=[lo,hi];
  for(let i=0;i<n;i++){
   if(i===runner)continue;
   const d0=pos(prev[i])-a,d1=pos(next[i])-b,rate=d1-d0;
   if(Math.abs(rate)<1e-14)continue;
   const cross=-d0/rate;
   if(cross>lo+1e-12&&cross<hi-1e-12)cuts.push(cross);
  }
  cuts.sort((x,y)=>x-y);
  for(let c=1;c<cuts.length;c++){
   const first=cuts[c-1],last=cuts[c];
   const length=(last-first)*travel;
   if(length<=1e-12)continue;
   const mid=(first+last)/2,own=a+mid*travel;
   let ahead=0,tie=false;
   for(let i=0;i<n;i++){
    if(i===runner)continue;
    const other=pos(prev[i])+(pos(next[i])-pos(prev[i]))*mid;
    if(Math.abs(other-own)<=1e-8){tie=true;break;}
    if(other>own)ahead++;
   }
   covered+=length;
   if(tie){ambiguous+=length;continue}
   const seg={start:a+first*travel,end:a+last*travel,rank:ahead+1};
   const prior=fragments.at(-1);
   if(prior&&prior.rank===seg.rank&&
    Math.abs(prior.end-seg.start)<=1e-7)
    prior.end=seg.end;
   else fragments.push(seg);
  }
 }
 const span=zoneEnd-zoneStart;
 if(Math.abs(covered-span)>1e-4)
  return {status:'held-incomplete-distance',segments:null,
   coveredMetres:covered,expectedMetres:span};
 if(ambiguous>1e-5)
  return {status:'held-tied-position',segments:null,
   ambiguousMetres:ambiguous};
 return {status:'estimate',segments:fragments};
}
function measureWindows(segments,allowed,zoneStart,zoneEnd,
 windowLength=WINDOW_METRES,tailClamp=TAIL_CLAMP_METRES){
 if(!Array.isArray(segments)||!(allowed instanceof Set)||
  !Number.isFinite(zoneStart)||!Number.isFinite(zoneEnd)||
  !Number.isFinite(windowLength)||windowLength<=0||
  !Number.isFinite(tailClamp)||tailClamp<0||
  zoneEnd-zoneStart<=Math.max(windowLength,tailClamp))
  throw Error('Bad random-window geometry');
 const L=zoneEnd-zoneStart,limit=zoneEnd-tailClamp;
 let occupancy=0,tailHits=false;
 const intervals=[];
 for(const s of segments){
  if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||
   s.start>s.end||s.start<zoneStart-1e-6||
   s.end>zoneEnd+1e-6||!Number.isSafeInteger(s.rank))
   throw Error('Invalid rank trajectory segment');
  if(!allowed.has(s.rank))continue;
  occupancy+=s.end-s.start;
  if(s.end>=limit-EPS&&s.start<=zoneEnd+EPS)tailHits=true;
  const lo=Math.max(zoneStart,s.start-windowLength);
  const hi=Math.min(limit,s.end);
  if(hi>lo)intervals.push([lo,hi]);
 }
 intervals.sort((a,b)=>a[0]-b[0]);
 let union=0,left=NaN,right=NaN;
 for(const [lo,hi] of intervals){
  if(Number.isNaN(left)){left=lo;right=hi;continue}
  if(lo<=right+EPS)right=Math.max(right,hi);
  else{union+=right-left;left=lo;right=hi}
 }
 if(!Number.isNaN(left))union+=right-left;
 const opportunity=(union+(tailHits?tailClamp:0))/L;
 const portion=occupancy/L;
 if(!Number.isFinite(opportunity)||opportunity< -1e-8||
  opportunity>1+1e-8||portion< -1e-8||portion>1+1e-8||
  opportunity+1e-8<portion)
  throw Error('Random 10m coverage is inconsistent with point occupancy');
 return {pointOccupancy:clamp(portion,0,1),
  tenMetreWindowOpportunity:clamp(opportunity,0,1),
  difference:clamp(opportunity,0,1)-clamp(portion,0,1)};
}
function collect(){
 const groups=new Map(),contexts=new Map();
 function append(plan,phase,band,style,measure){
  const key=[plan.course.id,plan.fieldSize,plan.mode,phase,band.id,style].join('|');
  if(!groups.has(key)){
   const g={courseId:plan.course.id,fieldSize:plan.fieldSize,
    mode:plan.mode,phase,bandId:band.id,style,
    n:0,pointSum:0,windowSum:0,minDelta:Infinity,maxDelta:-Infinity};
   groups.set(key,g);
  }
  const g=groups.get(key);
  g.n++;
  g.pointSum+=measure.pointOccupancy;
  g.windowSum+=measure.tenMetreWindowOpportunity;
  g.minDelta=Math.min(g.minDelta,measure.difference);
  g.maxDelta=Math.max(g.maxDelta,measure.difference);
 }
 return {groups,contexts,append};
}
function inspectRace(plan,frames,agg){
 const n=plan.fieldSize;
 pilot.checkFrames(frames,n);
 for(let runner=0;runner<n;runner++){
  const style=plan.strategies[runner];
  for(const phase of dist.PHASES){
   const start=phase.startRate*plan.course.distance;
   const end=phase.endRate*plan.course.distance;
   const trace=rankSegments(frames,runner,start,end,{validated:true});
   if(trace.status!=='estimate')
    throw Error('Unresolved rank geometry '+JSON.stringify({
     seed:plan.seed,style,phase:phase.phase,status:trace.status}));
   // Independent algorithm sanity check: original pinned rank occupancy.
   const old=dist.histogram(frames,runner,plan.course.distance,
    phase.startRate,phase.endRate,true);
   if(old.status!=='estimate')throw Error('Original rank study unresolved');
   for(const band of bands){
    const allowed=new Set(bounds.andProjection(band.predicates,n).positions);
    const measure=measureWindows(trace.segments,allowed,start,end);
    const oldPoint=old.rankFractions.reduce((sum,frac,i)=>
     sum+(allowed.has(i+1)?frac:0),0);
    if(Math.abs(oldPoint-measure.pointOccupancy)>1e-6)
     throw Error('Point-rank geometry disagrees with pinned study '+JSON.stringify({
      seed:plan.seed,style,phase:phase.phase,band:band.id,oldPoint,
      newPoint:measure.pointOccupancy}));
    agg.append(plan,phase.phase,band,style,measure);
   }
  }
 }
}
function report(agg,{seedsPerCell=30}={}){
 const contextRows=[...agg.groups.values()].map(g=>{
  if(g.n<=0)throw Error('No runner observations');
  const point=g.pointSum/g.n,window=g.windowSum/g.n;
  return {courseId:g.courseId,fieldSize:g.fieldSize,
   mode:g.mode,phase:g.phase,bandId:g.bandId,style:g.style,
   runners:g.n,pointPercent:round(100*point),
   random10mOpportunityPercent:round(100*window),
   upliftPoints:round(100*(window-point)),
   minRunnerUpliftPoints:round(100*g.minDelta),
   maxRunnerUpliftPoints:round(100*g.maxDelta)};
 }).sort((a,b)=>a.phase-b.phase||a.bandId.localeCompare(b.bandId)||
  a.style.localeCompare(b.style)||a.courseId-b.courseId||
  a.fieldSize-b.fieldSize||a.mode.localeCompare(b.mode));
 const byPhaseBand=[];
 for(const phase of dist.PHASES)for(const band of bands){
  const values={};
  for(const style of STYLES){
   const subset=contextRows.filter(r=>r.phase===phase.phase&&
    r.bandId===band.id&&r.style===style);
   if(subset.length!==24)throw Error('Missing balanced contexts '+phase.phase+'/'+band.id+'/'+style);
   const mean=k=>round(subset.reduce((a,b)=>a+b[k],0)/subset.length);
   values[style]={pointPercent:mean('pointPercent'),
    random10mOpportunityPercent:mean('random10mOpportunityPercent'),
    upliftPoints:mean('upliftPoints'),
    minContextUpliftPoints:round(Math.min(...subset.map(v=>v.upliftPoints))),
    maxContextUpliftPoints:round(Math.max(...subset.map(v=>v.upliftPoints))),
    contexts:subset.length};
  }
  byPhaseBand.push({phase:phase.phase,bandId:band.id,
   scenario:'balanced',styles:values});
 }
 if(contextRows.length!==24*4*11*4||byPhaseBand.length!==44)
  throw Error('Incomplete balanced phase-window evaluation');
 return {schemaVersion:1,
  status:'research-GlobalSim-10m-rank-opportunity-not-game-activation',
  sourceRevision:PIN,scenario:'balanced',seedsPerCell,
  simulations:24*seedsPerCell,contexts:24,
  perContextRows:contextRows.length,phaseBands:byPhaseBand.length,
  windowMetres:WINDOW_METRES,tailClampMetres:TAIL_CLAMP_METRES,
  method:'piecewise-linear ranking; uniform phase trigger start U, clamped at phaseEnd-2, eligible at any interpolated position in the ensuing 10m',
  byPhaseBand,contextRows,
  limitations:[
   'This is an analytical 10m trigger proxy over skill-free GlobalSim v77 position trajectories, not a real skill activation rate.',
   'Pinned UmaSim SkillChecker implementation chooses a 10m random area, but GlobalSim has no such skill-condition replay here.',
   'Crossing locations use piecewise-linear interpolation between recorded frames, not frame-by-frame game evaluator calls.',
   'Wisdom pre-race skill lottery, cooldown, skill interactions, arbitrary AND/OR and other condition types are excluded.',
   'Only balanced fixed opponents, 6 test courses, 9/12 runners and equal/jitter10 modes; not most-likely real roster.',
   'No high/low threshold or card evaluation is inferred from the reported differences.'
  ]};
}
async function run(template,enginePath,{seedsPerCell=30}={}){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2!==0)
  throw Error('Expected even seed count 2..30');
 const plans=expanded.makePlan({seedsPerCell})
  .filter(p=>p.scenario==='balanced');
 if(plans.length!==24*seedsPerCell)
  throw Error('Invalid balanced race plan');
 const agg=collect(),child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-4000)});
 const closed=new Promise(resolve=>child.once('close',code=>resolve(code)));
 const read=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const write=(async()=>{
  for(const p of plans){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let received=0,failure=null;
 try{
  for await(const line of read){
   if(!line.trim())continue;
   if(received>=plans.length)throw Error('Unexpected simulator reply');
   const plan=plans[received],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==plan.seed)
    throw Error('Wrong simulator reply or seed');
   inspectRace(plan,reply.frames,agg);
   received++;
  }
  await write;
 }catch(e){failure=e;child.kill();}
 const exit=await closed;
 if(failure)throw failure;
 if(exit!==0||received!==plans.length)
  throw Error('Incomplete GlobalSim run '+JSON.stringify({
   exit,received,wanted:plans.length,stderr}));
 return report(agg,{seedsPerCell});
}
async function main(args){
 const [templatePath,engine,output,seeds]=args;
 if(!templatePath||!engine||!output)
  throw Error('Usage: globalsim_phase_random_10m.cjs pinned-example.jsonl engine report.json [even-seeds]');
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Need one pinned GlobalSim v77 JSONL example');
 const doc=await run(JSON.parse(lines[0]),engine,
  {seedsPerCell:Number(seeds||30)});
 fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n');
 console.log(JSON.stringify({simulations:doc.simulations,
  contexts:doc.contexts,phaseBands:doc.phaseBands,
  example:doc.byPhaseBand.find(x=>x.phase===1&&x.bandId==='middle40to80')},
  null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={PIN,WINDOW_METRES,TAIL_CLAMP_METRES,rankSegments,
 measureWindows,collect,inspectRace,report,run,main};
