'use strict';
/*
 * Validate observations actually produced by pinned UmaSim JVM SkillChecker.
 * No raw upstream source, original registry, user-data or full skill
 * activation is emitted. This is an OBSERVED original window and controlled
 * position evaluation, NOT a race simulation or ranked runner's source tick.
 */
const source=require('./skill_phase_random_draw_support.cjs');
const STATUS='P2.15-actual-pinned-source-phase-window-jvm-controlled-positions-not-race-proc';
const UPSTREAM='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const TRACE='p2-15-pinned-umasim-source-checker-actual-random-window-controlled-position-only';
const ID='99000215',COUNT=12;
function fail(ok,message){if(!ok)throw Error('P2.15 source JVM window trace: '+message)}
function validate(payload,checkerCode,raceStateCode){
 const verified=source.verifyPinnedSources(checkerCode,raceStateCode);
 fail(verified.umaSimRevision===UPSTREAM&&
  verified.randomDrawFractionUniformInSource===true&&
  verified.originalSourceIntervalClosed===true&&
  verified.actualDrawObserved===false,
  'pinned upstream source-code anchors changed');
 // The pinned source treats unsupported order_rate via mapNotNull, not as
 // an observed game-rank predicate. Require its branch to be absent.
 fail(!/["']order_rate["']\s*->/.test(checkerCode),
  'pinned source started implementing order_rate; restart evidence review');
 fail(payload?.schemaVersion===1&&payload?.status===TRACE&&
  payload?.sourceSkillId===ID&&payload?.phaseId===2&&
  payload?.trialCount===COUNT&&payload?.randomPositionMode==='RANDOM'&&
  payload?.sourceCompiledAndExecuted===true&&
  payload?.originalRaceCalculatorInvoked===false&&
  payload?.sourceOrderRateRuntimeChecked===false&&
  payload?.actualGameSkillProcObserved===false&&
  Array.isArray(payload.trials)&&payload.trials.length===COUNT,
  'trace provenance, trial count or research-only gate changed');
 const observed=new Set(),seenTrial=new Set();
 for(const t of payload.trials){
  fail(Number.isSafeInteger(t.trial)&&t.trial>=0&&t.trial<COUNT&&
   !seenTrial.has(t.trial),'duplicate or invalid trial');
  seenTrial.add(t.trial);
  fail(t.sourceSkillId===ID&&t.cacheKey==='phase_random2'&&
   t.phaseId===2&&t.actualOriginalWindowObserved===true&&
   t.cacheReusedForSameSkill===true&&
   t.raceSimulationUsed===false&&t.modelOrGameRankObserved===false&&
   JSON.stringify(t.controlledPositionTickIndices)==='[0,1,2,3]',
   'observation identity, original random cache or controlled frame gate changed');
  const a=t.phaseStart,b=t.phaseEnd,x=t.drawnWindowStart,y=t.drawnWindowEndInclusive;
  fail([a,b,x,y].every(Number.isFinite)&&b-a>10&&
   x>=a-1e-7&&x<=b-2+1e-7&&
   y>=x&&y<=b+1e-7&&
   Math.abs(y-Math.min(x+10,b))<1e-7,
   'actual drawn source window not equal to pinned source interval geometry');
  fail(t.outsideStart===false&&t.insideStart===true&&
   t.insideEnd===true&&t.outsideEnd===false,
   'source checker did not match its actual drawn closed interval');
  // Do NOT store sampled window values in a shared common score.
  observed.add([x,y].join(':'));
 }
 fail(seenTrial.size===COUNT,'missing observations');
 return {
  schemaVersion:1,status:STATUS,
  upstream:{repository:'mee1080/umasim',revision:UPSTREAM,
   phaseSourceCodeAnchored:true,randomWindowActualJVMSource:true,
   actualSourceRandomFractionRawObserved:false},
  syntheticControlledSkillId:ID,
  tests:{sourceJVMTrials:COUNT,actualSourceDrawnWindowObservations:COUNT,
   controlledSourceCheckerCalls:COUNT*4,
   sourceWindowCacheReuseValidations:COUNT,
   distinctObservedWindowCoordinates:observed.size},
  boundary:{
   upstreamActualSkillRecordEquipped:false,
   actualRaceCalculatorUsed:false,
   observedActualRaceRunnerTick:false,
   observedActualUmaSimOrderRate:false,
   sourceRandomDrawingFractionDirectlyMeasured:false,
   observedModelRankAndRandomSameTick:false,
   sourceWholeOriginalANDCompleted:false,
   originalGameSkillProcOrProbabilityMeasured:false,
   formalSkillOrCardSuitabilityRating:false
  },
  limitations:[
   'The pinned upstream JVM SkillChecker executed actual RandomPosition.RANDOM source draws and cached RandomEntry windows, not guessed ones.',
   'The synthetic isolated skill uses a reserved ID and controlled position steps, not a real skill record or RaceCalculator simulation.',
   'We observe window coordinates, NOT the pre-clipping raw uniform draw fraction.',
   'The upstream source does not implement order_rate, so the synthetic source checker cannot verify the real game rank+window AND.',
   'Each of 12 random source windows is a source unit-test observation, NOT independent skill proc outcomes or a W/D suitability probability.'
  ]
 };
}
module.exports={STATUS,TRACE,UPSTREAM,ID,COUNT,validate};
