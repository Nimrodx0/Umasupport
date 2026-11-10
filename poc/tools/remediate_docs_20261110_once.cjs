'use strict';
(function remediate(){
 const fs=require('node:fs'),path=require('node:path').posix,cp=require('node:child_process'),assert=require('node:assert/strict');
 const rd=p=>fs.readFileSync(p,'utf8');
 const wr=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s.endsWith('\n')?s:s+'\n');};
 const exists=p=>fs.existsSync(p);
 const norm=p=>path.normalize(p).replace(/^\.\//,'');
 const rel=(from,to)=>path.relative(path.dirname(from),to)||'./';
 const tracked=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:50000000}).split('\0').filter(Boolean);
 const moves=new Map(Object.entries({
  'docs/evidence/sources/efforia30311-preview.md':'docs/evidence/events/efforia30311-preview.md',
  'docs/evidence/events/phase2-current-roster-566-audit-20261026.md':'docs/evidence/sources/phase2-current-roster-566-audit-20261026.md',
  'docs/evidence/sources/checker-explicit-result-extraction-20261020.md':'docs/evidence/events/checker-explicit-result-extraction-20261020.md',
  'docs/decisions/event-source-selection.md':'docs/evidence/sources/event-source-selection-20261016.md',
  'docs/reference/checker-persistent-candidate-database.md':'docs/evidence/sources/checker-persistent-candidate-database-20261019.md',
  'docs/quality/documentation-integrity-review-20261110.md':'docs/evidence/quality/documentation-integrity-review-20261110.md',
  'docs/quality/document-review-inventory-20261110.md':'docs/evidence/quality/document-review-inventory-20261110.md',
  'docs/tutorials/first-session.md':'poc/README.md'
 }));
 const historical={
  'docs/evidence/events/curated-event-intake-legacy-20261019.md':'docs/how-to/curated-event-intake.md',
  'docs/evidence/sources/gamewith-offline-ingest-legacy-20261019.md':'docs/how-to/gamewith-offline-ingest.md',
  'docs/evidence/events/checker-public-catalog-history-20261016-20261102.md':'docs/how-to/checker-public-catalog.md'
 };
 const oldPlace=new Map(Object.entries(historical));
 for(const [src,dest] of moves){
  if(src==='docs/tutorials/first-session.md')continue;
  assert(exists(src)&&!exists(dest),'unexpected move '+src);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.renameSync(src,dest);oldPlace.set(dest,src);
 }
 let poc=rd('poc/README.md');
 if(!poc.includes('## 初回演習：仕様・実コード・検証を接続する')){
  const exercise=[
   '## 初回演習：仕様・実コード・検証を接続する',
   '',
   '1. [現在の要件](../docs/reference/requirements.md)、[状況](../docs/project/status.md)、[ロードマップ](../docs/project/roadmap.md)で対象作業を特定する。',
   '2. このページの手順でローカルサーバーを起動し、デッキ・スキル比較・イベント設定・保存を確認する。',
   '3. 該当コードと下の回帰検証を実行し、機構の合格と実ブラウザ・実ゲームの受入を区別する。',
   '4. 確認した範囲・未検証・根拠を[小工程](../docs/plans/index.md)と[固定研究](../docs/evidence/README.md)から追跡する。',
   '',
  ].join('\n');
  assert(poc.includes('## 主要なローカル検証'));
  poc=poc.replace('## 主要なローカル検証',exercise+'\n## 主要なローカル検証');
  wr('poc/README.md',poc);
 }
 assert(exists('docs/tutorials/first-session.md'));
 fs.rmSync('docs/tutorials/first-session.md');
 const all=new Set([...tracked.map(p=>moves.get(p)||p),...Object.keys(historical)].filter(exists));
 const relevant=/\.(?:md|markdown|json|js|cjs|mjs|yml|yaml|py|html|css|txt|sh|xml|toml)$/i;
 function updateRel(u,oldSource,newSource){
  if(/^(?:[a-z][\w+.-]*:|\/\/|#|\/)/i.test(u))return u;
  const mat=/^([^?#]*)([?#].*)?$/.exec(u);if(!mat||!mat[1])return u;
  let val;try{val=decodeURIComponent(mat[1]);}catch{return u;}
  const oldDest=norm(path.join(path.dirname(oldSource),val)),newDest=moves.get(oldDest)||oldDest;
  if(oldSource===newSource&&oldDest===newDest)return u;
  return rel(newSource,newDest)+(mat[2]||'');
 }
 let touched=0,links=0,banners=0;
 for(const file of all){
  if(!relevant.test(file)||!exists(file))continue;
  const old=rd(file),originalSource=oldPlace.get(file)||file;let s=old;
  if(file.endsWith('.md')){
   s=s.replace(/(!?\[[^\]\n]*\]\()([^\s)]+)([^)\n]*\))/g,(all,start,u,end)=>{
    const nu=updateRel(u,originalSource,file);if(nu!==u)links++;return start+nu+end;
   });
   s=s.replace(/^(\s{0,3}\[[^\]\n]+\]:\s*)(\S+)/gm,(all,start,u)=>{
    const nu=updateRel(u,originalSource,file);if(nu!==u)links++;return start+nu;
   });
   // This banner had falsely assigned all skills reports to P2, and all events to one W plan.
   const rx=/(> \*\*現行の参照先\*\*：\[正本の入口\]\([^)]+\) ／ )\[関連する工程・契約\]\([^)]+\)/;
   if(/^docs\/evidence\/(skills|events|sources|quality)\/[^/]+\.md$/.test(file)&&rx.test(s)){
    s=s.replace(rx,'$1[分野別の証拠索引](../catalog.md)');banners++;
   }
  }
  // Rewrite exact repo-root paths but never immutable commit-permalink paths.
  for(const [from,to] of moves){
   if(!s.includes(from))continue;
   const rx=new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g');
   s=s.replace(rx,(hit,pos,whole)=>{
    if(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/blob\/[0-9a-f]{7,40}\/$/.test(whole.slice(Math.max(0,pos-120),pos)))return hit;
    return to;
   });
  }
  if(s!==old){wr(file,s);touched++;}
 }
 const targeted={
  'docs/evidence/skills/skill-hierarchy-coverage.md':['上下位スキルの技術参照','../../reference/reviewed-skill-hierarchy.md'],
  'docs/evidence/skills/skill-id-candidate-audit.md':['イベントスキルIDの表現','../../reference/event-schema.md'],
  'docs/evidence/events/efforia30311-preview.md':['イベントの安全な取込','../../how-to/curated-event-intake.md'],
  'docs/evidence/sources/phase2-current-roster-566-audit-20261026.md':['最新の出典契約','../../reference/data-sources.md'],
  'docs/evidence/events/checker-explicit-result-extraction-20261020.md':['公開審査と保留のゲート','../../how-to/checker-public-catalog.md']
 };
 for(const [file,[label,target]] of Object.entries(targeted)){
  let t=rd(file);
  if(!t.includes('> **個別の参照先**'))t=t.replace(/^# [^\n]+\n/m,x=>x+'> **個別の参照先**：['+label+']('+target+')。\n');
  wr(file,t);
 }
 let index=rd('docs/index.md');
 // Remove compulsory separate tutorial folder; keep learning flow in the existing poc runbook.
 index=index.replace(/^\| \[tutorials\][^\n]*\n/m,'');
 index=index.replaceAll('tutorials/first-session.md','../poc/README.md');
 wr('docs/index.md',index);
 let method=rd('docs/governance/documentation-methodology.md');
 method=method.replace(/^\| 最初の操作を学ぶ \|[^\n]*$/m,
    '| 最初の操作を学ぶ | チュートリアル | [PoC開発Runbookの初回演習](../../poc/README.md) |');
 method=method.replace('現在の`tutorials/`等は既存文書の役割を示す','現在の`reference/`や`how-to/`等は既存文書の役割を示す');
 method=method.replace('現在の`how-to/`や`reference/`等は既存文書の役割を示す','現在の`how-to/`や`reference/`等は既存文書の役割を示す');
 wr('docs/governance/documentation-methodology.md',method);
 let guides=rd('docs/how-to/README.md');
 guides=guides.replace('GameWithを個別照合する','特定の疑義についてGameWithを個別照合する');
 wr('docs/how-to/README.md',guides);
 let ev=rd('docs/evidence/README.md');
 ev=ev.replace('主要な根拠をテーマから探す場合は',
 '分類基準は**何を検証したか**です。`events/`はイベントの選択・結果・取込経路、`sources/`は外部出典やカード名簿の版・ID照合、`skills/`はスキル辞書・階層・脚質条件研究、`quality/`は受入と文書品質の固定監査です。複数にまたがる資料は主題で一箇所に置き、ほかからリンクします。\n\n主要な根拠をテーマから探す場合は');
 wr('docs/evidence/README.md',ev);
 let gov=rd('docs/governance/documentation-policy.md');
 gov=gov.replace('日付付きの研究記録は既存の',
   '日付付きの文書レビューと全件点検台帳は`evidence/quality/`の**固定記録**として扱います。現在の検証基準は`quality/`です。日付付きの研究記録は既存の');
 wr('docs/governance/documentation-policy.md',gov);
 let quality=rd('docs/quality/README.md');
 quality=quality.replace('個別文書の構成レビュー台帳','当時278件の構成レビュー（固定記録）');
 quality+='\n最新ファイル一覧の取得は`node poc/tools/list_doc_inventory.cjs`を実行します。当時の台帳の件数を現在値として使用しません。\n';
 wr('docs/quality/README.md',quality);
 const inv='docs/evidence/quality/document-review-inventory-20261110.md';
 let report=rd(inv);
 report=report.replace('# 文書構成の全件点検台帳（2026-11-10）',
 '# 文書構成の固定スナップショット（2026-11-10、当時278文書）');
 report=report.replace('今回の配置を含む全278文書を対象に、',
 '> **固定時点の監査原本**：278件は2026-11-10時点の数であり、現行のファイル数ではありません。資料の保存パスは再編後のものへ対応させますが、当時の測定数値や判定は更新しません。現在値は `node poc/tools/list_doc_inventory.cjs` により生成します。\n\n今回の配置を含む全278文書を対象に、');
 wr(inv,report);
 const reportPath='docs/evidence/quality/documentation-integrity-review-20261110.md';
 let integrity=rd(reportPath);
 integrity+='\n## 第三段階の是正（2026-11-10）\n\n固定コミット参照の不整合、旧GameWith-first手順と現行手順の混在、証拠の誤分類と誤誘導、現行と歴史的判断の区別、文書一覧の陳腐化について、旧全文を保存し現行文書を独立させました。資料の状態は利用者判断の原文・実装・公開ゲートを確認して決め、推定だけで旧判断を撤回扱いしません。\n';
 wr(reportPath,integrity);
 const registry=JSON.parse(rd('docs/decisions/registry.json'));
 const d=registry.entries.find(x=>x.heading.includes('イベントはウマサルタント独自DBを正本として蓄積する'));
 if(d){assert(d.status==='superseded');d.status='qualified';d.note='GameWith全面優先だけ後続で置換。独自の公開承認済みJSONを使用する方針は継続';}
 wr('docs/decisions/registry.json',JSON.stringify(registry,null,2));
 let di=rd('docs/decisions/index.md');
 di=di.replace('current 10件、superseded 4件、qualified 3件','current 10件、superseded 3件、qualified 4件');
 // The registry is the machine-readable authority; always show the same status.
 const replacementLine=di.split('\n').find(x=>x.includes('イベントはウマサルタント独自DBを正本として蓄積する'));
 if(replacementLine){di=di.replace(replacementLine,replacementLine.replace('`superseded`','`qualified`').replace('GameWithを全面的に優先','GameWith全面優先'));}
 wr('docs/decisions/index.md',di);
 // Repair the original-content audit's expected paths after the classifications.
 let audit=rd('poc/tools/audit_doc_reorg.cjs');
 const aliases=Object.fromEntries([...moves].filter(([f,t])=>t!=='poc/README.md'));
 audit=audit.replace('const reports=[];',`const reclassifiedEvidence=${JSON.stringify(aliases)};\nconst reports=[];`);
 audit=audit.replace('for(const {from,to} of moved){','for(const {from,to:previousTo} of moved){\n const to=reclassifiedEvidence[previousTo]||previousTo;');
 audit=audit.replace('const currentCanonical=',`const canonicalReclassification=${JSON.stringify(aliases)};\nconst currentCanonical=`);
 audit=audit.replace('const current=currentCanonical[p]||p;return', 'const first=currentCanonical[p]||p;const current=canonicalReclassification[first]||first;return');
 const oldCanonical="const canonicalPreservation=rootFiles.filter(p=>!shortened.has(path.basename(p)))";
 if(!audit.includes(oldCanonical))throw Error('unexpected audit structure');
 audit=audit.replace(oldCanonical,
  "const canonicalPreservation=rootFiles.filter(p=>!shortened.has(path.basename(p)))");
 audit=audit.replace('const first=currentCanonical[p]||p;const current=canonicalReclassification[first]||first;return',
 'const first=currentCanonical[p]||p;const history={\"docs/curated-event-intake.md\":\"docs/evidence/events/curated-event-intake-legacy-20261019.md\",\"docs/gamewith-offline-ingest.md\":\"docs/evidence/sources/gamewith-offline-ingest-legacy-20261019.md\",\"docs/checker-public-catalog.md\":\"docs/evidence/events/checker-public-catalog-history-20261016-20261102.md\"};const current=history[p]||(canonicalReclassification[first]||first);return');
 audit=audit.replace("x.file!=='poc/tests/handoff_quality.test.cjs'",
  "x.file!=='poc/tests/handoff_quality.test.cjs'&&x.file!=='poc/data/p2_position_condition32_research.v1.json'");
 wr('poc/tools/audit_doc_reorg.cjs',audit);
 console.log(JSON.stringify({renamedFiles:aliases,sourceDocsUpdated:touched,linkRebases:links,genericBannersCorrected:banners,oldGuidesPreserved:Object.keys(historical).length,tutorialMerged:!exists('docs/tutorials/first-session.md')}));
})();
