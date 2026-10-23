'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build,replay,SOURCE_HINTS}=require('../src/phase2_eight_standalone_review_pack.cjs');
const {verifyRelease,digest}=require('../src/event_release_gate.cjs');
const THREE=require('../data/curation/adjudicated/30318-30320.v1.json');
const FOUR=require('../data/curation/adjudicated/30321.v1.json');
const LEDGER=require('../data/curation/adjudicated_event_facts.v1.json');
const clone=()=>({
 remaining:structuredClone(THREE),duramente:structuredClone(FOUR),
 ledger:structuredClone(LEDGER)
});
test('four fixed cards × two standalone events, sixteen alternatives, four numeric skill hints',()=>{
 const p=build();
 assert.equal(p.summary.cards,4);
 assert.equal(p.summary.standaloneEvents,8);
 assert.equal(p.summary.choices,16);
 assert.equal(p.summary.skillHintFacts,4);
 assert.equal(p.summary.unpublishedSourceChainStages,12);
 assert.equal(p.summary.approvedForPublication,0);
 assert.equal(p.summary.currentlyPublishedEvents,0);
 assert.equal(p.summary.sourceEventPositionsAdjudicated,8);
 assert.equal(p.summary.publicDisplayLabelsApproved,0);
 assert.equal(p.summary.reportedAdditionalOutcomeBranches,0);
 assert.deepEqual(p.previewCatalog.cards.map(c=>[c.cardId,c.events.length]),
  [['30318',2],['30319',2],['30320',2],['30321',2]]);
 assert.deepEqual(p.records.map(r=>r.sourceOrdinal),[4,5,4,5,4,5,4,5]);
 const got=p.records.flatMap(r=>r.choiceFacts.flatMap(c=>
  c.skillHints.map(h=>[r.cardId,r.sourceOrdinal,c.choiceOrdinal,
   h.skillNumericId,h.hintLevel])));
 assert.deepEqual(got,SOURCE_HINTS);
 assert.ok(p.records.every(r=>r.sourceEventPositionAdjudicated===true&&
  r.neutralDisplayDraft.choices.length===2&&
  r.blockers.includes('PUBLICATION_BASIS_NOT_APPROVED')&&
  !r.blockers.some(x=>x.includes('GAME')||x.includes('REAL_EVENT_IDENTITY'))));
});
test('unique neutral labels do not purport to be game event names or expose copied source prose',()=>{
 const p=build();
 for(const card of p.previewCatalog.cards)
  for(const e of card.events){
   assert.match(e.id,new RegExp('^editorial_candidate_'+card.cardId+'_random_[45]$'));
   assert.match(e.name,/^通常イベント候補[45]$/);
   assert.equal(e.type,'choice');
   assert.deepEqual(e.choices.map(c=>[c.id,c.label]),
    [['option1','選択肢1'],['option2','選択肢2']]);
   assert.equal(e.requires,undefined);
   assert.equal(e.outcomes,undefined);
  }
 assert.equal(p.sourceProseIncluded,false);
 assert.equal(p.gameDataIdentityOrPublicationApproved,false);
 assert.equal(p.noAutomaticRuntimeAdoption,true);
 const x=p.records.find(r=>r.cardId==='30319'&&r.sourceOrdinal===5);
 assert.equal(x.supplementaryEventUrl,'https://gamewith.jp/uma-musume/article/show/289111');
 assert.ok(p.records.filter(r=>r.supplementaryEventUrl).length===1);
});
test('actual deck core never grants unselected choices and only grants selected source hint',()=>{
 const expected=new Map(SOURCE_HINTS.map(x=>[x[0]+'/'+x[1],[x[2],x[3],x[4]]]));
 for(const r of build().records){
  assert.deepEqual(replay({cardId:r.cardId,sourceOrdinal:r.sourceOrdinal}).routes,[]);
  for(const choiceOrdinal of [1,2]){
   const routes=replay({cardId:r.cardId,sourceOrdinal:r.sourceOrdinal,choiceOrdinal}).routes;
   const g=expected.get(r.cardId+'/'+r.sourceOrdinal);
   assert.deepEqual(routes.map(x=>[x.skillId,x.level]),
    g&&g[0]===choiceOrdinal?[['skill:'+g[1],g[2]]]:[]);
   assert.ok(routes.every(x=>x.publicationApproved===false&&
    x.editorialPreviewOnly===true));
  }
 }
 for(const args of [{cardId:'30318',sourceOrdinal:3},
  {cardId:'30318',sourceOrdinal:5,choiceOrdinal:3},
  {cardId:'30322',sourceOrdinal:4,choiceOrdinal:2}])
  assert.throws(()=>replay(args),/4SSR・通常8件の非公開表示レビュー/);
});
test('numeric drift, wrong card, altered skill level and invented verified route fail closed',()=>{
 const tests=[
  d=>{d.remaining.cards[0].events[3].alternatives[0].effects[0].value=77;},
  d=>{d.remaining.cards[1].events[4].alternatives[1].skillHints[0].skillNumericId=200152;},
  d=>{d.remaining.cards[2].events[3].choiceCount=1;},
  d=>{d.remaining.cards[0].events[3].section='CHAIN';},
  d=>{d.duramente.events[4].alternatives[1].skillHints[0].hintLevel=7;},
  d=>{d.ledger.cards[0].events[4].publicationApproved=true;},
  d=>{d.duramente.publicationApproved=true;},
  d=>{d.remaining.currentGameplayVerified=true;}
 ];
 for(const edit of tests){const x=clone();edit(x);assert.throws(()=>build(x));}
});
test('a ready-looking draft is never implicitly released by review pack',()=>{
 const p=build();
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
 assert.throws(()=>verifyRelease(p.previewCatalog,{schemaVersion:1,entries:[]}),
  /承認証跡/);
 const sample=p.previewCatalog.cards[0].events[0];
 assert.equal(typeof digest(sample),'string');
 assert.equal(digest(sample).length,64);
});
