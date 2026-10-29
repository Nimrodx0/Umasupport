'use strict';
/*
 * Incremental new-card admission:
 * - Discover NEW UmaSim support IDs from previous/current complete rosters.
 * - Stage only card-scoped GameTora-original-site normalized event candidates.
 * - Append approved NEW cards to an existing event catalog, byte-equivalent
 *   for all old card/event objects, and validate the combined result BEFORE
 *   allowing any writer to persist it.
 *
 * A GameTora observation is not an approval. This module does not fetch,
 * scrape, grant rights, update a source pin, overwrite files, or publish.
 */
const {validateCatalog}=require('./event_schema.js');
const {verifyRelease,canonical}=require('./event_release_gate.cjs');
const fail=s=>{throw Error('新サポカイベント増分取り込み: '+s);};
const cardId=id=>typeof id==='string'&&/^[1-9]\d{4}$/.test(id);
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
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
function checkCandidate(c,id){
 if(!plain(c)||c.cardId!==id||
    c.source!=='GameTora-original-site'||
    c.sourceSiteTextCopied!==false||
    c.publicationApproved!==false||c.appEventSchemaAdoptable!==false||
    !Array.isArray(c.events)||
    !Number.isSafeInteger(c.siteEventPanelCount)||c.siteEventPanelCount<1||
    !Number.isSafeInteger(c.convertedEventCount)||c.convertedEventCount<0||
    !Number.isSafeInteger(c.unresolvedEventCount)||c.unresolvedEventCount<0||
    c.siteEventPanelCount!==c.convertedEventCount+c.unresolvedEventCount||
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
function stageNewCardEvents({discovery,existingCatalog,candidates}={}){
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.schemaVersion!==1||
    discovery.publicationApproved!==false||
    !plain(existingCatalog)||existingCatalog.schemaVersion!==1||
    !Array.isArray(existingCatalog.cards)||!Array.isArray(candidates))
  fail('増分候補の名簿・既存DBが不正');
 const added=ids(discovery.addedCardIds,'追加対象');
 const known=ids(discovery.existingCardIds,'既存名簿');
 const already=ids(existingCatalog.cards.map(x=>x?.cardId),'既存DB');
 const knownSet=new Set(known),existingSet=new Set(already);
 if(already.some(x=>!knownSet.has(x)))
  fail('既存DBカードIDが基準名簿にありません');
 const seen=new Set();
 const byId=new Map();
 for(const c of candidates){
  if(!cardId(c?.cardId)||seen.has(c.cardId))fail('追加候補に不正／重複カードID');
  seen.add(c.cardId);
  byId.set(c.cardId,c);
  if(!added.includes(c.cardId)||existingSet.has(c.cardId))
   fail('既存カードの置換・追加対象外の混入は禁止: '+c.cardId);
 }
 const pending=[],ready=[];
 for(const id of added){
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
  discoveredNewIds:[...added],pending,
  ready,
  // Stage is never itself an approved public catalog.
  existingCardCount:already.length,
  existingCatalogShaCanonical:canonical(existingCatalog),
  publicationApproved:false,appEventSchemaAdoptable:false
 };
}
function appendApprovedNewCards({
 discovery,existingCatalog,candidates,existingApprovals,
 newApprovals,model
}={}){
 const stage=stageNewCardEvents({discovery,existingCatalog,candidates});
 if(!plain(existingApprovals)||existingApprovals.schemaVersion!==1||
    !Array.isArray(existingApprovals.entries)||
    !plain(newApprovals)||newApprovals.schemaVersion!==1||
    !Array.isArray(newApprovals.entries))
  fail('既存と新規の公開承認証跡が必要');
 if(stage.pending.length)
  return {status:'pending',newCardIds:stage.discoveredNewIds,
   pending:stage.pending,existingCatalogUnchanged:true,
   catalog:null,approvals:null};
 if(!stage.ready.length){
  if(newApprovals.entries.length)fail('追加対象なしで新規承認証跡が存在する');
  validateCatalog(existingCatalog,model);
  verifyRelease(existingCatalog,existingApprovals);
  return {status:'unchanged',newCardIds:[],existingCatalogUnchanged:true,
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
 validateCatalog(merged,model);
 verifyRelease(merged,approvals);
 if(canonical(existingCatalog)!==stage.existingCatalogShaCanonical||
    canonical(merged.cards.slice(0,existingCatalog.cards.length))!==
    canonical(existingCatalog.cards)||
    canonical(approvals.entries.slice(0,existingApprovals.entries.length))!==
    canonical(existingApprovals.entries))
  fail('既存DBまたは承認履歴に変更が生じました');
 return {status:'ready-to-append',newCardIds:stage.discoveredNewIds,
  appendedCardCount:stage.ready.length,
  appendedEventCount:expectedCount,
  existingCatalogUnchanged:true,
  catalog:merged,approvals};
}
module.exports={discoverNewCards,stageNewCardEvents,appendApprovedNewCards};
