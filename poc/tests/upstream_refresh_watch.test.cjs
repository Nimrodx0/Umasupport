'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspect,issueBody,PINS}=require('../src/upstream_refresh_watch.cjs');
const H=n=>n.repeat(40);
const source=(gt,uma)=>{
 const gtRecords=gt.map(([id,hash])=>({
  path:'server/data/events/gametora/support_'+id+'.json',
  sha:H(hash),type:'blob'
 }));
 const u=Object.entries(uma).map(([path,sha])=>({path,sha:/^[a-f0-9]{40}$/.test(sha)?sha:H(sha),type:'blob'}));
 return {
  gt:{sha:H('a'),truncated:false,tree:gtRecords},
  uma:{sha:H('b'),truncated:false,tree:u}
 };
};
const BASE_UMA={
 'data/support_card.txt':PINS.umaSim.cardBlob,
 'data/skill_data.txt':PINS.umaSim.skillBlob
};
const base=source([['30001','a'],['30002','b']],BASE_UMA);
function arg(overrides={}){
 return {
  gameToraPinnedTree:base.gt,
  gameToraLatestTree:base.gt,
  umaSimPinnedTree:base.uma,
  umaSimLatestTree:base.uma,
  gameToraLatestCommit:PINS.gameTora.revision,
  umaSimLatestCommit:PINS.umaSim.revision,
  ...overrides
 };
}
test('all relevant blobs unchanged: newer unrelated commits do not trigger a false refresh',()=>{
 const r=inspect(arg({
  gameToraLatestCommit:H('c'),umaSimLatestCommit:H('d')
 }),{strict:false});
 assert.equal(r.eventData.pinnedCardFiles,2);
 assert.equal(r.eventData.currentCardFiles,2);
 assert.equal(r.requiresReview,false);
 assert.equal(r.commitMoved.gameTora,true);
 assert.equal(r.commitMoved.umaSim,true);
 assert.deepEqual(r.affectedUmaSimFiles,[]);
 assert.deepEqual(r.eventData.knownLatestUmaSimCardIdsWithoutGtJson,PINS.umaSim?.expectedNewIds||
  ['10149','30322','30323']);
 assert.equal(r.automaticSnapshotPromotion,false);
 assert.equal(r.automaticEventApproval,false);
 assert.equal(r.sourceContentsIncluded,false);
 assert.throws(()=>issueBody(r),/ドリフトがない/);
});
test('added/modified/removed event-card ids and updated UmaSim blobs get stable deduplicating issue fingerprint',()=>{
 const head=source([['30002','d'],['30322','e']],{
  ...BASE_UMA,'data/support_card.txt':H('c')
 });
 const r=inspect(arg({
  gameToraLatestTree:head.gt,
  umaSimLatestTree:head.uma,
  gameToraLatestCommit:H('d'),
  umaSimLatestCommit:H('e')
 }),{strict:false});
 assert.deepEqual(r.eventData.addedCardIds,['30322']);
 assert.deepEqual(r.eventData.removedCardIds,['30001']);
 assert.deepEqual(r.eventData.modifiedCardIds,['30002']);
 assert.deepEqual(r.affectedUmaSimFiles,['data/support_card.txt']);
 assert.equal(r.requiresReview,true);
 assert.deepEqual(r.eventData.knownLatestUmaSimCardIdsWithoutGtJson,['10149','30323']);
 const body=issueBody(r);
 assert.match(body,/30322/);
 assert.match(body,/固定出典との差分/);
 assert.match(body,/確認ゲート/);
 assert.match(body,/レビュー|審査/);
 assert.equal(body.includes('"effects"'),false);
 const again=inspect(arg({
  gameToraLatestTree:{...head.gt,tree:[...head.gt.tree].reverse()},
  umaSimLatestTree:head.uma,
  gameToraLatestCommit:H('f'),
  umaSimLatestCommit:H('f')
 }),{strict:false});
 assert.equal(r.reviewFingerprint,again.reviewFingerprint,
  'same source-data blobs but new commits or path order must not create another issue');
 const updated=source([['30002','f'],['30322','e']],{
  ...BASE_UMA,'data/support_card.txt':H('c')
 });
 const later=inspect(arg({
  gameToraLatestTree:updated.gt,
  umaSimLatestTree:updated.uma,
  gameToraLatestCommit:H('e'),umaSimLatestCommit:H('e')
 }),{strict:false});
 assert.notEqual(r.reviewFingerprint,later.reviewFingerprint,
  'a SECOND source rewrite of the same event card must update the review issue');
});
test('missing or truncated trees fail closed, not as zero files or a mass deletion',()=>{
 const patterns=[
  {gameToraLatestTree:{...base.gt,truncated:true}},
  {gameToraLatestTree:{...base.gt,tree:[]}},
  {umaSimLatestTree:{...base.uma,tree:[]}},
  {umaSimPinnedTree:{...base.uma,tree:[
    ...base.uma.tree,
    base.uma.tree[0]
  ]}},
  {umaSimPinnedTree:{...base.uma,sha:'invalid'}},
  {gameToraLatestCommit:'not-a-sha'}
 ];
 for(const data of patterns)
  assert.throws(()=>inspect(arg(data),{strict:false}),
   /固定イベント出典の継続更新監査/);
});
test('strict mode refuses a wrong pinned GT population or unexpected baseline UmaSim SHA',()=>{
 assert.throws(()=>inspect(arg()),/GT固定版の母数/);
 const malformed=source([['30001','a'],['30002','b']],{
  ...BASE_UMA,'data/skill_data.txt':H('c')
 });
 assert.throws(()=>inspect(arg({umaSimPinnedTree:malformed.uma}),{strict:false}),
  /出典Git blob/);
});
