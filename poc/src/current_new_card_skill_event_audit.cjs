'use strict';
/**
 * Current-card, current-skill, historic-event scope reconciliation.
 * Raw UmaSim sources are fetched by an ephemeral workflow only. No event
 * route is synthesized from card hints, missing GT snapshots, or editorial
 * support-card pages.
 */
const fs=require('node:fs');
const roster=require('./current_umasim_roster_delta.cjs');
const live=require('./live_loader.js');
const skillBridge=require('./skill_bridge.js');
const fail=message=>{throw Error('2026-10-26新規3カード／スキル出典監査: '+message);};
const CARD_IDS=Object.freeze(['10149','30322','30323']);
const SKILL_PIN=Object.freeze({
 previousCommit:'91952973eb334ae530b8cd76541bce8a01a141cd',
 currentCommit:'910dd79f046710245e0cc88a09c5c92b1044897e',
 previousBlob:'402544b639c32da63bd4e66788f4944f5e0ff47a',
 currentBlob:'0c6ea6d72b037b24ee40860f73b0e86db47aab1d'
});
const GAP_EVIDENCE=Object.freeze({
 '10149':Object.freeze({
  pinnedGtSnapshot:'not-present',
  liveGtCardPage:'not-verified',
  gameWith:'https://gamewith.jp/uma-musume/article/show/584373',
  branchDetailStatus:'not-adjudicated'
 }),
 '30322':Object.freeze({
  pinnedGtSnapshot:'not-present',
  liveGtCardPage:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun',
  gameWith:'https://gamewith.jp/uma-musume/article/show/584253',
  branchDetailStatus:'not-adjudicated'
 }),
 '30323':Object.freeze({
  pinnedGtSnapshot:'not-present',
  liveGtCardPage:'https://gametora.com/ja/umamusume/supports/30323-azuma',
  gameWith:'https://gamewith.jp/uma-musume/article/show/584254',
  branchDetailStatus:'not-adjudicated'
 })
});
function compareRegistry(before,after){
 const changed=[],removed=[],added=[];
 for(const [id,v] of before.byId){
  const found=after.byId.get(id);
  if(!found){removed.push(id);continue;}
  if(found.name!==v.name||found.rarity!==v.rarity||found.group!==v.group)
   changed.push(id);
 }
 for(const id of after.byId.keys())if(!before.byId.has(id))added.push(id);
 return {
  previousSkillIds:before.count,currentSkillIds:after.count,
  newlyDefinedIds:added.sort(),
  changedExistingIds:changed.sort(),
  removedExistingIds:removed.sort()
 };
}
function audit({rosterText,previousSkillText,currentSkillText},{strict=false}={}){
 const texts=[rosterText,previousSkillText,currentSkillText];
 if(texts.some(s=>typeof s!=='string'))fail('全3元データ本文を指定する必要がある');
 if(strict&&(
  roster.gitBlobSha(rosterText)!==roster.POLICY.afterBlob||
  roster.gitBlobSha(previousSkillText)!==SKILL_PIN.previousBlob||
  roster.gitBlobSha(currentSkillText)!==SKILL_PIN.currentBlob))
  fail('固定UmaSimカード／スキルのGit blob識別値が不一致');
 const catalog=live.buildModel(rosterText,{mode:'pinned-ci'});
 const older=skillBridge.parseSource(previousSkillText);
 const current=skillBridge.parseSource(currentSkillText);
 const comparison=compareRegistry(older,current);
 const normalize=v=>String(v).normalize('NFKC').replace(/\s+/g,' ').trim();
 if(strict&&catalog.cards.length!==566)fail('現在の563+3カードの母数不一致');
 const records=[];
 for(const id of CARD_IDS){
  const card=catalog.cardById[id];
  if(!card||!Array.isArray(card.events)||card.events.length||
    card.sourceStatus!=='verified_hints')
   fail('新カードは通常ヒントのみ登録し、未公開イベントは空とする: '+id);
  const stages=[0,1,2,3,4].map(n=>card.hintsByStage?.[String(n)]);
  if(stages.some(x=>!Array.isArray(x)))fail('5段階の通常ヒント元が欠落: '+id);
  if(strict&&!stages.every(x=>x.length===(id==='30322'?14:0)))
   fail('新カードの5段階ヒント総数に未照合の変更: '+id);
  const originalHints=stages[4].map(name=>{
   const normalized=normalize(name);
   const candidates=current.byName.get(normalized)||[];
   const normal=candidates.filter(x=>x.rarity==='normal');
   // Exact ID matching is required. No name-based assumption that a
   // rare skill or two same-named skill IDs are interchangeable.
   const status=candidates.length===0?'missing-in-current-skill-source':
    candidates.length===1&&normal.length===1?'unique-normal-skill-id':
    'ambiguous-or-incompatible-skill-id';
   return {name:normalized,status,
    numericId:status==='unique-normal-skill-id'?normal[0].id:null,
    candidateCount:candidates.length};
  });
  const counts={
   uniquelyMatchedHints:originalHints.filter(x=>x.status==='unique-normal-skill-id').length,
   absentHints:originalHints.filter(x=>x.status==='missing-in-current-skill-source').length,
   ambiguousHints:originalHints.filter(x=>x.status==='ambiguous-or-incompatible-skill-id').length
  };
  const coverage=GAP_EVIDENCE[id];
  if(!coverage)fail('未収録イベントの出典状況が未定義: '+id);
  records.push({
   cardId:id,rarity:card.rarity,type:card.type,
   uniqueStage4Hints:originalHints.length,
   allStagesIdentical:stages.every(x=>JSON.stringify(x)===JSON.stringify(stages[0])),
   skillIdResolution:counts,
   hints:originalHints,
   eventSourceCoverage:{
    gtDerivedPinnedSnapshot:coverage.pinnedGtSnapshot,
    gameToraLiveCardPage:coverage.liveGtCardPage,
    gameWithCardPage:coverage.gameWith,
    branchingAdjudication:coverage.branchDetailStatus,
    productionEventRecords:0,
    technicalEventRoutesAdopted:0
   }
  });
 }
 // Prior skill registry mutation is a potential fresh-data conflict, never
 // a reason to replace a pinned numerical ID without independent review.
 const report={
  dataKind:'phase2-20261026-new-card-skill-event-scope-audit',
  pinnedCardSource:roster.POLICY.afterCommit,
  priorSkillSource:SKILL_PIN.previousCommit,
  currentSkillSource:SKILL_PIN.currentCommit,
  skillSourcesGitBlobs:{before:roster.gitBlobSha(previousSkillText),
   after:roster.gitBlobSha(currentSkillText)},
  currentSourceCards:catalog.cards.length,
  checkedAddedCards:CARD_IDS.length,
  skillRegistryDiff:comparison,
  cards:records,
  pendingEventCards:CARD_IDS.length,
  eventRoutesAdopted:0,publicApprovedEvents:0,
  fixedGt2512LegacySkillEventsNotPromoted:true,
  sourceRawDataBundled:false,
  gamePopulationIndependentlyVerified:false
 };
 if(strict&&records.some(x=>x.skillIdResolution.absentHints+
    x.skillIdResolution.ambiguousHints>0))
   fail('新カードの通常ヒントで未照合の数値スキルIDが残る: '+
    JSON.stringify(records.map(x=>({id:x.cardId,counts:x.skillIdResolution}))));
 return report;
}
if(require.main===module){
 if(process.argv.length!==5){
  process.stderr.write('usage: node current_new_card_skill_event_audit.cjs <cards> <old-skills> <new-skills>\n');
  process.exitCode=2;
 }else try{
  const result=audit({
   rosterText:fs.readFileSync(process.argv[2],'utf8'),
   previousSkillText:fs.readFileSync(process.argv[3],'utf8'),
   currentSkillText:fs.readFileSync(process.argv[4],'utf8')
  },{strict:true});
  process.stdout.write('PHASE2_20261026_NEW_CARD_SKILL_EVENT_AUDIT='+JSON.stringify(result)+'\n');
 }catch(e){process.stderr.write(String(e.stack||e)+'\n');process.exitCode=1;}
}
module.exports={audit,SKILL_PIN,CARD_IDS,GAP_EVIDENCE,compareRegistry};
