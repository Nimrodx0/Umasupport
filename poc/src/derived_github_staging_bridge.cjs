'use strict';
/*
 * The missing link between an immutable structured GitHub source plan
 * and the existing append-only event staging boundary.
 *
 * REVIEW ONLY. No HTTP, no filesystem, no writes, no publishing.
 * A complete technical draft carries a sourceKind quarantine that the
 * existing public release gate MUST reject even with fake approvals.
 */
const {stageNewCardEvents}=require('./new_card_event_incremental.cjs');
const {projectDerivedCardDraft}=require('./derived_github_runtime_draft.cjs');
const fail=s=>{throw Error('派生GitHub増分接続: '+s);};
const id=x=>typeof x==='string'&&/^[1-9]\d{4}$/.test(x);
function stageDerivedGitHubNewCards({
 discovery,existingCatalog,sourcePlan,
 sourceDocuments={},skillText,pendingCardIds=[]
}={}){
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.schemaVersion!==1||discovery.publicationApproved!==false||
    sourcePlan?.dataKind!=='derived-github-new-card-source-plan'||
    sourcePlan.version!==1||sourcePlan.publicationApproved!==false||
    sourcePlan.primarySourceRepository!=='systemless10/UmamusumePS'||
    !Array.isArray(sourcePlan.results)||!Array.isArray(sourcePlan.targetIds)||
    !Array.isArray(discovery.addedCardIds)||
    !Array.isArray(pendingCardIds)||typeof skillText!=='string'||
    sourceDocuments===null||typeof sourceDocuments!=='object'||
    Array.isArray(sourceDocuments))
  fail('versioned-GitHub-plan-or-roster-invalid');
 const incoming=[...discovery.addedCardIds].sort();
 const declared=[...sourcePlan.detectedNewCardIds].sort();
 if(incoming.length!==declared.length||
    incoming.some((x,i)=>!id(x)||x!==declared[i]))
  fail('discovery-does-not-match-source-plan');
 const targets=[...new Set([...incoming,...pendingCardIds])].sort();
 if(JSON.stringify(targets)!==JSON.stringify(sourcePlan.targetIds))
  fail('pending-targets-do-not-match-source-plan');
 const byPlan=new Map();
 for(const row of sourcePlan.results){
  if(!id(row?.cardId)||byPlan.has(row.cardId)||
     !targets.includes(row.cardId))
   fail('duplicated-or-unexpected-source-plan-result');
  byPlan.set(row.cardId,row);
 }
 if(byPlan.size!==targets.length)fail('some-source-plan-rows-missing');
 for(const cardId of Object.keys(sourceDocuments)){
  if(!id(cardId)||!byPlan.has(cardId)||
    byPlan.get(cardId).status!=='source-blob-present-needs-validation'||
    typeof sourceDocuments[cardId]!=='string')
   fail('document-outside-eligible-pinned-source');
 }
 const candidates=[],failed=new Set();
 for(const cardId of targets){
  const row=byPlan.get(cardId),sourceText=sourceDocuments[cardId];
  if(row.status!=='source-blob-present-needs-validation'||
     sourceText===undefined)continue;
  let projected;
  try{projected=projectDerivedCardDraft({plan:sourcePlan,cardId,
   sourceText,skillText});}
  catch{failed.add(cardId);continue;}
  if(projected.sourceCommit!==sourcePlan.primarySourceCommit||
     projected.sourceBlobSha!==row.sourceBlobSha)
   fail('result-source-lineage-mismatch');
  candidates.push({source:'GameTora-derived-GitHub',cardId,
   sourceRevision:sourcePlan.primarySourceCommit,
   sourceBlobSha:row.sourceBlobSha,sourcePath:row.sourcePath,
   sourceEventCount:projected.census.sourceEvents,
   convertedEventCount:projected.census.modeledEvents,
   unresolvedEventCount:projected.census.excludedEvents,
   events:projected.draftCatalog.cards[0].events,
   sourceSiteTextCopied:false,publicationApproved:false,
   appEventSchemaAdoptable:false});
 }
 const stage=stageNewCardEvents({discovery,existingCatalog,candidates,
  pendingCardIds,derivedSourcePlan:sourcePlan});
 const pending=stage.pending.map(item=>{
  if(item.reason!=='not-yet-fetched')return item;
  const row=byPlan.get(item.cardId);
  return {...item,reason:failed.has(item.cardId)?
   'derived-github-card-validation-failed':
   row?.status==='await-derived-github-json'?
   'derived-github-json-not-yet-published':'derived-github-source-not-fetched'};
 });
 return {dataKind:'derived-github-private-new-card-review-stage',
  schemaVersion:1,sourceCommit:sourcePlan.primarySourceCommit,
  sourceTreeSha:sourcePlan.sourceTreeSha,
  stage:{...stage,pending},
  // Even technically complete card candidates remain pending until an
  // independent publication review AND actual append to the public DB.
  carryForwardPendingIds:[...stage.targetNewIds],
  newlyModeledCardIds:stage.ready.map(x=>x.cardId),
  publicationApproved:false,
  allModeledEventsEditoriallyReviewed:false,
  existingDatabaseUnchanged:true,
  sourceProseIncluded:false};
}
module.exports={stageDerivedGitHubNewCards};
