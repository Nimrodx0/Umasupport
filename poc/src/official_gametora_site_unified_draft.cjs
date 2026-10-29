'use strict';
/*
 * One ORIGINAL GameTora website event, one route-by-route private evidence
 * ledger. Inputs are the FOUR independently generated site-only drafts, not
 * historical GitHub GT JSON, full website prose, or an approved app schema.
 *
 * Joining is strict: missing/duplicated/reordered routes and identity drift
 * are errors, NEVER repaired by assigning a hint to a nearby result.
 */
const fail=code=>{throw Error('GameTora元サイト結果統合候補: '+code);};
const isId=x=>typeof x==='string'&&/^[1-9]\d*$/.test(x);
const integer=n=>Number.isSafeInteger(n);
const sameKey=(a,b)=>a.choiceGroupOrdinal===b.choiceGroupOrdinal&&
 a.resultOrdinal===b.resultOrdinal;
function requireDraft(draft,kind,cardId,ordinal){
 if(!draft||draft.dataKind!==kind||draft.version!==1||
    draft.cardId!==cardId||draft.siteEventOrdinal!==ordinal||
    draft.appEventSchemaAdoptable!==false||
    draft.publicationApproved!==false)fail('source-kind-version-scope-or-approval-mismatch');
}
function buildUnifiedSiteDraft({numericDraft,hintDraft,directDraft,flowDraft}={}){
 if(!numericDraft||numericDraft.dataKind!=='official-gametora-site-numeric-draft'||
    numericDraft.version!==1||numericDraft.appEventSchemaAdoptable!==false||
    numericDraft.publicationApproved!==false||
    numericDraft.sourceSiteTextCopied!==false||
    !/^\d{4,7}$/.test(numericDraft.cardId||'')||
    !integer(numericDraft.siteEventOrdinal)||numericDraft.siteEventOrdinal<1||
    !Array.isArray(numericDraft.candidates)||!numericDraft.candidates.length)
  fail('invalid-numeric-site-draft');
 const id=numericDraft.cardId,ordinal=numericDraft.siteEventOrdinal;
 requireDraft(hintDraft,'official-gametora-site-route-hint-draft',id,ordinal);
 requireDraft(directDraft,'official-gametora-site-direct-skill-draft',id,ordinal);
 requireDraft(flowDraft,'official-gametora-visible-flow-draft',id,ordinal);
 if(hintDraft.sourceWebsiteProseExported!==false||
    directDraft.sourceProseExported!==false||
    flowDraft.sourceTextExported!==false||
    flowDraft.missingMarkersMeanContinuation!==false||
    directDraft.allDirectSkillEffectsFound!==false||
    hintDraft.fullSkillRewardsVerified!==false||
    flowDraft.everyContinuationAndDependencyVerified!==false)
  fail('source-provenance-or-completeness-drift');
 if(!Array.isArray(hintDraft.routeCandidates)||
    !Array.isArray(directDraft.routeCandidates)||
    !Array.isArray(flowDraft.routes)||
    numericDraft.candidates.length!==hintDraft.routeCandidates.length)
  fail('route-group-count-mismatch');
 const base=numericDraft.candidates.flatMap((g,gi)=>{
  if(g.visibleGroupOrdinal!==gi+1||!Array.isArray(g.routeCandidates)||
     g.routeCandidates.length<1||g.routeCandidates.length>20||
     g.orSeparatorCount!==g.routeCandidates.length-1||
     !Array.isArray(hintDraft.routeCandidates[gi])||
     hintDraft.routeCandidates[gi].length!==g.routeCandidates.length)
   fail('site-route-topology-mismatch');
  return g.routeCandidates.map((item,ri)=>({
   choiceGroupOrdinal:gi+1,resultOrdinal:ri+1,base:item,
   hint:hintDraft.routeCandidates[gi][ri],
   orGroupHasAlternatives:g.routeCandidates.length>1
  }));
 });
 if(base.length!==numericDraft.visibleRouteCount||
    base.length!==hintDraft.visibleRouteCount||
    base.length!==directDraft.routesInspected||
    base.length!==flowDraft.resultRoutesInspected||
    base.length!==directDraft.routeCandidates.length||
    base.length!==flowDraft.routes.length)
  fail('source-route-cardinality-mismatch');
 let numericCount=0,hintCount=0,directCount=0,markerCount=0;
 const routes=base.map((r,i)=>{
  const a=r.base,h=r.hint,d=directDraft.routeCandidates[i],f=flowDraft.routes[i];
  if(!a||a.resultOrdinal!==r.resultOrdinal||
     !h||!d||!f||!sameKey(r,h)||!sameKey(r,d)||!sameKey(r,f)||
     !Array.isArray(a.effects)||!Array.isArray(a.issues)||
     !Array.isArray(a.nonScalarKinds)||
     !Array.isArray(h.hints)||!Array.isArray(h.unresolvedHintStatuses)||
     !Array.isArray(d.provisionalDirectGrants)||!Array.isArray(d.unresolvedReasons)||
     !Array.isArray(f.visibleMarkerKinds)||typeof f.safelyAttributedToResult!=='boolean')
   fail('route-order-or-field-mismatch');
 const numericEffects=a.effects.map(effect=>{
  if(!effect||!['speed','stamina','power','guts','wisdom','energy',
      'max_energy','skill_points','mood','bond'].includes(effect.kind)||
      !integer(effect.delta)||effect.delta===0)
    fail('invalid-scalar-effect');
  numericCount++;
  return {kind:effect.kind,delta:effect.delta};
 });
 const skillHints=h.hints.map(x=>{
  if(!sameKey(x,r)||x.source!=='gametora-visible-hint'||
     !isId(x.numericId)||!integer(x.level)||x.level<1||x.level>10)
    fail('mislocated-or-invalid-hint');
  hintCount++;
  return {numericId:x.numericId,level:x.level,
   evidence:'independent-registry-and-site-hint-row'};
 });
 const directSkills=d.provisionalDirectGrants.map(x=>{
  if(!sameKey(x,r)||x.source!=='gametora-visible-explicit-direct-award'||
     !isId(x.numericId)||!['normal','rare'].includes(x.rarity))
    fail('mislocated-or-invalid-direct-skill');
  directCount++;
  return {numericId:x.numericId,rarity:x.rarity,
   evidence:'strict-explicit-site-text-and-independent-registry'};
 });
 const allowedMarkers=new Set(['explicit-chain-stop','explicit-outing-unlock',
  'explicit-outing-stop']);
 if(f.visibleMarkerKinds.some(x=>!allowedMarkers.has(x)))
  fail('unsupported-flow-marker');
 markerCount+=f.visibleMarkerKinds.length;
 // A marker in an unresolved OR is NOT assigned to any outcome.
 const flowMarkers=f.safelyAttributedToResult?
  [...f.visibleMarkerKinds]:[];
 const unresolvedFlowMarkers=f.safelyAttributedToResult?[]:
  [...f.visibleMarkerKinds];
 if(unresolvedFlowMarkers.length&&directSkills.length)
  fail('unlocated-flow-with-direct-skill');
 const reasons=new Set([
  'site-choice-versus-result-meaning-unverified',
  'all-skill-rewards-not-verified',
  'numeric-effect-recipients-not-verified',
  'event-chain-reachability-not-verified',
  'event-and-choice-wording-not-reviewed',
  'publication-rights-not-reviewed',
  ...(a.issues.length?['numeric-facts-unresolved']:[]),
  ...(h.unresolvedHintStatuses.length?['hint-facts-unresolved']:[]),
  ...(d.unresolvedReasons.length?['direct-skill-facts-unresolved']:[]),
  ...(unresolvedFlowMarkers.length?['flow-marker-route-unresolved']:[])
 ]);
 return {
  choiceGroupOrdinal:r.choiceGroupOrdinal,resultOrdinal:r.resultOrdinal,
  numericEffects,skillHints,directSkills,
  visibleFlowMarkers:flowMarkers,unlocatedVisibleFlowMarkers:unresolvedFlowMarkers,
  unresolvedReasons:[...reasons].sort(),
  // Do not fake an app-level rewards:[] or "auto" choice.
  sourceRoutePositionVerified:true,
  gameOutcomeMeaningVerified:false,allAwardsExhaustive:false,
  explicitChainEdgeVerified:false
 };
 });
 if(numericCount!==numericDraft.observedScalarEffectCount||
    hintCount!==hintDraft.uniquelyResolvedHintIdLevelPairs||
    directCount!==directDraft.uniquelyMatchedDirectSkillCandidates||
    markerCount!==flowDraft.visibleMarkerKinds)
  fail('source-count-or-meaning-drift');
 return {
  dataKind:'official-gametora-site-unified-route-draft',version:1,
  cardId:id,siteEventOrdinal:ordinal,
  visibleGroupCount:numericDraft.visibleGroupCount,
  visibleRouteCount:base.length,
  numericEffectCount:numericCount,uniqueSkillHintCount:hintCount,
  explicitDirectSkillCandidateCount:directCount,
  observedVisibleFlowMarkerCount:markerCount,
  routes,
  skillAwardCompletenessVerified:false,
  resultExclusivityVerified:false,choiceLabelRightsVerified:false,
  continuationRequiresVerified:false,
  sourceSiteTextCopied:false,
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
function summarizeUnifiedSiteDraft(draft){
 if(draft?.dataKind!=='official-gametora-site-unified-route-draft'||
    draft.appEventSchemaAdoptable!==false||draft.publicationApproved!==false)
  fail('only-unapproved-unified-draft');
 const markerCounts={};
 for(const r of draft.routes)
  for(const m of r.visibleFlowMarkers)
   markerCounts[m]=(markerCounts[m]||0)+1;
 return {
  cardId:draft.cardId,siteEventOrdinal:draft.siteEventOrdinal,
  groups:draft.visibleGroupCount,routes:draft.visibleRouteCount,
  numericEffects:draft.numericEffectCount,skillHints:draft.uniqueSkillHintCount,
  directSkillCandidates:draft.explicitDirectSkillCandidateCount,
  observedFlowMarkers:draft.observedVisibleFlowMarkerCount,
  locatedFlowMarkers:markerCounts,
  routeSummary:draft.routes.map(r=>({
   group:r.choiceGroupOrdinal,result:r.resultOrdinal,
   numericalFacts:r.numericEffects.length,hints:r.skillHints.length,
   directCandidates:r.directSkills.length,flowMarkers:r.visibleFlowMarkers,
   unlocatedFlowMarkers:r.unlocatedVisibleFlowMarkers,
   reviewReasons:r.unresolvedReasons
  })),
  allRewardsVerified:false,continuationRequiresVerified:false,
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
module.exports={buildUnifiedSiteDraft,summarizeUnifiedSiteDraft};
