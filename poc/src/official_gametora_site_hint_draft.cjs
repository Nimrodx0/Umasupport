'use strict';
/*
 * Add ONLY independently seen, route-local hint-ID + level observations to
 * the existing site-only numeric draft. This is a review candidate, not a
 * full skill reward or event-schema compiler. No old GT event input.
 */
const {scanOwnText}=require('./official_gametora_numeric_fact_parser.cjs');
const {matchContextToId}=require('./official_gametora_skill_id_crosswalk.cjs');
const error=code=>{throw Error('GameTora直接スキルヒント候補: '+code);};
const unique=a=>[...new Set(a)];
function hintOnlyDraft(numericDraft,groups,registry){
 if(numericDraft?.dataKind!=='official-gametora-site-numeric-draft'||
    numericDraft.version!==1||numericDraft.appEventSchemaAdoptable!==false||
    numericDraft.publicationApproved!==false||
    !Array.isArray(numericDraft.candidates)||
    !Array.isArray(groups)||groups.length!==numericDraft.candidates.length||
    !(registry?.byName instanceof Map)||registry.byName.size<1)
  error('source-independent-draft-and-registry-required');
 let seen=0,resolved=0,unresolved=0;
 const routeCandidates=numericDraft.candidates.map((candidate,ci)=>{
  const group=groups[ci];
  if(!group||!Array.isArray(group.numericSegments)||
    group.numericSegments.length!==candidate.routeCandidates.length||
    group.routeCandidateCount!==candidate.routeCandidates.length||
    group.orSeparatorCount!==candidate.orSeparatorCount)
   error('branch-layout-drift');
  return group.numericSegments.map((segment,ri)=>{
   const original=candidate.routeCandidates[ri];
   if(!Array.isArray(segment?.effectTexts)||!Array.isArray(segment?.effectContexts)||
    segment.effectContexts.length!==segment.effectTexts.length||
    !Array.isArray(original.nonScalarKinds)||!Array.isArray(original.effects))
    error('missing-site-numeric-route');
   const hintCandidates=[],unresolvedStatuses=[];
   for(let i=0;i<segment.effectTexts.length;i++){
    const own=segment.effectTexts[i],contexts=segment.effectContexts[i];
    if(typeof own!=='string'||own.length>400||!Array.isArray(contexts)||
      contexts.length>6||contexts.some(t=>typeof t!=='string'||t.length>300))
     error('hint-context-out-of-bounds');
    const parsed=scanOwnText(own);
    if(!parsed||parsed.kind!=='skill_hint')continue;
    seen++;
    const level=parsed.amount;
    if(parsed.requiresReview||!Number.isSafeInteger(level)||level<1||level>10){
     unresolved++;
     unresolvedStatuses.push('hint-level-not-confirmed');
     continue;
    }
    // Only ancestors of this specific effect fragment; NEVER outer choice
    // text or another result's skill hints.
    const candidates=contexts.map(context=>matchContextToId(context,registry));
    const distinct=new Set(candidates
     .filter(x=>x.status==='unique-verified-name')
     .map(x=>x.numericId));
    const ambiguous=candidates.some(x=>x.status==='ambiguous-name-or-id');
    if(distinct.size===1&&!ambiguous){
     const numericId=[...distinct][0];
     hintCandidates.push({
      source:'gametora-visible-hint',
      numericId,level,choiceGroupOrdinal:ci+1,resultOrdinal:ri+1
     });
     resolved++;
    }else{
     unresolved++;
     unresolvedStatuses.push(distinct.size>1?'conflicting-skill-ids':
      ambiguous?'ambiguous-name-or-id':'skill-name-not-uniquely-resolved');
    }
   }
   const advertisedHintRows=original.nonScalarKinds.includes('skill_hint');
   if(advertisedHintRows&&!hintCandidates.length&&!unresolvedStatuses.length)
    error('numeric-draft-hint-without-raw-evidence');
   return {
    choiceGroupOrdinal:ci+1,resultOrdinal:ri+1,
    hints:hintCandidates,unresolvedHintStatuses:unique(unresolvedStatuses).sort(),
    // All other skill rewards and the displayed choice's semantics are unknown.
    rewardCompletenessVerified:false,
    routeChoiceSemanticsVerified:false
   };
  });
 });
 if(seen!==resolved+unresolved)error('hint-accounting-failed');
 return {
  dataKind:'official-gametora-site-route-hint-draft',
  version:1,cardId:numericDraft.cardId,siteEventOrdinal:numericDraft.siteEventOrdinal,
  visibleGroupCount:numericDraft.visibleGroupCount,
  visibleRouteCount:numericDraft.visibleRouteCount,
  seenHintRows:seen,uniquelyResolvedHintIdLevelPairs:resolved,
  unresolvedHintRows:unresolved,
  routeCandidates,
  fullSkillRewardsVerified:false,
  directSkillGrantsVerified:false,
  resultExclusivityAndRandomMeaningVerified:false,
  continuationRequiresVerified:false,
  numericDraftStillUnapproved:true,
  sourceWebsiteProseExported:false,
  appEventSchemaAdoptable:false,publicationApproved:false
 };
}
function summarizeHintDraft(hintDraft){
 if(hintDraft?.dataKind!=='official-gametora-site-route-hint-draft'||
   hintDraft.appEventSchemaAdoptable!==false||hintDraft.publicationApproved!==false)
  error('only-unapproved-hint-draft-allowed');
 return {cardId:hintDraft.cardId,siteEventOrdinal:hintDraft.siteEventOrdinal,
  visibleRouteCount:hintDraft.visibleRouteCount,
  seenHintRows:hintDraft.seenHintRows,
  resolvedHintIdLevelPairs:hintDraft.uniquelyResolvedHintIdLevelPairs,
  unresolvedHintRows:hintDraft.unresolvedHintRows,
  // Count routes with candidate evidence, not an assertion of complete rewards.
  routesWithResolvedHints:hintDraft.routeCandidates.flat().filter(x=>x.hints.length).length,
  hintCandidates:hintDraft.routeCandidates.flat().flatMap(x=>x.hints),
  fullSkillRewardsVerified:false,appEventSchemaAdoptable:false,
  sourceWebsiteProseExported:false,publicationApproved:false};
}
module.exports={hintOnlyDraft,summarizeHintDraft};
