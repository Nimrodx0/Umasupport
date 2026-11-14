'use strict';
/*
 * The pinned original UmaSim registry was loaded by the original JVM model.
 * This trace is a real registered-SkillData model exercise but does NOT
 * implement order_rate; it cannot prove the actual full source AND or game.
 */
const STATUS='P2.15-original-registered-source-skill-actual-race-phase-only';
const TRACE='p2-15-pinned-original-registered-skill-race-tick-phase-only';
const fail=(v,msg)=>{if(!v)throw Error('P2.15 registered-source trace: '+msg)};
function audit(v){
 fail(v?.schemaVersion===1&&v.status===TRACE&&
  /^[0-9]+$/.test(v.sourceSkillId)&&
  v.sourceSkillId!=='99000215'&&v.sourceSkillId!=='99000216'&&
  Number.isSafeInteger(v.sourceOriginalInvokeIndex)&&
  Number.isSafeInteger(v.sourceOriginalORIndex)&&v.sourceOriginalORIndex>=0&&
  Number.isSafeInteger(v.sourceOriginalInvokeCount)&&v.sourceOriginalInvokeCount>0&&
  Number.isSafeInteger(v.sourceOriginalConditionsORCount)&&v.sourceOriginalConditionsORCount>0&&
  Number.isSafeInteger(v.sourceOriginalSelectedANDSize)&&v.sourceOriginalSelectedANDSize>=2&&
  Number.isSafeInteger(v.sourceOriginalPreconditionORCount)&&v.sourceOriginalPreconditionORCount>=0&&
  v.sourceOriginalORIndex<v.sourceOriginalConditionsORCount&&
  v.sourceOriginalCurrentANDHasOrderRate===true&&
  v.sourceOriginalCurrentANDHasPhaseRandom2===true&&
  v.originalSkillRecordEquippedUnmodified===true&&
  v.originalInvokeConditionsUsedUnmodified===true&&
  typeof v.originalSourceConditionLogicSha256==='string'&&
  /^[a-f0-9]{64}$/.test(v.originalSourceConditionLogicSha256)&&
  v.originalOrderRateWasIgnoredBySource===true&&
  v.realGameSkillProcObserved===false&&
  Array.isArray(v.trials)&&v.trials.length===3,
  'original registry provenance, invoke structure or ignored-rank boundary');
 let evaluated=0,inside=0,outside=0,models=0;
 const summaries=[];
 for(let j=0;j<3;j++){
  const t=v.trials[j];
  fail(t?.trial===j&&Number.isSafeInteger(t.raceFrameCount)&&t.raceFrameCount>1&&
   Number.isSafeInteger(t.sourceDistanceType)&&t.sourceDistanceType>=1&&t.sourceDistanceType<=4&&
   Number.isSafeInteger(t.originalCheckerCalls)&&t.originalCheckerCalls>=0&&
   Number.isSafeInteger(t.phasePredicateTrueCalls)&&t.phasePredicateTrueCalls>=0&&
   Number.isSafeInteger(t.phasePredicateFalseCalls)&&t.phasePredicateFalseCalls>=0&&
   Number.isSafeInteger(t.modelSkillEvents)&&t.modelSkillEvents>=0&&
   typeof t.originalPhaseRandomWindowWasChecked==='boolean'&&
   Array.isArray(t.ticks)&&t.ticks.length===t.originalCheckerCalls,
   'per-race original model check or frame evidence missing');
  let prev=0,hits=0;
  for(const row of t.ticks){
   fail(Number.isSafeInteger(row.tick)&&row.tick>prev&&
    row.tick<t.raceFrameCount&&
    [row.position,row.start,row.end].every(Number.isFinite)&&
    row.start<=row.end&&row.end-row.start<=10+1e-7&&
    typeof row.phasePredicateHit==='boolean',
    'original checker tick order, random interval or boolean malformed');
   prev=row.tick;
   fail(row.phasePredicateHit===(row.position>=row.start&&row.position<=row.end),
    'source model checker window predicate disagrees with original interval');
   if(row.phasePredicateHit)hits++;
  }
  if(t.ticks.length){
   const s=t.ticks[0].start,e=t.ticks[0].end;
   fail(t.ticks.every(x=>x.start===s&&x.end===e),
    'one original registered source skill reused different interval in a race');
  }
  fail(hits===t.phasePredicateTrueCalls&&
   t.ticks.length-hits===t.phasePredicateFalseCalls&&
   t.originalPhaseRandomWindowWasChecked===(t.ticks.length>0),
   'window coverage or hit counts inconsistent');
  evaluated+=t.ticks.length;inside+=hits;
  outside+=t.ticks.length-hits;models+=t.modelSkillEvents;
  summaries.push({trial:j,originalCheckerCalls:t.originalCheckerCalls,
   sourceModelSkillEvents:t.modelSkillEvents,
   phasePredicateTrueCalls:t.phasePredicateTrueCalls,
   phasePredicateFalseCalls:t.phasePredicateFalseCalls});
 }
 fail(evaluated>0&&evaluated===v.actualSourceCheckerTickCount&&
  inside===v.phasePredicateTrueCalls&&
  outside===v.phasePredicateFalseCalls&&
  models===v.sourceModelSkillEventCount,
  'original model registered skill observation totals inconsistent');
 return {
  schemaVersion:1,status:STATUS,
  pinnedUmaSimRevision:'f6e4501ee6c6c2d4ac8698e7796e309d31575bde',
  sourceRegistryBlobSha:'0c6ea6d72b037b24ee40860f73b0e86db47aab1d',
  observedRegisteredSkillId:v.sourceSkillId,
  preservedStructure:{
   originalInvokeCount:v.sourceOriginalInvokeCount,
   originalInvokeIndex:v.sourceOriginalInvokeIndex,
   originalCurrentConditionORCount:v.sourceOriginalConditionsORCount,
   originalSelectedORIndex:v.sourceOriginalORIndex,
   originalSelectedANDPredicateCount:v.sourceOriginalSelectedANDSize,
   originalPreconditionORCount:v.sourceOriginalPreconditionORCount,
   exactOriginalSourceSkillAndConditionsPreserved:true,
   originalSourceConditionLogicSha256:v.originalSourceConditionLogicSha256
  },
  counts:{
   originalRegisteredSkillEquippedInThreeSourceRaces:3,
   sourceOriginalPhaseRandomCheckerTicks:evaluated,
   originalSourcePhasePredicateTrueCalls:inside,
   originalSourcePhasePredicateFalseCalls:outside,
   sourceModelSkillEvents:models,
   originalOrderRatePredicateEvaluatedInSource:0,
   fullOriginalRankAndWindowANDProven:0,
   actualGameSkillProcProbabilities:0,
   officialP3P4Ratings:0
  },
  races:summaries,
  limits:[
   'This is a skill actually loaded from the exact pinned original UmaSim registry, not a synthetic SkillData.',
   'Its original Invoke and OR/AND/preConditions were not changed, but upstream SkillChecker deliberately ignores order_rate.',
   'Source phase_random observation and source model skill events are NOT evidence that the ignored rank predicate held.',
   'This single representative source model race study is not 85 skills individual validation.',
   'Original source model skill events are not the real Japanese game skill proc probability or user-facing suitability.'
  ]
 };
}
module.exports={STATUS,TRACE,audit};
