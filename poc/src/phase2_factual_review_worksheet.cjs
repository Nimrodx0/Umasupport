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
 // An exact event can be a V1 exception. The broader eventIdPrefix
 // cohort intentionally excludes it. Editorial additions must be grouped
 // by the ACTUAL step that added them, not one fictitious shared license.
 if(!Array.isArray(lineage.categories))fail('編集追加の出典工程が不足');
 const gtSelector={eventIdPrefix:'gt-',
  excludedEventKeys:lineage.crossSourceGtExceptionIds};
 const claimed=new Set(),editorial=[];
 for(const stage of lineage.categories){
  if(stage.category!=='cross-source-editorial')continue;
  if(!Array.isArray(stage.changedEventIds))fail('出典補正の変更一覧が欠落');
  const ids=stage.changedEventIds.filter(x=>x?.eventId?.startsWith('usl:'));
  if(!ids.length)continue;
  const unique=new Set();
  for(const row of ids){
   const k=key(row);
   if(!curated.has(k)||claimed.has(k)||unique.has(k))
    fail('編集追加が別工程と重複または既知対象外');
   unique.add(k);claimed.add(k);
  }
  const excluded=lineage.curatedOnlyEventIds.filter(x=>!unique.has(key(x)));
  editorial.push({
   stage:stage.name,
   selector:{eventIdPrefix:'usl:',
    ...(excluded.length?{excludedEventKeys:excluded}:{})},
   events:unique.size
  });
 }
 if(editorial.length===0||claimed.size!==curated.size)
  fail('編集追加24件の各取得工程が網羅されていない');
 const partition=inventory(catalog,
  [gtSelector,...editorial.map(x=>x.selector)]);
 if(partition.uncovered!==cross.size||
    partition.groups[0].events+editorial.reduce((n,x)=>n+x.events,0)+
       cross.size!==records.size||
    editorial.some((x,i)=>partition.groups[i+1].events!==x.events)||
    [...curated].some(k=>!partition.matchedKeys.has(k))||
    [...cross].some(k=>partition.matchedKeys.has(k)))
  fail('レビュー対象が他の系列へ混入、または未分類');
 if(strict&&(records.size!==2512||partition.groups[0].events!==2487||
    curated.size!==24||cross.size!==1||
    editorial.length!==3||
    editorial.map(x=>x.events).join(',')!=='8,15,1'))
  fail('実固定母集団の審査単位を変更できません');
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
   ...editorial.map((group,i)=>({
    id:'editorial-step-'+String(i+1),
    sourceTransformStep:group.stage,
    selector:group.selector,
    expectedEvents:partition.groups[i+1].events,
    eventsSha256:partition.groups[i+1].eventsSha256,
    sourceClassification:'same-editorial-step-not-a-license-cohort',
    rightsAssessment:'source-method-must-be-confirmed-before-approval',
    sourceAccessMethod:'individual-step-upstream-terms-unverified',
    outstandingChecks:pending
   }))
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
