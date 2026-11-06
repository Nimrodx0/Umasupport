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
 'docs/roadmap.md','docs/status.md','docs/requirements.md','docs/decisions.md',
 'docs/evidence-index.md','docs/verification-plan.md','docs/verification-history.md','poc/README.md'
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
test('current requirements and roadmap protect the present from old source/approval plans',()=>{
 const req=read('docs/requirements.md');
 const roadmap=read('docs/roadmap.md');
 const verification=read('docs/verification-plan.md');
 const decisions=read('docs/decisions.md');
 assert.match(req,/現行の主入力は第三者GitHubの構造化GameTora派生JSON/);
 assert.match(decisions,/現行.*GameTora派生JSONを主経路/);
 assert.match(roadmap,/現在の製品完成への作業順（正本）/);
 assert.equal((roadmap.match(/^## 現在の製品完成への作業順（正本）$/gm)||[]).length,1);
 assert.match(roadmap,/既存563カード・非公開2,512イベント/);
 assert.match(roadmap,/SSR30240の連続3段階は明示保留済み/);
 assert.match(roadmap,/P2未同定11位置/);
 assert.match(roadmap,/出典未掲載は当該位置だけ保留し、他の作業へ進む/);
 assert.match(roadmap,/GameTora派生GitHub JSON/);
 assert.match(roadmap,/GameWith/);
 assert.match(roadmap,/元サイトHTMLを必須で直接取得する計画は撤回・保留/);
 assert.doesNotMatch(roadmap,/次の実装順は上の3→4/);
 assert.doesNotMatch(roadmap,/最優先：自動提供方法・利用条件/);
 assert.match(read('AGENTS.md'),/既存DBの一括利用と例外管理が主工程/);
 assert.match(verification,/2,512件を1件ずつ人手承認する手順は主工程ではない/);
 assert.match(read('docs/phase2-remaining-checker-skill-impact-20261023.md'),/P2の11位置だけがイベント同定未完/);
 assert.match(read('docs/phase2-first-event-release-rehearsal-20261030.md'),/後続方針：この実装は補助ツール/);
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
 assert.match(roadmap,/公開済みイベントの利用受け入れ/);
 assert.match(decisions,/一般利用者が非公開JSONを都度生成・選択するのではなく/);
 assert.match(app,/UmaPublicEventCatalog\.loadVerified/);
 assert.doesNotMatch(app,/raw\.githubusercontent\.com\/systemless10/);
 assert.doesNotMatch(app,/gametora\.com\/umamusume\/supports/);
 const {forCatalog}=require('../src/current_public_event_approvals.cjs');
 const {verifyRelease}=require('../src/event_release_gate.cjs');
 const verified=verifyRelease(approved,forCatalog(approved));
 assert.equal(verified.publicEvents,2487,
  'ユーザーが承認したGT由来2,487件だけを公開する');
 assert.equal(verified.publicCards,559);
 assert.ok(approved.cards.every(c=>c.events.every(e=>
  e.id.startsWith('gt-')&&!(c.cardId==='30080'&&
   e.id==='gt-30080-event-006'))),
  '出典が異なる25件を無断公開しない');
});

test('handoff policy is discoverable at the entry point and in the PR checklist',()=>{
 const a=read('AGENTS.md');
 const policy=read('docs/documentation-policy.md');
 const template=read('.github/PULL_REQUEST_TEMPLATE.md');
 assert.match(a,/引き継ぎ/);
 assert.match(policy,/引き継ぎ可能性の原則/);
 assert.match(template,/^- \[ \] 引き継ぎに必要な.*正本文書／Issueへ反映した/m);
});

test('entry documents separate current authority from dated evidence',()=>{
 const entry=read('docs/index.md');
 const evidence=read('docs/evidence-index.md');
 const plan=read('docs/verification-plan.md');
 const history=read('docs/verification-history.md');
 const runbook=read('poc/README.md');
 const architecture=read('docs/architecture.md');
 assert.ok(entry.split('\n').length<65,'Entry index should stay navigable');
 assert.match(entry,/evidence-index\.md/);
 assert.match(evidence,/skill-position-rank-band-fit-20261106\.md/);
 assert.match(plan,/verification-history\.md/);
 assert.doesNotMatch(plan,/実イベントの承認件数は0/);
 assert.match(history,/実イベントの承認件数は0/);
 assert.match(runbook,/legacy-runbook\.md/);
 assert.doesNotMatch(runbook,/^# PoC v8\.1/);
 assert.doesNotMatch(architecture,/現状の公開イベント0件は変わらない/);
 assert.match(architecture,/本番配信と出典の境界（現行）/);
});
