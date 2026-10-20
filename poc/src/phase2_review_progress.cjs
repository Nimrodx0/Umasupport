'use strict';
/*
 * Complete, non-publishing Phase 2 event review ledger.
 * Corroborated route ≠ authoritative live-game proof or skill-grant approval.
 */
const {join}=require('./phase2_event_review_lookup.cjs');
const {validate:validateEditorial}=require('./editorial_branch_crosscheck.cjs');
const {validate:validateCumulative}=require('./editorial_cumulative_result_30103.cjs');
const fail=s=>{throw Error('Phase2レビュー進捗台帳: '+s);};
function build({queue,index,candidate,facts,audit,cumulativeAudit=null}){
 const joined=join({queue,index});
 validateEditorial({candidate,facts,audit,p0Queue:queue});
 const links=new Map(),issues=new Map(),seen=new Set();
 for(const card of audit.cards){
  const source=facts.cards.find(c=>c.cardId===card.cardId);
  for(const stage of card.transitionStages){
   const event=source.events.find(e=>e.sourceEventOrdinal===stage.eventOrdinal);
   if(!event||seen.has(event.sourceKey))fail('出版社照合対象イベントが不正または重複');
   seen.add(event.sourceKey);
   links.set(event.sourceKey,{branchCount:stage.branches.length,
    crossPublisherSourceCount:card.crossPublisherSources.length,
    actualGamePlayVerified:false,publicationApproval:false});
  }
  for(const issue of card.unresolvedDifferences){
   const event=source.events.find(e=>e.sourceEventOrdinal===issue.eventOrdinal);
   if(!event)fail('資料間不一致が未知のイベントを参照');
   issues.set(event.sourceKey,(issues.get(event.sourceKey)||0)+1);
  }
 }
 let cumulativeStats=null;
 if(cumulativeAudit!==null){
  cumulativeStats=validateCumulative({candidate,facts,p0Queue:queue,audit:cumulativeAudit});
  for(const stage of cumulativeAudit.stages){
   if(links.has(stage.sourceKey))fail('結果依存の独立照合が既存監査と重複');
   links.set(stage.sourceKey,{branchCount:stage.resultKinds.length,
    crossPublisherSourceCount:cumulativeAudit.sources.length,
    actualGamePlayVerified:false,publicationApproval:false});
  }
 }
 const statusCounts={publisherCorroborated:0,sourceConflictOpen:0,awaitingReview:0};
 const cards=new Map();
 const rows=joined.rows.map(row=>{
  const reviewed=links.get(row.sourceKey),openConflicts=issues.get(row.sourceKey)||0;
  const status=reviewed?'publisher-corroborated':openConflicts?'source-conflict-open':'awaiting-review';
  statusCounts[reviewed?'publisherCorroborated':openConflicts?'sourceConflictOpen':'awaitingReview']++;
  const item={cardId:row.cardId,sourceKey:row.sourceKey,
   priority:row.priority,status,observedTransitionBranches:reviewed?.branchCount||0,
   unresolvedDifferences:openConflicts,historicalLink:row.historicalLink,
   routeVerifiedInGame:false,approvedForProduction:false};
  const c=cards.get(row.cardId)||{cardId:row.cardId,
   candidateEvents:0,P0:0,P1:0,P2:0,corroboratedEvents:0,eventsWithOpenSourceConflicts:0};
  c.candidateEvents++;c[row.priority]++;
  if(reviewed)c.corroboratedEvents++;
  if(openConflicts)c.eventsWithOpenSourceConflicts++;
  cards.set(row.cardId,c);
  return item;
 });
 const cardRows=index.cards.map(c=>cards.get(c.cardId)||{cardId:c.cardId,
   candidateEvents:0,P0:0,P1:0,P2:0,corroboratedEvents:0,eventsWithOpenSourceConflicts:0});
 if(rows.length!==2109||cardRows.length!==563||statusCounts.publisherCorroborated!==4+(cumulativeStats?.transitionEvents||0)||
    statusCounts.awaitingReview+statusCounts.sourceConflictOpen+statusCounts.publisherCorroborated!==2109)
  fail('全件候補母数または独立監査の照合不一致');
 return {schemaVersion:1,dataKind:'phase2-review-progress-ledger',
  publicationApproval:false,gamePlayVerificationComplete:false,
  totals:{populationCards:563,candidateCards:queue.stats.eventCandidates?facts.cards.length:0,
   candidates:rows.length,corroboratedTransitions:audit.stats.transitionBranches+(cumulativeStats?.sourceOutcomeStates||0),
   recordedAwardChecks:audit.stats.awardChecks+(cumulativeStats?.numericAwardChecks||0),
   unresolvedNumericSkillFacts:cumulativeStats?.unresolvedSkillFacts||0,
   openPublisherDisagreements:audit.stats.unresolvedDifferences,
   ...statusCounts},cards:cardRows,rows};
}
function query(data,{priority=null,cardId=null,status=null,limit=30}={}){
 if(priority!==null&&!['P0','P1','P2'].includes(priority))fail('優先度が不正');
 if(cardId!==null&&!/^\d{5}$/.test(cardId))fail('カードIDが不正');
 if(status!==null&&!['publisher-corroborated','source-conflict-open','awaiting-review'].includes(status))
  fail('進捗状態が不正');
 if(!Number.isInteger(limit)||limit<1||limit>2109)fail('出力上限が不正');
 const filtered=data.rows.filter(r=>(!priority||r.priority===priority)&&(!cardId||r.cardId===cardId)&&(!status||r.status===status));
 return {total:filtered.length,shown:Math.min(filtered.length,limit),rows:filtered.slice(0,limit)};
}
module.exports={build,query};
