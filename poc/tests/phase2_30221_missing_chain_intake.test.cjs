'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,replay}=require('../src/phase2_30221_missing_chain_intake.cjs');
const fixture=require('../data/curation/adjudicated/30221_chain.v1.json');
const copy=()=>structuredClone(fixture);
test('KFC SSR30221 only: three 0-choice stages with GameWith numerical facts, not a guaranteed chain',()=>{
 const a=audit();
 assert.deepEqual(a.summary,{
  cardId:'30221',missingGtChainStages:3,
  editoriallyAdoptedChainStages:3,nonSkillNumericEffectFacts:9,
  numericSkillHintFacts:1,checkerOnlyPositionsReused:3,
  newlyDiscoveredEventsOutsideBothSources:0,
  verifiedContinuationEdges:0,publicEvents:0,
  chainRouteVerified:false,game2026Verified:false,
  publicationApproved:false,noAutomaticRuntimeAdoption:true
 });
 assert.deepEqual(a.policyDecisions.map(x=>x.status),
  Array(3).fill('GAMEWITH_ADJUDICATED_GT_GAP'));
 assert.ok(a.policyDecisions.every(x=>x.publicationApproved===false));
});
test('observed stage is required; first two stages have no skill, final grants only Lv1 ID201351',()=>{
 for(let ordinal=1;ordinal<=3;ordinal++){
  assert.deepEqual(replay({stageOrdinal:ordinal,observed:false}).routes,[]);
  const result=replay({stageOrdinal:ordinal,observed:true});
  assert.equal(result.status,'MANUAL_STAGE_REPLAY');
  assert.deepEqual(result.routes.map(x=>[x.skillId,x.level]),
   ordinal===3?[['skill:201351',1]]:[]);
  assert.ok(result.routes.every(x=>x.manualStageAssertionOnly&&x.conditional));
 }
});
test('the real event catalog validator validates only explicitly reached non-public stage',()=>{
 const model={cards:[{id:'30221'}],cardById:{'30221':{id:'30221'}},
  skillById:{'skill:201351':{id:'skill:201351',name:'食いしん坊'}}};
 assert.equal(replay({stageOrdinal:3,observed:true},{model}).routes.length,1);
 assert.throws(()=>replay({stageOrdinal:3,observed:true},
 {model:{...model,skillById:{}}}),/イベント検証/);
});
test('wrong Satono Diamond edition, numeric drift, staged continuation, and approval fail closed',()=>{
 const changes=[
  d=>{d.cardId='30222';},d=>{d.cardTitleIdentity='百花の願いをこの胸に';},
  d=>{d.gameWith.url='https://gamewith.jp/uma-musume/article/show/431690';},
  d=>{d.gameToraWebsite.url='https://gametora.com/ja/umamusume/supports/30240-jungle-pocket';},
  d=>{d.gameToraBaselineEventIds=[107,108,109];},
  d=>{d.checkerOnlySourceKeys.reverse();},
  d=>{d.events[0].numericEffects[0].value=15;},
  d=>{d.events[1].playerSelectableChoices=2;},
  d=>{d.events[2].skillHints[0].skillNumericId=202151;},
  d=>{d.events[2].skillHints[0].hintLevel=2;},
  d=>{d.events[1].continuationDecision='CONTINUES';},
  d=>{d.events[2].requires={all:[{eventId:'invented'}]};},
  d=>{d.game2026Verified=true;},d=>{d.publicationApproved=true;},
  d=>{d.noAutomaticRuntimeAdoption=false;},d=>{d.sourceProseIncluded=true;},
  d=>{d.events.pop();}
 ];
 for(const mutate of changes){
  const c=copy();mutate(c);
  assert.throws(()=>audit(c),/SSR30221連続イベント採用|イベント出典裁定規則/);
 }
 for(const params of [
  {stageOrdinal:1,observed:'true'},{stageOrdinal:0,observed:true},
  {stageOrdinal:4,observed:true},{stageOrdinal:3}
 ])assert.throws(()=>replay(params),/SSR30221連続イベント採用/);
});
test('public reviewed events and release approvals remain empty',()=>{
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
