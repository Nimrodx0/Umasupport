'use strict';
(function performMigration(){
  const fs=require('node:fs'),path=require('node:path').posix,cp=require('node:child_process'),assert=require('node:assert/strict');
  const groups={
    reference:['architecture','checker-persistent-candidate-database','data-sources','event-adjudication-enforcement','event-schema','requirements','reviewed-skill-hierarchy','runtime-data-loading'],
    decisions:['card-image-rights-decision','event-data-acquisition-rights-20261019','event-source-selection'],
    'how-to':['checker-public-catalog','curated-event-intake','gamewith-offline-ingest','upstream-refresh-operations'],
    history:['development-history','verification-history'],
    governance:['documentation-methodology','documentation-policy'],
    explanation:['skill-activation-tendencies-design'],
    project:['roadmap','status'],
    quality:['verification-plan']
  };
  const moves=new Map();
  for(const [dir,items] of Object.entries(groups))for(const name of items)moves.set('docs/'+name+'.md','docs/'+dir+'/'+name+'.md');
  moves.set('docs/decisions/log.md','docs/decisions/log.md');
  moves.set('docs/evidence/catalog.md','docs/evidence/catalog.md');
  const tracked=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:80*1024*1024}).split('\0').filter(Boolean);
  const rootDocs=tracked.filter(p=>/^docs\/[^/]+\.md$/.test(p)).sort();
  assert.deepEqual(rootDocs.filter(p=>p!=='docs/index.md'),[...moves.keys()].sort(),'Root docs changed; classify all before migrating');
  for(const [oldFile,newFile] of moves){assert(fs.existsSync(oldFile));assert(!fs.existsSync(newFile));fs.mkdirSync(path.dirname(newFile),{recursive:true});fs.renameSync(oldFile,newFile);}
  const norm=p=>path.normalize(p).replace(/^\.\//,'');
  function rebase(url,oldSource,newSource){
    if(/^(?:[a-z][\w+.-]*:|\/\/|#|\/)/i.test(url))return url;
    const m=/^([^?#]*)([?#].*)?$/.exec(url);if(!m||!m[1])return url;
    let decoded;try{decoded=decodeURIComponent(m[1]);}catch{return url;}
    const oldDest=norm(path.join(path.dirname(oldSource),decoded)),newDest=moves.get(oldDest)||oldDest;
    if(oldDest===newDest&&oldSource===newSource)return url;
    let rel=path.relative(path.dirname(newSource),newDest)||'./';
    if(decoded.endsWith('/')&&!rel.endsWith('/'))rel+='/';
    return rel+(m[2]||'');
  }
  let updated=0,links=0;const modified=[];
  const extensions=/\.(?:md|markdown|yml|yaml|json|js|cjs|mjs|html|css|py|sh|txt|toml|xml)$/i;
  for(const from of tracked){
    const dest=moves.get(from)||from;
    if(!extensions.test(dest)||!fs.existsSync(dest))continue;
    const original=fs.readFileSync(dest,'utf8');let text=original;
    if(dest.endsWith('.md')){
      text=text.replace(/(!?\[[^\]\n]*\]\()([^\s)]+)([^)\n]*\))/g,(m,p,u,z)=>{const v=rebase(u,from,dest);if(v!==u)links++;return p+v+z;});
      text=text.replace(/^(\s{0,3}\[[^\]\n]+\]:\s*)(\S+)/gm,(m,p,u)=>p+rebase(u,from,dest));
      // Inline code paths in moved Markdown documents.
      if(from!==dest)text=text.replace(/\x60([^\x60\n]+)\x60/g,(full,val)=>{
        if(!/^(?:\.\.\/|\.\/|[A-Za-z0-9_.-]+\/)[A-Za-z0-9_./-]+\.md(?:[#?][^\s]*)?$/.test(val))return full;
        return '\x60'+rebase(val,from,dest)+'\x60';
      });
    }
    // Narrow exact path substitutions, including CI paths and code references.
    for(const [o,n] of moves){
      if(text.includes(o))text=text.split(o).join(n);
    }
    if(text!==original){fs.writeFileSync(dest,text);updated++;modified.push(dest);}
  }
  const testFile='poc/tests/handoff_quality.test.cjs';
  let test=fs.readFileSync(testFile,'utf8');
  const fixtureMark="fs.mkdirSync(path.join(temp, 'docs'));";
  assert(test.includes(fixtureMark));
  test=test.replace(fixtureMark,"fs.mkdirSync(path.join(temp, 'docs/reference'), {recursive: true});");
  test=test.replaceAll("'[Current contract](requirements.md)\\n'","'[Current contract](reference/requirements.md)\\n'");
  test=test.replaceAll("! /^(?:docs\\/development-history", "! /^(?:docs\\/history\\/development-history");
  if(!test.includes('docs root contains only index.md'))test+="\n"+
   "test('docs root contains only index.md',()=>{\n"+
   " const loose=fs.readdirSync(path.join(root,'docs'),{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.md')).map(x=>x.name).sort();\n"+
   " assert.deepEqual(loose,['index.md']);\n"+
   "});\n";
  fs.writeFileSync(testFile,test);
  // Keep the non-destructive preservation audit valid for moved canonical docs.
  const auditName='poc/tools/audit_doc_reorg.cjs';
  let audit=fs.readFileSync(auditName,'utf8');
  const mappingJSON=JSON.stringify(Object.fromEntries(moves));
  assert(audit.includes('const rootFiles=original.filter('));
  audit=audit.replace('const rootFiles=original.filter(',
    'const currentCanonical='+mappingJSON+';\nconst rootFiles=original.filter(');
  const needle="const canonicalPreservation=rootFiles.filter(p=>!shortened.has(path.basename(p))&&fs.existsSync(p))\n  .map(p=>({file:p,...orderedSubset(getOld(p),fs.readFileSync(p,'utf8'))}));";
  assert(audit.includes(needle),'Canonical audit structure changed');
  audit=audit.replace(needle,
    "const canonicalPreservation=rootFiles.filter(p=>!shortened.has(path.basename(p)))\n"+
    "  .map(p=>{const current=currentCanonical[p]||p;return {file:current,...(fs.existsSync(current)?orderedSubset(getOld(p),fs.readFileSync(current,'utf8')):{ok:false,reason:'missing canonical document'})};});");
  fs.writeFileSync(auditName,audit);
  // New folder entry points, for GitHub's collapsible tree and for readers.
  const guides={
    'docs/project/README.md':`# 進捗と方針

- [ロードマップ](roadmap.md)：これからの優先順位
- [現在の開発状況](status.md)：検証済みの到達点
- [下位工程](../plans/index.md)：W1～W5・P0～P5の具体的な作業と根拠

過去の状態は[history](../history/README.md)と[archive](../archive/)へ分離しています。
`,
    'docs/governance/README.md':`# 文書管理規則

- [文書運用規約](documentation-policy.md)：正本の場所・更新条件
- [文書設計方法論](documentation-methodology.md)：Diátaxis、WBS、ADR、Docs as Codeの適用範囲
- [全体の入口](../index.md)

技術的な受入基準は[quality](../quality/README.md)です。
`,
    'docs/history/README.md':`# 継続更新される履歴

- [開発履歴](development-history.md)
- [検証履歴](verification-history.md)
- [凍結した旧版](../archive/)

記録時点の「現在」は現行の仕様・工程と区別してください。
`,
    'docs/how-to/README.md':`# 目的別の作業手順

| 作業 | 手順 |
| --- | --- |
| 文書を更新する | [文書更新](update-docs.md) |
| 取得元の差分を調べる | [出典更新](upstream-refresh-operations.md) |
| イベントを取り込む | [イベント取込・校正](curated-event-intake.md) |
| GameWithを照合する | [オフライン取得](gamewith-offline-ingest.md) |
| 候補を公開承認する | [公開審査](checker-public-catalog.md) |

古い手順を再利用する前に[現在の判断](../decisions/log.md)と[開発状況](../project/status.md)を確認してください。
`,
    'docs/quality/README.md':`# 品質・受入基準

- [検証計画](verification-plan.md)：A/B/Cの受入条件
- [文書の情報保持監査](documentation-integrity-review-20261110.md)
- [個別文書の構成レビュー台帳](document-review-inventory-20261110.md)
- [過去の検証結果](../history/verification-history.md)
- [時点付きの品質証拠](../evidence/quality/README.md)

品質基準と、過去に実行した試験の結果を分けて管理します。
`
  };
  for(const [p,v] of Object.entries(guides)){
    assert(!fs.existsSync(p),p+' already exists');
    fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);
  }
  // The only docs root Markdown becomes an intentionally simple navigation file.
  fs.writeFileSync('docs/index.md',`# ウマサルタントの文書

ここが文書の入口です。**docs直下にはこのindex.md以外のMarkdownを置きません。** 各ファイルは読者の目的と責任範囲に応じて整理しています。

## まず探すもの

| 知りたいこと | 文書 |
| --- | --- |
| 何ができるアプリか | [現在有効な要件](reference/requirements.md) |
| 今どこまで完成しているか | [現在の状況](project/status.md) |
| 次に何を作るのか | [上位ロードマップ](project/roadmap.md) |
| P0～P5の細かい研究工程と結果 | [研究計画](plans/skill-conditions/index.md) |
| 仕様がそうなった理由 | [確定した判断](decisions/log.md) |
| データの構造と取り込み方 | [技術リファレンス](reference/index.md) |
| 実際の作業の手順 | [How-to](how-to/README.md) |
| 実験や監査の根拠 | [固定研究の索引](evidence/catalog.md) |

## フォルダ一覧

| フォルダ | 役割 |
| --- | --- |
| [project](project/README.md) | 現在の進捗と上位計画 |
| [plans](plans/index.md) | 製品・研究の小工程、依存、受入基準 |
| [reference](reference/index.md) | 有効要件、技術・データ・イベントの定義 |
| [how-to](how-to/README.md) | 出典更新、イベント取込、公開審査などの手順 |
| [tutorials](tutorials/first-session.md) | 初めての開発・確認演習 |
| [explanation](explanation/index.md) | 設計や推定の根拠と限界 |
| [decisions](decisions/index.md) | ユーザー判断、権利、出典選定の経緯 |
| [adr](adr/README.md) | 設計上の重要判断（採用・提案を区別） |
| [quality](quality/README.md) | 受入ゲート、文書の検証 |
| [governance](governance/README.md) | 文書運用と設計方法論 |
| [evidence](evidence/README.md) | 分野別の固定調査・監査 |
| [history](history/README.md) | 継続して記録する開発・検証の履歴 |
| [archive](archive/) | 凍結した過去の文書 |

## 正本と履歴の読み分け

有効な仕様は[requirements](reference/requirements.md)、現時点の検証結果は[status](project/status.md)、優先順位は[roadmap](project/roadmap.md)、実行可能な下位工程は[plans](plans/index.md)で扱います。

過去の採用・撤回の理由は[decisions](decisions/log.md)、実験の数値や反例は[evidence](evidence/README.md)を参照します。日付の古い資料にある「現在」「次工程」は現行の指示ではありません。

[リポジトリ全体のREADME](../README.md) ／ [開発者向けAGENTS](../AGENTS.md)
`);
  let policy=fs.readFileSync('docs/governance/documentation-policy.md','utf8');
  const marker='## どこに何を書くか';
  assert(policy.includes(marker));
  policy=policy.replace(marker,`## 文書の配置規則

\`docs/\`直下は\`index.md\`のみです。新規文書は[全体の入口](../index.md)に定義された責務別フォルダに置きます。

- 現行の進捗・上位方針は\`project/\`、詳細工程は\`plans/\`。
- 現行の定義は\`reference/\`、具体的手順は\`how-to/\`、設計理由は\`explanation/\`、学習用演習は\`tutorials/\`。
- 利用者判断は\`decisions/\`、設計判断記録は\`adr/\`、受入基準は\`quality/\`、文書のルールは\`governance/\`。
- 固定研究は\`evidence/\`、更新する過去の記録は\`history/\`、凍結版は\`archive/\`。

一つの文書が複数の性質を持つ場合、**主な読者の目的**で一か所を正本とし、他の入口からリンクします。歴史記録の削除や仮説の現行仕様への昇格はしません。

`+marker);
  fs.writeFileSync('docs/governance/documentation-policy.md',policy);
  let report=fs.readFileSync('docs/quality/documentation-integrity-review-20261110.md','utf8');
  report+=`\n## 第二段階：docs直下の25文書を責務別に分類（2026-11-10）\n\n旧docs直下の現行文書25件をproject/reference/how-to/decisions/explanation/governance/quality/history/evidenceへ移動しました。本文の削除・要約は行わず、旧パスからの相対参照とプログラム内の正本パス、CIを更新しました。docs/index.mdのみをルートに残すテストを追加しました。変更前後の関係は本PRのGit差分で再現できます。\n`;
  fs.writeFileSync('docs/quality/documentation-integrity-review-20261110.md',report);
  console.log(JSON.stringify({moved:moves.size,updatedTextFiles:updated,rebasedMarkdownLinks:links,rootFiles:fs.readdirSync('docs').filter(n=>n.endsWith('.md')),modifiedSample:modified.slice(0,25)},null,2));
})();
