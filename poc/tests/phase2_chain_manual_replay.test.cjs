'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,replay,PENDING,HINT_CONDITION}=require('../src/phase2_chain_manual_replay.cjs');
const remaining=require('../data/curation/adjudicated/30318-30320.v1.json');
const duramente=require('../data/curation/adjudicated/30321.v1.json');
const ledger=require('../data/curation/adjudicated_event_facts.v1.json');
const copy=()=>({
 remaining:structuredClone(remaining),
 duramente:structuredClone(duramente),
 ledger:structuredClone(ledger)
});
test('fixed 4 SSRs expose 12 chain stages and 15 UNKNOWN per-choice transitions, never 15 verified edges',()=>{
 const a=audit();
 assert.deepEqual(a.summary,{
  sourceCards:4,chainStages:12,reportedChainAlternatives:19,
  unresolvedPossibleTransitions:15,establishedTransitions:0,
  numericChainSkillHintFacts:8,nonPublicRandomEventDrafts:8,
  publicEvents:0,chainDependenciesVerified:false,
  currentGameplayVerified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 });
 assert.deepEqual([...a.cards.keys()],['30318','30319','30320','30321']);
 assert.deepEqual(a.evidence.map(x=>x.reportedPlayerSelectableChoices),
  [2,2,0,2,2,0,2,2,0,2,0,0]);
 assert.ok(a.transitions.every(t=>t.continuationStatus===PENDING&&
  t.terminationStatus===PENDING&&t.sourceHasNoExplicitPerAlternativeRouteClaim));
 assert.equal(a.evidence.some(x=>x.priorStageDependenceVerified),false);
});
test('no observed stage, or a stage awaiting a player choice, never creates an event skill route',()=>{
 for(const cardId of ['30318','30319','30320','30321']){
  for(let ordinal=1;ordinal<=3;ordinal++){
   const absent=replay({cardId,stageOrdinal:ordinal,observed:false});
   assert.equal(absent.status,'STAGE_NOT_ASSERTED');
   assert.deepEqual(absent.routes,[]);
   const manual=replay({cardId,stageOrdinal:ordinal,observed:true});
   if(manual.status==='AWAITING_MANUAL_CHOICE')
    assert.deepEqual(manual.routes,[]);
   for(const row of manual.routes){
    assert.equal(row.conditional,true);
    assert.equal(row.condition,HINT_CONDITION);
    assert.equal(row.manualStageAssertionOnly,true);
   }
  }
 }
});
test('explicit manual stage and selected ordinal replay only the documented hints',()=>{
 const expected=[
  ['30318',3,null,[[201323,1]]],
  ['30319',2,1,[[204412,1]]],
  ['30319',2,2,[]],
  ['30319',3,null,[[202371,1],[204151,2]]],
  ['30320',2,1,[[201651,1]]],
  ['30320',2,2,[]],
  ['30320',3,null,[[203801,2],[204721,1]]],
  ['30321',3,null,[[201463,1]]]
 ];
 for(const [cardId,stageOrdinal,selectedOptionOrdinal,hints] of expected){
  const t=replay({cardId,stageOrdinal,observed:true,selectedOptionOrdinal});
  assert.equal(t.status,'MANUAL_STAGE_REPLAY');
  assert.deepEqual(t.routes.map(x=>[x.skillId,x.level]),
   hints.map(([id,lv])=>['skill:'+id,lv]));
  assert.ok(t.routes.every(x=>x.source==='event'&&x.conditional&&
   x.manualStageAssertionOnly));
 }
 for(const cardId of ['30318','30319','30320','30321']){
  const first=replay({cardId,stageOrdinal:1,observed:true,selectedOptionOrdinal:1});
  assert.equal(first.routes.length,0);
 }
});
test('unobserved final stage cannot be inferred from earlier choices on any of four cards',()=>{
 for(const cardId of ['30318','30319','30320','30321']){
  const first=replay({cardId,stageOrdinal:1,observed:true,selectedOptionOrdinal:2});
  assert.deepEqual(first.routes,[]);
  const final=replay({cardId,stageOrdinal:3,observed:false});
  assert.deepEqual(final.routes,[]);
 }
});
test('source discrepancy, fake chain routes and publication claims fail closed',()=>{
 for(const mutate of [
  x=>{x.remaining.cards[0].events[1].chainPrerequisitesVerified=true;},
  x=>{x.remaining.cards[1].events[2].alternatives[0].skillHints[1].hintLevel=4;},
  x=>{x.remaining.cards[2].events[0].choiceCount=0;},
  x=>{x.duramente.events[2].alternatives[0].skillHints[0].hintLevel=2;},
  x=>{x.ledger.cards[3].events[2].skillHints[0].hintLevel=2;},
  x=>{x.remaining.publicationApproved=true;},
  x=>{x.duramente.currentGameplayVerified=true;}
 ]){
  const d=copy();mutate(d);
  assert.throws(()=>audit(d));
 }
});
test('no stage assertion, invalid choice indexes, and guessed options are rejected',()=>{
 const bad=[
  {cardId:'30319',stageOrdinal:0,observed:true},
  {cardId:'30319',stageOrdinal:4,observed:true},
  {cardId:'30319',stageOrdinal:3,observed:true,selectedOptionOrdinal:1},
  {cardId:'30321',stageOrdinal:2,observed:true,selectedOptionOrdinal:1},
  {cardId:'30320',stageOrdinal:2,observed:true,selectedOptionOrdinal:3},
  {cardId:'30320',stageOrdinal:2,observed:false,selectedOptionOrdinal:1},
  {cardId:'30318',stageOrdinal:3,observed:'true'},
  {cardId:'unknown',stageOrdinal:1,observed:true}
 ];
 for(const x of bad)assert.throws(()=>replay(x),/4SSR連続段階・手動到達再現/);
});
test('schema validation can independently check manually projected numeric skill IDs',()=>{
 const ok={cards:[{id:'30319'}],cardById:{'30319':{id:'30319'}},
  skillById:{
   'skill:202371':{id:'skill:202371'},
   'skill:204151':{id:'skill:204151'}
  }};
 const r=replay({cardId:'30319',stageOrdinal:3,observed:true},{model:ok});
 assert.equal(r.routes.length,2);
 assert.throws(()=>replay({cardId:'30319',stageOrdinal:3,observed:true},
  {model:{cards:ok.cards,cardById:ok.cardById,skillById:{}}}),/イベント検証/);
});
test('public event data and approval ledger remain empty while manual chain replay exists',()=>{
 const published=require('../data/reviewed_events.v1.json');
 const release=require('../config/event-release-approvals.v1.json');
 assert.deepEqual(published.cards,[]);
 assert.deepEqual(release.entries,[]);
});
