'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_release_triage.cjs');
const rev='a'.repeat(40),checker='b'.repeat(40),sha='c'.repeat(64);
function fixture(){
 const ev=(ord,section,stage=null,reasons=[])=>({
  sourceOrdinal:ord,eventId:'gt-30001-event-'+String(ord).padStart(3,'0'),
  section,sourceChainOrdinal:stage,reviewReasons:reasons
 });
 const events=[
  ev(1,'arrows',1),ev(2,'arrows',2),
  ev(3,'arrows',3,['CONDITIONAL_SEGMENT_REQUIRES_REVIEW']),
  ev(4,'random'),ev(5,'random')
 ];
 const normalized={dataKind:'gametora-whole-event-numeric-candidate',
  releaseApproved:false,sourcePins:{gameToraDerived:rev,checkerIndex:checker},
  cards:[{cardId:'30001',events}]};
 const root='SKILL_ID_OR_HINT_EFFECT_PENDING';
 const review={
  dataKind:'gametora-2488-unsigned-publication-review-queue',
  automaticallyReleaseApproved:false,sourceNarrativeOrChoiceProseIncluded:false,
  sourcePins:{gameToraDerived:rev,checkerIndex:checker},
  rows:events.map((e,i)=>({
   cardId:'30001',sourceOrdinal:e.sourceOrdinal,eventId:e.eventId,
   eventSha256:sha,sourceReasonCodes:e.reviewReasons,
   baselineExclusionReason:i===0?root:i===1||i===2?'CHAIN_PREDECESSOR_NOT_PROJECTED':null,
   releaseApproved:false,status:'PENDING_HUMAN_PUBLICATION_REVIEW'
  }))
 };
 const baselineReport={dataKind:'gametora-app-schema-dry-run',
  publicationApproved:false,
  totals:{skippedEvents:3},
  excludedSourcePositions:[
   {cardId:'30001',sourceOrdinal:1,eventId:events[0].eventId,reason:root},
   {cardId:'30001',sourceOrdinal:2,eventId:events[1].eventId,
    reason:'CHAIN_PREDECESSOR_NOT_PROJECTED'},
   {cardId:'30001',sourceOrdinal:3,eventId:events[2].eventId,
    reason:'CHAIN_PREDECESSOR_NOT_PROJECTED'}
  ]};
 const crossSource={dataKind:'phase2-fixed-source-completeness-exceptions',
  publicationApproved:false,sourceDocumentsNotRedistributed:true,
  sourcePins:{gameToraDerived:rev,checker},
  supplementalMissingGTChainReviews:[{additionalIndependentExpectedEventsNotInNeitherPinnedSource:2}],
  queue:[
   {cardId:'30001',type:'GAMETORA_ONLY',sourceOrdinal:4,rarity:'SSR',
    publicationApproved:false,priority:'P2'},
   {cardId:'30001',type:'GAMETORA_ONLY',sourceOrdinal:3,rarity:'R',
    publicationApproved:false,priority:'P3'},
   {cardId:'30001',type:'CHOICE_COUNT_DIFFERENCE',sourceOrdinal:5,
    status:'FIXED_SOURCE_CHOICE_TOPOLOGY_INCOMPLETE',publicationApproved:false},
   {cardId:'30001',type:'CHOICE_COUNT_DIFFERENCE',sourceOrdinal:1,
    status:'SOURCE_REPRESENTATION_EXPLAINED',publicationApproved:false},
   {cardId:'30002',type:'CHECKER_ONLY',checkerOrdinal:3,
    sourceKey:'checker:30002:abc',reason:'NO_GAMETORA_CARD',
    publicationApproved:false,priority:'P1'},
   {cardId:'30001',type:'CHECKER_ONLY',checkerOrdinal:4,
    sourceKey:'checker:30001:def',reason:'EVENT_IDENTITY_NOT_PAIRED',
    publicationApproved:false,priority:'P2'}
  ]};
 return {review,normalized,baselineReport,crossSource};
}
test('two dependent stages link to the original cause, not three independent deficits',()=>{
 const f=fixture(),r=build(f);
 assert.equal(r.summary.sourceEvents,5);
 assert.equal(r.summary.baselineDirectRoots,1);
 assert.equal(r.summary.baselineDependentStages,2);
 assert.equal(r.summary.baselineDistinctRootCauses,1);
 assert.deepEqual(r.summary.baselineRootReasons,{SKILL_ID_OR_HINT_EFFECT_PENDING:1});
 assert.deepEqual(r.rows.slice(0,3).map(x=>x.baselineCause),[
  {rootCardId:'30001',rootSourceOrdinal:1,rootReason:'SKILL_ID_OR_HINT_EFFECT_PENDING',dependencyDepth:0},
  {rootCardId:'30001',rootSourceOrdinal:1,rootReason:'SKILL_ID_OR_HINT_EFFECT_PENDING',dependencyDepth:1},
  {rootCardId:'30001',rootSourceOrdinal:1,rootReason:'SKILL_ID_OR_HINT_EFFECT_PENDING',dependencyDepth:2}
 ]);
 assert.equal(r.rows[2].flagged.includes('GT_BRANCH_OR_EFFECT_SOURCE_MARKER'),true);
 assert.equal(r.summary.sourceMarkerEvents,1);
 assert.equal(r.summary.crossSourceExceptionPositions,2);
 assert.equal(r.summary.gtOnlyNonR,1);
 assert.equal(r.summary.gtOnlyRInformational,1);
 assert.equal(r.summary.sourceChoiceTopologyIncomplete,1);
 assert.equal(r.summary.explainedChoicePresentation,1);
 assert.equal(r.summary.unmatchedCheckerRows,2);
 assert.equal(r.summary.checkerOnlyOnMissingGTCards,1);
 assert.equal(r.summary.checkerOnlyOnGTCards,1);
 assert.equal(r.summary.missingBothPinnedGTAndCheckerChainStages,2);
 assert.equal(r.summary.routineWithoutTheseWarnings,0);
 assert.deepEqual(r.rows[4].crossSourceFlags,
  ['FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE']);
 assert.equal(r.publicReleaseApproved,false);
 assert.equal(r.sourceNarrativeOrChoiceProseIncluded,false);
 assert.ok(!JSON.stringify(r).includes('choice label'));
});
test('review/normalization/exception membership and immutable source pins are mandatory',()=>{
 const mutations=[
  f=>{f.review.automaticallyReleaseApproved=true},
  f=>{f.crossSource.sourcePins.checker='d'.repeat(40)},
  f=>{f.baselineReport.totals.skippedEvents=4},
  f=>{f.normalized.cards[0].events[2].sourceChainOrdinal=1},
  f=>{f.baselineReport.excludedSourcePositions[1].reason='UNKNOWN'},
  f=>{f.baselineReport.excludedSourcePositions[1].sourceOrdinal=4},
  f=>{f.review.rows.pop()},
  f=>{f.review.rows[3].releaseApproved=true},
  f=>{f.crossSource.queue[0].sourceOrdinal=99},
  f=>{f.crossSource.queue[0].publicationApproved=true},
  f=>{f.crossSource.queue[2].status='UNEXPLAINED_CHOICE_COUNT'},
  f=>{f.crossSource.queue.push(structuredClone(f.crossSource.queue[0]))}
 ];
 for(const modify of mutations){
  const f=fixture();modify(f);
  assert.throws(()=>build(f),'unexpected valid modification: '+modify.toString());
 }
});
test('root cause can be a ranged hint issue and no warning is not an approval',()=>{
 const f=fixture();
 f.baselineReport.excludedSourcePositions[0].reason='RANGED_HINT_EFFECT_PENDING';
 f.review.rows[0].baselineExclusionReason='RANGED_HINT_EFFECT_PENDING';
 f.normalized.cards[0].events[4].reviewReasons=[];
 f.crossSource.queue=f.crossSource.queue.filter(x=>x.type==='CHECKER_ONLY');
 const r=build(f);
 assert.deepEqual(r.summary.baselineRootReasons,{RANGED_HINT_EFFECT_PENDING:1});
 assert.equal(r.summary.routineWithoutTheseWarnings,2);
 assert.ok(r.rows.every(x=>x.triage==='PENDING_PUBLICATION_REVIEW'&&x.approved===false));
});
test('strict mode rejects synthetic counts while not silently widening the scope',()=>{
 assert.throws(()=>build(fixture(),{strict:true}),/固定2,488|計算が不一致/);
});
