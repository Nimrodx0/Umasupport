'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {reconcile}=require('../src/phase2_2511_gap_reconciliation.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const missing=['30318','30319','30320','30321'];
const gt=(id,i)=>'gt-'+id+'-event-'+String(i).padStart(3,'0');
function fixture(){
 const cards=missing.map(id=>({cardId:id,coverageStatus:'partial',
  events:[
   ...[4,5].map(i=>({id:'usl:'+id+':random:'+i})),
   ...[1,2,3].map(i=>({id:'usl:'+id+':chain:'+i}))
  ]}));
 cards.push({cardId:'30221',events:[
  ...[1,2].map(i=>({id:gt('30221',i)})),
  ...[1,2,3].map(i=>({id:'usl:30221:chain:'+i}))]});
 cards.push({cardId:'30240',events:[1,2].map(i=>({id:gt('30240',i)}))});
 cards.push({cardId:'30080',events:[{id:gt('30080',6),type:'choice',
  availabilityKind:'special-trigger',choices:[{id:'option1'},{id:'option2'},{id:'option3'}]}]});
 cards.push({cardId:'30001',events:Array.from({length:24},(_,k)=>({id:gt('30001',k+1)}))});
 const unmatchedCheckerRows=[];
 for(const id of missing)for(let i=1;i<=5;i++)
  unmatchedCheckerRows.push({cardId:id,checkerOrdinal:i,sourceKey:'checker:'+id+':'+i,
   triageCode:'SOURCE_CARD_NOT_IN_FIXED_GT'});
 for(let i=1;i<=3;i++)unmatchedCheckerRows.push({
  cardId:'30221',checkerOrdinal:i,sourceKey:'checker:30221:'+i,
  triageCode:'UNMATCHED_CHECKER_EVENT_IDENTITY'});
 unmatchedCheckerRows.push({cardId:'20075',checkerOrdinal:1,
  sourceKey:'checker:20075:stage1',triageCode:'UNMATCHED_CHECKER_EVENT_IDENTITY'});
 cards.push({cardId:'20075',events:[{id:gt('20075',1)}]});
 for(let i=1;i<=16;i++){
  const id=String(30400+i);
  cards.push({cardId:id,events:[{id:gt(id,1)}]});
  unmatchedCheckerRows.push({cardId:id,checkerOrdinal:1,
   sourceKey:'checker:'+id+':1',triageCode:'UNMATCHED_CHECKER_EVENT_IDENTITY'});
 }
 const catalog={schemaVersion:1,cards};
 const triage={dataKind:'phase2-cross-source-publication-triage',
  publicReleaseApproved:false,sourceNarrativeOrChoiceProseIncluded:false,
  sourcePins:{gameToraDerived:'a'.repeat(40),checkerIndex:'b'.repeat(40)},
  summary:{sourceEvents:27,approvedEvents:0,unmatchedCheckerRows:40,
   checkerOnlyOnMissingGTCards:20,checkerOnlyOnGTCards:20,
   gtOnlyNonR:24,sourceChoiceTopologyIncomplete:1,
   missingBothPinnedGTAndCheckerChainStages:3},
  rows:[
   ...Array.from({length:24},(_,k)=>({cardId:'30001',sourceOrdinal:k+1,
    crossSourceFlags:['NON_R_GT_EVENT_NOT_PAIRED_IN_CHECKER']})),
   {cardId:'30080',sourceOrdinal:6,eventId:gt('30080',6),
    crossSourceFlags:['FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE']}
  ],unmatchedCheckerRows};
 const integrated={dataKind:'phase2-2511-nonpublishing-gt-and-curated-chain-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,sourceNarrativeOrChoiceProseIncluded:false,
  catalog,summary:{rosterCards:cards.length,
   totalCandidateEvents:cards.reduce((n,c)=>n+c.events.length,0),
   appendedChainStages:15,catalogSha256:hash(catalog)}};
 return {triage,integrated};
}
test('fixed-source 65 differences shrink to 17 unpaired identities plus 3 outside both pinned sources',()=>{
 const f=fixture(),copy=structuredClone(f),result=reconcile(f);
 assert.deepEqual(result.summary,{
  fixedSourceExceptionPositions:65,
  checkerOnlyOriginal:40,gtOnlyNonROriginal:24,choiceTopologyOriginal:1,
  checkerMissingGTCardScopeCovered:20,checkerOnGTCardScopeCovered:3,
  gtOnlyAlreadyInBaseline:24,sourceChoiceTopologyPatched:1,
  checkerOnGTCardIdentityUnpaired:17,missingFromBothFixedSources:3,
  stillRequireIndividualInvestigation:20,
  confirmedNewMissingEventsFromThisAudit:0,publicationApprovedEvents:0
 });
 assert.equal(result.openQueue.length,18,'17 individual unmatched+one 3-stage group');
 assert.equal(result.openQueue.find(x=>x.cardId==='20075').action,
  'REVIEW_REPORTED_NO_SKILL_CHAIN_FIRST_STAGE');
 assert.equal(result.openQueue.find(x=>x.cardId==='30240').count,3);
 assert.equal(result.openQueue.some(x=>missing.includes(x.cardId)),false);
 assert.deepEqual(result.coveredCheckerMissingGTCardCounts,
  Object.fromEntries(missing.map(id=>[id,5])));
 assert.equal(result.publicationApproved,false);
 assert.equal(result.sourceNarrativeOrChoiceProseIncluded,false);
 assert.deepEqual(f,copy,'pure reconciliation never edits GT source or 2511 runtime');
});
test('exact card-level coverage is not falsely claimed as Checker event identity pairing',()=>{
 const result=reconcile(fixture());
 assert.equal(result.summary.checkerMissingGTCardScopeCovered,20);
 assert.equal(result.summary.confirmedNewMissingEventsFromThisAudit,0);
 assert.ok(result.openQueue.every(x=>x.cardId==='30240'||x.status==='UNPAIRED_IDENTITY_NOT_PROVEN_MISSING'));
});
test('fail closed if a missing event, patched option, source identity, checksum or approval changes',()=>{
 const changes=[
  f=>{f.integrated.publicationApproved=true},
  f=>{f.integrated.noAutomaticRuntimeAdoption=false},
  f=>{f.integrated.catalog.cards[0].events.pop()},
  f=>{f.triage.unmatchedCheckerRows[0].sourceKey=''},
  f=>{f.triage.unmatchedCheckerRows[0].cardId='30240'},
  f=>{f.triage.unmatchedCheckerRows[21].cardId='30002'},
  f=>{f.triage.rows[0].sourceOrdinal=26},
  f=>{f.triage.rows[24].cardId='30001'},
  f=>{f.integrated.catalog.cards.find(x=>x.cardId==='30240').events.push({id:'usl:30240:chain:1'})}
 ];
 for(const change of changes){const f=fixture();change(f);assert.throws(()=>reconcile(f),change.toString())}
});
test('small fabricated fixture never counts as whole actual 563/2511 audit',()=>{
 assert.throws(()=>reconcile(fixture(),{strict:true}),/固定563カード2511イベント/);
});
