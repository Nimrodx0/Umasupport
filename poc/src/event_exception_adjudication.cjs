'use strict';
/*
 * Project-wide EXCEPTION editorial decision contract.
 * Pinned GameTora is the baseline. When that snapshot lacks/disputes an
 * event, check the GameTora website, then adjudicate explicit facts through
 * GameWith. A second editorial site, live gameplay or republication approval
 * is not required for the EDITORIAL DECISION. They are separate gates.
 *
 * This does not download articles or publish third-party event text.
 */
const {URL}=require('node:url');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('イベント出典裁定規則: '+s);};
function urlMatches(url,host){
 if(typeof url!=='string')return false;
 try{
  const u=new URL(url);
  return u.protocol==='https:'&&u.hostname===host&&
   u.pathname!=='/'&&!u.username&&!u.password&&!u.hash&&!u.search;
 }catch{return false;}
}
function checkContract(){
 const rule=POLICY.exceptionAdjudicationContract;
 if(POLICY.schemaVersion!==2||POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||
    POLICY.automaticPublicationAllowed!==false||!rule||
    rule.version!==1||
    rule.baselineMissingIsReviewable!==true||
    rule.explicitGameWithFactsAreSufficientToAdjudicate!==true||
    rule.requiresSecondEditorialSource!==false||
    rule.requiresLiveGameplayReproduction!==false||
    rule.editorialAdjudicationIndependentOfPublicationApproval!==true||
    rule.requireCardScopedGameToraWebsiteCheck!==true||
    rule.allowPendingOnlyWhenGameWithFactNotEstablished!==true)
  fail('採用方針の不変条件が失われた');
}
const liveStatuses=new Set(['CARD_ONLY','EVENT_LIST','EVENT_DETAIL','NOT_FOUND']);
const gameWithStatuses=new Set(['EXPLICIT','NOT_LISTED','INTERNALLY_CONFLICTING']);
const holdReasons=new Set(['NOT_LISTED_IN_GAMEWITH',
 'GAMEWITH_ARTICLE_CONTRADICTS_ITSELF',
 'GAMEWITH_DOES_NOT_REPORT_REQUIRED_FACT',
 'CARD_OR_EVENT_IDENTITY_NOT_RESOLVED',
 'NUMERIC_SKILL_ID_NOT_RESOLVED']);
const allowedEffects=new Set(['speed','stamina','power','guts','wisdom',
 'bond','energy','mood','skill_points']);
function validateGtWebsiteCheck(cardId,sourceEventOrdinal,gtWebsite){
 if(!/^\d{5}$/.test(cardId||'')||
    !Number.isSafeInteger(sourceEventOrdinal)||sourceEventOrdinal<1||
    !gtWebsite||!urlMatches(gtWebsite.url,'gametora.com')||
    !gtWebsite.url.includes('/umamusume/supports/'+cardId+'-')||
    !liveStatuses.has(gtWebsite.status)||
    !/^\d{4}-\d\d-\d\d$/.test(gtWebsite.checkedAt||''))
   fail('イベント特定済みのGameTora元サイト確認が不足');
 return true;
}
function evaluateException(input){
 checkContract();
 const {cardId,sourceEventOrdinal,baseline,gtWebsite,gameWith,
  proposedDecision,holdReason=null}=input||{};
 validateGtWebsiteCheck(cardId,sourceEventOrdinal,gtWebsite);
 if(!['MISSING','DISPUTED'].includes(baseline)||
    !gameWith||!urlMatches(gameWith.url,'gamewith.jp')||
    !/^\d{4}-\d\d-\d\d$/.test(gameWith.checkedAt||'')||
    !gameWithStatuses.has(gameWith.factStatus)||
    !['ADOPT','PENDING'].includes(proposedDecision))
  fail('カード／元サイト／GameWithの調査記録が不足または不正');
 const explicit=gameWith.factStatus==='EXPLICIT';
 if(explicit){
  if(proposedDecision!=='ADOPT'||holdReason!==null)
   fail('GameWithに明示された事実を第二サイト・実ゲーム再現・権利審査待ちで未決に戻せない');
  const facts=gameWith.facts;
  if(!facts||!Number.isSafeInteger(facts.playerSelectableChoiceCount)||
     facts.playerSelectableChoiceCount<0||
     !Array.isArray(facts.reportedEffects)||
     !Array.isArray(facts.reportedSkillHints)||
     facts.reportedEffects.some(x=>!allowedEffects.has(x?.kind)||
       !Number.isFinite(x.value))||
     facts.reportedSkillHints.some(x=>
       !Number.isSafeInteger(x?.skillNumericId)||x.skillNumericId<1||
       !Number.isSafeInteger(x?.hintLevel)||x.hintLevel<1))
   fail('GameWithの明示的な選択肢・数値報酬事実が不足');
 }else{
  if(proposedDecision!=='PENDING'||!holdReasons.has(holdReason)||
     gameWith.facts!==undefined)
   fail('GameWithに具体的掲載がない場合のみ実際の不足理由で保留できる');
  if(gameWith.factStatus==='NOT_LISTED'&&
     !['NOT_LISTED_IN_GAMEWITH','GAMEWITH_DOES_NOT_REPORT_REQUIRED_FACT',
       'CARD_OR_EVENT_IDENTITY_NOT_RESOLVED','NUMERIC_SKILL_ID_NOT_RESOLVED'].includes(holdReason))
   fail('GameWith未掲載の保留理由が不正');
  if(gameWith.factStatus==='INTERNALLY_CONFLICTING'&&
     holdReason!=='GAMEWITH_ARTICLE_CONTRADICTS_ITSELF')
   fail('GameWith掲載内部矛盾の理由が不足');
 }
 const result={
  status:explicit?(baseline==='MISSING'?'GAMEWITH_ADJUDICATED_GT_GAP':
   'GAMEWITH_ADJUDICATED_GT_DISPUTE'):'PENDING_GAMEWITH_FACT',
  cardId,sourceEventOrdinal,baselineStatus:baseline,
  gameToraWebsite:{...gtWebsite},
  gameWithArticle:{url:gameWith.url,checkedAt:gameWith.checkedAt,
   factStatus:gameWith.factStatus},
  ...(explicit?{reportedFacts:{
   playerSelectableChoiceCount:gameWith.facts.playerSelectableChoiceCount,
   reportedEffects:gameWith.facts.reportedEffects.map(x=>({...x})),
   reportedSkillHints:gameWith.facts.reportedSkillHints.map(x=>({...x}))
  }}:{holdReason}),
  editorialDecisionComplete:explicit,
  furtherEditorialCorroborationRequired:false,
  currentGameplayVerificationRequiredForEditorialDecision:false,
  game2026Verified:false,
  chainDependencyCompletenessVerified:false,
  publicReuseOrLicenseApproved:false,
  publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 };
 return result;
}
module.exports={evaluateException,checkContract,validateGtWebsiteCheck};
