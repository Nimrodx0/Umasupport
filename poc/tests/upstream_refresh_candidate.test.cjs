'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspect,PINS}=require('../src/upstream_refresh_watch.cjs');
const {verifyReport,buildCandidate,manifestText,draftBody,contentDigest,
 FILE_PATH,BRANCH,PR_TITLE}=require('../src/upstream_refresh_candidate.cjs');
const h=c=>c.repeat(40);
const trees={
 gameToraPinned:h('a'),gameToraHead:h('b'),
 umaSimPinned:h('c'),umaSimHead:h('d')
};
function gt(xs){return {sha:h('e'),truncated:false,tree:xs.map(([id,sha])=>({
 path:'server/data/events/gametora/support_'+id+'.json',type:'blob',sha:h(sha)
 }))};}
function uma(card=PINS.umaSim.cardBlob,skill=PINS.umaSim.skillBlob){
 return {sha:h('f'),truncated:false,tree:[
 {path:'data/support_card.txt',type:'blob',sha:card},
 {path:'data/skill_data.txt',type:'blob',sha:skill}
 ]};
}
function sample(){
 const old=gt([['30001','a'],['30002','b']]);
 const newer=gt([['30002','c'],['30322','d']]);
 return inspect({
  gameToraPinnedTree:old,gameToraLatestTree:newer,
  umaSimPinnedTree:uma(),
  umaSimLatestTree:uma(h('d')),
  gameToraLatestCommit:h('1'),
  umaSimLatestCommit:h('2')
 },{strict:false});
}
test('candidate only captures safe new source pins and pending gates, not event content',()=>{
 const r=sample();r.eventData.pinnedCardFiles=PINS.gameTora.expectedBaselineCards;
 const manifest=buildCandidate(r,{
  treeShas:trees,sourceRunUrl:'https://github.com/Nimrodx0/Umasupport/actions/runs/1234567'
 });
 assert.equal(manifest.reviewState,'awaiting-human-preflight-and-source-adjudication');
 assert.deepEqual(manifest.eventSourceDiff.addedCardIds,['30322']);
 assert.deepEqual(manifest.eventSourceDiff.removedCardIds,['30001']);
 assert.deepEqual(manifest.eventSourceDiff.modifiedCardIds,['30002']);
 assert.deepEqual(manifest.umaSimChangedSourceFiles,['data/support_card.txt']);
 assert.equal(manifest.preflight.wholeEventInventory,'not-run-for-candidate');
 assert.equal(manifest.preflight.eventInternalBranches,'not-adjudicated');
 assert.equal(manifest.safeBoundaries.runtimePinChangesApplied,false);
 assert.equal(manifest.safeBoundaries.deploymentOrEventPublicationApproved,false);
 const serialized=manifestText(manifest),body=draftBody(manifest,42);
 assert.match(body,/#42/);
 assert.match(body,/Draft/);
 assert.match(body,/30322/);
 assert.equal(manifestText(manifest),serialized);
 assert.equal(contentDigest(serialized),contentDigest(serialized));
 assert.equal(contentDigest(serialized).length,64);
 assert.ok(FILE_PATH.startsWith('poc/review/'));
 assert.match(BRANCH,/^automation\//);
 assert.match(PR_TITLE,/Draft/);
 for(const forbidden of ['rawSource','eventText','unreviewedRewards']){
  assert.equal(serialized.includes(forbidden),false);
 }
});
test('candidate safely refuses missing/invalid Git trees, old pin changes, spoofed publication',()=>{
 const original=sample();
 original.eventData.pinnedCardFiles=PINS.gameTora.expectedBaselineCards;
 assert.throws(()=>buildCandidate(original,{treeShas:{...trees,umaSimHead:'invalid'}}),
  /Git tree SHA/);
 assert.throws(()=>buildCandidate(original,{treeShas:trees,
  sourceRunUrl:'https://attacker.example.com/id'}),/GitHub Actions/);
 for(const change of [
  x=>x.sourcePins.gameTora=h('8'),
  x=>x.eventData.addedCardIds=['30322','30322'],
  x=>x.eventData.knownLatestUmaSimCardCoverage.publicationApproved=true,
  x=>x.automaticEventApproval=true,
  x=>x.eventData.currentCardFiles=0,
  x=>x.umaSimData['data/support_card.txt'].changed=false,
  x=>x.affectedUmaSimFiles=[],
  x=>x.reviewFingerprint='broken'
 ]){
  const r=structuredClone(original);change(r);
  assert.throws(()=>buildCandidate(r,{treeShas:trees}),/出典候補Draft PR検証/);
 }
});
test('same source delta yields identical candidate content even for rerun',()=>{
 const report=sample();report.eventData.pinnedCardFiles=PINS.gameTora.expectedBaselineCards;
 const m1=buildCandidate(report,{treeShas:trees});
 const m2=buildCandidate(report,{treeShas:trees});
 assert.equal(manifestText(m1),manifestText(m2));
 const noChanges=structuredClone(report);
 noChanges.requiresReview=false;
 assert.throws(()=>verifyReport(noChanges),/検証済みドリフト/);
 assert.throws(()=>draftBody(m1,0),/参照Issue/);
});
