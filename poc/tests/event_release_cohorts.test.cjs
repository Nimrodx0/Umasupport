'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyRelease,digest}=require('../src/event_release_gate.cjs');
const {inventory}=require('../src/event_release_cohorts.cjs');
const {fixture}=require('./private_local_2512_fixture.cjs');
const CHECKS=['card','event','choices','outcomes','dependencies','publication',
 'sourceAccessTerms','databaseReuse','gameMaterialAndTitles','choiceWording'];
const V1=CHECKS.slice(0,6);
const REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
const clone=x=>structuredClone(x);
const event=(id)=>({id,name:'架空の見出し',type:'choice',choices:[
 {id:'pick1',label:'選択肢1（仮）',rewards:[{skillId:'fake:skill',level:2}]},
 {id:'pick2',label:'選択肢2（仮）',rewards:[]}]});
const catalog=()=>({schemaVersion:1,cards:[
 {cardId:'30001',coverageStatus:'partial',events:[event('gt-30001-event-001'),event('gt-30001-event-002')]},
 {cardId:'30002',coverageStatus:'partial',events:[event('usl:30002:chain:1')]}]});
const proof=(fields)=>Object.fromEntries(fields.map(k=>[k,['https://example.org/'+k]]));
const checks=(fields)=>Object.fromEntries(fields.map(k=>[k,true]));
const review=(fields=CHECKS)=>({
 reviewer:'Fictional test reviewer',reviewedAt:'2026-11-02',sourceRevision:REV,
 accessMethod:'reviewed-no-new-access',checks:checks(fields),
 evidence:proof(fields),
 publicationBasis:{
  kind:'original-factual-description',reason:'Entirely invented test events only',
  scope:'These exact fictional generated events and titles'}
});
const cohort=(c,id,prefix,cardIds)=>{
 const selector={eventIdPrefix:prefix,...(cardIds?{cardIds}:{})};
 const g=inventory(c,[selector]).groups[0];
 return {id,selector,expectedEvents:g.events,eventsSha256:g.eventsSha256,
  review:review()};
};
const v1Entry=(e,cardId)=>({
 cardId,eventId:e.id,eventSha256:digest(e),
 reviewer:'Fictional test reviewer',reviewedAt:'2026-11-02',
 checks:checks(V1),evidence:proof(V1),
 publicationBasis:{kind:'original-factual-description',reason:'Invented test facts'}
});
const ledger=(c)=>({schemaVersion:2,cohorts:[
 cohort(c,'fictional-gt','gt-'),cohort(c,'fictional-other','usl:')
],entries:[]});
test('unchanged version-1 ledger and explicit empty version-2 ledger both work',()=>{
 assert.deepEqual(verifyRelease({schemaVersion:1,cards:[]},{schemaVersion:1,entries:[]}),
 {publicCards:0,publicEvents:0,reviewedEvents:0});
 const empty=verifyRelease({schemaVersion:1,cards:[]},{schemaVersion:2,cohorts:[],entries:[]});
 assert.deepEqual(empty,{publicCards:0,publicEvents:0,reviewedEvents:0,
  reviewedCohorts:0,reviewedIndividualExceptions:0});
 assert.throws(()=>verifyRelease(catalog(),{schemaVersion:1,entries:[]}),/承認証跡/);
});
test('one exact source-level signature per invented cohort validates only exact members',()=>{
 const c=catalog(),a=ledger(c);
 assert.equal(verifyRelease(c,a).reviewedEvents,3);
 assert.equal(verifyRelease(c,a).reviewedCohorts,2);
 const reordered=clone(c);reordered.cards.reverse();
 reordered.cards[1].events.reverse();
 assert.equal(verifyRelease(reordered,a).reviewedEvents,3);
 for(const change of [
  x=>x.cards[0].events[0].name='別の見出し',
  x=>x.cards[0].events[0].choices[0].label='異なる選択肢の説明',
  x=>x.cards[0].events[0].choices[0].rewards[0].level=6,
  x=>x.cards[0].events.push(event('gt-30001-event-003')),
  x=>x.cards[0].events.pop(),
  x=>x.cards[1].events[0].id='gt-30002-event-999'
 ]){
  const tampered=clone(c);change(tampered);
  assert.throws(()=>verifyRelease(tampered,a),/SHA不一致|未承認/);
 }
});
test('missing, overlapping or wrongly scoped cohort signatures never pass',()=>{
 const c=catalog(),a=ledger(c);
 a.cohorts.pop();
 assert.throws(()=>verifyRelease(c,a),/未承認/);
 const b=ledger(c);b.cohorts.push(clone(b.cohorts[0]));
 b.cohorts[2].id='duplicate-gt-range';
 assert.throws(()=>verifyRelease(c,b),/重複/);
 const d=ledger(c);d.cohorts[1].selector.eventIdPrefix='gt-';
 assert.throws(()=>verifyRelease(c,d),/重複/);
 const e=ledger(c);e.cohorts[0].selector.eventIdPrefix='';
 assert.throws(()=>verifyRelease(c,e),/接頭辞/);
 const f=ledger(c);f.cohorts[0].expectedEvents=1000;
 assert.throws(()=>verifyRelease(c,f),/SHA不一致/);
 const g=ledger(c);g.cohorts[0].selector.cardIds=['99999'];
 assert.throws(()=>verifyRelease(c,g),/存在しない/);
});
test('unsupported rights conclusions and lacking source provenance cannot authorize a cohort',()=>{
 const c=catalog();
 for(const change of [
  a=>a.cohorts[0].review.checks.sourceAccessTerms=false,
  a=>delete a.cohorts[0].review.checks.gameMaterialAndTitles,
  a=>a.cohorts[0].review.evidence.databaseReuse=[],
  a=>a.cohorts[0].review.evidence.choiceWording=['http://example.org'],
  a=>a.cohorts[0].review.publicationBasis.reason='',
  a=>a.cohorts[0].review.publicationBasis.kind='unreviewed',
  a=>a.cohorts[0].review.sourceRevision='HEAD',
  a=>a.cohorts[0].review.accessMethod='scrape-as-needed',
  a=>a.cohorts[0].review.someUnknown=true,
  a=>a.cohorts[0].someUnknown=true
 ]){
  const a=ledger(c);change(a);
  assert.throws(()=>verifyRelease(c,a),/イベント一括公開ゲート/);
 }
});
test('v1 individual exception may coexist without cohort overlap or unreviewed remainder',()=>{
 const c=catalog();
 const a={schemaVersion:2,cohorts:[cohort(c,'fictional-gt','gt-')],entries:[
  v1Entry(c.cards[1].events[0],'30002')]};
 const result=verifyRelease(c,a);
 assert.equal(result.reviewedCohorts,1);
 assert.equal(result.reviewedIndividualExceptions,1);
 const overlap=clone(a);overlap.entries.push(v1Entry(c.cards[0].events[0],'30001'));
 assert.throws(()=>verifyRelease(c,overlap),/重複/);
 const missing=clone(a);missing.entries=[];
 assert.throws(()=>verifyRelease(c,missing),/未承認/);
 const incorrect=clone(a);incorrect.entries[0].eventSha256='0'.repeat(64);
 assert.throws(()=>verifyRelease(c,incorrect),/SHA不一致/);
});
test('even a matching cohort digest cannot release a provisional/quarantined event',()=>{
 const c=catalog();c.cards[0].events[0].noAutomaticRuntimeAdoption=true;
 const a=ledgerFromRaw(c);
 assert.throws(()=>verifyRelease(c,a),/未照合報酬の草稿/);
});
function ledgerFromRaw(c){
 // Calculate a digest on the structurally safe original, then mutate it.
 const copy=clone(c);delete copy.cards[0].events[0].noAutomaticRuntimeAdoption;
 return ledger(copy);
}
test('synthetic 563-card / 2512-event collection takes a single bound cohort decision',()=>{
 const c=fixture().bundle.catalog;
 const a={schemaVersion:2,cohorts:[
  cohort(c,'invented-full-test-cohort','synthetic-')
 ],entries:[]};
 const r=verifyRelease(c,a);
 assert.equal(r.publicCards,563);
 assert.equal(r.reviewedEvents,2512);
 assert.equal(r.reviewedCohorts,1);
 // The digest does NOT mean the real GT data was reviewed or approved.
 c.cards[7].events[0].name='変更';
 assert.throws(()=>verifyRelease(c,a),/SHA不一致/);
});
