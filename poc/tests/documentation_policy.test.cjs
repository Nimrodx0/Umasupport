'use strict';
/** Documentation responsibilities; run in CI without network or third-party data. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const canonical=[
 'AGENTS.md','README.md','docs/index.md','docs/documentation-policy.md',
 'docs/roadmap.md','docs/status.md','docs/requirements.md','docs/decisions.md'
];
test('AI entry point remains permanent policy, not chronological PR log',()=>{
 const a=read('AGENTS.md');
 assert.ok(a.length<=6500,'Keep AGENTS brief and stable; move dated status to docs/status.md');
 assert.match(a,/documentation-policy\.md/);
 assert.match(a,/docs\/status\.md/);
 assert.doesNotMatch(a,/^#{1,3} .*20\d\d-\d\d-\d\d/gm);
 assert.doesNotMatch(a,/^#{1,3} .*PR\s*#\d+/gm);
 assert.doesNotMatch(a,/^## .*実装結果.*\d{3,}/gm);
 assert.match(a,/GameTora/);
 assert.match(a,/GameWith/);
 assert.match(a,/分岐/);
});
test('public entry and roadmap have stable headings and current source precedence',()=>{
 for(const p of ['README.md','docs/roadmap.md']){
  const txt=read(p);
  assert.doesNotMatch(txt,/^#{1,3} .*20\d\d-\d\d-\d\d/gm);
  assert.doesNotMatch(txt,/^#{1,3} .*PR\s*#\d+/gm);
  assert.match(txt,/GameTora/);
  assert.match(txt,/GameWith/);
  assert.match(txt,/status\.md/);
 }
 assert.doesNotMatch(read('README.md'),/イベントデータはGameWithを優先資料に/);
});
test('dated evidence and old complete texts are preserved in dedicated documents',()=>{
 const status=read('docs/status.md');
 assert.match(status,/\*\*(?:最新)?測定日：20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])。\*\*/);
 // The exact measured count must be allowed to progress without failing
 // documentation governance. The full-population audit pins numeric gates.
 assert.match(status,/技術変換/);
 assert.match(status,/\*\*\d[\d,]*件\*\*/);
 assert.match(status,/旧マスター/);
 const agents=read('docs/archive/agents-handoff-20261021.md');
 assert.match(agents,/PR #132/);
 assert.match(agents,/開発支援AI向け引き継ぎ/);
 const readme=read('docs/archive/readme-before-20261021.md');
 assert.match(readme,/GameWithを優先資料/);
 const roadmap=read('docs/archive/roadmap-progress-log-20261021.md');
 assert.match(roadmap,/開発ロードマップ/);
 assert.ok(agents.length>25000&&readme.length>7000&&roadmap.length>12000);
});
test('canonical documentation cross-links resolve on disk',()=>{
 let checked=0;
 for(const p of canonical){
  const text=read(p);
  for(const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
   const raw=match[1].split('#')[0];
   if(!raw||/^(?:https?:|mailto:|data:)/i.test(raw))continue;
   const target=decodeURIComponent(raw);
   assert.equal(fs.existsSync(path.resolve(root,path.dirname(p),target)),true,
    'Broken canonical documentation link in '+p+': '+match[1]);
   checked++;
  }
 }
 assert.ok(checked>25,'Verify every known cross-file reference');
});
