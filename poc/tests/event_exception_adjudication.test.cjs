'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const POLICY=require('../config/event-source-priority.v1.json');
const {evaluateException,checkContract}=
 require('../src/event_exception_adjudication.cjs');
const live={url:'https://gametora.com/ja/umamusume/supports/30321-duramente',
 checkedAt:'2026-10-22',status:'EVENT_LIST'};
const url='https://gamewith.jp/uma-musume/article/show/578817';
const explicit=()=>({cardId:'30321',sourceEventOrdinal:3,
 baseline:'MISSING',gtWebsite:live,
 gameWith:{url,checkedAt:'2026-10-22',factStatus:'EXPLICIT',facts:{
  playerSelectableChoiceCount:0,
  reportedEffects:[{kind:'power',value:15},{kind:'bond',value:5}],
  reportedSkillHints:[{skillNumericId:201463,hintLevel:1}]
 }},
 proposedDecision:'ADOPT'});
test('read the documented immutable source precedence, not a prose-only recommendation',()=>{
 assert.doesNotThrow(checkContract);
 assert.equal(POLICY.baselineSource,'GameTora-derived');
 assert.equal(POLICY.canonicalExceptionSource,'GameWith');
 assert.equal(POLICY.exceptionAdjudicationContract.baselineMissingIsReviewable,true);
 assert.equal(POLICY.exceptionAdjudicationContract.requiresSecondEditorialSource,false);
 assert.equal(POLICY.exceptionAdjudicationContract.requiresLiveGameplayReproduction,false);
 assert.equal(POLICY.exceptionAdjudicationContract.editorialAdjudicationIndependentOfPublicationApproval,true);
});
test('missing GT + checked live GT + explicit GameWith is decided without a second website',()=>{
 const x=evaluateException(explicit());
 assert.equal(x.status,'GAMEWITH_ADJUDICATED_GT_GAP');
 assert.equal(x.cardId,'30321');
 assert.equal(x.baselineStatus,'MISSING');
 assert.equal(x.gameToraWebsite.status,'EVENT_LIST');
 assert.equal(x.reportedFacts.playerSelectableChoiceCount,0);
 assert.deepEqual(x.reportedFacts.reportedSkillHints,
  [{skillNumericId:201463,hintLevel:1}]);
 assert.equal(x.editorialDecisionComplete,true);
 assert.equal(x.furtherEditorialCorroborationRequired,false);
 assert.equal(x.currentGameplayVerificationRequiredForEditorialDecision,false);
 assert.equal(x.game2026Verified,false);
 assert.equal(x.chainDependencyCompletenessVerified,false);
 assert.equal(x.publicReuseOrLicenseApproved,false);
 assert.equal(x.publicationApproved,false);
 assert.equal(x.noAutomaticRuntimeAdoption,true);
 assert.equal(JSON.stringify(x).includes('gametora.com'),true);
});
test('flagged GT present + explicit GameWith overrides without requiring an unrelated site',()=>{
 const x=explicit();x.baseline='DISPUTED';
 const y=evaluateException(x);
 assert.equal(y.status,'GAMEWITH_ADJUDICATED_GT_DISPUTE');
 assert.equal(y.editorialDecisionComplete,true);
 assert.equal(y.publicationApproved,false);
});
test('same GameWith record cannot be held due to a second source, gameplay test, or reuse approval',()=>{
 for(const reason of ['NEED_INDEPENDENT_CORROBORATION',
  'NEED_LIVE_GAME_TEST','NEED_REPUBLICATION_PERMISSION',
  'NOT_LISTED_IN_GAMEWITH']){
  const x=explicit();x.proposedDecision='PENDING';x.holdReason=reason;
  assert.throws(()=>evaluateException(x),/イベント出典裁定規則/);
 }
 const x=explicit();x.holdReason='NEED_INDEPENDENT_CORROBORATION';
 assert.throws(()=>evaluateException(x),/イベント出典裁定規則/);
});
test('a real GameWith gap or internal contradiction stays pending, not fabricated',()=>{
 const x=explicit();
 x.gameWith={url,checkedAt:'2026-10-22',factStatus:'NOT_LISTED'};
 x.proposedDecision='PENDING';x.holdReason='NOT_LISTED_IN_GAMEWITH';
 const y=evaluateException(x);
 assert.equal(y.status,'PENDING_GAMEWITH_FACT');
 assert.equal(y.holdReason,'NOT_LISTED_IN_GAMEWITH');
 assert.equal(y.editorialDecisionComplete,false);
 assert.equal(y.publicationApproved,false);
 x.gameWith.factStatus='INTERNALLY_CONFLICTING';
 x.holdReason='GAMEWITH_ARTICLE_CONTRADICTS_ITSELF';
 assert.equal(evaluateException(x).status,'PENDING_GAMEWITH_FACT');
});
test('bad source URL, absent GT website check and invented skill result fail closed',()=>{
 const cases=[
  x=>{x.gtWebsite=null;},
  x=>{x.gtWebsite={...x.gtWebsite,status:'UNCONFIRMED'};},
  x=>{x.gtWebsite={...x.gtWebsite,
   url:'https://gametora.com/ja/umamusume/supports/30319-narita-brian'};},
  x=>{x.gtWebsite={...x.gtWebsite,url:'https://fake.example/card'};},
  x=>{x.gameWith.url='https://gamewith.jp.evil.example/article/show/578817';},
  x=>{x.gameWith.facts.playerSelectableChoiceCount=-1;},
  x=>{x.gameWith.facts.reportedSkillHints[0].skillNumericId=0;},
  x=>{x.gameWith.facts.reportedSkillHints[0].hintLevel=0;},
  x=>{x.gameWith.facts.reportedEffects[0].kind='unknown';},
  x=>{x.gameWith.facts.reportedEffects[0].value='15';},
  x=>{x.proposedDecision='PENDING';},
  x=>{x.cardId='';},
  x=>{x.gameWith.facts=undefined;}
 ];
 for(const mutate of cases){
  const x=explicit();mutate(x);
  assert.throws(()=>evaluateException(x),/イベント出典裁定規則/);
 }
});
