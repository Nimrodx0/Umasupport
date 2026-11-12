#!/usr/bin/env node
'use strict';
/*
 * P2.15 same-stage positional *counterfactual*. The original engine has
 * NO skills installed. Sample fraction 0.5 is imposed by the researcher,
 * NOT drawn from UmaSim or GlobalSim RNG. Never call counts skill procs.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const full=require('../src/skill_full_condition_path_audit.cjs');
const phase=require('../src/skill_phase_random_source_window_audit.cjs');
const PIN=legacy.PIN;
const STATUS='P2.15-model-pre-skill-position-fixed-window-counterfactual-no-skill';
const SENTINEL=-999;
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const replacement={
 'src/race_field.rs':[
  ['    prev_rank_of: RefCell<Vec<usize>>,',
   '    prev_rank_of: RefCell<Vec<usize>>,\n    pub(crate) p2_priority_pos: RefCell<Vec<(f64,f64)>>,'],
  ['            prev_rank_of: RefCell::new(vec![0; n]),',
   '            prev_rank_of: RefCell::new(vec![0; n]),\n            p2_priority_pos: RefCell::new(vec![(-999.0,-999.0); n]),']
 ],
 'src/race_field_retail.rs':[
  ['        for priority in [1, 0] {\n            for &i in indices {\n',
   '        for priority in [1, 0] {\n            for &i in indices {\n                // P2.15: read actual runner position immediately before\n                // each source skill-priority call, without changing state.\n                let p2_pos = self.solvers[i].borrow().pos;\n                let mut p2_positions = self.p2_priority_pos.borrow_mut();\n                if priority == 1 { p2_positions[i].0 = p2_pos; }\n                else { p2_positions[i].1 = p2_pos; }\n                drop(p2_positions);\n']
 ],
 'src/lib.rs':[
  ['if retail_runtime || finished[i].is_none() { s.rushing_mode as f64 } else { 0.0 },\n                  blocker as f64]',
   'if finished[i].is_none() { field.p2_priority_pos.borrow()[i].0 } else { -999.0 },\n                 if finished[i].is_none() { field.p2_priority_pos.borrow()[i].1 } else { -999.0 }]']
 ]
};
function patch(root){
 const changed={};
 for(const [filename,steps] of Object.entries(replacement)){
  const file=require('node:path').join(root,filename);
  const orig=fs.readFileSync(file,'utf8');
  const nl=orig.includes('\r\n')?'\r\n':'\n';
  let next=orig;
  for(const [search,value] of steps){
   const needle=filename==='src/lib.rs'?legacy.TARGET:search.replace(/\n/g,nl);
   const insert=value.replace(/\n/g,nl);
   const count=typeof needle==='string'?orig.split(needle).length-1:
    [...orig.matchAll(needle)].length;
   if(count!==1)throw Error('P2.15 pinned GlobalSim source moved '+filename+' '+count);
   next=next.replace(needle,insert);
  }
  if(orig===next)throw Error('P2.15 source patch was a no-op');
  fs.writeFileSync(file,next);
  changed[filename]={sourceSHA256:sha(orig),temporaryProbeSHA256:sha(next)};
 }
 return {revision:PIN,status:'P2.15-temporary-position-probe-no-runtime-change',
  changed,slot4:'pre-priority1 actual pos',slot5:'pre-priority0 actual pos',
  noSkillList:true,physicalReplayColumns:[0,1,2,3]};
}
function phaseBounds(distance,phaseId){
 if(!Number.isFinite(distance)||distance<=0||![0,1,2,3].includes(phaseId))
  throw Error('Invalid phase bounds');
 const fractions=[[0,1/6],[1/6,2/3],[2/3,5/6],[5/6,1]][phaseId];
 return [distance*fractions[0],distance*fractions[1]];
}
function sourceShapedWindow(distance,phaseId,drawFraction){
 if(!Number.isFinite(drawFraction)||drawFraction<0||drawFraction>=1)
  throw Error('Counterfactual random draw must be in [0,1)');
 const [a,b]=phaseBounds(distance,phaseId);
 const start=Math.min(a+drawFraction*(b-a),b-2);
 return {start,end:Math.min(start+10,b)};
}
function staticContextMatch(finitePredicates,plan,style){
 const vals={running_style:expanded.STYLES.indexOf(style)+1,
  distance_type:plan.course.distanceType,
  ground_type:plan.course.surface==='turf'?1:plan.course.surface==='dirt'?2:null};
 if(vals.running_style<1||!Number.isInteger(vals.distance_type)||
  !Number.isInteger(vals.ground_type))throw Error('Unknown fixed race context');
 for(const p of finitePredicates){
  if(!Object.hasOwn(full.DOMAINS,p.type))throw Error('Unsupported finite predicate');
  if(p.side==='preConditions'||p.type==='ground_condition')
   return 'held-unknown-context-or-historical-precondition';
  if(!Object.hasOwn(vals,p.type))throw Error('Unobserved finite gate '+p.type);
  if(!full.check(vals[p.type],p.operator,p.value))return 'context-excluded';
 }
 return 'static-context-matches';
}
function makeEntries(cohort,plans){
 if(!cohort||cohort.status!==phase.STATUS||
  cohort.summary?.phaseRandomSingletonCandidateSkills!==102||
  cohort.summary?.phaseRandomSingletonCandidateStyleCells!==315||
  cohort.summary?.exactPhaseWindowSourcePaths!==371||
  !Array.isArray(cohort.rows)||cohort.rows.length!==315)
  throw Error('P2.15 original source cohort not pinned to 102/315/371');
 const entries=new Map();
 for(const row of cohort.rows){
  for(const r of row.researchPaths){
   if(!Array.isArray(r.phasePredicates)||!r.phasePredicates.length||
    !Array.isArray(r.finitePredicates)||r.state!==
     'original-window-shape-verified-not-same-tick-evaluated'||
    r.phasePredicates.some(p=>p.operator!=='=='||![0,1,2,3].includes(p.phaseId)))
    throw Error('Source phase path is not verified for counterfactual study');
   const key=[row.sourceNumericId,row.style,r.invokeOffset,
    r.conditionOrIndex,r.preconditionOrIndex??'none'].join('|');
   if(entries.has(key))throw Error('Duplicate exact original route');
   const item={key,sourceNumericId:row.sourceNumericId,style:row.style,
    invokeOffset:r.invokeOffset,conditionOrIndex:r.conditionOrIndex,
    preconditionOrIndex:r.preconditionOrIndex,
    phasePredicates:r.phasePredicates,
    finitePredicates:r.finitePredicates,
    contextsWithStaticMatch:0,contextsExcluded:0,
    contextsHeld:0,runnerTicksObserved:0,
    sourceShapedHalfwayWindowHits:0,fullSourceSkillTriggers:0};
   entries.set(key,item);
  }
 }
 if(entries.size!==371)throw Error('P2.15 source route denominator drift');
 const indexed=plans.map(plan=>{
  const groups={};
  for(const name of expanded.STYLES){
   const list=[];
   const japanese=['逃げ','先行','差し','追込'][expanded.STYLES.indexOf(name)];
   for(const entry of entries.values()){
    if(entry.style!==japanese)continue;
    const state=staticContextMatch(entry.finitePredicates,plan,name);
    if(state==='static-context-matches'){entry.contextsWithStaticMatch++;list.push(entry)}
    else if(state==='context-excluded')entry.contextsExcluded++;
    else entry.contextsHeld++;
   }
   groups[name]=list;
  }
  return groups;
 });
 return {entries,indexed};
}
function analyze(original,probe,plans,cohort,{fraction=0.5}={}){
 if(!Array.isArray(original)||!Array.isArray(probe)||!Array.isArray(plans)||
  original.length!==probe.length||original.length!==plans.length||
  !original.length)throw Error('Paired fixed GlobalSim plans required');
 if(fraction!==0.5)throw Error('Only the explicitly approved 0.5 counterfactual is supported');
 const {entries,indexed}=makeEntries(cohort,plans);
 const totals={framePairs:0,identicalPhysicalColumns:0,
  prePriority1MatchesPriority0:0,prePriorityMatchesPreviousPost:0,
  noSkillRunnerTicks:0,initialFramesHeld:0,finishedFramesHeld:0,
  sourceShapedHalfwayPathWeightedWindowHits:0};
 for(const [trial,plan] of plans.entries()){
  const A=original[trial].frames,B=probe[trial].frames,n=plan.fieldSize;
  if(A.length!==B.length||A.length<2)throw Error('Same-stage replay count drift');
  const targetByStyle=indexed[trial];
  const windows=Object.fromEntries([0,1,2,3].map(id=>
   [id,sourceShapedWindow(plan.course.distance,id,fraction)]));
  for(const [j,a] of A.entries()){
   const b=B[j];totals.framePairs++;
   if(a.t!==b.t||a.horses.length!==n||b.horses.length!==n)
    throw Error('Model skill stage changes replay timing or identity');
   for(let i=0;i<n;i++){
    const orig=a.horses[i],observed=b.horses[i],style=plan.strategies[i];
    for(let k=0;k<4;k++){
     const x=legacy.get(orig,k),y=legacy.get(observed,k);
     if(!Number.isFinite(x)||x!==y)
      throw Error('Model probe changed race physics/position/speed/HP/lane');
     totals.identicalPhysicalColumns++;
    }
    if(j===0){totals.initialFramesHeld++;continue}
    const p1=legacy.get(observed,4),p0=legacy.get(observed,5);
    if(p1===SENTINEL&&p0===SENTINEL){
     totals.finishedFramesHeld++;continue;
    }
    if(!Number.isFinite(p1)||p1!==p0||p1===SENTINEL)
     throw Error('Priority1/priority0 sampled at different runner positions');
    totals.prePriority1MatchesPriority0++;
    const prev=legacy.get(A[j-1].horses[i],0);
    if(p1!==prev)throw Error('Pre-skill position is not previous-frame model position');
    totals.prePriorityMatchesPreviousPost++;
    totals.noSkillRunnerTicks++;
    for(const entry of targetByStyle[style]||[]){
     entry.runnerTicksObserved++;
     const match=entry.phasePredicates.every(p=>{
      // A source precondition can latch at an earlier tick, so it is
      // never counted as a same-tick positive predicate.
      if(p.side==='preConditions')return false;
      const w=windows[p.phaseId];
      return p1>=w.start&&p1<=w.end;
     });
     if(match){
      entry.sourceShapedHalfwayWindowHits++;
      totals.sourceShapedHalfwayPathWeightedWindowHits++;
     }
    }
   }
  }
 }
 if(totals.noSkillRunnerTicks===0||
  totals.noSkillRunnerTicks!==totals.prePriorityMatchesPreviousPost||
  totals.identicalPhysicalColumns===0)
  throw Error('P2.15 same-stage original/probe independent replay failed');
 const rows=[...entries.values()].map(x=>({
  sourceNumericId:x.sourceNumericId,style:x.style,
  invokeOffset:x.invokeOffset,conditionOrIndex:x.conditionOrIndex,
  preconditionOrIndex:x.preconditionOrIndex,
  contextsWithStaticMatch:x.contextsWithStaticMatch,
  contextsExcluded:x.contextsExcluded,contextsHeld:x.contextsHeld,
  runnerTicksObserved:x.runnerTicksObserved,
  sourceShapedHalfwayWindowHits:x.sourceShapedHalfwayWindowHits,
  fullSourceSkillTriggers:0,
  meaning:'no-skill model fixed-draw counterfactual not original RNG sample'
 })).sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)||
  a.style.localeCompare(b.style)||a.invokeOffset-b.invokeOffset||
  a.conditionOrIndex-b.conditionOrIndex);
 return {schemaVersion:1,status:STATUS,
  provenance:{globalSimRevision:PIN,sourceUmaSimRevision:phase.SOURCE_REV,
   noSkillsLoaded:true,fixedSourceCohortSkills:102,
   fixedSourceCohortStyleCells:315,sourcePaths:371},
  experiment:{modelRaces:plans.length,
   observation:'actual positions immediately before priority-1 and priority-0 calls',
   controlledOriginalSourceShapedWindowDrawFraction:fraction,
   noOriginalOrModelRandomWindowsDrawn:true,
   modelInput:'uns skilled GlobalSim retail v77 no-skill baseline',
   independentPhysicalReplayValidation:true},
  totals,rows,
  gates:{originalRandomWindowSampled:false,
   sourceSkillEquipped:false,sourceANDCombinedAtOriginalRuntime:false,
   sourcePreconditionsLatched:false,modelVersusGameValidated:false,
   skillActivationRatesComputed:false,cardSuitabilityApproved:false},
  limits:[
   'Pre-skill positions are actually read from the pinned GlobalSim v77 call site, but no source skill is installed.',
   'One fixed 0.5 fractional draw computes a geometric counterfactual using pinned UmaSim window shape; this is NEVER an actual sampled window of either engine.',
   'UmaSim clipping is zoneEnd-2 and inclusive membership; GlobalSim activation sampler uses a distinct float32 <=regionEnd-10 sampling policy. The two source engines must not be conflated.',
   'Per-route hits are path weighted and runner ticks share races. Do not convert them to independent proc rates or skill grades.',
   'Ground condition and preConditions are held unless their exact runtime state is observed. OR/invoke and cooldown logic remain unresolved.',
   'No change to app production data, P3 cards, P4 UI or formal four-style suitability.'
  ]};
}
function main(args){
 if(args[0]==='patch'){
  if(args.length!==2)throw Error('patch <temporary-v77-source-dir>');
  console.log(JSON.stringify(patch(args[1]),null,2));return;
 }
 if(args[0]!=='replay'||args.length!==6)
  throw Error('replay <v77-template.jsonl> <original-engine> <probe-engine> <phase-source-cohort.json> <out.json>');
 const [,templatePath,origEngine,probeEngine,cohortPath,outPath]=args;
 const lines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(lines.length!==1)throw Error('Pinned example template must have one race');
 const plans=legacy.plans(),template=JSON.parse(lines[0]);
 const races=plans.map(p=>expanded.makeRace(template,p));
 if(races.some(x=>x.horses.some(h=>h.skills?.length!==0)))
  throw Error('No-skill baseline changed');
 const original=legacy.replay(origEngine,races);
 const instrumented=legacy.replay(probeEngine,races);
 const cohort=JSON.parse(fs.readFileSync(cohortPath,'utf8'));
 const report=analyze(original,instrumented,plans,cohort);
 fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
 console.log('P2_15_PRE_SKILL_FIXED_WINDOW_COUNTERFACTUAL='+JSON.stringify({
  status:report.status,provenance:report.provenance,totals:report.totals,
  zeroWholeSkillTriggers:report.rows.every(r=>r.fullSourceSkillTriggers===0)
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={PIN,STATUS,SENTINEL,replacement,patch,phaseBounds,
 sourceShapedWindow,staticContextMatch,makeEntries,analyze,main};
