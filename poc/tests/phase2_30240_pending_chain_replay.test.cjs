'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,simulate,UNVERIFIED}=require('../src/phase2_30240_pending_chain_replay.cjs');
const doc=require('../data/curation/adjudicated/30240_gamewith_gap.v1.json');
const copy=()=>structuredClone(doc);
test('GameWith event section is verification pending: all 3 stages are PENDING, not GameWith-adjudicated',()=>{
 const a=audit(copy());
 assert.deepEqual(a.summary,{
  cardId:'30240',missingFromBothPinnedEventSources:3,
  candidateStagesFromUTools:3,unreviewedSkillHintCandidates:1,
  gameWithAdoptedNumericStageFacts:0,unresolvedGameWithStages:3,
  verifiedChoiceAndChainPaths:0,publicEvents:0,
  game2026Verified:false,publicationApproved:false,
  noAutomaticRuntimeAdoption:true
 });
 assert.equal(a.policyDecisions.length,3);
 assert.ok(a.policyDecisions.every(d=>d.status==='PENDING_GAMEWITH_FACT'&&
  d.holdReason==='GAMEWITH_DOES_NOT_REPORT_REQUIRED_FACT'&&
  d.editorialDecisionComplete===false&&d.publicationApproved===false));
});
test('two explicit opt-ins required for a non-public U-tools-only hypothetical skill route',()=>{
 for(let ordinal=1;ordinal<=3;ordinal++){
  for(const params of [
   {stageOrdinal:ordinal},
   {stageOrdinal:ordinal,assumedStageReachedForSimulation:true},
   {stageOrdinal:ordinal,enableUnadjudicatedCandidateReplay:true}
  ])assert.deepEqual(simulate(params).routes,[]);
  const x=simulate({stageOrdinal:ordinal,assumedStageReachedForSimulation:true,
   enableUnadjudicatedCandidateReplay:true});
  assert.equal(x.status,'UNADJUDICATED_HYPOTHETICAL_REPLAY');
  assert.deepEqual(x.routes.map(r=>[r.skillId,r.level]),
   ordinal===3?[['skill:200591',1]]:[]);
  assert.ok(x.routes.every(r=>r.possibleOnly===true&&
   r.conditional===true&&r.sourceKind===UNVERIFIED&&
   r.manualStageAssertionOnly===true));
 }
});
test('201591 elsewhere, normal GT 202422 and chain candidate 200591 never cross-grant',()=>{
 const final=simulate({stageOrdinal:3,assumedStageReachedForSimulation:true,
   enableUnadjudicatedCandidateReplay:true});
 assert.deepEqual(final.routes.map(r=>r.skillId),['skill:200591']);
 assert.ok(!JSON.stringify(final.routes).includes('202422'));
});
test('real schema validation forbids unresolved skill ID if model lacks it',()=>{
 const ok={cards:[{id:'30240'}],cardById:{'30240':{id:'30240'}},
  skillById:{'skill:200591':{id:'skill:200591'}}};
 assert.equal(simulate({stageOrdinal:3,assumedStageReachedForSimulation:true,
  enableUnadjudicatedCandidateReplay:true},{model:ok}).routes.length,1);
 assert.throws(()=>simulate({stageOrdinal:3,assumedStageReachedForSimulation:true,
  enableUnadjudicatedCandidateReplay:true},{model:{...ok,skillById:{}}}),/イベント検証/);
});
test('number drift, identity swap, GameWith false adoption, invented stage choices or publish flags fail closed',()=>{
 const changes=[
  d=>{d.cardId='30221';},
  d=>{d.cardEdition='新時代を開く者';},
  d=>{d.baselineRandomLocalIds=[167,169];},
  d=>{d.checkerEventCount=5;},
  d=>{d.gameToraWebsite.status='EVENT_LIST';},
  d=>{d.gameWith.url='https://gamewith.jp/uma-musume/article/show/451194';},
  d=>{d.gameWith.factStatus='EXPLICIT';},
  d=>{d.gameWith.reportedPerStageEffectNumbers=true;},
  d=>{d.gameWith.reportedHintLevel=true;},
  d=>{d.currentEditorialDecision='GAMEWITH_ADOPT';},
  d=>{d.corroboration.independentEditorialFamilies=2;},
  d=>{d.corroboration.reportedStages[0].effects[0].value=10;},
  d=>{d.corroboration.reportedStages[2].hintCandidates[0].hintLevel=2;},
  d=>{d.corroboration.playerSelectableChoiceCountVerified=true;},
  d=>{d.corroboration.branchTerminationVerified=true;},
  d=>{d.unresolvedRequiredFacts=[];},
  d=>{d.game2026Verified=true;},
  d=>{d.publicationApproved=true;},
  d=>{d.sourceProseIncluded=true;},
  d=>{d.noAutomaticRuntimeAdoption=false;},
  d=>{d.corroboration.reportedStages[1].name='source text';}
 ];
 for(const mutate of changes){
  const d=copy();mutate(d);assert.throws(()=>audit(d),
   /30240\/GameWith欠損隔離|イベント出典裁定規則/);
 }
 for(const args of [
  {stageOrdinal:0},{stageOrdinal:4},
  {stageOrdinal:3,assumedStageReachedForSimulation:'true'},
  {stageOrdinal:3,enableUnadjudicatedCandidateReplay:1}
 ])assert.throws(()=>simulate(args),/30240\/GameWith欠損隔離/);
});
test('public event DB and approval ledger are not altered',()=>{
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
