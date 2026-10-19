'use strict';
/*
 * Join the 2025 title/chain PROVISIONAL evidence to the new P0/P1/P2 queue.
 * This is a review planner, not an event route or a skill grant adapter.
 */
function fail(s){throw Error('Phase2結果レビュー照合: '+s);}
function join({queue,index}){
 if(queue?.dataKind!=='umasupport-result-review-queue'||queue.forSkillGrant!==false||
    !Array.isArray(queue.rows)||index?.dataKind!=='umasupport-event-coverage-index'||
    index.productionApproval!==false||!Array.isArray(index.cards)||
    queue.sourcePins?.checkerRevision!==index.sourcePins?.checker)
  fail('データ版または非公開状態が不一致');
 const cards=new Map(index.cards.map(c=>[c.cardId,c]));
 if(cards.size!==index.cards.length)fail('全カードID重複');
 const refs=new Map(),found=new Set(),rows=[],totals={
  P0:{total:0,strict2025:0,loose2025:0,unlinked2025:0},
  P1:{total:0,strict2025:0,loose2025:0,unlinked2025:0},
  P2:{total:0,strict2025:0,loose2025:0,unlinked2025:0}};
 for(const card of index.cards){
  if(!Array.isArray(card.observedCandidates))fail('カード候補の形式が不正');
  for(const e of card.observedCandidates){
   if(refs.has(e.sourceKey))fail('候補キー重複');
   refs.set(e.sourceKey,{cardId:card.cardId,...e});
  }
 }
 for(const row of queue.rows){
  const ref=refs.get(row.sourceKey);
  if(!ref||ref.cardId!==row.cardId||found.has(row.sourceKey)||
     !['P0','P1','P2'].includes(row.priority)||row.productionApproval!==false)
   fail('レビュー候補のsourceKey・承認状態が不正');
  found.add(row.sourceKey);
  const status=ref.historical2025?.status||'not-linked',
   previousStoryId=ref.historical2025?.provisionalStoryId||
     ref.historical2025?.possibleStoryId||null;
  const group=totals[row.priority];group.total++;
  if(status==='strict-unique')group.strict2025++;
  else if(status==='typography-suggestion')group.loose2025++;
  else group.unlinked2025++;
  rows.push({...row,historicalLink:{
   sourceYear:2025,status,provisionalStoryId:previousStoryId,
   currentGameIdVerified:false},expectedEventListVerified:false});
 }
 if(found.size!==refs.size||found.size!==queue.stats.eventCandidates)
  fail('候補の全件をレビューキューへ対応できません');
 for(const p of ['P0','P1','P2'])if(totals[p].total!==queue.stats.priorityTotals[p])
  fail('レビュー優先度の総数が不一致');
 return {stats:{events:rows.length,priority:totals,unverified2026:rows.length},
  rows,cards};
}
function query(data,{cardId=null,priority=null,limit=30}={}){
 if(cardId!==null&&!/^\d{5}$/.test(cardId))fail('カードIDは5桁');
 if(priority!==null&&!['P0','P1','P2'].includes(priority))fail('優先度が不正');
 if(!Number.isSafeInteger(limit)||limit<1||limit>2109)fail('表示件数が不正');
 const c=cardId?data.cards.get(cardId):null;
 if(cardId&&!c)fail('カード母集団に存在しないID');
 const rows=data.rows.filter(r=>(!cardId||r.cardId===cardId)&&(!priority||r.priority===priority));
 return {cardId,rarity:c?.rarity||null,
  expectedEventListStatus:c?.expectedEventListStatus||'unknown',
  sourceGapReasons:c?.gaps||[],
  shown:rows.slice(0,limit).length,matched:rows.length,
  rows:rows.slice(0,limit)};
}
module.exports={join,query};
