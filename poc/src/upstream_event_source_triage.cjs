'use strict';
/*
 * Source freshness triage for support-card event gaps.
 * This is a pure, offline decision function. It never fetches a website,
 * infers an event from a card page, edits runtime pins or publishes data.
 * The GitHub GameTora-derived snapshot is distinct from gametora.com.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('新カード出典更新トリアージ: '+s);};
const SITE_STATUSES=new Set([
 'not-checked','unavailable','not-found','card-only','partial','event-detail-reviewed'
]);
const MIRROR_STATUSES=new Set(['missing','available','modified','disputed']);
const FIELD_NAMES=new Set(['events','choices','outcomes','dependencies','skill-hints']);
function checkPolicy(){
 const p=POLICY.freshCardSourceLookup;
 if(POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||
    POLICY.automaticPublicationAllowed!==false||
    POLICY.exceptionAdjudicationContract?.requireCardScopedGameToraWebsiteCheck!==true||
    !p||p.version!==1||p.strategy!=='delayed-website-before-gamewith'||
    !Number.isSafeInteger(p.websiteCheckAfterDays)||p.websiteCheckAfterDays<0||
    !Number.isSafeInteger(p.gameWithCheckAfterDays)||
    p.gameWithCheckAfterDays<=p.websiteCheckAfterDays||
    p.autoPublish!==false||p.autoPromotePins!==false)
  fail('現行のGT元サイト優先／公開保護契約が不正');
 return p;
}
function decide(input){
 const p=checkPolicy();
 const {cardId,ageDays,mirrorStatus,site,gameWithChecked=false}=input||{};
 if(typeof cardId!=='string'||!/^\d{5}$/.test(cardId)||
    !Number.isSafeInteger(ageDays)||ageDays<0||
    !MIRROR_STATUSES.has(mirrorStatus)||
    !site||!SITE_STATUSES.has(site.status)||
    typeof gameWithChecked!=='boolean')fail('カード・経過日数・出典状態が不正');
 const unresolved=site.unresolvedFields??[];
 if(!Array.isArray(unresolved)||unresolved.some(x=>!FIELD_NAMES.has(x))||
    new Set(unresolved).size!==unresolved.length)
  fail('公式ページの不足項目が不正');
 if(site.status==='partial'&&unresolved.length===0||
    site.status==='event-detail-reviewed'&&unresolved.length>0||
    !['partial','event-detail-reviewed'].includes(site.status)&&unresolved.length>0)
  fail('公式ページ状態と不足項目の整合が不正');
 if(site.status!=='not-checked'){
  if(typeof site.url!=='string'||!new RegExp(
   '^https://gametora\\.com/(?:ja/)?umamusume/supports/'+cardId+'-[a-z0-9-]+/?$').test(site.url)||
   !/^\d{4}-\d\d-\d\d$/.test(site.checkedAt||''))
   fail('対象カードの公式サイト確認記録が不正');
 }
 let action,allowGameWithLookup=false;
 if(mirrorStatus==='available'||mirrorStatus==='modified')
  action='preflight-derived-snapshot';
 else if(site.status==='event-detail-reviewed')
  action='review-official-site-event-facts';
 else if(site.status==='unavailable')
  action='retry-official-site';
 else if(site.status==='not-checked')
  action=mirrorStatus==='disputed'||ageDays>=p.websiteCheckAfterDays
   ?'check-official-gametora-card':'wait-for-derived-snapshot';
 else if(ageDays<p.gameWithCheckAfterDays)
  action='wait-for-official-event-details';
 else{
  action=gameWithChecked?'review-gamewith-only-for-gaps':'check-gamewith-only-for-gaps';
  allowGameWithLookup=!gameWithChecked;
 }
 if(gameWithChecked&&site.status==='not-checked')
  fail('GameTora公式サイトを確認せずGameWithへ進めない');
 return {
  cardId,ageDays,action,allowGameWithLookup,
  sourceOrder:['GameTora-derived','gametora.com','GameWith'],
  unresolvedOfficialFields:[...unresolved],
  editorialFactsApproved:false,automaticPinPromotion:false,publicationApproved:false,
  nextStepRequiresSourceEvidence:action!=='wait-for-derived-snapshot'&&
   action!=='wait-for-official-event-details'
 };
}
module.exports={decide,checkPolicy};
