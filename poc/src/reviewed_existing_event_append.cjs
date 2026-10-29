'use strict';
/*
 * One narrow PUBLICATION REHEARSAL for existing UmaSim cards whose event
 * candidates were already editorially prepared (not new-card discovery).
 * NEVER grants approval or writes to the public catalog. A caller must
 * supply exact event-by-event HUMAN decisions. No source text is fetched.
 *
 * New-card admission stays in new_card_event_incremental.cjs; do not route
 * existing 563 cards through a fake "new" roster difference.
 */
const {verifyRelease,digest,canonical}=require('./event_release_gate.cjs');
const {preflight}=require('./public_event_catalog.js');
const fail=m=>{throw Error('既存カード実イベント初回公開リハーサル: '+m);};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const key=(c,e)=>JSON.stringify([c,e]);
const REVIEW=['card','event','choices','outcomes','dependencies','publication'];
const APPROVAL_FIELDS=['cardId','eventId','eventSha256','reviewer',
 'reviewedAt','checks','evidence','publicationBasis'];
function validatePacket(packet){
 if(!isObj(packet)||packet.status!=='NOT_APPROVED_FOR_PUBLICATION'||
    packet.sourceNarrativeOrChoiceProseIncluded!==false||
    packet.generatedFromReviewedFacts!==true||
    !Array.isArray(packet.catalog?.cards)||
    !Array.isArray(packet.approvalWorksheet?.entries)||
    packet.approvalWorksheet.schemaVersion!==1)
  fail('取得元が固定された非公開の編集候補・未署名審査票が必要');
 const events=new Map(),reviews=new Map();
 for(const c of packet.catalog.cards){
  if(!/^\d{5}$/.test(c.cardId)||c.coverageStatus!=='partial'||
     !Array.isArray(c.events))fail('候補カードと部分収録状態が不正');
  for(const e of c.events){
   const k=key(c.cardId,e.id);
   if(events.has(k)||!e.id||typeof e.id!=='string')
    fail('候補イベント重複');
   events.set(k,{card:c,event:e,digest:digest(e)});
  }
 }
 for(const row of packet.approvalWorksheet.entries){
  const k=key(row.cardId,row.eventId);
  if(reviews.has(k)||!events.has(k)||row.eventSha256!==events.get(k).digest||
     row.status!=='PENDING_HUMAN_RELEASE_REVIEW'||
     row.reviewer!==null||row.reviewedAt!==null||
     row.publicationBasis!==null||
     !isObj(row.checks)||REVIEW.some(f=>row.checks[f]!==false)||
     !isObj(row.evidence)||!Array.isArray(row.evidence.publication)||
     row.evidence.publication.length!==0)
    fail('候補と未署名の審査票が一致しない');
  reviews.set(k,row);
 }
 if(!events.size||reviews.size!==events.size)
  fail('非公開候補と要審査イベントの位置が不一致');
 return {events,reviews};
}
function rehearseApprovedExistingEvents({
 packet,decisions,existingCatalog,existingApprovals,model,skillText
}={}){
 const {events}=validatePacket(packet);
 if(!isObj(decisions)||decisions.schemaVersion!==1||
    !Array.isArray(decisions.entries)||
    !isObj(existingCatalog)||!isObj(existingApprovals)||
    !isObj(model)||!isObj(model.cardById)||!isObj(model.skillById))
  fail('承認判断・既存公開DB・スキルモデルが不正');
 verifyRelease(existingCatalog,existingApprovals);
 // Verify baseline read-only, even if the specific chosen event is unrelated.
 preflight(model,existingCatalog,{skillText});
 const oldCatalog=canonical(existingCatalog),oldApprovals=canonical(existingApprovals);
 const previous=new Map(),priorApproval=new Map();
 for(const c of existingCatalog.cards)for(const e of c.events)
  previous.set(key(c.cardId,e.id),digest(e));
 for(const a of existingApprovals.entries)
  priorApproval.set(key(a.cardId,a.eventId),a);
 const decisionsByKey=new Map();
 for(const a of decisions.entries){
  if(!isObj(a)||Object.keys(a).some(k=>!APPROVAL_FIELDS.includes(k))||
     APPROVAL_FIELDS.some(k=>!Object.hasOwn(a,k))||
     typeof a.cardId!=='string'||typeof a.eventId!=='string')
   fail('レビューの必須項目／公開禁止フィールドが不正');
  const k=key(a.cardId,a.eventId),source=events.get(k);
  if(!source||decisionsByKey.has(k)||a.eventSha256!==source.digest)
   fail('未照合の候補または不一致SHAを承認しようとした');
  // All six checks and evidence are checked again on the combined catalog.
  decisionsByKey.set(k,a);
 }
 if(decisionsByKey.size===0)
  return {status:'pending-human-approval',approvedNewEvents:0,
   pendingReviewEvents:events.size,existingDatabaseUnchanged:true,
   catalog:null,approvals:null};
 const newBlocks=new Map(),newApprovalEntries=[],addedKeys=[];
 for(const sourceCard of packet.catalog.cards){
  for(const event of sourceCard.events){
   const k=key(sourceCard.cardId,event.id),decision=decisionsByKey.get(k);
   if(!decision)continue;
   if(previous.has(k)){
    if(previous.get(k)!==digest(event)||
       canonical(priorApproval.get(k))!==canonical(decision))
     fail('既存収録イベントまたは承認内容の上書きは禁止');
    continue; // Idempotent replay of an EXACT existing approval.
   }
   if(!newBlocks.has(sourceCard.cardId))newBlocks.set(sourceCard.cardId,[]);
   newBlocks.get(sourceCard.cardId).push(copy(event));
   newApprovalEntries.push(copy(decision));addedKeys.push(k);
  }
 }
 const catalog=copy(existingCatalog),approvals=copy(existingApprovals);
 const existingIds=new Set(catalog.cards.map(c=>c.cardId));
 for(const card of catalog.cards){
  if(newBlocks.has(card.cardId)){
   if(card.coverageStatus!=='partial')
    fail('独立に全件確認できない既存カードは変更しない');
   card.events.push(...newBlocks.get(card.cardId));
  }
 }
 for(const card of packet.catalog.cards){
  if(newBlocks.has(card.cardId)&&!existingIds.has(card.cardId)){
   catalog.cards.push({cardId:card.cardId,coverageStatus:'partial',
    events:newBlocks.get(card.cardId)});
  }
 }
 approvals.entries.push(...newApprovalEntries);
 // A staged set must be a complete, legal, structurally resolvable public
 // event catalog, with a real explicit human review for every event.
 const prepared=preflight(model,catalog,{skillText});
 const release=verifyRelease(catalog,approvals);
 if(canonical(existingCatalog)!==oldCatalog||
    canonical(existingApprovals)!==oldApprovals||
    canonical(catalog.cards.slice(0,0))!=='[]'||
    canonical(approvals.entries.slice(0,existingApprovals.entries.length))!==
      canonical(existingApprovals.entries))
  fail('元の承認証跡や公開DB入力に変更が生じた');
 // For every pre-existing event, its entire object must remain identical.
 for(const original of existingCatalog.cards){
  const current=catalog.cards.find(c=>c.cardId===original.cardId);
  if(!current||current.events.length<original.events.length||
     canonical(current.events.slice(0,original.events.length))!==
       canonical(original.events))
   fail('既存イベント内容・順序の変造');
 }
 return {status:addedKeys.length?'ready-for-explicit-publication':'unchanged',
  approvedNewEvents:addedKeys.length,
  pendingReviewEvents:events.size-decisionsByKey.size,
  addedEventKeys:addedKeys,
  catalog,approvals,existingDatabaseUnchanged:true,
  release,loader:{cards:prepared.summary.cardsWithRecords,
   events:prepared.summary.eventsWithRecords}};
}
module.exports={validatePacket,rehearseApprovedExistingEvents};
