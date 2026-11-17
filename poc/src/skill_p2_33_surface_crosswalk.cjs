'use strict';
/*
 * P2.33: separate source-PREDICATE mechanism transfer from original SKILL
 * identity and full source-branch activation. The fixed 10 original research
 * profiles have distinct source skill IDs on turf/dirt, but some rank+timing
 * predicate shapes are exactly identical.
 *
 * This module also locates original app-matched skill branches whose rank/time
 * CURRENT AND agrees with a paired mechanism, and whose original STATIC
 * predicates do not rule out both surfaces in the SAME race context.
 * Historical preconditions, all other dynamic terms and original runtime
 * applicability are always held.
 */
const fixed=require('../tools/globalsim_roster32.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const axis=require('./skill_p2_15_parameterized_axis_gates.cjs');
const STATUS='P2.33-fixed-cross-surface-mechanism-proxy-and-original-route-triage-not-skill-W';
const assert=(x,m)=>{if(!x)throw Error('P2.33 surface mechanism: '+m)};
const key=(timing,bandId)=>timing+'|'+bandId;
const uniq=xs=>[...new Set(xs)].sort();
const signature=xs=>JSON.stringify(xs.map(p=>[p.operator,p.value])
 .sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
const bandSignature=new Map(bands.map(b=>[signature(b.predicates),b.id]));
const RANDOM_TYPES=new Set(['phase_random','phase_firsthalf_random',
 'phase_laterhalf_random']);
const STATIC_TYPES=new Set(['running_style','distance_type',
 'ground_type','ground_condition']);
function pairedMechanisms(manifest){
 fixed.verifyManifest(manifest);
 const profiles=manifest.profiles.filter(x=>x.distanceScope==='all');
 assert(profiles.length===10,'fixed all-distance source cohort changed');
 const grouped=new Map();
 for(const p of profiles){
  const k=key(p.timing,p.bandId);
  const item=grouped.get(k)||{timing:p.timing,bandId:p.bandId,
   turfSourceIds:[],dirtSourceIds:[]};
  item[p.surface==='turf'?'turfSourceIds':'dirtSourceIds'].push(p.sourceNumericId);
  grouped.set(k,item);
 }
 const paired=[],held=[];
 for(const [id,item] of grouped){
  assert(item.turfSourceIds.length<=1&&item.dirtSourceIds.length<=1,
   'multiple original source skills in a single fixed surface mechanism');
  if(item.turfSourceIds.length===1&&item.dirtSourceIds.length===1)
   paired.push({mechanismKey:id,timing:item.timing,bandId:item.bandId,
    turfSourceNumericId:item.turfSourceIds[0],
    dirtSourceNumericId:item.dirtSourceIds[0],
    SAME_ORIGINAL_SKILL:false,
    originalSkillActivationInferred:false});
  else held.push({...item,mechanismKey:id,
   reason:'no-paired-other-surface-observation'});
 }
 assert(paired.every(x=>x.turfSourceNumericId!==x.dirtSourceNumericId),
  'unexpected original source skill ID overlap; review identity before transfer');
 return {paired:paired.sort((a,b)=>a.mechanismKey.localeCompare(b.mechanismKey)),
  held:held.sort((a,b)=>a.mechanismKey.localeCompare(b.mechanismKey)),
  allDistanceSourceSignatures:profiles.length,
  overlappingOriginalSourceSkillIds:0};
}
function routeSignature(conditions){
 assert(Array.isArray(conditions),'original source current AND absent');
 const rates=conditions.filter(x=>x.type==='order_rate');
 const timers=conditions.filter(x=>RANDOM_TYPES.has(x.type));
 if(!rates.length||timers.length!==1||timers[0].operator!=='=='||
  !Number.isSafeInteger(timers[0].value))
  return null;
 const bandId=bandSignature.get(signature(rates));
 if(!bandId)return null;
 return {timing:timers[0].type+':'+timers[0].value,
  bandId,originalOrderRatePredicates:rates.length,
  originalRandomWindowPredicates:1};
}
function sameGroundStateStaticCompatibility(masks){
 assert(Array.isArray(masks)&&masks.length===32&&
  masks.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=15),
  'original source static axis grid is missing or malformed');
 const contexts=[];
 for(let style=1;style<=4;style++)for(let distance=1;distance<=4;distance++){
  const turf=masks[axis.panelIndex(style,distance,1)];
  const dirt=masks[axis.panelIndex(style,distance,2)];
  const both=turf&dirt;
  if(both)contexts.push({runningStyle:style,distanceType:distance,
   sameGroundConditionMasks:both});
 }
 return contexts;
}
function auditSourceRoutes(appModel,sourceAxisReport,manifest){
 const fixedMatch=pairedMechanisms(manifest);
 assert(appModel&&Array.isArray(appModel.skills)&&appModel.skillById&&
  sourceAxisReport?.status===axis.STATUS&&
  Array.isArray(sourceAxisReport.routeRows)&&
  sourceAxisReport.denominators?.sourceMatchedSkills===818&&
  sourceAxisReport.denominators?.sourceRouteFamilies===970,
  'pinned 818 source-matched skill model plus exact static routes required');
 const before=JSON.stringify(appModel);
 const lookup=new Map(appModel.skills.filter(x=>
  x.activationProfile?.status==='source-structure').map(x=>
   [x.activationProfile.sourceNumericId,x]));
 assert(lookup.size===818,'original source skill cohort changed');
 const supported=new Map(fixedMatch.paired.map(x=>[x.mechanismKey,x]));
 let windowRankRouteCount=0,pairedShapeRouteCount=0;
 const routes=[];
 for(const r of sourceAxisReport.routeRows){
  const skill=lookup.get(r.sourceNumericId);
  assert(skill,'source route not found in full original model');
  const inv=skill.activationProfile.invokes[r.invokeOffset];
  assert(inv&&inv.index===r.invokeIndex&&
   Array.isArray(inv.conditions[r.conditionOrIndex])&&
   (r.preconditionOrIndex===null?
    inv.preConditions.length===0:
    Array.isArray(inv.preConditions[r.preconditionOrIndex])),
   'original source route/Invoke/precondition identity changed');
  const conditions=inv.conditions[r.conditionOrIndex];
  const preconditions=r.preconditionOrIndex===null?[]:
   inv.preConditions[r.preconditionOrIndex];
  const rankWindow=routeSignature(conditions);
  if(!rankWindow)continue;
  windowRankRouteCount++;
  const matched=supported.get(key(rankWindow.timing,rankWindow.bandId));
  if(!matched)continue;
  pairedShapeRouteCount++;
  const contexts=sameGroundStateStaticCompatibility(r.groundStateEligibilityMasks);
  routes.push({
   sourceNumericId:r.sourceNumericId,sourceRouteKey:r.routeKey,
   invokeOffset:r.invokeOffset,invokeIndex:r.invokeIndex,
   conditionOrIndex:r.conditionOrIndex,preconditionOrIndex:r.preconditionOrIndex,
   mechanismKey:matched.mechanismKey,bandId:rankWindow.bandId,
   timing:rankWindow.timing,
   currentANDTerms:conditions.length,
   historicalPreconditionANDTerms:preconditions.length,
   otherCurrentTypes:uniq(conditions.filter(x=>
    x.type!=='order_rate'&&!RANDOM_TYPES.has(x.type)&&
    !STATIC_TYPES.has(x.type)).map(x=>x.type)),
   historicalPreconditionTypes:uniq(preconditions.map(x=>x.type)),
   requiresFixedVenueReview:conditions.concat(preconditions)
    .some(x=>x.type==='track_id'),
   commonStaticContexts:contexts,
   staticBothSurfaceCompatibility:contexts.length?
    'not-excluded-by-original-static-necessary-gates':
    'explicitly-excluded-under-same-ground-state',
   actualModelSameSkillSurfaceW:false,
   sourceWholeANDOrInvokeProven:false,
   originalRuntimeGameTriggerMeasured:false
  });
 }
 assert(JSON.stringify(appModel)===before,
  'original user-facing model mutated during research');
 const eligible=routes.filter(x=>x.commonStaticContexts.length);
 const unique=x=>uniq(x.map(r=>r.sourceNumericId)).length;
 return {schemaVersion:1,status:STATUS,
  source:{modelRevision:fixed.PIN,originalSkillRegistrySha256:fixed.SOURCE_SHA,
   appMatchedSourceSkills:lookup.size,
   originalSourceRouteFamilies:sourceAxisReport.routeRows.length,
   modelSourceWitnesses:'fixed 32 source selection, not full original skill population'},
  design:{pairedMechanismsHaveDifferentSourceSkillIds:true,
   onlyExactCurrentANDRankPlusWindowMatched:true,
   commonGroundConditionRequiredAcrossSurface:true,
   historicalPreconditionsNeverAutoSatisfied:true,
   explicitStaticEligibilityOnly:true,
   noRealGameOrSourceRuntimeW:true},
  denominators:{
   originalAllDistanceSourceSignatures:fixedMatch.allDistanceSourceSignatures,
   sharedCrossSurfaceRankTimeMechanisms:fixedMatch.paired.length,
   unmatchedSurfaceMechanisms:fixedMatch.held.length,
   sourceMatchedOriginalSkillPopulation:lookup.size,
   originalSourceRoutes:sourceAxisReport.routeRows.length,
   sourceRoutesWithSupportedRankAndWindowShape:windowRankRouteCount,
   routeShapesFoundInPairedProxy:pairedShapeRouteCount,
   routesWithBothSurfacesStaticallyCompatible:eligible.length,
   distinctOriginalSkillsWithCompatibleRoute:unique(eligible),
   routesHeldByOriginalStaticGates:routes.length-eligible.length,
   fullSourceSameSkillSurfaceWMeasurements:0,
   verifiedWholeSourceSkillConditions:0,
   officialSuitabilityScores:0
  },
  fixedPairedMechanisms:fixedMatch.paired,
  unpairedMechanisms:fixedMatch.held,
  originalSourceRoutes:routes,
  limitations:[
   'Two source IDs with identical rank/time predicate type/operator/value are a shared MECHANISM witness, NOT the same original skill.',
   'A skill route matching the shared rank/time current AND can have additional current predicates, other Invoke/OR paths and historical preConditions; NONE is proven.',
   'Static compatibility holds the same ground_condition value in both turf/dirt checks, but track_id and any unobserved race constraints may still differ.',
   'The 32-source model cohort was selected nonrepresentatively and is not evidence for all 818 source-matched original skills.',
   'A shared mechanism model comparison cannot be transferred to actual full skill W or real game proc without additional evidence.',
   'No user-facing app score/skill card suitability, real skill trigger probability or whole skill activation is produced.'
  ]};
}
module.exports={STATUS,pairedMechanisms,routeSignature,
 sameGroundStateStaticCompatibility,auditSourceRoutes};
