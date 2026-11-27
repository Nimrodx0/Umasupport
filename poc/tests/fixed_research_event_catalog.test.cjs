'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PIN,URL,verifyFixedEventText,loadFixedEventText}=require('../tools/fixed_research_event_catalog.cjs');
test('fixed research input has immutable identity and rejects current/malformed bytes',()=>{
 assert.equal(PIN.events,2487);assert.equal(PIN.cards,559);
 assert.match(URL,new RegExp(PIN.revision+'/poc/data/reviewed_events.v1.json$'));
 assert.throws(()=>verifyFixedEventText('{}'),/SHA mismatch/);
 const live=require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/reviewed_events.v1.json'));
 assert.throws(()=>verifyFixedEventText(live),/SHA mismatch/);
});
test('missing or tampered historical snapshot fails closed, never falls back to current',async()=>{
 await assert.rejects(loadFixedEventText(async u=>{assert.equal(u,URL);return {ok:false,status:404}}),/HTTP 404/);
 await assert.rejects(loadFixedEventText(async()=>({ok:true,arrayBuffer:async()=>Buffer.from('{}')})),/SHA mismatch/);
});
