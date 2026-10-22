/* Local release preflight. This does not grant copyright permission or
 * verify game facts. It enforces a human-review evidence record for EVERY
 * published event and detects alterations after review. No external GET. */
'use strict';
const crypto=require('node:crypto');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const fail=msg=>{throw new Error('イベント公開ゲート: '+msg);};
const FIELDS=['card','event','choices','outcomes','dependencies','publication'];
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function digest(event){
 if(!obj(event))fail('イベントの形式が不正');
 return crypto.createHash('sha256').update(canonical(event)).digest('hex');
}
function secureUrl(raw){
 if(!nonempty(raw))return false;
 try{
  const u=new URL(raw);
  return u.protocol==='https:'&&nonempty(u.hostname)&&!u.username&&!u.password;
 }catch{return false;}
}
const QUARANTINE_FIELDS=new Set([
 'unresolvedRewards','noAutomaticRuntimeAdoption','editorialCandidate',
 'manualStageAssertionOnly','possibleOnly','chainPrerequisitesVerified',
 'priorStageDependenceVerified','game2026Verified','currentGameplayVerified',
 'publicationApproved','releaseReady','unresolvedRequiredFacts',
 'sourceKind','provisionalCatalog'
]);
function hasDraftOnlyFacts(value){
 if(Array.isArray(value))return value.some(hasDraftOnlyFacts);
 if(!obj(value))return false;
 if(Object.keys(value).some(key=>QUARANTINE_FIELDS.has(key)))return true;
 return Object.values(value).some(hasDraftOnlyFacts);
}
function verifyRelease(catalog,approvals){
 if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail('公開カタログが不正');
 if(!obj(approvals)||approvals.schemaVersion!==1||!Array.isArray(approvals.entries))
  fail('レビュー証跡が不正');
 const published=new Map(),seenCards=new Set();
 for(const card of catalog.cards){
  if(!obj(card)||!nonempty(card.cardId)||seenCards.has(card.cardId)||
     !Array.isArray(card.events))fail('カード・イベント配列の形式が不正');
  if(card.coverageStatus!==undefined&&card.coverageStatus!=='partial')
   fail('全件性の独立確認なしにcompleteは公開できません: '+card.cardId);
  seenCards.add(card.cardId);
  for(const event of card.events){
   if(!obj(event)||!nonempty(event.id))fail('イベントIDが不正');
   if(hasDraftOnlyFacts(event))fail('未照合報酬の草稿は公開できません');
   const key=JSON.stringify([card.cardId,event.id]);
   if(published.has(key))fail('公開イベントIDが重複');
   published.set(key,digest(event));
  }
 }
 const reviewed=new Set();
 for(const item of approvals.entries){
  if(!obj(item)||!nonempty(item.cardId)||!nonempty(item.eventId))
   fail('レビュー対象IDが不正');
  const key=JSON.stringify([item.cardId,item.eventId]);
  if(reviewed.has(key))fail('レビューの重複: '+key);
  reviewed.add(key);
  if(!published.has(key))fail('公開イベントに存在しないレビュー: '+key);
  if(!/^[a-f0-9]{64}$/.test(item.eventSha256||'')||
     item.eventSha256!==published.get(key))
   fail('承認後のイベント内容変更またはSHA不一致: '+key);
  if(!nonempty(item.reviewer)||!nonempty(item.reviewedAt)||
     !/^\d{4}-\d{2}-\d{2}$/.test(item.reviewedAt)||
     !Number.isFinite(Date.parse(item.reviewedAt+'T00:00:00Z')))
   fail('レビュー者または確認日が不正: '+key);
  if(!obj(item.checks)||FIELDS.some(f=>item.checks[f]!==true))
   fail('ID・分岐・結果・条件・公開可否の人手承認が不足: '+key);
  if(!obj(item.evidence)||FIELDS.some(f=>!Array.isArray(item.evidence[f])||
      item.evidence[f].length===0||item.evidence[f].some(url=>!secureUrl(url))))
   fail('根拠URLが不足または不正: '+key);
  if(!obj(item.publicationBasis)||
     !['permission','open-license','original-factual-description'].includes(item.publicationBasis.kind)||
     !nonempty(item.publicationBasis.reason))
   fail('公開利用の根拠・判断が不足: '+key);
 }
 for(const key of published.keys()){
  if(!reviewed.has(key))fail('公開イベントに承認証跡がありません: '+key);
 }
 return {publicCards:seenCards.size,publicEvents:published.size,reviewedEvents:reviewed.size};
}
module.exports={verifyRelease,digest,canonical};
