'use strict';
/* SR20075 fixed-GT stage1 gap. GameWith explicitly states its displayed
 * numeric facts. U-tools reports two unlabeled reward rows: never coerce
 * either into a guaranteed reward or invent success/failure probabilities.
 */
const {evaluateException}=require('./event_exception_adjudication.cjs');
const SOURCE=require('../data/curation/adjudicated/20075_stage1.v1.json');
const fail=s=>{throw Error('SR20075連続初段階の数値裁定: '+s);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,keys,where)=>{if(!o||typeof o!=='object'||Array.isArray(o)||
 !same(Object.keys(o).sort(),[...keys].sort()))fail(where+': フィールド過不足');};
const EFFECTS=[{kind:'guts',value:15},{kind:'bond',value:15}];
const ALTERNATES=[EFFECTS,[{kind:'guts',value:5},{kind:'bond',value:5}]];
function audit(doc=SOURCE){
 exact(doc,['schemaVersion','dataKind','cardId','cardDisplayIdentity',
  'fixedGameToraRevision','fixedGameToraOnlyChainStageLocalId',
  'fixedGameToraChainStageCount','fixedCheckerRevision',
  'checkerOnlyOrdinal','checkerOnlySourceKey','gameToraWebsite',
  'gameWith','otherOutcomeEvidence','sourceProseIncluded',
  'editorialNumericFactsAdopted','exactRouteSemanticsVerified',
  'nextChainStageAvailabilityVerified','game2026Verified',
  'publicationApproved','noAutomaticRuntimeAdoption'],'root');
 if(doc.schemaVersion!==1||
 doc.dataKind!=='gamewith-adjudicated-one-disputed-stage-numeric-facts'||
 doc.cardId!=='20075'||doc.cardDisplayIdentity!=='Cheers!'||
 doc.fixedGameToraRevision!=='6e38b54af4fad397ff4491e63007a90705a4fe67'||
 doc.fixedGameToraOnlyChainStageLocalId!==416||
 doc.fixedGameToraChainStageCount!==1||
 doc.fixedCheckerRevision!=='8cf9fcb3cc7239041161be75c84daf9f8f22d29f'||
 doc.checkerOnlyOrdinal!==1||
 doc.checkerOnlySourceKey!=='checker:20075:8fd4b0e1da2eeb063087'||
 doc.sourceProseIncluded!==false||doc.editorialNumericFactsAdopted!==true||
 doc.exactRouteSemanticsVerified!==false||
 doc.nextChainStageAvailabilityVerified!==false||
 doc.game2026Verified!==false||doc.publicationApproved!==false||
 doc.noAutomaticRuntimeAdoption!==true)
 fail('固定SR個別事実と非公開境界に不一致');
 exact(doc.gameToraWebsite,['url','checkedAt','status'],'GT');
 exact(doc.gameWith,['url','checkedAt','factStatus',
  'playerSelectableChoiceCount','reportedEffects','reportedSkillHints'],'GameWith');
 exact(doc.otherOutcomeEvidence,['sourceUrl','unlabeledRewardRows',
  'outcomeSelectionRuleVerified','successFailureLabelsVerified',
  'probabilityKnown'],'other');
 if(doc.gameToraWebsite.url!==
 'https://gametora.com/ja/umamusume/supports/20075-tap-dance-city'||
 doc.gameToraWebsite.checkedAt!=='2026-10-22'||
 doc.gameToraWebsite.status!=='CARD_ONLY'||
 doc.gameWith.url!==
 'https://gamewith.jp/uma-musume/article/show/441770'||
 doc.gameWith.checkedAt!=='2026-10-22'||
 doc.gameWith.factStatus!=='EXPLICIT'||
 doc.gameWith.playerSelectableChoiceCount!==0||
 !same(doc.gameWith.reportedEffects,EFFECTS)||
 !same(doc.gameWith.reportedSkillHints,[])||
 doc.otherOutcomeEvidence.sourceUrl!==
 'https://xn--gck1f423k.xn--1bvt37a.tools/supports/20075/event'||
 !same(doc.otherOutcomeEvidence.unlabeledRewardRows,ALTERNATES)||
 doc.otherOutcomeEvidence.outcomeSelectionRuleVerified!==false||
 doc.otherOutcomeEvidence.successFailureLabelsVerified!==false||
 doc.otherOutcomeEvidence.probabilityKnown!==false)
 fail('GameWith明示事実またはU-tools未分類2結果の数値事実が変化');
 const decision=evaluateException({cardId:doc.cardId,
  sourceEventOrdinal:doc.checkerOnlyOrdinal,baseline:'MISSING',
  gtWebsite:doc.gameToraWebsite,
  gameWith:{url:doc.gameWith.url,checkedAt:doc.gameWith.checkedAt,
   factStatus:'EXPLICIT',facts:{
    playerSelectableChoiceCount:0,reportedEffects:doc.gameWith.reportedEffects,
    reportedSkillHints:doc.gameWith.reportedSkillHints
   }},proposedDecision:'ADOPT'});
 if(!decision.editorialDecisionComplete||decision.game2026Verified!==false||
 decision.publicationApproved!==false||decision.noAutomaticRuntimeAdoption!==true)
 fail('裁定事実を誤って公開・自動確定へ昇格');
 return {policyDecision:decision,summary:{
  cardId:'20075',gameWithAdoptedNumericEffectFacts:2,
  observedUnlabeledNumericRows:2,independentCheckerOnlyPositions:1,
  selectableChoiceCountReportedByGameWith:0,
  verifiedOutcomeRoutes:0,verifiedChainTransitions:0,
  projectedRuntimeEvents:0,publishedEvents:0,
  publicationApproved:false,game2026Verified:false,
  noAutomaticRuntimeAdoption:true
 }};
}
module.exports={audit};
