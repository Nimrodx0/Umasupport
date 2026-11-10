'use strict';
/** Conservative readability pass: preserve all original research bodies. */
const fs=require('node:fs');
const path=require('node:path').posix;
const cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v.endsWith('\n')?v:v+'\n');};
const rel=(p,q)=>path.relative(path.dirname(p),q)||'./';
const evidence=cp.execFileSync('git',['ls-files','--','docs/evidence/**/*.md'],{encoding:'utf8'}).split('\n').filter(Boolean)
  .filter(p=>/^docs\/evidence\/(skills|events|sources|quality)\/[^/]+\.md$/.test(p)&&!p.endsWith('/README.md'));
const groupDesc={
 skills:['スキル・発動条件に関する固定調査','docs/plans/skill-conditions/p2.md'],
 events:['イベントの変換・審査に関する調査','docs/plans/product.md'],
 sources:['外部出典・派生DBの照合','docs/data-sources.md'],
 quality:['機能・開発品質の検証','docs/verification-plan.md']
};
let metadata=0,paragraphs=0;
for(const p of evidence){
 let s=read(p);
 if(s.includes('**資料の位置づけ**'))continue;
 const g=p.split('/')[2],[label,target]=groupDesc[g];
 const note='\n> **資料の位置づけ**：'+label+'（時点付きの証拠）。本文の測定対象・出典版・留保を確認してください。\n> **現行の参照先**：[正本の入口]('+rel(p,'docs/index.md')+') ／ [関連する工程・契約]('+rel(p,target)+')。執筆当時の「現在」「次工程」は現行の指示ではありません。\n';
 const h=/^# [^\n]*\n/.exec(s);
 s=h?s.slice(0,h[0].length)+note+s.slice(h[0].length):note+'\n'+s;
 // Split only exceptionally long, plain prose (never tables, list items, code or headings).
 let inFence=false;
 s=s.split('\n').map(line=>{
  if(/^\s*(`{3,}|~{3,})/.test(line)){inFence=!inFence;return line;}
  if(inFence||line.length<640||/^\s*(?:[-*+]\s|\d+\.\s|>|#|\||<| {4})/.test(line))return line;
  // Preserve body paragraphs exactly; editing prose requires evidence-specific review.
  return line;
 }).join('\n');
 write(p,s);metadata++;
}
const kinds={
 'requirements.md':['参照：現在の要件','確定した機能・対象外・受入条件'],
 'decisions.md':['判断履歴','個別の採用・撤回・置換理由'],
 'architecture.md':['参照：現行構造','実際のモジュール・データ経路'],
 'event-schema.md':['技術契約と追補','イベント表現と時点付きの拡張'],
 'data-sources.md':['ソース契約と履歴','現行入力と過去の比較・調査'],
 'verification-plan.md':['検証基準','A/B/Cゲートと判定条件'],
 'verification-history.md':['検証履歴','過去の試験結果と当時の状況'],
 'development-history.md':['開発履歴','PR・実装の時点別記録'],
 'skill-activation-tendencies-design.md':['設計と研究追補','脚質条件解釈の設計と変更経緯'],
 'upstream-refresh-operations.md':['運用手順と履歴','固定出典の更新検知・保留'],
 'event-adjudication-enforcement.md':['技術契約','イベント結果の裁定と公開条件'],
 'event-source-selection.md':['出典選定の説明','比較と採用理由'],
 'curated-event-intake.md':['運用手順','イベントの取込・検証'],
 'checker-public-catalog.md':['公開ゲート','承認・保留・非公開の境界'],
 'reviewed-skill-hierarchy.md':['技術参照','スキル階層の同定と例外'],
 'card-image-rights-decision.md':['判断履歴','画像の権利と公開範囲'],
 'checker-persistent-candidate-database.md':['技術参照','候補データベースと保留'],
 'runtime-data-loading.md':['技術参照','実行時取得・検証・キャッシュ'],
 'gamewith-offline-ingest.md':['出典別手順','オフライン取得・変換の検証']
};
function slug(t){return t.toLowerCase().replace(/^#{1,6} /,'').replace(/[^\p{L}\p{N}\p{M}_ -]/gu,'').trim().replace(/\s+/g,'-');}
let navigated=0;
for(const [name,[type,role]] of Object.entries(kinds)){
 const f='docs/'+name;
 if(!fs.existsSync(f))continue;
 let s=read(f);if(s.includes('## この文書の読み方'))continue;
 const m=/^# [^\n]*\n/.exec(s);if(!m)continue;
 const headings=s.split('\n').filter(l=>/^## /.test(l));
 const core=headings.slice(0,10).map(h=>'- ['+h.slice(3)+'](#'+slug(h)+')').join('\n');
 const note='\n## この文書の読み方\n\n**文書の種類**：'+type+'。**用途**：'+role+'。\n\n有効仕様は[要件](requirements.md)、現行の到達点は[status](status.md)、作業順は[ロードマップ](roadmap.md)を優先します。日付付きの過去の観測・決定を、現在の値や指示として読まないでください。\n\n'+(headings.length>2?'### 主な章\n\n'+core+'\n\n':'');
 s=s.slice(0,m[0].length)+note+s.slice(m[0].length);
 write(f,s);navigated++;
}
function prependLink(file,marker,insert){
 let s=read(file);if(s.includes(insert))return;
 if(!s.includes(marker))throw new Error('Cannot locate '+marker+' in '+file);
 write(file,s.replace(marker,insert+'\n\n'+marker));
}
prependLink('docs/index.md','## 文書の地図',
  '## 目的から探す\n\n[初回演習](tutorials/first-session.md) ／ [文書更新手順](how-to/update-docs.md) ／ [技術リファレンス](reference/index.md) ／ [設計の解説](explanation/index.md) ／ [方法論と適用範囲](documentation-methodology.md) ／ [ADR](adr/README.md) ／ [WBS Dictionary](plans/wbs-dictionary.md)');
prependLink('docs/documentation-policy.md','## 原則',
  '[文書体系の方法論](documentation-methodology.md) ／ [成果物と受入条件](plans/wbs-dictionary.md) ／ [ADRの管理](adr/README.md) ／ [情報保全の監査](quality/documentation-integrity-review-20261110.md)');
prependLink('docs/plans/index.md','## 小工程の管理単位',
  '上位工程の成果物・依存関係・受入条件は[WBS Dictionary](wbs-dictionary.md)で管理しています。');
prependLink('docs/roadmap.md','## 目的と判定',
  '工程ごとの成果物と終了条件は[WBS Dictionary](plans/wbs-dictionary.md)で確認できます。');
prependLink('AGENTS.md','## 作業を再開する',
  '読み手を意識した記述方法は[文書設計の方法論](docs/documentation-methodology.md)と[文書更新の手順](docs/how-to/update-docs.md)を参照します。');
let decision=read('docs/decisions.md');
if(!decision.includes('decisions/index.md')){decision=decision.replace('## この文書の読み方','[意思決定の全項目索引](decisions/index.md) ／ [新しい設計判断のADR](adr/README.md)\n\n## この文書の読み方');write('docs/decisions.md',decision);}
const dhead=decision.split('\n').filter(l=>l.startsWith('## ')&&!l.startsWith('## この文書の読み方'));
const dindex='# 意思決定ログの全項目索引\n\n[本文](../decisions.md)は利用者が確定した時点の記録です。各決定の有効性は[後続判断](../decisions.md)と[要件](../requirements.md)を照合してください。旧判断を現在有効と自動認定するものではありません。\n\n'+dhead.map((h,i)=>String(i+1).padStart(2,'0')+'. ['+h.slice(3)+'](../decisions.md#'+slug(h)+')').join('\n')+'\n';
write('docs/decisions/index.md',dindex);
// Complete review inventory for every tracked Markdown file, plus generated index.
const all=cp.execFileSync('git',['ls-files','--','*.md'],{encoding:'utf8'}).split('\n').filter(p=>p.startsWith('docs/')&&fs.existsSync(p));
for(const p of ['docs/decisions/index.md'])if(!all.includes(p))all.push(p);
const inventoryPath='docs/quality/document-review-inventory-20261110.md';
const rows=all.sort().map(p=>{
 const s=read(p),headingCount=s.split('\n').filter(l=>/^#{1,6} /.test(l)).length;
 const longLines=s.split('\n').filter(l=>l.length>400).length;
 const category=p.startsWith('docs/evidence/')?'固定調査・監査':p.startsWith('docs/archive/')?'過去の保存版':p.startsWith('docs/plans/')?'成果物・実装計画':p.startsWith('docs/adr/')?'判断記録':p.startsWith('docs/tutorials/')?'導入演習':p.startsWith('docs/how-to/')?'手順':p.startsWith('docs/reference/')?'リファレンス':p.startsWith('docs/explanation/')?'解説':'正本・索引等';
 const state=longLines>0?'長文箇所の個別編集は継続候補':'文書の役割と参照先を確認';
 return '| ['+path.basename(p)+']('+rel(inventoryPath,p)+') | '+category+' | '+headingCount+' | '+longLines+' | '+state+' |';
});
const inv='# 文書構成の全件点検台帳（2026-11-10）\n\n既存Markdownを対象に、文書の役割・見出し数・400文字を超える行数を機械的に調べた一覧です。資料本文の事実性の査読とは異なります。研究原本は本文を保全して説明と導線を追加し、現行の重要文書には読み方と章への案内を設けました。**数値の裏付けや内部の技術的な意味を推測して変更していません**。\n\n| 文書 | 種別 | 見出し数 | 長文行数 | 継続的な改善候補 |\n| --- | --- | ---: | ---: | --- |\n'+rows.join('\n')+'\n';
write(inventoryPath,inv);
console.log(JSON.stringify({reviewedEvidence:metadata,restructuredRoot:navigated,splitVeryLongProseLines:paragraphs,indexedDecisions:dhead.length,indexedDocuments:rows.length},null,2));
