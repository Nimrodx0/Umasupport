'use strict';
/*
 * Incremental new-card admission:
 * - Discover NEW UmaSim support IDs from previous/current complete rosters.
 * - Stage version-pinned structured GitHub candidates alongside legacy site drafts.
 * - Append approved NEW cards to an existing event catalog, byte-equivalent
 *   for all old card/event objects, and validate the combined result BEFORE
 *   allowing any writer to persist it.
 *
 * A GameTora observation is not an approval. This module does not fetch,
 * scrape, grant rights, update a source pin, overwrite files, or publish.
 */
const crypto=require('node:crypto');
const {preflight}=require('./public_event_catalog.js');
const {parseSupportCards}=require('./live_loader.js');
const {verifyRelease,canonical}=require('./event_release_gate.cjs');
const fail=s=>{throw Error('新サポカイベント増分取り込み: '+s);};
const cardId=id=>typeof id==='string'&&/^[1-9]\d{4}$/.test(id);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const sha256=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
function ids(input,label){
 if(!Array.isArray(input)||input.some(x=>!cardId(x))||
    new Set(input).size!==input.length)
  fail(label+'カードIDが不正・重複');
 return input;
}
function discoverNewCards({previousRosterIds,currentRosterIds}={}){
 const old=ids(previousRosterIds,'旧名簿'),now=ids(currentRosterIds,'現行名簿');
 // A partial roster read must not silently be interpreted as a mass deletion.
 const prev=new Set(old),curr=new Set(now);
 if(!prev.size||!curr.size)fail('名簿が空で差分を判定できません');
 const removed=old.filter(x=>!curr.has(x)).sort();
 if(removed.length)fail('現行名簿で旧カードが消滅、全件取得の確認が必要');
 return {
  dataKind:'new-umamusume-support-card-ids',schemaVersion:1,
  previousRosterCount:old.length,currentRosterCount:now.length,
  addedCardIds:now.filter(x=>!prev.has(x)).sort(),
  existingCardIds:old.slice().sort(),
  sourceEventFactsVerified:false,publicationApproved:false
 };
}
function discoverNewCardsFromUmaSim({previousSupportText,currentSupportText}={}){
 const previous=parseSupportCards(previousSupportText);
 const current=parseSupportCards(currentSupportText);
 const delta=discoverNewCards({
  previousRosterIds:[...previous.cards.keys()],
  currentRosterIds:[...current.cards.keys()]
 });
 return {...delta,source:'UmaSim-support_card.txt',
  previousRosterStageRows:previous.lines,currentRosterStageRows:current.lines};
}
function checkCandidate(c,id,derivedSourcePlan){
 const derived=c?.source==='GameTora-derived-GitHub';
 if(derived){
  const matches=derivedSourcePlan?.results?.filter(x=>x.cardId===id);
  if(derivedSourcePlan?.dataKind!=='derived-github-new-card-source-plan'||
     derivedSourcePlan.version!==1||
     derivedSourcePlan.primarySourceRepository!=='systemless10/UmamusumePS'||
     derivedSourcePlan.publicationApproved!==false||
     !/^[a-f0-9]{40}$/.test(derivedSourcePlan.primarySourceCommit||'')||
     !Array.isArray(matches)||matches.length!==1||
     matches[0].status!=='source-blob-present-needs-validation'||
     c.sourceRevision!==derivedSourcePlan.primarySourceCommit||
     c.sourceBlobSha!==matches[0].sourceBlobSha||
     c.sourcePath!==matches[0].sourcePath||
     c.sourcePath!=='server/data/events/gametora/support_'+id+'.json')
   fail('固定GitHub出典と対象カード候補が不一致: '+id);
 }
 if(!plain(c)||c.cardId!==id||
    !(c.source==='GameTora-original-site'||derived)||
    c.sourceSiteTextCopied!==false||
    c.publicationApproved!==false||c.appEventSchemaAdoptable!==false||
    !Array.isArray(c.events)||
    (derived?(!Number.isSafeInteger(c.sourceEventCount)||c.sourceEventCount<1):
      (!Number.isSafeInteger(c.siteEventPanelCount)||c.siteEventPanelCount<1))||
    !Number.isSafeInteger(c.convertedEventCount)||c.convertedEventCount<0||
    !Number.isSafeInteger(c.unresolvedEventCount)||c.unresolvedEventCount<0||
    (derived?c.sourceEventCount!==c.convertedEventCount+c.unresolvedEventCount:
      c.siteEventPanelCount!==c.convertedEventCount+c.unresolvedEventCount)||
    c.convertedEventCount!==c.events.length)
  fail('GameTora元サイトカード別入力・件数・非公開フラグが不正: '+id);
 if(c.unresolvedEventCount||!c.events.length)return 'unresolved';
 const events=new Set();
 for(const e of c.events){
  if(!plain(e)||typeof e.id!=='string'||!e.id||
     events.has(e.id)||!['choice','auto'].includes(e.type)||
     typeof e.name!=='string'||!e.name)
   fail('新カードのイベント識別子が不正／重複: '+id);
  events.add(e.id);
 }
 return 'complete';
}
function stageNewCardEvents({
 discovery,existingCatalog,candidates,pendingCardIds=[]
}={}){
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.schemaVersion!==1||
    discovery.publicationApproved!==false||
    !plain(existingCatalog)||existingCatalog.schemaVersion!==1||
    !Array.isArray(existingCatalog.cards)||!Array.isArray(candidates))
  fail('増分候補の名簿・既存DBが不正');
 const added=ids(discovery.addedCardIds,'追加対象');
 const known=ids(discovery.existingCardIds,'既存名簿');
 const pendingFromPreviousRun=ids(pendingCardIds,'前回未取込');
 const already=ids(existingCatalog.cards.map(x=>x?.cardId),'既存DB');
 const rosterSet=new Set([...known,...added]),existingSet=new Set(already);
 if(added.some(x=>known.includes(x))||
    already.some(x=>!rosterSet.has(x))||
    pendingFromPreviousRun.some(x=>!rosterSet.has(x)))
  fail('今回の新カード候補・前回保留と現行UmaSim名簿が不一致');
 // New support cards remain eligible on later runs even if yesterday's
 // "new ID" roster difference becomes empty. Persist the unresolved queue
 // separately. An already imported card must NOT be offered to the converter
 // again simply because a fixed historical roster pin is still in use.
 const targetIds=[...new Set([...added,...pendingFromPreviousRun])]
  .filter(x=>!existingSet.has(x)).sort();
 const addedSet=new Set(targetIds);
 const seen=new Set();
 const byId=new Map();
 for(const c of candidates){
  if(!cardId(c?.cardId)||seen.has(c.cardId))fail('追加候補に不正／重複カードID');
  seen.add(c.cardId);
  byId.set(c.cardId,c);
  if(!addedSet.has(c.cardId))
   fail('既存カードの置換・追加対象外の混入は禁止: '+c.cardId);
 }
 const pending=[],ready=[];
 for(const id of targetIds){
  const candidate=byId.get(id);
  if(!candidate){
   pending.push({cardId:id,reason:'not-yet-fetched'});
   continue;
  }
  if(checkCandidate(candidate,id)==='unresolved'){
   pending.push({cardId:id,reason:'gametora-source-unresolved',
    sourceEventPanelCount:candidate.siteEventPanelCount,
    unresolvedEventCount:candidate.unresolvedEventCount});
  }else{
   ready.push({cardId:id,coverageStatus:'partial',events:clone(candidate.events)});
  }
 }
 return {
  dataKind:'new-card-event-append-stage',schemaVersion:1,
  discoveredNewIds:[...added],
  targetNewIds:targetIds,
  alreadyImportedIds:added.filter(x=>existingSet.has(x)),
  pending,ready,
  // Stage is never itself an approved public catalog.
  existingCardCount:already.length,
  existingCatalogDigest:sha256(existingCatalog),
  publicationApproved:false,appEventSchemaAdoptable:false
 };
}
function appendApprovedNewCards({
 discovery,existingCatalog,candidates,existingApprovals,
 newApprovals,model,skillText=null,pendingCardIds=[]
}={}){
 const stage=stageNewCardEvents({discovery,existingCatalog,candidates,pendingCardIds});
 if(!plain(existingApprovals)||existingApprovals.schemaVersion!==1||
    !Array.isArray(existingApprovals.entries)||
    !plain(newApprovals)||newApprovals.schemaVersion!==1||
    !Array.isArray(newApprovals.entries))
  fail('既存と新規の公開承認証跡が必要');
 if(stage.pending.length&&!stage.ready.length)
  return {status:'pending',newCardIds:stage.targetNewIds,
   pending:stage.pending,existingCatalogUnchanged:true,
   catalog:null,approvals:null};
 if(!stage.ready.length){
  if(newApprovals.entries.length)fail('追加対象なしで新規承認証跡が存在する');
  preflight(model,existingCatalog,{skillText,fullRegistry:false});
  verifyRelease(existingCatalog,existingApprovals);
  return {status:'unchanged',newCardIds:[],pending:[],existingCatalogUnchanged:true,
   catalog:clone(existingCatalog),approvals:clone(existingApprovals)};
 }
 const readyIds=new Set(stage.ready.map(x=>x.cardId));
 const approvalEvents=new Set();
 for(const item of newApprovals.entries){
  if(!readyIds.has(item?.cardId))fail('新カード以外の公開承認は今回追加できない');
  const key=item.cardId+':'+item.eventId;
  if(approvalEvents.has(key))fail('追加承認証跡が重複');
  approvalEvents.add(key);
 }
 const expectedCount=stage.ready.reduce((n,c)=>n+c.events.length,0);
 if(newApprovals.entries.length!==expectedCount)
  fail('新カードの全イベントの個別公開承認が不足');
 // No existing cards/approvals may be modified, even if order or JSON
 // serialization changes. Append the new card blocks at the very end.
 const merged={...clone(existingCatalog),
  cards:[...clone(existingCatalog.cards),...clone(stage.ready)]};
 const approvals={...clone(existingApprovals),
  entries:[...clone(existingApprovals.entries),...clone(newApprovals.entries)]};
 // Validate both content and per-event human evidence before returning.
 // No mutation, no file writes, no silent fallback on error.
 preflight(model,merged,{skillText,fullRegistry:false});
 verifyRelease(merged,approvals);
 if(sha256(existingCatalog)!==stage.existingCatalogDigest||
    canonical(merged.cards.slice(0,existingCatalog.cards.length))!==
    canonical(existingCatalog.cards)||
    canonical(approvals.entries.slice(0,existingApprovals.entries.length))!==
    canonical(existingApprovals.entries))
  fail('既存DBまたは承認履歴に変更が生じました');
 return {status:stage.pending.length?'partial-append':'ready-to-append',
  newCardIds:stage.ready.map(x=>x.cardId),
  pending:stage.pending,
  appendedCardCount:stage.ready.length,
  appendedEventCount:expectedCount,
  existingCatalogUnchanged:true,
  catalog:merged,approvals};
}
module.exports={discoverNewCards,discoverNewCardsFromUmaSim,
 stageNewCardEvents,appendApprovedNewCards};
