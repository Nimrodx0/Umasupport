'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {make,IDS}=require('../src/missing_four_ssr_skill_fact_candidates.cjs');
function fixtures(){
 const cards=[],rows=[];
 for(const id of IDS){
  const pointers=[],events=[];
  for(let i=0;i<5;i++){
   const sourceKey='checker:'+id+':'+String(i+1).padStart(20,'a'),
    sourceDigest='sha256:'+'b'.repeat(64),titleFingerprint='sha256:'+'c'.repeat(64);
   pointers.push({checkerOrdinal:i+1,sourceKey});
   const effect=id==='30318'&&i===2?"『勇迅円刃』のヒントLv+1":
    id==='30318'&&i===4?"『良バ場◯』のヒントLv+1":'やる気+1';
   events.push({sourceKey,sourceDigest,titleFingerprint,
    options:[{Title:'架空の選択肢',Effect:effect}]});
  }
  rows.push({cardId:id,rarity:'SSR',sourceMissing:true,
   checkerMissing:false,gameToraObservedCount:0,checkerObservedCount:5,
   checkerOnly:pointers});
  cards.push({cardId:id,events});
 }
 const index={schemaVersion:1,dataKind:'umasupport-whole-event-provisional-index',
  publicationApproval:false,gameVerified:false,
  sourcePins:{gameToraDerived:'6e38b54af4fad397ff4491e63007a90705a4fe67',
   checker:'8cf9fcb3cc7239041161be75c84daf9f8f22d29f'},
  cards:rows};
 const skills=[{id:201323,name:'勇迅円刃',rarity:2},
  {id:200152,name:'良バ場○',rarity:1}];
 return {index,cards,skills,strict:false};
}
test('fixed 4 source-missing cards use numeric skill IDs and no event prose',()=>{
 const x=make(fixtures());
 assert.equal(x.totals.missingCards,4);
 assert.equal(x.totals.candidateEvents,20);
 assert.equal(x.totals.numericHintMentions,2);
 assert.equal(x.totals.reviewedGlyphHintMentions,1);
 assert.equal(x.totals.exactNameHintMentions,1);
 assert.equal(x.cards[0].events[2].hintMentions[0].skillNumericId,201323);
 assert.equal(x.cards[0].events[4].hintMentions[0].skillNumericId,200152);
 assert.equal(x.cards[0].events[4].hintMentions[0].rewardConditionVerified,false);
 assert.equal(x.cards[0].events[2].orderingHypothesis,'CHAIN_STAGE_CANDIDATE');
 assert.equal(x.cards[0].events[4].orderingHypothesis,'RANDOM_EVENT_CANDIDATE');
 assert.equal(x.publicationApproved,false);
 assert.equal(x.noAutomaticRuntimeAdoption,true);
 assert.equal(x.currentGameVerified,false);
 const raw=JSON.stringify(x);
 for(const original of ['勇迅円刃','良バ場','架空の選択肢'])assert.equal(raw.includes(original),false);
});
test('unrecognized hint, duplicate source, wrong card, invented approval fail closed',()=>{
 const cases=[
  x=>x.cards[0].events[2].options[0].Effect='未知のヒントLv+5',
  x=>x.cards[0].events[2].options[0].Effect='『未知スキル』のヒントLv+1',
  x=>x.cards[0].events[2].options[0].Effect='『勇迅円刃』のヒントLv+10',
  x=>x.cards[0].events[0].sourceKey='wrong',
  x=>x.cards[0].events.pop(),
  x=>x.index.cards[0].sourceMissing=false,
  x=>x.index.publicationApproval=true,
  x=>x.skills.push({...x.skills[0],id:999})
 ];
 for(const alter of cases){
  const input=fixtures();alter(input);
  assert.throws(()=>make(input),/4SSR未収録スキル候補/);
 }
});
test('roundtrips four source records while refusing extra cards and current-game assertions',()=>{
 const x=fixtures();x.cards.push({cardId:'99999',events:[]});
 assert.throws(()=>make(x),/4SSR未収録スキル候補/);
 const y=fixtures();y.index.gameVerified=true;
 assert.throws(()=>make(y),/4SSR未収録スキル候補/);
});
