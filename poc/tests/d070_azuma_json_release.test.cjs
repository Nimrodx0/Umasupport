'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const manifest=require('../config/d070-azuma-json-release.v1.json');
const catalog=require('../data/reviewed_events.v1.json');
const ledger=require('../config/event-release-approvals.gt2487.v2.json');
const {digest,verifyRelease}=require('../src/event_release_gate.cjs');
const core=require('../src/core.js');
test('D070 published increment is exactly the named reviewed content, not a source dump',()=>{
 for(const pin of manifest.cards){
  const c=catalog.cards.find(x=>x.cardId===pin.cardId),id=n=>'gt-json:'+pin.cardId+':'+n,by=n=>c.events.find(e=>e.id===id(n));
  a.equal(c.coverageStatus,'partial');a.equal(c.events.length,11);
  a.deepEqual(c.events.map(e=>({eventId:e.id,sha256:digest(e)})),pin.eventDigests);
  for(const e of c.events){const entry=ledger.entries.find(x=>x.cardId===c.cardId&&x.eventId===e.id);a.equal(entry.eventSha256,digest(e));}
  a.equal(core.reachability(by(1500),{},c.events).status,'blocked');
  for(const c1 of ['c1','c2'])for(const c2 of ['c1','c2']){
   const choices={[id(1496)]:c1,[id(1502)]:c2};
   a.equal(core.reachability(by(1504),choices,c.events).status,'conditional');
   const routes=core.directRoutes({id:c.cardId,hints:[],events:c.events},{stage:4,choices,outcomes:{}});
   a.ok(routes.some(x=>x.skillId==='skill:202551'&&x.conditional));
  }
 }
 a.equal(verifyRelease(catalog,ledger).reviewedEvents,catalog.cards.reduce((n,c)=>n+c.events.length,0));
});
test('D070 content change or removal of individual approval fails publication',()=>{
 const altered=structuredClone(catalog);altered.cards.find(c=>c.cardId==='10149').events[0].name+='改変';
 a.throws(()=>verifyRelease(altered,ledger));
 const fewer=structuredClone(ledger);fewer.entries=fewer.entries.filter(x=>x.cardId!=='10149');
 a.throws(()=>verifyRelease(catalog,fewer));
});
