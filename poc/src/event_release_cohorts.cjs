'use strict';
/*
 * Alternative, EXPLICIT version-2 review ledger. Unlike the historical
 * event-by-event ledger, an evidence-backed decision may cover one source
 * cohort with exact, content-bound membership. This is NOT an automatic
 * permission/license finding. Any missing, changed, or unmatched event fails.
 *
 * No source data is fetched, stored or published by this module.
 */
const crypto=require('node:crypto');
const {canonical,digest,secureUrl,indexPublished}=require('./event_release_gate.cjs');
const fail=m=>{throw Error('イベント一括公開ゲート: '+m);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const hash=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
const CATEGORIES=['card','event','choices','outcomes','dependencies','publication'];
const RIGHTS=['sourceAccessTerms','databaseReuse','gameMaterialAndTitles','choiceWording'];
const CHECKS=[...CATEGORIES,...RIGHTS];
const BASIS=['permission','open-license','original-factual-description'];
const ACCESS=['reviewed-no-new-access','authorized-access'];
const SOURCE_REV=/^(?:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/;
const exact=(input,allowed,where)=>{
 if(!obj(input)||Object.keys(input).some(k=>!allowed.includes(k)))
  fail(where+': 未定義フィールドまたは形式');
};
function secureUrlArray(value,where){
 if(!Array.isArray(value)||value.length===0||
   value.some(v=>!secureUrl(v))||new Set(value).size!==value.length)
  fail(where+': 根拠URL未確認');
}
function matched(key,p){
 const [cardId,eventId]=JSON.parse(key);
 return eventId.startsWith(p.eventIdPrefix)&&
  (!p.cardIds||p.cardIds.includes(cardId));
}
function inventory(catalog,selectors){
 const indexed=indexPublished(catalog),keys=[...indexed.keys()];
 const used=new Set(),groups=[];
 for(const selector of selectors){
  exact(selector,['eventIdPrefix','cardIds','excludedEventKeys'],'適用範囲');
  if(typeof selector.eventIdPrefix!=='string'||
    !/^[a-z][a-z0-9:-]{2,49}$/u.test(selector.eventIdPrefix))
   fail('空または広すぎるイベントID接頭辞');
  if(selector.cardIds!==undefined&&(!Array.isArray(selector.cardIds)||
     !selector.cardIds.length||selector.cardIds.some(x=>!nonempty(x))||
     new Set(selector.cardIds).size!==selector.cardIds.length))
   fail('カードID範囲が不正');
  const excluded=new Set();
  if(selector.excludedEventKeys!==undefined){
   if(!Array.isArray(selector.excludedEventKeys)||!selector.excludedEventKeys.length)
    fail('除外するイベントID一覧が不正');
   for(const x of selector.excludedEventKeys){
    exact(x,['cardId','eventId'],'除外イベントID');
    if(!nonempty(x.cardId)||!nonempty(x.eventId))
     fail('除外イベントIDの形式が不正');
    const k=JSON.stringify([x.cardId,x.eventId]);
    if(excluded.has(k)||!indexed.has(k)||!matched(k,selector))
     fail('除外対象が重複またはコホート外');
    excluded.add(k);
   }
  }
  const selected=keys.filter(k=>matched(k,selector)&&!excluded.has(k)).sort();
  if(!selected.length)fail('対象イベントが存在しない');
  for(const k of selected){
   if(used.has(k))fail('審査コホートが重複');
   used.add(k);
  }
  groups.push({
   events:selected.length,
   // Include card ID, event ID and exact canonical event hash. Sorting makes
   // the digest immune to record ordering but not to additions or edits.
   eventsSha256:hash(selected.map(k=>{
    const [cardId,eventId]=JSON.parse(k);
    return {cardId,eventId,eventSha256:indexed.get(k)};
   }))
  });
 }
 return {groups,matchedEvents:used.size,publishedEvents:keys.length,
  uncovered:keys.length-used.size,matchedKeys:used};
}
function checkReview(review,where){
 exact(review,['reviewer','reviewedAt','checks','evidence','publicationBasis',
  'sourceRevision','accessMethod'],where);
 if(!nonempty(review.reviewer)||
   !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt||'')||
   !Number.isFinite(Date.parse(review.reviewedAt+'T00:00:00Z'))||
   !SOURCE_REV.test(review.sourceRevision||'')||
   !ACCESS.includes(review.accessMethod))
  fail(where+': 審査者・日付・固定出典版・取得条件が不正');
 exact(review.checks,CHECKS,where+'/checks');
 exact(review.evidence,CHECKS,where+'/evidence');
 if(CHECKS.some(k=>review.checks[k]!==true))fail(where+': 出典・権利を含む一括人手審査が不足');
 for(const key of CHECKS)secureUrlArray(review.evidence[key],where+'/'+key);
 exact(review.publicationBasis,['kind','reason','scope'],where+'/publicationBasis');
 if(!BASIS.includes(review.publicationBasis.kind)||
   !nonempty(review.publicationBasis.reason)||
   !nonempty(review.publicationBasis.scope))
  fail(where+': 利用許諾／独自の事実利用根拠と範囲が不足');
}
function verifyCohortRelease(catalog,approvals){
 if(!obj(approvals)||approvals.schemaVersion!==2||
    !Array.isArray(approvals.cohorts)||!Array.isArray(approvals.entries)||
    Object.keys(approvals).some(k=>!['schemaVersion','cohorts','entries'].includes(k)))
  fail('一括承認台帳は明示的なv2形式が必要');
 // This uses the exact same quarantine and completeness checks as the
 // historical v1 release gate, not a second permissive event parser.
 const indexed=indexPublished(catalog);
 const selectors=[],seenIds=new Set();
 for(const [i,group] of approvals.cohorts.entries()){
  const where='cohort/'+i;
  exact(group,['id','selector','expectedEvents','eventsSha256','review'],where);
  if(!nonempty(group.id)||seenIds.has(group.id)||
     !Number.isSafeInteger(group.expectedEvents)||group.expectedEvents<1||
     !SHA.test(group.eventsSha256||''))
   fail(where+': 一括審査ID・件数・SHAが不正');
  seenIds.add(group.id);
  selectors.push(group.selector);
  checkReview(group.review,where);
 }
 // Validate individual entry membership BEFORE cohort fingerprint checks.
 // New, independently reviewed events can share an old cohort's source prefix,
 // but they must not silently expand that OLD content-bound approval.
 const individual=new Set();
 for(const item of approvals.entries){
  if(!obj(item)||!nonempty(item.cardId)||!nonempty(item.eventId))
   fail('個別例外レビュー形式が不正');
  const key=JSON.stringify([item.cardId,item.eventId]);
  if(!indexed.has(key)||individual.has(key))
   fail('個別例外レビューの重複／対象外');
  individual.add(key);
 }
 const blank=()=>({groups:[],matchedEvents:0,uncovered:indexed.size,matchedKeys:new Set()});
 let grouped=selectors.length?inventory(catalog,selectors):blank();
 const signed=(result,i)=>result.groups[i]?.events===approvals.cohorts[i].expectedEvents&&
  result.groups[i]?.eventsSha256===approvals.cohorts[i].eventsSha256;
 // The old signature is tried intact first. If it has grown, subtract ONLY
 // explicitly V1-reviewed entries from the effective selector in memory.
 // The stored cohort selector, hash, reviewer and historical approvals remain
 // byte-for-byte unchanged. An original cohort event moved into entries will
 // still break the old SHA because its card/event ID is part of the digest.
 if(selectors.length&&approvals.cohorts.some((_,i)=>!signed(grouped,i))){
  let changed=false;
  const effective=selectors.map((selector,i)=>{
   if(signed(grouped,i))return selector;
   const excluded=[...(selector.excludedEventKeys||[])];
   const seen=new Set(excluded.map(x=>JSON.stringify([x.cardId,x.eventId])));
   for(const key of individual){
    if(!matched(key,selector)||seen.has(key))continue;
    const [cardId,eventId]=JSON.parse(key);
    excluded.push({cardId,eventId});
    seen.add(key);
    changed=true;
   }
   return excluded.length?{...selector,excludedEventKeys:excluded}:selector;
  });
  if(changed)grouped=inventory(catalog,effective);
 }
 for(const [i,group] of approvals.cohorts.entries()){
  if(!signed(grouped,i))
   fail('コホート数／承認済みSHA不一致: '+group.id);
 }
 // A V1 entry cannot be used to replace any already cohort-covered event;
 // a separately SHA-reviewed new event or an explicitly excluded old event
 // must be accounted for exactly once.
 for(const key of individual){
  if(grouped.matchedKeys.has(key))
   fail('個別例外レビューと既存コホートが重複');
 }
 if(grouped.matchedEvents+individual.size!==indexed.size)
  fail('未承認のイベントが残っています');
 if(individual.size){
  const {verifyRelease}=require('./event_release_gate.cjs');
  const subset={schemaVersion:1,cards:catalog.cards.map(card=>({
   cardId:card.cardId,coverageStatus:card.coverageStatus,
   events:card.events.filter(event=>
    individual.has(JSON.stringify([card.cardId,event.id])))
  })).filter(card=>card.events.length)};
  // Call the original V1 gate, including all six per-exception checks.
  verifyRelease(subset,{schemaVersion:1,entries:approvals.entries});
 }
 return {publicCards:catalog.cards.length,publicEvents:indexed.size,
  reviewedEvents:indexed.size,reviewedCohorts:approvals.cohorts.length,
  reviewedIndividualExceptions:individual.size};
}
module.exports={inventory,verifyCohortRelease};
