'use strict';
/*
 * Explicitly user-authorized first publication: GT-derived 2487 events only.
 * Never use a GT-ID prefix alone as proof of an admissible source: the exact
 * lineage exception and snapshot-bound SHA must match the signed v2 ledger.
 * Accepts only the preexisting full 2512 private candidate and discards 25
 * excluded records BEFORE validation and delivery.
 */
const {project}=require('./phase2_title_choice_projection.cjs');
const {worksheet}=require('./phase2_factual_review_worksheet.cjs');
const {inventory}=require('./event_release_cohorts.cjs');
const {canonical}=require('./event_release_gate.cjs');
const {prepare}=require('./approved_event_release_build.cjs');
const review=require('../config/event-release-approvals.gt2487.v2.json');
const SOURCE_SHA='9cfb7f3241c1c94250605ef418260eef4080404debcfeea46738ba24bc756d2e';
const EXCEPTION_KEY=JSON.stringify(['30080','gt-30080-event-006']);
const fail=s=>{throw Error('GT 2487公開準備: '+s);};
function filterApproved(normalized,selector){
 if(!normalized||!Array.isArray(normalized.cards)||
    selector?.eventIdPrefix!=='gt-'||
    !Array.isArray(selector.excludedEventKeys))fail('公開用選択範囲が不正');
 const excluded=new Set(selector.excludedEventKeys.map(x=>
  JSON.stringify([x.cardId,x.eventId])));
 const matched=new Set();
 const selected={schemaVersion:1,cards:normalized.cards.map(c=>({
  cardId:c.cardId,coverageStatus:'partial',
  events:c.events.filter(e=>{
   const key=JSON.stringify([c.cardId,e.id]);
   if(excluded.has(key)){matched.add(key);return false;}
   return e.id.startsWith('gt-');
  })
 })).filter(c=>c.events.length)};
 if(matched.size!==excluded.size)fail('保留対象のイベントIDが候補に存在しません');
 const available=new Set(selected.cards.flatMap(c=>c.events.map(e=>
  JSON.stringify([c.cardId,e.id]))));
 // Prevent dangling dependencies in event and any nested choice/result stage.
 function check(value,cardId){
  if(Array.isArray(value)){for(const x of value)check(x,cardId);return;}
  if(!value||typeof value!=='object')return;
  if(value.requires!==undefined)check(value.requires,cardId);
  if(typeof value.eventId==='string'&&
     !available.has(JSON.stringify([cardId,value.eventId])))
   fail('除外イベントを参照する先行条件が残るため公開できません');
  for(const [k,v] of Object.entries(value))
   if(k!=='requires')check(v,cardId);
 }
 for(const c of selected.cards)for(const e of c.events)check(e,c.cardId);
 return selected;
}

function select({catalog,lineage},{strict=true}={}){
 if(!catalog||!lineage)fail('固定2512候補・系譜が不足');
 // Wording is removed before any record can reach a writable output.
 const normalized=project(catalog).catalog;
 const work=worksheet({catalog:normalized,lineage},{strict});
 if(strict&&(work.totalEvents!==2512||
    work.cohorts[0]?.expectedEvents!==2487||
    work.cohorts[0].eventsSha256!==SOURCE_SHA||
    work.individualExceptionReviewsPending.length!==1||
    JSON.stringify([work.individualExceptionReviewsPending[0].cardId,
      work.individualExceptionReviewsPending[0].eventId])!==EXCEPTION_KEY))
  fail('元出典の2487単位を再確認する必要があります');
 const cohort=work.cohorts[0];
 if(review.schemaVersion!==2||review.cohorts.length!==1||
    review.entries.length!==0||
    canonical(review.cohorts[0].selector)!==canonical({eventIdPrefix:'gt-'})||
    review.cohorts[0].eventsSha256!==cohort.eventsSha256||
    review.cohorts[0].expectedEvents!==cohort.expectedEvents)
  fail('ユーザーの公開承認対象と実候補集合の範囲・内容SHAが異なる');
 const selected=filterApproved(normalized,cohort.selector);
 const n=selected.cards.reduce((x,c)=>x+c.events.length,0);
 if(n!==2487)fail('公開対象件数・GT系統が不正');
 const checked=inventory(selected,[{eventIdPrefix:'gt-'}]);
 if(checked.uncovered!==0||checked.groups[0]?.events!==2487||
    checked.groups[0].eventsSha256!==cohort.eventsSha256)
  fail('除外した25件が公開候補へ混入またはイベントSHAが変化');
 return {catalog:selected,
  summary:{sourceEvents:work.totalEvents,selectedEvents:n,excludedEvents:25,
   cards:selected.cards.length,cohortSha256:checked.groups[0].eventsSha256,
   unresolvedReferences:0,rightsApprovedByAlgorithm:false}};
}
function build({catalog,lineage,model,skillText},{strict=true}={}){
 const selected=select({catalog,lineage},{strict});
 // Existing review compiler independently verifies all 10 human-reviewed
 // evidence categories plus runtime numeric skill/branch validations.
 const release=prepare({candidate:selected.catalog,approvals:review,model,skillText});
 if(release.report.events!==2487||
    release.report.reviewedCohorts!==1||
    canonical(release.catalog)!==canonical(selected.catalog))
  fail('既存一括出版器と最終データが異なる');
 return {catalog:release.catalog,
  report:{...selected.summary,...release.report,excludedEditorEvents:24,
   excludedCrossSourceGTEvents:1,publicationMode:'owner-authorized-gt-factual-only'}};
}
module.exports={filterApproved,select,build};
