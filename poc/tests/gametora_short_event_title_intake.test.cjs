'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {bindNames}=require('../src/gametora_short_event_title_intake.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const sha=s=>'sha256:'+crypto.createHash('sha256')
 .update(s.normalize('NFKC').replace(/\s+/gu,' ').trim()).digest('hex');
const fixture=()=>{
 const doc={kind:'support',id:30200,events_ja:{
  a:{name:'同じイベント',section:'random',choices:[{label:'前'}]},
  b:{name:'同じイベント',section:'arrows',choices:[{label:'後'}]}
 }};
 const normalized={
  dataKind:'gametora-whole-event-numeric-candidate',releaseApproved:false,
  originalSourceTextIncluded:false,noEventCanPublishFromThisCandidate:true,
  cards:[{cardId:'30200',events:[1,2].map(i=>({
   sourceOrdinal:i,eventId:'gt-30200-event-00'+i,
   sourceTitleFingerprint:sha('同じイベント')
  }))},{cardId:'30318',sourceMissing:true,events:[]}]
 };
 const projectedCatalog={schemaVersion:1,cards:[{cardId:'30200',events:[1,2].map(i=>({
  id:'gt-30200-event-00'+i,name:'イベント00'+i+'（仮）',
  type:'choice',choices:[{id:'choice-01',label:'選択肢1（仮）',
   rewards:[]}]
 }))}]};
 return {normalized,projectedCatalog,documents:[doc]};
};
test('two same-name source events remain distinct and retain branches and IDs',()=>{
 const input=fixture(),before=structuredClone(input.projectedCatalog);
 const x=bindNames(input);
 assert.deepEqual(x.summary,{sourceCards:1,sourceEvents:2,
  projectedCards:1,projectedEvents:2,shortTitlesJoined:2,
  shortTitlesNeedsReview:0,publishedEvents:0});
 assert.deepEqual(x.catalog.cards[0].events.map(e=>e.name),
  ['同じイベント','同じイベント']);
 assert.deepEqual(x.catalog.cards[0].events.map(e=>e.id),
  ['gt-30200-event-001','gt-30200-event-002']);
 assert.deepEqual(x.catalog.cards[0].events.map(e=>e.choices),
  before.cards[0].events.map(e=>e.choices));
 assert.deepEqual(input.projectedCatalog,before,'must never mutate original runtime catalog');
 assert.deepEqual(x.manifest.map(e=>e.sourceOrdinal),[1,2]);
 assert.deepEqual(x.manifest.map(e=>e.eventSha256),
  x.catalog.cards[0].events.map(digest));
 assert.ok(x.manifest.every(e=>e.status==='SHORT_HEADING_JOINED_NOT_APPROVED'));
 assert.equal(x.sourceChoiceOrOutcomeProseIncluded,false);
 assert.equal(x.publicationApproved,false);
 assert.equal(x.noAutomaticRuntimeAdoption,true);
});
test('source title hash, card association and ordinal position cannot drift',()=>{
 for(const change of [
  x=>{x.documents[0].events_ja.a.name='似ているが別名';},
  x=>{x.normalized.cards[0].events[0].sourceOrdinal=2;},
  x=>{x.normalized.cards[0].events[0].eventId='gt-30300-event-001';},
  x=>{x.projectedCatalog.cards[0].events[0].id='gt-30300-event-001';},
  x=>{x.projectedCatalog.cards[0].events[0].name='上書き済み';},
  x=>{x.documents[0].events_ja.c={name:'余分な行'};},
  x=>{x.documents[0].id=30300;},
  x=>{x.normalized.cards[1].events.push({});},
  x=>{x.normalized.releaseApproved=true;}
 ]){
  const f=fixture();change(f);assert.throws(()=>bindNames(f));
 }
});
test('long or unsafe heading stays an unapproved placeholder, never imports prose',()=>{
 const f=fixture(),long='長'.repeat(100);
 f.documents[0].events_ja.a.name=long;
 f.normalized.cards[0].events[0].sourceTitleFingerprint=sha(long);
 const x=bindNames(f);
 assert.equal(x.summary.shortTitlesJoined,1);
 assert.equal(x.summary.shortTitlesNeedsReview,1);
 assert.equal(x.catalog.cards[0].events[0].name,'イベント001（仮）');
 assert.equal(x.manifest[0].status,'HEADING_NEEDS_REVIEW');
});
test('strict mode fails on a small synthetic fixture, refuses to assert fixed coverage',()=>{
 const f=fixture();
 assert.throws(()=>bindNames(f,{strict:true}),/固定GT全件ゲート/);
});
