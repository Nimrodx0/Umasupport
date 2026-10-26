'use strict';
/*
 * Non-publishing upstream snapshot drift detector.
 * Consumes Git tree METADATA only (GitHub's /git/trees endpoint):
 * no source event choices, narratives, images or original game masters
 * are ingested into public artifacts, issues, or repository files.
 */
const crypto=require('node:crypto');
const eventPriority=require('../config/event-source-priority.v1.json');
const roster=require('./current_umasim_roster_delta.cjs').POLICY;
const fail=message=>{throw Error('固定イベント出典の継続更新監査: '+message);};
const HEX=/^[a-f0-9]{40}$/;
const EVENT_PATH=/^server\/data\/events\/gametora\/support_(\d{5})\.json$/;
const UMA_FILES=Object.freeze(['data/support_card.txt','data/skill_data.txt']);
const PINS=Object.freeze({
 gameTora:{
  owner:'systemless10',repo:'UmamusumePS',
  revision:eventPriority.baselineRevision,expectedBaselineCards:559
 },
 umaSim:{
  owner:'mee1080',repo:'umasim',revision:roster.afterCommit,
  cardBlob:roster.afterBlob,skillBlob:'0c6ea6d72b037b24ee40860f73b0e86db47aab1d'
 }
});
function pathTree(tree,label){
 if(!tree||tree.truncated!==false||!Array.isArray(tree.tree)||
    !HEX.test(String(tree.sha||'')))
  fail(label+': Git treeレスポンスが不完全／truncatedです');
 const map=new Map();
 for(const entry of tree.tree){
  if(!entry||typeof entry.path!=='string'||
     !['tree','blob','commit'].includes(entry.type)||!HEX.test(String(entry.sha||'')))
   fail(label+': 不正なGitエントリー');
  if(map.has(entry.path))fail(label+': 重複したGitパス '+entry.path);
  map.set(entry.path,{sha:entry.sha,type:entry.type});
 }
 return map;
}
function gtEvents(map,label){
 const cards=new Map();
 for(const [path,entry] of map){
  const match=EVENT_PATH.exec(path);
  if(!match)continue;
  if(entry.type!=='blob')fail(label+': イベントJSONがGit blobではない');
  const id=match[1];
  if(cards.has(id))fail(label+': 重複する出典カードID '+id);
  cards.set(id,entry.sha);
 }
 if(!cards.size)fail(label+': GT対象イベントJSONがない');
 return cards;
}
function gitDiff(before,after){
 const added=[],removed=[],modified=[];
 for(const [id,sha] of after){
  if(!before.has(id))added.push(id);
  else if(before.get(id)!==sha)modified.push(id);
 }
 for(const id of before.keys())if(!after.has(id))removed.push(id);
 for(const xs of [added,removed,modified])xs.sort();
 return {added,removed,modified};
}
function inspect({gameToraPinnedTree,gameToraLatestTree,
  umaSimPinnedTree,umaSimLatestTree,
  gameToraLatestCommit,umaSimLatestCommit},{strict=true}={}){
 if(!HEX.test(String(gameToraLatestCommit||''))||
    !HEX.test(String(umaSimLatestCommit||'')))
  fail('HEADのコミットSHAが不正');
 const gtBase=pathTree(gameToraPinnedTree,'GT固定'),
  gtHead=pathTree(gameToraLatestTree,'GT最新'),
  umaBase=pathTree(umaSimPinnedTree,'UmaSim固定'),
  umaHead=pathTree(umaSimLatestTree,'UmaSim最新');
 const baseEvents=gtEvents(gtBase,'GT固定'),headEvents=gtEvents(gtHead,'GT最新');
 if(strict&&baseEvents.size!==PINS.gameTora.expectedBaselineCards)
  fail('GT固定版の母数が想定と異なる: '+baseEvents.size);
 for(const [path,expect] of [
  ['data/support_card.txt',PINS.umaSim.cardBlob],
  ['data/skill_data.txt',PINS.umaSim.skillBlob]
 ]){
  if(umaBase.get(path)?.sha!==expect||umaBase.get(path)?.type!=='blob')
   fail('UmaSim固定ソースの出典Git blob SHAが一致しない: '+path);
 }
 const {added,removed,modified}=gitDiff(baseEvents,headEvents);
 const umaChanges={};
 for(const path of UMA_FILES){
  const current=umaHead.get(path);
  if(!current||current.type!=='blob')
   fail('最新UmaSimのソースファイルが存在しない: '+path);
  const base=umaBase.get(path);
  umaChanges[path]={
   changed:base.sha!==current.sha,
   pinnedBlobSha:base.sha,currentBlobSha:current.sha
  };
 }
 const changedSourceFiles=UMA_FILES.filter(k=>umaChanges[k].changed);
 const needsReview=!!(added.length||removed.length||modified.length||changedSourceFiles.length);
 const evidence={added,removed,modified,uma:UMA_FILES.map(p=>({
  path:p,blob:umaChanges[p].currentBlobSha
 }))};
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
 return {
  schemaVersion:1,kind:'pinned-upstream-refresh-watch',
  sourcePins:{gameTora:PINS.gameTora.revision,umaSim:PINS.umaSim.revision},
  observedHeadCommits:{gameTora:gameToraLatestCommit,umaSim:umaSimLatestCommit},
  commitMoved:{
   gameTora:gameToraLatestCommit!==PINS.gameTora.revision,
   umaSim:umaSimLatestCommit!==PINS.umaSim.revision
  },
  eventData:{
   pinnedCardFiles:baseEvents.size,currentCardFiles:headEvents.size,
   addedCardIds:added,removedCardIds:removed,modifiedCardIds:modified,
   // The new October 26 cards already confirmed in UmaSim are NOT present
   // in the currently pinned historical GT snapshot.
   knownLatestUmaSimCardIdsWithoutGtJson:roster.expectedNewIds.filter(id=>!headEvents.has(id))
  },
  umaSimData:umaChanges,
  affectedUmaSimFiles:changedSourceFiles,
  requiresReview:needsReview,
  reviewFingerprint:fingerprint,
  nextAction:needsReview?'open-a-single-human-reviewed-refresh-issue':'no-source-change',
  automaticSnapshotPromotion:false,automaticEventApproval:false,
  sourceContentsIncluded:false,gameCompletenessAsserted:false
 };
}
function issueBody(result){
 if(result?.kind!=='pinned-upstream-refresh-watch'||!result.requiresReview)
  fail('ドリフトがないのに更新レビューIssueを作成しようとした');
 const e=result.eventData,flags=result.affectedUmaSimFiles;
 const json=xs=>xs.length?xs.map(x=>'\`'+x+'\`').join(', '):'なし';
 return [
 '## 固定出典との差分が見つかりました',
 '',
 '自動監視が検出した**GitツリーとGit blob IDのみのメタデータ**です。イベント本文・選択肢・元JSON・画像は取得／掲載していません。',
 '',
 '- GT固定: \`'+result.sourcePins.gameTora+'\` → HEAD \`'+result.observedHeadCommits.gameTora+'\`',
 '- UmaSim固定: \`'+result.sourcePins.umaSim+'\` → HEAD \`'+result.observedHeadCommits.umaSim+'\`',
 '- GTの追加カードID: '+json(e.addedCardIds),
 '- GTの変更カードID: '+json(e.modifiedCardIds),
 '- GTの削除カードID: '+json(e.removedCardIds),
 '- UmaSimの更新対象: '+json(flags),
 '- 今回の識別指紋: \`'+result.reviewFingerprint+'\`',
 '',
 '### 取り込みのための確認ゲート（自動で書き換えない）',
 '',
 '- [ ] 新旧の出典コミット・Git blob・イベント母集団差分を独立照合する',
 '- [ ] 追加・変更IDについてイベント分岐、終了規則、数値スキルIDを判定し、未判定を区別する',
 '- [ ] 既存の全件GT監査、スキル経路不変、公開ゲート、Chromium回帰を別々に実行する',
 '- [ ] 審査済み変更だけを新しい固定ピンへ更新する専用PRを作成する',
 '- [ ] 公開承認と配布条件を別のゲートで判定する。未審査イベントを配信しない',
 '',
 '**未完成の自動検証があっても、元ゲームのイベント存在／取得条件や公開承認を断定しないこと。**',
 '',
 '監視設計: [継続更新の手順](https://github.com/Nimrodx0/Umasupport/blob/main/docs/upstream-refresh-operations.md) 。',
 '',
 '<!-- umasupport-source-refresh-issue fingerprint:'+result.reviewFingerprint+' -->'
 ].join('\n');
}
module.exports={inspect,issueBody,PINS};
