'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_editorial_intake.cjs');
const core=require('../src/core.js');
const fixture=require('../data/curation/adjudicated/30321.v1.json');
const copy=()=>JSON.parse(JSON.stringify(fixture));
const fakeModel={cards:[{id:'30321'}],cardById:{'30321':{id:'30321'}},
 skillById:{'skill:202602':{id:'skill:202602',name:'イグニッション'}}};
test('all five GameWith adjudicated event facts enter an unapproved numerical intake, only standalone two project',()=>{
 const r=build(copy(),{model:fakeModel});
 assert.deepEqual(r.summary,{
  sourceCards:1,editoriallyAdoptedEvents:5,provisionalStandaloneEvents:2,
  blockedChainEvents:3,numericSkillHintMentions:2,
  editorialAdjudicationComplete:true,game2026Verified:false,
  chainDependenciesVerified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true,sourceProseIncluded:false
 });
 assert.deepEqual(r.policyDecisions.map(x=>x.status),
  Array(5).fill('GAMEWITH_ADJUDICATED_GT_GAP'));
 assert.deepEqual(r.provisionalCatalog.cards.map(x=>x.cardId),['30321']);
 assert.deepEqual(r.provisionalCatalog.cards[0].events.map(x=>x.id),[
  'editorial_candidate_30321_random_4',
  'editorial_candidate_30321_random_5'
 ]);
 assert.ok(!JSON.stringify(r.provisionalCatalog).includes('201463'));
 assert.equal(r.policyDecisions.every(x=>x.publicationApproved===false),true);
});
test('real core shows no unselected reward and only the selected normal event hint',()=>{
 const e=build(copy(),{model:fakeModel}).provisionalCatalog.cards[0].events;
 const card={id:'30321',hints:[],events:e};
 const blank=core.directRoutes(card,{stage:4,choices:{},outcomes:{}});
 assert.equal(blank.filter(x=>x.source==='event').length,0);
 const chosen=core.directRoutes(card,{stage:4,
  choices:{'editorial_candidate_30321_random_5':'option2'},outcomes:{}});
 const routes=chosen.filter(x=>x.source==='event');
 assert.equal(routes.length,1);
 assert.equal(routes[0].skillId,'skill:202602');
 assert.equal(routes[0].level,1);
 const other=core.directRoutes(card,{stage:4,
  choices:{'editorial_candidate_30321_random_5':'option1'},outcomes:{}});
 assert.equal(other.some(x=>x.source==='event'),false);
});
test('source drift, altered hints, guessed chain dependencies or release claims fail closed',()=>{
 const mutations=[
  x=>{x.publicationApproved=true;},
  x=>{x.noAutomaticRuntimeAdoption=false;},
  x=>{x.baselineRevision='moving-main';},
  x=>{x.gameWith.url='https://gamewith.jp/uma-musume/article/show/123';},
  x=>{x.events[0].choiceCount=0;},
  x=>{x.events[0].alternatives.pop();},
  x=>{x.events[0].alternatives[0].effects[0].value=16;},
  x=>{x.events[1].alternatives[0].effects[0].value=2;},
  x=>{x.events[4].alternatives[1].skillHints[0].verifiedSkillName='誤名';},
  x=>{x.events[2].alternatives[0].skillHints[0].skillNumericId++;},
  x=>{x.events[2].chainPrerequisitesVerified=true;},
  x=>{x.events[4].alternatives[1].skillHints[0].hintLevel=3;},
  x=>{x.events.push(x.events[4]);},
  x=>{x.events[4].alternatives[1].skillHints[0].verifiedSkillName='';}
 ];
 for(const change of mutations){
  const x=copy();change(x);
  assert.throws(()=>build(x,{model:fakeModel}),/30321編集採用データ|イベント出典裁定規則|イベント検証/);
 }
 const model=copy();
 assert.throws(()=>build(model,{model:{cardById:{},skillById:{}}}),/イベント検証/);
});
test('provisional data is NOT a public release artifact and has no approval records',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.join(__dirname,'..','data');
 const published=JSON.parse(fs.readFileSync(path.join(root,'reviewed_events.v1.json')));
 const approvals=JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','event-release-approvals.v1.json')));
 assert.deepEqual(published.cards,[]);
 assert.deepEqual(approvals.entries,[]);
});
