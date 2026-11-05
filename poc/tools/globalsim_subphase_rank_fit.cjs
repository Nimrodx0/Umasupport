#!/usr/bin/env node
'use strict';
/* All-recorded-position rank occupancy for source-defined subphase windows.
 * Experimental GlobalSim v77 trajectories, NOT real game activation rates.
 * Keep each missing runner/style unknown; no 0% fallback. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const source=require('../src/skill_rank_timing.js');
const rank=require('./globalsim_rank_distribution.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const SCENARIOS=Object.freeze(['balanced','jan2026','noFront']);
const WINDOWS=Object.freeze([
 ['early-latter','phase_laterhalf_random',0],
 ['middle-first','phase_firsthalf_random',1],
 ['middle-latter','phase_laterhalf_random',1]
].map(([id,type,value])=>{
 const original={type,operator:'==',value};
 const t=source.timing(original);
 if(t?.status!=='source-defined'||t.courseDependent||
  !t.randomWindow||t.windows.length!==1)
  throw Error('Unverified source timing window '+id);
 return {id,sourceCondition:original,phase:t.phaseIndexes[0],
  startRate:t.windows[0].startRate,endRate:t.windows[0].endRate};
}));
const STYLES=expanded.STYLES,MODES=expanded.MODES;
const round=x=>Number(x.toFixed(6));
const key=(x,parts)=>parts.map(k=>String(x[k])).join('|');
const cellKeys=['courseId','fieldSize','scenario','mode','windowId'];
function plans(seedsPerCell=30){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>60)throw Error('Expected 2..60 seeds per cell');
 const rows=expanded.makePlan({seedsPerCell})
  .filter(p=>SCENARIOS.includes(p.scenario));
 if(rows.length!==expanded.COURSES.length*2*SCENARIOS.length*
  MODES.length*seedsPerCell)throw Error('Source plan count drift');
 return rows;
}
function stats(rows,n,cutoff,half=null){
 const chosen=rows.filter(x=>half===null||
  (half==='first'?x.rep<cutoff:x.rep>=cutoff));
 // cutoff here is seed split midpoint, not rank cutoff.
 const invalid=chosen.filter(x=>x.status!=='estimate').length;
 const runnerCount=chosen.length, rankCount=pilot.threshold(n,50);
 const p=runnerCount&&invalid===0?
  chosen.reduce((v,x)=>v+x.rankFractions.slice(0,rankCount)
   .reduce((a,b)=>a+b,0),0)/runnerCount:null;
 return {status:!runnerCount?'absent-style':invalid?
  'unresolved-runner':'estimate',runnerCount,invalidRunners:invalid,
  topHalfFraction:p};
}
function summarize(plansList,observations,{strict=true}={}){
 if(!Array.isArray(plansList)||!plansList.length||
  !Array.isArray(observations))throw Error('Missing race trajectory observations');
 const planMap=new Map();
 for(const p of plansList){
  const row={courseId:p.course.id,fieldSize:p.fieldSize,
   scenario:p.scenario,mode:p.mode,rep:p.rep};
  const k=key(row,['courseId','fieldSize','scenario','mode','rep']);
  if(planMap.has(k))throw Error('Duplicate source race plan');
  planMap.set(k,p);
 }
 const expected=plansList.reduce((n,p)=>n+p.fieldSize*WINDOWS.length,0);
 if(observations.length!==expected)
  throw Error('Partial runner-subphase population '+observations.length+'/'+expected);
 const seen=new Set(),data=new Map(),windowsById=new Map(WINDOWS.map(w=>[w.id,w]));
 for(const o of observations){
  const sourceK=key(o,['courseId','fieldSize','scenario','mode','rep']);
  const p=planMap.get(sourceK);
  const runnerK=sourceK+'|'+o.runnerIndex+'|'+o.windowId;
  if(!p||seen.has(runnerK)||!windowsById.has(o.windowId)||
   !Number.isSafeInteger(o.runnerIndex)||o.runnerIndex<0||
   o.runnerIndex>=p.fieldSize||o.style!==p.strategies[o.runnerIndex]||
   o.seed!==p.seed)throw Error('Unmatched source runner/window');
  seen.add(runnerK);
  if(o.status==='estimate'){
   if(!Array.isArray(o.rankFractions)||
    o.rankFractions.length!==p.fieldSize||
    o.rankFractions.some(x=>!Number.isFinite(x)||x<0||x>1)||
    Math.abs(o.rankFractions.reduce((a,b)=>a+b,0)-1)>1e-6)
    throw Error('Invalid source rank histogram');
  }else if(!['incomplete-replay','ambiguous-ties'].includes(o.status)||
   o.rankFractions!==null)throw Error('Invalid unresolved histogram');
  const k=key(o,cellKeys);
  if(!data.has(k))data.set(k,new Map());
  const m=data.get(k);
  if(!m.has(o.style))m.set(o.style,[]);
  m.get(o.style).push(o);
 }
 const cMap=new Map();
 for(const p of plansList){
  for(const w of WINDOWS){
   const src={courseId:p.course.id,fieldSize:p.fieldSize,
    scenario:p.scenario,mode:p.mode,windowId:w.id};
   const k=key(src,cellKeys);
   if(!cMap.has(k))cMap.set(k,{...src,window:w});
  }
 }
 const seedCount=new Set(plansList.map(p=>p.rep)).size;
 const midpoint=Math.floor(seedCount/2);
 const comps=[];
 for(const v of cMap.values()){
  const rows=data.get(key(v,cellKeys))||new Map();
  const styleStats=Object.fromEntries(STYLES.map(style=>{
   const r=rows.get(style)||[];
   // For noFront, Nige is absent by construction, not a 0% probability.
   const all=stats(r,v.fieldSize,midpoint),
    first=stats(r,v.fieldSize,midpoint,'first'),
    last=stats(r,v.fieldSize,midpoint,'last');
   return [style,{...all,firstHalf:first,lastHalf:last}];
  }));
  const required=v.scenario==='noFront'?
   ['Senkou','Sasi','Oikomi']:STYLES;
  const front=required.filter(s=>['Nige','Senkou'].includes(s)),
   rear=['Sasi','Oikomi'];
  const gapFor=which=>{
   const obj=s=>which==='all'?styleStats[s]:which==='first'?
    styleStats[s].firstHalf:styleStats[s].lastHalf;
   if(!required.every(s=>obj(s).status==='estimate'))return null;
   return 100*(Math.min(...front.map(s=>obj(s).topHalfFraction))-
    Math.max(...rear.map(s=>obj(s).topHalfFraction)));
  };
  const all=gapFor('all'),first=gapFor('first'),last=gapFor('last');
  const direction=g=>g===null?'unresolved':g>1e-8?
   'front-ahead':g< -1e-8?'rear-counterexample':'tie';
  comps.push({...v,styleStats,status:all===null?
   'unresolved-model-data':'comparable',
   frontMinusRearPoints:all===null?null:round(all),
   firstHalfGapPoints:first===null?null:round(first),
   lastHalfGapPoints:last===null?null:round(last),
   direction:direction(all),splitFirstDirection:direction(first),
   splitLastDirection:direction(last)});
 }
 if(strict){
  const perWindow=expanded.COURSES.length*2*SCENARIOS.length*MODES.length;
  if(comps.length!==perWindow*WINDOWS.length)throw Error('Incomplete model contexts');
  if(seedCount!==Math.max(...plansList.map(x=>x.rep))+1||
   new Set(plansList.map(x=>x.rep)).size!==seedCount)
   throw Error('Non-contiguous seed indexes');
 }
 const overview=WINDOWS.map(w=>{
  const all=comps.filter(c=>c.windowId===w.id);
  const comparable=all.filter(c=>c.status==='comparable');
  const both=all.filter(c=>c.splitFirstDirection==='front-ahead'&&
   c.splitLastDirection==='front-ahead');
  const minGap=comparable.length?
   Math.min(...comparable.map(x=>x.frontMinusRearPoints)):null;
  return {windowId:w.id,sourceCondition:w.sourceCondition,
   range:[w.startRate,w.endRate],contexts:all.length,
   comparable:comparable.length,
   frontAhead:all.filter(c=>c.direction==='front-ahead').length,
   rearCounterexamples:all.filter(c=>c.direction==='rear-counterexample').length,
   ties:all.filter(c=>c.direction==='tie').length,
   unresolved:all.filter(c=>c.direction==='unresolved').length,
   splitBothFrontAhead:both.length,
   anySplitReversal:all.filter(c=>[
    c.splitFirstDirection,c.splitLastDirection].includes('rear-counterexample')).length,
   minGapPoints:minGap,
   // This is an *evidence gate*, not statistical certification.
   directionGate:all.length===comparable.length&&
    all.every(c=>c.direction==='front-ahead'&&
     c.splitFirstDirection==='front-ahead'&&
     c.splitLastDirection==='front-ahead')?
    'all-contexts-and-splits-directionally-consistent':
    'withheld-counterexample-or-insufficient-evidence'};
 });
 const worst=comps.filter(x=>x.frontMinusRearPoints!==null)
  .sort((a,b)=>a.frontMinusRearPoints-b.frontMinusRearPoints).slice(0,30);
 return {schemaVersion:1,
  status:'GlobalSim-v77-subphase-rank-occupancy-not-game-skill-rate',
  sourceRevision:pilot.PIN,races:plansList.length,seedsPerCell:seedCount,
  rankBand:'top-half-with-pilot-integer-cutoff',
  contextCount:comps.length,observations:observations.length,
  windows:WINDOWS,scenarios:SCENARIOS,
  byWindow:overview,worstCases:worst,
  comparisons:comps,
  limitations:[
   'All recorded position times and linear interpolation; overtake crossings are split.',
   'Style fractions are distance occupancy, not a real game skill activation chance.',
   'The model rank top-half mapping is used, not independently verified against Japanese game rank predicate semantics.',
   'Each scenario is synthetic/observed marginal sensitivity, not a representative lobby distribution.',
   'Split-half checks use dependent runners within races and are descriptive, not independent confidence intervals.',
   'One focal scenario without Nige correctly treats the missing style as absent, not 0%.',
   'No production skill label or support-card UI is changed solely by this research.'
  ]};
}
async function execute(template,enginePath,{seedsPerCell=30}={}){
 const all=plans(seedsPerCell),obs=[];
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-4000)});
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>
  resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const input=(async()=>{
  for(const p of all){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let i=0,err=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(i>=all.length)throw Error('Extra simulator race');
   const p=all[i],reply=JSON.parse(line);
   if(reply?.error||reply?.seed!==undefined&&reply.seed!==p.seed)
    throw Error('Mismatched engine seed '+p.seed);
   pilot.checkFrames(reply.frames,p.fieldSize);
   for(let runnerIndex=0;runnerIndex<p.fieldSize;runnerIndex++)
    for(const w of WINDOWS){
     const h=rank.histogram(reply.frames,runnerIndex,p.course.distance,
      w.startRate,w.endRate,true);
     obs.push({courseId:p.course.id,fieldSize:p.fieldSize,
      scenario:p.scenario,mode:p.mode,rep:p.rep,seed:p.seed,
      runnerIndex,style:p.strategies[runnerIndex],windowId:w.id,
      status:h.status,rankFractions:h.rankFractions});
    }
   i++;
  }
  await input;
 }catch(e){err=e;child.kill()}
 const exit=await closed;
 if(err)throw err;
 if(exit.code!==0||i!==all.length)throw Error('Missing engine data '+
  JSON.stringify({seen:i,expected:all.length,exit,stderr}));
 return summarize(all,obs);
}
async function main(args){
 const [templatePath,enginePath,outputPath,seedArg]=args;
 if(!templatePath||!enginePath||!outputPath)
  throw Error('Usage: globalsim_subphase_rank_fit.cjs template.jsonl engine output.json [seedsPerCell]');
 const text=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(text.length!==1)throw Error('Expected original pinned GlobalSim v77 template');
 const result=await execute(JSON.parse(text[0]),enginePath,
  {seedsPerCell:Number(seedArg||30)});
 fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({races:result.races,observations:result.observations,
  byWindow:result.byWindow,worstCases:result.worstCases.slice(0,5).map(x=>({
   courseId:x.courseId,scenario:x.scenario,mode:x.mode,
   windowId:x.windowId,fieldSize:x.fieldSize,
   gap:x.frontMinusRearPoints,first:x.firstHalfGapPoints,
   last:x.lastHalfGapPoints}))},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={SCENARIOS,WINDOWS,plans,stats,summarize,execute};
