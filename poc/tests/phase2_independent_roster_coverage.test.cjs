'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_independent_roster_coverage.cjs');
const gt='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checker='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const make=()=>{
 const seed=[
  ['20075','SR',3,4,1,2,0],
  ['30221','SSR',2,5,0,2,0],
  ['30240','SSR',2,0,0,2,0],
  ['30244','SSR',3,3,1,2,0],
  ['30286','SSR',3,3,1,2,0],
  ['10001','R',2,0,0,2,0],
  ['30052','SSR',12,13,0,2,10],
  ['30318','SSR',0,5,0,0,0],
  ['20003','SR',4,4,2,2,0],
  ['30198','SSR',5,5,3,2,0]
 ];
 const cards=[],topology=[],numeric=[];
 for(const [id,rarity,gCount,cCount,ch,rnd,other] of seed){
  const missing=id==='30318';
  const c={cardId:id,rarity,sourceMissing:missing,checkerMissing:id==='10001',
   gameToraObservedCount:gCount,checkerObservedCount:cCount,
   unmatchedCheckerCount:0,unmatchedGameToraCount:0,
   checkerOnly:[],gameToraOnly:[],pairs:[]};
  let stages=Array.from({length:ch},(_,i)=>({
   sourceOrdinal:rnd+i+1,chainOrdinal:i+1,
   sourceLocalEventId:3000+i
  }));
  if(id==='20075'){
   stages=[{sourceOrdinal:3,chainOrdinal:1,sourceLocalEventId:416}];
   c.checkerOnly=[{checkerOrdinal:1,
    sourceKey:'checker:20075:8fd4b0e1da2eeb063087'}];
   c.pairs=[{checkerOrdinal:2,sourceOrdinal:3,sourceLocalEventId:416},
    {checkerOrdinal:3,sourceOrdinal:1,sourceLocalEventId:175},
    {checkerOrdinal:4,sourceOrdinal:2,sourceLocalEventId:176}];
  }
  if(id==='30221'){
   c.checkerOnly=[
    'checker:30221:96a9b18141d8cf7ce729',
    'checker:30221:142abc4e048db36f56b9',
    'checker:30221:c56290b839ef7bbc1c85'].map((sourceKey,i)=>({
     sourceKey,checkerOrdinal:i+1
    }));
   c.pairs=[{checkerOrdinal:4,sourceOrdinal:1},
    {checkerOrdinal:5,sourceOrdinal:2}];
  }
  if(id==='30244')stages=[{sourceOrdinal:3,
   chainOrdinal:1,sourceLocalEventId:1143}];
  if(id==='30286')stages=[{sourceOrdinal:3,
   chainOrdinal:1,sourceLocalEventId:1255}];
  c.unmatchedCheckerCount=c.checkerOnly.length;
  cards.push(c);
  topology.push({cardId:id,rarity,sourceMissing:missing,
   sourceEventCount:gCount,chainEventCount:ch,stages});
  numeric.push({cardId:id,sourceEventCount:gCount,
   sourceChainCount:ch,sourceRandomCount:rnd,
   sourceOtherCount:other,numericParsedHintMentions:id==='30221'?1:2});
 }
 return {
  index:{sourcePins:{checker,gameToraDerived:gt},
   gameVerified:false,cards},
  topology:{sourcePins:{checker,gameToraDerived:gt},
   gameVerified:false,cards:topology},
  numeric:{sourcePins:{checkerIndex:checker,gameToraDerived:gt},
   gameVerified:false,cards:numeric},
  exceptions:{sourcePins:{checker,gameToraDerived:gt},
   gameVerified:false,publicationApproved:false,
   supplementalMissingGTChainReviews:[
    {cardId:'30221',reviewStatus:'PINNED_GT_HAS_NO_CHAIN_STAGES',
     expectedEditorialChainStages:3,fixedGTRecordedChainStages:0,
     checkerRecordedChainStageRows:3,
     additionalIndependentExpectedEventsNotInNeitherPinnedSource:0,
     publicationApproved:false,noAutomaticRuntimeAdoption:true},
    {cardId:'30240',reviewStatus:'PINNED_GT_HAS_NO_CHAIN_STAGES',
     expectedEditorialChainStages:3,fixedGTRecordedChainStages:0,
     checkerRecordedChainStageRows:0,
     additionalIndependentExpectedEventsNotInNeitherPinnedSource:3,
     publicationApproved:false,noAutomaticRuntimeAdoption:true}
   ]}
 };
};
const run=x=>build(x.index,x.topology,x.numeric,x.exceptions,{strict:false});
test('full-roster taxonomy does not assume no-chain friend/scenario or one-stage SSR is missing',()=>{
 const out=run(make()),find=id=>out.cards.find(c=>c.cardId===id);
 assert.equal(out.cardTotal,10);
 assert.equal(out.summary.R_NOT_SUBJECT_TO_CHAIN,1);
 assert.equal(out.summary.NONSTANDARD_ZERO_CHAIN,1);
 assert.equal(out.summary.SOURCE_MISSING,1);
 assert.equal(out.summary.PLAIN_ZERO_CHAIN,2);
 assert.equal(out.summary.SHORT_CHAIN,3);
 assert.equal(out.summary.NORMAL_CHAIN_SHAPE,2);
 assert.equal(out.summary.editorialShortChainCorroborated,2);
 assert.equal(out.summary.editorialMissingChainStageCandidates,7);
 assert.equal(out.summary.editorialMissingStagesAlreadyCheckerOnly,4);
 assert.equal(out.summary.editorialMissingStagesOutsideBothFixedSources,3);
 assert.equal(out.summary.priorityReviewCards,6);
 assert.equal(find('30052').classification,'NONSTANDARD_ZERO_CHAIN');
 assert.equal(find('10001').classification,'R_NOT_SUBJECT_TO_CHAIN');
 assert.equal(find('30244').reviewerStatus,'EDITORIAL_SINGLE_STAGE_INTENTIONAL');
 assert.equal(find('30286').reviewerStatus,'EDITORIAL_SINGLE_STAGE_INTENTIONAL');
 assert.equal(find('20075').reviewerStatus,'EDITORIAL_MISSING_FIRST_SR_STAGE');
 assert.equal(find('20075').numericRewardDisagreementUnresolved,true);
 assert.equal(find('20075').alreadyCountedInCheckerOnly,1);
 assert.equal(find('30240').absentBothFixedSources,3);
 assert.equal(find('30221').alreadyCountedInCheckerOnly,3);
 assert.equal(find('30221').absentBothFixedSources,0);
 assert.equal(find('30318').classification,'SOURCE_MISSING');
 assert.equal(out.sourceProseIncluded,false);
 assert.equal(out.publicationApproved,false);
 assert.equal(out.currentGameplayVerified,false);
 assert.ok(out.cards.every(x=>x.publicationApproved===false&&
   x.game2026Verified===false&&x.noAutomaticRuntimeAdoption===true));
});
test('all-card coverage halts if stage count, source revision or missing-layer distinction changes',()=>{
 const mutate=[
  x=>{x.index.sourcePins.checker='another';},
  x=>{x.topology.cards[0].chainEventCount=2;},
  x=>{x.numeric.cards[0].numericParsedHintMentions=50;
       x.topology.cards[0].stages[0].sourceLocalEventId=999;},
  x=>{x.index.cards.find(c=>c.cardId==='20075').checkerOnly[0].sourceKey='wrong';},
  x=>{x.index.cards.find(c=>c.cardId==='30221').checkerOnly.pop();},
  x=>{x.exceptions.supplementalMissingGTChainReviews[1].
       additionalIndependentExpectedEventsNotInNeitherPinnedSource=0;},
  x=>{x.topology.cards.find(c=>c.cardId==='30286').stages[0].sourceLocalEventId++;},
  x=>{x.index.cards.find(c=>c.cardId==='30052').gameToraObservedCount=2;},
  x=>{x.index.cards.find(c=>c.cardId==='30318').sourceMissing=false;},
  x=>{x.index.cards.push({...x.index.cards[0]});}
 ];
 for(const fn of mutate){
  const x=make();fn(x);
  assert.throws(()=>run(x),/Phase2独立網羅性/);
 }
});
test('priority uses observed source hints only and never treats risk as validated events',()=>{
 const x=make();const res=run(x);
 const k=res.cards.filter(c=>c.reviewPriority<=1);
 assert.ok(k.every(c=>c.classification==='PLAIN_ZERO_CHAIN'||
      c.classification==='SHORT_CHAIN'||
      c.classification==='SOURCE_MISSING'));
 assert.equal(res.scoreUsesObservedHintsOnlyNotPotentialMissingRewards,true);
 assert.equal(res.priorityIsNotEvidenceOfMissingEvents,true);
 assert.equal(res.sourceIsNotAllCurrentEvents,true);
 assert.equal(res.cards.filter(c=>c.cardId==='30240').length,1);
});
