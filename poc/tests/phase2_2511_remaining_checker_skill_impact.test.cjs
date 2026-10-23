'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const DB=require('../data/candidates/checker_event_hints.v1.json');
const {build}=require('../src/phase2_2511_remaining_checker_skill_impact.cjs');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const POS={20075:[1],30052:[5,11,12],30067:[10,12],30081:[12],
 '30137':[4,5,6,10],30160:[10],30180:[7],30188:[10],30207:[1,3]};
function fixture(){
 const queue=[],cards=[];
 for(const [id,ordinals] of Object.entries(POS)){
  const c=DB.cards.find(x=>x.cardId===id);
  assert.ok(c,'fixture requires exact fixed Checker card '+id);
  cards.push({cardId:id,events:[{
   id:'gt-'+id+'-event-001',type:'choice',
   choices:[{id:'choice-01',rewards:[]}]
  }]});
  for(const ord of ordinals){
   const e=c.events[ord-1];
   assert.ok(e,'fixture missing fixed Checker ordinal '+id+'/'+ord);
   queue.push({cardId:id,checkerOrdinal:ord,sourceKey:e.sourceKey,
    status:'UNPAIRED_IDENTITY_NOT_PROVEN_MISSING'});
  }
 }
 const catalog={schemaVersion:1,cards};
 const reconciliation={
  dataKind:'phase2-2511-reconciled-65-source-positions',
  publicationApproved:false,sourceNarrativeOrChoiceProseIncluded:false,
  sourcePins:{checkerIndex:DB.sourcePins.checker.revision,
   gameToraDerived:'6e38b54af4fad397ff4491e63007a90705a4fe67'},
  summary:{checkerOnGTCardIdentityUnpaired:16,
   checkerOnGTCardIdentityEditoriallyResolved:1},
  openQueue:[...queue,{cardId:'30240',count:3,
   status:'MISSING_IN_BOTH_PINNED_SOURCES_UTOOLS_STAGE_AND_HINT_REPORTED'}]
 };
 const integrated={
  dataKind:'phase2-2511-nonpublishing-gt-and-curated-chain-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,catalog,
  summary:{rosterCards:cards.length,totalCandidateEvents:cards.length,
   catalogSha256:hash(catalog)}
 };
 return {reconciliation,integrated,checker:DB};
}
test('all sixteen fixed Checker IDs are joined exactly without granting any skill',()=>{
 const f=fixture(),r=build(f);
 assert.equal(r.dataKind,'phase2-16-remaining-checker-skill-priority');
 assert.equal(r.summary.openCheckerPositions,16);
 assert.equal(r.summary.separate30240MissingChainStages,3);
 assert.equal(r.summary.P0+r.summary.P1+r.summary.P2,16);
 assert.equal(r.rows.length,16);
 assert.equal(new Set(r.rows.map(e=>e.sourceKey)).size,16);
 assert.equal(r.publicationApproved,false);
 assert.equal(r.checkerCandidatesNotForSkillGrant,true);
 assert.ok(r.rows.every(x=>x.missingActualEventVerified===false&&
  x.identityPairVerified===false&&x.publicationApproved===false));
 assert.ok(r.rows.every(x=>x.candidateSkillIdsAlreadyInGTEventCatalog.length===0));
 assert.deepEqual(r.rows.map(x=>[x.cardId,x.checkerOrdinal]).sort(),
  Object.entries(POS).flatMap(([id,ord])=>ord.map(n=>[id,n])).sort());
});
test('matching a numeric ID in GT card event changes priority but does not prove event identity',()=>{
 const f=fixture(),initial=build(f);
 const row=initial.rows.find(r=>r.candidateSkillIdsAbsentFromGTEventCatalog.length);
 if(!row){
  // All remaining positions would lack matched numeric hints. This is
  // informational, not evidence of complete skill-source coverage.
  assert.equal(initial.summary.absentNumericSkillIdPositions,0);return;
 }
 const id=row.candidateSkillIdsAbsentFromGTEventCatalog[0];
 f.integrated.catalog.cards.find(c=>c.cardId===row.cardId).events[0]
  .choices[0].rewards.push({skillId:'skill:'+id,level:1});
 f.integrated.summary.catalogSha256=hash(f.integrated.catalog);
 const after=build(f),found=after.rows.find(x=>x.sourceKey===row.sourceKey);
 assert.ok(found.candidateSkillIdsAlreadyInGTEventCatalog.includes(id));
 assert.ok(!found.candidateSkillIdsAbsentFromGTEventCatalog.includes(id));
 assert.equal(found.identityPairVerified,false);
 assert.equal(found.missingActualEventVerified,false);
});
test('rejects false event identity, source drift and approval promotion',()=>{
 const mutations=[
  x=>x.reconciliation.publicationApproved=true,
  x=>x.reconciliation.summary.checkerOnGTCardIdentityEditoriallyResolved=0,
  x=>x.reconciliation.openQueue[0].sourceKey='checker:20075:wrong',
  x=>x.reconciliation.openQueue[0].checkerOrdinal=999,
  x=>x.reconciliation.sourcePins.checkerIndex='b'.repeat(40),
  x=>x.integrated.catalog.cards[0].events[0].id='tampered without SHA update',
  x=>x.integrated.publicationApproved=true
 ];
 for(const m of mutations){const f=fixture();m(f);assert.throws(()=>build(f));}
 const db=structuredClone(DB);
 db.approvalState='APPROVED';
 const f=fixture();f.checker=db;
 assert.throws(()=>build(f));
});
test('synthetic partial catalog cannot pass fixed 563-card/2511-event audit',()=>{
 assert.throws(()=>build(fixture(),{strict:true}),/固定Checkerイベント|固定Checkerイベント2,109件/);
});
