#!/usr/bin/env node
'use strict';
/* Isolated GlobalSim v77 research: no effect on user-facing skill labels.
 * Equal-stat / deterministic stat-jitter runs. Population priors are
 * source-specific marginal frequencies, NOT joint per-race roster records.
 * 12-runner cohorts are sensitivity tests, NOT measured LoH NPC composition. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const v1=require('./globalsim_position_pilot.cjs');

const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const COURSES=Object.freeze([
 {id:10501,distance:1200,group:'sprint'},
 {id:10504,distance:2000,group:'middle'},
 {id:10506,distance:2500,group:'long'}
]);
const SOURCES=Object.freeze({
 balanced:{kind:'fixed-composition',counts9:[2,2,3,2],
  counts12:[3,3,3,3],note:'Balanced control, not observed population'},
 jan2026:{kind:'observed-marginals',counts:[21,144,34,41],n:240,
  event:'2026-01 CM Arima 2500m A preliminary matches',
  url:'https://note.com/krupp_el/n/n3bcca7d8ec3b'},
 oct2025:{kind:'observed-marginals',counts:[39,64,114,23],n:240,
  event:'2025-10 CM sprint A preliminary matches',
  url:'https://note.com/krupp_el/n/nf9383f0f1bac'},
 noFront:{kind:'fixed-composition',counts9:[0,3,3,3],
  counts12:[0,4,4,4],note:'Sensitivity case; no front-runner'}
});
const MODES=['equal','jitter10'];
const POINTS=v1.POINTS;
const PIN=v1.PIN;
function rng(seed) {
 let x=seed>>>0;
 return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function sampleCounts(n,prior,random){
 const total=prior.counts.reduce((a,b)=>a+b,0);
 if(total!==prior.n||prior.counts.length!==4)throw Error('Population prior corrupted');
 const counts=[0,0,0,0];
 for(let i=0;i<n;i++){
  const p=random()*total;
  let sum=0;
  for(let j=0;j<4;j++){
   sum+=prior.counts[j];
   if(p<sum){counts[j]++;break;}
  }
 }
 if(counts.reduce((a,b)=>a+b,0)!==n)throw Error('Sample distribution incomplete');
 return counts;
}
function roster(n,scenario,rep,seed){
 const prior=SOURCES[scenario];
 if(!prior||![9,12].includes(n))throw Error('Invalid roster scenario');
 const random=rng(seed ^ 0xa37c639f);
 const counts=prior.kind==='fixed-composition'?
  [...prior['counts'+n]]:sampleCounts(n,prior,random);
 const entries=counts.flatMap((count,i)=>Array(count).fill(STYLES[i]));
 if(entries.length!==n)throw Error('Wrong field size');
 // Rotate the entire roster by rep; for marginally sampled prior, shuffle
 // positions before rotation to reduce fixed style gate bias.
 if(prior.kind==='observed-marginals'){
  for(let i=n-1;i>0;i--){
   const k=Math.floor(random()*(i+1));
   [entries[i],entries[k]]=[entries[k],entries[i]];
  }
 }
 const rot=rep%n;
 return {
  strategies:entries.map((_,gate)=>(entries[(gate+rot)%n])),
  counts
 };
}
function makePlan({seedsPerCell=3}={}){
 if(!Number.isInteger(seedsPerCell)||seedsPerCell<1||seedsPerCell>60)
  throw Error('seedsPerCell must be 1..60');
 const plans=[];
 for(const course of COURSES)
  for(const n of [9,12])
   for(const scenario of Object.keys(SOURCES))
    for(const mode of MODES)
     for(let rep=0;rep<seedsPerCell;rep++){
      const seed=920000+plans.length;
      const drawn=roster(n,scenario,rep,seed);
      plans.push({seed,course,fieldSize:n,scenario,mode,rep,...drawn});
     }
 return plans;
}
function racerFrom(template,style,gate,mode,random){
 const horse={...template,strategy:style,gateIndex:gate,skills:[]};
 if(mode==='jitter10'){
  // Not claimed to reproduce the real rating distribution. Pure
  // sensitivity check, applying independent +/-10% to all core stats.
  for(const stat of ['speed','stamina','power','guts','wisdom'])
   horse[stat]=Math.round(template[stat]*(0.9+0.2*random()));
 }
 return horse;
}
function makeRace(template,plan){
 if(!template||template.courseId!==10504||!template.skillData||
  !Array.isArray(template.horses)||template.horses.length!==9)
  throw Error('Pinned GlobalSim v77 example required');
 const n=plan.fieldSize,random=rng(plan.seed ^ 0x59b93f2f);
 const horses=Array.from({length:n},(_,i)=>
  racerFrom(template.horses[i%9],plan.strategies[i],i,plan.mode,random));
 return {...template,seed:plan.seed,courseId:plan.course.id,
  horses,retainAllFrames:true};
}
function observe(groups,plan,reply){
 if(reply?.error)throw Error('GlobalSim failed '+plan.seed+': '+reply.error);
 const frames=reply?.frames, n=plan.fieldSize;
 v1.checkFrames(frames,n);
 for(let i=0;i<n;i++){
  const style=plan.strategies[i];
  for(const f of POINTS){
   const rank=v1.crossing(frames,i,plan.course.distance*f);
   const key=[plan.course.id,n,plan.scenario,plan.mode,style,f].join('|');
   if(!groups.has(key))groups.set(key,{courseId:plan.course.id,
    courseDistance:plan.course.distance,fieldSize:n,scenario:plan.scenario,
    mode:plan.mode,style,fraction:f,n:0,unknown:0,front:0,back:0,
    rankSum:0});
   const g=groups.get(key);
   if(rank===null){g.unknown++;continue;}
   g.n++;
   g.rankSum+=rank;
   g.front+=Number(rank<=v1.threshold(n,50));
   g.back+=Number(rank>v1.threshold(n,50));
  }
 }
}
async function execute(template,enginePath,{seedsPerCell=3}={}){
 const plans=makePlan({seedsPerCell});
 const groups=new Map();
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let errorTail='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{errorTail=(errorTail+s).slice(-5000);});
 const close=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const input=(async()=>{
  for(const plan of plans){
   const line=JSON.stringify(makeRace(template,plan))+'\n';
   if(!child.stdin.write(line))await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let received=0;
 let failure=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(received>=plans.length)throw Error('Unexpected extra simulator reply');
   const reply=JSON.parse(line);
   observe(groups,plans[received],reply);
   received++;
  }
  await input;
 }catch(e){failure=e;child.kill();}
 const result=await close;
 if(failure)throw failure;
 if(result.code!==0||received!==plans.length)
  throw Error('GlobalSim reply/exit failure: '+JSON.stringify({
   code:result.code,received,expected:plans.length,errorTail:errorTail.slice(-800)}));
 const counts=new Map();
 for(const p of plans){
  const key=[p.course.id,p.fieldSize,p.scenario,p.mode].join('|');
  if(!counts.has(key))counts.set(key,{courseId:p.course.id,
   fieldSize:p.fieldSize,scenario:p.scenario,mode:p.mode,races:0,
   actualStyleCount:[0,0,0,0],nigeAbsent:0});
  const c=counts.get(key);c.races++;if(p.counts[0]===0)c.nigeAbsent++;
  p.counts.forEach((v,i)=>c.actualStyleCount[i]+=v);
 }
 const samples=[...groups.values()].map(g=>({...g,
  pTopHalf:g.n?g.front/g.n:null,pBackHalf:g.n?g.back/g.n:null,
  meanRank:g.n?g.rankSum/g.n:null})).sort((a,b)=>
  a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.scenario.localeCompare(b.scenario)||a.mode.localeCompare(b.mode)||
  a.fraction-b.fraction||STYLES.indexOf(a.style)-STYLES.indexOf(b.style));
 const totalSamples=samples.reduce((n,g)=>n+g.n+g.unknown,0);
 if(totalSamples!==plans.reduce((n,p)=>n+p.fieldSize*POINTS.length,0))
  throw Error('Runner fraction count mismatch');
 return {schemaVersion:2,
  status:'experimental-GlobalSim-v77-probabilities-not-actual-skill-rates',
  sourceRevision:PIN,raceCount:plans.length,seedCount:seedsPerCell,
  courses:COURSES,styleOrder:STYLES,priors:SOURCES,modes:MODES,
  assumptions:['all runners have no skills','equal or synthetic jitter10 stats',
   '12-runner cohorts do not model six LoH NPC',
   'observed event marginals do not preserve within-team or match correlations',
   'each runner sampled at own progress-point crossing, contemporaneous ranks'],
  scenarios:[...counts.values()],samples};
}
async function main(){
 const [source,engine,reportPath,seedsArg]=process.argv.slice(2);
 if(!source||!engine||!reportPath)throw Error('Usage: v77-race.jsonl engine report.json [seedsPerCell]');
 const lines=fs.readFileSync(source,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Expected one fixed GlobalSim example');
 const result=await execute(JSON.parse(lines[0]),engine,
  {seedsPerCell:Number(seedsArg||3)});
 fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({races:result.raceCount,courses:result.courses,
  samples:result.samples.length,rosterScenarios:result.scenarios.length}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={SOURCES,COURSES,STYLES,MODES,sampleCounts,roster,makePlan,makeRace,
 observe,execute,rng};
