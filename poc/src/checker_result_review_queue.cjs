'use strict';
/*
 * Event-wide triage for all 2,109 observed Checker candidates.
 * No unreviewed record is a confirmed 2026 game route.
 */
const {verifyDerived}=require('./checker_explicit_result_extract.cjs');
function build(candidate,derived){
 const stats=verifyDerived(candidate,derived);
 const rows=[],priorityTotals={P0:0,P1:0,P2:0};
 const reasonsTotal={};
 const kinds={};
 for(let i=0;i<derived.cards.length;i++){
  const d=derived.cards[i],old=candidate.cards[i];
  for(let j=0;j<d.events.length;j++){
   const e=d.events[j],src=old.events[j],reasons=new Set(),focus=[];
   let branchSensitive=false,hasUnresolved=false,hasHints=false,hasRange=false,hasExplicit=false;
   for(let k=0;k<e.choices.length;k++){
    const c=e.choices[k],raw=src.choices[k];
    if(c.structure==='explicit-result-headings'){
     hasExplicit=true;
     // Multiplicity and levels are compared; different outcomes cannot be merged.
     const signatures=c.results.map(r=>JSON.stringify(r.skillHints));
     if(new Set(signatures).size>1){reasons.add('OUTCOME_REWARD_DIFFERENCE');branchSensitive=true;}
     else reasons.add('EXPLICIT_RESULT_LABELS_REQUIRE_ROUTE_REVIEW');
    }
    if(c.results.some(r=>r.terminalObserved)){
     reasons.add('OBSERVED_CHAIN_TERMINATION');branchSensitive=true;
    }
    if(c.diagnostics.includes('RESULT_REQUIRES_PRIOR_CONTEXT')){
     reasons.add('PRIOR_RESULT_CONTEXT_UNVERIFIED');branchSensitive=true;
    }
    if(c.diagnostics.some(x=>['RESULT_LABELS_UNRESOLVED','SINGLE_RESULT_LABEL','REPEATED_RESULT_LABEL',
      'UNLABELED_HINT_BEFORE_RESULTS','UNLABELED_CONDITIONAL_PREAMBLE'].includes(x)))
     reasons.add('OUTCOME_LABEL_PARSING_GAP');
    if(c.diagnostics.includes('HINT_LEVEL_RANGE')){reasons.add('HINT_LEVEL_RANGE');hasRange=true;}
    if(raw.needsManualResultReview&&c.structure==='unspecified')
     reasons.add('SOURCE_CONDITIONAL_MARKER_UNRESOLVED');
    for(const result of c.results)for(const h of result.skillHints){
     hasHints=true;
     if(!h.skillId){hasUnresolved=true;reasons.add('SKILL_ID_UNRESOLVED');}
    }
    if(reasons.size)focus.push(c.ordinal);
   }
   if(!hasHints)reasons.add('NO_OBSERVED_SKILL_HINTS_NOT_PROOF_OF_ABSENCE');
   // The route graph has not been verified for any of these observed events.
   reasons.add('CHAIN_TOPOLOGY_UNVERIFIED');
   let priority=branchSensitive?'P0':hasUnresolved||hasRange||hasExplicit||
     reasons.has('OUTCOME_LABEL_PARSING_GAP')||reasons.has('SOURCE_CONDITIONAL_MARKER_UNRESOLVED')?'P1':'P2';
   const row={priority,cardId:d.cardId,sourceKey:e.sourceKey,
    sourceDigest:e.sourceDigest,sourceEventOrdinal:e.sourceEventOrdinal,
    flaggedChoiceOrdinals:focus,reasonCodes:[...reasons].sort(),
    requiresIndependentReview:true,productionApproval:false};
   rows.push(row);priorityTotals[priority]++;
   for(const reason of reasons)reasonsTotal[reason]=(reasonsTotal[reason]||0)+1;
   kinds[priority]=(kinds[priority]||0)+1;
  }
 }
 rows.sort((a,b)=>Number(a.priority.slice(1))-Number(b.priority.slice(1))||
   a.cardId.localeCompare(b.cardId)||a.sourceEventOrdinal-b.sourceEventOrdinal);
 if(rows.length!==stats.events||Object.values(priorityTotals).reduce((a,b)=>a+b,0)!==stats.events)
  throw Error('結果レビュー: イベント候補2,109件を優先分類できませんでした');
 return {schemaVersion:1,dataKind:'umasupport-result-review-queue',approval:'UNREVIEWED_NOT_FOR_PUBLICATION',
  forSkillGrant:false,sourcePins:derived.sourcePins,
  stats:{eventCandidates:stats.events,priorityTotals,reasonCounts:reasonsTotal},
  rows};
}
function verify(candidate,derived,stored){
 const expected=build(candidate,derived);
 if(JSON.stringify(expected)!==JSON.stringify(stored))throw Error('結果レビュー: 全件キューが保存された根拠DBと一致しません');
 return expected.stats;
}
module.exports={build,verify};
