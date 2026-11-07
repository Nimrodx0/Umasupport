#!/usr/bin/env node
'use strict';
/* P2 model-only dirt sensitivity study. Never treat different dirt/turf
 * courses as a paired surface intervention or real game activation rate.
 * Source races are balanced and all horses have A surface/distance aptitude.
 * The six representative dirt course geometries are frozen and validated
 * against the exact pinned GlobalSim course registry, not invented. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const previous=require('./globalsim_phase_random_10m.cjs');
const short=require('./globalsim_subphase_random_10m.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const COURSES=Object.freeze([
 {id:10508,distance:1200,distanceType:1,surface:2},
 {id:10611,distance:1600,distanceType:2,surface:2},
 {id:11302,distance:1600,distanceType:2,surface:2},
 {id:10913,distance:2000,distanceType:3,surface:2},
 {id:11103,distance:2000,distanceType:3,surface:2},
 {id:10312,distance:2500,distanceType:4,surface:2}
].map(x=>Object.freeze(x)));
const SEEDS=30;
function verifyCourses(registry,geometryPaths=null){
 if(!registry||typeof registry!=='object'||
  Array.isArray(registry))throw Error('Frozen course registry missing');
 if(geometryPaths!==null&&!(geometryPaths instanceof Set))
  throw Error('Expected a validated course geometry path set');
 for(const course of COURSES){
  const actual=registry[String(course.id)];
  if(!actual||actual.surface!==2||
   actual.distance!==course.distance||
   actual.distanceType!==course.distanceType)
   throw Error('Pinned dirt course surface/distance changed '+course.id);
  if(geometryPaths&&!geometryPaths.has(String(course.id)+'.json'))
   throw Error('Pinned dirt geometry missing '+course.id);
 }
 if(new Set(COURSES.map(c=>c.id)).size!==6||
  JSON.stringify(COURSES.map(c=>c.distance))!=='[1200,1600,1600,2000,2000,2500]')
  throw Error('Dirt distance-stratified comparison design changed');
 return true;
}
function makePlan({seedsPerCell=SEEDS}={}){
 if(!Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2)
  throw Error('Require even seeds 2..30');
 const plans=[],seen=new Map();
 for(const course of COURSES)for(const fieldSize of [9,12])
  for(const mode of expanded.MODES)for(let rep=0;rep<seedsPerCell;rep++){
   const seed=expanded.seedFor(course.id,fieldSize,'balanced',rep);
   const key=[course.id,fieldSize,rep].join('|');
   if(seen.has(seed)&&seen.get(seed)!==key)
    throw Error('Repeated model seed across different dirt cells');
   seen.set(seed,key);
   const roster=expanded.roster(fieldSize,'balanced',rep,seed);
   plans.push({seed,course,fieldSize,mode,
    scenario:'balanced',rep,...roster});
  }
 if(plans.length!==24*seedsPerCell)throw Error('Incomplete dirt plan');
 return plans;
}
async function execute(template,engine,{seedsPerCell=SEEDS}={}){
 if(!template||template.courseId!==10504||
  !Array.isArray(template.horses)||template.horses.length!==9||
  template.horses.some(h=>h.surfaceAptitude!=='A'||
   h.distanceAptitude!=='A'||
   h.strategyAptitude!=='A'))
  throw Error('Source horse traits not uniformly A across surfaces/distances');
 const plans=makePlan({seedsPerCell});
 const a=previous.collect(),b=short.collect();
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',s=>{stderr=(stderr+s).slice(-5000)});
 const done=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const read=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const write=(async()=>{
  for(const p of plans){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let received=0,error=null;
 try{
  for await(const line of read){
   if(!line.trim())continue;
   if(received>=plans.length)throw Error('Unexpected dirt engine reply');
   const p=plans[received],answer=JSON.parse(line);
   if(answer.error||answer.seed!==undefined&&answer.seed!==p.seed)
    throw Error('Dirt engine returned mismatched model result: '+
     JSON.stringify({seed:p.seed,answer:answer.error??answer.seed}));
   pilot.checkFrames(answer.frames,p.fieldSize);
   previous.inspectRace(p,answer.frames,a);
   short.inspectRace(p,answer.frames,b);
   received++;
  }
  await write;
 }catch(e){error=e;child.kill()}
 const exit=await done;
 if(error)throw error;
 if(exit.code!==0||received!==plans.length)
  throw Error('Dirt model trajectory population incomplete '+
   JSON.stringify({exit,received,wanted:plans.length,stderr}));
 const full=previous.report(a,{seedsPerCell});
 const sub=short.report(b,seedsPerCell);
 if(full.simulations!==24*seedsPerCell||
  sub.simulations!==24*seedsPerCell)
  throw Error('Source model total changed unexpectedly');
 return {schemaVersion:1,
  status:'research-GlobalSim-v77-dirt-10m-rank-opportunity-not-game-activation',
  sourceRevision:pilot.PIN,scenario:'balanced',
  surface:2,groundCondition:'Good',
  surfaceAptitude:'A',distanceAptitude:'A',
  notes:'Dirt courses are NOT geometrically paired to the old turf reference courses. Any observed difference mixes surface and track geometry.',
  contextDesign:'six actual dirt course IDs; 1200/1600/1600/2000/2000/2500 m; balanced 9/12 runners; equal/jitter10 stats; 30 seeds each',
  courses:COURSES,simulations:received,
  fullPhase:full,shortWindows:sub,
  limits:[
   'Dirt source course registry and each geometry file are checked at the frozen model commit before replay.',
   'The six dirt courses differ in geometry from six turf courses; comparing them does not isolate causal surface effects.',
   'All simulated horses have A surface/distance/strategy aptitude, and no skills are activated; not typical player composition.',
   'Only the rank-condition 10m random-window overlap is modeled, not game wisdom lottery or actual skill triggers.',
   'No game acceptance claim, score threshold, or production support-card suitability change follows from this report.'
  ]};
}
async function main(args){
 const [templatePath,courseSource,geometryDir,engine,output,seeds]=args;
 if(!output)throw Error('Usage: globalsim_dirt_10m.cjs template.jsonl course_data.json geometryDir engine output.json [evenSeeds]');
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('One pinned GlobalSim example required');
 const registry=JSON.parse(fs.readFileSync(courseSource,'utf8'));
 const geometryNames=new Set(fs.readdirSync(geometryDir));
 verifyCourses(registry,geometryNames);
 const outputModel=await execute(JSON.parse(lines[0]),engine,
  {seedsPerCell:Number(seeds||SEEDS)});
 fs.writeFileSync(output,JSON.stringify(outputModel,null,2)+'\n');
 console.log(JSON.stringify({courseIds:COURSES.map(c=>c.id),
  races:outputModel.simulations,
  fullPhaseContexts:outputModel.fullPhase.perContextRows,
  shortPhaseContexts:outputModel.shortWindows.perContextRows},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={COURSES,SEEDS,verifyCourses,makePlan,execute,main};
