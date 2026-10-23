'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_integrated_private_catalog.cjs');
const {digest,verifyRelease}=require('../src/event_release_gate.cjs');
const core=require('../src/core.js');
const {build:build8}=require('../src/phase2_eight_release_candidate.cjs');
const EXPECTED_REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
const CHECKER='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
function fixture(){
 const noop={id:'gt-30080-event-001',name:'他の通常イベント',type:'auto',rewards:[]};
 const old={id:'gt-30080-event-006',name:'補正対象の特殊イベント',type:'auto',
  availabilityKind:'special-trigger',
  rewards:[{skillId:'skill:201591',verifiedSkillName:'ウマ好み',level:3}]};
 const cards=[{cardId:'30080',events:[noop,old]},
  ...[30318,30319,30320,30321].map(i=>({cardId:String(i),sourceMissing:true,events:[]}))];
 const row=(e,i)=>({cardId:'30080',sourceOrdinal:i,
  eventId:e.id,eventSha256:digest(e),
  status:'PENDING_HUMAN_PUBLICATION_REVIEW',releaseApproved:false});
 const rows=[row(noop,1),row(old,6)];
 const pins={gameToraDerived:EXPECTED_REV,checkerIndex:CHECKER};
 return {
  normalized:{dataKind:'gametora-whole-event-numeric-candidate',
   releaseApproved:false,sourcePins:structuredClone(pins),
   cards:[{cardId:'30080',events:[
    {sourceOrdinal:1,eventId:noop.id,sourceLocalEventId:1,section:'random'},
    {sourceOrdinal:6,eventId:old.id,sourceLocalEventId:1392,section:'special',
     choices:[{sourceLabelWasEmpty:true,routes:[{
      numericHintFacts:[{skillNumericId:'201591',level:3}]
     }]}]}
   ]},...cards.slice(1)]},
  enriched:{publicationApproved:false,noAutomaticRuntimeAdoption:true,
   catalog:{schemaVersion:1,cards:[{
    cardId:'30080',coverageStatus:'partial',events:[noop,old]
   }]}},
  review:{dataKind:'gametora-2488-unsigned-publication-review-queue',
   automaticallyReleaseApproved:false,sourcePins:structuredClone(pins),rows},
  triage:{dataKind:'phase2-cross-source-publication-triage',
   publicReleaseApproved:false,sourcePins:structuredClone(pins),rows:rows.map(x=>({
    cardId:x.cardId,sourceOrdinal:x.sourceOrdinal,eventId:x.eventId,
    eventSha256:x.eventSha256,approved:false,
    crossSourceFlags:x.sourceOrdinal===6?
     ['FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE']:[]
   }))}
 };
}
test('all eight independent events and the corrected 30080 are in one validated, unapproved catalog',()=>{
 const input=fixture(),original=structuredClone(input);
 const a=build(input);
 assert.equal(a.dataKind,'phase2-nonpublishing-2496-event-assembled-runtime');
 assert.equal(a.publicationApproved,false);
 assert.equal(a.reviewedEventsPublished,0);
 assert.equal(a.noAutomaticRuntimeAdoption,true);
 assert.equal(a.catalog.cards.length,5);
 assert.equal(a.summary.sourceGTCards,1);
 assert.equal(a.summary.GTSourceEvents,2);
 assert.equal(a.summary.missingGTSSR,4);
 assert.equal(a.summary.totalCandidateEvents,10);
 assert.equal(a.summary.gameWithAddedStandaloneEvents,8);
 assert.equal(a.summary.choiceEvents,9);
 assert.equal(a.summary.autoEvents,1);
 assert.equal(a.summary.unchangedGTEvents,1);
 assert.equal(a.summary.gameWithChoiceOptionsValidated,16);
 assert.equal(a.summary.gameWithSkillHintsValidated,4);
 assert.match(a.summary.catalogSha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(input,original,'the source, unapproved view and editorial review cannot be mutated');
 for(const card of a.catalog.cards.filter(x=>x.cardId!=='30080')){
  assert.equal(card.events.length,2);
  assert.deepEqual(card.events.map(e=>e.id),build8().catalog.cards.find(x=>x.cardId===card.cardId).events.map(e=>e.id));
 }
 const special=a.catalog.cards[0].events[1];
 assert.equal(special.id,'gt-30080-event-006');
 assert.equal(special.availabilityKind,'special-trigger');
 assert.equal(special.choices.length,3);
 const card={id:'30080',hints:[],events:a.catalog.cards[0].events};
 const hintEvents=s=>core.directRoutes(card,{stage:4,choices:s,outcomes:{}})
  .filter(x=>x.source==='event'&&x.eventId===special.id);
 assert.equal(hintEvents({}).length,0);
 for(const id of ['option1','option2','option3']){
  const r=hintEvents({[special.id]:id});
  assert.equal(r.length,1);
  assert.equal(r[0].skillId,'skill:201591');
  assert.equal(r[0].level,3);
  assert.equal(r[0].conditional,true);
 }
 assert.throws(()=>verifyRelease(a.catalog,{schemaVersion:1,entries:[]}),
  /公開イベントに承認証跡がありません/);
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
 assert.deepEqual(require('../config/event-release-approvals.v1.json'),{schemaVersion:1,entries:[]});
});
test('source mapping, title identity and review hashes are checked before joining',()=>{
 const changes=[
  a=>{a.normalized.sourcePins.checkerIndex='wrong'},
  a=>{a.review.sourcePins.checkerIndex='wrong'},
  a=>{a.triage.sourcePins.gameToraDerived='wrong'},
  a=>{a.normalized.cards[1].sourceMissing=false},
  a=>{a.normalized.cards[2].events.push({})},
  a=>{a.enriched.catalog.cards[0].events[0].name='改変'},
  a=>{a.enriched.catalog.cards[0].events[1].rewards[0].level=5},
  a=>{a.review.rows.pop()},
  a=>{a.review.rows[0].releaseApproved=true},
  a=>{a.triage.rows[1].crossSourceFlags=[]},
  a=>{a.triage.rows[0].eventSha256='e'.repeat(64)},
  a=>{a.triage.rows.pop()},
  a=>{a.enriched.catalog.cards.push({cardId:'30318',events:[]})},
  a=>{a.enriched.catalog.cards[0].events[0].id='dup'}
 ];
 for(const change of changes){
  const a=fixture();change(a);
  assert.throws(()=>build(a),'mutation should fail: '+change.toString());
 }
});
test('strict fixed GT 2496/563 gate never passes a small sample',()=>{
 assert.throws(()=>build(fixture(),{strict:true}),
  /固定GTと例外補正を統合した本番候補の全件母数が不一致/);
});
