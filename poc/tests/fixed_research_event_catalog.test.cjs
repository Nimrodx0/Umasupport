'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {PIN,URL,verifyFixedEventText,loadFixedEventText}=require('../tools/fixed_research_event_catalog.cjs');
test('fixed research input has immutable identity and rejects current/malformed bytes',()=>{
 assert.equal(PIN.events,2487);assert.equal(PIN.cards,559);
 assert.match(URL,new RegExp(PIN.revision+'/poc/data/reviewed_events.v1.json$'));
 assert.throws(()=>verifyFixedEventText('{}'),/SHA mismatch/);
 const live=require('node:fs').readFileSync(require('node:path').join(__dirname,'../data/reviewed_events.v1.json'));
 // A deliberate rollback to the exact pinned bytes remains a valid research input.
 const liveSha=require('node:crypto').createHash('sha256').update(live).digest('hex');
 if(liveSha===PIN.sha256)assert.equal(verifyFixedEventText(live),live.toString('utf8'));
 else assert.throws(()=>verifyFixedEventText(live),/SHA mismatch/);
 assert.throws(()=>verifyFixedEventText(Buffer.concat([live,Buffer.from(' ')])),/SHA mismatch/);
});
test('missing or tampered historical snapshot fails closed, never falls back to current',async()=>{
 await assert.rejects(loadFixedEventText(async u=>{assert.equal(u,URL);return {ok:false,status:404}}),/HTTP 404/);
 await assert.rejects(loadFixedEventText(async()=>({ok:true,arrayBuffer:async()=>Buffer.from('{}')})),/SHA mismatch/);
});
