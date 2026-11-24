#!/usr/bin/env node
'use strict';
/*
 * P2.42 G4 source-dynamic stop/go decisions.
 * Joins P2.41 app-skill evidence, P2.32 exact source route families and
 * P2.37 *source* implementation decisions, not game/proc observations.
 * No score, inferred 4-style ranking or dropped unresolved AND is permitted.
 */
const fs=require('node:fs');
const p241=require('./p2_g3g4_combined_short_window_881.cjs');
const p232=require('../src/skill_p2_32_research_queue.cjs');
const p237=require('../src/skill_p2_37_dynamic_state_evidence.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const STATUS='P2.42-original-source-dynamic-AND-study-gates-not-game-W-or-card-scores';
const STUDIED_SOURCE=Object.freeze({
 '200512':'already-observed-natural-source-spurt-AND-P2.39',
 '200511':'already-checked-controlled-source-AND-P2.38-only'
});
const DYNAMIC=Object.keys(p237.TYPES);
const fail=(condition,why)=>{if(!condition)throw Error('P2.42 G4 decisions: '+why)};
const idKey=(source,offset,or,pre)=>[source,offset,or,pre??'none'].join('|');
const directOrder=(a,b)=>
 a.sourceNumericId.localeCompare(b.sourceNumericId,undefined,{numeric:true})||
 a.invokeOffset-b.invokeOffset||a.conditionOrIndex-b.conditionOrIndex||
 (a.preconditionOrIndex??-1)-(b.preconditionOrIndex??-1);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function cohort(ledger,queue,dynamic){
 fail(ledger?.schemaVersion===1&&ledger.status===p241.STATUS&&
  Array.isArray(ledger.rows)&&ledger.rows.length===ledger.summary?.appSkills&&
  ledger.sources?.sourceUmaSimSHA256===SOURCE_SHA&&
  ledger.summary?.sourceExceptionModeledSkills+
    ledger.summary?.directlyModeledSourceSkills===
   ledger.summary?.uniqueSourceSkillsWithConditionalPartialWDEvidence&&
  ledger.summary?.eligibleForP3CardScores===0&&
  ledger.summary?.productSkillSuitabilityScores===0,
  'P2.41 skill evidence and no-rating contract must be present');
 fail(queue?.schemaVersion===1&&queue.status===p232.STATUS&&
  Array.isArray(queue.rows)&&queue.rows.length===ledger.rows.length&&
  queue.source?.revision===p237.PIN&&
  queue.source?.skillRegistrySha256===SOURCE_SHA&&
  queue.denominators?.appSkills===ledger.rows.length&&
  queue.denominators?.sourceMatchedSkills===ledger.summary.sourceMatched&&
  queue.denominators?.officialP3OrP4Ratings===0,
  'P2.32 exact route cohort and source SHA drift');
 fail(dynamic?.schemaVersion===1&&dynamic.status===p237.STATUS&&
  dynamic.sourceSkillRegistrySHA256===SOURCE_SHA&&
  dynamic.source?.revision===p237.PIN&&
  dynamic.source?.mechanismSourceVerified===true&&
  dynamic.summary?.productSkillSuitabilityScores===0&&
  dynamic.summary?.originalFullSourceANDProven===0&&
  dynamic.summary?.noSourceApproximationsUsedAsRealStyleEvidence===true&&
  dynamic.rows&&Object.keys(dynamic.rows).sort().join('|')===DYNAMIC.slice().sort().join('|'),
  'P2.37 pinned original dynamic decision or no-rating boundary changed');
 const bySkill=new Map();
 for(const row of ledger.rows){
  fail(typeof row?.skillId==='string'&&!bySkill.has(row.skillId)&&
   row.wholeSkillSuitability==='not-established'&&row.cardScore===null&&
   row.eligibleForP3CardScoring===false,
   'duplicate P2.41 skill or prior full source suitability');
  bySkill.set(row.skillId,row);
 }
 const sourceSkillIds=new Set(),routeLookup=new Map();
 let matched=0,unmatched=0,allRoutes=0;
 for(const row of queue.rows){
  const app=bySkill.get(row.skillId);
  fail(app&&app.sourceNumericId===row.sourceNumericId&&
   Array.isArray(row.routeFamilies),'P2.32 / P2.41 app/source mismatch');
  if(row.sourceNumericId===null){
   unmatched++;
   fail(row.status==='source-unavailable'&&row.routeFamilies.length===0,
    'unmatched source unexpectedly has paths');
   continue;
  }
  matched++;
  fail(row.status==='source-route-research-candidates-only'&&
   typeof row.sourceNumericId==='string'&&
   !sourceSkillIds.has(row.sourceNumericId),
   'duplicate matched original source skill identity');
  sourceSkillIds.add(row.sourceNumericId);
  for(const route of row.routeFamilies){
   fail(Number.isSafeInteger(route.invokeOffset)&&route.invokeOffset>=0&&
    Number.isSafeInteger(route.conditionOrIndex)&&route.conditionOrIndex>=0&&
    (route.preconditionOrIndex===null||
     Number.isSafeInteger(route.preconditionOrIndex)&&route.preconditionOrIndex>=0)&&
    Array.isArray(route.unverifiedTypes)&&
    Array.isArray(route.finiteCompatibleStyles)&&
    route.finiteCompatibleStyles.length<=4,
    'malformed original Invoke/OR route');
   const key=idKey(row.sourceNumericId,route.invokeOffset,
    route.conditionOrIndex,route.preconditionOrIndex);
   fail(!routeLookup.has(key),'duplicate original source route');
   routeLookup.set(key,{...route,skillId:row.skillId,sourceNumericId:row.sourceNumericId});
   allRoutes++;
  }
 }
 fail(matched===queue.denominators.sourceMatchedSkills&&
  unmatched===queue.denominators.sourceUnavailableSkills&&
  allRoutes===queue.denominators.originalRouteFamilies,
  'source matched, unavailable or original route count drift');
 return {bySkill,routeLookup,matched,unmatched,allRoutes};
}
const comparable=(f)=>f.length>=2;
function decision(type,source,app,route){
 const styles=[...route.finiteCompatibleStyles];
 const other=[...route.unverifiedTypes].filter(t=>t!==type);
 if(type==='change_order_onetime'||type==='is_overtake')
  return {disposition:'hold-approximate-source-state-not-real-game-style-evidence',
   nextEvidence:'independent-observed-game-or-source-comparable-race-order-or-overtake-state-before-W-D',
   candidateForBoundedSameTickStudy:false};
 if(Object.hasOwn(STUDIED_SOURCE,source))
  return {disposition:STUDIED_SOURCE[source],
   nextEvidence:'retain-P2.38-P2.39-mechanism-reference-only-no-style-rate-transfer',
   candidateForBoundedSameTickStudy:false};
 if(app.decision==='hold-turf-model-transfer')
  return {disposition:'hold-original-ground-qualifier-no-model-transfer',
   nextEvidence:'verify-original-ground-eligibility-with-matching-ground-model-before-any-style-W-D',
   candidateForBoundedSameTickStudy:false};
 if(app.decision==='conditionally-use-short-window-rank-evidence'||
    app.decision==='conditionally-use-source-exception-branch-W-D')
  return {disposition:'hold-avoid-overwriting-existing-P2.41-partial-W-D',
   nextEvidence:'inspect-original-source-branch-and-model-context-before-new-dynamic-assessment',
   candidateForBoundedSameTickStudy:false};
 if(!comparable(styles))
  return {disposition:'hold-no-multi-style-finite-source-route',
   nextEvidence:'review-source-eligibility-and-possible-single-style-absolute-W-separately',
   candidateForBoundedSameTickStudy:false};
 if(route.preconditionOrCount>0||route.conditionOrCount>1||route.hasOtherInvokes)
  return {disposition:'hold-complex-precondition-OR-or-invoke-not-one-AND',
   nextEvidence:'keep-source-branch-identity-and-latch-history-before-dynamic-conjunction',
   candidateForBoundedSameTickStudy:false};
 if(other.length>2)
  return {disposition:'hold-multiple-unverified-AND-dependencies',
   nextEvidence:'source-exact-AND-mechanism-screen-before-any-new-model-experiment',
   candidateForBoundedSameTickStudy:false};
 return {disposition:'bounded-original-computed-spurt-AND-structure-candidate',
  nextEvidence:'check-original-predicates-and-same-source-tick-before-any-comparable-four-style-W-D',
  candidateForBoundedSameTickStudy:true};
}
function audit(ledger,queue,dynamic){
 const {bySkill,routeLookup,matched,unmatched,allRoutes}=cohort(ledger,queue,dynamic);
 const records=[],seen=new Set();
 for(const type of DYNAMIC){
  const sourceRows=dynamic.rows[type];
  const expected=dynamic.summary?.byOriginalPredicate?.[type];
  fail(Array.isArray(sourceRows)&&expected?.sourceSkills>=0&&
   expected?.originalRouteFamilies===sourceRows.length&&
   expected?.evaluationDecision===p237.TYPES[type].evaluationDecision,
   'P2.37 dynamic type source count or decision changed');
  const sourceIds=new Set();
  for(const item of sourceRows){
   const key=idKey(item.sourceNumericId,item.invokeOffset,
    item.conditionOrIndex,item.preconditionOrIndex);
   const original=routeLookup.get(key),app=bySkill.get(item.skillId);
   const unique=type+'|'+key;
   fail(original&&app&&!seen.has(unique)&&
    app.sourceNumericId===item.sourceNumericId&&
    original.skillId===item.skillId&&
    item.invokeIndex===original.invokeIndex&&
    item.hasOtherInvokes===original.hasOtherInvokes&&
    item.researchGroup===original.researchGroup&&
    same(item.finiteCompatibleStyles,original.finiteCompatibleStyles)&&
    same(item.otherUnverifiedTypes,
     original.unverifiedTypes.filter(x=>x!==type))&&
    original.unverifiedTypes.includes(type)&&
    item.mechanism===p237.TYPES[type].mechanism&&
    item.evaluationDecision===p237.TYPES[type].evaluationDecision&&
    item.probabilityOrScore===null&&
    item.wholeSkillSuitability==='not-established'&&
    Array.isArray(item.sourcePredicates)&&item.sourcePredicates.length>0&&
    item.sourcePredicates.every(p=>
     ['preConditions','conditions'].includes(p.side)&&
     Number.isSafeInteger(p.andOffset)&&p.andOffset>=0&&
     ['==','!=','<','<=','>','>='].includes(p.operator)&&
     Number.isSafeInteger(p.value)),
    'original source skill, route, AND predicate or P2.37 decision mismatch: '+unique);
   seen.add(unique);sourceIds.add(item.sourceNumericId);
   const ruling=decision(type,item.sourceNumericId,app,original);
   records.push({sourceNumericId:item.sourceNumericId,skillId:item.skillId,
    invokeOffset:item.invokeOffset,invokeIndex:item.invokeIndex,
    conditionOrIndex:item.conditionOrIndex,
    preconditionOrIndex:item.preconditionOrIndex,
    type,originalSourcePredicates:item.sourcePredicates.map(p=>({...p})),
    originalCurrentANDAdditionalUnknownTypes:
     [...item.otherUnverifiedTypes],
    originalRoute:{conditionOrCount:original.conditionOrCount,
     preconditionOrCount:original.preconditionOrCount,
     hasOtherInvokes:original.hasOtherInvokes},
    sourceCompatibleStyleNames:[...item.finiteCompatibleStyles],
    priorPartialSkillEvidence:app.decision,
    sourceMechanism:p237.TYPES[type].mechanism,
    ...ruling,
    missingConditionsStillUnknown:true,
    fullOriginalSourceANDObserved:false,
    measuredGameOrModelSkillRate:null,
    verifiedFourStyleDirection:null,
    eligibleForP3CardScoring:false,cardScore:null
   });
  }
  fail(sourceIds.size===expected.sourceSkills,
   'P2.37 dynamic distinct source skills changed: '+type);
 }
 const dispositions={},perType={};
 for(const type of DYNAMIC){
  const items=records.filter(x=>x.type===type);
  const groups={};
  for(const r of items){
   groups[r.disposition]=(groups[r.disposition]||0)+1;
   dispositions[r.disposition]=(dispositions[r.disposition]||0)+1;
  }
  perType[type]={sourceSkills:new Set(items.map(x=>x.sourceNumericId)).size,
   sourceRouteFamilies:items.length,byDisposition:groups};
 }
 // These type-specific counts overlap in original source routes and source skills.
 const next=records.filter(r=>r.candidateForBoundedSameTickStudy)
  .sort((a,b)=>a.originalCurrentANDAdditionalUnknownTypes.length-
   b.originalCurrentANDAdditionalUnknownTypes.length||
   b.sourceCompatibleStyleNames.length-a.sourceCompatibleStyleNames.length||
   directOrder(a,b));
 const chosen=[],usedSkills=new Set(),usedShapes=new Set();
 for(const pass of [0,1]){
  for(const r of next){
   if(chosen.length===3)break;
   const signature=r.originalCurrentANDAdditionalUnknownTypes.slice().sort().join('|');
   if(usedSkills.has(r.sourceNumericId)||
    pass===0&&usedShapes.has(signature))continue;
   chosen.push({...r,selection:'limited-one-original-source-AND-route-only'});
   usedSkills.add(r.sourceNumericId);usedShapes.add(signature);
  }
  if(chosen.length===3)break;
 }
 return {schemaVersion:1,status:STATUS,
  source:{registryRevision:p237.PIN,registrySHA256:SOURCE_SHA,
   p232Status:queue.status,p237Status:dynamic.status,p241Status:ledger.status},
  denominators:{appSkills:ledger.rows.length,sourceMatchedSkills:matched,
   sourceUnavailableSkills:unmatched,allOriginalRouteFamilies:allRoutes,
   dynamicPredicateRouteRows:records.length,
   distinctDynamicSourceRouteIdentities:new Set(records.map(r=>idKey(
    r.sourceNumericId,r.invokeOffset,r.conditionOrIndex,r.preconditionOrIndex))).size,
   distinctDynamicSourceSkills:new Set(records.map(r=>r.sourceNumericId)).size,
   sourceSkillsWithConditionalP241PartialWD:
    ledger.summary.uniqueSourceSkillsWithConditionalPartialWDEvidence,
   originalFullANDProvenHere:0,realGameProcMeasurements:0,
   promotedP3OrP4Ratings:0},
  perType,byDisposition:dispositions,
  selectedLimitedStudyRoutes:chosen,
  routeDecisions:records,
  decisionRules:{
   approximatedSimulatorStates:'do-not-use-simulator-frequency-as-real-game-style-W',
   sourceComputedSpurt:'limited-exact-source-AND-mechanism-candidate-only-not-whole-skill-rating',
   existingReference200512:'original-source-natural-spurt-window-AND-seen-under-fixed-solo-high-wisdom-settings-no-retest-promise',
   existingReference200511:'controlled-truth-table-only-no-natural-source-run-claim',
   candidateCountCap:3,
   noGenericOmissionOfUnknownAND:true,
   noMixingDistinctORInvokeRoutes:true,
   noGameOrProductScores:true
  },
  limitations:[
   'P2.37 source checker approximates change_order_onetime and is_overtake via random special states. Its frequency is not real-game evidence.',
   'P2.39 shows only original-model natural spurt AND in an extreme fixed solo high-wisdom experiment for skill 200512, not its game probability or card value.',
   'A finite compatible route may not fire. This audit does not observe any new same-tick AND, source equipped skill event, or representative race.',
   'Missing AND, separate precondition latch histories, other OR paths and Invoke alternatives stay unverified. Short-window partial W/D is not whole skill activation.',
   'Distinct source route, source skill, and predicate-type counts overlap; no independent sample or pooled rate is implied.',
   'A three-route pilot set is a structural research review queue, not proof it would change actual four-style judgments or a commitment to a new simulator.'
  ]};
}
if(require.main===module)try{
 fail(process.argv.length===6,
  'usage: p2_g4_dynamic_impact_gates.cjs p241.json p232.json p237.json output.json');
 const [a,b,c,d]=process.argv.slice(2);
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const x=audit(read(a),read(b),read(c));
 fs.writeFileSync(d,JSON.stringify(x,null,2)+'\n');
 console.log('P2_42_DYNAMIC_RESEARCH_GATES='+JSON.stringify({
  denominators:x.denominators,perType:x.perType,
  selected:x.selectedLimitedStudyRoutes.map(r=>({
   id:r.sourceNumericId,type:r.type,otherAND:r.originalCurrentANDAdditionalUnknownTypes,
   originalOR:r.conditionOrIndex,compatible:r.sourceCompatibleStyleNames.length}))
 }));
}catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={STATUS,DYNAMIC,SOURCE_SHA,STUDIED_SOURCE,idKey,cohort,decision,audit};
