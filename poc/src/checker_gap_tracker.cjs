/*
 * Catalog gap tracker. Contains only card IDs, counts, source URLs and review
 * states. Never copies GameWith/UmaUmaChecker event or choice text.
 */
'use strict';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function track({candidate,gameWith,model}){
 if(!Array.isArray(candidate?.cards)||!Array.isArray(model?.cards)||!obj(gameWith)||gameWith.schemaVersion!==1||!obj(gameWith.cards))
   throw Error('イベント欠損監査: 入力構造が不正');
 const cards=model.cards.filter(c=>['SSR','SR'].includes(c.rarity));
 const ids=new Set(cards.map(c=>c.id));
 if(ids.size!==cards.length)throw Error('イベント欠損監査: モデルのカードIDが重複');
 const indexed=new Map();
 for(const c of candidate.cards){
   if(!ids.has(c.cardId)||indexed.has(c.cardId)||!Array.isArray(c.events))throw Error('イベント欠損監査: 候補のカードIDが不正');
   indexed.set(c.cardId,c);
 }
 const validStates=new Set(['listed','placeholder','unverified']);
 for(const [id,entry] of Object.entries(gameWith.cards)){
   if(!ids.has(id)||!obj(entry)||!validStates.has(entry.eventDetailsStatus)||
      typeof entry.url!=='string'||!/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/[0-9]+$/.test(entry.url))
     throw Error('イベント欠損監査: GameWith参照設定が不正: '+id);
 }
 const unmatchedIds=[],noEventIds=[],reviewQueue=[];
 const statusCount={listed:0,placeholder:0,unverified:0,needsSource:0};
 for(const card of cards){
   const candidateCard=indexed.get(card.id);
   if(candidateCard&&candidateCard.events.length)continue;
   if(!candidateCard)unmatchedIds.push(card.id);
   else noEventIds.push(card.id);
   const ref=gameWith.cards[card.id];
   const status=ref?.eventDetailsStatus||'needsSource';
   statusCount[status]++;
   reviewQueue.push({cardId:card.id,rarity:card.rarity,
     gap:!candidateCard?'name-unmatched':'source-has-zero-events',
     gameWithEventDetails:status,...(ref?{url:ref.url}:{})});
 }
 return {totalSSR_SR:cards.length,matchedCandidates:indexed.size,
   cardsWithEvents:[...indexed.values()].filter(c=>c.events.length>0).length,
   unmatchedIds,noEventIds,reviewQueue,
   gameWithStatusCounts:statusCount,
   warning:'GameWith page status is a research snapshot. A support-card page alone is NOT evidence that all its events have been published.'};
}
module.exports={track};
