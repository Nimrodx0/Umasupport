'use strict';
/*
 * P2.15: original UmaSim positional predicate FORMULAS applied to observed
 * GlobalSim pre-skill priority positions. Source semantics are pinned to
 * UmaSim Kotlin; model state is NOT original UmaSim runtime or game state.
 *
 * Only position-derived families with source-anchored formulas are supplied.
 * Do not infer rank, random windows, used skills or historical preconditions
 * from position. Numeric boundary ambiguity is UNKNOWN, never assumed false.
 */
const full=require('./skill_full_condition_path_audit.cjs');
const ORIGINAL_REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const STATUS='P2.15-source-formula-position-stage-facts-model-only';
const TYPES=Object.freeze([
 'phase','phase_firsthalf','phase_laterhalf','remain_distance','furlong'
]);
const TYPE_SET=new Set(TYPES);
const EPS_METRES=1e-6;
const CHECKER_ANCHORS=[
 '"phase" -> condition.checkInRace { currentPhase }',
 '"phase_firsthalf" -> condition.checkInRace {',
 'if (simulation.startPosition < (start + end) / 2) currentPhase else -1',
 '"phase_laterhalf" -> condition.checkInRace {',
 'if (simulation.startPosition >= (start + end) / 2) currentPhase else -1',
 '"remain_distance" -> condition.checkInRace { (baseSetting.courseLength - simulation.startPosition).toInt() }',
 '"furlong" -> condition.checkInRace { (simulation.startPosition / 200.0).toInt() }'
];
const STATE_ANCHORS=[
 'val currentPhase get() = getPhase(simulation.startPosition)',
 'position < 0 -> -1',
 'position < setting.phase1Start -> 0',
 'position < setting.phase2Start -> 1',
 'position < setting.phase3Start -> 2',
 'override val phase1Start by lazy { courseLength / 6.0 }',
 'override val phase2Start by lazy { (courseLength * 2.0) / 3.0 }',
 'override val phase3Start by lazy { (courseLength * 5.0) / 6.0 }',
 '0 -> 0.0 to phase1Start',
 '1 -> phase1Start to phase2Start',
 '2 -> phase2Start to phase3Start',
 '3 -> phase3Start to courseLength.toDouble()'
];
const CALCULATOR_ANCHORS=[
 'private fun RaceState.updateFrame(): Boolean {',
 'simulation.startPosition = simulation.position'
];
const fail=(ok,msg)=>{if(!ok)throw Error('P2.15 source position formulas: '+msg);};
function verifyPinnedSources(checker,sourceState,sourceCalculator){
 for(const [name,text,anchors] of [
  ['SkillChecker.kt',checker,CHECKER_ANCHORS],
  ['RaceState.kt',sourceState,STATE_ANCHORS],
  ['RaceCalculator.kt',sourceCalculator,CALCULATOR_ANCHORS]]){
  fail(typeof text==='string'&&text.length>1000,
   'missing pinned '+name);
  for(const x of anchors)fail(text.includes(x),
   'fixed original UmaSim '+name+' formula changed: '+x);
 }
 return Object.freeze({
  status:STATUS,originalUmaSimRevision:ORIGINAL_REV,
  verifiedPredicateTypes:[...TYPES],
  modelPositionIsOriginalUmaSimStartPosition:false,
  originalUmaSimRaceStateObserved:false,
  originalGameSkillProcObserved:false,
  phaseBoundaryGuardMetres:EPS_METRES
 });
}
function verifyEvidence(evidence){
 fail(evidence?.status===STATUS&&
  evidence.originalUmaSimRevision===ORIGINAL_REV&&
  evidence.modelPositionIsOriginalUmaSimStartPosition===false&&
  evidence.originalUmaSimRaceStateObserved===false&&
  evidence.originalGameSkillProcObserved===false&&
  JSON.stringify(evidence.verifiedPredicateTypes)===JSON.stringify(TYPES)&&
  evidence.phaseBoundaryGuardMetres===EPS_METRES,
  'unverified source position formula evidence');
 return true;
}
function near(value,target){
 return Math.abs(value-target)<=EPS_METRES;
}
function derivedAtModelPosition(position,courseLength){
 fail(Number.isFinite(position)&&Number.isSafeInteger(courseLength)&&
  courseLength>20&&courseLength<9999,
  'invalid model priority position or fixed race length');
 // An observed model priority stage may lie outside the original
 // UmaSim source's running race domain. Do not project it as a predicate.
 if(position<0||position>=courseLength)return Object.fromEntries(TYPES.map(x=>[x,null]));
 const bounds=[0,courseLength/6,courseLength*2/3,
  courseLength*5/6,courseLength];
 const phase= bounds.slice(1,4).some(boundary=>near(position,boundary))?
  null:position<bounds[1]?0:position<bounds[2]?1:
    position<bounds[3]?2:3;
 let first=null,later=null;
 if(phase!==null){
  const half=(bounds[phase]+bounds[phase+1])/2;
  if(!near(position,half)){
   first=position<half?phase:-1;
   later=position>=half?phase:-1;
  }
 }
 const remain=courseLength-position;
 const furlong=position/200;
 return {phase,phase_firsthalf:first,phase_laterhalf:later,
  remain_distance:near(remain,Math.round(remain))?null:Math.trunc(remain),
  furlong:near(position,Math.round(furlong)*200)?null:Math.trunc(furlong)};
}
function observations(compiled,position,courseLength){
 fail(compiled?.lookup instanceof Map,
  'compiled original source AST with predicate identities required');
 const sourceValues=derivedAtModelPosition(position,courseLength);
 const facts=[];
 for(const ref of compiled.lookup.values()){
  if(!TYPE_SET.has(ref.type))continue;
  const value=sourceValues[ref.type];
  if(value===null)continue;
  facts.push({...ref,satisfied:full.check(value,ref.operator,ref.value)});
 }
 return facts;
}
module.exports={ORIGINAL_REV,STATUS,TYPES,EPS_METRES,
 CHECKER_ANCHORS,STATE_ANCHORS,CALCULATOR_ANCHORS,
 verifyPinnedSources,verifyEvidence,derivedAtModelPosition,observations};
