#!/usr/bin/env node
'use strict';
/* P2 research only. Race-block resampling and disjoint seed batches assess
 * GlobalSim v77 stability. None of these values is an actual skill rate. */
const fs=require('node:fs');
const pilot=require('./globalsim_position_pilot.cjs');
const dense=require('./globalsim_dense_window_validation.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const windows=require('./globalsim_window_profile.cjs');

const STYLES=expanded.STYLES;
const BOOTSTRAPS=400;
const sourceStatus='pinned-GlobalSim-v77-per-runner-rank-window-observations';
const rowKey=r=>[r.courseId,r.fieldSize,r.scenario,r.mode,r.rep,r.runnerIndex,r.windowId].join('|');
const cellKey=r=>[r.courseId,r.fieldSize,r.scenario,r.mode,r.style,r.windowId].join('|');
const pp=v=>v===null?null:Number((v*100).toFixed(6));
const average=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function checksum(s){
 let h=2166136261;
 for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}
 return (h>>>0)||1;
}
function random(seed){
 let x=seed>>>0;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
}
function quantile(sorted,q){
 if(!sorted.length)return null;
 const x=(sorted.length-1)*q,a=Math.floor(x),b=Math.ceil(x);
 return sorted[a]+(sorted[b]-sorted[a])*(x-a);
}
function summarizeRaceBlocks(races){
 const totals=races.reduce((x,r)=>({
  racesWithStyle:x.racesWithStyle+(r.nTotal>0),
  racesWithValidStyle:x.racesWithValidStyle+(r.nValid>0),
  runnerObservations:x.runnerObservations+r.nTotal,
  validRunnerObservations:x.validRunnerObservations+r.nValid,
  invalidRunnerObservations:x.invalidRunnerObservations+r.nInvalid,
  sumTop:x.sumTop+r.sumTop
 }),{racesWithStyle:0,racesWithValidStyle:0,
  runnerObservations:0,validRunnerObservations:0,
  invalidRunnerObservations:0,sumTop:0});
 const status=totals.invalidRunnerObservations>0?'held-unresolved-runners':
  totals.validRunnerObservations===0?'no-style-runner-observations':'estimate';
 return {status,raceCount:races.length,
  racesWithStyle:totals.racesWithStyle,
  racesWithValidStyle:totals.racesWithValidStyle,
  runnerObservations:totals.runnerObservations,
  validRunnerObservations:totals.validRunnerObservations,
  invalidRunnerObservations:totals.invalidRunnerObservations,
  pTopHalf:status==='estimate'?totals.sumTop/totals.validRunnerObservations:null};
}
function bootstrap(races,cellId,nDraws=BOOTSTRAPS){
 const full=summarizeRaceBlocks(races);
 if(full.status!=='estimate'||full.racesWithValidStyle<2)
  return {status:'insufficient-race-coverage',draws:nDraws,
   definedDraws:0,lowerPercent:null,upperPercent:null,widthPercentagePoints:null};
 const rng=random(checksum(pilot.PIN+'|'+cellId+'|'+races.length));
 const values=[];
 for(let b=0;b<nDraws;b++){
  let sum=0,valid=0,unknown=0;
  for(let k=0;k<races.length;k++){
   const race=races[Math.floor(rng()*races.length)];
   sum+=race.sumTop;valid+=race.nValid;unknown+=race.nInvalid;
  }
  if(valid>0&&unknown===0)values.push(sum/valid);
 }
 values.sort((a,b)=>a-b);
 // Missing-style draw is undefined, never treated as zero.
 if(values.length<Math.ceil(0.95*nDraws))
  return {status:'insufficient-bootstrap-coverage',draws:nDraws,
   definedDraws:values.length,
   lowerPercent:null,upperPercent:null,widthPercentagePoints:null};
 const lo=quantile(values,0.025),hi=quantile(values,0.975);
 return {status:'descriptive-race-block-bootstrap-interval',draws:nDraws,
  definedDraws:values.length,
  lowerPercent:pp(lo),upperPercent:pp(hi),
  widthPercentagePoints:pp(hi-lo)};
}
function analyze(source){
 if(!source||source.schemaVersion!==1||source.status!==sourceStatus||
  source.sourceRevision!==pilot.PIN||
  !Number.isInteger(source.seedsPerCell)||source.seedsPerCell<1||
  source.seedsPerCell>20||!Array.isArray(source.observations))
  throw Error('Expected pinned GlobalSim per-runner observation input');
 const plans=dense.plansFor(source.seedsPerCell),expected=new Map();
 if(source.raceCount!==plans.length)
  throw Error('Race count or seed plan does not match pinned source');
 const groups=new Map();
 function cell(plan,style,windowId){
  const identity={courseId:plan.course.id,fieldSize:plan.fieldSize,
   scenario:plan.scenario,mode:plan.mode,style,windowId};
  const k=cellKey(identity);
  if(!groups.has(k))groups.set(k,{...identity,
   replicates:Array.from({length:source.seedsPerCell},(_,rep)=>({
    rep,seed:null,nTotal:0,nValid:0,nInvalid:0,sumTop:0}))});
  return groups.get(k);
 }
 for(const p of plans){
  for(const style of STYLES)
   for(const w of windows.WINDOWS){
    const rep=cell(p,style,w.id).replicates[p.rep];
    if(rep.seed!==null&&rep.seed!==p.seed)
     throw Error('Conflicting seed for replicate');
    rep.seed=p.seed;
   }
  for(let i=0;i<p.fieldSize;i++)
   for(const w of windows.WINDOWS){
    const row={courseId:p.course.id,fieldSize:p.fieldSize,
     scenario:p.scenario,mode:p.mode,rep:p.rep,runnerIndex:i,
     windowId:w.id};
    const k=rowKey(row);
    if(expected.has(k))throw Error('Overlapping expected runner identity');
    expected.set(k,{seed:p.seed,style:p.strategies[i]});
   }
 }
 if(source.observations.length!==expected.size)
  throw Error('Incomplete runner observations: expected '+expected.size+
   ', got '+source.observations.length);
 const received=new Set();
 for(const obs of source.observations){
  const key=rowKey(obs),rule=expected.get(key);
  if(!rule||received.has(key)||obs.seed!==rule.seed||
   obs.style!==rule.style)
   throw Error('Duplicate, unexpected or wrongly seeded runner observation: '+key);
  received.add(key);
  if(!['estimate','ambiguous-ties','incomplete-replay'].includes(obs.status))
   throw Error('Unknown runner observation status '+obs.status);
  if(obs.status==='estimate'?
   !Number.isFinite(obs.pTopHalf)||obs.pTopHalf<0||obs.pTopHalf>1:
   obs.pTopHalf!==null)
   throw Error('Invalid runner observation probability');
  const group=groups.get(cellKey(obs));
  const rep=group.replicates[obs.rep];
  rep.nTotal++;
  if(obs.status==='estimate'){rep.nValid++;rep.sumTop+=obs.pTopHalf}
  else rep.nInvalid++;
 }
 const rows=[];
 for(const [id,g] of groups){
  const samples=g.replicates,full=summarizeRaceBlocks(samples);
  const requested=[3,10,source.seedsPerCell].filter(n=>n<=source.seedsPerCell);
  const sizes=[...new Set(requested)].sort((a,b)=>a-b);
  const prefixes=sizes.map(n=>({
   seeds:n,...((x)=>({status:x.status,topHalfPercent:pp(x.pTopHalf),
    racesWithStyle:x.racesWithStyle,
    runnerObservations:x.runnerObservations}))(summarizeRaceBlocks(samples.slice(0,n))) }));
  const split=Math.floor(samples.length/2);
  const first=summarizeRaceBlocks(samples.slice(0,split)),
   second=summarizeRaceBlocks(samples.slice(split));
  const splitDelta=first.pTopHalf===null||second.pTopHalf===null?
   null:pp(second.pTopHalf-first.pTopHalf);
  const uncertainty=bootstrap(samples,id);
  rows.push({courseId:g.courseId,fieldSize:g.fieldSize,
   scenario:g.scenario,mode:g.mode,style:g.style,windowId:g.windowId,
   sourceRaceCount:samples.length,status:full.status,
   topHalfPercent:pp(full.pTopHalf),
   racesWithStyle:full.racesWithStyle,
   runnerObservations:full.runnerObservations,
   invalidRunnerObservations:full.invalidRunnerObservations,
   prefixes,splitHalves:{
    first:{seeds:split,status:first.status,
     topHalfPercent:pp(first.pTopHalf),
     racesWithStyle:first.racesWithStyle},
    second:{seeds:samples.length-split,status:second.status,
     topHalfPercent:pp(second.pTopHalf),
     racesWithStyle:second.racesWithStyle},
    secondMinusFirstPercentagePoints:splitDelta
   },bootstrap95:uncertainty});
 }
 rows.sort((a,b)=>a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.scenario.localeCompare(b.scenario)||a.mode.localeCompare(b.mode)||
  a.style.localeCompare(b.style)||a.windowId.localeCompare(b.windowId));
 const splitDeltas=rows.map(r=>r.splitHalves.secondMinusFirstPercentagePoints)
  .filter(Number.isFinite).map(Math.abs).sort((a,b)=>a-b);
 const widths=rows.map(r=>r.bootstrap95.widthPercentagePoints)
  .filter(Number.isFinite).sort((a,b)=>a-b);
 return {schemaVersion:1,
  status:'GlobalSim-seed-sensitivity-not-game-skill-activation-rate',
  sourceRevision:pilot.PIN,seedCount:source.seedsPerCell,
  raceCount:source.raceCount,observedRunnerWindows:source.observations.length,
  totalCells:rows.length,
  coverage:{
   withEstimates:rows.filter(r=>r.status==='estimate').length,
   held:rows.filter(r=>r.status!=='estimate').length,
   bootstrapIntervals:widths.length,unavailableBootstrap:rows.length-widths.length,
   splitHalfComparisons:splitDeltas.length
  },
  descriptiveVariation:{
   absoluteSplitHalfDeltaMedianPercentagePoints:quantile(splitDeltas,0.5),
   absoluteSplitHalfDeltaMaximumPercentagePoints:splitDeltas.at(-1)??null,
   bootstrap95WidthMedianPercentagePoints:quantile(widths,0.5),
   bootstrap95WidthMaximumPercentagePoints:widths.at(-1)??null
  },
  assumptions:[
   'Each deterministic seed produces a simulated race; no official game observations.',
   'A race is the resampling unit, not an individual runner or correlated phase window.',
   'Race-level resampling is only descriptive under this fixed synthetic generator and selected prior.',
   'Rates within a style are runner-weighted; absence of that style in a race contributes zero weight, not zero probability.',
   'Prefixes and disjoint seed halves compare random-seed sensitivity, not skill-specific causal effects.',
   'A bootstrap interval is not uncertainty over real player populations or Japanese-game mechanics.',
   'No hard cutoff for stability or actual-game style suitability is asserted.'
  ],rows};
}
async function run(template,enginePath,{seedsPerCell=15}={}){
 const observations=[];
 const model=await dense.execute(template,enginePath,{seedsPerCell,
  onRunnerWindow:row=>observations.push(row)});
 return analyze({schemaVersion:1,status:sourceStatus,sourceRevision:pilot.PIN,
  seedsPerCell,raceCount:model.raceCount,observations});
}
async function main(){
 const [templatePath,enginePath,output,seedInput]=process.argv.slice(2);
 if(!templatePath||!enginePath||!output)
  throw Error('Usage: globalsim_seed_stability.cjs template.jsonl engine stability.json [seedsPerCell]');
 const raw=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(raw.length!==1)throw Error('Expected fixed GlobalSim v77 example');
 const seedsPerCell=seedInput===undefined?15:Number(seedInput);
 const result=await run(JSON.parse(raw[0]),enginePath,{seedsPerCell});
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({races:result.raceCount,cells:result.totalCells,
  coverage:result.coverage,variation:result.descriptiveVariation}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={analyze,run,summarizeRaceBlocks,bootstrap,sourceStatus};
