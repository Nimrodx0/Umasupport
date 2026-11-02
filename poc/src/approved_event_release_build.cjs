'use strict';
/*
 * Phase2 final event publication candidate boundary.
 *
 * No source prose or third-party catalog is shipped by this code. The caller
 * supplies an in-memory/private candidate, explicit review ledger and a
 * verified source-card/skill model. This stage returns only a normalized
 * candidate AFTER: strict prose allowlist, provisional option/result labels,
 * exact-content rights/factual release reviews, and the production loader
 * preflight. It does not determine legal permission automatically.
 */
const crypto=require('node:crypto');
const {project}=require('./phase2_title_choice_projection.cjs');
const {verifyRelease,canonical,indexPublished}=require('./event_release_gate.cjs');
const publicLoader=require('./public_event_catalog.js');
const hash=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex');
const fail=m=>{throw Error('承認済みイベント一括出版: '+m);};
// Publication is monotonic by default: a newly approved batch may add
// records but must never silently delete, relocate or rewrite a record that
// has already been served to users. Corrections require a separately designed,
// explicit replacement review process, not merely a fresh batch ledger.
function assertRetainsPublished(previous,next){
 const old=indexPublished(previous),current=indexPublished(next);
 for(const [key,oldSha] of old){
  if(!current.has(key))fail('既存公開イベントの削除・カード移動を拒否: '+key);
  if(current.get(key)!==oldSha)fail('既存公開イベントの無断変更を拒否: '+key);
 }
 return {priorEvents:old.size,addedEvents:current.size-old.size};
}
function prepare({candidate,approvals,model,skillText}){
 if(!candidate||!approvals||!model?.cardById||!model?.skillById||
   typeof skillText!=='string'||!skillText)
  fail('候補・公開承認台帳・元サポカ／スキル辞書の入力が不足');
 // Only the already accepted name/positional-placeholder shape may leave
 // this stage. Projecting strips any source option/result strings, while
 // unknown free-text event fields are rejected rather than copied.
 const normalized=project(candidate);
 const catalog=normalized.catalog;
 // A hash-bound review must correspond to the final NORMALIZED version,
 // not the unredacted upstream candidate with original option wording.
 const release=verifyRelease(catalog,approvals);
 const checked=publicLoader.preflight(model,catalog,{skillText,fullRegistry:false});
 if(checked.summary.eventsWithRecords!==release.publicEvents||
   checked.summary.cardsWithRecords!==release.publicCards)
  fail('出版審査と実スキーマのカード・イベント数が不一致');
 const stable=project(catalog);
 if(canonical(stable.catalog)!==canonical(catalog)||
    stable.counts.events!==normalized.counts.events||
    stable.counts.choices!==normalized.counts.choices||
    stable.counts.outcomes!==normalized.counts.outcomes)
  fail('仮称化した表示・イベントIDが再変換で変化');
 return {
  catalog,
  report:{
   status:'APPROVED_CATALOG_PREPARED_FOR_SAME_ORIGIN',
   cards:release.publicCards,
   events:release.publicEvents,
   choices:normalized.counts.choices,
   outcomes:normalized.counts.outcomes,
   titlesPreserved:normalized.counts.titlesPreserved,
   reviewedCohorts:release.reviewedCohorts||0,
   reviewedIndividualExceptions:release.reviewedIndividualExceptions||
     (approvals.schemaVersion===1?release.reviewedEvents:0),
   catalogSha256:hash(catalog),
   // These booleans report mechanisms, not a statement of legal findings.
   technicalPreflightPassed:true,
   exactApprovalLedgerPassed:true,
   noSourceChoiceProseInOutput:true
  }
 };
}
module.exports={prepare,assertRetainsPublished};
