'use strict';
/*
 * One bounded new-card refresh. The caller supplies complete immutable
 * version-pinned Git metadata, two UmaSim full rosters, independent skills,
 * and a function fetching one source JSON. All raw text stays in process.
 */
const {discoverNewCardsFromUmaSim}=require('./new_card_event_incremental.cjs');
const {planDerivedNewCardIntake}=require('./derived_github_new_card_source_plan.cjs');
const {stageDerivedGitHubNewCards}=require('./derived_github_staging_bridge.cjs');
const {emptyLedger,verifyLedger,reconcilePendingLedger,BASELINE}=
 require('./derived_github_pending_ledger.cjs');
const {gitBlobSha,POLICY}=require('./current_umasim_roster_delta.cjs');
const fail=x=>{throw Error('新カード継続差分取込: '+x);};
const SHA=/^[a-f0-9]{40}$/;
async function refresh({
 previousRosterText,currentRosterText,skillText,skillRevision,
 sourceTree,sourceCommit,existingCatalog,previousLedger=emptyLedger(),
 fetchDocument,maxTargetCards=40
}={}){
 verifyLedger(previousLedger);
 if(typeof previousRosterText!=='string'||
    gitBlobSha(previousRosterText)!==POLICY.beforeBlob||
    BASELINE!==POLICY.beforeCommit)
  fail('元となる563枚UmaSim名簿のGit blobが固定版と異なる');
 if(typeof skillText!=='string'||!SHA.test(skillRevision||'')||
    typeof fetchDocument!=='function'||
    !Number.isSafeInteger(maxTargetCards)||maxTargetCards<1||
    maxTargetCards>100)
  fail('独立スキル出典／取得関数／上限の指定が不正');
 const discovery=discoverNewCardsFromUmaSim({previousSupportText:previousRosterText,
  currentSupportText:currentRosterText});
 const pendingCardIds=previousLedger.cards.map(x=>x.cardId);
 const plan=planDerivedNewCardIntake({
  discovery,existingCatalog,pendingCardIds,sourceTree,sourceCommit});
 if(plan.candidateIds.length>maxTargetCards||
    plan.targetIds.length>maxTargetCards)
  fail('対象新カード数が上限超過。無制限の外部データ取得は禁止');
 const sources={},failures=[];
 for(const cardId of plan.candidateIds){
  const row=plan.results.find(x=>x.cardId===cardId);
  try{
   const sourceText=await fetchDocument({
    cardId,sourceCommit:plan.primarySourceCommit,
    sourcePath:row.sourcePath,sourceBlobSha:row.sourceBlobSha
   });
   if(typeof sourceText!=='string'||sourceText.length<1||
      Buffer.byteLength(sourceText,'utf8')>4*1024*1024)
    throw Error('empty-or-oversize-source');
   sources[cardId]=sourceText;
  }catch{
   failures.push(cardId);
   // Source was listed in the tree, but GET failed. Retry tomorrow.
  }
 }
 const stage=stageDerivedGitHubNewCards({
  discovery,existingCatalog,sourcePlan:plan,sourceDocuments:sources,
  skillText,skillRevision,pendingCardIds});
 const ledger=reconcilePendingLedger({
  previous:previousLedger,discovery,sourcePlan:plan,stage,existingCatalog});
 return {ledger,summary:{
  previousRosterCount:discovery.previousRosterCount,
  currentRosterCount:discovery.currentRosterCount,
  discoveredNewCardIds:discovery.addedCardIds,
  sourceCommit:plan.primarySourceCommit,sourceTreeSha:plan.sourceTreeSha,
  independentlyPinnedSkillCommit:skillRevision,
  catalogAlreadyImportedIds:stage.stage.alreadyImportedIds,
  missingSourceIds:plan.waitingIds,
  fetchFailedIds:failures,
  pendingCards:ledger.cards.length,
  states:Object.fromEntries([...new Set(ledger.cards.map(x=>x.status))].sort()
   .map(status=>[status,ledger.cards.filter(x=>x.status===status).length])),
  reviewIssues:ledger.cards.reduce((n,x)=>n+x.reviewItems.length,0),
  sourceProseIncluded:false,publicationApproved:false,
  existingDatabaseUnchanged:true}};
}
module.exports={refresh};
