'use strict';
/*
 * Read-only GameTora listing discovery for genuinely NEW support cards.
 * Never guess a slug, follow arbitrary external URLs, or turn a missing
 * listing link into a statement that the support card has no events.
 */
const fail=s=>{throw Error('GameTora新サポカ掲載URL検出: '+s);};
const ID=/^[1-9]\d{4}$/;
const LISTING='https://gametora.com/ja/umamusume/supports';
const PAGE=/^\/ja\/umamusume\/supports\/([1-9]\d{4})-([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;
function cardIds(values,label){
 if(!Array.isArray(values)||values.length>1000||
    values.some(x=>typeof x!=='string'||!ID.test(x))||
    new Set(values).size!==values.length)fail(label+'が不正／重複');
 return values;
}
function selectIntakeTargets(plan,{limit=2}={}){
 if(!Number.isSafeInteger(limit)||limit<1||limit>2)
  fail('1回に訪問できる新カードは最大2枚');
 if(plan?.dataKind!=='new-card-event-intake-plan'||plan.version!==1||
    plan.publicationApproved!==false||
    plan.sourceEventsPublishedAutomatically!==false||
    plan.existingDatabaseUnchanged!==true||
    plan.publishedEventsChanged!==0||
    typeof plan.existingCatalogDigest!=='string'||
    !/^[a-f0-9]{64}$/.test(plan.existingCatalogDigest))
  fail('増分計画が未承認・読み取り専用の正規形式ではない');
 const pending=cardIds(plan.carryForwardPendingIds,'保留ID');
 const imported=new Set(cardIds(plan.alreadyImportedIds,'収録済みID'));
 const current=cardIds(plan.newlyObservedIds,'今回新規ID');
 if(current.some(x=>!pending.includes(x)&&!imported.has(x)))
  fail('新規名簿の差分が保留台帳と一致しない');
 if(pending.some(x=>imported.has(x)))
  fail('取込済みIDへの再訪問は禁止');
 return {
  targetCardIds:pending.slice(0,limit),
  unvisitedCardIds:pending.slice(limit),
  sourceOnly:true,publicationApproved:false
 };
}
function canonicalSupportUrl(href){
 if(typeof href!=='string'||href.length>300)return null;
 let url;
 try{url=new URL(href,LISTING);}catch{return null;}
 if(url.protocol!=='https:'||url.hostname!=='gametora.com'||
    url.username||url.password||url.port||url.search||url.hash)return null;
 const match=PAGE.exec(url.pathname);
 if(!match)return null;
 return {cardId:match[1],url:'https://gametora.com'+
   url.pathname.replace(/\/$/,'')};
}
function resolveListedPages({targetCardIds,hrefs}={}){
 const wanted=cardIds(targetCardIds,'訪問対象ID');
 if(wanted.length>2)fail('元サイトへの一括照会は禁止');
 if(!Array.isArray(hrefs)||hrefs.length>10000||
    hrefs.some(x=>typeof x!=='string'))fail('一覧のリンク抽出結果が不正');
 const map=new Map(),wantedSet=new Set(wanted);
 for(const href of hrefs){
  const page=canonicalSupportUrl(href);
  if(!page||!wantedSet.has(page.cardId))continue;
  const previous=map.get(page.cardId);
  if(previous&&previous!==page.url)
   fail('同じ新カードIDに複数の異なるURLが掲載されている');
  map.set(page.cardId,page.url);
 }
 return wanted.map(cardId=>map.has(cardId)?
  {cardId,status:'listed',url:map.get(cardId)}:
  {cardId,status:'not-listed-yet',url:null});
}
module.exports={LISTING,canonicalSupportUrl,selectIntakeTargets,resolveListedPages};
