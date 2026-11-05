'use strict';
/* P2 experimental *activation-condition* fit, NOT skill utility or true
 * activation probability. Work with source-pinned predicates only.
 * Preserve AND/OR and hold unmodelled predicates instead of promoting them. */
const rank=require('./skill_rank_timing.js');
const VERSION='activation-condition-fit-v1.1';
const STYLES=Object.freeze([
 {id:1,name:'逃げ'},{id:2,name:'先行'},
 {id:3,name:'差し'},{id:4,name:'追込'}
]);
const LABELS=Object.freeze({
 high:'高適合',low:'低適合',dependent:'条件依存',
 neutral:'脚質差なし',held:'評価保留',ineligible:'発動不可'
});
const OP=new Set(['==','!=','<','<=','>','>=']);
const NEUTRAL_CONTEXT=new Set([
 'distance_type','ground_type','ground_condition','rotation',
 'track_id','is_basis_distance'
]);
// A race-level gate controls WHERE the skill can activate. It is not
// evidence that one running style is better or worse than another.
const RACE_GATES=new Set(['distance_type','ground_type','ground_condition']);
const GROUND_DOMAINS=Object.freeze({
 ground_type:[1,2],
 ground_condition:[1,2,3,4]
});
const SURFACE_TRANSFER=Object.freeze({
 status:'provisional-cross-surface-direction-not-verified',
 scope:'qualitative-style-direction-only',
 note:'馬場条件は別の絶対条件として保持。芝・ダートや馬場状態別の順位傾向は未検証のため、脚質の基本方向性のみ暫定適用。実ゲームの発動率は不明。'
});
const supportedGroundGate=c=>!Object.hasOwn(GROUND_DOMAINS,c.type)||
 GROUND_DOMAINS[c.type].some(v=>testOperator(v,c.operator,c.value));
const RESEARCH=Object.freeze({
 middleAndFinal:'GlobalSim pinned #343 2160 races, #344 1080 all-recorded-position races',
 early:'GlobalSim pinned #344 1080 all-recorded-position races',
 late:'GlobalSim pinned #344 1080 races, #345 1440 fixed-roster races',
 roster:'GlobalSim pinned #346 5760 fixed-focal matched races',
 interpretation:'relative style-group tendency only, not an absolute probability, skill usefulness, or a real-game trigger rate'
});
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const cond=c=>({type:c.type,operator:c.operator,value:c.value});
const valid=c=>isObj(c)&&typeof c.type==='string'&&c.type.length>0&&
 OP.has(c.operator)&&Number.isSafeInteger(c.value);
function testOperator(a,op,b){
 switch(op){
 case '==':return a===b;
 case '!=':return a!==b;
 case '<':return a<b;
 case '<=':return a<=b;
 case '>':return a>b;
 case '>=':return a>=b;
 default:throw Error('Invalid condition comparison');
 }
}
const result=(status,reason,extra={})=>({
 status,label:LABELS[status],reason,...extra
});
function explicitStyle(row,styleId){
 const checks=row.filter(c=>c.type==='running_style');
 return checks.length?checks.every(c=>testOperator(styleId,c.operator,c.value)):null;
}
function rankOnly(row,styleId){
 const ranks=row.filter(c=>c.type==='order_rate');
 const times=row.filter(c=>Object.hasOwn(rank.TIME_SPECS,c.type));
 if(!ranks.length)return null;
 if(ranks.length!==1)
  return result('held','rank-predicate-intersection-unverified');
 const c=ranks[0];
 // No threshold cutoffs invented from model distributions. This is the
 // exact 50% partition already researched; other rank bands need mapping.
 if(!((c.operator==='<='&&c.value===50)||
      (c.operator==='>'&&c.value===50)))
  return result('held','rank-operator-or-threshold-not-validated');
 if(times.length!==1)
  return result('held','rank-needs-one-source-timing-window');
 const t=rank.timing(times[0]);
 if(t?.status!=='source-defined'||t.courseDependent||!t.randomWindow||
  t.phaseIndexes.length!==1)
  return result('held','rank-timing-not-comparable');
 const p=t.phaseIndexes[0],front=c.operator==='<=';
 const basis=p===3?'late':p===0?'early':'middleAndFinal';
 const metadata={relativeDirection:front?'front':'back',
  phaseIndex:p,periodCode:times[0].type,
  sourceThreshold:'order_rate'+c.operator+'50',
  researchBasis:RESEARCH[basis],researchScope:'pinned-GlobalSim-only'};
 if(p===3&&times[0].type!=='phase_random')
  return result('held','late-subphase-not-verified',metadata);
 if(p===3)
  return result('dependent','late-phase-group-order-exceptions-observed',
   {...metadata,note:'終盤後半のモデル条件では脚質群の有利不利に例外が確認されている'});
 if(p===0&&times[0].type!=='phase_random')
  return result('held','early-subphase-not-verified',metadata);
 if(p===1&&times[0].type!=='phase_random')
  return result('held','middle-subphase-not-verified',metadata);
 if(p===2&&![
   'phase_random','phase_firsthalf_random','phase_laterhalf_random'
  ].includes(times[0].type))
  return result('held','final-subphase-not-verified',metadata);
 const favored=front?styleId<=2:styleId>=3;
 return result(favored?'high':'low',
  'validated-relative-front-rear-group-direction',metadata);
}
function branch(row,styleId,{preconditionRows=[]}={}){
 if(!Array.isArray(row)||row.some(c=>!valid(c)))
  throw Error('Invalid source AND condition row');
 if(!Array.isArray(preconditionRows)||
  preconditionRows.some(p=>!Array.isArray(p)||p.some(c=>!valid(c))))
  throw Error('Invalid source precondition OR rows');
 const conditions=row.map(cond);
 const style=explicitStyle(row,styleId);
 if(style===false)
  return result('ineligible','explicit-running-style-AND-excludes-style',
   {sourceConditions:conditions});
 // Precondition OR rows: all branches exclude the style -> provably forbidden.
 // If any branch might allow it, don't ignore other unmodelled preconditions.
 if(preconditionRows.length){
  const pre=preconditionRows.map(p=>explicitStyle(p,styleId));
  if(pre.every(x=>x===false))
   return result('ineligible','all-explicit-style-precondition-OR-paths-exclude-style',
    {sourceConditions:conditions,preconditionRows:preconditionRows.map(p=>p.map(cond))});
 }
 const rankEvidence=rankOnly(row,styleId);
 const extra=row.filter(c=>c.type!=='order_rate'&&
  c.type!=='running_style'&&!Object.hasOwn(rank.TIME_SPECS,c.type)&&
  !NEUTRAL_CONTEXT.has(c.type));
 const phase=row.filter(c=>Object.hasOwn(rank.TIME_SPECS,c.type));
 const unvalidatedTiming=phase.some(c=>{
  const t=rank.timing(c);
  return t?.status!=='source-defined'||t.courseDependent;
 });
 const contextual=row.filter(c=>NEUTRAL_CONTEXT.has(c.type)).map(cond);
 const raceRequirements=contextual.filter(c=>RACE_GATES.has(c.type));
 const surfaceTransfer=rankEvidence&&raceRequirements.some(c=>
  c.type==='ground_type'||c.type==='ground_condition')?
  SURFACE_TRANSFER:null;
 // Accept a surface/condition only as a *race gate*. Its exact operator
 // remains in sourceConditions; it neither proves a style-specific
 // effect nor forces a hold when the rank/phase evidence is available.
 // Unknown course geometry still requires a separate comparison.
 const unmatchedContext=rankEvidence?contextual.filter(c=>
  !((c.type==='distance_type'&&c.operator==='=='&&
    Number.isInteger(c.value)&&c.value>=1&&c.value<=4)||
    (Object.hasOwn(GROUND_DOMAINS,c.type)&&supportedGroundGate(c)))):[];
 const blockers=[];
 if(unmatchedContext.length)blockers.push('race-context-not-matched-to-position-study');
 if(style===true)blockers.push('explicit-style-permission-does-not-prove-relative-suitability');
 if(preconditionRows.length)blockers.push('preconditions-not-fully-modelled');
 if(extra.length)blockers.push('additional-AND-opportunity-predicates-unmeasured');
 if(unvalidatedTiming)blockers.push('timing-not-source-comparable');
 if(phase.length>1)blockers.push('multiple-timing-predicates-unmeasured');
 if(rankEvidence?.status==='held')blockers.push(rankEvidence.reason);
 if(blockers.length)return result('held',blockers[0],{
  allReasons:blockers,sourceConditions:conditions,contextPredicates:contextual,
  raceRequirements,surfaceTransfer,
  unmodelledPredicates:[...extra.map(cond),...unmatchedContext],rankOnly:rankEvidence
 });
 if(rankEvidence){
  return {...rankEvidence,sourceConditions:conditions,
   contextPredicates:contextual,raceRequirements,surfaceTransfer,
   ruleVersion:VERSION};
 }
 if(phase.length){
  // Only race-global timing, not corner/straight opportunities.
  if(phase.some(c=>!['phase','phase_random'].includes(c.type)))
   return result('held','style-neutrality-of-specific-timing-unverified',
    {sourceConditions:conditions});
 }
 if(!row.length)return result('held','empty-source-condition-row-not-proof-of-activation',
  {sourceConditions:conditions});
 // Only validated race-global predicates remain, with no style or rank
 // dependency. "Neutral" applies to the conditions, not effects or triggers.
 return result('neutral','all-known-AND-predicates-race-global',
  {sourceConditions:conditions,contextPredicates:contextual,raceRequirements});
}
function evaluate(profile){
 if(!isObj(profile)||profile.status!=='source-structure'||
  !Array.isArray(profile.invokes)||!profile.invokes.length)
  return {ruleVersion:VERSION,status:'held',
   reason:'source-activation-profile-unavailable',
   styles:Object.fromEntries(STYLES.map(s=>[s.name,
    result('held','source-activation-profile-unavailable')]))};
 const outcomes=Object.fromEntries(STYLES.map(style=>{
  const paths=[];
  for(const [invokeOffset,invoke] of profile.invokes.entries()){
   if(!isObj(invoke)||!Array.isArray(invoke.conditions)||
    !Array.isArray(invoke.preConditions))
    throw Error('Invalid source invoke structure');
   if(!invoke.conditions.length){
    paths.push({invokeOffset,orIndex:null,...result('held','no-activation-condition-rows')});
    continue;
   }
   for(const [orIndex,row] of invoke.conditions.entries()){
    const e=branch(row,style.id,{preconditionRows:invoke.preConditions});
    paths.push({invokeOffset,orIndex,sourceInvokeIndex:invoke.index??invokeOffset,...e});
   }
  }
  const reachable=paths.filter(p=>p.status!=='ineligible');
  let all;
  if(!reachable.length)
   all=result('ineligible','every-source-invoke-and-OR-path-explicitly-excludes-style');
  else if(reachable.some(p=>p.status==='held'))
   all=result('held','some-reachable-AND-OR-paths-remain-unevaluated');
  else if(new Set(reachable.map(p=>p.status)).size===1)
   all=result(reachable[0].status,'every-reachable-AND-OR-path-agrees');
  else
   all=result('held','different-source-OR-or-invoke-fits');
  return [style.name,{...all,styleId:style.id,paths}];
 }));
 return {ruleVersion:VERSION,status:'evaluated-source-structure',
  sourceNumericId:profile.sourceNumericId||null,
  scope:'activation-condition-fit-not-game-trigger-rate-or-value',
  styles:outcomes,sourceInvokes:profile.invokes.length};
}
module.exports={VERSION,STYLES,LABELS,RESEARCH,NEUTRAL_CONTEXT,RACE_GATES,
 GROUND_DOMAINS,SURFACE_TRANSFER,supportedGroundGate,
 testOperator,explicitStyle,rankOnly,branch,evaluate};
