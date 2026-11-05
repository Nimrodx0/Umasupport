#!/usr/bin/env node
'use strict';
/* P2 research-only full rank occupancy per race phase, using all recorded
 * position times and piecewise-linear crossings. Not a skill activation rate. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const pilot=require('./globalsim_position_pilot.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const rank=require('../src/skill_rank_timing.js');
const PHASES=Object.freeze([0,1,2,3].map(index=>{
 const x=rank.timing({type:'phase_random',operator:'==',value:index});
 if(!x||x.status!=='source-defined'||x.windows.length!==1||
  x.courseDependent)throw Error('Source phase definition unavailable');
 return {id:'phase-'+index,phase:index,phaseName:x.windows[0].phaseName,
  startRate:x.windows[0].startRate,endRate:x.windows[0].endRate};
}));
const SCENARIOS=['balanced','jan2026','noFront'];
const STYLES=expanded.STYLES;
const EPS=1e-9;
const pct=n=>Number(n.toFixed(6));
const pos=x=>Array.isArray(x)?x[0]:x.pos;
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const ident=r=>[r.courseId,r.fieldSize,r.scenario,r.mode,r.style,r.phase].join('|');
function histogram(frames,runner,distance,startRate,endRate,alreadyValidated=false){
 const n=frames?.[0]?.horses?.length;
 if(!Number.isInteger(n)||n<2||!Number.isInteger(runner)||
  runner<0||runner>=n||!Number.isFinite(distance)||distance<=0||
  !Number.isFinite(startRate)||!Number.isFinite(endRate)||
  startRate<0||endRate>1||startRate>=endRate)
  throw Error('Invalid rank histogram arguments');
 if(!alreadyValidated)pilot.checkFrames(frames,n);
 const start=distance*startRate,end=distance*endRate,width=end-start;
 const metresByRank=Array(n).fill(0);
 let unknown=0;
 for(let k=1;k<frames.length;k++){
  const before=frames[k-1].horses,after=frames[k].horses;
  const a=pos(before[runner]),b=pos(after[runner]),speed=b-a;
  if(speed< -EPS)throw Error('Runner position goes backwards');
  if(speed<=EPS||b<start-EPS||a>end+EPS)continue;
  const lo=clamp((start-a)/speed,0,1),hi=clamp((end-a)/speed,0,1);
  if(hi<=lo+1e-12)continue;
  const cuts=[lo,hi];
  for(let other=0;other<n;other++){
   if(other===runner)continue;
   const d0=pos(before[other])-a,d1=pos(after[other])-b,rate=d1-d0;
   if(Math.abs(rate)<=1e-14)continue;
   const cross=-d0/rate;
   if(cross>lo+1e-12&&cross<hi-1e-12)cuts.push(cross);
  }
  cuts.sort((x,y)=>x-y);
  for(let j=1;j<cuts.length;j++){
   const s=cuts[j-1],e=cuts[j],span=(e-s)*speed;
   if(span<=1e-12)continue;
   const middle=(s+e)/2,own=a+middle*speed;
   let ahead=0,tied=false;
   for(let other=0;other<n;other++){
    if(other===runner)continue;
    const op=pos(before[other])+
     (pos(after[other])-pos(before[other]))*middle;
    if(Math.abs(op-own)<=1e-8){tied=true;break;}
    if(op>own)ahead++;
   }
   if(tied)unknown+=span;
   else metresByRank[ahead]+=span;
  }
 }
 const observed=metresByRank.reduce((a,b)=>a+b,0)+unknown;
 if(Math.abs(observed-width)>1e-4)return {
  status:'incomplete-replay',rankFractions:null,
  observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
 if(unknown>1e-5)return {
  status:'ambiguous-ties',rankFractions:null,
  observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
 const raw=metresByRank.map(x=>x/width);
 if(raw.some(x=>x< -1e-9||x>1+1e-9)||
  Math.abs(raw.reduce((a,b)=>a+b,0)-1)>1e-5)
  throw Error('Rank histogram does not partition distance');
 // Correct only floating-point roundoff; retain rank-specific values.
 const bounded=raw.map(x=>clamp(x,0,1));
 const sum=bounded.reduce((a,b)=>a+b,0);
 return {status:'estimate',rankFractions:bounded.map(x=>x/sum),
  observedDistance:observed,expectedDistance:width,unknownDistance:unknown};
}
function plans(seedsPerCell=5){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<1||
  seedsPerCell>20)throw Error('Seed count must be 1..20');
 return expanded.makePlan({seedsPerCell}).filter(x=>SCENARIOS.includes(x.scenario));
}
function groupsFor(rows){
 const groups=new Map();
 const create=x=>{
  const k=ident(x);
  if(!groups.has(k))groups.set(k,{...x,runners:0,invalidRunners:0,
   rankSums:Array(x.fieldSize).fill(0)});
  return groups.get(k);
 };
 const expected=new Map();
 for(const plan of rows){
  for(const phase of PHASES){
   for(const style of STYLES)create({courseId:plan.course.id,
    fieldSize:plan.fieldSize,scenario:plan.scenario,mode:plan.mode,
    style,phase:phase.phase});
   for(const [runnerIndex,style] of plan.strategies.entries()){
    const key=[plan.course.id,plan.fieldSize,plan.scenario,plan.mode,
     plan.rep,runnerIndex,phase.phase].join('|');
    if(expected.has(key))throw Error('Repeated expected runner position');
    expected.set(key,{plan,style,phase});
   }
  }
 }
 return {groups,create,expected};
}
function summarize(group,thresholds){
 const complete=group.runners>0&&group.invalidRunners===0;
 const hist=complete?group.rankSums.map(x=>x/group.runners):null;
 const cumulative=complete?thresholds.map(cut=>{
  const n=pilot.threshold(group.fieldSize,cut);
  return {cutoffPercent:cut,rankCutoff:n,
   fraction:pct(hist.slice(0,n).reduce((a,b)=>a+b,0))};
 }):null;
 return {courseId:group.courseId,fieldSize:group.fieldSize,
  scenario:group.scenario,mode:group.mode,style:group.style,
  phase:group.phase,runners:group.runners,
  invalidRunners:group.invalidRunners,status:!group.runners?
   'no-style-runner-observations':group.invalidRunners?
   'held-unresolved-runners':'estimate',
  rankFractions:hist,atMost:cumulative};
}
function analyze(rows,observations,thresholds=[30,40,50,60,70]){
 if(!Array.isArray(rows)||!rows.length||!Array.isArray(observations)||
  !Array.isArray(thresholds)||!thresholds.length||
  thresholds.some(x=>!Number.isSafeInteger(x)||x<1||x>99)||
  new Set(thresholds).size!==thresholds.length)
  throw Error('Invalid population or percentile thresholds');
 const {groups,expected}=groupsFor(rows),seen=new Set();
 if(observations.length!==expected.size)
  throw Error('Unexpected observation population length');
 for(const obs of observations){
  const key=[obs.courseId,obs.fieldSize,obs.scenario,obs.mode,
   obs.rep,obs.runnerIndex,obs.phase].join('|');
  const x=expected.get(key);
  if(!x||seen.has(key)||obs.style!==x.style||obs.seed!==x.plan.seed)
   throw Error('Repeated or unmatched source observation');
  seen.add(key);
  const g=groups.get(ident(obs));
  if(!g||!['estimate','incomplete-replay','ambiguous-ties'].includes(obs.status))
   throw Error('Unexpected observed status');
  g.runners++;
  if(obs.status==='estimate'){
   if(!Array.isArray(obs.rankFractions)||
    obs.rankFractions.length!==obs.fieldSize||
    obs.rankFractions.some(x=>!Number.isFinite(x)||x<0||x>1)||
    Math.abs(obs.rankFractions.reduce((a,b)=>a+b,0)-1)>1e-6)
    throw Error('Invalid per-runner rank distribution');
   for(let i=0;i<g.rankSums.length;i++)g.rankSums[i]+=obs.rankFractions[i];
  }else{
   if(obs.rankFractions!==null)throw Error('Unresolved runner cannot have probabilities');
   g.invalidRunners++;
  }
 }
 const samples=[...groups.values()].map(x=>summarize(x,thresholds));
 const keys=new Map();
 for(const s of samples){
  const id=[s.courseId,s.fieldSize,s.scenario,s.mode,s.phase].join('|');
  if(!keys.has(id))keys.set(id,{courseId:s.courseId,fieldSize:s.fieldSize,
   scenario:s.scenario,mode:s.mode,phase:s.phase,styles:{}});
  keys.get(id).styles[s.style]=s;
 }
 const compare=[];
 for(const g of keys.values()){
  for(const cut of thresholds){
   const directions=['Nige','Senkou'].filter(s=>
    g.styles[s].status==='estimate')
    .map(s=>g.styles[s].atMost.find(c=>c.cutoffPercent===cut).fraction);
   const rear=['Sasi','Oikomi'].filter(s=>
    g.styles[s].status==='estimate')
    .map(s=>g.styles[s].atMost.find(c=>c.cutoffPercent===cut).fraction);
   const missing=['Nige','Senkou','Sasi','Oikomi'].filter(s=>
    g.styles[s].status==='held-unresolved-runners');
   const noFront=g.scenario==='noFront';
   const strictComplete=missing.length===0&&
    directions.length===(noFront?1:2)&&rear.length===2;
   const gap=strictComplete?pct(
    Math.min(...directions)-Math.max(...rear)):null;
   compare.push({courseId:g.courseId,fieldSize:g.fieldSize,
    scenario:g.scenario,mode:g.mode,phase:g.phase,cutoffPercent:cut,
    status:strictComplete?'comparable':'insufficient-style-evidence',
    frontMinusRearPoints:gap,
    direction:gap===null?'unresolved':gap>1e-8?'front-ahead':
     gap< -1e-8?'rear-counterexample':'tie'});
  }
 }
 const byPhaseCutoff=[];
 for(const phase of PHASES)
  for(const cut of thresholds){
   const a=compare.filter(x=>x.phase===phase.phase&&x.cutoffPercent===cut);
   const vals=a.filter(x=>x.status==='comparable');
   const gap=vals.map(x=>x.frontMinusRearPoints);
   byPhaseCutoff.push({phase:phase.phase,phaseName:phase.phaseName,
    cutoffPercent:cut,contexts:a.length,comparable:vals.length,
    frontAhead:vals.filter(x=>x.direction==='front-ahead').length,
    rearCounterexample:vals.filter(x=>x.direction==='rear-counterexample').length,
    tie:vals.filter(x=>x.direction==='tie').length,
    unresolved:a.length-vals.length,
    smallestGapPoints:gap.length?Math.min(...gap):null,
    largestGapPoints:gap.length?Math.max(...gap):null});
  }
 return {schemaVersion:1,sourceRevision:pilot.PIN,
  status:'model-all-recorded-positions-rank-distribution-not-actual-game',
  raceCount:rows.length,seedCount:new Set(rows.map(x=>x.rep)).size,
  phaseDefinitions:PHASES,thresholds,
  observationCount:observations.length,
  totalStylePhaseCells:samples.length,
  heldStylePhaseCells:samples.filter(x=>x.status==='held-unresolved-runners').length,
  emptyStylePhaseCells:samples.filter(x=>x.status==='no-style-runner-observations').length,
  byPhaseCutoff,comparisonCells:compare.length,samples,
  limitations:[
   'Model runner rank occupancy over distance, not a real game skill activation probability.',
   'Rank percentage boundaries use the pinned GlobalSim round(n*percent/100) mapping, not an independently verified Japanese game rule.',
   'Recorded positions between simulator times are linearly interpolated.',
   'Every cell includes only a small number of simulated races; style occupancy can be sparse.',
   'Artificial race conditions and marginal style priors are not a representative real match population.',
   'No claim of universal running-style rule, fixed ordering, or actual skill trigger probability.'
  ]};
}
async function execute(template,enginePath,{seedsPerCell=5,thresholds}={}){
 const all=plans(seedsPerCell),obs=[];
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-4000)});
 const closed=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const input=(async()=>{
  for(const plan of all){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,plan))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let seen=0,err=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(seen>=all.length)throw Error('Unexpected extra simulator reply');
   const p=all[seen],reply=JSON.parse(line);
   if(reply?.error||reply?.seed!==undefined&&reply.seed!==p.seed)
    throw Error('GlobalSim failed seed identity '+p.seed);
   pilot.checkFrames(reply.frames,p.fieldSize);
   for(let runnerIndex=0;runnerIndex<p.fieldSize;runnerIndex++)
    for(const phase of PHASES){
     const x=histogram(reply.frames,runnerIndex,p.course.distance,
      phase.startRate,phase.endRate,true);
     obs.push({courseId:p.course.id,fieldSize:p.fieldSize,
      scenario:p.scenario,mode:p.mode,rep:p.rep,runnerIndex,
      seed:p.seed,style:p.strategies[runnerIndex],phase:phase.phase,
      status:x.status,rankFractions:x.rankFractions});
    }
   seen++;
  }
  await input;
 }catch(e){err=e;child.kill()}
 const result=await closed;
 if(err)throw err;
 if(result.code!==0||seen!==all.length)
  throw Error('GlobalSim execution did not cover all races: '+
   JSON.stringify({code:result.code,seen,expected:all.length,stderr}));
 return analyze(all,obs,thresholds);
}
function thresholdsFromSource(source){
 if(!source||source.status!=='fixed-UmaSim-original-order-rate-condition-frequency'||
  !Array.isArray(source.byValue))throw Error('Unverified source threshold inventory');
 const values=source.byValue.map(x=>Number(x.code))
  .filter(x=>Number.isSafeInteger(x)&&x>=1&&x<=99);
 // Top values plus 50% control; never substitute a synthetic threshold
 // for an original-source condition without identifying it.
 return [...new Set([50,...values.slice(0,7)])].sort((a,b)=>a-b);
}
async function main(args){
 const [templatePath,enginePath,sourcePath,outputPath,seedArg]=args;
 if(!templatePath||!enginePath||!sourcePath||!outputPath)
  throw Error('Usage: globalsim_rank_distribution.cjs template.jsonl engine source-thresholds.json output.json [seedsPerCell]');
 const source=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
 const thresholds=thresholdsFromSource(source);
 const text=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(text.length!==1)throw Error('Expected pinned GlobalSim v77 template');
 const out=await execute(JSON.parse(text[0]),enginePath,
  {seedsPerCell:Number(seedArg||5),thresholds});
 fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({raceCount:out.raceCount,
  observationCount:out.observationCount,
  thresholds:out.thresholds,held:out.heldStylePhaseCells,
  byPhaseCutoff:out.byPhaseCutoff},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e);process.exitCode=1});
module.exports={PHASES,SCENARIOS,histogram,plans,summarize,analyze,execute,
 thresholdsFromSource};
