'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_publication_readiness.cjs');
const four=require('../data/curation/adjudicated/30318-30320.v1.json');
const duramente=require('../data/curation/adjudicated/30321.v1.json');
const ledger=require('../data/curation/adjudicated_event_facts.v1.json');
const satono=require('../data/curation/adjudicated/30221_chain.v1.json');
const tap=require('../data/curation/adjudicated/20075_stage1.v1.json');
const jungle=require('../data/curation/adjudicated/30240_gamewith_gap.v1.json');
const anshin=require('../data/curation/adjudicated/30080_choice_repair.v1.json');
const inputs=()=>({
 four:structuredClone(four),ssr30321:structuredClone(duramente),
 centralLedger:structuredClone(ledger),ssr30221:structuredClone(satono),
 sr20075:structuredClone(tap),ssr30240:structuredClone(jungle),
 ssr30080:structuredClone(anshin)
});
test('28 targeted cases are counted without pretending to audit all 563 cards',()=>{
 const a=build();
 assert.deepEqual(a.summary,{
  trackedPriorityEventPositions:28,trackedCards:8,
  standaloneOrSpecialPositions:9,chainStagePositions:19,
  gameWithNumericAdopted:25,gameWithNumericUnresolved:3,
  releaseReadyPositions:0,publicEventsAlreadyApproved:0,
  userFacingEventScopeFullyVerified:false,all563CardsCoveredByThisWorklist:false
 });
 assert.equal(a.rows.length,28);
 assert.ok(a.rows.every(x=>x.releaseReady===false&&x.publicationApproved===false&&
  x.evidenceUrls.length>=2&&x.blockers.includes('PUBLICATION_BASIS_NOT_APPROVED')));
 assert.ok(!JSON.stringify(a).includes('option1'));
 assert.ok(a.rows.every(x=>!x.blockers.includes('CURRENT_GAME_FACTS_NOT_CONFIRMED')));
});
test('chain dependency, unadjudicated numeric data and result ambiguity are distinct blockers',()=>{
 const a=build(),of=(card,ord)=>a.rows.find(r=>r.cardId===card&&r.sourceOrdinal===ord);
 assert.equal(a.rows.filter(r=>r.kind==='CHAIN').length,19);
 assert.ok(of('30318',3).blockers.includes('CHAIN_CONTINUATION_AND_TERMINATION_UNVERIFIED'));
 assert.ok(!of('30318',4).blockers.includes('CHAIN_CONTINUATION_AND_TERMINATION_UNVERIFIED'));
 assert.ok(of('30240',3).blockers.includes('GAMEWITH_STAGE_NUMERIC_FACTS_MISSING'));
 assert.ok(of('30240',1).blockers.includes('CHOICE_RESULT_SEMANTICS_UNVERIFIED'));
 assert.ok(of('20075',1).blockers.includes('CHOICE_RESULT_SEMANTICS_UNVERIFIED'));
 assert.ok(of('30080',6).blockers.includes('RANGE_REWARD_RESULT_SEMANTICS_UNVERIFIED'));
 assert.equal(of('30080',6).kind,'SPECIAL');
 assert.equal(of('30321',5).sourceStatus,'GAMEWITH_EDITORIAL_NUMERIC_ADOPTED');
});
test('altered editorial inputs, fake game truth and premature publication cannot be laundered',()=>{
 const changes=[
  d=>{d.four.cards[0].events[0].alternatives[0].effects[0].value=999;},
  d=>{d.ssr30321.events[2].chainPrerequisitesVerified=true;},
  d=>{d.centralLedger.cards[0].events[0].alternatives[0].effects[0].value=500;},
  d=>{d.ssr30221.events[2].skillHints[0].hintLevel=3;},
  d=>{d.sr20075.otherOutcomeEvidence.unlabeledRewardRows.pop();},
  d=>{d.ssr30240.gameWith.factStatus='EXPLICIT';},
  d=>{d.ssr30080.playerSelectableChoiceCount=1;},
  d=>{d.ssr30080.publicationApproved=true;}
 ];
 for(const change of changes){
  const d=inputs();change(d);assert.throws(()=>build(d));
 }
});
test('public release inputs are verified independently, without being edited',()=>{
 const d=inputs();
 d.published={schemaVersion:1,cards:[{cardId:'30318',events:[{
  id:'unapproved',name:'fake',type:'auto',rewards:[]
 }]}]};
 d.releaseApprovals={schemaVersion:1,entries:[]};
 assert.throws(()=>build(d),/公開ゲート/);
 const actual=require('../data/reviewed_events.v1.json');
 const approvals=require('../config/event-release-approvals.v1.json');
 assert.deepEqual(actual.cards,[]);
 assert.deepEqual(approvals.entries,[]);
});
