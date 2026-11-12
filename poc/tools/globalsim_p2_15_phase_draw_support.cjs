#!/usr/bin/env node
'use strict';
/*
 * P2.15 source phase_random single-window draw-support study. This consumes
 * the same fixed 102/315/371 original UmaSim cohort and 32 actually
 * observed no-skill GlobalSim pre-priority position traces as the existing
 * fixed-0.5 study. The full range of HYPOTHETICAL uniform source draw
 * fractions is integrated geometrically. Nothing is sampled here.
 */
const fs=require('node:fs');
const prior=require('./globalsim_p2_15_preskill_phase_position.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const geometry=require('../src/skill_phase_random_draw_support.cjs');
const STATUS=geometry.STATUS;
const fail=(yes,why)=>{if(!yes)throw Error('P2.15 model draw support: '+why);};
function analyze(original,probe,plans,cohort,sourceVerification){
 fail(sourceVerification?.umaSimRevision===
  'f6e4501ee6c6c2d4ac8698e7796e309d31575bde'&&
  sourceVerification.originalSourceIntervalClosed===true&&
  sourceVerification.randomDrawFractionUniformInSource===true&&
  sourceVerification.actualDrawObserved===false,
  'pinned original UmaSim geometry was not independently source-checked');
 // The previous study compares every original/temporary-probe physical
 // replay column and BOTH skill priorities. This is a verified prerequisite,
 // not evidence that the original UmaSim skill was equipped or invoked.
 const validation=prior.analyze(original,probe,plans,cohort);
 fail(validation.status===prior.STATUS&&
  validation.rows.length===371&&
  validation.experiment.noOriginalOrModelRandomWindowsDrawn===true,
  'original position-source physical parity or fixed cohort missing');
 const {entries,indexed}=prior.makeEntries(cohort,plans);
 const byPath=new Map();
 for(const entry of entries.values()){
  byPath.set(entry.key,{
   sourceNumericId:entry.sourceNumericId,
   style:entry.style,invokeOffset:entry.invokeOffset,
   conditionOrIndex:entry.conditionOrIndex,
   preconditionOrIndex:entry.preconditionOrIndex,
   originalPhasePredicateCount:entry.phasePredicates.length,
   originalPhaseId:entry.phasePredicates.length===1?
    entry.phasePredicates[0].phaseId:null,
   modelContextsWithVerifiedStaticGates:entry.contextsWithStaticMatch,
   modelContextsStaticallyExcluded:entry.contextsExcluded,
   modelContextsHeldUnknownOrHistorical:entry.contextsHeld,
   modelRunnerRaceUnitsWithObservedDrawSupport:0,
   modelRunnerRaceUnitsHeldMultiplePhasePredicates:0,
   modelRunnerRaceUnitsWithPositiveDrawSupport:0,
   modelRunnerRaceUnitsWithZeroDrawSupport:0,
   sumUniformDrawSupportFractions:0,
   minUniformDrawSupportFraction:null,maxUniformDrawSupportFraction:null,
   meanUniformDrawSupportFraction:null,
   fullOriginalSourceConditionProven:false,
   originalSkillProcCount:null,gameActivationRate:null,
   P3CardSuitabilityLabel:null
  });
 }
 fail(byPath.size===371,'source phase-random provenance changed');
 let evaluated=0,heldMultiple=0,positive=0,zero=0,
  accumulated=0,runnerRacesObserved=0,priorityPositionSamples=0;
 for(const [r,plan] of plans.entries()){
  const sample=probe[r],control=original[r];
  // The fixed input has every horse.skills=[] (main() checks this).
  // Some v77 model event records may be emitted regardless; they must
  // match exactly across the two read-only instrumented engines. Do not
  // infer whether any source skill was equipped from events alone.
  fail(Array.isArray(plan.strategies)&&plan.strategies.length===plan.fieldSize&&
   JSON.stringify(control.skillEvents??[])===
    JSON.stringify(sample.skillEvents??[]),
   'fixed GlobalSim probe changed model event records');
  for(let i=0;i<plan.fieldSize;i++){
   const style=plan.strategies[i];
   fail(expanded.STYLES.includes(style),'unknown model style');
   const p=[];
   for(let tick=1;tick<sample.frames.length;tick++){
    const observed=sample.frames[tick].horses[i];
    const a=legacy.get(observed,4),b=legacy.get(observed,5);
    if(a===prior.SENTINEL&&b===prior.SENTINEL)continue;
    fail(Number.isFinite(a)&&a===b,
     'not the same source model position at both skill priorities');
    p.push(a);
   }
   if(p.length===0)continue;
   runnerRacesObserved++;
   priorityPositionSamples+=p.length;
   const support=new Map();
   const candidatePaths=indexed[r][style];
   fail(Array.isArray(candidatePaths),'no original source path/style index');
   for(const path of candidatePaths){
    const row=byPath.get(path.key);
    fail(row,'source path identity missing');
    if(path.preconditionOrIndex!==null)throw Error(
      'prior precondition hold unexpectedly evaluated as a current draw');
    if(path.phasePredicates.length!==1||
      path.phasePredicates[0].side!=='conditions'){
      row.modelRunnerRaceUnitsHeldMultiplePhasePredicates++;
      heldMultiple++;continue;
    }
    const phaseId=path.phasePredicates[0].phaseId;
    if(!support.has(phaseId))support.set(phaseId,
      geometry.measuredPositionSupport(plan.course.distance,phaseId,p));
    const fraction=support.get(phaseId).drawFractionWithAnyObservedWindowHit;
    fail(Number.isFinite(fraction)&&fraction>=0&&fraction<=1,
     'unknown original source model geometry fraction');
    row.modelRunnerRaceUnitsWithObservedDrawSupport++;
    row.sumUniformDrawSupportFractions+=fraction;
    row.minUniformDrawSupportFraction=row.minUniformDrawSupportFraction===null?
     fraction:Math.min(row.minUniformDrawSupportFraction,fraction);
    row.maxUniformDrawSupportFraction=row.maxUniformDrawSupportFraction===null?
     fraction:Math.max(row.maxUniformDrawSupportFraction,fraction);
    if(fraction>0){row.modelRunnerRaceUnitsWithPositiveDrawSupport++;positive++}
    else{row.modelRunnerRaceUnitsWithZeroDrawSupport++;zero++}
    evaluated++;accumulated+=fraction;
   }
  }
 }
 fail(priorityPositionSamples===validation.totals.noSkillRunnerTicks,
  'new draw analysis did not use exact same validated priority stages');
 const rows=[...byPath.values()].map(row=>{
  const n=row.modelRunnerRaceUnitsWithObservedDrawSupport;
  fail(n===row.modelRunnerRaceUnitsWithPositiveDrawSupport+
    row.modelRunnerRaceUnitsWithZeroDrawSupport,
   'original source-path model runner denominator drift');
  if(n)row.meanUniformDrawSupportFraction=
   row.sumUniformDrawSupportFractions/n;
  return row;
 }).sort((a,b)=>a.sourceNumericId.localeCompare(b.sourceNumericId)||
  a.style.localeCompare(b.style)||a.invokeOffset-b.invokeOffset||
  a.conditionOrIndex-b.conditionOrIndex||
  (a.preconditionOrIndex??-1)-(b.preconditionOrIndex??-1));
 const byStyle=['逃げ','先行','差し','追込'].map(style=>{
  const subset=rows.filter(row=>row.style===style);
  const units=subset.reduce((n,row)=>
   n+row.modelRunnerRaceUnitsWithObservedDrawSupport,0);
  const supportSum=subset.reduce((n,row)=>
   n+row.sumUniformDrawSupportFractions,0);
  return {style,originalSourcePaths:subset.length,
   originalSourcePathsWithObservedDrawSupport:
    subset.filter(row=>row.modelRunnerRaceUnitsWithObservedDrawSupport>0).length,
   modelSourcePathRunnerRaceUnits:units,
   modelRunnerRaceUnitsWithPositiveDrawSupport:subset.reduce((n,row)=>
    n+row.modelRunnerRaceUnitsWithPositiveDrawSupport,0),
   modelRunnerRaceUnitsWithZeroDrawSupport:subset.reduce((n,row)=>
    n+row.modelRunnerRaceUnitsWithZeroDrawSupport,0),
   meanUniformDrawSupportFraction:units?supportSum/units:null,
   originalSourceWholeSkillProcObserved:false};
 });
 fail(byStyle.reduce((n,row)=>n+row.modelSourcePathRunnerRaceUnits,0)===
  evaluated&&byStyle.reduce((n,row)=>n+row.originalSourcePaths,0)===371,
  'four original style strata lost model source-path units');
 fail(rows.length===371&&evaluated===positive+zero&&
  rows.reduce((x,y)=>x+y.modelRunnerRaceUnitsWithObservedDrawSupport,0)===
  evaluated&&
  rows.reduce((x,y)=>x+y.modelRunnerRaceUnitsHeldMultiplePhasePredicates,0)===
  heldMultiple&&
  evaluated>0&&runnerRacesObserved>0,
  'no independently checked full-range original phase candidate');
 return {schemaVersion:1,status:STATUS,
  provenance:{originalUmaSimRevision:sourceVerification.umaSimRevision,
   originalSourceRegistryCohort:102,originalSourceSkillStyleCells:315,
   originalSourceRouteAlternatives:371,
   originalFullSourceTextEmbedded:false,
   globalSimRevision:legacy.PIN},
  study:{fixedNoSkillGlobalSimRaces:plans.length,
   randomPositionModeHypothesis:'UmaSim RANDOM: uniform draw fraction in [0,1)',
   originalSourceTenMetreClosedWindow:true,
   originalSourceTerminalStartClipMetres:2,
   observedWindowHit:'at least one observed same-model-runner pre-priority position lies inside a single hypothetical cached interval',
   sampleUnit:'one original source route × one GlobalSim model runner × one fixed model race',
   perTickIndependenceAssumed:false,
   originalRngDrawsRecorded:false,
   uniformDrawFractionIsActualSkillActivationProbability:false,
   fullSourceANDOROrPreconditionsProven:false},
  sourceVerification,
  priorModelParity:{
   modelFrames:validation.totals.framePairs,
   matchedOriginalModelPhysicalColumns:validation.totals.identicalPhysicalColumns,
   modelPriorityPositions:validation.totals.noSkillRunnerTicks},
  counts:{
   originalSourcePaths:rows.length,
   modelRunnerRacesWithPositionSamples:runnerRacesObserved,
   modelPriorityPositionSamples:priorityPositionSamples,
   modelSourcePathRunnerRaceUnitsEvaluated:evaluated,
   modelSourcePathRunnerRaceUnitsHeldMultiplePhasePredicates:heldMultiple,
   modelSourcePathRunnerRaceUnitsWithPositiveDrawSupport:positive,
   modelSourcePathRunnerRaceUnitsWithZeroDrawSupport:zero,
   originalSourcePathsWithAtLeastOneModelUnitEvaluated:
    rows.filter(x=>x.modelRunnerRaceUnitsWithObservedDrawSupport>0).length,
   originalSourcePathsWithoutEvaluatedModelUnit:
    rows.filter(x=>x.modelRunnerRaceUnitsWithObservedDrawSupport===0).length,
   sumDrawSupportFractionsAcrossModelUnits:accumulated
  },
  rows,byStyle,
  gates:{
   originalUmaSimSourceWindowFormulaAnchored:true,
   originalUmaSimActualRandomDrawObserved:false,
   fixedGlobalSimPreSkillPositionsActuallyObserved:true,
   originalSourceSkillActuallyEquipped:false,
   sourcePhaseRandomSameTickActualRuntimeANDObserved:false,
   originalSourceWholeSkillProcMeasured:false,
   fourStyleGameActivationRateMeasured:false,
   P3CardSuitabilityApproved:false,P4PublicUiChanged:false},
  limitations:[
   'The source-backed RANDOM draw fraction is integrated over all possible values under the pinned UmaSim uniform source formula, not observed from UmaSim itself.',
   'The trajectory is pinned unskilled GlobalSim v77, not UmaSim or the actual game. Its positions are observed at GlobalSim skill-priority instants with the initialized stage held.',
   'Only a single phase_random in current conditions with all other predicates statically verified in the fixed course/style is evaluated. Historical preConditions and multiple phase predicates remain unknown; alternative paths and invokes are NEVER summed into skill opportunity.',
   'A mean across original paths and artificial runners is NOT a game activation rate, official activation condition likelihood, or approved suitability ranking.',
   'The same model runner and scenario appear in multiple source paths. All route×runner×race quantities are correlated and cannot be counted as independent game trials.',
   'GlobalSim samples random windows differently from pinned UmaSim. This experiment does not install source skills or validate their real activation, cooldown, wisdom or effects.'
  ]
 };
}
function main(args){
 if(args[0]!=='replay'||args.length!==8)throw Error(
  'replay <model-template.jsonl> <original-engine> <position-probe-engine> <pinned-phase-cohort.json> <SkillChecker.kt> <RaceState.kt> <out.json>');
 const [_,templatePath,originalEngine,probeEngine,cohortPath,
  checkerPath,raceStatePath,outPath]=args;
 const sourceVerification=geometry.verifyPinnedSources(
  fs.readFileSync(checkerPath,'utf8'),
  fs.readFileSync(raceStatePath,'utf8'));
 const templateLines=fs.readFileSync(templatePath,'utf8').trim().split(/\r?\n/);
 fail(templateLines.length===1,'one pinned model template expected');
 const plans=legacy.plans(),template=JSON.parse(templateLines[0]);
 const races=plans.map(p=>expanded.makeRace(template,p));
 fail(races.every(x=>x.horses.every(h=>h.skills?.length===0)),
  'fixed control model has installed source skills');
 const original=legacy.replay(originalEngine,races),
  observed=legacy.replay(probeEngine,races);
 const cohort=JSON.parse(fs.readFileSync(cohortPath,'utf8'));
 const result=analyze(original,observed,plans,cohort,sourceVerification);
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log('P2_15_ORIGINAL_SOURCE_ALL_DRAW_SUPPORT='+JSON.stringify({
  provenance:result.provenance,counts:result.counts,
  byStyle:result.byStyle,
  matchedPhysics:result.priorModelParity.matchedOriginalModelPhysicalColumns,
  sourceWindowVerification:result.sourceVerification,
  gates:result.gates
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,analyze,main};
