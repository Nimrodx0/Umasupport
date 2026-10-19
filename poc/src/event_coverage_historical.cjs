'use strict';
// Join already pinned evidence; an old numeric story ID never proves current behavior.
function fail(s){throw Error('歴史的数値照合: '+s);}
function attach(index,source,chains){
 if(index?.dataKind!=='umasupport-event-coverage-index'||index.productionApproval!==false||
    !Array.isArray(index.cards)||source?.dataKind!=='support-event-route-classification'||
    source.forSkillGrant!==false||chains?.dataKind!=='provisional-historical-chain-stage-audit'||
    chains.forSkillGrant!==false||!Array.isArray(source.cards)||!Array.isArray(chains.chainGroups))
  fail('未承認索引の種別が不正');
 if(index.sourcePins?.checker!==source.sourcePins?.checkerRevision||
    source.candidateInputSha256!==chains.sourcePins?.candidateInputSha256||
    source.sourcePins?.historicalMaster?.sha256!==chains.sourcePins?.historicalMasterSha256)
  fail('ソースピンの不一致');
 const cards=new Map(index.cards.map(c=>[c.cardId,c]));
 const links=new Map(),counts={strict:0,typography:0,events:0,groups:0};
 for(const card of source.cards){
  const dest=cards.get(card.cardId);
  if(!dest||dest.rarity!==card.rarity||dest.observedCandidateCount!==card.events.length)
   fail('対象カードの候補件数が違う');
  for(let i=0;i<card.events.length;i++){
   const event=card.events[i],target=dest.observedCandidates[i],h=event.historicalLink;
   if(event.sourceKey!==target.sourceKey||event.status!=='needs-review'||!h)
    fail('候補キーの不一致');
   const label={status:h.status,sourceYear:2025,currentGameVerified:false};
   if(h.status==='strict-unique'){
    if(!/^\d+$/.test(h.provisionalStoryId))fail('旧story IDが不正');
    label.provisionalStoryId=h.provisionalStoryId;counts.strict++;
   }else if(h.status==='typography-suggestion'){
    if(!/^\d+$/.test(h.possibleStoryId))fail('旧候補IDが不正');
    label.possibleStoryId=h.possibleStoryId;counts.typography++;
   }else if(!['no-match','ambiguous','no-2025-direct-story-rows'].includes(h.status))
    fail('未定義の旧マスター照合状態');
   target.historical2025=label;
   links.set(target.sourceKey,{cardId:card.cardId,...label});
   counts.events++;
  }
 }
 if(counts.events!==index.stats.observedCheckerCandidates||
    counts.strict!==source.totals.historicalProvisionalLinks['strict-unique']||
    counts.typography!==source.totals.historicalProvisionalLinks['typography-suggestion'])
   fail('候補の総数が異なる');
 for(const card of index.cards){card.historicalPotentialGaps=[];card.historicalChainGroups=[];}
 for(const gap of source.historicalPossibleGaps){
  const card=cards.get(gap.cardId);
  if(!card||gap.confirmedMissingIn2026!==false||!/^\d+$/.test(gap.historicalStoryId))
   fail('未確認の欠損を確定扱いできない');
  card.historicalPotentialGaps.push({historicalStoryId:gap.historicalStoryId,
   diagnostic:gap.diagnostic,confirmedMissingIn2026:false});
 }
 const grouped=new Set();
 for(const group of chains.chainGroups){
  const card=cards.get(group.cardId);
  if(!card||!Array.isArray(group.events))fail('旧段階グループが不正');
  for(const ev of group.events){
   const link=links.get(ev.sourceKey);
   if(!link||link.cardId!==group.cardId||link.provisionalStoryId!==ev.provisionalStoryId||
      grouped.has(ev.sourceKey))fail('旧段階とID仮リンクが矛盾');
   grouped.add(ev.sourceKey);
  }
  card.historicalChainGroups.push({sourceYear:2025,chainMax:group.chainMax,
   structuralStatus:group.structuralStatus,reviewBand:group.reviewBand,
   linkedCandidateCount:group.events.length,routeVerifiedIn2026:false});
  counts.groups++;
 }
 if(counts.groups!==chains.totals.stageGroups||
    grouped.size!==chains.totals.stageEvents||
    counts.strict!==grouped.size+chains.totals.unsequencedStrictEvents)
   fail('旧段階グループ総数が不一致');
 index.stats.historical2025={
  provisionalStrictLinks:counts.strict,typographySuggestions:counts.typography,
  unpairedHistoricalStoryIds:source.historicalPossibleGaps.length,
  stageGroups:counts.groups,structurallyCompleteGroups:chains.totals.stageCompleteUnique,
  incompleteGroups:chains.totals.stageIncomplete,ambiguousGroups:chains.totals.stageAmbiguous,
  verifiedGameRoutes:0};
 index.historicalEvidenceStatus='2025_PROVISIONAL_ONLY';
 return index;
}
module.exports={attach};
