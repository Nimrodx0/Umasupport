'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildView,fingerprint}=require('../src/phase2_eight_event_review_view.cjs');
const {makeServer,html,main}=require('../tools/preview_phase2_standalone_local.cjs');
test('4 SSR cards and 8 readable review titles remain explicitly unapproved',()=>{
 const v=buildView();
 assert.deepEqual(v.summary,{cards:4,events:8,choiceRows:16,hintMentions:4,approvedEvents:0});
 assert.deepEqual(v.cards.map(c=>[c.cardId,c.events.length]),
  [['30318',2],['30319',2],['30320',2],['30321',2]]);
 assert.ok(v.cards.every(c=>c.events.every(e=>e.choices.length===2&&
  e.sourceHeadingSha256.length===64&&
  e.actualInGameEventIdVerified===false&&
  e.actualPlayerChoiceAndAllOutcomesVerified===false&&
  e.displayKind==='ORIGINAL_EDITORIAL_SUMMARY_NOT_GAME_TITLE')));
 assert.ok(v.cards.every(c=>c.events.every(e=>e.choices.every(x=>
  x.resultTopologyVerified===false&&x.publicationApproved===false))));
 assert.match(v.note,/実ゲーム.*未確認/);
 assert.ok(!JSON.stringify(v).includes('体育館を借りて走ろう'));
});
test('NFKC headline fingerprints match the exact observed GameWith card headings without copying them into JSON',()=>{
 for(const [card,ord,title] of [
  ['30318',4,'お花屋さんでの1ページ'],['30318',5,'曇りの日の1ページ'],
  ['30319',4,'生徒会役員！'],['30319',5,'孤狼'],
  ['30320',4,'窓側が好きなお客さん'],['30320',5,'ひとりが好きなクラスメイトさん'],
  ['30321',4,'流すべきこの汗'],['30321',5,'追うべき背中']
 ]){
  const e=buildView().cards.find(c=>c.cardId===card).events
   .find(e=>e.editorialOrdinal===ord);
  assert.equal(fingerprint(title),e.sourceHeadingSha256,card+'/'+ord);
  assert.ok(!JSON.stringify(buildView()).includes(title));
 }
});
test('skill hint names and numeric IDs are distinct and choice-local',()=>{
 const out=buildView();
 assert.deepEqual(out.cards.flatMap(c=>c.events.flatMap(e=>
  e.choices.flatMap(x=>x.hints.map(h=>
   [c.cardId,e.editorialOrdinal,x.ordinal,h.skillId,h.level,h.displayName])))),
  [['30318',5,2,'skill:200152',1,'良バ場○'],
   ['30319',5,2,'skill:201641',1,'一匹狼'],
   ['30320',5,1,'skill:202082',1,'ワンチャンス'],
   ['30321',5,2,'skill:202602',1,'イグニッション']]);
});
test('local HTTP server only serves four exact GET paths; no write or runtime release',async()=>{
 const server=makeServer();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const [uri,type] of [['/','text/html'],['/index.html','text/html'],
   ['/data.json','application/json'],['/core.js','text/javascript'],
   ['/review.js','text/javascript']]){
   const r=await fetch(base+uri);
   assert.equal(r.status,200,uri);
   assert.ok(r.headers.get('content-type').startsWith(type));
   assert.equal(r.headers.get('cache-control'),'no-store');
  }
  const bad=await fetch(base+'/../../poc/data/reviewed_events.v1.json');
  assert.equal(bad.status,404);
  const post=await fetch(base+'/data.json',{method:'POST'});
  assert.equal(post.status,405);
  const d=await (await fetch(base+'/data.json')).json();
  assert.equal(d.summary.approvedEvents,0);
  assert.ok(!JSON.stringify(d).includes('すごい力作だな'));
 }finally{await new Promise(ok=>server.close(ok));}
 assert.deepEqual(require('../data/reviewed_events.v1.json').cards,[]);
 assert.deepEqual(require('../config/event-release-approvals.v1.json').entries,[]);
});
test('local CLI refuses external host and untrusted port input',()=>{
 assert.throws(()=>main(['--host=0.0.0.0']),/usage/);
 assert.throws(()=>main(['--port=-1']),/usage/);
 assert.throws(()=>main(['--port=99999']),/out of range/);
 assert.match(html(),/GitHub Pagesには組み込みません/);
});
