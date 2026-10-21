'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inventory}=require('../src/gametora_event_resolution.cjs');
const policy=require('../config/event-source-priority.v1.json');
const articleUrl='https://gamewith.jp/uma-musume/article/show/261695';
const doc=()=>({kind:'support',id:30026,events_ja:{
 a:{section:'arrows',id:1,name:'Do not export this private text',choices:[
  {label:'first',outcomes:[
   [{type:'skill_hint',skill_id:1234,value:2}],
   [{type:'chain_end'}]]},
  {label:'second',effects:[{type:'chain_end'}]}]},
 b:{section:'random',id:2,choices:[{effects:[]}]},
 c:{section:'arrows',id:3,choices:[
  {label:'next',effects:[{type:'both_previous_chain_good'},{type:'skill_hint',skill_id:789,value:3}]},
  {label:'other',effects:[]}]}
}});
const decision=(terminal=true)=>({
 sourceOrdinal:1,choiceOrdinal:1,routeOrdinal:1,terminal,
 url:articleUrl,articleSha256:'sha256:'+'c'.repeat(64),
 reviewer:'manual',reviewedAt:'2026-10-21'});
const issue=(sourceOrdinal=1,choiceOrdinal=1,routeOrdinal=1)=>({
 sourceOrdinal,choiceOrdinal,routeOrdinal,reason:'MISMATCH'
});
const input=(changes={})=>({document:doc(),revision:policy.baselineRevision,...changes});
test('GameTora defaults to ordinary continuation and explicit chain_end without GameWith at all',()=>{
 const a=inventory(input());
 assert.equal(a.cardId,'30026');
 assert.equal(a.stats.stages,2);
 assert.equal(a.stats.routes,5);
 assert.equal(a.stats.baselineOrdinary,1);
 assert.equal(a.stats.baselineExplicitTerminal,2);
 assert.equal(a.stats.baselineFinalStage,2);
 assert.equal(a.stats.gameWithAdjudicated,0);
 const first=a.stages[0].routes;
 assert.equal(first[0].decisionStatus,'baseline-ordinary-continuation');
 assert.equal(first[0].nextSourceOrdinalCandidate,3);
 assert.equal(first[1].selectedTerminal,true);
 assert.equal(first[2].selectedTerminal,true);
 assert.equal(a.stages[1].routes[0].decisionStatus,'baseline-final-stage');
 assert.deepEqual(a.stages[1].routes[0].conditionMarkers,['both_previous_chain_good']);
 assert.equal(a.sourceOrderAdjacencyVerified,false);
 assert.equal(a.gameVerified,false);
 assert.equal(a.publicationApproved,false);
 assert.equal(JSON.stringify(a).includes('Do not export'),false);
});
test('flagged single route asks GameWith, other GameTora routes stay unchanged',()=>{
 const a=inventory(input({flaggedRoutes:[issue()],gameWithDecisions:[decision(true)]}));
 assert.equal(a.stats.gameWithAdjudicated,1);
 assert.equal(a.stats.baselineExplicitTerminal,2);
 assert.equal(a.stages[0].routes[0].decisionStatus,'gamewith-adjudicated');
 assert.equal(a.stages[0].routes[0].selectedTerminal,true);
 assert.equal(a.stages[0].routes[1].decisionStatus,'baseline-explicit-terminal');
 assert.equal(a.stages[1].routes[0].decisionStatus,'baseline-final-stage');
});
test('GameTora remains source baseline when dispute is unresolved',()=>{
 const a=inventory(input({flaggedRoutes:[issue()]}));
 assert.equal(a.stats.pendingGameWith,1);
 assert.equal(a.stages[0].routes[0].selectedTerminal,null);
 assert.equal(a.stages[0].routes[0].baselineProgression,'ordinary-continuation');
 assert.equal(a.stages[0].routes[1].selectedTerminal,true);
});
test('missing or invalid GameWith reviews cannot rewrite arbitrary routes',()=>{
 assert.throws(()=>inventory(input({gameWithDecisions:[decision()]})),/疑義のない/);
 assert.throws(()=>inventory(input({
  flaggedRoutes:[issue()],gameWithDecisions:[{...decision(),url:'https://gamewith.jp.evil.test/x'}]
 })),/GameWith裁定/);
 assert.throws(()=>inventory(input({flaggedRoutes:[issue(999)]})),/存在しません/);
 assert.throws(()=>inventory(input({
  flaggedRoutes:[issue(3,1,1)],gameWithDecisions:[{...decision(false),sourceOrdinal:3}]
 })),/最終段階/);
});
test('duplicate flagged positions and wrong GT source revision fail closed',()=>{
 assert.throws(()=>inventory(input({flaggedRoutes:[issue(),issue()]})),/重複/);
 assert.throws(()=>inventory(input({revision:'a'.repeat(40)})),/基準スナップショット/);
 assert.throws(()=>inventory(input({document:{kind:'support',id:30026,events_ja:{
  a:{section:'arrows',choices:[]}}}})),/選択肢が欠落/);
});
