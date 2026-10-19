const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const community=require('../src/community_candidate_preview.js');
const publicCatalog=require('../src/public_event_catalog.js');
const {fixture}=require('./community_candidate_fixture.cjs');
test('44 cards and 119 candidate events are converted only into selectable paths, never automatic grants',()=>{
 const {source,dict,model}=fixture();
 const {catalog,cards,records,omitted}=community.fromSource(source,model,dict);
 assert.equal(cards,44);assert.equal(records,119);
 assert.deepEqual(omitted,{nonNumericStory:2,preferredCard:3,missingSkill:2});
 assert.equal(catalog.cards.length,44);
 for(const c of catalog.cards)for(const e of c.events){
  assert.equal(e.type,'choice');
  assert.ok(e.choices.length>=1);
  assert.equal(e.requires,undefined);
  assert.equal(e.rewards,undefined);
  for(const opt of e.choices){
   assert.match(opt.label,/候補/);
   assert.ok(opt.rewards.every(r=>r.verifiedSkillName));
  }
 }
 const result=publicCatalog.attach(model,catalog,{skillText:dict});
 assert.equal(result.eventsWithRecords,119);
 assert.equal(result.cardsWithRecords,44);
 assert.equal(model.cardById['30311'].events.length,0);
});
test('mutations of source selections and skill names reject the entire candidate batch',()=>{
 for(const change of [
  e=>{e[0].selection='always';},
  e=>{e[0].choices[0].skills[0].skillName='誤字';},
  e=>{e[0].id=e[1].id;},
  e=>{e[1].skills[0].hintLevel=0;},
  e=>{e.push(e[1]);}
 ]){
  const {source,dict,model}=fixture();change(source.events);
  const before=JSON.stringify(model);
  assert.throws(()=>community.fromSource(source,model,dict));
  assert.equal(JSON.stringify(model),before);
 }
});
test('unaligned bytes cannot be read as trusted pinned source, source URL exact',async()=>{
 assert.match(community.URL,/raw\.githubusercontent\.com\/Tsuyuchan-jp/);
 assert.match(community.URL,/0cacbb1aaf9dca10283d5b9ea20b205b9d204535/);
 const bytes=new TextEncoder().encode(JSON.stringify(fixture().source));
 await assert.rejects(()=>community.load({
   fetchImpl:async(url,config)=>({
    ok:true,arrayBuffer:async()=>bytes.buffer
   }),cryptoImpl:webcrypto
 }),/SHA-256/);
 await assert.rejects(()=>community.load({
   fetchImpl:async()=>({ok:false,status:404}),cryptoImpl:webcrypto
 }),/404/);
});

