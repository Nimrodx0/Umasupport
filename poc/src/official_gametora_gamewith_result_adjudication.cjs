'use strict';
/*
 * Narrowly editorially adjudicate a result's GAME meaning only when the
 * original GameTora page was inspected, a card/event-specific GameWith article
 * states the actual choices and labelled outcomes, AND every site's result
 * coordinates, numeric facts and independent skill hints match the article.
 *
 * This is not a scrape and not a public events compiler. Inputs contain no
 * copied choice wording, event prose or HTML. A verified "great-success" vs
 * "success" is categorically distinct from the website's unlabelled OR.
 */
const fail=x=>{throw Error('GameTora→GameWith結果意味裁定: '+x);};
const {evaluateException}=require('./event_exception_adjudication.cjs');
const isInt=x=>Number.isSafeInteger(x);
const bag=items=>items.map(x=>String(x)).sort().join('|');
const effects=items=>bag(items.map(x=>x.kind+':'+x.delta));
function adjudicateExplicitSourceOutcomes(event,review,{siteEventTitleFingerprint}={}){
 if(event?.status!=='unified-unapproved'||
    event.joined?.dataKind!=='official-gametora-site-unified-route-draft'||
    event.joined.appEventSchemaAdoptable!==false||
    event.joined.publicationApproved!==false||
    event.outcomeEvidence?.playerChoiceSemanticsVerified!==false||
    !Array.isArray(event.joined.routes)||
    review?.schemaVersion!==1||review.cardId!==event.cardId||
    review.siteEventOrdinal!==event.siteEventOrdinal||
    review.sourcePolicy!=='GameTora-site-first-GameWith-specific-gap'||
    review.gametoraSiteChecked!==true||
    review.gameWithExplicitChoiceAndOutcomeFacts!==true||
    review.articleCheckedOn!=='2026-10-29'||
    review.gametoraSiteUrl!==
     'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun'||
    review.gameWithArticleUrl!==
     'https://gamewith.jp/uma-musume/article/show/584253'||
    review.cardId!=='30322'||review.siteEventOrdinal!==4||
    review.appEventSchemaAdoptable!==false||
    review.publicationApproved!==false||
    review.choiceLabelReuseApproved!==false||
    review.nextEventRequiresVerified!==false||
    review.officialGameCurrentnessVerified!==false)
  fail('source-scope-or-publication-gate-invalid');
 if(typeof siteEventTitleFingerprint!=='string'||
    review.eventTitleNormalizedSha256!==siteEventTitleFingerprint)
  fail('event-title-identity-not-confirmed');
 // Apply the repository-wide GameTora -> GameWith exception policy.
 // The explicitly adopted fact here is the *three player choices and
 // outcome types*, NOT a full collection of GameWith reward text.
 const sourceDecision=evaluateException({
  cardId:review.cardId,sourceEventOrdinal:review.siteEventOrdinal,
  baseline:'MISSING',
  gtWebsite:{url:review.gametoraSiteUrl,
   checkedAt:review.gametoraSiteCheckedAt,status:'EVENT_DETAIL'},
  gameWith:{url:review.gameWithArticleUrl,
   checkedAt:review.articleCheckedOn,factStatus:'EXPLICIT',
   facts:{playerSelectableChoiceCount:review.expectedPlayerChoices,
    reportedEffects:[],reportedSkillHints:[]}},
  proposedDecision:'ADOPT'
 });
 if(!sourceDecision.editorialDecisionComplete||
    sourceDecision.publicationApproved!==false||
    sourceDecision.chainDependencyCompletenessVerified!==false)
  fail('site-exception-editorial-policy-rejected');
 if(!isInt(review.expectedPlayerChoices)||review.expectedPlayerChoices<1||
    !Array.isArray(review.groups)||
    review.groups.length!==review.expectedPlayerChoices||
    event.joined.visibleGroupCount!==review.groups.length||
    event.joined.visibleRouteCount!==6)
  fail('player-choice-layout-mismatch');
 const rows=[];
 for(const [i,g] of review.groups.entries()){
  if(g?.group!==i+1||!Array.isArray(g.results)||g.results.length!==2)
   fail('review-choice-structure-invalid');
  const chosen=event.joined.routes.filter(r=>r.choiceGroupOrdinal===g.group);
  if(chosen.length!==2)fail('source-result-layout-drift');
  const perChoiceHints=[];
  for(const [j,expected] of g.results.entries()){
   const actual=chosen[j];
   if(expected.result!==j+1||
      expected.label!==(j===0?'great-success':'success')||
      actual.resultOrdinal!==j+1||
      !Array.isArray(expected.numeric)||!Array.isArray(expected.hintLevels)||
      !Array.isArray(actual.numericEffects)||!Array.isArray(actual.skillHints)||
      actual.unresolvedReasons?.some(x=>['numeric-facts-unresolved',
       'hint-facts-unresolved'].includes(x))||
      actual.directSkills?.length)
    fail('adjudicated-result-or-unknown-reward-route');
   if(expected.numeric.length!==actual.numericEffects.length||
      expected.numeric.some(x=>!Array.isArray(x)||x.length!==2||
       typeof x[0]!=='string'||!isInt(x[1])||x[1]===0)||
      effects(actual.numericEffects)!==
       bag(expected.numeric.map(x=>x[0]+':'+x[1])))
    fail('gamewith-vs-original-site-numeric-drift');
   if(bag(actual.skillHints.map(x=>x.level))!==bag(expected.hintLevels)||
      expected.hintLevels.length!==2||
      actual.skillHints.some(x=>!/^([1-9]\d*)$/.test(x.numericId)))
    fail('gamewith-vs-original-site-hint-level-drift');
   perChoiceHints.push(bag(actual.skillHints.map(x=>x.numericId)));
   rows.push({
    choiceGroupOrdinal:g.group,resultOrdinal:expected.result,
    editorialOutcomeLabel:expected.label,
    siteAndGameWithNumericFactsMatched:true,
    siteAndGameWithHintLevelsMatched:true
   });
  }
  if(perChoiceHints[0]!==perChoiceHints[1])
   fail('one-player-choice-different-skill-ids-without-source-proof');
 }
 if(rows.length!==event.joined.visibleRouteCount)
  fail('adjudicated-row-count-drift');
 return {
  dataKind:'official-gametora-editorial-outcome-adjudication',version:1,
  cardId:review.cardId,siteEventOrdinal:review.siteEventOrdinal,
  source:'GameTora-site-then-GameWith',
  gameWithArticleUrl:review.gameWithArticleUrl,
  editorialChoiceCount:review.expectedPlayerChoices,
  editorialOutcomeCount:rows.length,
  outcomes:rows,
  // Does NOT verify an entire event, full reward coverage or reachability.
  playerChoiceAndOutcomeTypesEditoriallyVerified:true,
  siteFirstGameWithExceptionContractVerified:true,
  allSkillAwardsVerified:false,chainContinuationRequiresVerified:false,
  inGameResultProbabilityVerified:false,sourceProseExported:false,
  game2026Verified:false,publicationApproved:false,
  appEventSchemaAdoptable:false
 };
}
module.exports={adjudicateExplicitSourceOutcomes};
