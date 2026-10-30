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
 assert.match(roadmap,/既存カードのPhase 2は、2026-10-23〜26に全件検証した非公開563カード・2,512イベント/);
 assert.match(roadmap,/SSR30240の連続3段階/);
 assert.match(roadmap,/P2未同定11位置/);
 assert.match(roadmap,/2,512との件数差の解消、363件の再実装、既存DBの作り直しを今後の作業にしない/);
 assert.match(roadmap,/既存DBの一括利用と例外管理を主工程にする/);
 assert.match(roadmap,/2,512件を1件ずつ手動承認することを製品完成の前提条件にしない/);
 assert.match(roadmap,/元サイト／元GitHubから読み込んでローカルで正規化/);
 assert.match(roadmap,/現在の.event_release_gate.cjs.との整合/);
 assert.match(read('AGENTS.md'),/既存DBの一括利用と例外管理が主工程/);
 assert.match(read('docs/decisions.md'),/1件ずつ人手承認して公開DBへ追記する手順を必須としない/);
 assert.match(read('docs/phase2-first-event-release-rehearsal-20261030.md'),/後続方針：この実装は補助ツール/);
 assert.match(verification,/2,512件を1件ずつ人手承認する手順は主工程ではない/);
 assert.doesNotMatch(roadmap,/対象ソースと版、出典にないイベント、既に採用した編集事実、保留の位置を対応付ける/);
 assert.match(read('AGENTS.md'),/既存Phase 2を再作成しない/);
 assert.match(read('docs/derived-github-whole-roster-app-draft-audit-20261029.md'),/履歴・現行の工程外/);
 assert.match(roadmap,/SSR30240.*明示保留済み/);
 assert.match(roadmap,/出典未掲載は当該位置だけ保留し、他の作業へ進む/);
 assert.match(read('docs/phase2-30240-gamewith-gap-utools-only-replay-20261022.md'),/2026-10-30 再確認：元資料未掲載のため明示保留/);
 assert.match(read('docs/phase2-remaining-checker-skill-impact-20261023.md'),/P2の11位置だけがイベント同定未完/);
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

test('automatic delivery priority is coherent, and unapproved private source is never silently fetched',()=>{
 const plan=read('docs/phase2-event-delivery-route-assessment-20261030.md');
 const roadmap=read('docs/roadmap.md');
 const decisions=read('docs/decisions.md');
 const app=read('poc/live.html');
 const approved=JSON.parse(read('poc/data/reviewed_events.v1.json'));
 assert.match(plan,/ユーザーがアプリを開けば自動的にイベントを使える状態/);
 assert.match(plan,/ライセンス表示/);
 assert.match(plan,/文化庁/);
 assert.match(plan,/元データの再利用許可を意味しない/);
 assert.match(plan,/既存の同一オリジン公開ローダー/);
 assert.match(plan,/元文の転記を一括許可しない/);
 assert.match(roadmap,/最優先：自動提供方法・利用条件/);
 assert.match(decisions,/一般利用者が非公開JSONを都度生成・選択するのではなく/);
 assert.match(app,/UmaPublicEventCatalog\.loadVerified/);
 assert.doesNotMatch(app,/raw\.githubusercontent\.com\/systemless10/);
 assert.doesNotMatch(app,/gametora\.com\/umamusume\/supports/);
 assert.deepEqual(approved.cards,[],'未審査の2,512件を公開元へ黙って投入しない');
});
