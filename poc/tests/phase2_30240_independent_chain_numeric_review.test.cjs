'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {make,hashedName}=require('../src/phase2_30240_independent_chain_numeric_review.cjs');
const gt='6e38b54af4fad397ff4491e63007a90705a4fe67',
 checker='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const editorial='https://xn--gck1f423k.xn--1bvt37a.tools/supports/30240/event';
function fixture(){
 const n={cardId:'30240',sourceEventCount:2,sourceChainCount:0,
  sourceRandomCount:2,sourceOtherCount:0,numericParsedHintMentions:1,
  events:[167,168].map((id,i)=>({
   sourceOrdinal:i+1,sourceLocalEventId:id,section:'random',
   choices:[{routes:[{numericHintFacts:[]}]},{
    routes:[{numericHintFacts:i===1?
     [{skillNumericId:'202422',level:1,numericFactParsed:true}]:[]}]
   }]
  }))};
 return {
  index:{sourcePins:{checker,gameToraDerived:gt},
   gameVerified:false,publicationApproval:false,rawSourceContentIncluded:false,
   cards:[{cardId:'30240',rarity:'SSR',checkerMissing:false,sourceMissing:false,
    gameToraObservedCount:2,checkerObservedCount:0,unmatchedCheckerCount:0,
    unmatchedGameToraCount:2,pairs:[],checkerOnly:[],
    gameToraOnly:[167,168].map((sourceLocalEventId,i)=>({
     sourceOrdinal:i+1,sourceLocalEventId,section:'random'
    }))}]},
  coverage:{sourcePins:{checker,gt},currentGameplayVerified:false,
   publicationApproved:false,sourceProseIncluded:false,cards:[{
    cardId:'30240',classification:'PLAIN_ZERO_CHAIN',
    reviewerStatus:'THREE_CHAIN_STAGES_MISSING_BOTH_FIXED_SOURCES',
    editorialExpectedChainStages:3,editorialShortfallStages:3,
    absentBothFixedSources:3,alreadyCountedInCheckerOnly:0,
    gtChainStageCount:0,gtObservedEventCount:2,checkerObservedEventCount:0,
    game2026Verified:false,publicationApproved:false,
    noAutomaticRuntimeAdoption:true
   }]},
  exceptions:{sourcePins:{checker,gameToraDerived:gt},publicationApproved:false,
   gameVerified:false,supplementalMissingGTChainReviews:[{
    cardId:'30240',reviewStatus:'PINNED_GT_HAS_NO_CHAIN_STAGES',
    checkerRecordedChainStageRows:0,fixedGTRecordedChainStages:0,
    additionalIndependentExpectedEventsNotInNeitherPinnedSource:3,
    referenceUrls:[editorial],noAutomaticRuntimeAdoption:true,
    publicationApproved:false
   }]},
  numeric:{sourcePins:{checkerIndex:checker,gameToraDerived:gt},
   gameVerified:false,releaseApproved:false,cards:[n]},
  skills:[{id:200591,name:'迅速果断',rarity:2},
   {id:202422,name:'がむしゃら',rarity:1}]
 };
}
const run=x=>make(x.index,x.coverage,x.exceptions,x.numeric,x.skills);
test('three missing stages stay numerical, single-source, non-publishing and without fabricated choices',()=>{
 const x=fixture(),out=run(x);
 assert.equal(out.cardId,'30240');
 assert.equal(out.externalEditorialSourceFamilies,1);
 assert.equal(out.externalArticleDirectlyVerified,true);
 assert.equal(out.externalProvenanceFullyIndependent,false);
 assert.equal(out.fixedGTChainStages,0);
 assert.equal(out.fixedCheckerChainStages,0);
 assert.equal(out.stageRows.length,3);
 assert.deepEqual(out.gtPinnedRandomEventIds,[167,168]);
 assert.equal(out.sourceRandomSkillHintId,202422);
 assert.equal(out.sourceRandomSkillHintLevel,1);
 assert.equal(out.externallyReportedFinalSkillId,200591);
 assert.equal(out.externalFinalSkillHintLevel,1);
 assert.equal(out.externalFinalSkill2026DictionaryNameHash,
  hashedName('迅速果断'));
 assert.deepEqual(out.stageRows.map(x=>x.reportedNumericEffects),
  Array.from({length:3},()=>[
   {kind:'stamina',value:15},{kind:'bond',value:5}]));
 assert.deepEqual(out.stageRows.map(x=>x.reportedSkillHintCandidates.length),
  [0,0,1]);
 assert.deepEqual(out.stageRows[2].reportedSkillHintCandidates[0],
  {skillNumericId:200591,hintLevel:1,conditionVerified:false,
   actualGrantVerified:false,game2026Verified:false,publicationApproved:false});
 assert.ok(out.stageRows.every(c=>
  c.playerChoicesVerified===false&&c.game2026Verified===false&&
  c.publicationApproved===false&&c.stageOccurrenceProbabilityVerified===false&&
  c.chainStopOrPriorBranchVerified===false));
 assert.equal(out.thirdPartyEventTextIncluded,false);
 assert.equal(out.thirdPartySelectionTextIncluded,false);
 assert.equal(out.actualSkillGrantVerified,false);
 assert.equal(out.noAutomaticRuntimeAdoption,true);
 assert.equal(out.publicationApproved,false);
 assert.ok(!JSON.stringify(out).includes('新時代のゲート'));
});
test('refuse out-of-date snapshots, altered GT hint, duplicate cards, changed 2026 skill identity',()=>{
 const changes=[
  x=>{x.index.sourcePins.checker='new source';},
  x=>{x.index.cards[0].checkerObservedCount=1;},
  x=>{x.index.cards[0].checkerMissing=true;},
  x=>{x.index.cards[0].gameToraOnly[0].sourceLocalEventId=999;},
  x=>{x.index.cards[0].gameToraOnly.pop();},
  x=>{x.index.cards[0].sourceMissing=true;},
  x=>{x.coverage.cards[0].absentBothFixedSources=0;},
  x=>{x.coverage.cards[0].publicationApproved=true;},
  x=>{x.exceptions.supplementalMissingGTChainReviews[0].checkerRecordedChainStageRows=3;},
  x=>{x.exceptions.supplementalMissingGTChainReviews[0].referenceUrls=[];},
  x=>{x.numeric.cards[0].events[1].sourceLocalEventId=177;},
  x=>{x.numeric.cards[0].events[1].choices.pop();},
  x=>{x.numeric.cards[0].events[1].choices[1].routes[0].numericHintFacts[0].level=3;},
  x=>{x.numeric.cards[0].events[1].choices[1].routes[0].numericHintFacts[0].skillNumericId='200591';},
  x=>{x.skills[0].name='異なる名称';},
  x=>{x.skills[0].id=123;},
  x=>{x.skills[0].rarity=1;},
  x=>{x.skills.push({...x.skills[0]});},
  x=>{x.index.cards.push({...x.index.cards[0]});}
 ];
 for(const change of changes){
  const x=fixture();change(x);
  assert.throws(()=>run(x),/Phase2 30240独立連続3段階の数値候補/);
 }
});
