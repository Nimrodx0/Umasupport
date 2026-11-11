'use strict';
/*
 * P2.27 source-only feasibility gate.
 * Does NOT estimate any style's success rate or implement a new race model.
 * Counts exact rank-band + first/latter-half time conditions in app skills,
 * separately from extra AND, OR, preconditions and missing rank bands.
 */
const four=require('./skill_balanced_four_style_fit.cjs');
const timing=require('./skill_rank_timing.js');
const rough=require('./skill_coarse_style_review.cjs');
const HALF=new Set(['phase_firsthalf_random','phase_laterhalf_random']);
const TIMING=new Set(Object.keys(timing.TIME_SPECS));
const STYLE_NAMES=four.STYLES.map(s=>s.name);
function cohort(model){
 if(!model||!Array.isArray(model.skills))throw Error('App registry required');
 const preview=rough.report(model);
 const counts={
  sourceMatched:0,heldSkills:0,needsFourStyleStudy:0,
  halfTimeWithOrderRate:0,
  halfTimeAndExactBand:0,
  halfTimeExactBandDirect:0,
  halfTimeExactBandWithOtherAND:0,
  halfTimeExactBandWithAlternativePaths:0,
  halfTimeNonExactBand:0,
  halfTimeWithoutOrderRate:0,
  noHalfTimeWithRank:0
 };
 const sourceRowCounts={};
 const sourceWindowSkills={},directWindowSkills={};
 const examples=[];
 function add(k){counts[k]=(counts[k]||0)+1}
 for(const [i,skill] of model.skills.entries()){
  const profile=skill.activationProfile;
  if(profile?.status!=='source-structure')continue;
  counts.sourceMatched++;
  const statuses=STYLE_NAMES.map(n=>preview.rows[i].styles[n].status);
  const held=statuses.includes('held');
  const needsStudy=statuses.some(x=>[
   'held','two-group-reference','partial-four-style-direction'
  ].includes(x));
  if(held)counts.heldSkills++;
  if(needsStudy)counts.needsFourStyleStudy++;
  if(!needsStudy)continue;
  const groups=[],halfNoRank=[],nonExact=[],otherRank=[];
  for(const [invokeIndex,inv] of profile.invokes.entries()){
   for(const [orIndex,row] of (inv.conditions||[]).entries()){
    const time=row.filter(c=>TIMING.has(c.type));
    const ranks=row.filter(c=>c.type==='order_rate');
    const half=time.filter(c=>HALF.has(c.type));
    const exactBand=four.exactBand(ranks);
    const halfExact=half.length===1&&time.length===1&&
     half[0].operator==='=='&&Number.isSafeInteger(half[0].value)&&
     half[0].value>=0&&half[0].value<=3;
    const allowed=four.STYLES.filter(st=>four.branch(row,st.id,{
     preconditionRows:inv.preConditions||[]}).status!=='ineligible')
     .map(st=>st.name);
    if(!half.length){
     if(ranks.length)otherRank.push({invokeIndex,orIndex});
     continue;
    }
    if(!ranks.length){halfNoRank.push({invokeIndex,orIndex});continue}
    if(!exactBand||!halfExact){
     nonExact.push({invokeIndex,orIndex,
      reason:!exactBand?'original-rank-band-not-exactly-in-reference':
       'half-phase-not-one-supported-window',timeKinds:time.map(c=>c.type)});
     continue;
    }
    const path=four.branch(row,allowed.length?
      four.STYLES.find(x=>x.name===allowed[0]).id:1,
     {preconditionRows:inv.preConditions||[]});
    const noExtra=!(path.extraPredicates?.length);
    const single=profile.invokes.length===1&&inv.conditions.length===1&&
     (inv.preConditions||[]).length===0;
    groups.push({invokeIndex,orIndex,bandId:exactBand.id,
     phaseIndex:half[0].value,timeType:half[0].type,
     eligibleStyles:allowed,
     direct:single&&noExtra&&allowed.length>0,
     extraAndTypes:(path.extraPredicates||[]).map(x=>x.type),
     hasAlternativePaths:!single,
     sourcePredicateTypes:row.map(x=>x.type)});
   }
  }
  if(groups.length||halfNoRank.length||nonExact.length) {
   if(groups.length||nonExact.length)add('halfTimeWithOrderRate');
   if(halfNoRank.length)add('halfTimeWithoutOrderRate');
   if(!groups.length){
    if(nonExact.length)add('halfTimeNonExactBand');
   } else {
    add('halfTimeAndExactBand');
    if(groups.some(g=>g.direct))add('halfTimeExactBandDirect');
    if(groups.some(g=>g.extraAndTypes.length>0))add('halfTimeExactBandWithOtherAND');
    if(groups.some(g=>g.hasAlternativePaths))add('halfTimeExactBandWithAlternativePaths');
    for(const group of groups){
     sourceRowCounts[group.timeType]=(sourceRowCounts[group.timeType]||0)+1;
    }
    for(const key of new Set(groups.map(g=>g.timeType+':'+g.phaseIndex)))
     sourceWindowSkills[key]=(sourceWindowSkills[key]||0)+1;
    for(const key of new Set(groups.filter(g=>g.direct)
      .map(g=>g.timeType+':'+g.phaseIndex)))
     directWindowSkills[key]=(directWindowSkills[key]||0)+1;
   }
   if(examples.length<70)examples.push({skillId:skill.id,sourceNumericId:profile.sourceNumericId,
    name:skill.name,paths:groups,nonExact,halfNoRank});
  } else if(otherRank.length) {
   add('noHalfTimeWithRank');
  }
 }
 // Do not silently call candidates "unlocked": even the direct subset
 // requires actual subphase rank-direction evidence to be measured.
 return {schemaVersion:1,
  status:'P2-source-only-half-phase-rank-feasibility-not-style-rating',
  baseline:{appSkills:model.skills.length,
   sourceMatched:counts.sourceMatched,heldSkills:counts.heldSkills,
   needsFourStyleStudy:counts.needsFourStyleStudy},
  counts,halfTimingRowsByType:sourceRowCounts,
  sourceWindowSkills,directWindowSkills,
  examples,
  limitations:[
   'Counts are distinct source-matched SKILLS needing a four-style study: held, legacy-two-group-only or partial-four-style. Counts overlap; heldSkills separately matches prior 584.',
   'Potential direct candidates do NOT have measured half-phase rank style directions yet and are not newly evaluated.',
   'Source OR/precondition/extra AND paths retain their actual structure; counts do not infer simultaneous occurrence or proc probability.',
   'Exact matching against prior rank bands may be restrictive and excludes other known corner/absolute rank experiments.',
   'Only one first/latter-half random phase predicate is accepted here. Slope, straight, corner geometry or multi-timing conditions remain separate.'
  ]};
}
module.exports={HALF,cohort};
