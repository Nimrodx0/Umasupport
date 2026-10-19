'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {compile,validate,card}=require('../src/checker_candidate_database.cjs');
const p=url=>({url:'https://raw.githubusercontent.com/'+url,revision:'a'.repeat(40),sha256:'b'.repeat(64)});
const pins=()=>({checker:p('Cilda/UmaUmaChecker/'+'a'.repeat(40)+'/Events.json'),
 cruise:p('po-po-po-pong/umaumacruise_customjson/'+'a'.repeat(40)+'/UmaMusumeLibrary.json'),
 umasimCards:p('mee1080/umasim/'+'a'.repeat(40)+'/support_card.txt'),
 umasimSkills:p('mee1080/umasim/'+'a'.repeat(40)+'/skill_data.txt')});
const key='checker:30001:'+'e'.repeat(20),digest='sha256:'+'f'.repeat(64);
function fixtures(){
 const hints=[
  {skillId:'202992',level:3},
  {skillName:'未照合スキル',resolution:'missing',level:1}
 ];
 const candidates={approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
  stats:{cardsWithCandidates:2,eventsObserved:1,choiceRowsObserved:2,
   extractedHintRows:2,matchedNumericHints:1,unresolvedHints:1,ambiguousHints:0,
   unparsedHintChoiceRows:1,conditionalChoiceRows:1},
  cards:[
   {cardId:'20001',rarity:'SR',events:[]},
   {cardId:'30001',rarity:'SSR',events:[
    {sourceKey:key,sourceDigest:digest,sourceEventOrdinal:1,
     requiresFullReview:true,choices:[
      {ordinal:1,observedHints:[hints[0]],needsManualResultReview:false},
      {ordinal:2,observedHints:[hints[1]],needsManualResultReview:true,
       unparsedHintSyntax:true}
     ]}
   ]}
  ]};
 const reviewQueue=[
  {scope:'choice',cardId:'30001',sourceKey:key,sourceDigest:digest,
   eventOrdinal:1,choiceOrdinal:2,priority:'P0',score:100,
   reasons:['unparsed-hint','missing-skill-id'],observedHintCount:1,
   requiresIndependentReview:true},
  {scope:'card',cardId:'20001',priority:'P2',score:35,
   reasons:['checker-empty'],requiresIndependentReview:true}
 ];
 const queue={approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
  totals:{queueEntries:2,priorityEntries:{P0:1,P1:0,P2:1,P3:0}},
  reviewQueue};
 return {candidates,queue,sourcePins:pins()};
}
test('compile persists every candidate card, skill ID and unresolved hint but never raw article prose',()=>{
 const db=compile(fixtures());
 const stats=validate(db);
 assert.deepEqual(stats,{cards:2,events:1,choices:2,numericHints:1,pendingHints:1,
  reviewEntries:2,priorityEntries:{P0:1,P1:0,P2:1,P3:0}});
 assert.equal(db.forSkillGrant,false);
 assert.equal(card(db,'30001').events[0].choices[0].observedHints[0].skillId,'202992');
 assert.equal(card(db,'20001').events.length,0);
 assert.equal(card(db,'30099'),null);
 assert.ok(!JSON.stringify(db).includes('原文の選択肢'));
});
test('reject attempt to mark candidates publishable or inject rich text, effects and event names',()=>{
 for(const change of [
  d=>d.approvalState='approved',
  d=>d.forSkillGrant=true,
  d=>d.cards[1].events[0].name='元のイベント文章',
  d=>d.cards[1].events[0].choices[0].Effect='原文',
  d=>d.cards[1].events[0].choices[0].observedHints[0].Title='元記事',
  d=>d.cards[1].events[0].choices[0].observedHints[0].skillId='hint:偽ID',
  d=>d.cards[1].events[0].choices[0].observedHints[0].level=-2,
  d=>d.cards[1].events[0].sourceDigest='invalid',
  d=>d.sourcePins.checker.sha256='unchecked',
  d=>d.reviewQueue[0].sourceDigest='sha256:'+'0'.repeat(64),
  d=>d.reviewQueue[0].choiceOrdinal=3,
  d=>d.stats.matchedNumericHints=2
 ]){
  const d=compile(fixtures());change(d);assert.throws(()=>validate(d));
 }
});
test('duplicate cards, duplicated review targets, and false event ordering are rejected',()=>{
 const d=compile(fixtures());d.cards.push(d.cards[1]);
 assert.throws(()=>validate(d),/カード/);
 const v=compile(fixtures());v.reviewQueue.push(v.reviewQueue[0]);
 assert.throws(()=>validate(v),/重複/);
 const o=compile(fixtures());o.cards[1].events[0].ordinal=2;
 assert.throws(()=>validate(o),/順/);
});
