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
test('current requirements and roadmap do not reactivate superseded HTML intake',()=>{
 const req=read('docs/requirements.md');
 const roadmap=read('docs/roadmap.md');
 const verification=read('docs/verification-plan.md');
 const decisions=read('docs/decisions.md');
 assert.match(req,/現行の主入力は第三者GitHubの構造化GameTora派生JSON/);
 assert.match(req,/2026-10-27のGameTora本体直接取得方針（2026-10-29撤回）/);
 assert.doesNotMatch(req,/この工程の唯一のイベント情報入力はGameTora本体/);
 assert.doesNotMatch(req,/GameTora本体に表示された\*\*新カードのイベントだけ\*\*/);
 assert.match(decisions,/現行.*GameTora派生JSONを主経路/);
 assert.match(roadmap,/現在の製品完成への作業順（正本）/);
 assert.equal((roadmap.match(/^### 現在の製品完成への作業順/gm)||[]).length,1);
 assert.match(roadmap,/他Phaseの横断検証（上記とは別の優先順ではない）/);
 assert.match(roadmap,/2,512イベント/);
 assert.match(roadmap,/2,125件／保留363件/);
 assert.match(verification,/以下は2026-10-29に撤回した直接取得先行条件の履歴/);
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
