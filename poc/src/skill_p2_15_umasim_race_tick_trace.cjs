'use strict';
/*
 * Independent audit of pinned Kotlin source *RaceCalculator* trace.
 * These are real model skill-check ticks, not Japanese game proc rates,
 * not original registry records and not valid order_rate observations.
 */
const STATUS='P2.15-original-source-race-actual-phase-window-same-skill-tick-not-game-rank';
const RAW='p2-15-pinned-source-race-calculator-phase-random-same-skill-tick';
const ID='99000216',COUNT=3;
const fail=(ok,m)=>{if(!ok)throw Error('P2.15 source race-tick trace: '+m)};
function validate(data){
 fail(data?.schemaVersion===1&&data?.status===RAW&&
  data?.sourceModel==='pinned-mee1080-umasim'&&
  data?.syntheticSourceSkillId===ID&&data?.trialCount===COUNT&&
  data?.instrumentation==='one-original-checkInRandom-return-with-identity-boolean'&&
  data?.actualUmaSimRaceCalculatorExecuted===true&&
  data?.sourceRankImplemented===false&&
  data?.realSourceSkillRecordsUsed===false&&
  data?.gameProcOrSuitabilityCalculated===false&&
  Array.isArray(data.races)&&data.races.length===COUNT,
  'source provenance and unscored runtime gate');
 let observedTicks=0,hits=0,misses=0;
 const trials=new Set(),intervals=new Set();
 const summaries=[];
 for(const race of data.races){
  fail(Number.isSafeInteger(race.trial)&&race.trial>=0&&
   race.trial<COUNT&&!trials.has(race.trial),
   'duplicate or missing synthetic race identity');
  trials.add(race.trial);
  const a=race.phaseStart,b=race.phaseEnd,s=race.windowStart,e=race.windowEnd;
  fail([a,b,s,e].every(Number.isFinite)&&b-a>10&&
   s>=a&&s<=b-2+1e-7&&e>=s&&e<=b+1e-7&&
   Math.abs(e-Math.min(s+10,b))<1e-7,
   'random interval is outside exact original phase geometry');
  fail(race.syntheticSourceSkillId===ID&&
   race.randomPositionMode==='RANDOM'&&race.phaseId===2&&
   race.raceCalculatorExecuted===true&&
   race.sameOriginalWindowEveryTick===true&&
   race.framePositionJoined===true&&
   race.realRegisteredSkillEquipped===false&&
   race.sourceOrderRateEvaluated===false&&
   race.gameProcRateComputed===false&&
   Number.isSafeInteger(race.raceFrameCount)&&race.raceFrameCount>1&&
   Array.isArray(race.ticks)&&race.ticks.length>0&&
   race.ticks.length<=race.raceFrameCount,
   'synthetic source race identity or same-tick provenance changed');
  let tick=-1,yes=0,no=0;
  for(const row of race.ticks){
   fail(Number.isSafeInteger(row.tick)&&row.tick>tick&&
    row.tick>=1&&row.tick<race.raceFrameCount&&
    [row.position,row.start,row.end].every(Number.isFinite)&&
    row.start===s&&row.end===e&&typeof row.hit==='boolean',
    'source frame order, position or per-race original draw changed');
   tick=row.tick;
   fail(row.hit===(row.position>=s&&row.position<=e),
    'source phase window membership not consistent with same frame');
   row.hit?yes++:no++;
  }
  fail(race.sourceCheckerCalls===race.ticks.length&&
   race.sourceCheckerTrueCount===yes&&race.sourceCheckerFalseCount===no&&
   yes>=1&&no>=1,
   'source checker hits/misses count or meaningful race sample missing');
  observedTicks+=race.ticks.length;hits+=yes;misses+=no;
  intervals.add(s+':'+e);
  summaries.push({
   raceTrial:race.trial,
   sourceRaceFrames:race.raceFrameCount,
   originalSourceCheckerTickCalls:race.ticks.length,
   phaseWindowTrueCalls:yes,phaseWindowFalseCalls:no,
   actualOriginalRandomInterval:true,
   sourceRaceFramePositionMatched:true,
   sameSourceSkillWindowReused:true,
   sourceModelEventAlignedToPredicate:true
  });
 }
 fail(trials.size===COUNT,'missing race');
 return {
  schemaVersion:1,status:STATUS,
  provenance:{sourceRepository:'mee1080/umasim',
   sourceRevision:'f6e4501ee6c6c2d4ac8698e7796e309d31575bde',
   onlyPinnedSourceCheckoutModifiedForObservation:true,
   originalPredicateBooleanReturnedUnchanged:true,
   noUpstreamCodeRedistributed:true},
  denominators:{
   actualSourceRaceCalculatorRaces:COUNT,
   sourceSyntheticEquippedSkillId:ID,
   actualRandomWindowsLinkedToSourceRace:COUNT,
   sameSourceRunnerAndSkillCheckTickObservations:observedTicks,
   sourceWindowPredicateTrueTickObservations:hits,
   sourceWindowPredicateFalseTickObservations:misses,
   differentRandomWindowCoordinates:intervals.size,
   actualRegisteredSourceSkillTrials:0,
   implementedOriginalOrderRateRuntimeObservations:0,
   actualGameActivationProbabilityMeasurements:0,
   formallyEvaluatedSuitabilities:0
  },
  races:summaries,
  boundaries:[
   'Original RaceCalculator executed with a synthetic skill in pinned source and injected instrumentation only in the ephemeral CI checkout.',
   'The source checkInRandom predicate returned its original boolean, while the original RaceFrame and skill event were matched at the same source tick by a Kotlin assertion.',
   'No real source registry skill was equipped. This is not validation of any of the 85 original rank+phase_random AND combinations.',
   'Source order_rate is not implemented, so the real source engine did NOT measure the original rank gate.',
   'The source random fraction itself is not logged; the actual drawn window coordinates are logged.',
   'No real game proc probability, style/distance/surface opportunity W, or P3/P4 official suitability was measured.'
  ]
 };
}
module.exports={STATUS,RAW,ID,COUNT,validate};
