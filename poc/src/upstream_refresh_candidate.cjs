'use strict';
/*
 * Review-only candidate manifest for a pinned GameTora/UmaSim update.
 * This is NOT a replacement pin, does not ingest event JSON, and is
 * never referenced by the publicly deployed browser runtime.
 */
const crypto=require('node:crypto');
const {PINS}=require('./upstream_refresh_watch.cjs');
const HEX40=/^[a-f0-9]{40}$/;
const HEX64=/^[a-f0-9]{64}$/;
const CARD_ID=/^\d{5}$/;
const FILES=['data/support_card.txt','data/skill_data.txt'];
const BRANCH='automation/upstream-refresh-candidate';
const FILE_PATH='poc/review/upstream-refresh-candidate.v1.json';
const PR_TITLE='Draft: review next pinned GameTora / UmaSim source snapshot';
const fail=s=>{throw Error('出典候補Draft PR検証: '+s);};
const unique=xs=>Array.isArray(xs)&&xs.every((x,i)=>xs.indexOf(x)===i);
function verifyReport(r){
 if(!r||r.schemaVersion!==1||r.kind!=='pinned-upstream-refresh-watch'||
    r.requiresReview!==true||r.automaticSnapshotPromotion!==false||
    r.automaticEventApproval!==false||r.sourceContentsIncluded!==false||
    !HEX64.test(String(r.reviewFingerprint||'')))fail('検証済みドリフト出力に不備');
 if(r.sourcePins?.gameTora!==PINS.gameTora.revision||
    r.sourcePins?.umaSim!==PINS.umaSim.revision)
   fail('更新中に固定出典Pinが変わった');
 for(const [key,current] of [
  ['gameTora',r.observedHeadCommits?.gameTora],
  ['umaSim',r.observedHeadCommits?.umaSim]
 ])if(!HEX40.test(String(current||'')))fail(key+'の上流Commit SHA不正');
 const e=r.eventData;
 if(!e||!Number.isSafeInteger(e.pinnedCardFiles)||e.pinnedCardFiles!==PINS.gameTora.expectedBaselineCards||
    !Number.isSafeInteger(e.currentCardFiles)||e.currentCardFiles<1)
   fail('GTカード元JSONの出典母集団が不正');
 for(const field of ['addedCardIds','modifiedCardIds','removedCardIds',
  'knownLatestUmaSimCardIdsWithGtJson','knownLatestUmaSimCardIdsWithoutGtJson']){
  const arr=e[field];if(!unique(arr)||arr.some(x=>!CARD_ID.test(x))||
     JSON.stringify(arr)!==JSON.stringify([...arr].sort()))
   fail('GTカード元JSON変更IDの不正: '+field);
 }
 if(!unique(r.affectedUmaSimFiles)||
   r.affectedUmaSimFiles.some(x=>!FILES.includes(x)))fail('UmaSim変更ファイルの種類が不正');
 if(e.addedCardIds.length+e.modifiedCardIds.length+e.removedCardIds.length+
    r.affectedUmaSimFiles.length===0)fail('対象Git blob変更が存在しない');
 for(const file of FILES){
  const v=r.umaSimData?.[file];
  if(!v||!HEX40.test(String(v.pinnedBlobSha||''))||
     !HEX40.test(String(v.currentBlobSha||''))||
     v.changed!==(v.pinnedBlobSha!==v.currentBlobSha)||
     v.changed!==r.affectedUmaSimFiles.includes(file))
   fail('UmaSimのGit blob証拠が不整合: '+file);
 }
 if(r.umaSimData['data/support_card.txt'].pinnedBlobSha!==PINS.umaSim.cardBlob||
   r.umaSimData['data/skill_data.txt'].pinnedBlobSha!==PINS.umaSim.skillBlob)
  fail('固定元Git blobの不一致');
 if(e.knownLatestUmaSimCardCoverage?.eventTopologyVerified!==false||
    e.knownLatestUmaSimCardCoverage?.publicationApproved!==false)
  fail('GT JSONの存在をイベント採用・公開許可と混同');
 return r;
}
function buildCandidate(r,{treeShas,sourceRunUrl=null}={}){
 verifyReport(r);
 for(const src of ['gameToraPinned','gameToraHead','umaSimPinned','umaSimHead'])
  if(!HEX40.test(String(treeShas?.[src]||'')))
   fail('固定／最新元のGit tree SHAが欠落: '+src);
 if(sourceRunUrl!==null&&!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[1-9]\d*$/.test(sourceRunUrl))
  fail('実行根拠へのURLがGitHub Actionsではない');
 const e=r.eventData;
 return {
  schemaVersion:1,
  kind:'source-refresh-candidate-review-only',
  reviewState:'awaiting-human-preflight-and-source-adjudication',
  reviewFingerprint:r.reviewFingerprint,
  observedRun:sourceRunUrl,
  currentPinned:{
   gameToraCommit:r.sourcePins.gameTora,
   umaSimCommit:r.sourcePins.umaSim,
   gameToraTree:treeShas.gameToraPinned,
   umaSimTree:treeShas.umaSimPinned
  },
  proposedSnapshot:{
   gameToraCommit:r.observedHeadCommits.gameTora,
   umaSimCommit:r.observedHeadCommits.umaSim,
   gameToraTree:treeShas.gameToraHead,
   umaSimTree:treeShas.umaSimHead,
   umaSimCardBlob:r.umaSimData['data/support_card.txt'].currentBlobSha,
   umaSimSkillBlob:r.umaSimData['data/skill_data.txt'].currentBlobSha
  },
  eventSourceDiff:{
   previousJsonCardFiles:e.pinnedCardFiles,
   candidateJsonCardFiles:e.currentCardFiles,
   addedCardIds:[...e.addedCardIds],
   modifiedCardIds:[...e.modifiedCardIds],
   removedCardIds:[...e.removedCardIds],
   latestKnownThreeJsonPresent:[...e.knownLatestUmaSimCardIdsWithGtJson],
   latestKnownThreeJsonMissing:[...e.knownLatestUmaSimCardIdsWithoutGtJson]
  },
  umaSimChangedSourceFiles:[...r.affectedUmaSimFiles],
  preflight:{
   upstreamGitTreeShape:'checked-in-source-watch',
   newEventRoutes:'not-adjudicated',
   eventInternalBranches:'not-adjudicated',
   skillIds:'not-adjudicated',
   wholeEventInventory:'not-run-for-candidate',
   chromium:'not-run-for-candidate',
   physicalDevices:'not-run',
   thirdPartyReuseRights:'not-approved',
   publicationRelease:'not-approved'
  },
  safeBoundaries:{
   sourceJsonContentsStored:false,
   originalEventChoiceTextStored:false,
   sourceMasterFilesBundled:false,
   runtimePinChangesApplied:false,
   deploymentOrEventPublicationApproved:false,
   automaticallyMergeable:false
  }
 };
}
function manifestText(manifest){
 if(manifest?.kind!=='source-refresh-candidate-review-only'||
    !HEX64.test(String(manifest.reviewFingerprint||'')))
  fail('候補マニフェストの形式が不正');
 return JSON.stringify(manifest,null,2)+'\n';
}
function draftBody(manifest,issueNumber){
 if(manifest?.kind!=='source-refresh-candidate-review-only'||
    !Number.isSafeInteger(issueNumber)||issueNumber<1)fail('Draftの参照Issueが不正');
 const d=manifest.eventSourceDiff,p=manifest.proposedSnapshot;
 const ids=xs=>xs.length?xs.map(x=>'\`'+x+'\`').join(', '):'なし';
 return [
  '## REVIEW ONLY: 未採用の固定元候補',
  '',
  'このDraft PRには **Git tree／Git blob／カード数値IDのみの候補マニフェスト** を追加します。',
  'GameTora／UmaSimの実行時固定ピン、イベント本体、スキル取得ルート、公開カタログは**一切変更しません**。',
  '検知Issue: #'+issueNumber+'。本Draftは自動マージ・自動Ready化しません。',
  '',
  '- 候補GT commit: \`'+p.gameToraCommit+'\`',
  '- 候補UmaSim commit: \`'+p.umaSimCommit+'\`',
  '- GTイベントJSON対象カード: \`'+d.previousJsonCardFiles+' → '+d.candidateJsonCardFiles+'\`',
  '- GT追加ID: '+ids(d.addedCardIds),
  '- GT変更ID: '+ids(d.modifiedCardIds),
  '- GT削除ID: '+ids(d.removedCardIds),
  '- UmaSim元ファイル変更: '+ids(manifest.umaSimChangedSourceFiles),
  '- 既知新3カードのGT JSON未収録: '+ids(d.latestKnownThreeJsonMissing),
  '- 差分指紋: \`'+manifest.reviewFingerprint+'\`',
  '',
  '### 実際に固定版を更新する前の検証',
  '',
  '- [ ] 新GT候補の全イベントを一時環境で読込み、元イベント数・結果分岐・後続打ち切りを再計算する',
  '- [ ] UmaSim候補の全カード×性能解放5段階／スキル数値ID差分を独立照合する',
  '- [ ] GT元で欠損・疑義のある事実はカード別GameTora公式確認後、GameWithで裁定する',
  '- [ ] 従来の全件CI／スキル経路／公開ゲートとブラウザのA/B/Cを別々に通す',
  '- [ ] その後、別の採用PRで固定ピンを変更する（本Draftのマージを採用の代用にしない）',
  '- [ ] 第三者データ再利用条件とイベントの公開承認を独立判定する',
  '',
  '> 自動化の範囲は候補作成までです。カード数・JSON存在だけではイベントの正確性は検証されていません。',
  '',
  '根拠・手順: [固定版の継続更新運用](https://github.com/Nimrodx0/Umasupport/blob/main/docs/upstream-refresh-operations.md)',
  '<!-- umasupport-candidate-draft fingerprint:'+manifest.reviewFingerprint+' -->'
 ].join('\n');
}
function contentDigest(text){
 return crypto.createHash('sha256').update(text,'utf8').digest('hex');
}
module.exports={verifyReport,buildCandidate,manifestText,draftBody,contentDigest,
 BRANCH,FILE_PATH,PR_TITLE};
