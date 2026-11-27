'use strict';
const CURRENT_PUBLIC=require('./current_public_event_fixture.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {forCatalog}=require('../src/current_public_event_approvals.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const published=require('../data/reviewed_events.v1.json');
test('owner-approved legacy GT cohort plus exact D068 new cards, never unsigned additions',()=>{
 const actual=verifyRelease(published,forCatalog(published));
 assert.equal(actual.publicEvents,CURRENT_PUBLIC.events);
 assert.equal(actual.reviewedIndividualExceptions,CURRENT_PUBLIC.individualEntries);
 assert.equal(actual.reviewedCohorts,1);
 assert.equal(actual.publicCards,CURRENT_PUBLIC.cards);
 assert.deepEqual(['20102','30322','30324'].map(id=>[id,published.cards.find(c=>c.cardId===id)?.events.length]),[['20102',4],['30322',5],['30324',3]]);
 const unsigned=structuredClone(forCatalog(published));unsigned.entries=[];
 assert.throws(()=>verifyRelease(published,unsigned),/SHA|不一致|未承認/);
 assert.equal(published.cards.every(x=>x.events.every(e=>
  e.id.startsWith('gt-')&&
  !(x.cardId==='30080'&&e.id==='gt-30080-event-006'))),true);
 const copy=structuredClone(published);
 copy.cards[0].events[0].name+='改ざん';
 assert.throws(()=>verifyRelease(copy,forCatalog(copy)),/SHA|不一致/);
});
test('empty v1 keeps its old empty-approval ledger',()=>{
 const empty={schemaVersion:1,cards:[]};
 assert.equal(forCatalog(empty).schemaVersion,1);
 assert.equal(verifyRelease(empty,forCatalog(empty)).publicEvents,0);
});
