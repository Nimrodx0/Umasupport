'use strict';
/*
 * P2.15 whole-source-condition LOGICAL REPLAY (not a skill proc simulator).
 *
 * The pinned UmaSim SkillChecker evaluates OR-of-AND predicates and latches
 * a true preCheck across later ticks. This module preserves that topology.
 * Exact predicate observations are injected, not fabricated from GlobalSim
 * approximate replay columns. Any unobserved predicate remains UNKNOWN.
 *
 * It does NOT simulate skill cooldown, wisdom check, extra effects, activation
 * order, game probabilities, W/D or suitability. Even a TRUE result means
 * 'source condition logic satisfied under the supplied facts', not proc.
 */
const full=require('./skill_full_condition_path_audit.cjs');
const TRUE='true',FALSE='false',UNKNOWN='unknown';
const STATES=new Set([TRUE,FALSE,UNKNOWN]);
const STATIC_TYPES=new Set([
 'running_style','distance_type','ground_type','ground_condition','track_id'
]);
const SIDES=new Set(['conditions','preConditions']);
const assert=(ok,msg)=>{if(!ok)throw Error('P2.15 whole-tick: '+msg);};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const AND=values=>values.includes(FALSE)?FALSE:
 values.includes(UNKNOWN)?UNKNOWN:TRUE;
const OR=values=>values.includes(TRUE)?TRUE:
 values.includes(UNKNOWN)?UNKNOWN:FALSE;
const normalizeIndex=(x,name)=>{
 assert(Number.isSafeInteger(x)&&x>=0,name+' must be nonnegative integer');
 return x;
};
function identity(ref){
 return [ref.invokeOffset,ref.side,ref.orIndex,ref.predicateIndex].join('/');
}
function compile(profile){
 // Require already source-checked P1 representation. Never accept invented
 // partial summaries as whole original-source condition structure.
 if(profile?.activationProfile)profile=profile.activationProfile;
 assert(profile?.status==='source-structure'&&
  typeof profile.sourceNumericId==='string'&&/^[0-9]+$/.test(profile.sourceNumericId)&&
  Array.isArray(profile.invokes)&&profile.invokes.length>0,
  'complete source profile with numeric ID and invokes required');
 const lookup=new Map();
 const invokes=profile.invokes.map((record,invokeOffset)=>{
  assert(isObj(record)&&Array.isArray(record.conditions)&&
   Array.isArray(record.preConditions)&&
   Number.isSafeInteger(record.index),'invalid original invoke structure');
  function matrix(side){
   const rows=record[side];
   assert(rows.every(Array.isArray),'invalid '+side+' matrix');
   return rows.map((row,orIndex)=>row.map((p,predicateIndex)=>{
    assert(p&&typeof p.type==='string'&&p.type.length>0&&
     ['==','!=','<','<=','>','>='].includes(p.operator)&&
     Number.isSafeInteger(p.value),'invalid original predicate');
    const ref={invokeOffset,invokeIndex:record.index,side,orIndex,
     predicateIndex,type:p.type,operator:p.operator,value:p.value};
    const key=identity(ref);
    assert(!lookup.has(key),'duplicate original predicate identity');
    lookup.set(key,ref);
    return ref;
   }));
  }
  return {invokeOffset,invokeIndex:record.index,
   conditions:matrix('conditions'),preConditions:matrix('preConditions')};
 });
 return Object.freeze({sourceNumericId:profile.sourceNumericId,
  status:'source-logical-condition-structure-only',invokes,
  predicateCount:lookup.size,lookup});
}
function observationMap(compiled,observations){
 assert(Array.isArray(observations),'tick.observations must be an array');
 const found=new Map();
 for(const o of observations){
  assert(isObj(o),'malformed observation');
  normalizeIndex(o.invokeOffset,'invokeOffset');
  normalizeIndex(o.orIndex,'orIndex');
  normalizeIndex(o.predicateIndex,'predicateIndex');
  assert(SIDES.has(o.side)&&typeof o.type==='string'&&
   typeof o.operator==='string'&&Number.isSafeInteger(o.value)&&
   typeof o.satisfied==='boolean','incomplete source predicate observation');
  const key=identity(o),expected=compiled.lookup.get(key);
  assert(expected,'observation refers to absent source predicate');
  assert(expected.type===o.type&&expected.operator===o.operator&&
   expected.value===o.value,
   'observation predicate does not match original source expression');
  assert(!found.has(key),'duplicate observation of original predicate');
  found.set(key,o.satisfied?TRUE:FALSE);
 }
 return found;
}
function staticValue(staticContext,p){
 if(!STATIC_TYPES.has(p.type)||!Object.hasOwn(staticContext,p.type))
  return UNKNOWN;
 const v=staticContext[p.type];
 assert(Number.isSafeInteger(v),'invalid static context for '+p.type);
 return full.check(v,p.operator,p.value)?TRUE:FALSE;
}
function measure(ref,staticContext,facts){
 const direct=staticValue(staticContext,ref);
 const supplied=facts.get(identity(ref));
 if(direct!==UNKNOWN&&supplied!==undefined)
  assert(direct===supplied,'measured predicate contradicts explicit race context');
 return direct!==UNKNOWN?direct:(supplied??UNKNOWN);
}
function evalMatrix(rows,context,facts){
 // The fixed original SkillChecker returns true if the OR list is empty.
 // An empty AND row is likewise a true conjunction.
 const pathStates=rows.map(row=>AND(row.map(ref=>measure(ref,context,facts))));
 return {status:rows.length?OR(pathStates):TRUE,pathStates};
}
class WholeTickMonitor {
 constructor(sourceProfile){
  this.compiled=compile(sourceProfile);
  this.preState=this.compiled.invokes.map(x=>
   x.preConditions.length?FALSE:TRUE);
  this.lastTick=-1;
  this.anyTickTrue=FALSE;
  this.tickCount=0;
 }
 step(tick){
  assert(isObj(tick)&&Number.isSafeInteger(tick.tickIndex)&&
   tick.tickIndex===this.lastTick+1,'tickIndex must be contiguous from 0');
  const staticContext=tick.staticContext??{};
  assert(isObj(staticContext),'staticContext must be an object');
  const facts=observationMap(this.compiled,tick.observations??[]);
  // Stage all historical latch updates. Invalid data in a later Invoke
  // cannot corrupt earlier latches or consume the tick before validation.
  const nextPreState=this.preState.slice();
  const invokes=this.compiled.invokes.map((v,i)=>{
   const pre=evalMatrix(v.preConditions,staticContext,facts);
   // Original UmaSim: preChecked = preChecked || preCheck(this).
   // UNKNOWN persists across later false ticks, because an unobserved
   // historical true could have latched. A later TRUE resolves it.
   nextPreState[i]=OR([nextPreState[i],pre.status]);
   const normal=evalMatrix(v.conditions,staticContext,facts);
   return {invokeOffset:v.invokeOffset,invokeIndex:v.invokeIndex,
    preconditionNow:pre.status,preconditionLatched:nextPreState[i],
    conditionNow:normal.status,conditionAlternatives:normal.pathStates,
    preconditionAlternatives:pre.pathStates,
    conditionConjunction:AND([nextPreState[i],normal.status])};
  });
  const overall=OR(invokes.map(x=>x.conditionConjunction));
  this.preState=nextPreState;
  this.anyTickTrue=OR([this.anyTickTrue,overall]);
  this.lastTick=tick.tickIndex;this.tickCount++;
  return {status:'source-conditions-under-supplied-facts-not-proc',
   sourceNumericId:this.compiled.sourceNumericId,tickIndex:tick.tickIndex,
   overallCondition:overall,everConditionSatisfied:this.anyTickTrue,
   invokes,gameProcMeasured:false,eligibleForP3CardScoring:false,
   suitabilityLabel:null};
 }
}
function run(profile,ticks){
 assert(Array.isArray(ticks)&&ticks.length>0,'nonempty sequential ticks required');
 const monitor=new WholeTickMonitor(profile);
 const results=ticks.map(t=>monitor.step(t));
 const tallies={true:0,false:0,unknown:0};
 for(const r of results)tallies[r.overallCondition]++;
 return {schemaVersion:1,status:'source-condition-logic-tick-replay-not-game-proc',
  sourceNumericId:monitor.compiled.sourceNumericId,
  totalTicks:results.length,tallies,
  everConditionSatisfied:monitor.anyTickTrue,
  ticks:results,
  actualUmaSimRuntimeObserved:false,actualGlobalSimSourcePredicateJoin:false,
  skillProcRate:null,eligibleForP3CardScoring:false,
  cardScore:null,suitabilityLabel:null};
}
module.exports={TRUE,FALSE,UNKNOWN,STATES,STATIC_TYPES,AND,OR,
 identity,compile,observationMap,staticValue,evalMatrix,WholeTickMonitor,run};
