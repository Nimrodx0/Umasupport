#!/usr/bin/env node
'use strict';
/*
 * Source-exact stage instrumentation for fixed GlobalSim v77:
 *
 * Retail tick order: prepare -> PRIORITY-1/0 skill checks -> movement ->
 * field.update -> replay. Previous P2.19 recorded the POST-update difference.
 * This study captures real rank caches at BOTH priority call sites and the
 * post-update cache without changing activation logic or physics.
 *
 * No actual source skill triggers: the input model has no skills. Marginal
 * predicate satisfaction is NOT a skill proc, style score or card rating.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const FIELD_RADIX=32;
const PIN=legacy.PIN;
const U_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const replacements={
 'src/race_field.rs':[
  ["    prev_rank_of: RefCell<Vec<usize>>,",
   "    prev_rank_of: RefCell<Vec<usize>>,\n    pub(crate) p2_priority_rank: RefCell<Vec<(usize,usize)>>,"],
  ["            prev_rank_of: RefCell::new(vec![0; n]),",
   "            prev_rank_of: RefCell::new(vec![0; n]),\n            p2_priority_rank: RefCell::new(vec![(0,0); 2*n]),"]
 ],
 'src/race_field_retail.rs':[
  ["        for priority in [1, 0] {\n            for &i in indices {\n",
   "        for priority in [1, 0] {\n            for &i in indices {\n                // Research-only: snapshot the identical rank buffers directly before\n                // the source process_skill_priority call for this runner.\n                let slot = if priority == 1 { i } else { i + self.n };\n                self.p2_priority_rank.borrow_mut()[slot] =\n                    (self.order_of(i), self.previous_order_of(i));\n"]
 ],
 'src/lib.rs':[
  ["if retail_runtime || finished[i].is_none() { s.rushing_mode as f64 } else { 0.0 },\n                  blocker as f64]",
   "if finished[i].is_none() {\n                      let pair = field.p2_priority_rank.borrow()[i];\n                      pair.0 as f64 - pair.1 as f64\n                  } else { -999.0 },\n                  if finished[i].is_none() {\n                      let snap = field.p2_priority_rank.borrow();\n                      let (a,b) = snap[i]; let (c,d) = snap[i+n];\n                      let e = field.order_of(i); let f = field.previous_order_of(i);\n                      (((((a*32+b)*32+c)*32+d)*32+e)*32+f) as f64\n                  } else { -999.0 }]"]
 ]
};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const key=p=>[p.course.id,p.fieldSize,p.scenario,p.mode].join('|');
function patch(root){
 const changed={};
 for(const [name,pairs] of Object.entries(replacements)){
  const path=require('node:path').join(root,name);
  let old=fs.readFileSync(path,'utf8'),next=old;
  for(const [from,to] of pairs){
   if(old.split(from).length!==2)throw Error('Pinned v77 source patch site moved: '+name);
   next=next.replace(from,to);
  }
  if(next===old)throw Error('Empty frozen-source instrumentation patch');
  fs.writeFileSync(path,next);
  changed[name]={originalSHA256:sha(old),instrumentedSHA256:sha(next)};
 }
 return {status:'P2-source-check-stage-patch-only',modelRevision:PIN,
  modifiedTemporaryFiles:Object.keys(changed),sourceDigests:changed,
  slot4:'priority-1 signed rank difference at actual process_skill_priority call site',
  slot5:'radix-32 packed [priority1-current,priority1-previous,priority0-current,priority0-previous,post-current,post-previous]',
  originalPhysicsAndSkillPredicateUntouched:true};
}
function unpack(value,n){
 if(!Number.isSafeInteger(value)||value<Math.pow(FIELD_RADIX,5)||
  value>=Math.pow(FIELD_RADIX,6)||n>=FIELD_RADIX)
  throw Error('Malformed or remapped rank stage packet');
 const out=Array(6);
 for(let i=5;i>=0;i--){
  out[i]=value%FIELD_RADIX;value=Math.floor(value/FIELD_RADIX);
 }
 for(const [i,x] of out.entries()){
  if(i%2===0 && (x<1||x>n)||
    i%2===1 && (x<0||x>n))
   throw Error('Out-of-range source rank stage component '+i+':'+x);
 }
 return {priority1:{current:out[0],previous:out[1]},
  priority0:{current:out[2],previous:out[3]},
  afterUpdate:{current:out[4],previous:out[5]}};
}
function compare(actual,operator,value){
 if(!Number.isSafeInteger(actual)||typeof value!=='number'||
  !Number.isFinite(value))throw Error('Invalid rank-source comparison');
 switch(operator){
  case '>':return actual>value;case '>=':return actual>=value;
  case '<':return actual<value;case '<=':return actual<=value;
  case '==':return actual===value;case '!=':return actual!==value;
  default:throw Error('Unstudied source comparison: '+operator);
 }
}
function predicates(cohort){
 if(!cohort||cohort.schemaVersion!==1||
  cohort.status!=='P2-source-change-order-path-structure-not-complete-proc'||
  cohort.source?.sha256!==U_SHA||
  cohort.matchedSkillDenominator!==818||
  cohort.summary?.sourceSkills!==30||!Array.isArray(cohort.paths)||
  !cohort.paths.every(x=>x.fullSkillEvaluated===false))
  throw Error('Unpinned or changed original UmaSim signed-rank predicate cohort');
 const m=new Map(),held=[];
 for(const p of cohort.paths){
  for(const c of p.conditions){
   if(typeof c.value!=='number'||!Number.isSafeInteger(c.value)||
    !['>','>=','<','<=','==','!='].includes(c.operator)){
    held.push({sourceNumericId:p.sourceNumericId,operator:c.operator,value:c.value});
    continue;
   }
   const id=c.operator+'|'+c.value;
   if(!m.has(id))m.set(id,{operator:c.operator,value:c.value,
     originalSourcePaths:[],predicateTrueCount:0,predicateSampleCount:0,
     status:'model-pre-skill-check-marginal-only'});
   m.get(id).originalSourcePaths.push({
    sourceNumericId:p.sourceNumericId,invokeOffset:p.invokeOffset,
    side:p.side,orIndex:p.orIndex,
    extraAndPredicates:p.sameAndOtherTypes.length,
    hasPreconditions:p.hasPreconditions,
    invokeCount:p.invokeCount
   });
  }
 }
 return {measurable:[...m.values()].sort((a,b)=>
  a.operator.localeCompare(b.operator)||a.value-b.value),
  held,sourceSkills:30,sourceAndPaths:cohort.paths.length};
}
function analyze(original,probe,plans,source){
 const {measurable,held,sourceSkills,sourceAndPaths}=predicates(source);
 if(original.length!==plans.length||probe.length!==plans.length)
  throw Error('Missing paired pinned-model race');
 let framePairs=0,samePhysicsColumns=0,earlyRetail=0,finished=0,
  missingPreviousRank=0,sampleTicks=0,priorityMismatch=0,
  prePostDifference=0,preNonzero=0,postNonzero=0,postUp=0,postDown=0,
  preUp=0,preDown=0,delayedMatch=0,delayedMismatch=0,delayedNotComparable=0;
 const contexts=new Map();
 for(const [trial,p] of plans.entries()){
  const A=original[trial].frames,B=probe[trial].frames,n=p.fieldSize;
  if(A.length!==B.length)throw Error('Source-model observation length drift');
  let previousPacket=Array(n).fill(null);
  for(const [j,a] of A.entries()){
   const b=B[j];
   if(a.t!==b.t||a.horses.length!==n||b.horses.length!==n)
    throw Error('Probe changed replay frame/runner identity');
   framePairs++;
   const next=Array(n).fill(null);
   for(let i=0;i<n;i++){
    const orig=a.horses[i],read=b.horses[i];
    for(let k=0;k<4;k++){
     if(legacy.get(orig,k)!==legacy.get(read,k)||
      !Number.isFinite(legacy.get(read,k)))
      throw Error('Instrumented skill-check stage changed physical race results: '+
       JSON.stringify({trial,j,runner:i,k}));
     samePhysicsColumns++;
    }
    const slot4=legacy.get(read,4),slot5=legacy.get(read,5);
    if(j===0&&a.t===0){earlyRetail++;continue}
    if(slot4===-999&&slot5===-999){finished++;continue}
    const state=unpack(slot5,n);
    const s1=state.priority1.current-state.priority1.previous,
      s0=state.priority0.current-state.priority0.previous,
      end=state.afterUpdate.current-state.afterUpdate.previous;
    if(slot4!==s1||s0!==s1){
     priorityMismatch++;
     throw Error('Actual priority-1 and priority-0 rank condition stage differ: '+
      JSON.stringify({trial,tick:j,runner:i,slot4,s1,s0}));
    }
    next[i]=state.afterUpdate;
    // RaceField constructor sets prior ranks to zero; these first-tick
    // readings must not be interpreted as an overtaking event.
    if(state.priority1.previous===0){
     missingPreviousRank++;delayedNotComparable++;continue;
    }
    sampleTicks++;
    const id=key(p)+'|'+p.strategies[i];
    if(!contexts.has(id))contexts.set(id,{
     courseId:p.course.id,fieldSize:n,scenario:p.scenario,mode:p.mode,
     style:p.strategies[i],
     inspectedPreSkillTicks:0,preSkillRankRiseTicks:0,
     preSkillRankFallTicks:0,sameTickDifferentDiff:0,
     delayedPreviousPostMatches:0});
    const ctx=contexts.get(id);ctx.inspectedPreSkillTicks++;
    if(s1!==end){prePostDifference++;ctx.sameTickDifferentDiff++}
    if(s1!==0){preNonzero++;if(s1<0){preUp++;ctx.preSkillRankRiseTicks++}
     else{preDown++;ctx.preSkillRankFallTicks++}}
    if(end!==0){postNonzero++;if(end<0)postUp++;else postDown++}
    const prev=previousPacket[i];
    if(prev&&state.priority1.current===prev.current&&
       state.priority1.previous===prev.previous){
      delayedMatch++;ctx.delayedPreviousPostMatches++;
    }else if(prev){delayedMismatch++}
    else{delayedNotComparable++}
    for(const pred of measurable){
     pred.predicateSampleCount++;
     if(compare(s1,pred.operator,pred.value))pred.predicateTrueCount++;
    }
   }
   previousPacket=next;
  }
 }
 if(!sampleTicks||!preNonzero||!postNonzero||!delayedMatch||
  delayedMismatch>0||priorityMismatch>0||samePhysicsColumns===0)
  throw Error('Exact original pre-skill rank sample validation failed');
 return {
  schemaVersion:1,
  status:'P2-direct-retail-pre-skill-conditions-model-only-no-skill-proc',
  globalSimRevision:PIN,sourceUmaSimSHA256:U_SHA,
  design:{races:plans.length,cores:['source-unmodified','instrumented-temporary'],
   originalSkillList:'no-skills',sourceMatchedSkills:sourceSkills,
   sourceAndPaths,originalSignedRankSignatures:measurable.length,
   heldSourceSignatures:held.length,
   skillEvaluationStage:'immediately before each priority=1 and priority=0 process_skill_priority call',
   afterStage:'after field.step_all has updated positions and ranking; same iteration replay'},
  validation:{
   comparedFrames:framePairs,identicalPhysicalValues:samePhysicsColumns,
   allPhysicalValuesEqual:true,
   initializedRetailSnapshotsNotInstrumented:earlyRetail,
   finishedSnapshotsNotMeasured:finished,
   firstTickPreviousRankZeroHeld:missingPreviousRank,
   priorityCallRankStateMismatches:priorityMismatch,
   prePriorityMatchesPreviousPostRankCache:delayedMatch,
   prePriorityDisagreesWithPreviousPostRankCache:delayedMismatch,
   previousPostUnavailable:delayedNotComparable},
  partialConditionOpportunity:{
   evaluablePreSkillRunnerTicks:sampleTicks,
   preSkillNonzeroRankChangeRunnerTicks:preNonzero,
   preSkillRankUpRunnerTicks:preUp,preSkillRankDownRunnerTicks:preDown,
   postUpdateNonzeroRankChangeRunnerTicks:postNonzero,
   postUpdateRankUpRunnerTicks:postUp,postUpdateRankDownRunnerTicks:postDown,
   sameTickPreAndPostDifferenceRunnerTicks:prePostDifference,
   signedRankPredicates:measurable.map(x=>({
    operator:x.operator,value:x.value,
    originalSourcePaths:x.originalSourcePaths,
    predicateTrueModelRunnerTicks:x.predicateTrueCount,
    denominatorModelRunnerTicks:x.predicateSampleCount,
    status:x.status})),
   held:held},
  styleContexts:[...contexts.values()].sort((a,b)=>a.courseId-b.courseId||
   a.fieldSize-b.fieldSize||a.scenario.localeCompare(b.scenario)||
   expanded.STYLES.indexOf(a.style)-expanded.STYLES.indexOf(b.style)),
  limitations:[
   'This is a no-skill baseline. Although the source skill pass is called, no real pending skill with change_order_onetime has been evaluated. Source operator/value are evaluated on model pre-skill rank caches counterfactually.',
   'First-tick previous rank 0 is held, not counted as a real positive rank change.',
   'The fixed GlobalSim skill pass runs BEFORE this tick movement/rank update in retail mode; post-step replay event must not be assigned to the same-tick skill call.',
   'All optional same-AND, OR, preConditions, Invoke, style/distance/surface, cooldown and proc rules are NOT combined into a full skill trigger.',
   'Individual runner-ticks share races and rank paths; counting them is not an independent trial rate or evidence of real-game compatibility.',
   'No final four-style suitability classification, card grade, user-facing output or post-trigger effect utility.'
  ]};
}
function main(args){
 if(args[0]==='patch'){
  if(args.length!==2)throw Error('patch <temporary-fixed-GlobalSim-source-directory>');
  console.log(JSON.stringify(patch(args[1]),null,2));return;
 }
 if(args[0]!=='replay'||args.length!==6)
  throw Error('replay <template.jsonl> <unmodified-engine> <instrumented-engine> <source-paths.json> <report.json>');
 const [,templatePath,engine,probe,sourcePath,reportPath]=args;
 const t=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 if(t.length!==1)throw Error('Exactly one no-skill pinned template required');
 const plans=legacy.plans(),template=JSON.parse(t[0]);
 const races=plans.map(x=>expanded.makeRace(template,x));
 const baseline=legacy.replay(engine,races),observed=legacy.replay(probe,races);
 const report=analyze(baseline,observed,plans,JSON.parse(fs.readFileSync(sourcePath,'utf8')));
 fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({
  status:report.status,validation:report.validation,
  opportunity:{...report.partialConditionOpportunity,
   signedRankPredicates:report.partialConditionOpportunity.signedRankPredicates
    .map(x=>({operator:x.operator,value:x.value,
     sourcePaths:x.originalSourcePaths.length,
     satisfied:x.predicateTrueModelRunnerTicks,denominator:x.denominatorModelRunnerTicks}))},
  styleContextCount:report.styleContexts.length
 },null,2));
}
if(require.main===module){
 try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
}
module.exports={PIN,U_SHA,replacements,patch,unpack,compare,predicates,analyze,main};
