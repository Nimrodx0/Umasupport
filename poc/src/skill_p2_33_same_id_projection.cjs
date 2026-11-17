'use strict';
/*
 * P2.33: source-exact ORIGINAL SKILL identity + full CURRENT-AND static
 * gates, joined to a fixed GlobalSim PARTIAL rank/window W proxy.
 *
 * Never call this a measured original skill activation, full source engine
 * success or a probability. The model does NOT evaluate the actual original
 * source JVM rank and drawn window at matching ticks. Different fixed
 * source IDs provide the surrogate W: all outputs preserve that limitation.
 */
const cross=require('./skill_p2_33_surface_crosswalk.cjs');
const original=require('./skill_source_whole_tick_monitor.cjs');
const fixed=require('../tools/globalsim_roster32.cjs');
const proxy=require('../tools/skill_p2_33_surface_w.cjs');
const STATUS='P2.33-same-original-skill-ID-static-full-current-AND-model-rank-window-projection-not-proc';
const STATIC=new Set(['running_style','distance_type','ground_type','ground_condition']);
const TYPES=new Set(['order_rate','phase_random',
 'phase_firsthalf_random','phase_laterhalf_random']);
const STYLES=['Nige','Senkou','Sasi','Oikomi'];
const assert=(x,message)=>{if(!x)throw Error('P2.33 original ID projection: '+message)};
const uniq=arr=>[...new Set(arr)].sort();
function maskForBoth(conditions,styleId,distanceType){
 let mask=0;
 for(let groundCondition=1;groundCondition<=4;groundCondition++){
  const test=(surface)=>conditions.every(p=>
   !STATIC.has(p.type)||original.staticValue({
    running_style:styleId,distance_type:distanceType,
    ground_type:surface,ground_condition:groundCondition},p)===original.TRUE);
  if(test(1)&&test(2))mask|=1<<(groundCondition-1);
 }
 return mask;
}
function selectMinimalOriginalSkills(app,manifest){
 const pairs=cross.pairedMechanisms(manifest).paired;
 const byMechanism=new Map(pairs.map(x=>[x.mechanismKey,x]));
 assert(app&&Array.isArray(app.skills)&&app.skillById,
  'source-matched current app model required');
 const seen=new Set(),rows=[],held=[];
 for(const skill of app.skills){
  const profile=skill?.activationProfile;
  if(profile?.status!=='source-structure')continue;
  const id=profile.sourceNumericId;
  assert(typeof id==='string'&&/^\d+$/.test(id)&&!seen.has(id),
   'duplicate/missing original ID');
  seen.add(id);
  assert(Array.isArray(profile.invokes)&&profile.invokes.length,
   'original source missing Invoke');
  // A multi-Invoke/OR/historical skill cannot borrow this 2-predicate
  // proxy as its whole original condition.
  if(profile.invokes.length!==1){continue}
  const invoke=profile.invokes[0];
  if(invoke.conditions.length!==1||invoke.preConditions.length!==0)
   continue;
  const terms=invoke.conditions[0];
  const signature=cross.routeSignature(terms);
  if(!signature)continue;
  const mechanism=signature.timing+'|'+signature.bandId;
  const witness=byMechanism.get(mechanism);
  if(!witness)continue;
  if(terms.some(p=>!TYPES.has(p.type)&&!STATIC.has(p.type))||
   !terms.some(p=>p.type==='order_rate')||
   !terms.some(p=>TYPES.has(p.type)&&p.type!=='order_rate')){
   held.push({originalSourceSkillId:id,mechanism,
    reason:'extra-current-dynamic-AND-or-unsupported-original-predicate'});
   continue;
  }
  const contexts=[];
  for(let style=1;style<=4;style++)for(let distanceType=1;
   distanceType<=4;distanceType++){
   const commonGroundConditionMask=maskForBoth(terms,style,distanceType);
   if(commonGroundConditionMask)contexts.push({
    styleId:style,style:STYLES[style-1],distanceType,
    commonGroundConditionMask});
  }
  if(!contexts.length){
   held.push({originalSourceSkillId:id,mechanism,
    reason:'no-same-ground-condition-and-style-distance-context-for-both-surfaces'});
   continue;
  }
  rows.push({
   originalSourceSkillId:id,appSkillId:skill.id,
   originalInvokeIndex:invoke.index,
   originalSourceInvokeCount:profile.invokes.length,
   originalSourceCurrentORCount:invoke.conditions.length,
   originalSourceHistoricalORCount:invoke.preConditions.length,
   originalSourceFullCurrentANDPredicateCount:terms.length,
   originalRankTimingMechanism:mechanism,
   fixedTurfMechanismWitnessId:witness.turfSourceNumericId,
   fixedDirtMechanismWitnessId:witness.dirtSourceNumericId,
   sourceWitnessIDsDifferentFromEachOther:true,
   originalSkillIdentitySameInBothSurfaceContexts:true,
   commonStaticContexts:contexts,
   otherDynamicOriginalCurrentANDPredicates:[],
   originalSkillJVMRuntimeNotMeasured:true
  });
 }
 assert(JSON.stringify([...seen].sort())!==''&&
  new Set(rows.map(r=>r.originalSourceSkillId)).size===rows.length,
  'selection identity lost');
 return {status:'same-original-skill-IDs-for-source-static-axis-contrast-only',
  sourceMatchedOriginalSkills:seen.size,
  rowCount:rows.length,heldCount:held.length,
  rows:rows.sort((a,b)=>a.originalSourceSkillId.localeCompare(
   b.originalSourceSkillId,undefined,{numeric:true})),held};
}
function audit(app,manifest,modelW){
 const cohort=selectMinimalOriginalSkills(app,manifest);
 assert(cohort.sourceMatchedOriginalSkills===818,
  'original 818-skill registry/app cohort drift');
 assert(cohort.rowCount===82,
  'previous independent 82 minimal original skill candidates differ');
 assert(modelW?.status===proxy.STATUS&&
  modelW.denominators?.sharedRankTimeMechanisms===4&&
  modelW.denominators?.comparableMechanismStyleScenarioHeadModeDistanceCells===960&&
  modelW.denominators?.originalSameSkillCrossSurfaceMeasured===0&&
  Array.isArray(modelW.rows)&&modelW.rows.length===960,
  'fixed source model partial-mechanism W required');
 assert(modelW.source?.globalSimRevision===fixed.PIN&&
  modelW.source?.fixedOriginalUmaSimSkillSHA256===fixed.SOURCE_SHA,
  'source version mismatch');
 const sourceByKey=new Map();
 for(const x of modelW.rows){
  assert(x.sourceIDIdentical===false&&
   x.originalSkillWholeAND===false&&
   x.onlySharedPartialMechanism===true&&
   fixed.STYLES.includes(x.style)&&
   fixed.SCENARIOS.includes(x.scenario)&&
   [9,12].includes(x.fieldSize)&&fixed.MODES.includes(x.mode)&&
   [1,2,3,4].includes(x.distanceType),
   'invalid fixed partial W observation');
  const key=[x.mechanismKey,x.style,x.distanceType].join('|');
  const list=sourceByKey.get(key)??[];list.push(x);
  sourceByKey.set(key,list);
 }
 const referenced=new Set(),records=[],unobserved=[];
 for(const skill of cohort.rows){
  const details=[],summary={matchedProjectedContexts:0,
   pooledStrictDirection:0,bothHalvesStrictDirection:0,
   bothHalvesHypotheticalFivePoint:0,
   absentStyleContextCells:0};
  for(const axis of skill.commonStaticContexts){
   const key=[skill.originalRankTimingMechanism,axis.style,
    axis.distanceType].join('|');
   const source=sourceByKey.get(key);
   if(!source?.length){ // Only noFront/Nige is omitted from model data.
    unobserved.push({originalSourceSkillId:skill.originalSourceSkillId,
     style:axis.style,distanceType:axis.distanceType,
     reason:'no-fixed-model-source-mechanism-cells'});
    continue;
   }
   const expected=axis.style==='Nige'?12:16;
   assert(source.length===expected,'incorrect fixed W context count '+key);
   for(const x of source){
    referenced.add([x.mechanismKey,x.style,x.distanceType,
     x.scenario,x.fieldSize,x.mode].join('|'));
    // Single source ID remains fixed. The two different witness IDs only
    // identify which source predicate mechanism was measured by the model.
    details.push({originalSourceSkillId:skill.originalSourceSkillId,
     originalSourceSkillSameInBothSurfaces:true,
     mechanismKey:skill.originalRankTimingMechanism,
     originalSourceCurrentANDPredicateCount:
      skill.originalSourceFullCurrentANDPredicateCount,
     style:axis.style,distanceType:axis.distanceType,
     commonGroundConditionMask:axis.commonGroundConditionMask,
     scenario:x.scenario,fieldSize:x.fieldSize,mode:x.mode,
     // Only the reusable rank + time partial model W; NOT original source
     // skill AND runtime observation. No ground_condition was simulated.
     turfMechanismWLowerPercent:x.turfW.lowerWPercent,
     turfMechanismWUpperPercent:x.turfW.upperWPercent,
     dirtMechanismWLowerPercent:x.dirtW.lowerWPercent,
     dirtMechanismWUpperPercent:x.dirtW.upperWPercent,
     pooledMechanismContrast:x.original30,
     first15MechanismContrast:x.first15,
     last15MechanismContrast:x.last15,
     bothHalvesConfirmOriginalDirection:
      x.bothHalvesConfirmOriginalDirection,
     bothHalvesConfirmHypotheticalFivePointGap:
      x.bothHalvesConfirmHypotheticalFivePointGap,
     originalSkillWholeConditionOnOriginalJVMTickObserved:false,
     originalSkillActualActivationObserved:false,
     eligibleForP3CardScoring:false});
    summary.matchedProjectedContexts++;
    if(x.original30.direction!=='held-overlap-or-course-confounding')
     summary.pooledStrictDirection++;
    if(x.bothHalvesConfirmOriginalDirection)
     summary.bothHalvesStrictDirection++;
    if(x.bothHalvesConfirmHypotheticalFivePointGap)
     summary.bothHalvesHypotheticalFivePoint++;
   }
   summary.absentStyleContextCells+=16-source.length;
  }
  records.push({...skill,projectionCounts:summary,
   projectionStatus:details.length?
    'conditional-source-static-gates-with-reused-partial-model-W':
    'no-compatible-fixed-model-context',
   observedSameSkillSourceJVMEvents:0,
   originalFullSkillW:null,actualSkillActivationRate:null,
   productSuitabilityLabel:null,eligibleForP3CardScoring:false,
   modelProjectionRows:details});
 }
 const total=records.reduce((a,r)=>a+r.projectionCounts.matchedProjectedContexts,0);
 const summary={
  sourceMatchedSkills:cohort.sourceMatchedOriginalSkills,
  originalSameIDMinimalSkillCandidates:records.length,
  originalSkillIDsWithAtLeastOneModelProjection:
   records.filter(x=>x.projectionCounts.matchedProjectedContexts>0).length,
  conditionalOriginalIDModelProjectionReferences:total,
  uniqueReusedFixedPartialModelContexts:referenced.size,
  strictPooledProjectedReferences:records.reduce((a,r)=>a+
   r.projectionCounts.pooledStrictDirection,0),
  strict15Plus15ProjectedReferences:records.reduce((a,r)=>a+
   r.projectionCounts.bothHalvesStrictDirection,0),
  fivePoint15Plus15ProjectedReferences:records.reduce((a,r)=>a+
   r.projectionCounts.bothHalvesHypotheticalFivePoint,0),
  sourceOriginalJVMWholeSkillConditionMeasurements:0,
  sameOriginalIDObservedActualSkillActivations:0,
  p3OfficialSuitabilityRecords:0
 };
 assert(total>0&&referenced.size>0&&referenced.size<=960&&
  total>=referenced.size&&
  records.every(r=>r.modelProjectionRows.every(x=>
   x.originalSourceSkillId===r.originalSourceSkillId)),
  'original source skill/model proxy join incomplete');
 return {schemaVersion:1,status:STATUS,
  source:{globalSimRevision:fixed.PIN,
   originalUmaSimSkillDataSha256:fixed.SOURCE_SHA,
   modelPopulation:'fixed original 30 seed + both 15 seed halves, no new races',
   skillSource:'source-matched current/pinned original app model'},
  comparison:{originalSkillIDHeldConstantAcrossSurface:true,
   sourceCurrentANDStaticGatesEvaluatedInSameStyleDistanceGroundCondition:true,
   modelDynamicRankWindowIsOnlyPartialProxy:true,
   originalJVMSourceRankWindowDrawMeasured:false,
   originalFullSkillWMeasured:false,
   realGameActivationOrCardSuitabilityMeasured:false,
   originalTwoModelWitnessIDsAreNotSameAsTargetSkill:true,
   venueDistanceControl:'Tokyo course 10501/10508 both 1200m venue 10005',
   geometryConfoundingRemains:true},
  summary,sourceHeld:cohort.held,
  unobservedContexts:unobserved,
  records,
  limitations:[
   'Original target skill ID is preserved across turf/dirt model projections, but the observed model W was produced for an identical PARTIAL predicate mechanism recorded under two different witness IDs.',
   'Even when the full CURRENT AND has no other dynamic types, the GlobalSim model W is NOT the original skill original-Umamusume/UmaSim rank and drawn random-window conjunction at one JVM tick.',
   'Other original Invoke/OR/precondition branches are excluded by strict one-invoke/one-OR/empty-history selection. No original skill proc or activation effect was executed.',
   'The model does not sample original ground_condition (good/heavy etc.). The common bitmask means conditional same-state static eligibility only, never observed weather distribution.',
   'Tokyo1200 shares venue and distance but not turf/dirt course geometry; projected W difference cannot identify surface causality.',
   'Candidate-by-context counts repeat original model W values across target skill IDs; they are NOT independent race observations or a skill population prevalence estimate.',
   'No formal five-point threshold, D=O-U, card scoring, suitability label or user-facing product change.'
  ]};
}
module.exports={STATUS,maskForBoth,selectMinimalOriginalSkills,audit};
