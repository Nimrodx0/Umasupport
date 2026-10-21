'use strict';
/*
 * Numeric-only diagnosis of unpublished GameTora app-schema exclusions.
 * The source's event titles, choice labels, raw effects and skill names are
 * deliberately NEVER copied into this report. This is not a release gate.
 */
const fail=m=>{throw Error('GameTora保留原因診断: '+m);};
const REASONS=new Set([
 'RANDOM_ALTERNATIVE_WITHOUT_MULTIPLE_RESULTS',
 'CONDITIONAL_SEGMENT_REQUIRES_REVIEW',
 'SKILL_HINT_EFFECT_UNRESOLVED',
 'DIRECT_SKILL_GRANT_REQUIRES_REVIEW',
 'PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW',
 'TERMINATION_OUTSIDE_CHAIN'
]);
const knownReason=x=>REASONS.has(x)?x:'UNCLASSIFIED_SOURCE_REVIEW_MARKER';
const sortedCounts=map=>Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)));
function diagnose(candidate,report){
 if(candidate?.dataKind!=='gametora-whole-event-numeric-candidate'||
    candidate.releaseApproved!==false||candidate.noEventCanPublishFromThisCandidate!==true||
    report?.dataKind!=='gametora-app-schema-dry-run'||
    report.publicationApproved!==false||!Array.isArray(candidate.cards)||
    !Array.isArray(report.excludedSourcePositions)||!Number.isSafeInteger(report.totals?.skippedEvents))
  fail('未承認の入力と技術的除外レポートが必要');
 const source=new Map(),byCard=new Map();
 for(const card of candidate.cards){
  if(!Array.isArray(card.events)||typeof card.cardId!=='string'||byCard.has(card.cardId))
   fail('カードの重複か破損');
  byCard.set(card.cardId,card);
  for(const e of card.events){
   const key=card.cardId+':'+e.sourceOrdinal;
   if(source.has(key)||!Number.isSafeInteger(e.sourceOrdinal))
    fail('元イベントの位置が重複');
   source.set(key,e);
  }
 }
 const rejected=new Map();
 for(const entry of report.excludedSourcePositions){
  const key=entry.cardId+':'+entry.sourceOrdinal;
  const ev=source.get(key);
  if(!ev||rejected.has(key)||ev.eventId!==entry.eventId)
   fail('除外イベントの位置・IDが元資料と一致しない');
  rejected.set(key,entry);
 }
 if(rejected.size!==report.totals.skippedEvents)
  fail('技術的除外件数が保存されていない');
 const byPrimary=new Map(),byEvidence=new Map(),bySection=new Map(),byCombination=new Map();
 const rows=[];
 for(const entry of report.excludedSourcePositions){
  const e=source.get(entry.cardId+':'+entry.sourceOrdinal);
  const evidence=new Set((e.reviewReasons||[]).map(knownReason));
  let directAwards=0,unparsedHints=0,guardedRoutes=0,duplicateHintRoutes=0;
  for(const ch of e.choices||[]){
   for(const r of ch.routes||[]){
    const routeEvidence=new Set((r.conditionsRequiringReview||[]).map(knownReason));
    for(const mark of routeEvidence)evidence.add(mark);
    if((r.guardKinds||[]).length) {
     guardedRoutes++;
     evidence.add('CONDITIONAL_SEGMENT_REQUIRES_REVIEW');
    }
    directAwards+=(r.directSkillGrantFacts||[]).length;
    if((r.directSkillGrantFacts||[]).length)evidence.add('DIRECT_SKILL_GRANT_REQUIRES_REVIEW');
    const ids=new Set();let duplicate=false;
    for(const h of r.numericHintFacts||[]){
     if(h.numericFactParsed!==true){
      unparsedHints++;evidence.add('SKILL_HINT_EFFECT_UNRESOLVED');
     }
     if(h.skillNumericId!==null&&h.skillNumericId!==undefined){
      if(ids.has(h.skillNumericId))duplicate=true;
      ids.add(h.skillNumericId);
     }
    }
    if(duplicate)duplicateHintRoutes++;
    if(r.explicitChainEnd===true&&e.section!=='arrows')
     evidence.add('TERMINATION_OUTSIDE_CHAIN');
   }
  }
  // Primary exclusions are retained exactly, including ones caused by
  // unresolved skill registries rather than special source structures.
  let predecessorOrdinal=null,predecessorCause=null,predecessorBlocked=false;
  const isChain=entry.reason==='CHAIN_PREDECESSOR_NOT_PROJECTED';
  const isOuting=entry.reason==='OUTING_PREDECESSOR_NOT_PROJECTED';
  if(isChain||isOuting){
   const siblings=byCard.get(entry.cardId).events;
   const prev=(isChain?
    siblings.find(p=>p.section==='arrows'&&p.sourceChainOrdinal===e.sourceChainOrdinal-1):
    siblings.filter(p=>p.section==='dates'&&p.sourceOrdinal<e.sourceOrdinal).at(-1));
   if(prev){
    predecessorOrdinal=prev.sourceOrdinal;
    const excluded=rejected.get(entry.cardId+':'+prev.sourceOrdinal);
    if(excluded){predecessorBlocked=true;predecessorCause=excluded.reason;}
   }
  }
  byPrimary.set(entry.reason,(byPrimary.get(entry.reason)||0)+1);
  bySection.set(e.section,(bySection.get(e.section)||0)+1);
  for(const reason of evidence)byEvidence.set(reason,(byEvidence.get(reason)||0)+1);
  const combo=[...evidence].sort().join('+')||'NO_SOURCE_REVIEW_MARKERS';
  if(entry.reason==='SOURCE_SPECIAL_CASE_REQUIRES_REVIEW')
   byCombination.set(combo,(byCombination.get(combo)||0)+1);
  rows.push({
   cardId:entry.cardId,sourceOrdinal:entry.sourceOrdinal,
   section:['random','arrows','special','dates','dates_random'].includes(e.section)?
     e.section:'unknown',
   primaryReason:entry.reason,
   evidenceCodes:[...evidence].sort(),
   directAwardMentions:directAwards,unparsedHintMentions:unparsedHints,
   guardedRouteCount:guardedRoutes,duplicateHintRouteCount:duplicateHintRoutes,
   ...(isChain||isOuting?{predecessorSourceOrdinal:predecessorOrdinal,
    predecessorBlocked,predecessorPrimaryReason:predecessorCause}:{})
  });
 }
 const expected=report.excludedReasons||{};
 const actual=sortedCounts(byPrimary);
 if(JSON.stringify(actual)!==JSON.stringify(Object.fromEntries(Object.entries(expected).sort())))
  fail('一次除外理由の母数不一致');
 const sum=xs=>Object.values(xs).reduce((a,b)=>a+b,0);
 if(sum(actual)!==rejected.size)fail('診断母数の不一致');
 return {
  schemaVersion:1,dataKind:'gametora-schema-blocker-diagnosis',
  publicationApproved:false,gameVerified:false,sourceProseIncluded:false,
  historical2025OnlyIdsAreNot2026Verified:true,
  totalExcluded:rejected.size,
  primaryReasonCounts:actual,
  sourceSectionCounts:sortedCounts(bySection),
  sourceEvidenceEventCounts:sortedCounts(byEvidence),
  specialCaseEvidenceCombinations:sortedCounts(byCombination),
  numericOnlyPositions:rows
 };
}
module.exports={diagnose};
