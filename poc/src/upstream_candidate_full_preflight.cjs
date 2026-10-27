'use strict';
/*
 * Read-only full-source candidate preflight.
 *
 * On the ephemeral CI runner ONLY: load all candidate and baseline support
 * event JSON, the complete old/new UmaSim card TSVs and skill JSON registries.
 * Never commit or upload the original sources or normalized route details.
 * Only derived numeric counts, changed card IDs and quarantine reasons leave
 * this process. A passing source shape is NOT a reviewed event or skill route.
 */
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {verifyManifest}=require('./upstream_refresh_candidate.cjs');
const {transformDocument}=require('./gametora_whole_event_normalize.cjs');
const {inventory:branchInventory}=require('./gametora_branch_semantics_inventory.cjs');
const {parseSupportCards}=require('./live_loader.js');
const {parseSource:parseSkills}=require('./skill_bridge.js');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {PINS}=require('./upstream_refresh_watch.cjs');
const fail=s=>{throw Error('候補出典の全件preflight: '+s);};
const sorted=xs=>[...xs].sort();
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const eventName=/^support_(\d{5})\.json$/;
const hex=/^[a-f0-9]{40}$/;
function treeCommit(folder,commit,tree,label){
 if(!hex.test(String(commit))||!hex.test(String(tree)))fail(label+': Git SHAが不正');
 const actualCommit=execFileSync('git',['-C',folder,'rev-parse','HEAD'],
  {encoding:'utf8'}).trim();
 const actualTree=execFileSync('git',['-C',folder,'rev-parse','HEAD^{tree}'],
  {encoding:'utf8'}).trim();
 if(actualCommit!==commit||actualTree!==tree)
  fail(label+': Git HEAD/treeが候補マニフェストと違う');
}
function loadEvents(dir){
 if(!fs.statSync(dir).isDirectory())fail('GT元イベントディレクトリなし');
 const docs=new Map(),blobs=new Map();
 for(const name of fs.readdirSync(dir).sort()){
  const id=eventName.exec(name)?.[1];
  if(!id)continue;
  const bytes=fs.readFileSync(path.join(dir,name));
  const blob=gitBlobSha(bytes);
  let d;
  try{d=JSON.parse(bytes.toString('utf8'));}
  catch(_){fail('GT元JSONの形式が不正: '+id);}
  if(d?.kind!=='support'||String(d.id)!==id||docs.has(id))
   fail('GT元ファイルと実イベントIDが一致しない: '+id);
  docs.set(id,d);blobs.set(id,blob);
 }
 if(docs.size<1)fail('GT元イベント0件は採用できません');
 return {docs,blobs};
}
function compareGt(base,next){
 const added=[],removed=[],modified=[],unchanged=[];
 for(const id of next.blobs.keys()){
  if(!base.blobs.has(id))added.push(id);
  else if(base.blobs.get(id)!==next.blobs.get(id))modified.push(id);
  else unchanged.push(id);
 }
 for(const id of base.blobs.keys())if(!next.blobs.has(id))removed.push(id);
 return {added:sorted(added),removed:sorted(removed),modified:sorted(modified),
  unchanged:sorted(unchanged)};
}
function inspectSource(source){
 const summaries=[],errors=[];
 let events=0,choices=0,routes=0,hints=0,terminals=0,grants=0,unresolved=0,review=0,
  cardsNormalized=0;
 const safeRows=[];
 for(const [id,doc] of source.docs){
  try{
   const row=transformDocument(doc);
   if(row.cardId!==id)fail('GT正規化のカードID差分: '+id);
   cardsNormalized++;
   events+=row.sourceEventCount;
   choices+=row.sourceChoiceCount;
   routes+=row.sourceExpandedRoutes;
   hints+=row.numericParsedHintMentions;
   terminals+=row.explicitChainEndRoutes;
   grants+=row.directSkillGrantMentions;
   unresolved+=row.unresolvedHintMentions;
   review+=row.reviewQueue.length;
   safeRows.push({
    cardId:id,sourceMissing:false,
    sourceOrdinal:0, // local bookkeeping only; not an event ID
    events:row.events
   });
  }catch(e){
   errors.push({cardId:id,reason:'INVALID_SOURCE_STRUCTURE'});
  }
 }
 const valid=errors.length===0;
 let branch=null;
 if(valid){
  const fake={
   dataKind:'gametora-whole-event-numeric-candidate',
   releaseApproved:false,noEventCanPublishFromThisCandidate:true,
   originalSourceTextIncluded:false,
   cards:safeRows.map(({sourceOrdinal,...row})=>row),
   totals:{sourceEvents:events,sourceChoices:choices,expandedRoutes:routes,
    rosterCards:safeRows.length,
    explicitTerminalRoutes:terminals,directSkillGrantMentions:grants}
  };
  // Numeric route inventory independently validates the normalizer's event
  // choice and conditional-route decomposition. If it rejects the shape,
  // that is a blocking preflight finding, not a silently dropped card.
  try{
   const result=branchInventory(fake);
   branch={choices:result.totals.sourceChoices,
    routes:result.totals.sourceRoutes,
    chainedTerminals:result.totals.explicitChainEndRoutes,
    unresolvedAlternatives:result.totals.unflaggedMultiRouteChoices,
    guardedRoutes:result.totals.guardedRoutes};
  }catch(e){
   errors.push({cardId:null,reason:'BRANCH_INVENTORY_REJECTED'});
  }
 }
 return {
  cards:source.docs.size,cardsNormalized,events,choices,routes,
  numericHintMentions:hints,terminalMentions:terminals,
  unresolvedHintMentions:unresolved,reviewQueueEntries:review,
  branchInventory:branch,
  rejectedCards:errors.map(x=>x.cardId).filter(Boolean).sort(),
  quarantineReasons:[...new Set(errors.map(x=>x.reason))].sort(),
  shapeValidated:errors.length===0
 };
}
/**
 * Audit every changed GT file's numeric event topology, never prose.
 * Files with the same blob remain independently covered by whole-source
 * normalization; they do not get a fabricated "change" row.
 */
function topologyDiff(base,next,blobDiff){
 const ids=[...new Set([
  ...blobDiff.added,...blobDiff.modified,...blobDiff.removed
 ])].sort();
 const rows=[];
 const topology=(doc,id)=>{
  if(!doc)return null;
  const {docs,blobs}= {docs:new Map([[id,doc]])};
  const shape=inspectSource({docs});
  if(!shape.shapeValidated)fail('変更サポカのイベント構造が不正: '+id);
  return {
   events:shape.events,choices:shape.choices,routes:shape.routes,
   numericHintMentions:shape.numericHintMentions,
   terminalMentions:shape.terminalMentions,
   unresolvedHintMentions:shape.unresolvedHintMentions,
   reviewQueueEntries:shape.reviewQueueEntries
  };
 };
 for(const id of ids){
  const before=topology(base.docs.get(id),id);
  const after=topology(next.docs.get(id),id);
  const change=blobDiff.added.includes(id)?'added':
   blobDiff.removed.includes(id)?'removed':'modified';
  rows.push({cardId:id,change,before,after,
   numericTopologyChanged:JSON.stringify(before)!==JSON.stringify(after)});
 }
 return {affectedCards:rows.length,rows,
  added:rows.filter(x=>x.change==='added').length,
  modified:rows.filter(x=>x.change==='modified').length,
  removed:rows.filter(x=>x.change==='removed').length,
  sameCountButDifferentSource:rows.filter(x=>x.change==='modified'&&!x.numericTopologyChanged)
   .map(x=>x.cardId)};
}
function rosterDiff(before,after){
 const old=parseSupportCards(before),now=parseSupportCards(after);
 const added=[],removed=[],changed=[];
 for(const [id,card] of old.cards){
  const fresh=now.cards.get(id);
  if(!fresh)removed.push(id);
  else if(!equal(card,fresh))changed.push(id);
 }
 for(const id of now.cards.keys())if(!old.cards.has(id))added.push(id);
 return {
  baselineCards:old.cards.size,candidateCards:now.cards.size,
  baselineStageRows:old.lines,candidateStageRows:now.lines,
  added:sorted(added),removed:sorted(removed),modified:sorted(changed),
  fullFiveStageValidation:true
 };
}
function skillDiff(before,after){
 const old=parseSkills(before),now=parseSkills(after);
 const added=[],removed=[],changed=[];
 for(const [id,record] of old.byId){
  const fresh=now.byId.get(id);
  if(!fresh)removed.push(id);
  else if(!equal(record,fresh))changed.push(id);
 }
 for(const id of now.byId.keys())if(!old.byId.has(id))added.push(id);
 return {
  baselineNumericIds:old.count,candidateNumericIds:now.count,
  added:sorted(added),removed:sorted(removed),modified:sorted(changed),
  duplicateNumericIdsRejected:true
 };
}
function hintRegistryCoverage(rosterText,skillText){
 const cards=parseSupportCards(rosterText).cards;
 const skills=parseSkills(skillText);
 const summary={hintStageOccurrences:0,uniqueNormalSkillIds:0,
  missingRegistryNames:0,ambiguousOrNonNormalIds:0,
  cardsWithUnresolvedHints:[]};
 const unresolved=new Set();
 for(const card of cards.values()){
  for(const hints of Object.values(card.stages)){
   for(const sourceName of hints){
    summary.hintStageOccurrences++;
    const name=String(sourceName).normalize('NFKC').replace(/\s+/g,' ').trim();
    const candidates=skills.byName.get(name)||[];
    if(candidates.length===1&&candidates[0].rarity==='normal')
     summary.uniqueNormalSkillIds++;
    else{
     unresolved.add(card.id);
     if(candidates.length===0)summary.missingRegistryNames++;
     else summary.ambiguousOrNonNormalIds++;
    }
   }
  }
 }
 summary.cardsWithUnresolvedHints=sorted(unresolved);
 if(summary.uniqueNormalSkillIds+summary.missingRegistryNames+
    summary.ambiguousOrNonNormalIds!==summary.hintStageOccurrences)
   fail('通常ヒントの全出現回数を照合できない');
 return summary;
}
function audit({manifest,baselineGt,candidateGt,baselineRoster,candidateRoster,
 baselineSkills,candidateSkills,baselineGtRepo,candidateGtRepo}){
 verifyManifest(manifest);
 const pin=manifest.currentPinned,newPin=manifest.proposedSnapshot;
 treeCommit(baselineGtRepo,pin.gameToraCommit,pin.gameToraTree,'固定GT');
 treeCommit(candidateGtRepo,newPin.gameToraCommit,newPin.gameToraTree,'候補GT');
 for(const [label,text,expected] of [
  ['固定サポカ',baselineRoster,PINS.umaSim.cardBlob],
  ['候補サポカ',candidateRoster,newPin.umaSimCardBlob],
  ['固定スキル',baselineSkills,PINS.umaSim.skillBlob],
  ['候補スキル',candidateSkills,newPin.umaSimSkillBlob]
 ])if(gitBlobSha(text)!==expected)fail(label+': Git blob内容不一致');
 const base=loadEvents(baselineGt),head=loadEvents(candidateGt);
 const gtDiff=compareGt(base,head);
 const wanted=manifest.eventSourceDiff;
 if(base.docs.size!==wanted.previousJsonCardFiles||
    head.docs.size!==wanted.candidateJsonCardFiles||
    !equal(gtDiff.added,wanted.addedCardIds)||
    !equal(gtDiff.removed,wanted.removedCardIds)||
    !equal(gtDiff.modified,wanted.modifiedCardIds))
  fail('GT全件blob差分と候補レビューmanifestが異なる');
 const changedTopologies=topologyDiff(base,head,gtDiff);
 const roster=rosterDiff(baselineRoster,candidateRoster);
 const skills=skillDiff(baselineSkills,candidateSkills);
 const baselineHintCoverage=hintRegistryCoverage(baselineRoster,baselineSkills);
 const candidateHintCoverage=hintRegistryCoverage(candidateRoster,candidateSkills);
 const candidateRosterIds=new Set(parseSupportCards(candidateRoster).cards.keys());
 const gtIdsMissingFromRoster=sorted([...head.docs.keys()].filter(id=>!candidateRosterIds.has(id)));
 const baseInventory=inspectSource(base);
 const headInventory=inspectSource(head);
 if(!baseInventory.shapeValidated||baseInventory.cards!==PINS.gameTora.expectedBaselineCards||
    baseInventory.events!==2488||baseInventory.choices!==4129||
    baseInventory.routes!==4376)
  fail('既知固定GTの全件出典・分岐形状が再現できない');
 const blockers=[
  ...(!headInventory.shapeValidated?['CANDIDATE_GT_STRUCTURE_OR_BRANCH']:[]),
  ...(gtDiff.removed.length?['GT_SOURCE_CARDS_REMOVED_NEED_REVIEW']:[]),
  ...(roster.removed.length?['UMASIM_CARDS_REMOVED_NEED_REVIEW']:[]),
  ...(skills.removed.length?['NUMERIC_SKILL_IDS_REMOVED_NEED_REVIEW']:[]),
  ...(skills.modified.length?['NUMERIC_SKILL_IDS_CHANGED_NEED_REVIEW']:[]),
  ...(roster.modified.length?['EXISTING_CARD_STAGES_CHANGED_NEED_REVIEW']:[]),
  ...(gtIdsMissingFromRoster.length?['GT_SOURCE_CARD_ID_NOT_IN_UMASIM']:[]),
  ...(candidateHintCoverage.missingRegistryNames>baselineHintCoverage.missingRegistryNames||
     candidateHintCoverage.ambiguousOrNonNormalIds>baselineHintCoverage.ambiguousOrNonNormalIds?
     ['CANDIDATE_HINT_REGISTRY_CROSSWALK_DEGRADED']:[])
 ];
 return {
  schemaVersion:1,kind:'source-refresh-full-data-preflight-private-metadata',
  candidateFingerprint:manifest.reviewFingerprint,
  candidateCommits:{gameTora:newPin.gameToraCommit,umaSim:newPin.umaSimCommit},
  gameTora:{baseline:baseInventory,candidate:headInventory,
   changedCardTopologies:changedTopologies,diff:{
   added:gtDiff.added,modified:gtDiff.modified,removed:gtDiff.removed,
   unchangedCount:gtDiff.unchanged.length
  }},
  umaSim:{cards:roster,skills,
   baselineHintCoverage,candidateHintCoverage,
   gtSourceIdsAbsentFromRoster:gtIdsMissingFromRoster},
  blockerCodes:sorted(new Set(blockers)),
  shapePreflightPassed:blockers.length===0,
  eventResultAdjudication:'not-performed',
  sourceSkillIdCrosswalkAdjudication:'not-performed',
  publicationApproved:false,mayPromoteRuntimePins:false,
  originalSourceFilesStored:false,eventProseIncluded:false
 };
}
module.exports={audit,inspectSource,rosterDiff,skillDiff,compareGt,loadEvents,hintRegistryCoverage,topologyDiff};
