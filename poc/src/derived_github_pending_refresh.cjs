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
function pendingTargetIds({discovery,previousLedger=emptyLedger(),existingCatalog}={}){
 verifyLedger(previousLedger);
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.schemaVersion!==1||discovery.publicationApproved!==false||
    !Array.isArray(discovery.addedCardIds)||
    !Array.isArray(discovery.existingCardIds)||
    existingCatalog?.schemaVersion!==1||
    !Array.isArray(existingCatalog.cards))fail('UmaSim名簿／公開イベントDBが不正');
 const current=new Set([...discovery.addedCardIds,...discovery.existingCardIds]);
 const imported=new Set(existingCatalog.cards.map(c=>c.cardId));
 if([...imported].some(x=>!current.has(x))||
    previousLedger.cards.some(x=>!current.has(x.cardId))||
    imported.size!==existingCatalog.cards.length)
  fail('現行UmaSim名簿・収録済み・保留カードの対応不正');
 return [...new Set([...discovery.addedCardIds,
   ...previousLedger.cards.map(x=>x.cardId)])]
  .filter(id=>!imported.has(id)).sort();
}
function planRosterFirst({previousRosterText,currentRosterText,
 previousLedger=emptyLedger(),existingCatalog}={}){
 verifyLedger(previousLedger);
 if(typeof previousRosterText!=='string'||
    gitBlobSha(previousRosterText)!==POLICY.beforeBlob||
    BASELINE!==POLICY.beforeCommit)
  fail('元となる563枚UmaSim名簿のGit blobが固定版と異なる');
 const discovery=discoverNewCardsFromUmaSim({
  previousSupportText:previousRosterText,
  currentSupportText:currentRosterText});
 const targetIds=pendingTargetIds({discovery,previousLedger,existingCatalog});
 return {discovery,targetIds,needThirdPartySource:targetIds.length>0,
  originalLedger:previousLedger};
}
async function refresh({
 previousRosterText,currentRosterText,skillText,skillRevision,
 sourceTree,sourceCommit,existingCatalog,previousLedger=emptyLedger(),
 fetchDocument,maxTargetCards=40
}={}){
 const preflight=planRosterFirst({previousRosterText,currentRosterText,
  previousLedger,existingCatalog});
 if(!preflight.needThirdPartySource)
  fail('未対応サポカ0枚。第三者イベントDBにはアクセス不要');
 if(typeof skillText!=='string'||!SHA.test(skillRevision||'')||
    typeof fetchDocument!=='function'||
    !Number.isSafeInteger(maxTargetCards)||maxTargetCards<1||
    maxTargetCards>100)
  fail('独立スキル出典／取得関数／上限の指定が不正');
 const discovery=preflight.discovery;
 const pendingCardIds=previousLedger.cards.map(x=>x.cardId);
 const plan=planDerivedNewCardIntake({
  discovery,existingCatalog,pendingCardIds,sourceTree,sourceCommit});
 if(plan.candidateIds.length>maxTargetCards||
    plan.targetIds.length>maxTargetCards)
  fail('対象新カード数が上限超過。無制限の外部データ取得は禁止');
 const oldById=new Map(previousLedger.cards.map(x=>[x.cardId,x]));
 const reusedUnchangedCardIds=plan.candidateIds.filter(id=>{
  const old=oldById.get(id),newSource=plan.results.find(x=>x.cardId===id);
  return !!old&&
   ['awaiting-review','awaiting-source-resolution'].includes(old.status)&&
   old.sourceBlobSha===newSource.sourceBlobSha;
 });
 const reusedSet=new Set(reusedUnchangedCardIds);
 const sources={},failures=[];
 for(const cardId of plan.candidateIds){
  if(reusedSet.has(cardId))continue;
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
  previous:previousLedger,discovery,sourcePlan:plan,stage,existingCatalog,
  reusedUnchangedCardIds});
 return {ledger,summary:{
  previousRosterCount:discovery.previousRosterCount,
  currentRosterCount:discovery.currentRosterCount,
  discoveredNewCardIds:discovery.addedCardIds,
  sourceCommit:plan.primarySourceCommit,sourceTreeSha:plan.sourceTreeSha,
  independentlyPinnedSkillCommit:skillRevision,
  catalogAlreadyImportedIds:stage.stage.alreadyImportedIds,
  missingSourceIds:plan.waitingIds,
  fetchFailedIds:failures,
  reusedUnchangedCardIds,
  fetchedEventCardIds:Object.keys(sources).sort(),
  pendingCards:ledger.cards.length,
  states:Object.fromEntries([...new Set(ledger.cards.map(x=>x.status))].sort()
   .map(status=>[status,ledger.cards.filter(x=>x.status===status).length])),
  reviewIssues:ledger.cards.reduce((n,x)=>n+x.reviewItems.length,0),
  sourceProseIncluded:false,publicationApproved:false,
  existingDatabaseUnchanged:true}};
}
module.exports={refresh,planRosterFirst,pendingTargetIds};
