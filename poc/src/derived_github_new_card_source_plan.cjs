'use strict';
/*
 * Read-only plan for new-card EVENT intake from the structured, derived
 * GameTora JSON maintained on third-party GitHub.
 *
 * Input is a COMPLETE Git tree snapshot's metadata, never source event JSON.
 * A present source blob is NOT a validated event or a release approval.
 * Existing card objects and user settings are never modified.
 */
const SOURCE_REPO='systemless10/UmamusumePS';
const PATH=/^server\/data\/events\/gametora\/support_([1-9]\d{4})\.json$/;
const SHA=/^[a-f0-9]{40}$/;
const id=x=>typeof x==='string'&&/^[1-9]\d{4}$/.test(x);
const fail=s=>{throw Error('GitHub派生イベント新カード計画: '+s);};
const ids=(x,label)=>{
 if(!Array.isArray(x)||x.some(v=>!id(v))||new Set(x).size!==x.length)
  fail(label+'のIDが不正／重複');
 return x;
};
function planDerivedNewCardIntake({
 discovery,existingCatalog,pendingCardIds=[],
 sourceTree,sourceCommit
}={}){
 if(discovery?.dataKind!=='new-umamusume-support-card-ids'||
    discovery.schemaVersion!==1||discovery.publicationApproved!==false||
    !existingCatalog||existingCatalog.schemaVersion!==1||
    !Array.isArray(existingCatalog.cards))
  fail('新規名簿・既存イベントカタログが不正');
 const newIds=ids(discovery.addedCardIds,'追加カード'),
       oldIds=ids(discovery.existingCardIds,'旧名簿'),
       pending=ids(pendingCardIds,'持越保留'),
       imported=ids(existingCatalog.cards.map(x=>x?.cardId),'収録済み');
 const roster=new Set([...oldIds,...newIds]);
 if(!roster.size||newIds.some(x=>oldIds.includes(x))||
    pending.some(x=>!roster.has(x))||
    imported.some(x=>!roster.has(x)))
  fail('現行UmaSim全名簿と保留／収録済みIDが不一致');
 // GitHub's recursive tree must be complete or a missing file cannot be
 // distinguished from a truncated response.
 if(!sourceTree||sourceTree.truncated!==false||
    !SHA.test(sourceTree.sha)||!Array.isArray(sourceTree.tree)||
    !SHA.test(sourceCommit))
  fail('GitHub出典の完全なtreeとcommitが必要');
 const seenPaths=new Set(),blobs=new Map();
 for(const row of sourceTree.tree){
  if(!row||typeof row.path!=='string'||seenPaths.has(row.path)||
     !['blob','tree','commit'].includes(row.type)||
     !SHA.test(row.sha))fail('Gitツリーの重複／不正エントリ');
  seenPaths.add(row.path);
  const m=PATH.exec(row.path);
  if(!m)continue;
  if(row.type!=='blob'||blobs.has(m[1]))
   fail('対象サポカのGit blobが不正／重複');
  blobs.set(m[1],{sha:row.sha,path:row.path});
 }
 if(!blobs.size)fail('GameTora派生のサポカJSONが見つからない');
 const importedSet=new Set(imported);
 const targets=[...new Set([...newIds,...pending])].sort();
 const results=targets.map(cardId=>{
  if(importedSet.has(cardId))return {
   cardId,status:'already-in-catalog',sourceBlobSha:null};
  const source=blobs.get(cardId);
  if(!source)return {cardId,status:'await-derived-github-json',
    sourceBlobSha:null};
  return {cardId,status:'source-blob-present-needs-validation',
   sourceBlobSha:source.sha,
   // Version-pinned source location for a later, separately gated reader.
   sourcePath:source.path};
 });
 const candidateIds=results.filter(x=>
  x.status==='source-blob-present-needs-validation').map(x=>x.cardId);
 const waitingIds=results.filter(x=>
  x.status==='await-derived-github-json').map(x=>x.cardId);
 const carryForwardPendingIds=results.filter(x=>
  x.status!=='already-in-catalog').map(x=>x.cardId);
 return {dataKind:'derived-github-new-card-source-plan',version:1,
  primarySourceRepository:SOURCE_REPO,
  primarySourceCommit:sourceCommit,sourceTreeSha:sourceTree.sha,
  detectedNewCardIds:[...newIds],targetIds:targets,candidateIds,
  waitingIds,carryForwardPendingIds,results,
  allSourceDocumentsFetched:false,allSourceEventsValidated:false,
  allRequiredSkillIdsChecked:false,chainDependenciesVerified:false,
  existingDatabaseUnchanged:true,autoPublish:false,
  publicationApproved:false};
}
module.exports={planDerivedNewCardIntake,SOURCE_REPO};
