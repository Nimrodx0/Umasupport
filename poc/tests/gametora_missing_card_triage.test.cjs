'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {triage}=require('../src/gametora_missing_card_triage.cjs');
const pin='a'.repeat(40);
function row(id,gt,checker){return {
 cardId:String(id),rarity:'SR',sourceMissing:!gt,checkerMissing:!checker,
 gameToraObservedCount:gt?3:0,checkerObservedCount:checker?2:0,
 pairs:[],gameToraOnly:gt?[{sourceOrdinal:1}]:[],
 checkerOnly:checker?[{checkerOrdinal:1},{checkerOrdinal:2}]:[]
};}
function index(){return {
 schemaVersion:1,dataKind:'umasupport-whole-event-provisional-index',
 publicationApproval:false,gameVerified:false,allActualEventsVerified:false,
 rawSourceContentIncluded:false,
 sourcePins:{checker:pin,gameToraDerived:pin},
 stats:{rosterCards:3,gameToraCards:1,cardsOnlyChecker:1,cardsNeither:1},
 cards:[row(20002,true,false),row(10001,false,true),row(30012,false,false)]
};}
const options={expectedRoster:3,expectedGameTora:1,expectedMissing:2};
test('missing two source cards are distinguished from missing in-game events',()=>{
 const r=triage(index(),options);
 assert.equal(r.counts.missingSourceCards,2);
 assert.equal(r.counts.checkerProvisionalOnlyCards,1);
 assert.equal(r.counts.neitherSourceCards,1);
 assert.equal(r.counts.checkerCandidateEventsOnMissingCards,2);
 assert.deepEqual(r.missingCards.map(x=>[x.cardId,x.alternateStatus,x.checkerCandidateOrdinals]),
  [['10001','CHECKER_PROVISIONAL_ONLY',[1,2]],
   ['30012','NO_CHECKER_SOURCE_RECORD',[]]]);
 assert.equal(r.currentGameVerified,false);
 assert.equal(r.checkerIsIndependentEvidence,false);
 assert.equal(r.publicationApproved,false);
});
test('an explicitly present Checker record with zero events does not imply absent source',()=>{
 const d=index();const c=d.cards[1];c.checkerObservedCount=0;c.checkerOnly=[];
 const t=triage(d,options);
 assert.equal(t.missingCards[0].alternateStatus,'CHECKER_RECORD_WITHOUT_EVENTS');
 assert.equal(t.counts.checkerCandidateEventsOnMissingCards,0);
});
test('fail closed for duplicate ID, count tampering, source/content contradiction or public flags',()=>{
 const scenarios=[
  d=>{d.cards[2].cardId='10001';},
  d=>{d.cards[1].gameToraObservedCount=1;},
  d=>{d.cards[1].checkerObservedCount=5;},
  d=>{d.cards[1].pairs.push({sourceOrdinal:1});},
  d=>{d.cards[2].sourceMissing=false;},
  d=>{d.publicationApproval=true;},
  d=>{d.gameVerified=true;},
  d=>{d.sourcePins.checker='bad';},
  d=>{d.stats.cardsOnlyChecker=2;},
 ];
 for(const mutate of scenarios){
  const x=index();mutate(x);assert.throws(()=>triage(x,options),/監査/);
 }
});
