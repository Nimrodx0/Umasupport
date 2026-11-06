#!/usr/bin/env node
'use strict';
/* Replicate 30 seeds for each 6-course / 9-or-12-field / three-roster /
 * two-stat GlobalSim context. Preserve all recorded rank fractions and
 * check strict group direction on source-rank windows in BOTH seed halves.
 * Model study, not a real-game activation probability or skill simulation. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const rank=require('./globalsim_rank_distribution.cjs');
const band=require('./globalsim_rank_band_dominance.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const SCENARIOS=Object.freeze(['balanced','jan2026','noFront']);
function plans(seedsPerCell=30){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>60||seedsPerCell%2!==0)
  throw Error('Expected an even number of 2..60 seeds');
 const rows=expanded.makePlan({seedsPerCell})
  .filter(p=>SCENARIOS.includes(p.scenario));
 if(rows.length!==expanded.COURSES.length*2*SCENARIOS.length*
  expanded.MODES.length*seedsPerCell)
  throw Error('Incomplete pinned scenario plan');
 return rows;
}
function analyze(all,observations,seedsPerCell){
 const thresholds=[20,30,40,50,60,70,75,80];
 const allProfile=rank.analyze(all,observations,thresholds);
 const midpoint=seedsPerCell/2;
 const slice=half=>{
  const selected=all.filter(p=>(half==='first'?
   p.rep<midpoint:p.rep>=midpoint));
  const reps=new Set(selected.map(p=>p.rep));
  const filtered=observations.filter(o=>reps.has(o.rep));
  return rank.analyze(selected,filtered,thresholds);
 };
 const first=slice('first'),last=slice('last');
 const report=band.analyze(allProfile,{firstProfile:first,lastProfile:last});
 if(report.raceCount!==all.length||
  report.comparisonCount!==6*2*SCENARIOS.length*expanded.MODES.length*4*
   band.BANDS.length)throw Error('Report does not cover all contexts');
 return {report,allProfile,firstProfile:first,lastProfile:last};
}
async function execute(template,enginePath,{seedsPerCell=30}={}){
 const all=plans(seedsPerCell),observations=[];
 const proc=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 proc.stderr.setEncoding('utf8');
 proc.stderr.on('data',s=>{stderr=(stderr+s).slice(-4500)});
 const closed=new Promise(resolve=>proc.once('close',(code,signal)=>
  resolve({code,signal})));
 const reader=readline.createInterface({input:proc.stdout,crlfDelay:Infinity});
 const writing=(async()=>{
  for(const p of all){
   if(!proc.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>proc.stdin.once('drain',resolve));
  }
  proc.stdin.end();
 })();
 let index=0,fail=null;
 try{
  for await(const line of reader){
   if(!line.trim())continue;
   if(index>=all.length)throw Error('Unexpected engine reply');
   const p=all[index],reply=JSON.parse(line);
   if(reply?.error||
    (reply?.seed!==undefined&&reply.seed!==p.seed))
    throw Error('GlobalSim reply/seed mismatch '+p.seed);
   pilot.checkFrames(reply.frames,p.fieldSize);
   for(let runnerIndex=0;runnerIndex<p.fieldSize;runnerIndex++)
    for(const phase of rank.PHASES){
     const h=rank.histogram(reply.frames,runnerIndex,p.course.distance,
      phase.startRate,phase.endRate,true);
     observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
      scenario:p.scenario,mode:p.mode,rep:p.rep,runnerIndex,
      seed:p.seed,style:p.strategies[runnerIndex],phase:phase.phase,
      status:h.status,rankFractions:h.rankFractions});
    }
   index++;
  }
  await writing;
 }catch(e){fail=e;proc.kill()}
 const exit=await closed;
 if(fail)throw fail;
 if(exit.code!==0||index!==all.length)
  throw Error('Incomplete GlobalSim return '+JSON.stringify({
   index,expected:all.length,exit,stderr}));
 return analyze(all,observations,seedsPerCell);
}
async function main(args){
 const [templatePath,enginePath,outDirectory,seedsArg]=args;
 if(!templatePath||!enginePath||!outDirectory)
  throw Error('Usage: globalsim_rank_band_study.cjs template.jsonl engine out_dir [even-seeds]');
 const raw=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(raw.length!==1)throw Error('Expected one pinned GlobalSim v77 example');
 const result=await execute(JSON.parse(raw[0]),enginePath,
  {seedsPerCell:Number(seedsArg||30)});
 fs.mkdirSync(outDirectory,{recursive:true});
 const files=[
  ['rank-band-direction.json',result.report],
  ['full-rank-profile.json',result.allProfile],
  ['first-half-rank-profile.json',result.firstProfile],
  ['last-half-rank-profile.json',result.lastProfile]
 ];
 const hashes={};
 for(const [name,obj] of files){
  const data=JSON.stringify(obj,null,2)+'\n';
  fs.writeFileSync(path.join(outDirectory,name),data);
  hashes[name]=crypto.createHash('sha256').update(data).digest('hex');
 }
 fs.writeFileSync(path.join(outDirectory,'provenance.json'),
  JSON.stringify({schemaVersion:1,engine:pilot.PIN,
   sourceRankMapping:'order-rate-integer-projection-v1',
   study:'GlobalSim four phase rank band all recorded positions',
   raceCount:result.report.raceCount,seedCount:result.report.seedCount,
   hashes,notes:'All results are model distance occupancy, not game activation.'},
   null,2)+'\n');
 console.log(JSON.stringify({raceCount:result.report.raceCount,
  contexts:result.report.contextCount,
  comparisons:result.report.comparisonCount,
  splitSeedCounts:result.report.splitSeedCounts,
  results:result.report.byPhaseBand,
  hashes},null,2));
}
if(require.main===module)main(process.argv.slice(2))
 .catch(e=>{console.error(e.stack||e);process.exitCode=1});
module.exports={SCENARIOS,plans,analyze,execute,main};
