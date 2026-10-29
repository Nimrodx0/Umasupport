'use strict';
/*
 * Pure source triage under the 2026-10-29 product-completion decision.
 * Structured GitHub-derived GT JSON is primary. The unfinished GameTora
 * HTML adapter MUST NOT block this path or be used as automatic fallback.
 * Individual missing/disputed facts may be reviewed manually.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('新カード出典更新トリアージ: '+s);};
const SITE_STATUSES=new Set([
 'not-checked','unavailable','not-found','card-only','partial','event-detail-reviewed'
]);
const MIRROR_STATUSES=new Set(['missing','available','modified','disputed']);
const FIELD_NAMES=new Set(['events','choices','outcomes','dependencies','skill-hints']);
function checkPolicy(){
 const p=POLICY.freshCardSourceLookup,i=POLICY.currentEventIntake;
 if(POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||
    POLICY.automaticPublicationAllowed!==false||
    !p||p.version!==2||p.strategy!=='derived-github-primary'||
    p.manualExceptionOnly!==true||p.autoPublish!==false||
    p.autoPromotePins!==false||
    !i||i.repository!=='systemless10/UmamusumePS'||
    i.directWebsiteHtmlAdapter!=='paused-not-a-prerequisite'||
    i.automaticPublicationAllowed!==false)
  fail('派生GitHub主経路・直接取得保留の契約が不正');
 return p;
}
function decide(input){
 checkPolicy();
 const {cardId,ageDays,mirrorStatus,
  site={status:'not-checked'},gameWithChecked=false,
  manualExceptionReview=false}=input||{};
 if(typeof cardId!=='string'||!/^[1-9]\d{4}$/.test(cardId)||
    !Number.isSafeInteger(ageDays)||ageDays<0||
    !MIRROR_STATUSES.has(mirrorStatus)||
    !site||!SITE_STATUSES.has(site.status)||
    typeof gameWithChecked!=='boolean'||typeof manualExceptionReview!=='boolean')
  fail('カード・経過日数・出典状態が不正');
 const unresolved=site.unresolvedFields??[];
 if(!Array.isArray(unresolved)||unresolved.some(x=>!FIELD_NAMES.has(x))||
    new Set(unresolved).size!==unresolved.length)
  fail('参考サイトの不足項目が不正');
 if((site.status==='partial'&&unresolved.length===0)||
    (site.status==='event-detail-reviewed'&&unresolved.length>0)||
    (!['partial','event-detail-reviewed'].includes(site.status)&&unresolved.length>0))
  fail('参考サイト状態と不足項目が矛盾');
 if(site.status!=='not-checked'){
  if(typeof site.url!=='string'||!new RegExp(
   '^https://gametora\\.com/(?:ja/)?umamusume/supports/'+cardId+'-[a-z0-9-]+/?$').test(site.url)||
   !/^\d{4}-\d\d-\d\d$/.test(site.checkedAt||''))
   fail('対象カードの参考サイト確認記録が不正');
 }
 if(gameWithChecked&&!manualExceptionReview)
  fail('個別例外確認なしのGameWith全面参照は禁止');
 let action='wait-for-derived-snapshot',allowGameWithLookup=false;
 if(mirrorStatus==='available'||mirrorStatus==='modified')
  action='preflight-derived-snapshot';
 else if(mirrorStatus==='disputed'&&!manualExceptionReview)
  action='queue-derived-source-dispute';
 else if(manualExceptionReview){
  // This is an explicit, card-scoped editorial review only; it never
  // launches a DOM extraction job. No day threshold forces website scraping.
  if(site.status==='event-detail-reviewed')
   action='review-manual-source-facts';
  else{
   action=gameWithChecked?'review-gamewith-only-for-gaps':'check-gamewith-only-for-gaps';
   allowGameWithLookup=!gameWithChecked;
  }
 }
 return {
  cardId,ageDays,action,allowGameWithLookup,
  sourceOrder:['GameTora-derived-GitHub','GameWith-exceptions'],
  unresolvedOfficialFields:[...unresolved],
  directWebsiteAdapterPaused:true,
  manualExceptionOnly:true,
  editorialFactsApproved:false,automaticPinPromotion:false,
  publicationApproved:false,
  nextStepRequiresSourceEvidence:action!=='wait-for-derived-snapshot'
 };
}
module.exports={decide,checkPolicy};
