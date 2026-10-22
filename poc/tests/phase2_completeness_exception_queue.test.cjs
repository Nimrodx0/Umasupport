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
 const {index,docs}=make({cardId:'30052',withResult:false});
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
 card.gameToraOnly[0].sourceLocalEventId=484;
 docs[0].events_ja.ev1={section:'special',id:485,choices:[{label:'',
  segments:[1,2,3].map(i=>({when:[{kind:'scripted',value:['class',i]}],effects:[]}))}]};
 const row=build(index,docs,{strict:false}).queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(row.reviewEvidence.conclusion,'YEAR_CLASS_CONDITIONS_NOT_USER_CHOICES');
 assert.equal(row.reviewEvidence.conditionalOrOutcomeRows,3);
 docs[0].events_ja.ev1.choices[0].segments[2].when[0].value[1]=2;
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
});

test('30010 stage 3 has no player choice: one pinned skill_hint_or effect, two editorial outcome rows',()=>{
 const {index,docs}=make({cardId:'30010',withResult:false});
 const event=docs[0].events_ja.ev4;
 event.id=500;
 index.cards[0].pairs[0].sourceLocalEventId=500;
 event.choices=[{label:'',random_either:false,effects:[
  {type:'skill_hint_or',options:[{skill_id:200581,value:'+1/+3'},
   {skill_id:200582,value:'+1'}]}
 ]}];
 const x=build(index,docs,{strict:false});
 const row=x.queue.find(r=>r.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(row.status,'SOURCE_REPRESENTATION_EXPLAINED');
 assert.equal(row.reviewEvidence.conclusion,
  'NO_PLAYER_SELECTION_TWO_HINT_RESULT_FAMILIES');
 assert.equal(x.stats.choiceCountPending,0);
 assert.equal(row.gameToraFirstChoiceOutcomeCount,0);
 assert.equal(row.sourceIndependentlyVerified,false);
 assert.equal(x.publicationApproved,false);
 const altered=event.choices[0].effects[0].options[0];
 altered.value='+1/+2';
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
 altered.value='+1/+3';
 altered.skill_id=200582;
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
 altered.skill_id=200581;
 event.choices[0].label='fictional player selection';
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
});

test('30052 training-aftercare scenario rows are not player-selectable alternatives',()=>{
 const {index,docs}=make({cardId:'30052',withResult:false});
 const card=index.cards[0], pair=card.pairs[0];
 pair.sourceOrdinal=2;pair.checkerOrdinal=9;
 pair.sourceLocalEventId=1399;
 card.gameToraOnly[0].sourceOrdinal=1;
 card.gameToraOnly[0].sourceLocalEventId=484;
 docs[0].events_ja.ev1={section:'special',id:1399,choices:[
  {label:'',random_either:true,outcomes:[[],[]]}]};
 const checked=build(index,docs,{strict:false});
 const entry=checked.queue.find(x=>x.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(entry.status,'SOURCE_REPRESENTATION_EXPLAINED');
 assert.equal(entry.reviewEvidence.conclusion,'SCENARIO_CONTEXT_ROWS_NOT_PLAYER_CHOICES');
 assert.equal(checked.stats.choiceCountPending,0);
 assert.equal(entry.gameVerified,false);
 assert.equal(checked.publicationApproved,false);
 docs[0].events_ja.ev1.choices[0].outcomes.pop();
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
 docs[0].events_ja.ev1.choices[0].outcomes=[[],[]];
 docs[0].events_ja.ev1.choices[0].label='fake-selection';
 assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
});

test('30080 has 3 independent player choices, while pinned GT collapses them to one identical hint row',()=>{
 const {index,docs}=make({cardId:'30080',withResult:false});
 const card=index.cards[0], pair=card.pairs[0];
 pair.sourceOrdinal=6;pair.checkerOrdinal=5;pair.checkerChoiceCount=3;
 pair.sourceLocalEventId=1392;
 card.gameToraObservedCount=6;
 docs[0].events_ja.ev5={id:1392,section:'special',choices:[{
  label:'',random_either:false,
  effects:[{type:'energy',value:'+10'},
   {type:'skill_hint',skill_id:201591,value:'+3'}]}]};
 const row=build(index,docs,{strict:false});
 assert.equal(row.stats.choiceCountConfirmedSourceGaps,1);
 assert.equal(row.stats.choiceCountExplainedRepresentations,0);
 assert.equal(row.stats.choiceCountPending,0);
 assert.equal(row.stats.needsTargetedSourceReview,3);
 const entry=row.queue.find(e=>e.type==='CHOICE_COUNT_DIFFERENCE');
 assert.equal(entry.status,'FIXED_SOURCE_CHOICE_TOPOLOGY_INCOMPLETE');
 assert.equal(entry.priority,'P1');
 assert.equal(entry.sourceChoiceGapEvidence.expectedPlayerChoiceCount,3);
 const draft=entry.sourceChoiceGapEvidence.privateNumericRepairDraft;
 assert.equal(draft.sourceGameToraStoredChoiceCount,1);
 assert.equal(draft.editorialSelectablePathCount,3);
 assert.equal(draft.sourceOptionTextIncluded,false);
 assert.equal(draft.noAutomaticRuntimeAdoption,true);
 assert.equal(draft.publicationApproved,false);
 assert.equal(draft.game2026Verified,false);
 assert.equal(draft.exactGameSelectionWordingVerified,false);
 assert.deepEqual(draft.choiceNumericCandidates.map(c=>[
  c.sourceEditorialChoiceOrdinal,c.skillNumericId,c.hintLevel
 ]),[[1,201591,3],[2,201591,3],[3,201591,3]]);
 assert.ok(draft.choiceNumericCandidates.every(c=>
  c.outcomeConditionVerified===false&&c.publicationApproved===false));
 assert.equal(JSON.stringify(draft).includes('頭がよくなる'),false);
 assert.equal(entry.sourceChoiceGapEvidence.missingSelectableChoicesRequireRepair,true);
 assert.equal(entry.sourceIndependentlyVerified,false);
 assert.equal(entry.gameVerified,false);
 assert.equal(entry.publicationApproved,false);
 for(const alter of [
  e=>{e.choices[0].effects[1].value='+1';},
  e=>{e.choices[0].effects[1].skill_id=201590;},
  e=>{e.choices[0].label='a';},
  e=>{e.choices[0].random_either=true;},
  e=>{e.choices.push({label:'b'});},
 ]){
  const original=structuredClone(docs[0].events_ja.ev5);
  alter(docs[0].events_ja.ev5);
  assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
  docs[0].events_ja.ev5=original;
 }
});

// Do not collapse one of the two actual GT selectable routes just because
// the correlated Checker record has a single effect/choice row.
for(const rule of [
 {cardId:'30191',sourceOrdinal:1,checkerOrdinal:4,localEventId:179,
  effectKinds:[['mood','speed','bond'],['stamina','bond']],hintId:null},
 {cardId:'30249',sourceOrdinal:1,checkerOrdinal:4,localEventId:231,
  effectKinds:[['power','bond'],['skill_hint','bond']],hintId:201682},
 {cardId:'30255',sourceOrdinal:2,checkerOrdinal:5,localEventId:236,
  effectKinds:[['skill_points','bond'],['skill_hint','bond']],hintId:200602}
]){
 test(rule.cardId+' Checker one-row entry cannot override two GT selectable choices',()=>{
  const {index,docs}=make({cardId:rule.cardId});
  const card=index.cards[0],p=card.pairs[0],eventPos=rule.sourceOrdinal-1;
  p.sourceOrdinal=rule.sourceOrdinal;p.checkerOrdinal=rule.checkerOrdinal;
  p.sourceLocalEventId=rule.localEventId;
  p.checkerChoiceCount=1;p.sourceChoiceCount=2;
  if(rule.sourceOrdinal===2){
   card.gameToraOnly[0].sourceOrdinal=1;
   card.gameToraOnly[0].sourceLocalEventId=484;
  }
  const effect=k=>k==='skill_hint'?{type:k,skill_id:rule.hintId,value:'+1'}:
   {type:k,value:k==='bond'?'+5':'+15'};
  docs[0].events_ja['ev'+eventPos]={
   id:rule.localEventId,section:'random',
   choices:rule.effectKinds.map((k,i)=>({
    label:i===0?'top route':'bottom route',random_either:false,effects:k.map(effect)
   }))
  };
  const got=build(index,docs,{strict:false});
  const row=got.queue.find(e=>e.type==='CHOICE_COUNT_DIFFERENCE');
  assert.equal(row.status,'CHECKER_PARTIAL_CHOICE_ROWS');
  assert.equal(row.priority,'REVIEWED_REPRESENTATION');
  assert.equal(row.checkerChoiceCount,1);
  assert.equal(row.gameToraChoiceCount,2);
  assert.equal(got.stats.choiceCountCheckerPartial,1);
  assert.equal(got.stats.choiceCountPending,0);
  assert.equal(got.stats.needsTargetedSourceReview,2);
  assert.equal(row.checkerPartialEvidence.sourceHasTwoSelectableChoices,true);
  assert.equal(row.checkerPartialEvidence.checkerRawTextRedistributed,false);
  assert.equal(row.gameVerified,false);
  assert.equal(row.publicationApproved,false);
  const changes=[
   e=>{e.choices[0].label='';},
   e=>{e.choices[1].label=e.choices[0].label;},
   e=>{e.choices[0].random_either=true;},
   e=>{e.choices.pop();},
   e=>{e.choices[0].effects[0].type='unknown';}
  ];
  if(rule.hintId!==null)changes.push(
   e=>{e.choices[1].effects[0].skill_id++;},
   e=>{e.choices[1].effects[0].value='+3';}
  );
  for(const modify of changes){
   const original=structuredClone(docs[0].events_ja['ev'+eventPos]);
   modify(docs[0].events_ja['ev'+eventPos]);
   assert.throws(()=>build(index,docs,{strict:false}),/完全性例外台帳/);
   docs[0].events_ja['ev'+eventPos]=original;
  }
 });
}

function make30301Conflict(){
 const {index,docs}=make({cardId:'30301',withResult:false});
 const c=index.cards[0],d=docs[0].events_ja;
 c.checkerObservedCount=5;
 c.checkerOnly=[{checkerOrdinal:1,
  sourceKey:'checker:30301:3b1cb9d61ef50cb538c9'}];
 c.gameToraOnly=[{sourceOrdinal:4,sourceLocalEventId:1294,
  sourceChainOrdinal:2,section:'arrows'}];
 c.pairs=[[2,3],[3,5],[4,1],[5,2]].map(([checkerOrdinal,sourceOrdinal])=>({
  checkerOrdinal,sourceOrdinal,choiceCountAgreement:true
 }));
 d.ev3={id:1294,section:'arrows',choices:[
  {label:'choice above',effects:[
   {type:'energy',value:'+5'},{type:'power',value:'+15'},
   {type:'skill_points',value:'+10'},{type:'bond',value:'+5'}]},
  {label:'choice below',effects:[
   {type:'power',value:'+10'},{type:'skill_points',value:'+5'},
   {type:'skill_hint',skill_id:203352,value:'+1'},
   {type:'bond',value:'+5'}]}
 ]};
 index.attention.choiceCountConflicts=[];
 index.attention.p0Unmatched=[];
 index.stats.pairedChoiceCountConflict=0;
 return {index,docs};
}
test('30301 has two different unpaired observations, never an identity alias',()=>{
 const x=make30301Conflict(),out=build(x.index,x.docs,{strict:false});
 assert.equal(out.stats.identityConflictsReviewedWithoutPairing,1);
 assert.equal(out.stats.checkerOnlyEvents,1);
 assert.equal(out.stats.gameToraOnlyNonR,1);
 assert.equal(out.stats.needsTargetedSourceReview,2);
 assert.equal(out.stats.choiceCountDisagreements,0);
 const a=out.queue.find(e=>e.type==='CHECKER_ONLY');
 const b=out.queue.find(e=>e.type==='GAMETORA_ONLY');
 assert.equal(a.reason,'CHECKER_REPORTED_HINT_NOT_PAIRED_TO_CHAIN_EVENT');
 assert.equal(b.reason,'MISSING_CHECKER_CHAIN_STAGE_TWO_CHOICES');
 assert.equal(a.priority,'P1');assert.equal(b.priority,'P1');
 assert.equal(a.identityConflictEvidence.status,'CROSS_SOURCE_EVENT_IDENTITY_CONFLICT');
 assert.equal(b.identityConflictEvidence.status,'CROSS_SOURCE_EVENT_IDENTITY_CONFLICT');
 assert.equal(a.identityConflictEvidence.mustNotPair,true);
 assert.equal(b.identityConflictEvidence.gameToraBottomSkillNumericId,203352);
 assert.equal(b.identityConflictEvidence.gameToraPlayerSelectableChoices,2);
 assert.equal(b.identityConflictEvidence.trainingHintNatureGameVerified,false);
 assert.equal(b.identityConflictEvidence.publicationApproved,false);
 assert.equal(out.publicationApproved,false);
});
test('30301 data-drift rejects optimistic equivalence and accidental lost choice',()=>{
 const mutations=[
  x=>{x.index.cards[0].checkerOnly[0].sourceKey='wrong';},
  x=>{x.index.cards[0].gameToraOnly[0].sourceOrdinal=1;},
  x=>{x.index.cards[0].pairs[0].sourceOrdinal=4;},
  x=>{x.docs[0].events_ja.ev3.choices.pop();},
  x=>{x.docs[0].events_ja.ev3.choices[0].label='';},
  x=>{x.docs[0].events_ja.ev3.choices[1].random_either=true;},
  x=>{x.docs[0].events_ja.ev3.choices[1].effects[2].skill_id=123;},
  x=>{x.docs[0].events_ja.ev3.choices[1].effects[2].value='+4';},
  x=>{x.docs[0].events_ja.ev3.choices[1].effects[2].type='unknown';}
 ];
 for(const mutate of mutations){
  const x=make30301Conflict();mutate(x);
  assert.throws(()=>build(x.index,x.docs,{strict:false}),/完全性例外台帳/);
 }
});
