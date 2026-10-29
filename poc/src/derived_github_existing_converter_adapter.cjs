'use strict';
/*
 * Single-card entrypoint for the ORIGINAL mature GameTora-derived conversion
 * pipeline. No second parsing/projecting implementation is maintained here.
 * Technical conversion, issue reporting and publication are distinct.
 */
const {validateDerivedCardSource}=require('./derived_github_card_event_preflight.cjs');
const {transformDocument}=require('./gametora_whole_event_normalize.cjs');
const {crosswalk}=require('./gametora_event_skill_crosswalk.cjs');
const {project}=require('./gametora_app_schema_dry_run.cjs');
const {isKnownSourceEffectType}=require('./phase2_gt_whole_nonskill_effect_inventory.cjs');
const fail=code=>{throw Error('既存GameTora変換器・新カード入口: '+code);};
function projectExistingConverterForNewCard({
 plan,cardId,sourceText,skillText,skillRevision
}={}){
 const pin=validateDerivedCardSource({plan,cardId,sourceText});
 if(typeof skillRevision!=='string'||!/^[a-f0-9]{40}$/.test(skillRevision))
  fail('version-pinned-independent-skill-registry-required');
 let normalized;
 try{normalized=transformDocument(JSON.parse(sourceText));}
 catch{fail('normalized-card-invalid');}
 if(normalized.cardId!==cardId||normalized.sourceEventCount!==pin.observedEvents)
  fail('normalized-card-source-drift');
 const {reviewQueue,effectTypeCounts,...card}=normalized;
 const counts={rosterCards:1,
  sourceEvents:normalized.sourceEventCount,
  sourceChoices:normalized.sourceChoiceCount,
  expandedRoutes:normalized.sourceExpandedRoutes,
  numericHintMentions:normalized.numericParsedHintMentions,
  unresolvedHintMentions:normalized.unresolvedHintMentions,
  directSkillGrantMentions:normalized.directSkillGrantMentions};
 const candidate={schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  sourcePins:{gameToraDerived:plan.primarySourceCommit},
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  originalSourceTextIncluded:false,totals:counts,cards:[card]};
 // The existing crosswalk and projector require a model, but a new card
 // does not yet exist in the runtime DB. Validate it in a disposable isolated
 // card model instead of modifying (or fabricating hints in) the existing DB.
 const runtimeCard={id:cardId,hints:[],events:[]};
 const model={cards:[runtimeCard],cardById:{[cardId]:runtimeCard},
  skills:[],skillById:{},meta:{}};
 const linked=crosswalk({candidate,model,skillText,
  sourceRevision:plan.primarySourceCommit,skillRevision});
 const converted=project({candidate,crosswalk:linked,model,skillText,
  sourceRevision:plan.primarySourceCommit});
 const row=converted.dryRunUnpreparedCatalog.cards.find(c=>c.cardId===cardId);
 // The established SKILL projector intentionally leaves nonskill effects
 // aside. Detect UNKNOWN effect codes with the existing nonskill vocabulary;
 // otherwise a new source type could falsely appear as an empty safe reward.
 const unknownByEventId=new Map();
 let omittedKnownNonSkillEffects=0;
 for(const e of card.events){
  let unknown=0;
  for(const ch of e.choices)for(const route of ch.routes)
   for(const effect of route.effects){
    if(!isKnownSourceEffectType(effect.type))unknown++;
    else if(!['skill_hint','skill_hint_or','obtain_skill','chain_end',
       'branch_flag','both_previous_chain_good','one_previous_chain_good',
       'both_previous_chain_bad','one_previous_chain_bad',
       'result_good','result_bad','result_average','success','fail'
      ].includes(effect.type))omittedKnownNonSkillEffects++;
   }
  if(unknown)unknownByEventId.set(e.eventId,unknown);
 }
 const rejected=[...converted.report.excludedSourcePositions.map(x=>({
  sourceOrdinal:x.sourceOrdinal,eventId:x.eventId,reason:x.reason}))];
 const previouslyRejected=new Set(rejected.map(x=>x.eventId));
 const events=[],admitted=new Set();
 const byId=new Map(card.events.map(x=>[x.eventId,x]));
 for(const e of row?.events||[]){
  const origin=byId.get(e.id);
  if(!origin)fail('projected-event-has-no-source-position');
  const missingPredecessor=(e.requires?.all||[]).some(req=>!admitted.has(req.eventId));
  if(unknownByEventId.has(e.id)||missingPredecessor){
   if(previouslyRejected.has(e.id))fail('previously-rejected-event-projected');
   rejected.push({eventId:e.id,sourceOrdinal:origin.sourceOrdinal,
    reason:unknownByEventId.has(e.id)?
     'UNKNOWN_SOURCE_EFFECT_TYPE':'PREDECESSOR_REQUIRES_REVIEW'});
   previouslyRejected.add(e.id);
  }else{
   events.push({...e,sourceKind:'derived-github-unreviewed'});
   admitted.add(e.id);
  }
 }
 const reviewItems=[];
 for(const issue of reviewQueue)reviewItems.push({
  sourceOrdinal:issue.sourceOrdinal,
  ...(issue.choiceOrdinal?{choiceOrdinal:issue.choiceOrdinal}:{}),
  ...(issue.routeOrdinal?{routeOrdinal:issue.routeOrdinal}:{}),
  reason:issue.reason,origin:'source-normalization'});
 for(const issue of rejected)reviewItems.push({
  sourceOrdinal:issue.sourceOrdinal,reason:issue.reason,
  origin:issue.reason==='UNKNOWN_SOURCE_EFFECT_TYPE'||
    issue.reason==='PREDECESSOR_REQUIRES_REVIEW'?
     'source-effect-vocabulary':'schema-projection'});
 for(const e of card.events)
  if(e.nextStageMeaning==='SOURCE_PRESENTATION_ORDER_NOT_INDEPENDENTLY_VERIFIED')
   reviewItems.push({sourceOrdinal:e.sourceOrdinal,
    reason:'CHAIN_ORDER_REQUIRES_CONFIRMATION',origin:'source-chain-order'});
 const census={
  sourceEvents:normalized.sourceEventCount,
  sourceChoices:normalized.sourceChoiceCount,
  sourceRoutes:normalized.sourceExpandedRoutes,
  modeledEvents:events.length,
  excludedEvents:rejected.length,
  sourceReviewItems:reviewQueue.length,
  nonSkillEffectMentionsNotInSkillProjection:omittedKnownNonSkillEffects,
  unknownSourceEffectEvents:unknownByEventId.size,
  reviewItems:reviewItems.length,
  sourceSectionCounts:normalized.sectionCounts,
  projectionReasons:Object.fromEntries(Object.entries(rejected.reduce((out,r)=>{
   out[r.reason]=(out[r.reason]||0)+1;return out;
  },{})).sort(([a],[b])=>a.localeCompare(b)))};
 if(census.modeledEvents+census.excludedEvents!==census.sourceEvents||
    new Set(events.map(e=>e.id)).size!==events.length||
    events.some(e=>e.sourceKind!=='derived-github-unreviewed'))
  fail('single-card-conservation-failed');
 return {dataKind:'derived-github-existing-converter-single-card-draft',
  version:1,cardId,sourceCommit:plan.primarySourceCommit,
  sourceBlobSha:pin.sourceBlobSha,
  independentSkillCommit:skillRevision,
  sourceConverter:'gametora_app_schema_dry_run.project',
  draftCatalog:{schemaVersion:1,cards:[{cardId,coverageStatus:'partial',events}]},
  pendingEvents:rejected.map(x=>({sourceOrdinal:x.sourceOrdinal,
   eventId:x.eventId,reason:x.reason})),
  reviewItems,census,
  sourceLabelsCopied:false,publicationApproved:false,
  completeCardReadyForPublication:false,
  existingDatabaseUnchanged:true};
}
module.exports={projectExistingConverterForNewCard};
