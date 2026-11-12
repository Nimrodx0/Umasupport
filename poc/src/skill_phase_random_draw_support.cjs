'use strict';
/*
 * P2.15 original UmaSim phase_random source-window geometry over ALL
 * hypothetical uniform draw fractions, conditioned on measured GlobalSim
 * no-skill pre-priority positions. Not a sampled RNG, source skill activation,
 * W/D, game proc probability, or P3/P4 suitability claim.
 *
 * For a source phase [a,b], source code draws u in [0,1) and sets
 * start=min(a+u*(b-a), b-2), end=min(start+10,b).
 * A measured position x is in the CLOSED window iff start<=x<=end.
 * The last 2/(b-a) of draws all map to the same clipped interval.
 * An entire runner-race uses one hypothetical draw for one source key:
 * union the eligible u intervals across observed ticks, NEVER multiply
 * per-tick probabilities or count correlated ticks as independent trials.
 */
const original=require('./skill_phase_random_source_window_audit.cjs');
const position=require('../tools/globalsim_p2_15_preskill_phase_position.cjs');
const STATUS='P2.15-source-phase-random-uniform-draw-support-model-positions-not-proc';
const fail=(yes,why)=>{if(!yes)throw Error('P2.15 phase draw support: '+why);};
const RACE_ANCHORS=[
 'override val phase1Start by lazy { courseLength / 6.0 }',
 'override val phase2Start by lazy { (courseLength * 2.0) / 3.0 }',
 'override val phase3Start by lazy { (courseLength * 5.0) / 6.0 }',
 'override fun getPhaseStartEnd(phase: Int): Pair<Double, Double>',
 '0 -> 0.0 to phase1Start',
 '1 -> phase1Start to phase2Start',
 '2 -> phase2Start to phase3Start',
 '3 -> phase3Start to courseLength.toDouble()'
];
function verifyPinnedSources(checkerCode,raceStateCode){
 const checker=original.verifyPinnedChecker(checkerCode);
 fail(typeof raceStateCode==='string'&&raceStateCode.length>1000,
  'missing pinned original RaceState.kt');
 for(const anchor of RACE_ANCHORS)
  fail(raceStateCode.includes(anchor),'original phase boundary changed: '+anchor);
 fail(checkerCode.includes('class RandomEntry(start: Double, end: Double) : ClosedFloatingPointRange<Double> by start..end'),
  'original interval no longer closed');
 fail(checkerCode.includes('RandomPosition.RANDOM -> Random.nextDouble()'),
  'original uniform draw setting changed');
 return {umaSimRevision:original.SOURCE_REV,
  phaseBoundaryAnchorsVerified:RACE_ANCHORS.length,
  randomDrawFractionUniformInSource:true,
  clippedSourceStartMinusTwoMetresVerified:true,
  originalSourceIntervalClosed:true,
  actualDrawObserved:false,
  originalUmaSimRaceRuntimeObserved:false};
}
function unionLength(intervals){
 fail(Array.isArray(intervals),'draw intervals must be an array');
 let total=0,start=null,end=null;
 for(const pair of intervals.slice().sort((x,y)=>x[0]-y[0]||x[1]-y[1])){
  fail(Array.isArray(pair)&&pair.length===2&&
   Number.isFinite(pair[0])&&Number.isFinite(pair[1])&&
   pair[0]>=0&&pair[1]<=1&&pair[0]<=pair[1],
   'invalid bounded source draw interval');
  if(start===null){start=pair[0];end=pair[1];continue;}
  if(pair[0]<=end){end=Math.max(end,pair[1]);continue;}
  total+=end-start;start=pair[0];end=pair[1];
 }
 if(start!==null)total+=end-start;
 fail(total>=0&&total<=1+1e-10,'union draw fraction outside unit interval');
 return Math.min(total,1);
}
function measuredPositionSupport(distance,phaseId,positions){
 fail(Number.isSafeInteger(distance)&&distance>0&&
  original.PHASE_IDS.has(phaseId)&&Array.isArray(positions),
  'invalid pinned course length, phase or model positions');
 const [a,b]=position.phaseBounds(distance,phaseId);
 const width=b-a;
 // This narrow fixed model has phase widths >10m. Other unsupported
 // short phases need separate source arithmetic and must not be invented.
 fail(width>10,'original phase too short for audited ten-metre window');
 const normalUpper=(width-2)/width;
 const intervals=[];
 let phaseStagePositions=0,tailCovered=false;
 for(const x of positions){
  fail(Number.isFinite(x)&&x>=0&&x<=distance,
   'unverified out-of-course model priority position');
  if(x<a||x>b)continue;
  phaseStagePositions++;
  const low=Math.max(0,(x-10-a)/width);
  const high=Math.min(normalUpper,(x-a)/width);
  if(low<=high)intervals.push([low,high]);
  if(x>=b-2)tailCovered=true;
 }
 const ordinary=unionLength(intervals);
 const tail=tailCovered?2/width:0;
 const fraction=ordinary+tail;
 fail(fraction>=0&&fraction<=1+1e-10,
  'source drawn interval exceeds full draw domain');
 return {phaseId,
  observedPriorityPositionsInSourcePhase:phaseStagePositions,
  unclippedDrawFractionWithAnyObservedWindowHit:ordinary,
  clippedTailDrawFractionWithAnyObservedWindowHit:tail,
  drawFractionWithAnyObservedWindowHit:Math.min(fraction,1),
  originalRandomDrawActuallyObserved:false,
  gameSkillActivationProbability:null};
}
module.exports={STATUS,RACE_ANCHORS,verifyPinnedSources,
 unionLength,measuredPositionSupport};
