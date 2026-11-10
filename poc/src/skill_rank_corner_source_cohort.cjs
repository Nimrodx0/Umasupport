'use strict';
/* P2 source-only feasibility inventory for absolute rank and corner-rank
 * predicates. Not a race simulation, nor any skill/card suitability estimate. */
const {compare}=require('./skill_order_rate_bounds.cjs');
const rankTiming=require('./skill_rank_timing.js');
const T=['phase_random','phase_firsthalf_random','phase_laterhalf_random',
 'phase_firstquarter_random','phase_straight_random',
 'phase_first_half_straight_random','phase_latter_half_straight_random',
 'phase_corner_random'];
const EXPLICIT=new Set(['running_style','distance_type','ground_type',
 'ground_condition','rotation','track_id','is_basis_distance','course_distance']);
function reasonedPath(row){
 const rank=row.filter(x=>['order','order_rate'].includes(x.type));
 const corners=row.filter(x=>x.type==='corner_random');
 const order=rank.filter(x=>x.type==='order');
 const pct=rank.filter(x=>x.type==='order_rate');
 const exactOther=row.filter(x=>!['order','order_rate','corner_random'].includes(x.type));
 const timing=exactOther.filter(x=>T.includes(x.type)||
  ['phase','phase_firstquarter','phase_firsthalf','phase_laterhalf',
    'distance_rate','remain_distance','is_finalcorner','is_last_straight',
    'is_lastspurt'].includes(x.type));
 const extra=exactOther.filter(x=>!timing.includes(x)&&!EXPLICIT.has(x.type));
 const explicit=exactOther.filter(x=>EXPLICIT.has(x.type));
 const candidate=order.length>0?'absolute-order':
  (corners.length&&pct.length?'corner-with-rank-rate':null);
 if(!candidate)return null;
 const strictOrder=order.every(x=>['==','!=','<','<=','>','>='].includes(x.operator)&&
  Number.isSafeInteger(x.value));
 const strictCorner=corners.length===1&&corners[0].operator==='=='&&
  [1,2,3,4].includes(corners[0].value);
 const windows=timing.filter(x=>T.includes(x.type)&&
  (rankTiming.timing(x)?.status==='source-defined')&&
  !rankTiming.timing(x)?.courseDependent);
 const allRandom=timing.filter(x=>T.includes(x.type));
 const onlySupportedOrder=order.length>0&&strictOrder&&!corners.length&&
  windows.length===1&&allRandom.length===1&&
  timing.length===windows.length;
 const directlySupportedCorner=!order.length&&corners.length===1&&
  pct.length>0&&strictCorner&&timing.length===0;
 const feasibility=directlySupportedCorner?'source-corner-rank-subcondition-candidate':
  onlySupportedOrder?'source-absolute-rank-phase-random-subcondition-candidate':
   'held-source-window-or-compound';
 return {candidate,feasibility,
  rankPredicateTypes:[...new Set(rank.map(x=>x.type))].sort(),
  rankPredicates:rank.map(x=>({type:x.type,operator:x.operator,value:x.value})),
  sourceCornerIndex:corners.map(x=>({operator:x.operator,value:x.value})),
  timeTypes:[...new Set(timing.map(x=>x.type))].sort(),
  timingPredicates:timing.map(x=>({type:x.type,operator:x.operator,value:x.value})),
  explicitTypes:[...new Set(explicit.map(x=>x.type))].sort(),
  otherAndTypes:[...new Set(extra.map(x=>x.type))].sort(),
  fullyModeledSkill:false,
  missingOriginalConditionsAreNotNeutral:true};
}
function inspect(records){
 if(!Array.isArray(records))throw Error('Matched source skill records required');
 const paths=[],seen=new Set();
 for(const s of records){
  if(!s||!/^\d+$/.test(String(s.id))||typeof s.name!=='string'||
     !Array.isArray(s.invokes)||seen.has(String(s.id)))
   throw Error('Invalid or duplicate source record');
  seen.add(String(s.id));
  for(const [invokeOffset,inv] of s.invokes.entries()){
   for(const side of ['preConditions','conditions']){
    for(const [orIndex,row] of (inv[side]||[]).entries()){
     const found=reasonedPath(row);
     if(!found)continue;
     paths.push({sourceNumericId:String(s.id),skillName:s.name,
      invokeOffset,invokeIndex:inv.index??invokeOffset,side,orIndex,
      siblingORCount:(inv[side]||[]).length,
      preconditionsGroups:(inv.preConditions||[]).length,
      invokeCount:s.invokes.length,...found});
    }
   }
  }
 }
 const distinct=xs=>new Set(xs.map(x=>x.sourceNumericId)).size;
 const cases={absoluteOrder:paths.filter(x=>x.candidate==='absolute-order'),
  cornerRank:paths.filter(x=>x.candidate==='corner-with-rank-rate')};
 const byFeasibility=Object.fromEntries([...new Set(paths.map(x=>x.feasibility))]
  .sort().map(t=>[t,{sourcePaths:paths.filter(x=>x.feasibility===t).length,
   distinctSkills:distinct(paths.filter(x=>x.feasibility===t))}]));
 const allExtras=Object.fromEntries([...new Set(paths.flatMap(x=>x.otherAndTypes))]
  .sort().map(t=>[t,distinct(paths.filter(x=>x.otherAndTypes.includes(t)))]));
 return {schemaVersion:1,
  status:'P2-absolute-order-and-corner-rank-source-path-feasibility-not-proc-rate',
  sourceRecords:records.length,
  summary:{absoluteOrder:{paths:cases.absoluteOrder.length,
    distinctSkills:distinct(cases.absoluteOrder)},
   cornerRank:{paths:cases.cornerRank.length,
    distinctSkills:distinct(cases.cornerRank)},
   byFeasibility,unmodeledOtherAndTypes:allExtras,
   noFullSkillRatings:true},
  paths,
  limitations:[
   'Corner index must follow the original source last-four-corners / front-null-padding convention.',
   'Absolute order uses literal 1-indexed rank; order_rate requires a separately verified integer threshold.',
   'Random timing and deterministic phase/status conditions are not interchangeable.',
   'Matching a rank subcondition cannot bypass other AND, OR, preConditions or multiple Invokes.',
   'No simulated outcome, user-facing suitability, or skill effect usefulness is computed.'
  ]};
}
module.exports={T,EXPLICIT,reasonedPath,inspect};
