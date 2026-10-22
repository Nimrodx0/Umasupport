'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {review,REVIEW}=require('../src/phase2_four_ssr_editorial_review.cjs');
function input(){
 const cards=REVIEW.map(rule=>({
  cardId:rule.cardId,rarity:'SSR',sourceCardMissing:true,
  currentGameVerified:false,publicationApproved:false,
  events:rule.optionRows.map((count,i)=>({
   checkerOrdinal:i+1,checkerChoiceRows:count,
   sourceKey:'checker:'+rule.cardId+':'+String(i+1).padStart(20,'a'),
   sourceDigest:'sha256:'+'b'.repeat(64),
   titleFingerprint:'sha256:'+'c'.repeat(64),
   orderingHypothesis:i<3?'CHAIN_STAGE_CANDIDATE':'RANDOM_EVENT_CANDIDATE',
   sourceEffectAlternativesUnverified:true,
   actualGameplaySelectionVerified:false,
   currentGameVerified:false,publicationApproved:false,
   hintMentions:rule.hints.filter(h=>h[0]===i+1).map(h=>({
    checkerOptionOrdinal:h[1],skillNumericId:h[2],hintLevel:h[3],
    rewardConditionVerified:false,choiceIsPlayerSelectableVerified:false
   }))
  }))
 }));
 return {schemaVersion:1,
  dataKind:'missing-gt-four-ssr-numeric-skill-candidate-backfill',
  sourcePins:{
   gameToraDerived:'6e38b54af4fad397ff4491e63007a90705a4fe67',
   checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f',
   independentSkills:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535'
  },
  cards,currentGameVerified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true,sourceProseIncluded:false
 };
}
test('all 20 pinned events, 35 source rows, 12 exact numeric hints verified as editorial candidates only',()=>{
 const out=review(input());
 assert.deepEqual(out.totals,{
  reviewedCards:4,reviewedCandidateEvents:20,reviewedSourceRows:35,
  checkedNumericHintMentions:12,editorialShapeAlignedEvents:17,
  presentationUnresolvedEvents:3,
  reviewedChainPositionCandidates:12,reviewedRandomPositionCandidates:8,
  gameToraLiveEventListCards:3,gameToraLiveRosterOnlyCards:1
 });
 assert.deepEqual(out.cards.flatMap(c=>c.events.filter(e=>
  e.editorialPresentation==='EDITORIAL_PRESENTATION_UNRESOLVED').map(e=>
  [c.cardId,e.checkerOrdinal])),[['30319',5],['30321',2],['30321',3]]);
 assert.equal(out.allGameEventsVerified,false);
 assert.equal(out.selectionSemanticsVerified,false);
 assert.equal(out.publicationApproved,false);
 assert.equal(out.noAutomaticRuntimeAdoption,true);
 const dump=JSON.stringify(out);
 for(const prose of ['勇迅円刃','ひそやかな温もり','仮の選択肢'])
  assert.equal(dump.includes(prose),false);
});
test('incorrect numeric hint IDs, level, outcome position or event row count fail closed',()=>{
 const attacks=[
  x=>{x.cards[0].events[2].hintMentions[0].skillNumericId++;},
  x=>{x.cards[1].events[2].hintMentions[1].hintLevel=5;},
  x=>{x.cards[2].events[4].hintMentions[0].checkerOptionOrdinal=2;},
  x=>{x.cards[3].events[1].checkerChoiceRows=2;},
  x=>{x.cards[0].events[3].orderingHypothesis='CHAIN_STAGE_CANDIDATE';},
  x=>{x.cards[0].events[4].sourceEffectAlternativesUnverified=false;},
  x=>{x.cards[0].events[4].sourceDigest='corrupt';},
  x=>{x.cards.pop();},
  x=>{x.cards[0].publicationApproved=true;},
  x=>{x.publicationApproved=true;},
  x=>{x.sourcePins.checker='another-revision';}
 ];
 for(const alter of attacks){
  const x=input();alter(x);
  assert.throws(()=>review(x),/Phase2未収録4SSRのイベント別照合/);
 }
});
test('avoid converting a third-party presentation discrepancy into fake selectable choices',()=>{
 const r=review(input());
 const disputed=r.cards.find(c=>c.cardId==='30321').events[1];
 assert.equal(disputed.editorialPresentation,'EDITORIAL_PRESENTATION_UNRESOLVED');
 assert.equal(disputed.actualChoiceSemanticsVerified,false);
 assert.equal(disputed.hintGrantConditionVerified,false);
 assert.equal(r.cards.find(c=>c.cardId==='30318').liveGameToraCoverage,
  'EVENT_LIST_3_CHAIN_2_RANDOM');
 assert.equal(r.cards.find(c=>c.cardId==='30320').liveGameToraCoverage,
  'ROSTER_LIST_ONLY');
});
