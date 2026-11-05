#!/usr/bin/env node
'use strict';
/* Controlled research: hold the focal horse, its gate, all individual stats,
 * course and input seed fixed; change ONLY the other runners' strategy labels.
 * Internal simulator random draws can still diverge when strategies change.
 * Output is rank occupancy in GlobalSim, never real skill activation rates. */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const ranks=require('./globalsim_rank_distribution.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const STYLES=expanded.STYLES;
const PRESSURES=['balanced','frontHeavy','rearHeavy'];
const COUNTS=Object.freeze({
 9:{balanced:[2,2,2,2],frontHeavy:[3,3,1,1],rearHeavy:[1,1,3,3]},
 12:{balanced:[3,3,3,2],frontHeavy:[4,4,2,1],rearHeavy:[1,2,4,4]}
});
const CUTS=[20,30,40,50,60,70,80];
const round=n=>Number(n.toFixed(6));
const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const id=x=>[x.courseId,x.fieldSize,x.focalStyle,x.mode,x.rep,x.phase,x.pressure].join('|');
const cohortId=x=>[x.courseId,x.fieldSize,x.focalStyle,x.mode,x.phase,x.pressure,x.cut].join('|');
function opponentLineup(fieldSize,pressure,rep){
 const counts=COUNTS[fieldSize]?.[pressure];
 if(!counts||!Number.isSafeInteger(rep)||rep<0)throw Error('Unknown opponent composition');
 const initial=counts.flatMap((n,i)=>Array(n).fill(STYLES[i]));
 if(initial.length!==fieldSize-1)throw Error('Wrong opponent count');
 const offset=rep%initial.length;
 return initial.map((_,i)=>initial[(i+offset)%initial.length]);
}
function plans(seedCount=20){
 if(!Number.isSafeInteger(seedCount)||seedCount<2||seedCount>40)
  throw Error('Expected 2..40 paired seeds per cell');
 const output=[];
 for(const course of expanded.COURSES)
  for(const fieldSize of [9,12])
   for(const focalStyle of STYLES)
    for(const mode of expanded.MODES)
     for(let rep=0;rep<seedCount;rep++){
      // Identical per-runner randomized stats, gates and engine input seed
      // in ALL pressure variants and ALL courses at this stratum.
      const seed=expanded.seedFor(10504,fieldSize,'focal-'+focalStyle,rep);
      for(const pressure of PRESSURES){
       const strategies=[focalStyle,...opponentLineup(fieldSize,pressure,rep)];
       if(strategies[0]!==focalStyle||
        strategies.length!==fieldSize)throw Error('Focal treatment altered');
       output.push({course,fieldSize,focalStyle,mode,rep,seed,pressure,
        strategies,counts:STYLES.map(s=>strategies.filter(x=>x===s).length)});
      }
     }
 return output;
}
function analyze(planRows,observations,{strict=false}={}){
 if(!Array.isArray(planRows)||!planRows.length||!Array.isArray(observations))
  throw Error('Missing controlled race inputs');
 const expected=new Map();
 for(const p of planRows){
  if(!expanded.COURSES.some(c=>c.id===p.course?.id)||
   ![9,12].includes(p.fieldSize)||!STYLES.includes(p.focalStyle)||
   !expanded.MODES.includes(p.mode)||!PRESSURES.includes(p.pressure)||
   !Number.isSafeInteger(p.rep)||!Number.isSafeInteger(p.seed)||
   p.strategies?.[0]!==p.focalStyle||
   JSON.stringify(p.strategies.slice(1))!==
    JSON.stringify(opponentLineup(p.fieldSize,p.pressure,p.rep)))
   throw Error('Invalid fixed-focal plan');
  for(const phase of ranks.PHASES){
   const tag=id({courseId:p.course.id,fieldSize:p.fieldSize,
    focalStyle:p.focalStyle,mode:p.mode,rep:p.rep,phase:phase.phase,
    pressure:p.pressure});
   if(expected.has(tag))throw Error('Duplicate plan / phase');
   expected.set(tag,p);
  }
 }
 if(expected.size!==observations.length)
  throw Error('Incorrect focal observation population');
 const results=new Map();
 for(const o of observations){
  const k=id(o),p=expected.get(k);
  if(!p||results.has(k)||o.seed!==p.seed||
   !['estimate','ambiguous-ties','incomplete-replay'].includes(o.status))
   throw Error('Missing, duplicated or mismatched focal observation');
  if(o.status==='estimate'){
   if(!Array.isArray(o.rankFractions)||
    o.rankFractions.length!==o.fieldSize||
    o.rankFractions.some(x=>!Number.isFinite(x)||x<0||x>1)||
    Math.abs(o.rankFractions.reduce((a,b)=>a+b,0)-1)>1e-6)
    throw Error('Invalid rank distribution');
  }else if(o.rankFractions!==null)
   throw Error('Missing ranks cannot have numeric distribution');
  results.set(k,o);
 }
 const bins=new Map();
 for(const p of planRows.filter(x=>x.pressure==='balanced')){
  for(const phase of ranks.PHASES){
   const base={courseId:p.course.id,fieldSize:p.fieldSize,
    focalStyle:p.focalStyle,mode:p.mode,rep:p.rep,phase:phase.phase};
   const a=results.get(id({...base,pressure:'balanced'}));
   if(!a)throw Error('Missing reference race');
   for(const pressure of ['frontHeavy','rearHeavy']){
    const b=results.get(id({...base,pressure}));
    if(!b)throw Error('Missing matching treatment race');
    for(const cut of CUTS){
     const n=pilot.threshold(p.fieldSize,cut);
     const valid=a.status==='estimate'&&b.status==='estimate';
     const pa=valid?a.rankFractions.slice(0,n).reduce((x,y)=>x+y,0):null;
     const pb=valid?b.rankFractions.slice(0,n).reduce((x,y)=>x+y,0):null;
     const group={...base,pressure,cut};
     const key=cohortId(group);
     if(!bins.has(key))bins.set(key,{...group,paired:[],withheld:0});
     const g=bins.get(key);
     if(valid)g.paired.push({rep:p.rep,baseline:pa*100,
      treatment:pb*100,delta:(pb-pa)*100});
     else g.withheld++;
    }
   }
  }
 }
 const comparisons=[...bins.values()].map(x=>{
  const paired=x.paired.sort((a,b)=>a.rep-b.rep);
  const baseline=avg(paired.map(z=>z.baseline));
  const treatment=avg(paired.map(z=>z.treatment));
  const delta=avg(paired.map(z=>z.delta));
  const n=paired.length+x.withheld,half=n/2;
  const first=paired.filter(z=>z.rep<half),last=paired.filter(z=>z.rep>=half);
  return {courseId:x.courseId,fieldSize:x.fieldSize,
   focalStyle:x.focalStyle,mode:x.mode,phase:x.phase,
   pressure:x.pressure,cutoffPercent:x.cut,
   attemptedPairs:n,pairedRaces:paired.length,withheldPairs:x.withheld,
   status:paired.length&&x.withheld===0?'comparable':'partial-or-missing',
   baselinePercent:baseline===null?null:round(baseline),
   treatmentPercent:treatment===null?null:round(treatment),
   treatmentMinusBalancedPoints:delta===null?null:round(delta),
   firstHalfPoints:first.length?round(avg(first.map(z=>z.delta))):null,
   lastHalfPoints:last.length?round(avg(last.map(z=>z.delta))):null};
 });
 if(strict){
  const count=expanded.COURSES.length*2*STYLES.length*
   expanded.MODES.length*ranks.PHASES.length*CUTS.length*2;
  if(comparisons.length!==count)throw Error('Missing paired treatment groups');
  const expectedSeeds=new Set(planRows.map(p=>p.rep)).size;
  if(planRows.length!==expanded.COURSES.length*2*STYLES.length*
   expanded.MODES.length*expectedSeeds*PRESSURES.length)
   throw Error('Missing full controlled plan');
  if(comparisons.some(x=>x.attemptedPairs!==expectedSeeds))
   throw Error('Incomplete paired treatment sampling');
 }
 const summaries=[];
 for(const phase of ranks.PHASES)
  for(const cut of CUTS)
   for(const pressure of ['frontHeavy','rearHeavy']){
    const rows=comparisons.filter(x=>x.phase===phase.phase&&
     x.cutoffPercent===cut&&x.pressure===pressure);
    const good=rows.filter(x=>x.status==='comparable'),delta=good.map(x=>
     x.treatmentMinusBalancedPoints);
    const stable=good.filter(x=>x.firstHalfPoints!==null&&
     x.lastHalfPoints!==null&&Math.sign(x.firstHalfPoints)===
     Math.sign(x.lastHalfPoints)&&Math.sign(x.firstHalfPoints)!==0);
    summaries.push({phase:phase.phase,phaseName:phase.phaseName,
     cutoffPercent:cut,pressure,
     contexts:rows.length,comparable:good.length,held:rows.length-good.length,
     treatmentIncreases:delta.filter(x=>x>0).length,
     treatmentDecreases:delta.filter(x=>x<0).length,
     ties:delta.filter(x=>x===0).length,
     consistentNonzeroSplitHalfSigns:stable.length,
     medianAbsoluteDifferencePoints:delta.length?
      round([...delta].map(Math.abs).sort((a,b)=>a-b)[Math.floor(delta.length/2)]):null,
     maximumAbsoluteDifferencePoints:delta.length?
      round(Math.max(...delta.map(Math.abs))):null});
   }
 const strongest=comparisons.filter(x=>x.status==='comparable')
  .sort((a,b)=>Math.abs(b.treatmentMinusBalancedPoints)-
   Math.abs(a.treatmentMinusBalancedPoints));
 return {schemaVersion:1,
  status:'GlobalSim-fixed-focal-opponent-style-intervention-not-game-activation',
  sourceRevision:pilot.PIN,
  inputSeedCount:new Set(planRows.map(p=>p.rep)).size,
  simulatedRaceCount:planRows.length,
  focalPhaseObservationCount:observations.length,
  contextComparisons:comparisons.length,
  descriptions:{treatment:'Only the strategy labels of eight or eleven opponents are changed. Focal horse stays strategy-fixed at gate 0; all individual stats are unchanged across the three roster arms for a matched seed.',
   opponentCounts9:COUNTS[9],opponentCounts12:COUNTS[12],
   note:'Changing opponent strategies can change simulation RNG consumption, though the input seed is fixed.'},
  byPhaseCutoff:summaries,largestContrasts:strongest.slice(0,30),
  heldComparisons:comparisons.filter(x=>x.status!=='comparable').length,
  comparisons,
  limitations:[
   'Focal runner is always gate 0, not a population-wide per-style rank.',
   'Only the strategy labels of OTHER runners change; style-conditioned field composition is an experimental intervention.',
   'Skill-free GlobalSim replay positions are linearly interpolated between recorded times.',
   'Seed pairing fixes initial RNG state, not the sequence of random decisions within differing strategies.',
   'Runner cohorts in each matched experiment share outcomes; do not treat 20 repeats as independent real-world matches.',
   'No actual Japanese game skill activation probability, race representativeness, or official rank-band equivalence is established.',
   'Existing 53 labels, card ranking and user-facing web app remain unchanged.'
  ]};
}
async function execute(template,enginePath,{seedCount=20}={}){
 const all=plans(seedCount),observations=[];
 const child=spawn(enginePath,[],{stdio:['pipe','pipe','pipe']});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',x=>{stderr=(stderr+x).slice(-4000)});
 const finish=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const input=(async()=>{
  for(const p of all){
   if(!child.stdin.write(JSON.stringify(expanded.makeRace(template,p))+'\n'))
    await new Promise(resolve=>child.stdin.once('drain',resolve));
  }
  child.stdin.end();
 })();
 let seen=0,error=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(seen>=all.length)throw Error('Unmatched extra simulator reply');
   const p=all[seen],reply=JSON.parse(line);
   if(reply?.error||reply?.seed!==undefined&&reply.seed!==p.seed)
    throw Error('Simulated reply seed mismatch');
   pilot.checkFrames(reply.frames,p.fieldSize);
   for(const phase of ranks.PHASES){
    const result=ranks.histogram(reply.frames,0,p.course.distance,
     phase.startRate,phase.endRate,true);
    observations.push({courseId:p.course.id,fieldSize:p.fieldSize,
     focalStyle:p.focalStyle,mode:p.mode,rep:p.rep,phase:phase.phase,
     pressure:p.pressure,seed:p.seed,status:result.status,
     rankFractions:result.rankFractions});
   }
   seen++;
  }
  await input;
 }catch(e){error=e;child.kill()}
 const result=await finish;
 if(error)throw error;
 if(result.code!==0||seen!==all.length)
  throw Error('Incomplete GlobalSim replies '+JSON.stringify({
   seen,expected:all.length,exit:result,stderr}));
 return analyze(all,observations,{strict:true});
}
async function main([templatePath,enginePath,outPath,count]){
 if(!templatePath||!enginePath||!outPath)
  throw Error('Usage: globalsim_roster_only_intervention.cjs template.jsonl engine report.json [seeds=20]');
 const raw=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(raw.length!==1)throw Error('Expected original v77-race template');
 const report=await execute(JSON.parse(raw[0]),enginePath,
  {seedCount:Number(count||20)});
 fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({races:report.simulatedRaceCount,
  observations:report.focalPhaseObservationCount,
  contexts:report.contextComparisons,withheld:report.heldComparisons,
  final50:report.byPhaseCutoff.filter(x=>x.phase===3&&
   x.cutoffPercent===50),
  largest:report.largestContrasts.slice(0,5)},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e);process.exitCode=1});
module.exports={STYLES,PRESSURES,COUNTS,CUTS,opponentLineup,plans,
 analyze,execute};
