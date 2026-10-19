'use strict';
/* Candidate coverage is not verified completeness. Never map missing to "no event". */
const {readUmaSim}=require('../tools/audit_card_coverage.cjs');
const ID=/^\d{5}$/;
function fail(s){throw Error('イベント母集団監査: '+s);}
function build({rosterText,choiceFacts,curationIndex}){
 const roster=readUmaSim(rosterText);
 if(!choiceFacts||choiceFacts.schemaVersion!==1||choiceFacts.dataKind!=='umasupport-choice-result-facts'||
    choiceFacts.productionApproval!==false||!Array.isArray(choiceFacts.cards))fail('未承認候補DBが不正');
 if(!curationIndex||curationIndex.schemaVersion!==1||!Array.isArray(curationIndex.cards))
   fail('草稿出典索引が不正');
 const facts=new Map(),drafts=new Map();
 for(const c of choiceFacts.cards){
  if(!c||!ID.test(c.cardId)||facts.has(c.cardId)||!Array.isArray(c.events))
   fail('候補カードIDの重複・構造不正');
  const reference=roster.get(Number(c.cardId));
  if(!reference||reference.rarity!==c.rarity||c.rarity==='R')
   fail('候補の母集団・レアリティが不一致: '+c.cardId);
  const seen=new Set();
  for(const e of c.events){
   if(!e||typeof e.sourceKey!=='string'||seen.has(e.sourceKey)||!Array.isArray(e.choices))
    fail('候補イベントが不正・重複');
   seen.add(e.sourceKey);
  }
  facts.set(c.cardId,c);
 }
 for(const d of curationIndex.cards){
  if(!d||!ID.test(d.cardId)||drafts.has(d.cardId)||!roster.has(Number(d.cardId)))
   fail('草稿が不正・重複・母集団外');
  drafts.set(d.cardId,d);
 }
 const cards=[...roster.values()].sort((a,b)=>a.id-b.id).map(c=>{
  const cardId=String(c.id),candidate=facts.get(cardId),draft=drafts.get(cardId);
  const events=(candidate?.events||[]).map(e=>({
   sourceKey:e.sourceKey,
   sourceEventOrdinal:e.sourceEventOrdinal,
   candidateStatus:e.candidateStatus,
   eventKind:'unknown',characterShared:'unknown',
   gameEventIdVerified:e.gameEventIdVerified===true
  }));
  const gaps=[];
  if(!candidate)gaps.push(c.rarity==='R'?'R_SOURCE_NOT_INCLUDED':'CHECKER_SOURCE_NOT_OBSERVED');
  if(!draft)gaps.push('CURATED_DRAFT_NOT_INDEXED');
  gaps.push('INDEPENDENT_EXPECTED_EVENT_LIST_MISSING');
  if(events.some(e=>e.candidateStatus==='needs-choice-or-result-review'))
   gaps.push('RESULT_OR_REWARD_REVIEW_REQUIRED');
  return {cardId,rarity:c.rarity,observedCandidateCount:events.length,
   observedCandidates:events,draftStatus:draft?.recordStatus||'not-indexed',
   expectedEventCount:null,expectedEventListStatus:'unknown',
   characterCommonEventsStatus:'unknown',branchVerificationStatus:'unknown',gaps};
 });
 const rarityCounts={R:0,SR:0,SSR:0};
 cards.forEach(c=>rarityCounts[c.rarity]++);
 return {schemaVersion:1,dataKind:'umasupport-event-coverage-index',
  productionApproval:false,sourcePins:{umasim:choiceFacts.sourcePins?.skillRevision||null,
   checker:choiceFacts.sourcePins?.checkerRevision||null},
  stats:{rosterCards:cards.length,rarityCounts,
   cardsWithCheckerCandidates:facts.size,observedCheckerCandidates:cards.reduce((n,c)=>n+c.observedCandidateCount,0),
   cardsWithCuratedDraft:drafts.size,
   cardsWithoutVerifiedExpectedEventList:cards.filter(c=>c.expectedEventListStatus==='unknown').length,
   cardsOutsideCheckerScope:cards.filter(c=>c.rarity==='R').length},cards};
}
function verifySnapshot(index,exp={cards:563,R:146,SR:101,SSR:316,candidateCards:417,events:2109}){
 const x=index.stats;
 if(x.rosterCards!==exp.cards||x.rarityCounts.R!==exp.R||x.rarityCounts.SR!==exp.SR||
    x.rarityCounts.SSR!==exp.SSR||x.cardsWithCheckerCandidates!==exp.candidateCards||
    x.observedCheckerCandidates!==exp.events||x.cardsWithoutVerifiedExpectedEventList!==exp.cards)
   fail('固定スナップショット件数が一致しないため停止');
 return x;
}
module.exports={build,verifySnapshot};
