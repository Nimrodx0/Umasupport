'use strict';
/*
 * Publication triage across all 2,488 GT events. A fixed UmSim registry
 * failure and a source discrepancy are NOT interchangeable. Join the
 * independently version-pinned GT/Checker cross-source exception queue
 * before describing any event as a routine publication-review candidate.
 *
 * This module exports metadata only. The source event prose and projected
 * runtime catalog are never written by this code.
 */
const fail = s=>{throw Error('Phase2統合例外トリアージ: '+s);};
const obj = x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const key = (id,n)=>id+':'+n;
const BASELINE_ROOT_REASONS = new Set([
 'SKILL_ID_OR_HINT_EFFECT_PENDING','RANGED_HINT_EFFECT_PENDING'
]);
const CROSS_SOURCE_TYPES = new Set([
 'CHECKER_ONLY','GAMETORA_ONLY','CHOICE_COUNT_DIFFERENCE'
]);
function build({review,normalized,baselineReport,crossSource},{strict=false}={}){
 if(review?.dataKind!=='gametora-2488-unsigned-publication-review-queue'||
    review.automaticallyReleaseApproved!==false||
    review.sourceNarrativeOrChoiceProseIncluded!==false||
    !Array.isArray(review.rows)||
    normalized?.dataKind!=='gametora-whole-event-numeric-candidate'||
    normalized.releaseApproved!==false||
    !Array.isArray(normalized.cards)||
    baselineReport?.dataKind!=='gametora-app-schema-dry-run'||
    baselineReport.publicationApproved!==false||
    !Array.isArray(baselineReport.excludedSourcePositions)||
    crossSource?.dataKind!=='phase2-fixed-source-completeness-exceptions'||
    crossSource.publicationApproved!==false||
    crossSource.sourceDocumentsNotRedistributed!==true||
    !Array.isArray(crossSource.queue))
  fail('未承認の4つの固定出典監査結果が必要');
 if(review.sourcePins?.gameToraDerived!==normalized.sourcePins?.gameToraDerived||
    review.sourcePins?.gameToraDerived!==crossSource.sourcePins?.gameToraDerived||
    review.sourcePins?.checkerIndex!==crossSource.sourcePins?.checker)
  fail('出典の固定コミットが一致しません');
 const events=new Map(),chainByKey=new Map(),rows=new Map(),blocked=new Map();
 for(const card of normalized.cards){
  for(const e of card.events){
   const id=key(card.cardId,e.sourceOrdinal);
   if(events.has(id))fail('元イベント位置の重複');
   events.set(id,{...e,cardId:card.cardId});
   if(e.section==='arrows'){
    const ck=key(card.cardId,e.sourceChainOrdinal);
    if(!Number.isInteger(e.sourceChainOrdinal)||e.sourceChainOrdinal<1||
       chainByKey.has(ck))fail('連続イベントの段階重複');
    chainByKey.set(ck,id);
   }
  }
 }
 for(const row of review.rows){
  const id=key(row.cardId,row.sourceOrdinal);
  if(rows.has(id)||!events.has(id)||
     row.eventId!==events.get(id).eventId||
     row.releaseApproved!==false||
     row.status!=='PENDING_HUMAN_PUBLICATION_REVIEW')
   fail('未署名キューと元イベントが一致しない');
  rows.set(id,row);
 }
 if(rows.size!==events.size)fail('元イベントとレビュー行の件数差');
 for(const x of baselineReport.excludedSourcePositions){
  const id=key(x.cardId,x.sourceOrdinal);
  if(blocked.has(id)||!events.has(id)||events.get(id).eventId!==x.eventId)
   fail('旧辞書除外イベントの出典位置が一致しない');
  blocked.set(id,x.reason);
 }
 if(blocked.size!==baselineReport.totals?.skippedEvents)fail('旧辞書の除外件数が不一致');
 const traceCache=new Map();
 function rootCause(id,trail=new Set()){
  if(trail.has(id))fail('連続イベントの原因追跡で循環を検出');
  if(traceCache.has(id))return traceCache.get(id);
  const why=blocked.get(id),event=events.get(id);
  if(!why||!event)fail('除外原因を追跡できない');
  if(BASELINE_ROOT_REASONS.has(why)){
   const result={rootCardId:event.cardId,rootSourceOrdinal:event.sourceOrdinal,
    rootReason:why,dependencyDepth:0};
   traceCache.set(id,result);return result;
  }
  if(why!=='CHAIN_PREDECESSOR_NOT_PROJECTED'||event.section!=='arrows'||
     !Number.isInteger(event.sourceChainOrdinal)||event.sourceChainOrdinal<2)
   fail('未分類の旧辞書除外理由。自動でスキル辞書問題へ含めない: '+why);
  const prev=chainByKey.get(key(event.cardId,event.sourceChainOrdinal-1));
  if(!prev||!blocked.has(prev))fail('除外の原因となる前段が特定できない');
  const parent=rootCause(prev,new Set([...trail,id]));
  const result={...parent,dependencyDepth:parent.dependencyDepth+1};
  traceCache.set(id,result);return result;
 }
 const mapped=new Map(),extras=[],outsideGT=[];
 const counts={gtOnlyNonR:0,gtOnlyRInformational:0,
  sourceChoiceTopologyIncomplete:0,explainedChoicePresentation:0,
  checkerOnlyOnGTCards:0,checkerOnlyOnMissingGTCards:0};
 const duplicates=new Set();
 for(const exception of crossSource.queue){
  if(!obj(exception)||!CROSS_SOURCE_TYPES.has(exception.type)||
     !/^\d{5}$/.test(exception.cardId)||
     exception.publicationApproved!==false)
   fail('出典差異の形式が不正');
  const unique=JSON.stringify([exception.type,exception.cardId,
   exception.sourceOrdinal??null,exception.checkerOrdinal??null]);
  if(duplicates.has(unique))fail('出典差異の重複');duplicates.add(unique);
  if(exception.type==='CHECKER_ONLY'){
   if(!Number.isInteger(exception.checkerOrdinal)||exception.checkerOrdinal<1||
      typeof exception.sourceKey!=='string')fail('Checker-only位置が不正');
   const noGT=exception.reason==='NO_GAMETORA_CARD';
   if(noGT)counts.checkerOnlyOnMissingGTCards++;
   else counts.checkerOnlyOnGTCards++;
   outsideGT.push({cardId:exception.cardId,
    checkerOrdinal:exception.checkerOrdinal,sourceKey:exception.sourceKey,
    triageCode:noGT?'SOURCE_CARD_NOT_IN_FIXED_GT':'UNMATCHED_CHECKER_EVENT_IDENTITY',
    priority:exception.priority,approvalGranted:false});
   continue;
  }
  if(!Number.isInteger(exception.sourceOrdinal)||exception.sourceOrdinal<1)
   fail('GameTora側の対象イベント位置が不正');
  const id=key(exception.cardId,exception.sourceOrdinal);
  if(!rows.has(id))fail('GameTora-only/choice差異のイベント位置が不明');
  if(exception.type==='GAMETORA_ONLY'){
   if(exception.rarity==='R'){
    counts.gtOnlyRInformational++;
    continue; // R cards are outside the Checker source scope.
   }
   counts.gtOnlyNonR++;
   const bucket=mapped.get(id)||new Set();
   bucket.add('NON_R_GT_EVENT_NOT_PAIRED_IN_CHECKER');
   mapped.set(id,bucket);
  }else{
   if(exception.status==='FIXED_SOURCE_CHOICE_TOPOLOGY_INCOMPLETE'){
    counts.sourceChoiceTopologyIncomplete++;
    const bucket=mapped.get(id)||new Set();
    bucket.add('FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE');
    mapped.set(id,bucket);
   }else if(['SOURCE_REPRESENTATION_EXPLAINED','CHECKER_PARTIAL_CHOICE_ROWS']
      .includes(exception.status)){
    counts.explainedChoicePresentation++;
   }else fail('選択肢の差異未分類。安易に無視しません');
  }
 }
 const enrichedRows=[],rootReasons={},impactedRootPositions=new Set();
 let directRootEvents=0,cascadeEvents=0,markedEvents=0,exceptionPositions=0,
  routineWithoutTheseWarnings=0;
 for(const row of review.rows){
  const id=key(row.cardId,row.sourceOrdinal);
  const flags=new Set(mapped.get(id)||[]);
  const isSourceMarked=row.sourceReasonCodes?.length>0;
  if(isSourceMarked){flags.add('GT_BRANCH_OR_EFFECT_SOURCE_MARKER');markedEvents++;}
  const why=blocked.get(id);
  let dependency=null;
  if(why){
   if(row.baselineExclusionReason!==why)fail('旧辞書除外原因が元レビューと異なる');
   dependency=rootCause(id);
   if(dependency.dependencyDepth>0){
    flags.add('INHERITED_BASELINE_PROJECTION_BLOCK');
    cascadeEvents++;
   }else{
    flags.add('DIRECT_BASELINE_PROJECTION_BLOCK');
    directRootEvents++;
    rootReasons[why]=(rootReasons[why]||0)+1;
   }
   impactedRootPositions.add(key(dependency.rootCardId,dependency.rootSourceOrdinal));
  }else if(row.baselineExclusionReason!==null){
   fail('除外位置でないイベントに旧辞書問題を付与');
  }
  if(mapped.has(id))exceptionPositions++;
  if(flags.size===0)routineWithoutTheseWarnings++;
  const crossSourceFlags=[...flags].filter(x=>x==='NON_R_GT_EVENT_NOT_PAIRED_IN_CHECKER'||
    x==='FIXED_GT_PLAYER_CHOICE_TOPOLOGY_INCOMPLETE').sort();
  enrichedRows.push({
   cardId:row.cardId,sourceOrdinal:row.sourceOrdinal,eventId:row.eventId,
   eventSha256:row.eventSha256,
   triage:'PENDING_PUBLICATION_REVIEW',
   flagged:[...flags].sort(),
   crossSourceFlags,
   ...(dependency?{baselineCause:dependency}:{}),
   approved:false
  });
 }
 const uniqueRoots=[...impactedRootPositions].length;
 if(directRootEvents+cascadeEvents!==blocked.size||
    uniqueRoots!==directRootEvents||
    counts.sourceChoiceTopologyIncomplete!==1&&strict)
  fail('旧辞書直接原因と下流影響の計算が不一致');
 const summary={
  sourceEvents:events.size,approvedEvents:0,
  baselineDirectRoots:directRootEvents,
  baselineDependentStages:cascadeEvents,
  baselineRootReasons:Object.fromEntries(Object.entries(rootReasons).sort()),
  baselineDistinctRootCauses:uniqueRoots,
  sourceMarkerEvents:markedEvents,
  crossSourceExceptionPositions:exceptionPositions,
  ...counts,
  routineWithoutTheseWarnings,
  unmatchedCheckerRows:outsideGT.length,
  missingBothPinnedGTAndCheckerChainStages:
   (crossSource.supplementalMissingGTChainReviews||[])
    .reduce((n,x)=>n+x.additionalIndependentExpectedEventsNotInNeitherPinnedSource,0)
 };
 if(summary.unmatchedCheckerRows!==
    summary.checkerOnlyOnGTCards+summary.checkerOnlyOnMissingGTCards)
  fail('Checkerのみの行数の和が一致しない');
 if(strict&&(
    summary.sourceEvents!==2488||
    summary.baselineDirectRoots!==75||
    summary.baselineDependentStages!==35||
    rootReasons.SKILL_ID_OR_HINT_EFFECT_PENDING!==73||
    rootReasons.RANGED_HINT_EFFECT_PENDING!==2||
    summary.sourceMarkerEvents!==34||
    summary.gtOnlyNonR!==24||summary.gtOnlyRInformational!==395||
    summary.sourceChoiceTopologyIncomplete!==1||
    summary.explainedChoicePresentation!==8||
    summary.checkerOnlyOnGTCards!==20||
    summary.checkerOnlyOnMissingGTCards!==20||
    summary.missingBothPinnedGTAndCheckerChainStages!==3||
    summary.approvedEvents!==0))
  fail('固定2,488イベントと65出典差異の監査ゲートが一致しない');
 return {schemaVersion:1,dataKind:'phase2-cross-source-publication-triage',
  sourcePins:structuredClone(review.sourcePins),
  sourceNarrativeOrChoiceProseIncluded:false,
  publicReleaseApproved:false,gameplayReproductionRequired:false,
  summary,rows:enrichedRows,unmatchedCheckerRows:outsideGT};
}
module.exports={build};
