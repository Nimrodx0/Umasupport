'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_eight_release_candidate.cjs');
const {HINT_NAMES}=require('../src/phase2_eight_event_review_view.cjs');
const {rehearseApprovedExistingEvents:rehearse,validatePacket}=
 require('../src/reviewed_existing_event_append.cjs');
const {verifyRelease,digest}=require('../src/event_release_gate.cjs');
const publicCatalog=require('../src/public_event_catalog.js');
const core=require('../src/core.js');
const actual=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.v1.json');
const clone=x=>structuredClone(x);
function fixture(){
 const packet=build();
 const model={cards:packet.catalog.cards.map(c=>({id:c.cardId,hints:[],events:[]})),
  cardById:Object.fromEntries(packet.catalog.cards.map(c=>
   [c.cardId,{id:c.cardId,hints:[],events:[]}])),
  skills:[],skillById:{},meta:{}};
 const skillText=JSON.stringify([
  ...Object.entries(HINT_NAMES).map(([id,name])=>({
   id,name,rarity:'normal',group:Math.floor(Number(id)/10)
  })),
  ...Array.from({length:105},(_,i)=>({
   id:String(900000+i),name:'Synthetic skill '+i,
   rarity:'normal',group:90000+i
  }))
 ]);
 return {packet,model,skillText,existingCatalog:clone(actual),
  existingApprovals:clone(approvals)};
}
function syntheticDecision(packet,cardId,eventId){
 const candidate=packet.catalog.cards.find(c=>c.cardId===cardId)
  .events.find(e=>e.id===eventId);
 return {cardId,eventId,eventSha256:digest(candidate),
  reviewer:'SYNTHETIC-CI-ONLY-NOT-HUMAN-APPROVAL',
  reviewedAt:'2026-10-29',
  checks:{card:true,event:true,choices:true,outcomes:true,
   dependencies:true,publication:true},
  evidence:Object.fromEntries(['card','event','choices','outcomes',
   'dependencies','publication'].map(k=>[k,['https://example.org/test-only']])),
  publicationBasis:{kind:'original-factual-description',
   reason:'CI synthetic approval only, no production rights decision'}
 };
}
const select=(p,...pairs)=>({schemaVersion:1,
 entries:pairs.map(([id,eventId])=>syntheticDecision(p,id,eventId))});
test('real eight-candidate worksheet is PENDING; no silent publication results',()=>{
 const input=fixture(),packet=input.packet;
 assert.equal(validatePacket(packet).events.size,8);
 const result=rehearse({...input,decisions:{schemaVersion:1,entries:[]}});
 assert.equal(result.status,'pending-human-approval');
 assert.equal(result.catalog,null);
 assert.equal(result.approvals,null);
 assert.equal(result.pendingReviewEvents,8);
 assert.equal(actual.cards.length,0);
 assert.equal(approvals.entries.length,0);
});
test('synthetic signed ONE real numeric-hint event runs through exact application loader and release gate',()=>{
 const input=fixture(),d=select(input.packet,['30318','usl:30318:random:5']);
 const original=JSON.stringify({catalog:input.existingCatalog,
  approvals:input.existingApprovals});
 const a=rehearse({...input,decisions:d});
 assert.equal(a.status,'ready-for-explicit-publication');
 assert.equal(a.approvedNewEvents,1);
 assert.equal(a.pendingReviewEvents,7);
 assert.deepEqual(a.catalog.cards.map(x=>x.cardId),['30318']);
 assert.equal(a.catalog.cards[0].events[0].choices[1].rewards[0].skillId,
  'skill:200152');
 assert.equal(a.loader.events,1);
 assert.equal(verifyRelease(a.catalog,a.approvals).publicEvents,1);
 assert.equal(JSON.stringify({catalog:input.existingCatalog,
  approvals:input.existingApprovals}),original);
 assert.deepEqual(actual,{schemaVersion:1,cards:[]});
});
test('replay is idempotent and later event can append to the SAME existing card',()=>{
 const input=fixture(),id='30318',b='usl:30318:random:5',a='usl:30318:random:4';
 const single=select(input.packet,[id,b]);
 const first=rehearse({...input,decisions:single});
 const replay=rehearse({...input,existingCatalog:first.catalog,
  existingApprovals:first.approvals,decisions:single});
 assert.equal(replay.status,'unchanged');
 assert.deepEqual(replay.catalog,first.catalog);
 const appended=rehearse({...input,existingCatalog:first.catalog,
  existingApprovals:first.approvals,decisions:select(input.packet,[id,a])});
 assert.equal(appended.approvedNewEvents,1);
 assert.deepEqual(appended.catalog.cards[0].events.map(e=>e.id),[b,a]);
 assert.deepEqual(appended.catalog.cards[0].events[0],first.catalog.cards[0].events[0]);
 assert.deepEqual(appended.approvals.entries[0],first.approvals.entries[0]);
 assert.equal(verifyRelease(appended.catalog,appended.approvals).publicEvents,2);
});
test('mixed already-published and new cards are admitted without overwriting anything',()=>{
 const input=fixture();
 const first=rehearse({...input,decisions:select(input.packet,
  ['30318','usl:30318:random:5'])});
 const next=rehearse({...input,existingCatalog:first.catalog,
  existingApprovals:first.approvals,decisions:select(input.packet,
   ['30318','usl:30318:random:5'],
   ['30321','usl:30321:random:5'])});
 assert.equal(next.approvedNewEvents,1);
 assert.deepEqual(next.catalog.cards.map(c=>c.cardId),['30318','30321']);
 assert.equal(verifyRelease(next.catalog,next.approvals).publicEvents,2);
});
test('source alteration, wrong IDs and missing independent publication decision fail closed',()=>{
 const input=fixture();
 const first=select(input.packet,['30318','usl:30318:random:5']);
 const original=JSON.stringify(input);
 first.entries[0].checks.outcomes=false;
 assert.throws(()=>rehearse({...input,decisions:first}),/人手承認/);
 first.entries[0].checks.outcomes=true;
 first.entries[0].eventSha256='0'.repeat(64);
 assert.throws(()=>rehearse({...input,decisions:first}),/不一致SHA/);
 first.entries[0].eventSha256=syntheticDecision(input.packet,'30318',
  'usl:30318:random:5').eventSha256;
 first.entries[0].publicationBasis=null;
 assert.throws(()=>rehearse({...input,decisions:first}),/公開利用の根拠/);
 first.entries[0].publicationBasis={kind:'original-factual-description',
  reason:'synthetic fixture'};
 first.entries[0].sourceKind='derived-github-unreviewed';
 assert.throws(()=>rehearse({...input,decisions:first}),/禁止フィールド/);
 delete first.entries[0].sourceKind;
 const altered=clone(input.packet);
 altered.catalog.cards[0].events[1].choices[1].rewards[0].level+=1;
 assert.throws(()=>rehearse({...input,packet:altered,decisions:first}),/未署名の審査票/);
 assert.throws(()=>rehearse({...input,decisions:select(input.packet,
  ['30318','does-not-exist'])}),/Cannot read|不正|未照合/);
 assert.equal(JSON.stringify(input),original);
});
test('an edited or removed previously published event must never be overwritten',()=>{
 const input=fixture(),d=select(input.packet,['30318','usl:30318:random:5']);
 const first=rehearse({...input,decisions:d});
 const other=clone(first.catalog);
 other.cards[0].events[0].name='Altered already public title';
 // Existing release gate itself will refuse the stale approval hash.
 assert.throws(()=>rehearse({...input,existingCatalog:other,
  existingApprovals:first.approvals,decisions:d}),/SHA不一致/);
 const fake=clone(first.approvals);
 fake.entries[0].eventSha256=digest(other.cards[0].events[0]);
 assert.throws(()=>rehearse({...input,existingCatalog:other,
  existingApprovals:fake,decisions:d}),/上書きは禁止/);
});

test('one staged REAL GameWith-adjudicated skill event runs through production attach and explicit choice aggregation',()=>{
 const input=fixture();
 const id='usl:30318:random:5';
 const approved=select(input.packet,['30318',id]);
 const out=rehearse({...input,decisions:approved});
 const live=clone(input.model);
 // Restore cardById and cards[] reference identity as live_loader.buildModel does.
 live.cards=input.model.cards.map(c=>clone(c));
 live.cardById=Object.fromEntries(live.cards.map(c=>[c.id,c]));
 const summary=publicCatalog.attach(live,out.catalog,{skillText:input.skillText});
 assert.equal(summary.eventsWithRecords,1);
 const card=live.cardById['30318'];
 assert.equal(card.events.length,1);
 const before=core.directRoutes(card,{stage:4,choices:{}});
 assert.equal(before.length,0);
 const after=core.directRoutes(card,{stage:4,choices:{[id]:'option2'}});
 assert.deepEqual(after.map(x=>[x.skillId,x.level]),[['skill:200152',1]]);
 assert.equal(out.status,'ready-for-explicit-publication');
 assert.equal(actual.cards.length,0);
});
