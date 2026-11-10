#!/usr/bin/env node
'use strict';
/*
 * Source-pinned GlobalSim model STATE observability, never game skill rate.
 * A TEMPORARY source copy replaces replay slots 4/5 to expose BOTH cached
 * rank buffers and the exact signed change_order_onetime source expression.
 * Replay columns 0..3 must match the unmodified original engine bytewise.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const roster=require('./globalsim_roster32.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const PIN='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const TARGET=/if retail_runtime \|\| finished\[i\]\.is_none\(\) \{ s\.rushing_mode as f64 \} else \{ 0\.0 \},\s*blocker as f64\]/g;
const REPLACEMENT=[
 'if finished[i].is_none() {',
 '  field.order_of(i) as f64 - field.previous_order_of(i) as f64',
 '} else { -999.0 },',
 'if finished[i].is_none() {',
 '  (field.order_of(i) * 64 + field.previous_order_of(i)) as f64',
 '} else { -999.0 }]'
].join('\n                 ');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function patch(file){
 const before=fs.readFileSync(file,'utf8');
 if([...before.matchAll(TARGET)].length!==1||
    !before.includes('field.step_all(dt, visited)')||
    !before.includes('if capture_frames { frames.capture(t, |i| {'))
  throw Error('GlobalSim fixed source frame patch site changed');
 const after=before.replace(TARGET,REPLACEMENT);
 if(before===after)throw Error('No telemetry patch applied');
 fs.writeFileSync(file,after);
 return {modelRevision:PIN,originalLibSHA256:sha(before),
  instrumentedLibSHA256:sha(after),
  slots:'4=currentRank-previousRank,5=64*currentRank+previousRank',
  finishedSentinel:-999,unmodifiedReplayColumns:[0,1,2,3]};
}
const columns=['pos','speed','hp','lane','temptationMode','blockFrontHorseIndex'];
const get=(h,i)=>Array.isArray(h)?h[i]:h?.[columns[i]];
function plans(){
 const result=[];
 for(const scenario of ['balanced','backHeavy'])
  for(const p of roster.plans(scenario,{seedsPerCell:4}))
   if([10502,10504].includes(p.course.id)&&p.mode==='equal')
    result.push(p);
 if(result.length!==32)throw Error('Source-pinned 32-race test matrix changed');
 return result;
}
function replay(engine,races){
 const ps=spawnSync(engine,[],{encoding:'utf8',
  input:races.map(r=>JSON.stringify(r)).join('\n')+'\n',
  timeout:180000,maxBuffer:256*1024*1024});
 if(ps.error||ps.status!==0||ps.signal)throw Error('GlobalSim runner failed: '+
  JSON.stringify({error:ps.error?.message,status:ps.status,signal:ps.signal,
   stderr:ps.stderr?.slice(-700)}));
 const lines=ps.stdout.trim().split(/\r?\n/);
 if(lines.length!==races.length)throw Error('Incomplete original/probe race replay');
 return lines.map((line,i)=>{
  const x=JSON.parse(line);
  if(x.error||x.seed!==races[i].seed||
     !Array.isArray(x.frames)||x.frames.length<2)
   throw Error('Malformed original/probe reply '+i);
  return x;
 });
}
function analyze(original,probe,manifest){
 if(original.length!==manifest.length||probe.length!==manifest.length)
  throw Error('Unexpected replay count');
 const groups=new Map();
 let frames=0,matchedColumns=0,sampled=0,
  movedUp=0,movedDown=0,unchanged=0,finished=0,
  positionRankDisagreement=0;
 for(const [trial,p] of manifest.entries()){
  const A=original[trial].frames,B=probe[trial].frames,n=p.fieldSize;
  if(A.length!==B.length)throw Error('Instrumented race length drift');
  const anyChange=Array(n).fill(false);
  for(const [tick,a] of A.entries()){
   const b=B[tick];
   if(a.t!==b.t||a.horses?.length!==n||b.horses?.length!==n)
    throw Error('Different runner or tick count');
   frames++;
   const positions=a.horses.map(h=>get(h,0));
   for(let i=0;i<n;i++){
    const h=a.horses[i],k=b.horses[i];
    for(let j=0;j<4;j++){
     if(!Number.isFinite(get(h,j))||get(h,j)!==get(k,j))
      throw Error('Probe changed original position/speed/HP/lane trajectory');
     matchedColumns++;
    }
    const encoded=get(k,5),difference=get(k,4);
    if(encoded===-999&&difference===-999){finished++;continue}
    if(!Number.isSafeInteger(encoded)||!Number.isSafeInteger(difference))
     throw Error('Probe readout is not exact integer rank state');
    const current=Math.floor(encoded/64),previous=encoded%64;
    if(current<1||previous<1||current>n||previous>n||
       difference!==current-previous)
     throw Error('Original source condition formula does not match captured rank '+JSON.stringify({trial,tick,runner:i,current,previous,difference,encoded,n}));
    sampled++;
    const style=p.strategies[i],id=[p.course.id,n,p.scenario,style].join('|');
    if(!groups.has(id))groups.set(id,{
     courseId:p.course.id,fieldSize:n,scenario:p.scenario,style,
     runnerInstances:0,ticks:0,upTicks:0,downTicks:0,unchangedTicks:0,
     runnerInstancesWithChange:0,replayPointRankMismatchTicks:0});
    const row=groups.get(id);
    row.ticks++;
    if(difference<0){movedUp++;row.upTicks++;anyChange[i]=true}
    else if(difference>0){movedDown++;row.downTicks++;anyChange[i]=true}
    else{unchanged++;row.unchangedTicks++}
    const tie=positions.some((pos,j)=>j!==i&&Math.abs(pos-positions[i])<1e-8);
    if(!tie){
     const pointRank=1+positions.filter((pos,j)=>j!==i&&pos>positions[i]).length;
     if(pointRank!==current){
      row.replayPointRankMismatchTicks++;positionRankDisagreement++;
     }
    }
   }
  }
  for(let i=0;i<n;i++){
   const id=[p.course.id,n,p.scenario,p.strategies[i]].join('|');
   const row=groups.get(id);if(!row)throw Error('Missing active runner');
   row.runnerInstances++;
   if(anyChange[i])row.runnerInstancesWithChange++;
  }
 }
 const rows=[...groups.values()].sort((a,b)=>a.courseId-b.courseId||
   a.fieldSize-b.fieldSize||a.scenario.localeCompare(b.scenario)||
   expanded.STYLES.indexOf(a.style)-expanded.STYLES.indexOf(b.style));
 if(!sampled||!movedUp||!movedDown||rows.length!==32)
  throw Error('Pilot did not observe exact signed field rank changes');
 return {schemaVersion:1,
  status:'P2-GlobalSim-direct-cached-order-change-state-probe-only',
  globalSimRevision:PIN,
  design:{races:manifest.length,pairedEngineReplays:manifest.length*2,
   courses:[10502,10504],fieldSizes:[9,12],
   scenarios:['balanced','backHeavy'],mode:'equal',seedsPerCell:4,
   source:'no-skill fixed GlobalSim model with temporary replay-slot telemetry'},
  validation:{framePairs:frames,unchangedPhysicsColumns:matchedColumns,
   allModelPhysicsColumnsIdentical:true,
   exactRankDifferenceTicks:sampled,
   formula:'field.order_of(i) - field.previous_order_of(i)'},
  observations:{movedUpTicks:movedUp,movedDownTicks:movedDown,
   unchangedRankTicks:unchanged,finishedOrMissingSamples:finished,
   currentPointRankDisagreesWithCachedRankTicks:positionRankDisagreement},
  rows,
  limitations:[
   'Original source activation code is not changed. Temporary patch replaces replay slots 4 and 5; slots 0-3 must exactly match original engine on every frame.',
   'Post-step source rank change readout is not identical to testing a complete original skill predicate at its exact activation instant; same-tick skill AND/OR/Invoke not tested.',
   'Counters are correlated model tick observations, NOT real game skill activation probabilities or independent races.',
   'One synthetic model and only two courses/two rosters cannot establish four-style general tendency or game mechanic fidelity.',
   'Any alternative use of replay-point rank as a proxy requires separate proof. No automatic product evaluation, user interface or effect usefulness.'
  ]};
}
function main(args){
 if(args[0]==='patch'){
  if(args.length!==2)throw Error('patch fixed-engine-source/src/lib.rs');
  console.log(JSON.stringify(patch(args[1]),null,2));return;
 }
 if(args[0]!=='replay'||args.length!==5)
  throw Error('replay template.jsonl original-engine probe-engine output.json');
 const [,templatePath,originalEngine,probeEngine,output]=args;
 const templates=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(templates.length!==1)throw Error('Need one fixed no-skill GlobalSim template');
 const template=JSON.parse(templates[0]),p=plans();
 const races=p.map(x=>expanded.makeRace(template,x));
 const report=analyze(replay(originalEngine,races),replay(probeEngine,races),p);
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,design:report.design,
  validation:report.validation,observations:report.observations,
  cells:report.rows.length},null,2));
}
if(require.main===module){
 try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
}
module.exports={PIN,TARGET,REPLACEMENT,patch,get,plans,replay,analyze,main};
