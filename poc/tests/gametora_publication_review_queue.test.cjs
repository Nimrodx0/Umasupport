'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {build}=require('../src/gametora_publication_review_queue.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const titleHash=s=>'sha256:'+crypto.createHash('sha256').update(s).digest('hex');
function fixture(){
 const catalogEvents=[1,2].map(i=>({
  id:'gt-30200-event-00'+i,name:'架空イベント'+i,type:'choice',
  choices:[{id:'choice-01',label:'独自ラベル',rewards:[]}]
 }));
 const sources=catalogEvents.map((ev,i)=>({
  sourceOrdinal:i+1,eventId:ev.id,
  sourceTitleFingerprint:titleHash(ev.name),section:i?'arrows':'random',
  reviewReasons:i?['CONDITIONAL_SEGMENT_REQUIRES_REVIEW']:[],
  choices:[{choiceOrdinal:1}]
 }));
 const normalized={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,noEventCanPublishFromThisCandidate:true,
  sourcePins:{gameToraDerived:'a'.repeat(40),checkerIndex:'b'.repeat(40)},
  totals:{sourceEvents:2,baselineCards:1,missingBaselineCards:1},
  cards:[{cardId:'30200',events:sources},
   {cardId:'30318',sourceMissing:true,events:[]}]};
 const enriched={publicationApproved:false,noAutomaticRuntimeAdoption:true,
  sourceChoiceOrOutcomeProseIncluded:false,
  summary:{shortTitlesJoined:2,shortTitlesNeedsReview:0},
  catalog:{schemaVersion:1,cards:[{cardId:'30200',events:catalogEvents}]},
  manifest:catalogEvents.map((ev,i)=>({
   cardId:'30200',eventId:ev.id,sourceOrdinal:i+1,
   sourceHeadingSha256:sources[i].sourceTitleFingerprint,
   eventSha256:digest(ev),status:'SHORT_HEADING_JOINED_NOT_APPROVED'
  }))
 };
 const block={cardId:'30200',sourceOrdinal:1,eventId:catalogEvents[0].id,
  reason:'SKILL_ID_NOT_IN_BASELINE'};
 const baselineReport={dataKind:'gametora-app-schema-dry-run',
  publicationApproved:false,excludedSourcePositions:[block],
  totals:{skippedEvents:1}};
 const completeReport={dataKind:'gametora-app-schema-dry-run',
  publicationApproved:false,excludedSourcePositions:[],
  totals:{skippedEvents:0,candidateSchemaEvents:2}};
 return {normalized,enriched,baselineReport,completeReport};
}
test('two numeric candidates become an unsigned, source-linked audit queue',()=>{
 const f=fixture(),q=build(f);
 assert.equal(q.summary.events,2);
 assert.equal(q.summary.sourceCards,1);
 assert.equal(q.summary.missingSourceCards,1);
 assert.equal(q.summary.baselineMissingSkillProjection,1);
 assert.equal(q.summary.reviewMarkedEvents,1);
 assert.equal(q.summary.normalSourceEvents,0);
 assert.equal(q.summary.approvedEvents,0);
 assert.equal(q.summary.awaitingHumanPublicationReview,2);
 assert.deepEqual(q.humanReviewCategories,
  ['card','event','choices','outcomes','dependencies','publication']);
 assert.equal(q.automaticallyReleaseApproved,false);
 assert.ok(q.rows.every(x=>x.status==='PENDING_HUMAN_PUBLICATION_REVIEW'&&
  x.releaseApproved===false&&/^[a-f0-9]{64}$/.test(x.eventSha256)));
 assert.equal(q.rows[0].baselineExclusionReason,'SKILL_ID_NOT_IN_BASELINE');
 assert.ok(q.rows[0].blockers.includes('BASELINE_SKILL_REGISTRY_GAP'));
 assert.deepEqual(q.rows[1].sourceReasonCodes,['CONDITIONAL_SEGMENT_REQUIRES_REVIEW']);
 assert.ok(q.rows[1].blockers.includes('SOURCE_BRANCH_OR_EFFECT_NEEDS_REVIEW'));
 assert.equal(q.sourceNarrativeOrChoiceProseIncluded,false);
 assert.ok(!JSON.stringify(q).includes('架空イベント'));
 assert.ok(!JSON.stringify(q).includes('独自ラベル'));
 assert.ok(!JSON.stringify(q).includes('rewards'));
});
test('all source identity, manifest and event SHA drift is blocked',()=>{
 const alters=[
  f=>{f.normalized.cards[0].events[0].sourceOrdinal=2},
  f=>{f.normalized.cards[0].events[1].eventId='gt-30200-event-001'},
  f=>{f.normalized.cards[0].events[0].reviewReasons=['bad marker']},
  f=>{f.enriched.manifest[0].sourceHeadingSha256='sha256:'+'a'.repeat(64)},
  f=>{f.enriched.manifest[0].eventSha256='1'.repeat(64)},
  f=>{f.enriched.catalog.cards[0].events[0].name='edited after SHA'},
  f=>{f.enriched.catalog.cards[0].events[0].id='different'},
  f=>{f.enriched.manifest.pop()},
  f=>{f.baselineReport.excludedSourcePositions[0].eventId='wrong'},
  f=>{f.completeReport.excludedSourcePositions.push({
   cardId:'30200',sourceOrdinal:2,eventId:'gt-30200-event-002',reason:'BAD'})},
  f=>{f.normalized.noEventCanPublishFromThisCandidate=false},
  f=>{f.enriched.publicationApproved=true},
  f=>{f.baselineReport.totals.skippedEvents=2}
 ];
 for(const edit of alters){const f=fixture();edit(f);assert.throws(()=>build(f));}
});
test('event with no additional source anomalies is STILL unsigned and not releasable',()=>{
 const f=fixture();
 f.baselineReport.excludedSourcePositions=[];
 f.baselineReport.totals.skippedEvents=0;
 f.normalized.cards[0].events[1].reviewReasons=[];
 const q=build(f);
 assert.equal(q.summary.normalSourceEvents,2);
 assert.equal(q.summary.approvedEvents,0);
 assert.ok(q.rows.every(x=>x.blockers.includes('HUMAN_SIX_CATEGORY_APPROVAL_MISSING')));
 assert.ok(q.rows.every(x=>x.blockers.includes('PUBLICATION_BASIS_NEEDS_REVIEW')));
});
test('strict full-population gate rejects tiny fixtures and absent baseline reviews',()=>{
 const f=fixture();
 assert.throws(()=>build(f,{strict:true}),/固定GT母集団/);
 f.completeReport.excludedSourcePositions=[{cardId:'30200',sourceOrdinal:2,
  eventId:'gt-30200-event-002',reason:'UNRESOLVED'}];
 f.completeReport.totals.skippedEvents=1;
 assert.throws(()=>build(f),/補完後カタログ/);
});
