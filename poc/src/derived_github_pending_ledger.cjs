'use strict';
/*
 * Persist only a metadata-only, machine-readable NEW-CARD pending register.
 * Source narratives, option texts, skill names and unapproved event catalogs
 * must never cross this boundary. A row is removed ONLY after it has appeared
 * in the existing approved catalog, not after a successful transformation.
 */
const BASELINE='91952973eb334ae530b8cd76541bce8a01a141cd';
const SOURCE='systemless10/UmamusumePS';
const SHA=/^[a-f0-9]{40}$/;
const ID=/^[1-9]\d{4}$/;
const REASON=/^[A-Za-z][A-Za-z0-9_-]{0,100}$/;
const fail=x=>{throw Error('新カード未取込保留台帳: '+x);};
const STATUS=new Set(['awaiting-source-json','awaiting-source-download',
 'awaiting-source-validation','awaiting-source-resolution','awaiting-review']);
const PENDING=new Map([
 ['derived-github-json-not-yet-published','awaiting-source-json'],
 ['derived-github-source-not-fetched','awaiting-source-download'],
 ['derived-github-card-validation-failed','awaiting-source-validation'],
 ['derived-github-source-unresolved','awaiting-source-resolution']
]);
const id=x=>typeof x==='string'&&ID.test(x);
const sha=x=>typeof x==='string'&&SHA.test(x);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const unique=(arr)=>new Set(arr).size===arr.length;
const cmp=(a,b)=>a.localeCompare(b,'en');
function verifyReview(x){
 if(!obj(x)||!Number.isSafeInteger(x.sourceOrdinal)||x.sourceOrdinal<1||
    typeof x.reason!=='string'||!REASON.test(x.reason)||
    !['source-normalization','schema-projection',
      'source-chain-order','source-effect-vocabulary'].includes(x.origin)||
    ['choiceOrdinal','routeOrdinal'].some(k=>x[k]!==undefined&&
      (!Number.isSafeInteger(x[k])||x[k]<1))||
    Object.keys(x).some(k=>!['sourceOrdinal','choiceOrdinal','routeOrdinal',
      'reason','origin'].includes(k)))fail('要確認項目に本文／不正な位置がある');
 return x;
}
function verifyLedger(x){
 if(!obj(x)||x.schemaVersion!==1||
    x.dataKind!=='derived-github-new-card-pending-ledger'||
    x.baselineRosterCommit!==BASELINE||x.sourceRepository!==SOURCE||
    x.publicationApproved!==false||x.sourceProseIncluded!==false||
    !Array.isArray(x.cards)||
    Object.keys(x).some(k=>!['schemaVersion','dataKind','baselineRosterCommit',
     'sourceRepository','cards','publicationApproved','sourceProseIncluded'].includes(k)))
  fail('台帳の版／公開禁止境界が不正');
 let last='';
 for(const row of x.cards){
  if(!obj(row)||!id(row.cardId)||last&&cmp(last,row.cardId)>=0||
     !STATUS.has(row.status)||
     row.sourceBlobSha!==null&&!sha(row.sourceBlobSha)||
     row.sourceCommit!==null&&!sha(row.sourceCommit)||
     !Array.isArray(row.reviewItems)||row.reviewItems.length>400||
     !int(row.sourceEvents)&&row.sourceEvents!==null||
     !int(row.modeledEvents)&&row.modeledEvents!==null||
     !int(row.excludedEvents)&&row.excludedEvents!==null||
     row.sourceEvents!==null&&
      (row.modeledEvents===null||row.excludedEvents===null||
       row.sourceEvents!==row.modeledEvents+row.excludedEvents)||
     row.sourceEvents===null&&
      (row.modeledEvents!==null||row.excludedEvents!==null)||
     row.status==='awaiting-review'&&
      (row.sourceEvents===null||row.excludedEvents!==0||row.modeledEvents===0)||
     row.status==='awaiting-source-resolution'&&
      (row.sourceEvents===null||row.excludedEvents===0)||
     Object.keys(row).some(k=>!['cardId','status','sourceBlobSha','sourceCommit',
       'sourceEvents','modeledEvents','excludedEvents','reviewItems'].includes(k)))
    fail('保留カードの順序／版／状態／保存フィールドが不正');
  for(const item of row.reviewItems)verifyReview(item);
  if(row.sourceEvents!==null&&row.reviewItems.some(i=>i.sourceOrdinal>row.sourceEvents))
   fail('要確認イベントの位置が出典母数を超過');
  last=row.cardId;
 }
 return x;
}
function emptyLedger(){
 return {schemaVersion:1,dataKind:'derived-github-new-card-pending-ledger',
  baselineRosterCommit:BASELINE,sourceRepository:SOURCE,
  cards:[],publicationApproved:false,sourceProseIncluded:false};
}
function reconcilePendingLedger({previous=emptyLedger(),discovery,sourcePlan,stage,existingCatalog,
 reusedUnchangedCardIds=[]}={}){
 verifyLedger(previous);
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.publicationApproved!==false||
    sourcePlan?.dataKind!=='derived-github-new-card-source-plan'||
    stage?.dataKind!=='derived-github-private-new-card-review-stage'||
    stage.publicationApproved!==false||
    !obj(existingCatalog)||existingCatalog.schemaVersion!==1||
    !Array.isArray(existingCatalog.cards)||
    sourcePlan.primarySourceCommit!==stage.sourceCommit||
    JSON.stringify(sourcePlan.targetIds)!==
      JSON.stringify([...new Set([...discovery.addedCardIds,...previous.cards.map(x=>x.cardId)])].sort()))
  fail('新カード・出典計画・変換結果の追跡関係が不正');
 const imported=new Set(existingCatalog.cards.map(x=>x.cardId));
 if(!unique([...imported])||[...imported].some(x=>!id(x)))
  fail('既存の収録カードが不正');
 const planned=new Map(sourcePlan.results.map(x=>[x.cardId,x]));
 const staged=new Map(stage.stage.ready.map(x=>[x.cardId,x]));
 const pending=new Map(stage.stage.pending.map(x=>[x.cardId,x]));
 const original=new Map(previous.cards.map(x=>[x.cardId,x]));
 const targets=sourcePlan.targetIds.filter(x=>!imported.has(x));
 // An unchanged Git blob previously converted and reviewed has no reason
 // to be re-downloaded; preserve that exact metadata and its review issues.
 if(!Array.isArray(reusedUnchangedCardIds)||
    reusedUnchangedCardIds.some(x=>!id(x))||
    !unique(reusedUnchangedCardIds))
  fail('変更なし再利用IDが不正／重複');
 const reused=new Set(reusedUnchangedCardIds);
 for(const cardId of reused){
  const old=original.get(cardId),source=planned.get(cardId);
  if(!targets.includes(cardId)||!old||
     !['awaiting-review','awaiting-source-resolution'].includes(old.status)||
     source?.status!=='source-blob-present-needs-validation'||
     old.sourceBlobSha!==source.sourceBlobSha||
     !sha(old.sourceCommit)||!sha(old.sourceBlobSha)||
     staged.has(cardId)||
     pending.get(cardId)?.reason!=='derived-github-source-not-fetched')
   fail('変更なしカードの元ファイル履歴・保留状態が不一致');
 }
 if(targets.some(x=>!planned.has(x)||staged.has(x)===pending.has(x))||
    staged.size+pending.size!==targets.length||
    JSON.stringify(stage.carryForwardPendingIds)!==
      JSON.stringify(targets))
  fail('保留対象の欠落・重複・誤追記がある');
 const reviews=new Map();
 for(const issue of stage.reviewItems){
  if(!id(issue?.cardId)||!targets.includes(issue.cardId))
   fail('追加対象外の要確認事項');
  const {cardId,...copy}=issue;verifyReview(copy);
  if(!reviews.has(cardId))reviews.set(cardId,[]);
  reviews.get(cardId).push(copy);
 }
 const cards=targets.map(cardId=>{
  const row=planned.get(cardId),st=staged.get(cardId),error=pending.get(cardId);
  if(reused.has(cardId)){
   if(reviews.has(cardId))fail('再利用カードに新しい要確認が混入');
   return JSON.parse(JSON.stringify(original.get(cardId)));
  }
  let status,sourceEvents=null,modeledEvents=null,excludedEvents=null;
  if(st){
   if(row.status!=='source-blob-present-needs-validation')
    fail('変換済みカードと元Git treeが矛盾');
   status='awaiting-review';
   sourceEvents=st.events.length;
   modeledEvents=st.events.length;
   excludedEvents=0;
  }else{
   status=PENDING.get(error.reason);
   if(!status)fail('未知の未取込理由');
   if(status==='awaiting-source-resolution'){
    sourceEvents=error.sourceEventCount;
    excludedEvents=error.unresolvedEventCount;
    modeledEvents=sourceEvents-excludedEvents;
    if(!int(sourceEvents)||!int(excludedEvents)||excludedEvents<1||
       !int(modeledEvents))fail('保留カードのイベント件数不正');
   }
  }
  const sourceBlobSha=row.sourceBlobSha||null;
  const old=original.get(cardId);
  const sameSource=sourceBlobSha!==null&&
   old?.sourceBlobSha===sourceBlobSha&&sha(old?.sourceCommit);
  const sourceCommit=sourceBlobSha?
   (sameSource?old.sourceCommit:sourcePlan.primarySourceCommit):null;
  const reviewItems=(reviews.get(cardId)||[]).sort((a,b)=>
   a.sourceOrdinal-b.sourceOrdinal||
   (a.choiceOrdinal||0)-(b.choiceOrdinal||0)||
   (a.routeOrdinal||0)-(b.routeOrdinal||0)||
   cmp(a.reason,b.reason)||cmp(a.origin,b.origin));
  return {cardId,status,sourceBlobSha,sourceCommit,
   sourceEvents,modeledEvents,excludedEvents,reviewItems};
 });
 return verifyLedger({...emptyLedger(),cards});
}
module.exports={emptyLedger,verifyLedger,reconcilePendingLedger,BASELINE,SOURCE};
