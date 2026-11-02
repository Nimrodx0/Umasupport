'use strict';
/*
 * Transform the existing PRIVATE, normalized 2512-event inventory into a
 * NON-PUBLISHING worksheet for evidence-backed factual-reuse review.
 * This is deliberately NOT a v2 approval ledger. In particular, it omits
 * the `review` field; there is no affirmative rights claim to autofill.
 * Counts, exact source-bound digests and technical IDs only.
 */
const {inventory}=require('./event_release_cohorts.cjs');
const {indexPublished,canonical}=require('./event_release_gate.cjs');
const {project}=require('./phase2_title_choice_projection.cjs');
const {inspect}=require('./phase2_provenance_string_surface.cjs');
const policy=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('Phase2事実データ審査準備票: '+s);};
const key=x=>JSON.stringify([x.cardId,x.eventId]);
const only=(list,prefix,valid)=>{
 if(!Array.isArray(list)||!list.length)fail(prefix+': 例外情報が不足');
 const seen=new Set();
 for(const x of list){
  if(typeof x?.cardId!=='string'||typeof x?.eventId!=='string'||
     !x.eventId.startsWith(prefix)||!valid.has(key(x))||seen.has(key(x)))
   fail(prefix+': 例外が未登録・重複・ID系列不一致');
  seen.add(key(x));
 }
 return seen;
};
function worksheet({catalog,lineage},{strict=false}={}){
 if(!catalog||!lineage||!Array.isArray(lineage.crossSourceGtExceptionIds)||
    !Array.isArray(lineage.curatedOnlyEventIds))
  fail('最終候補と編集系譜が必要');
 if(canonical(project(catalog).catalog)!==canonical(catalog))
  fail('原文の残る候補では審査準備できません');
 const exposure=inspect({catalog},{strict});
 const records=indexPublished(catalog);
 const cross=only(lineage.crossSourceGtExceptionIds,'gt-',records);
 const curated=only(lineage.curatedOnlyEventIds,'usl:',records);
 if([...cross].some(k=>curated.has(k)))fail('編集元分類が重複');
 // The existing V2 selectors CANNOT isolate one arbitrary event within a
 // card by its exact ID. Reserve that GT-with-GameWith exception for V1.
 const gtSelector={
  eventIdPrefix:'gt-',excludedEventKeys:lineage.crossSourceGtExceptionIds
 };
 const editorialSelector={eventIdPrefix:'usl:'};
 const partition=inventory(catalog,[gtSelector,editorialSelector]);
 if(partition.uncovered!==cross.size||
    partition.groups[1].events!==curated.size||
    [...curated].some(k=>!partition.matchedKeys.has(k))||
    [...cross].some(k=>partition.matchedKeys.has(k)))
  fail('レビュー対象が他の系列へ混入、または未分類');
 if(strict&&(records.size!==2512||partition.groups[0].events!==2487||
    curated.size!==24||cross.size!==1))
  fail('実固定母集団の審査単位を変更できません');
 // Public URLs are not included as 'approved evidence': reviewers must
 // decide whether each actually supports the relevant claim.
 const pending=['sourceAccessTerms','databaseReuse','gameMaterialAndTitles','choiceWording'];
 return {
  schemaVersion:1,
  dataKind:'technical-review-worksheet-not-a-v2-approval-ledger',
  status:'UNREVIEWED_FACTUAL_REUSE_WORKSHEET',
  versionPinned:policy.baselineRevision,
  sourceType:policy.baselineSource,
  totalEvents:records.size,
  cohorts:[
   {
    id:'gt-derived-without-tracked-cross-source-edit',
    selector:gtSelector,
    expectedEvents:partition.groups[0].events,
    eventsSha256:partition.groups[0].eventsSha256,
    sourceClassification:'same-pinned-GT-technical-family',
    rightsAssessment:'pending-human-evidence-review',
    sourceAccessMethod:'fixed-public-GitHub-snapshot-not-a-license',
    outstandingChecks:pending
   },
   {
    id:'editorial-additions-not-a-unified-rights-cohort',
    selector:editorialSelector,
    expectedEvents:partition.groups[1].events,
    eventsSha256:partition.groups[1].eventsSha256,
    sourceClassification:'mixed-cross-source-additions',
    rightsAssessment:'must-partition-by-source-before-approval',
    sourceAccessMethod:'source-method-not-proven-as-uniform',
    outstandingChecks:pending
   }
  ],
  individualExceptionReviewsPending:lineage.crossSourceGtExceptionIds.map(x=>({
   cardId:x.cardId,eventId:x.eventId,
   reason:'derived-GT-event-with-cross-source-editorial-override',
   rightsAssessment:'pending-separate-review'
  })),
  remainingUnknownEventKeys:partition.uncovered-cross.size,
  surfaceSummary:{
   retainedEventTitles:exposure.counts.titles,
   sourceProseOrUnclassifiedStrings:exposure.counts.unknownStringLeaves,
   technicalSourceOrdinalEventIds:exposure.counts.sourceOrdinalEventIds,
   optionAndResultLabelsIndependent:true
  },
  checks:{
   noPublicEventRecordsAdded:true,
   noApprovalRecordsGenerated:true,
   noLicenseOrTermsDetermination:true,
   noSourceNarrativeIncluded:true,
   usableAsV2ApprovalLedger:false
  }
 };
}
module.exports={worksheet};
