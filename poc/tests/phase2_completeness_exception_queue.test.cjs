'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_completeness_exception_queue.cjs');
const gt='6e38b54af4fad397ff4491e63007a90705a4fe67';
const checker='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
function make({cardId='30006',withResult=true}={}){
 const id=Number(cardId);
 const doc={kind:'support',id,events_ja:Object.fromEntries(Array.from({length:5},(_,i)=>[
  'ev'+i,{section:i===4?'arrows':'random',id:484+i,choices:i===4?
   [{label:'',random_either:withResult,outcomes:withResult?[[],[]]:[]}]:[{}]}
 ]))};
 const card={cardId,rarity:'SSR',sourceMissing:false,
  gameToraObservedCount:5,checkerObservedCount:3,
  unmatchedCheckerCount:1,unmatchedGameToraCount:1,
  checkerOnly:[{checkerOrdinal:1,sourceKey:'checker:generic:1'}],
  gameToraOnly:[{sourceOrdinal:2,sourceLocalEventId:485,section:'random'}],
  pairs:[{checkerOrdinal:3,sourceOrdinal:5,
   sourceLocalEventId:488,
   checkerChoiceCount:2,sourceChoiceCount:1,choiceCountAgreement:false}]};
 const index={schemaVersion:1,dataKind:'umasupport-whole-event-provisional-index',
  sourcePins:{checker,gameToraDerived:gt},
  gameVerified:false,publicationApproval:false,rawSourceContentIncluded:false,
  cards:[card],
  attention:{choiceCountConflicts:[{cardId,checkerOrdinal:3,sourceOrdinal:5}],
   p0Unmatched:[{cardId,checkerOrdinal:1,sourceKey:'checker:generic:1'}]},
  stats:{rosterCards:1,gameToraCards:1,checkerUnmatchedEvents:1,
   gameToraUnmatchedEvents:1,pairedChoiceCountConflict:1}};
 return {index,docs:[doc]};
}
test('GameWith no-choice 2-result illustration is reviewed but NOT a game verification',()=>{
 const {index,docs}=make();
 const out=build(index,docs,{strict:false});
 assert.equal(out.stats.checkerOnlyP0,1);
 assert.equal(out.stats.choiceCountDisagreements,1);
 assert.equal(out.stats.choiceCountExplainedRepresentations,1);
 assert.equal(out.stats.choiceCountPending,0);
 assert.equal(out.stats.unresolvedItems,2);
 assert.equal(out.queue.length,3);
 const decision=out.queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(decision.status,'SOURCE_REPRESENTATION_EXPLAINED');
 assert.equal(decision.reviewEvidence.conditionalOrOutcomeRows,2);
 assert.equal(decision.sourceIndependentlyVerified,false);
 assert.equal(decision.gameWithEditorialCorroborated,true);
 assert.equal(out.publicationApproved,false);
 assert.equal(out.allEventsComplete,false);
 assert.ok(!JSON.stringify(out).includes('秘すれば'));
});
test('other non-choice discrepancy stays pending; no global automatic rule',()=>{
 const {index,docs}=make({cardId:'30010',withResult:false});
 const out=build(index,docs,{strict:false});
 assert.equal(out.stats.choiceCountExplainedRepresentations,0);
 assert.equal(out.stats.choiceCountPending,1);
 assert.equal(out.stats.unresolvedItems,3);
 assert.equal(out.queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE').priority,'P1');
});
test('fail closed if confirmed GT outcome topology, source revision, event counts or approval flags drift',()=>{
 const attacks=[
  x=>{x.docs[0].events_ja.ev4.choices[0].outcomes.pop();},
  x=>{x.docs[0].events_ja.ev4.choices[0].random_either=false;},
  x=>{x.docs[0].events_ja.ev4.choices[0].label='select';},
  x=>{x.index.cards[0].gameToraObservedCount=4;},
  x=>{x.index.cards[0].checkerOnly[0].checkerOrdinal=-1;},
  x=>{x.index.stats.checkerUnmatchedEvents=2;},
  x=>{x.index.publicationApproval=true;},
  x=>{x.index.sourcePins.checker='changed';},
  x=>{x.index.cards[0].sourceMissing=true;},
 ];
 for(const attack of attacks){
  const x=make();attack(x);
  assert.throws(()=>build(x.index,x.docs,{strict:false}),/完全性例外台帳/);
 }
});

test('30108 last stage uses prior choice and four success/failure routes, not two new choices',()=>{
 const {index,docs}=make({cardId:'30108'});
 const e=docs[0].events_ja;
 e.ev3.choices=[{},{}];
 e.ev4.choices=[{label:'',random_either:true,outcomes:[[],[],[],[]]}];
 const got=build(index,docs,{strict:false});
 const row=got.queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(row.reviewEvidence.conclusion,'CURRENT_STAGE_HAS_NO_CHOICES_PRIOR_STAGE_TWO_CHOICES');
 assert.equal(row.reviewEvidence.conditionalOrOutcomeRows,4);
 assert.equal(got.stats.choiceCountPending,0);
 e.ev3.choices=[{}];
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
});
test('30207 stage effect alternatives are conditional year-classes, not choices',()=>{
 const {index,docs}=make({cardId:'30207'});
 const card=index.cards[0];const pair=card.pairs[0];
 pair.sourceOrdinal=2;pair.checkerOrdinal=9;pair.checkerChoiceCount=3;
 pair.sourceLocalEventId=485;
 card.gameToraOnly[0].sourceOrdinal=1;
 docs[0].events_ja.ev1={section:'special',id:485,choices:[{label:'',
  segments:[1,2,3].map(i=>({when:[{kind:'scripted',value:['class',i]}],effects:[]}))}]};
 const row=build(index,docs,{strict:false}).queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(row.reviewEvidence.conclusion,'YEAR_CLASS_CONDITIONS_NOT_USER_CHOICES');
 assert.equal(row.reviewEvidence.conditionalOrOutcomeRows,3);
 docs[0].events_ja.ev1.choices[0].segments[2].when[0].value[1]=2;
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
});
