'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../src/core.js');
const {validate,build,replay}=require('../src/phase2_30080_three_choice_repair.cjs');
const source=require('../data/curation/adjudicated/30080_choice_repair.v1.json');
const copy=()=>structuredClone(source);
const model={cards:[{id:'30080'}],cardById:{'30080':{id:'30080'}},
 skillById:{'skill:201591':{id:'skill:201591',name:'ウマ好み'}}};
test('editorial GameWith repair replaces one collapsed GT display row with exactly three selectable routes',()=>{
 const x=build(copy(),{model});
 assert.equal(x.editorialDecision.editorialDecisionComplete,true);
 assert.equal(x.editorialDecision.publicationApproved,false);
 assert.deepEqual(x.summary,{
  sourceGTOptions:1,adoptedSelectableAlternatives:3,adoptedHintFacts:3,
  sourceCard:'30080',sourceEventOrdinal:6,publicEvents:0,
  game2026Verified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 });
 const e=x.provisionalCatalog.cards[0].events[0];
 assert.equal(e.type,'choice');
 assert.deepEqual(e.choices.map(c=>c.id),['option1','option2','option3']);
 assert.deepEqual(e.choices.map(c=>c.rewards[0].skillId),
  Array(3).fill('skill:201591'));
});
test('each option grants the same single Lv3 skill, but absence of choice grants nothing',()=>{
 assert.deepEqual(replay().routes,[]);
 for(let option=1;option<=3;option++){
  const out=replay(option,{model});
  assert.equal(out.routes.length,1);
  assert.equal(out.routes[0].skillId,'skill:201591');
  assert.equal(out.routes[0].level,3);
  assert.equal(out.routes[0].conditional,true);
  assert.equal(out.routes[0].editorialCandidate,true);
  assert.equal(out.publicationApproved,false);
 }
});
test('duplicated paths from the same support card do not count as three providers',()=>{
 const draft=build(copy()).provisionalCatalog.cards[0].events;
 const card={id:'30080',hints:[],events:draft};
 const e=draft[0].id;
 const data={cardById:{'30080':card}};
 const deck={slots:[
  {cardId:'30080',stage:4,choices:{[e]:'option1'},outcomes:{}},
  {cardId:'30080',stage:4,choices:{[e]:'option3'},outcomes:{}}
 ]};
 const result=core.aggregate(deck,data);
 assert.equal(result['skill:201591'].count,1);
 assert.equal(Object.keys(result['skill:201591'].providers).length,2);
 assert.equal(result['skill:201591'].providers[0].routes.length,1);
 assert.equal(result['skill:201591'].providers[1].routes.length,1);
});
test('source drift, swapped choice, invented result, and publication flags fail closed',()=>{
 const mutations=[
  x=>{x.playerSelectableChoiceCount=1;},
  x=>{x.baselineStoredChoiceCount=3;},
  x=>{x.sourceGameToraRevision='floating main';},
  x=>{x.sourceEventLocalId=1393;},
  x=>{x.choices[0].ordinal=2;},
  x=>{x.choices[1].skillHints[0].hintLevel=2;},
  x=>{x.choices[2].skillHints[0].skillNumericId=201592;},
  x=>{x.choices[2].reportedVariableEffects.energyRange[1]=15;},
  x=>{x.choices[0].resultBranchesReported=true;},
  x=>{x.choices[1].choiceAvailabilityConditionVerified=true;},
  x=>{x.gameWith.url='https://example.com';},
  x=>{x.gameToraWebsite.status='EVENT_DETAIL_CONFIRMED';},
  x=>{x.publicationApproved=true;},
  x=>{x.choices[0].publicationApproved=true;},
  x=>{x.sourceProseIncluded=true;},
  x=>{x.choices[0].sourceLabel='copied text';},
  x=>{x.choices.pop();}
 ];
 for(const mutate of mutations){
  const changed=copy();mutate(changed);
  assert.throws(()=>validate(changed),/30080非公開3択構造補正|イベント出典裁定規則/);
 }
 for(const x of [-1,0,4,'2',1.5])
  assert.throws(()=>replay(x),/30080非公開3択構造補正/);
});
test('schema model mismatch and public gating are checked',()=>{
 assert.throws(()=>build(copy(),{model:{cards:[],cardById:{},skillById:{}}}),/イベント検証/);
 assert.throws(()=>build(copy(),{model:{cards:[{id:'30080'}],cardById:model.cardById,skillById:{}}}),/イベント検証/);
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
