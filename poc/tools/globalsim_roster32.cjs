#!/usr/bin/env node
'use strict';
/* Research-only fixed GlobalSim v77 roster sensitivity for 32 original-source
 * rank/time/distance/surface signatures (not complete skill activation).
 * Seed and initial stats are paired ACROSS roster variants at fixed n/course/mode/rep.
 * Source skill population is biased; scenarios are deliberately artificial.
 */
const fs=require('node:fs');
const readline=require('node:readline');
const {spawn}=require('node:child_process');
const expanded=require('./globalsim_position_expanded.cjs');
const dirt=require('./globalsim_dirt_10m.cjs');
const pilot=require('./globalsim_position_pilot.cjs');
const geo=require('./globalsim_phase_random_10m.cjs');
const sub=require('./globalsim_subphase_random_10m.cjs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
const bands=require('./globalsim_rank_band_dominance.cjs').BANDS;
const timing=require('../src/skill_rank_timing.js');
const PIN='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STYLES=expanded.STYLES;
const MODES=expanded.MODES;
const COUNTS=Object.freeze({
 balanced:{9:[2,2,3,2],12:[3,3,3,3]},
 frontHeavy:{9:[3,3,2,1],12:[4,4,3,1]},
 backHeavy:{9:[1,2,3,3],12:[1,2,4,5]},
 noFront:{9:[0,3,3,3],12:[0,4,4,4]}
});
const SCENARIOS=Object.keys(COUNTS);
const TURF=expanded.COURSES.map(c=>({...c,surface:'turf',
 distanceType:c.distance<1400?1:c.distance<1800?2:c.distance<2500?3:4}));
const DIRT=dirt.COURSES.map(c=>({...c,surface:'dirt'}));
const COURSES=[...TURF,...DIRT];
const SCOPE={all:[1,2,3,4],sprint:[1],mile:[2],middle:[3],long:[4]};
const round=n=>Number(n.toFixed(6));
const key=(...xs)=>xs.join('|');
function verifyManifest(manifest){
 if(!manifest||manifest.schemaVersion!==1||
  manifest.status!=='derived-research-only-fixed-32-unique-source-condition-profiles'||
  manifest.source?.globalSimRevision!==PIN||
  manifest.source?.umaSimSkillDataSha256!==SOURCE_SHA||
  manifest.source?.previousArtifactSha256!==
   '71251951444fbe4cbef8502422deebaf489941f817a8830c5038176be59f9fcd'||
  !Array.isArray(manifest.profiles)||manifest.profiles.length!==32||
  manifest.profiles.filter(x=>x.surface==='turf').length!==26||
  manifest.profiles.filter(x=>x.surface==='dirt').length!==6)
  throw Error('Not the fixed 32 unique source condition profiles');
 const seen=new Set();
 for(const p of manifest.profiles){
  if(!/^\d{6,9}$/.test(p.sourceNumericId)||
   !['turf','dirt'].includes(p.surface)||!SCOPE[p.distanceScope]||
   !bands.some(b=>b.id===p.bandId))throw Error('Invalid manifest source rank or surface');
  const tw=windowRatios(p.timing);
  if(!tw||tw.endRate<=tw.startRate)throw Error('Unmodelled source time window');
  const ids=COURSES.filter(c=>c.surface===p.surface&&
   SCOPE[p.distanceScope].includes(c.distanceType)).map(x=>x.id);
  if(!ids.length)throw Error('Manifest has no model course');
  const signature=key(p.surface,p.distanceScope,p.timing,p.bandId);
  if(seen.has(signature))throw Error('Duplicate fixed source condition '+signature);
  seen.add(signature);
 }
 const total=manifest.profiles.filter(p=>p.surface==='dirt').length;
 if(total!==6||seen.size!==32)throw Error('Source condition selection changed');
 return true;
}
function windowRatios(t){
 const half=sub.WINDOWS.find(x=>x.key===t);
 if(half)return {startRate:half.startRate,endRate:half.endRate};
 const parts=t.split(':');
 if(parts.length!==2||parts[0]!=='phase_random')throw Error('Unrecognized time window '+t);
 const phase=Number(parts[1]);
 if(!Number.isSafeInteger(phase)||phase<0||phase>3)throw Error('Invalid phase');
 return {startRate:timing.PHASE_BOUNDARIES[phase],
  endRate:timing.PHASE_BOUNDARIES[phase+1]};
}
function courseTargets(manifest,course){
 const profiles=manifest.profiles.filter(p=>p.surface===course.surface&&
  SCOPE[p.distanceScope].includes(course.distanceType));
 const byWindow=new Map();
 for(const p of profiles){
  if(!byWindow.has(p.timing))byWindow.set(p.timing,new Set());
  byWindow.get(p.timing).add(p.bandId);
 }
 if(!byWindow.size)throw Error('Source course without a modeled time/rank profile');
 return byWindow;
}
function roster(n,scenario,rep){
 const counts=COUNTS[scenario]?.[n];
 if(!counts||![9,12].includes(n)||counts.reduce((a,b)=>a+b,0)!==n)
  throw Error('Invalid fixed research roster');
 const entries=counts.flatMap((count,i)=>Array(count).fill(STYLES[i]));
 const strategies=entries.map((_,gate)=>entries[(gate+rep%n)%n]);
 return {counts:[...counts],strategies};
}
function plans(scenario,{seedsPerCell=30}={}){
 if(!SCENARIOS.includes(scenario)||
  !Number.isSafeInteger(seedsPerCell)||seedsPerCell<2||
  seedsPerCell>30||seedsPerCell%2)
  throw Error('Fixed scenario and even seeds 2..30 required');
 const out=[],seeds=new Set();
 for(const course of COURSES)
  for(const fieldSize of [9,12])
   for(const mode of MODES)
    for(let rep=0;rep<seedsPerCell;rep++){
     // All variants share the BALANCED control seed. This contrasts roster
     // while preserving individual initial jitter draws for each gate.
     const seed=expanded.seedFor(course.id,fieldSize,'balanced',rep);
     const p={course,fieldSize,mode,rep,seed,scenario,
      ...roster(fieldSize,scenario,rep)};
     const hash=key(course.id,fieldSize,rep);
     if(seeds.has(seed+'|'+mode+'|'+hash))throw Error('Duplicate sample plan');
     seeds.add(seed+'|'+mode+'|'+hash);
     if(scenario==='balanced'){
      const old=expanded.roster(fieldSize,'balanced',rep,seed);
      if(JSON.stringify(old.strategies)!==JSON.stringify(p.strategies))
       throw Error('Balanced baseline runner/seed pairing changed');
     }
     out.push(p);
    }
 if(out.length!==COURSES.length*2*2*seedsPerCell)
  throw Error('Incomplete source scenario course plan');
 return out;
}
function eligibility(n,bandId){
 const b=bands.find(x=>x.id===bandId);
 if(!b)throw Error('Unrecognized original-source rank predicates');
 const projection=bounds.andProjection(b.predicates,n);
 if(projection.status!=='rank-subcondition-projection')
  throw Error('Unknown rank percentage to integer threshold');
 return new Set(projection.positions);
}
function observe(plan,frames,manifest,groups){
 pilot.checkFrames(frames,plan.fieldSize);
 const byWindow=courseTargets(manifest,plan.course);
 const allowed=new Map();
 for(const bs of byWindow.values())for(const b of bs)
  if(!allowed.has(b))allowed.set(b,eligibility(plan.fieldSize,b));
 for(const [windowName,bs] of byWindow){
  const w=windowRatios(windowName),start=w.startRate*plan.course.distance,
   end=w.endRate*plan.course.distance;
  for(let runner=0;runner<plan.fieldSize;runner++){
   const trace=geo.rankSegments(frames,runner,start,end,{validated:true});
   if(!['estimate','held-tied-position','held-incomplete-distance'].includes(trace.status))
    throw Error('Unrecognized source trajectory status '+trace.status);
   const style=plan.strategies[runner];
   for(const band of bs){
    const k=key(plan.scenario,plan.course.id,plan.fieldSize,plan.mode,
     windowName,band,style);
    if(!groups.has(k))groups.set(k,{
     scenario:plan.scenario,surface:plan.course.surface,courseId:plan.course.id,
     distance:plan.course.distance,fieldSize:plan.fieldSize,mode:plan.mode,
     timing:windowName,bandId:band,style,
     runners:0,validRunners:0,unresolvedRunners:0,
     unresolvedReasons:{},opportunitySum:0,pointSum:0});
    const item=groups.get(k);
    item.runners++;
    if(trace.status!=='estimate'){
     // Ranking is genuinely ambiguous under the pinned no-skill model.
     // Do NOT assign an arbitrary gate/lane tie-break or score it as zero.
     item.unresolvedRunners++;
     item.unresolvedReasons[trace.status]=
      (item.unresolvedReasons[trace.status]||0)+1;
     continue;
    }
    const measured=geo.measureWindows(trace.segments,allowed.get(band),start,end);
    item.validRunners++;
    item.opportunitySum+=measured.tenMetreWindowOpportunity*100;
    item.pointSum+=measured.pointOccupancy*100;
   }
  }
 }
}
function report(manifest,groups,scenario,seedsPerCell){
 verifyManifest(manifest);
 if(!SCENARIOS.includes(scenario)||seedsPerCell<2)
  throw Error('Unrecognized report scenario');
 const rows=[...groups.values()].map(g=>{
  if(!g.runners||g.validRunners+g.unresolvedRunners!==g.runners)
   throw Error('Malformed trajectory evidence population');
  const held=g.unresolvedRunners>0;
  return {scenario,surface:g.surface,courseId:g.courseId,
   distance:g.distance,fieldSize:g.fieldSize,mode:g.mode,
   timing:g.timing,bandId:g.bandId,style:g.style,
   status:held?'held-unresolved-rank-trajectory':'complete-model-measurement',
   runners:g.runners,validRunners:g.validRunners,
   unresolvedRunners:g.unresolvedRunners,
   unresolvedReasons:g.unresolvedReasons,
   opportunityPercent:held?null:round(g.opportunitySum/g.runners),
   pointOccupancyPercent:held?null:round(g.pointSum/g.runners),
   opportunityLowerBoundPercent:round(g.opportunitySum/g.runners),
   opportunityUpperBoundPercent:round(
    (g.opportunitySum+100*g.unresolvedRunners)/g.runners)};
 }).sort((a,b)=>a.surface.localeCompare(b.surface)||
  a.courseId-b.courseId||a.fieldSize-b.fieldSize||
  a.mode.localeCompare(b.mode)||a.timing.localeCompare(b.timing)||
  a.bandId.localeCompare(b.bandId)||STYLES.indexOf(a.style)-STYLES.indexOf(b.style));
 const index=new Map(rows.map(r=>[key(r.courseId,r.fieldSize,r.mode,
  r.timing,r.bandId,r.style),r]));
 if(index.size!==rows.length)throw Error('Duplicate derived course context');
 let expected=0,absent=0,held=0,unresolved=0;
 for(const course of COURSES)
  for(const n of [9,12])
   for(const mode of MODES){
    const scenarioCounts=COUNTS[scenario][n];
    for(const [windowName,bandsForWindow] of courseTargets(manifest,course))
     for(const band of bandsForWindow)
      for(const [si,style] of STYLES.entries()){
       const k=key(course.id,n,mode,windowName,band,style);
       const r=index.get(k);
       if(scenarioCounts[si]===0){
        if(r)throw Error('Absent style must not be scored zero');
        absent++;
       }else{
        if(!r||r.runners!==scenarioCounts[si]*seedsPerCell||
         r.validRunners+r.unresolvedRunners!==r.runners||
         r.opportunityLowerBoundPercent<0||
         r.opportunityUpperBoundPercent>100||
         r.opportunityLowerBoundPercent>r.opportunityUpperBoundPercent+1e-5||
         (r.status==='complete-model-measurement'&&
          (!Number.isFinite(r.opportunityPercent)||
           r.pointOccupancyPercent>r.opportunityPercent+1e-5))||
         (r.status==='held-unresolved-rank-trajectory'&&
          (r.opportunityPercent!==null||r.pointOccupancyPercent!==null)))
         throw Error('Incomplete source matched scenario sample '+k);
        if(r.unresolvedRunners){held++;unresolved+=r.unresolvedRunners}
        expected++;
       }
      }
   }
 if(rows.length!==expected)throw Error('Wrong count of scenario context cells');
 return {schemaVersion:2,
  status:'P2-model-only-32-source-conditions-roster-sensitivity-not-game-activation',
  modelRevision:PIN,sourceSkillRegistrySha256:SOURCE_SHA,
  researchManifestSha256:manifest.source.previousArtifactSha256,
  scenario,rosterCounts:COUNTS[scenario],
  runnersPerStyleMissingIsNull:true,
  unresolvedTrajectoryIsBoundedNotZero:true,
  seedsPerCell,models:COURSES.length,simulations:COURSES.length*2*2*seedsPerCell,
  profileCount:32,profileCourseInstances:94,
  observedRows:rows.length,missingStyleContextCells:absent,
  heldContextCells:held,unresolvedRunnerWindows:unresolved,
  assumptions:['All scenarios have equal seed/gate/stat jitter design for fixed course/n/mode/rep.',
   'NoFront has zero Nige runners, so there is no Nige opportunity to measure; do not coerce absent to 0%.',
   'An unresolved exact positional tie yields a conservative 0..100% bound on that runner; source condition mean is a bounded interval, NOT a point estimate.',
   'Synthetic fixed rosters are NOT observed Japanese game race frequencies.',
   'Opportunity is skill-free model 10m random-window rank overlap, not actual skill proc rate.',
   'Only source rank/time/distance/ground predicates; no other AND, OR union, usefulness or published app labels.'],
  contextRows:rows};
}
async function execute(template,engine,manifest,scenario,{seedsPerCell=30}={}){
 verifyManifest(manifest);
 const runPlans=plans(scenario,{seedsPerCell}),groups=new Map();
 const child=spawn(engine,[],{stdio:['pipe','pipe','pipe']});
 // If an unmodelled source case aborts replay, stop the writer cleanly.
 // Otherwise an EPIPE event can hide the real rank/simulator error.
 let inputError=null;
 child.stdin.on('error',e=>{inputError=e;});
 let stderr='';
 child.stderr.setEncoding('utf8');
 child.stderr.on('data',x=>{stderr=(stderr+x).slice(-4500)});
 const closed=new Promise(resolve=>child.once('close',
  (code,signal)=>resolve({code,signal})));
 const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
 const write=(async()=>{
  for(const p of runPlans){
   const request=expanded.makeRace(template,p);
   if(child.killed||child.stdin.destroyed||child.exitCode!==null)break;
   if(!child.stdin.write(JSON.stringify(request)+'\n'))
    await new Promise(resolve=>{
     const release=()=>{
      child.stdin.off('drain',release);
      child.stdin.off('close',release);
      child.off('close',release);
      resolve();
     };
     child.stdin.once('drain',release);
     child.stdin.once('close',release);
     child.once('close',release);
    });
  }
  if(!child.stdin.destroyed)child.stdin.end();
 })();
 let received=0,error=null;
 try{
  for await(const line of lines){
   if(!line.trim())continue;
   if(received>=runPlans.length)throw Error('Unexpected model output');
   const current=runPlans[received],reply=JSON.parse(line);
   if(reply.error||reply.seed!==undefined&&reply.seed!==current.seed)
    throw Error('Wrong fixed model scenario response '+received);
   observe(current,reply.frames,manifest,groups);
   received++;
  }
  await write;
 }catch(e){error=e;console.error('roster32 source/model error:',e.stack||e);child.kill()}
 const exit=await closed;
 if(error)throw error;
 if(inputError&&inputError.code!=='EPIPE')throw inputError;
 if(exit.code!==0||received!==runPlans.length)
  throw Error('Not all fixed source model races completed '+
   JSON.stringify({exit,received,expected:runPlans.length,stderr}));
 return report(manifest,groups,scenario,seedsPerCell);
}
async function main([manifestPath,templatePath,engine,scenario,outPath,seeds]){
 if(!outPath)throw Error('Usage: globalsim_roster32.cjs manifest.json template.jsonl engine scenario output.json [evenSeeds]');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Exactly one pinned GlobalSim model template needed');
 const output=await execute(JSON.parse(lines[0]),engine,manifest,scenario,
  {seedsPerCell:Number(seeds||30)});
 fs.writeFileSync(outPath,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({scenario,simulations:output.simulations,
  rows:output.observedRows,missingStyle:output.missingStyleContextCells,
  examples:output.contextRows.filter(x=>x.courseId===10502&&
   x.fieldSize===12&&x.mode==='equal'&&x.timing===
   'phase_laterhalf_random:0'&&x.bandId==='top50')},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{
 console.error(e.stack||e);process.exitCode=1});
module.exports={PIN,SOURCE_SHA,STYLES,MODES,COUNTS,SCENARIOS,COURSES,
 SCOPE,verifyManifest,windowRatios,courseTargets,roster,plans,
 eligibility,observe,report,execute,main};
