'use strict';
/** Product-specific documentation safeguards; navigation/handoff scenarios are in handoff_quality.test.cjs. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('active product documentation retains source and publication boundaries',()=>{
 const req=read('docs/requirements.md');
 const roadmap=read('docs/roadmap.md');
 const decisions=read('docs/decisions.md');
 assert.match(req,/現行の主入力は第三者GitHubの構造化GameTora派生JSON/);
 assert.match(decisions,/現行.*GameTora派生JSONを主経路/);
 assert.match(roadmap,/GameTora派生GitHub JSON/);
 assert.match(roadmap,/GameWith/);
 assert.match(roadmap,/公開済みイベントの利用受け入れ/);
 assert.doesNotMatch(roadmap,/次の実装順は上の3→4/);
 assert.doesNotMatch(roadmap,/最優先：自動提供方法・利用条件/);
 const verification=read('docs/verification-plan.md');
 assert.match(verification,/2,512件を1件ずつ人手承認する手順は主工程ではない/);
});

test('historical decisions and verification remain available without being treated as current',()=>{
 for(const p of [
  'docs/archive/agents-handoff-20261021.md',
  'docs/archive/readme-before-20261021.md',
  'docs/archive/roadmap-progress-log-20261021.md',
  'docs/verification-history.md',
  'poc/legacy-runbook.md'
 ]) assert.ok(fs.existsSync(path.join(root,p)),p+' must remain recoverable');
 assert.match(read('docs/status.md'),/archive\/status-through-20261105\.md/);
 assert.match(read('docs/roadmap.md'),/archive\/roadmap-through-20261105\.md/);
 for(const p of ['docs/architecture.md','docs/requirements.md']) {
  assert.doesNotMatch(read(p),/現状の公開イベント0件は変わらない|公開DBへの承認済み実イベント収録は0件/,
   p+' must not advertise the superseded zero-release state as current');
 }
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
 assert.equal(verified.publicEvents,approved.cards.reduce((sum,c)=>sum+c.events.length,0));
 assert.equal(verified.publicCards,approved.cards.length);
 assert.ok(approved.cards.every(c=>c.events.every(e=>
  e.id.startsWith('gt-')&&!(c.cardId==='30080'&&
   e.id==='gt-30080-event-006'))),
  '出典が異なる25件を無断公開しない');
});

