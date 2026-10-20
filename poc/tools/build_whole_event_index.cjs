'use strict';
/*
 * Whole-roster cross-source event inventory. Every match is provisional.
 * Source event and choice text stays in transient memory, never in output.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const loader=require('../src/live_loader.js');
const pipeline=require('../src/checker_candidate_pipeline.cjs');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const normalized=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
const typographic=s=>normalized(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
function fail(s){throw Error('Whole-event index: '+s);}
function fingerprint(title,soft=false){
 const value=soft?typographic(title):normalized(title);
 return value?'sha256:'+sha256(value):null;
}
function sourceInventory({checker,rosterText,aliases}){
 const model=loader.buildModel(rosterText,{mode:'audit'});
 const strict=pipeline.inventory({source:checker,model,aliases:{}});
 const matched=new Set(strict.cards.map(c=>c.cardId)),active={};
 for(const [id,name] of Object.entries(aliases||{})){
  if(matched.has(id))continue; // Stale alias should not override exact card title.
  const card=model.cardById?.[id]||model.cards.find(c=>c.id===id);
  if(!card)fail('alias for unknown card '+id);
  const entries=Object.keys(checker.Skills?.[card.rarity]||{})
    .filter(n=>normalized(n)===normalized(name));
  if(entries.length>1)fail('ambiguous alias '+id);
  if(entries.length===1)active[id]=name;
 }
 const inventory=pipeline.inventory({source:checker,model,aliases:active});
 return {inventory,model,activeAliases:active};
}
function sourceEvents(card){
 const eventMap=card.events_ja&&Object.keys(card.events_ja).length?'events_ja':'events';
 const events=card[eventMap];
 if(!events||typeof events!=='object'||Array.isArray(events))
  fail('missing GameTora events '+card.id);
 const out=[];let sourceOrdinal=0,chainOrdinal=0;
 for(const [key,item] of Object.entries(events)){
  sourceOrdinal++;
  if(!item||typeof item!=='object'||!Array.isArray(item.choices))
   fail('malformed GameTora event '+card.id+':'+sourceOrdinal);
  if(item.section==='arrows')chainOrdinal++;
  out.push({
   sourceOrdinal,chainOrdinal:item.section==='arrows'?chainOrdinal:null,
   sourceLocalEventId:Number.isSafeInteger(item.id)?item.id:null,
   section:item.section||'unknown',
   choiceCount:item.choices.length,
   strict:fingerprint(item.name||key),soft:fingerprint(item.name||key,true)
  });
 }
 return {language:eventMap==='events_ja'?'ja':'fallback',events:out};
}
function pairEvents(checkerEvents,gtEvents){
 // Two-pass bipartite identity matching. Non-unique titles are NOT paired.
 const selected=[],occupiedC=new Set(),occupiedG=new Set();
 for(const [field,status] of [['strict','exact-name-provisional'],['soft','typography-provisional']]){
  const cMap=new Map(),gMap=new Map();
  const append=(map,key,i)=>{if(!key)return;const arr=map.get(key)||[];arr.push(i);map.set(key,arr);};
  checkerEvents.forEach((e,i)=>{if(!occupiedC.has(i))append(cMap,e[field],i);});
  gtEvents.forEach((e,i)=>{if(!occupiedG.has(i))append(gMap,e[field],i);});
  for(const [key,ci] of cMap){
   const gi=gMap.get(key)||[];
   if(ci.length===1&&gi.length===1){
    selected.push({ci:ci[0],gi:gi[0],status});
    occupiedC.add(ci[0]);occupiedG.add(gi[0]);
   }
  }
 }
 const unmatchedC=checkerEvents.map((_,i)=>i).filter(i=>!occupiedC.has(i));
 const unmatchedG=gtEvents.map((_,i)=>i).filter(i=>!occupiedG.has(i));
 return {selected,unmatchedC,unmatchedG};
}
function build({checker,rosterText,aliases,coverageIndex,queue,gameToraDocuments,sourceRevision,
 checkerRevision}){
 if(!/^[0-9a-f]{40}$/.test(sourceRevision)||!/^[0-9a-f]{40}$/.test(checkerRevision)||
    coverageIndex?.dataKind!=='umasupport-event-coverage-index'||!Array.isArray(coverageIndex.cards)||
    coverageIndex.productionApproval!==false||
    coverageIndex.sourcePins?.checker!==checkerRevision||
    queue?.dataKind!=='umasupport-result-review-queue'||queue.forSkillGrant!==false||
    !Array.isArray(queue.rows)||!Array.isArray(gameToraDocuments))
  fail('input schema/provenance mismatch');
 const {inventory}=sourceInventory({checker,rosterText,aliases});
 const byChecker=new Map(inventory.cards.map(c=>[c.cardId,c]));
 const byGameTora=new Map();
 for(const doc of gameToraDocuments){
  if(!Number.isSafeInteger(doc?.id)||byGameTora.has(String(doc.id))||doc.kind!=='support')
   fail('duplicate or malformed GameTora card');
  byGameTora.set(String(doc.id),sourceEvents(doc));
 }
 const stats={rosterCards:coverageIndex.cards.length,checkerCards:inventory.cards.length,
  checkerEventRecords:0,gameToraCards:byGameTora.size,gameToraEventRecords:0,
  gameToraChainEvents:0,gameToraRandomEvents:0,gameToraOtherEvents:0,
  cardsBoth:0,cardsOnlyChecker:0,cardsOnlyGameTora:0,cardsNeither:0,
  pairedExact:0,pairedTypographic:0,pairedChoiceCountAgree:0,pairedChoiceCountConflict:0,
  checkerUnmatchedEvents:0,gameToraUnmatchedEvents:0,
  gameToraOnlyCardsR:0,languageFallbackCards:0,ambiguousTitleCards:0,
  cardsWithUnmatchedEvents:0,unionObservedEventRecords:0,
  p0SourceEventsPaired:0,p0SourceEventsUnpaired:0};
 const rows=[],seen=new Set();
 const p0Keys=new Set(queue.rows.filter(x=>x.priority==='P0').map(x=>x.sourceKey));
 if(queue.rows.length!==2109||p0Keys.size!==199)fail('unexpected review queue');
 for(const card of coverageIndex.cards){
  if(seen.has(card.cardId))fail('roster duplicate '+card.cardId);
  seen.add(card.cardId);
  const ci=byChecker.get(card.cardId),gi=byGameTora.get(card.cardId);
  const ce=(ci?.events||[]).map(e=>({...e,strict:e.titleFingerprint,soft:e.typographicFingerprint})),ge=gi?.events||[];
  if(ce.length!==card.observedCandidateCount||
     ce.some((e,i)=>e.sourceKey!==card.observedCandidates[i].sourceKey))
   fail('first-party Checker sourceKey/ordinal drift '+card.cardId);
  stats.checkerEventRecords+=ce.length;stats.gameToraEventRecords+=ge.length;
  for(const e of ge){
   if(e.section==='arrows')stats.gameToraChainEvents++;
   else if(e.section==='random')stats.gameToraRandomEvents++;
   else stats.gameToraOtherEvents++;
  }
  if(ci&&gi)stats.cardsBoth++;
  else if(ci)stats.cardsOnlyChecker++;
  else if(gi){stats.cardsOnlyGameTora++;if(card.rarity==='R')stats.gameToraOnlyCardsR++;}
  else stats.cardsNeither++;
  if(gi?.language==='fallback')stats.languageFallbackCards++;
  const {selected,unmatchedC,unmatchedG}=pairEvents(ce,ge);
  let p0Paired=0;
  const pairs=selected.map(({ci:cIdx,gi:gIdx,status})=>{
   const a=ce[cIdx],b=ge[gIdx];
   if(status==='exact-name-provisional')stats.pairedExact++;
   else stats.pairedTypographic++;
   const choiceCountAgreement=a.optionCount===b.choiceCount;
   stats[choiceCountAgreement?'pairedChoiceCountAgree':'pairedChoiceCountConflict']++;
   if(p0Keys.has(a.sourceKey)){p0Paired++;stats.p0SourceEventsPaired++;}
   return {sourceKey:a.sourceKey,checkerOrdinal:a.sourceIndex+1,
    sourceOrdinal:b.sourceOrdinal,sourceLocalEventId:b.sourceLocalEventId,
    sourceSection:b.section,sourceChainOrdinal:b.chainOrdinal,
    matchMethod:status,choiceCountAgreement,
    checkerChoiceCount:a.optionCount,sourceChoiceCount:b.choiceCount,
    historical2025:card.observedCandidates[cIdx].historical2025?.provisionalStoryId||null};
  }).sort((a,b)=>a.checkerOrdinal-b.checkerOrdinal);
  const p0InCard=ce.filter(e=>p0Keys.has(e.sourceKey)).length;
  stats.p0SourceEventsUnpaired+=p0InCard-p0Paired;
  stats.checkerUnmatchedEvents+=unmatchedC.length;
  stats.gameToraUnmatchedEvents+=unmatchedG.length;
  if(unmatchedC.length||unmatchedG.length)stats.cardsWithUnmatchedEvents++;
  const ambiguity=(arr,key)=>{
   const count=new Map();for(const x of arr){if(!x[key])continue;count.set(x[key],(count.get(x[key])||0)+1);}
   return [...count.values()].some(x=>x>1);
  };
  const hasDuplicateTitles=ambiguity(ce,'strict')||ambiguity(ge,'strict');
  if(hasDuplicateTitles)stats.ambiguousTitleCards++;
  // Hashes are identifying metadata only; the original text NEVER leaves the transient run.
  rows.push({cardId:card.cardId,rarity:card.rarity,
   checkerObservedCount:ce.length,gameToraObservedCount:ge.length,
   gameToraLanguage:gi?.language||null,
   matchCount:pairs.length,unmatchedCheckerCount:unmatchedC.length,
   unmatchedGameToraCount:unmatchedG.length,
   possibleDuplicateTitles:hasDuplicateTitles,
   sourceMissing:!gi,checkerMissing:!ci,
   p0CandidateCount:p0InCard,p0PairedCount:p0Paired,
   pairs,
   checkerOnly:unmatchedC.map(i=>({sourceKey:ce[i].sourceKey,checkerOrdinal:ce[i].sourceIndex+1})),
   gameToraOnly:unmatchedG.map(i=>({
    sourceOrdinal:ge[i].sourceOrdinal,sourceLocalEventId:ge[i].sourceLocalEventId,
    section:ge[i].section,sourceChainOrdinal:ge[i].chainOrdinal}))
  });
 }
 if(seen.size!==563||byChecker.size!==417||byGameTora.size!==559||
    stats.checkerEventRecords!==2109||stats.p0SourceEventsPaired+stats.p0SourceEventsUnpaired!==199)
  fail('incomplete frozen population');
 stats.unionObservedEventRecords=stats.checkerEventRecords+
   stats.gameToraEventRecords-stats.pairedExact-stats.pairedTypographic;
 if(stats.checkerUnmatchedEvents+stats.pairedExact+stats.pairedTypographic!==stats.checkerEventRecords||
    stats.gameToraUnmatchedEvents+stats.pairedExact+stats.pairedTypographic!==stats.gameToraEventRecords)
  fail('pairing conservation mismatch');
 return {schemaVersion:1,dataKind:'umasupport-whole-event-provisional-index',
  sourcePins:{checker:checkerRevision,gameToraDerived:sourceRevision},
  publicationApproval:false,gameVerified:false,allActualEventsVerified:false,
  routeTopologyVerified:false,choiceSemanticsVerified:false,
  eventMatchesProvisionalOnly:true,rawSourceContentIncluded:false,
  stats,cards:rows};
}
function main(args){
 if(args.length!==4)fail('usage: node poc/tools/build_whole_event_index.cjs <umasim-support.txt> <checker-Events.json> <gametora-dir> <output.json>');
 const [rosterPath,checkerPath,gtDir,out]=args;
 const index=require('../data/candidates/event_coverage_index.v1.json');
 const queue=require('../data/candidates/checker_explicit_result_review_queue.v1.json');
 const checkerRev='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
 const gtRev='6e38b54af4fad397ff4491e63007a90705a4fe67';
 const pins=require('../data/candidates/checker_event_hints.v1.json').sourcePins;
 for(const [key,file,revision] of [
  ['checker',checkerPath,checkerRev],
  ['umasimCards',rosterPath,'cf9366f6a487bd8f197b53d8a11981207beb9f6c']
 ]){
  if(pins[key]?.revision!==revision||sha256(fs.readFileSync(file))!==pins[key]?.sha256)
   fail('pinned raw file checksum mismatch '+key);
 }
 const result=build({checker:JSON.parse(fs.readFileSync(checkerPath,'utf8').replace(/^\uFEFF/,'')),
  rosterText:fs.readFileSync(rosterPath,'utf8'),
  aliases:require('../config/checker-name-aliases.json'),
  coverageIndex:index,queue,
  gameToraDocuments:readDocuments(gtDir),
  sourceRevision:gtRev,checkerRevision:checkerRev});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('WHOLE_EVENT_INDEX_STATS='+JSON.stringify(result.stats));
 console.log('Top event discrepancies: '+JSON.stringify(result.cards.filter(c=>
  c.unmatchedCheckerCount||c.unmatchedGameToraCount)
   .sort((a,b)=>b.unmatchedCheckerCount+b.unmatchedGameToraCount-
     a.unmatchedCheckerCount-a.unmatchedGameToraCount)
   .slice(0,20).map(c=>({cardId:c.cardId,checker:c.unmatchedCheckerCount,
     gameTora:c.unmatchedGameToraCount}))));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={fingerprint,sourceInventory,sourceEvents,pairEvents,build};
