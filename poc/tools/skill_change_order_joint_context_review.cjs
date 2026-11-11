#!/usr/bin/env node
'use strict';
/*
 * P2.20 restricted SAME-runner, SAME-pre-skill-tick intersection:
 * Source change_order_onetime AND static running_style/distance_type.
 *
 * Stage measurements are aggregated by fixed course + running style, so
 * joining constant source gates is an exact intersection for the *measured*
 * factors, NOT for unknown AND, preconditions, OR or game procs.
 *
 * No skill was loaded in the original GlobalSim run. No model or game rate.
 */
const fs=require('node:fs');
const stage=require('./globalsim_change_order_skill_tick.cjs');
const sourceAudit=require('../src/skill_change_order_source_paths.cjs');
const VERSION='P2.20-pre-skill-rank-static-source-gate-intersection-v1';
const STYLE_IDS=Object.freeze({Nige:1,Senkou:2,Sasi:3,Oikomi:4});
const STYLE_NAMES=Object.freeze(['逃げ','先行','差し','追込']);
const CATALOG=Object.freeze({
 '10502':{distanceType:2,distance:1600},
 '10504':{distanceType:3,distance:2000}
});
function classifySignOnly(conditions){
 if(!Array.isArray(conditions)||!conditions.length||
  conditions.some(c=>!c||!['==','!=','>','>=','<','<='].includes(c.operator)||
   !Number.isSafeInteger(c.value)))return null;
 // The archived stage report stores SIGN ONLY, not the original magnitude.
 // It is valid to infer true ticks only if each sign bucket is uniform for
 // all possible +/- ranks up to a conservative 12-horse field.
 const apply=v=>conditions.every(c=>stage.compare(v,c.operator,c.value));
 const uniform=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i)
  .every(x=>apply(x)===apply(a));
 if(!uniform(-12,-1)||!uniform(1,12))return null;
 return {rise:apply(-1),zero:apply(0),fall:apply(1)};
}
function finiteGateAllows(predicates,styleId,distanceType){
 if(!Array.isArray(predicates))throw Error('Invalid exact source finite predicates');
 for(const p of predicates){
  if(!p||!sourceAudit.STATIC.has(p.type)||
   !Number.isSafeInteger(p.value)||
   !['==','!=','>','>=','<','<='].includes(p.operator))
   throw Error('Unknown source gate cannot be silently treated as compatible');
  const actual=p.type==='running_style'?styleId:distanceType;
  if(!stage.compare(actual,p.operator,p.value))return false;
 }
 return true;
}
function sourceGateAllows(gate,styleId,distanceType){
 if(!gate||gate.scope!=='exact-source-static-style-distance-and-signed-rank-only'||
  !Array.isArray(gate.sameAndStatic)||
  !Array.isArray(gate.preconditionAlternatives)||
  !Array.isArray(gate.unmeasuredSameAndTypes))
  throw Error('Unvalidated fixed source rank context gate');
 if(!finiteGateAllows(gate.sameAndStatic,styleId,distanceType))return false;
 const choices=gate.preconditionAlternatives;
 return choices.length===0||choices.some(p=>{
  if(!p||!Array.isArray(p.static)||!Array.isArray(p.unmeasuredTypes))
   throw Error('Malformed source precondition OR');
  return finiteGateAllows(p.static,styleId,distanceType);
 });
}
function contextValidation(model){
 if(!model||model.schemaVersion!==1||
  model.status!=='P2-direct-retail-pre-skill-conditions-model-only-no-skill-proc'||
  model.globalSimRevision!==stage.PIN||
  model.sourceUmaSimSHA256!==stage.U_SHA||
  model.design?.originalSkillList!=='no-skills'||
  model.design?.races!==32||
  model.validation?.allPhysicalValuesEqual!==true||
  model.validation?.priorityCallRankStateMismatches!==0||
  model.validation?.prePriorityDisagreesWithPreviousPostRankCache!==0||
  !Array.isArray(model.styleContexts)||!model.styleContexts.length)
  throw Error('Unverified P2 source pre-skill tick reference');
 const keys=new Set();
 let ticks=0,rise=0,fall=0;
 for(const ctx of model.styleContexts){
  const id=[ctx.courseId,ctx.fieldSize,ctx.scenario,ctx.mode,ctx.style].join('|');
  if(keys.has(id)||!Object.hasOwn(CATALOG,String(ctx.courseId))||
   !Object.hasOwn(STYLE_IDS,ctx.style)||![9,12].includes(ctx.fieldSize)||
   !['balanced','backHeavy'].includes(ctx.scenario)||
   ctx.mode!=='equal')throw Error('Unknown or repeated P2.20 reference context');
  keys.add(id);
  for(const key of ['inspectedPreSkillTicks','preSkillRankRiseTicks','preSkillRankFallTicks']){
   if(!Number.isSafeInteger(ctx[key])||ctx[key]<0)
    throw Error('Missing or invalid pre-skill reference count '+key);
  }
  if(ctx.preSkillRankRiseTicks+ctx.preSkillRankFallTicks>ctx.inspectedPreSkillTicks)
   throw Error('Source tick sign observation contradicts denominator');
  ticks+=ctx.inspectedPreSkillTicks;
  rise+=ctx.preSkillRankRiseTicks;fall+=ctx.preSkillRankFallTicks;
 }
 const z=model.partialConditionOpportunity;
 if(ticks!==z?.evaluablePreSkillRunnerTicks||
  rise!==z?.preSkillRankUpRunnerTicks||
  fall!==z?.preSkillRankDownRunnerTicks)
  throw Error('Source tick observation does not reconcile by course and style');
 return model.styleContexts;
}
function inspect(model,source){
 const contexts=contextValidation(model);
 if(!source||source.schemaVersion!==1||
  source.status!=='P2-source-change-order-path-structure-not-complete-proc'||
  source.matchedSkillDenominator!==818||
  source.source?.sha256!==stage.U_SHA||
  source.summary?.sourceSkills!==30||
  !Array.isArray(source.paths)||!source.paths.length)
  throw Error('Unpinned 30-skill source path cohort');
 const seen=new Set(),rows=[];
 const totals={sourcePaths:0,modelSignOnlyPaths:0,heldNonSignOnlyPaths:0,
  sourcePathsWithUnknownRequiredConditions:0,
  modelRunnerTicksAfterStaticStyleDistanceFilter:0,
  signedModelRunnerTicksAfterStaticStyleDistanceFilter:0,
  sourcePathsWithSomeSignModelTicks:0};
 for(const p of source.paths){
  if(!/^[0-9]+$/.test(p.sourceNumericId||'')||
   !Number.isInteger(p.invokeOffset)||!Number.isInteger(p.orIndex)||
   !['conditions','preConditions'].includes(p.side)||
   !Array.isArray(p.conditions)||
   !Array.isArray(p.sameAndOtherTypes)||
   p.fullSkillEvaluated!==false)
   throw Error('Malformed signed rank source path');
  const pathId=[p.sourceNumericId,p.invokeOffset,p.side,p.orIndex].join('|');
  if(seen.has(pathId))throw Error('Duplicate source path identity');
  seen.add(pathId);
  const flags=classifySignOnly(p.conditions);
  const gate=p.fixedContextGate;
  const otherTypes=[...new Set([
   ...gate.unmeasuredSameAndTypes,
   ...gate.preconditionAlternatives.flatMap(x=>x.unmeasuredTypes)])].sort();
  const byStyle={};
  let totalCompatible=0,totalTrue=0;
  for(const [code,styleId] of Object.entries(STYLE_IDS)){
   let checked=0,matched=0,modelContexts=0;
   for(const ctx of contexts){
    if(ctx.style!==code)continue;
    const distance=CATALOG[String(ctx.courseId)].distanceType;
    if(!sourceGateAllows(gate,styleId,distance))continue;
    modelContexts++;
    checked+=ctx.inspectedPreSkillTicks;
    if(flags){
     const down=ctx.preSkillRankFallTicks,up=ctx.preSkillRankRiseTicks;
     const zero=ctx.inspectedPreSkillTicks-up-down;
     matched+=(flags.rise?up:0)+(flags.fall?down:0)+(flags.zero?zero:0);
    }
   }
   byStyle[code]={
    styleName:STYLE_NAMES[styleId-1],
    compatibleMeasuredContexts:modelContexts,
    observedReferenceRunnerTicks:checked,
    signedRankMatchedRunnerTicks:flags?matched:null,
    observedRole:'static-style-and-distance-plus-exact-pre-skill-rank-only'
   };
   totalCompatible+=checked;if(flags)totalTrue+=matched;
  }
  const unknown=otherTypes.length>0||
   gate.preconditionAlternatives.length>0||
   p.orCount>1||p.invokeCount>1||
   p.side!=='conditions';
  totals.sourcePaths++;
  if(flags)totals.modelSignOnlyPaths++;
  else totals.heldNonSignOnlyPaths++;
  if(unknown)totals.sourcePathsWithUnknownRequiredConditions++;
  totals.modelRunnerTicksAfterStaticStyleDistanceFilter+=totalCompatible;
  if(flags)totals.signedModelRunnerTicksAfterStaticStyleDistanceFilter+=totalTrue;
  if(flags&&totalTrue>0)totals.sourcePathsWithSomeSignModelTicks++;
  rows.push({
   sourceNumericId:p.sourceNumericId,
   invokeOffset:p.invokeOffset,orIndex:p.orIndex,side:p.side,
   invokeCount:p.invokeCount,conditionOrCount:p.orCount,
   signedRankCondition:p.conditions,
   fixedSourceGate:gate,
   modelSignBucket:flags||'unsupported-magnitude-sensitive-signed-rank',
   unmeasuredRequiredPredicateTypes:otherTypes,
   preconditionOrCount:gate.preconditionAlternatives.length,
   sourceHasAlternativeOR:p.orCount>1,
   anyOtherConditionUnverified:unknown,
   researchStatus:'source-model-partial-necessary-gate-only',
   byStyle
  });
 }
 if(totals.sourcePaths!==source.summary.sourceAndPaths||
  new Set(rows.map(x=>x.sourceNumericId)).size!==30)
  throw Error('Rank source path coverage unexpectedly drifted');
 return {schemaVersion:1,status:VERSION,
  source:{umaSimSkillSHA256:stage.U_SHA,globalSimRevision:stage.PIN},
  design:{races:32,modelSkillList:'none',scenarios:['balanced','backHeavy'],
   courses:[{id:10502,distanceType:2},{id:10504,distanceType:3}],
   fieldSizes:[9,12],sourcePaths:rows.length,
   measuredPredicates:['change_order_onetime',
    'running_style','distance_type'],
   measuredStage:'actual pre-priority-1 and pre-priority-0 source rank cache',
   knownUnmeasured:['ground_type','ground_condition',
    'phase and timing','corners','other distance/location gates',
    'preConditions runtime states','OR/Invoke activation semantics']},
  denominator:{sourceSkills:30,sourceAndPaths:rows.length,
   modelReferenceContexts:contexts.length,
   originalReferenceRunnerTicks:model.partialConditionOpportunity.evaluablePreSkillRunnerTicks},
  totals,rows,
  limitations:[
   'Model sign intersections are exact for the recorded no-skill pre-priority rank cache AND static style/distance of the SAME fixed runner and tick, not an independent-marginal multiplication.',
   'The model report stores only rank-change signs. Magnitude-dependent operators are held and never approximated.',
   'Other mandatory source predicates remain UNMEASURED; a tick counted here is never a full skill trigger or proc probability.',
   'No real skill is loaded; sources are the fixed UmaSim registry and GlobalSim artificial no-skill race plan.',
   'Zero matching ticks in 32 artificial races does not imply a skill is globally unusable.',
   'No user-facing labels, real-game skill probabilities, P3 card grades or effects are inferred.'
  ]};
}
function main(args){
 if(args.length!==3)throw Error('Usage: skill_change_order_joint_context_review.cjs <stage-report.json> <signed-source-paths.json> <output.json>');
 const [modelPath,sourcePath,outputPath]=args;
 const out=inspect(JSON.parse(fs.readFileSync(modelPath,'utf8')),
  JSON.parse(fs.readFileSync(sourcePath,'utf8')));
 fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
 console.log('P2_20_JOINT_CONTEXT_REVIEW='+JSON.stringify({
  status:out.status,denominator:out.denominator,totals:out.totals,
  exampleRows:out.rows.slice(0,8).map(row=>({
   sourceNumericId:row.sourceNumericId,
   signedRankCondition:row.signedRankCondition,
   unmeasuredRequiredPredicateTypes:row.unmeasuredRequiredPredicateTypes,
   trueByStyle:Object.fromEntries(Object.entries(row.byStyle)
    .map(([k,v])=>[k,v.signedRankMatchedRunnerTicks]))}))
 }));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={VERSION,STYLE_IDS,CATALOG,classifySignOnly,
 finiteGateAllows,sourceGateAllows,contextValidation,inspect,main};
