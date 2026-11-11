'use strict';
/** Product-specific documentation safeguards; navigation/handoff scenarios are in handoff_quality.test.cjs. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('active product documentation retains source and publication boundaries',()=>{
 const req=read('docs/reference/requirements.md');
 const roadmap=read('docs/project/roadmap.md');
 const decisions=read('docs/decisions/log.md');
 assert.match(req,/現行の主入力は第三者GitHubの構造化GameTora派生JSON/);
 assert.match(decisions,/現行.*GameTora派生JSONを主経路/);
 assert.match(roadmap,/GameTora派生GitHub JSON/);
 assert.match(roadmap,/GameWith/);
 assert.match(roadmap,/公開済みイベントの利用受け入れ/);
 assert.doesNotMatch(roadmap,/次の実装順は上の3→4/);
 assert.doesNotMatch(roadmap,/最優先：自動提供方法・利用条件/);
 const verification=read('docs/quality/verification-plan.md');
 assert.match(verification,/2,512件を1件ずつ人手承認する手順は主工程ではない/);
});

test('historical decisions and verification remain available without being treated as current',()=>{
 for(const p of [
  'docs/archive/agents-handoff-20261021.md',
  'docs/archive/readme-before-20261021.md',
  'docs/archive/roadmap-progress-log-20261021.md',
  'docs/history/verification-history.md',
  'poc/legacy-runbook.md'
 ]) assert.ok(fs.existsSync(path.join(root,p)),p+' must remain recoverable');
 assert.match(read('docs/project/status.md'),/archive\/status-through-20261105\.md/);
 assert.match(read('docs/project/roadmap.md'),/archive\/roadmap-through-20261105\.md/);
 for(const p of ['docs/reference/architecture.md','docs/reference/requirements.md']) {
  assert.doesNotMatch(read(p),/現状の公開イベント0件は変わらない|公開DBへの承認済み実イベント収録は0件/,
   p+' must not advertise the superseded zero-release state as current');
 }
});

test('automatic delivery priority is coherent, and unapproved private source is never silently fetched',()=>{
 const plan=read('docs/evidence/events/phase2-event-delivery-route-assessment-20261030.md');
 const roadmap=read('docs/project/roadmap.md');
 const decisions=read('docs/decisions/log.md');
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


test('owner-approved cross-cutting docs track is reachable from project, plans and agent entrypoints',()=>{
 const plan=read('docs/plans/documentation-maintenance.md');
 for(const file of ['docs/project/README.md','docs/project/roadmap.md',
  'docs/index.md','AGENTS.md']){
  assert.match(read(file),/plans\/documentation-maintenance\.md/,file);
 }
 assert.match(read('docs/plans/index.md'),/\(documentation-maintenance\.md\)/);
 assert.match(plan,/個別.+発見時/);
 assert.match(plan,/複数.+一括改修/);
});

test('new cross-cutting track creation includes top-level discovery checklist',()=>{
 const guide=read('docs/how-to/update-docs.md');
 assert.match(guide,/新しい独立工程・トラックを設ける場合/);
 for(const name of ['project/roadmap.md','project/README.md',
  'plans/index.md','docs/index.md','AGENTS.md']){
  assert.ok(guide.includes(name),'missing track-check entry: '+name);
 }
 assert.match(guide,/一情報・一正本/);
 assert.match(guide,/不要な更新は強制しません/);
});

test('terminology governance keeps one canonical definition entry, agent instructions and D.3 migration discoverable',()=>{
 const agents=read('AGENTS.md');
 const terms=read('docs/reference/terminology.md');
 const policy=read('docs/governance/documentation-policy.md');
 const d=read('docs/plans/documentation-maintenance.md');
 const howto=read('docs/how-to/update-docs.md');
 const reference=read('docs/reference/index.md');
 const docs=read('docs/index.md');
 const log=read('docs/decisions/log.md');
 const decisions=JSON.parse(read('docs/decisions/registry.json'));
 const index=read('docs/decisions/index.md');
 for(const name of [
  '概念を先に明確化する','意味を読み取りやすく命名する',
  '定義を明示する','一概念一優先用語を徹底する',
  '定義の正本を維持する','名称・定義の変更を管理する'
 ])assert.ok(agents.includes(name),'missing permanent agent rule: '+name);
 for(const x of [agents,policy,howto,reference,docs])
  assert.match(x,/terminology\.md/);
 assert.match(d,/D\.3/);
 assert.match(d,/棚卸し/);
 assert.match(d,/全領域の棚卸しと移行は未完/);
 // Rules belong to AGENTS; the index only routes terms to their
 // domain-specific primary definitions. No research report content belongs here.
 assert.match(agents,/命名・定義の規則はこの節が正本/);
 assert.match(agents,/用語索引/);
 assert.match(terms,/^# 用語と定義の索引$/m);
 assert.match(terms,/^## 用語の参照先$/m);
 assert.match(terms,/定義そのものは各分野の仕様書・研究資料に置き/);
 assert.match(terms,/AGENTS\.md/);
 assert.match(terms,/条件成立機会（W）/);
 assert.match(terms,/脚質間の条件成立機会差/);
 assert.match(terms,/skill-specificity32-two-axis-20261109\.md#1-/);
 assert.match(terms,/skill-p2-30-context-margin-sensitivity-20261111\.md#方法と限界/);
 assert.match(terms,/requirements\.md/);
 assert.match(terms,/event-schema\.md/);
 assert.doesNotMatch(terms,/^## 正本の管理原則|^## P2の研究用指標/m);
 assert.doesNotMatch(terms,/5,760|0・1・3・5|10m|仮の最小差幅/);
 assert.doesNotMatch(terms,/初出時に説明する|名称・意味を変える場合は/);
 assert.match(policy,/必須規則は\[AGENTS\.md\]/);
 assert.match(policy,/定義の正本を探す入口/);
 assert.match(d,/索引に研究本文や定義・管理規則を重複記載しない/);
 assert.match(log,/decision-d-044/);
 assert.ok(decisions.entries.some(e=>e.id==='D-044'&&e.status==='current'&&
  e.sourceAnchor==='decision-d-044'));
 assert.match(index,/<a id="d-044"><\/a>/);
 assert.match(read('docs/project/roadmap.md'),/D\.3：専門用語と定義の正本/);
});
