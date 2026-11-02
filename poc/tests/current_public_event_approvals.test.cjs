'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {forCatalog}=require('../src/current_public_event_approvals.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const published=require('../data/reviewed_events.v1.json');
test('owner-approved 2487 existing GT events, never unapproved editorial additions',()=>{
 const actual=verifyRelease(published,forCatalog(published));
 assert.equal(actual.publicEvents,2487);
 assert.equal(actual.publicCards,559);
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
