'use strict';
/*
 * Source-checked P2.15 model ordinal rank bridge.
 *
 * Reads the actual GlobalSim v77 rank cache at priority=1 and priority=0
 * from an INDEPENDENT, read-only rank-probe engine, and independently
 * verifies original/position-probe/rank-probe physics and exact stage order.
 *
 * Only order_rate for 9/12 horses is interpreted using the published
 * round-half-up boundary mapping in skill_order_rate_bounds.cjs.
 * Original UmaSim SkillChecker IGNORING order_rate is not papered over.
 */
const original=require('./globalsim_p2_15_source_distance_rate_ticks.cjs');
const stage=require('./globalsim_change_order_skill_tick.cjs');
const legacy=require('./globalsim_change_order_internal_probe.cjs');
const pre=require('./globalsim_p2_15_preskill_phase_position.cjs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
const MODEL_PIN='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const STATUS='P2.15-independent-GlobalSim-priority-rank-evidence-not-game';
const fail=(ok,why)=>{if(!ok)throw Error('P2.15 exact pre-skill rank: '+why)};
function observedOrderRateFacts(compiled,rank,fieldSize){
 if(rank===null)return [];
 fail(bounds.FIELDS.includes(fieldSize)&&Number.isSafeInteger(rank)&&
  rank>=1&&rank<=fieldSize,'rank outside sourced 9/12 field size');
 const out=[];
 for(const ref of compiled.lookup.values()){
  if(ref.type!=='order_rate')continue;
  // Hold conditions whose percentage/zero-boundary is not part of the
  // previously documented 9/12-runner mapping. No implicit rank clamp.
  if(!Number.isSafeInteger(ref.value)||ref.value<0||ref.value>100)continue;
  const boundary=bounds.cutoff(fieldSize,ref.value);
  if(boundary===0)continue;
  out.push({...ref,satisfied:bounds.compare(rank,ref.operator,boundary)});
 }
 return out;
}
function buildEvidence(plans,originalReplies,positionReplies,rankReplies){
 fail(Array.isArray(plans)&&plans.length>0&&
  plans.length===originalReplies?.length&&
  plans.length===positionReplies?.length&&
  plans.length===rankReplies?.length,'same fixed model race panel required');
 const reports=[],totals={races:plans.length,modelFrames:0,
  positionalProbePhysicalValuesMatched:0,rankProbePhysicalValuesMatched:0,
  modelPriorityPositionPairsMatched:0,rankPriorityPairsMatched:0,
  rankFollowingPreviousPostCacheMatched:0,firstUnobservedFrameHeld:0,
  firstPriorityPreviousRankZero:0,activePreSkillRunnerTicks:0,
  finishedOrMissingTicksHeld:0};
 for(let r=0;r<plans.length;r++){
  const p=plans[r],a=originalReplies[r],pos=positionReplies[r],rank=rankReplies[r];
  fail(bounds.FIELDS.includes(p.fieldSize),'only previously verified 9/12-runner ranks');
  totals.positionalProbePhysicalValuesMatched+=original.validatePaired(p,a,pos);
  totals.rankProbePhysicalValuesMatched+=original.validatePaired(p,a,rank);
  const matrix=[],previousRanks=Array(p.fieldSize).fill(null);
  for(let tick=0;tick<a.frames.length;tick++){
   const frame=[];
   for(let i=0;i<p.fieldSize;i++){
    if(tick===0){
     frame.push(null);totals.firstUnobservedFrameHeld++;continue;
    }
    const p1=legacy.get(pos.frames[tick].horses[i],4);
    const p0=legacy.get(pos.frames[tick].horses[i],5);
    const encoded=legacy.get(rank.frames[tick].horses[i],5);
    const signed=legacy.get(rank.frames[tick].horses[i],4);
    if(p1===pre.SENTINEL&&p0===pre.SENTINEL){
     fail(encoded===-999&&signed===-999,
      'rank priority stage exists while position priority stage is absent');
     totals.finishedOrMissingTicksHeld++;frame.push(null);
     previousRanks[i]=null;continue;
    }
    fail(p1!==pre.SENTINEL&&Number.isFinite(p1)&&p1===p0,
     'priority=1/0 source-position stages differ');
    fail(p1===legacy.get(a.frames[tick-1].horses[i],0),
     'source position is not the preceding post-step model position');
    fail(encoded!==-999&&signed!==-999,
     'position priority stage exists but rank priority stage is absent');
    const unpack=stage.unpack(encoded,p.fieldSize);
    fail(unpack.priority1.current===unpack.priority0.current&&
     unpack.priority1.previous===unpack.priority0.previous&&
     signed===unpack.priority1.current-unpack.priority1.previous,
     'rank stage is not identical across both original priority calls');
    if(previousRanks[i]!==null){
     fail(previousRanks[i].current===unpack.priority1.current&&
      previousRanks[i].previous===unpack.priority1.previous,
      'rank cache changed between previous post-update and this priority stage');
     totals.rankFollowingPreviousPostCacheMatched++;
    }
    if(unpack.priority1.previous===0){
     fail(tick===1,'previous rank zero unexpectedly after initialized model rank');
     totals.firstPriorityPreviousRankZero++;
    }
    previousRanks[i]=unpack.afterUpdate;
    totals.modelPriorityPositionPairsMatched++;
    totals.rankPriorityPairsMatched++;
    totals.activePreSkillRunnerTicks++;
    frame.push(unpack.priority1.current);
   }
   matrix.push(frame);
  }
  totals.modelFrames+=a.frames.length;
  reports.push(matrix);
 }
 fail(totals.activePreSkillRunnerTicks>0&&
  totals.rankPriorityPairsMatched===totals.modelPriorityPositionPairsMatched&&
  totals.rankPriorityPairsMatched>totals.firstPriorityPreviousRankZero&&
  totals.rankFollowingPreviousPostCacheMatched>0&&
  totals.positionalProbePhysicalValuesMatched===
  totals.rankProbePhysicalValuesMatched,
  'independent three-engine priority-stage parity not established');
 return {schemaVersion:1,status:STATUS,
  source:{globalSimRevision:MODEL_PIN,
   rankSampler:stage.PIN,positionSampler:pre.PIN,
   mapping:bounds.VERSION,
   sourceInterpretation:bounds.SOURCE.status,
   sourceCorrectnessScope:'secondary documentation and original-model ranking, not game verification'},
  rankByRace:reports,
  totals,
  gates:{modelSourcePriorityRankDirectlyObserved:true,
   independentThreeEnginePhysicsCompared:true,
   originalUmaSimOrderRateRuntimeMeasured:false,
   sourceRankPercentGameSemanticsIndependentlyVerified:false,
   gameSkillProcRates:false,P3CardSuitabilityApproved:false}
 };
}
function validateEvidence(e,plans){
 fail(e?.status===STATUS&&e.schemaVersion===1&&
  e.source?.globalSimRevision===MODEL_PIN&&
  e.source?.mapping===bounds.VERSION&&
  e.gates?.modelSourcePriorityRankDirectlyObserved===true&&
  e.gates?.independentThreeEnginePhysicsCompared===true&&
  e.gates?.originalUmaSimOrderRateRuntimeMeasured===false&&
  Array.isArray(e.rankByRace)&&e.rankByRace.length===plans.length,
  'missing direct fixed GlobalSim source-rank evidence');
 for(const [i,rows] of e.rankByRace.entries()){
  fail(Array.isArray(rows)&&rows.length>=2,'empty rank-source model race');
  for(const row of rows)
   fail(Array.isArray(row)&&row.length===plans[i].fieldSize&&
    row.every(x=>x===null||Number.isSafeInteger(x)&&
     x>=1&&x<=plans[i].fieldSize),'out-of-range or forged fixed rank');
 }
 return true;
}
module.exports={MODEL_PIN,STATUS,observedOrderRateFacts,buildEvidence,validateEvidence};
