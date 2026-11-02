'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {project}=require('../src/phase2_title_choice_projection.cjs');
const {worksheet}=require('../src/phase2_factual_review_worksheet.cjs');
const {inventory}=require('../src/event_release_cohorts.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
function sample(){
 const raw={schemaVersion:1,cards:[{
  cardId:'30080',coverageStatus:'partial',events:[
   {id:'gt-30080-event-001',name:'架空のイベントA',type:'choice',
    choices:[{id:'choice-01',label:'架空の台詞',
     rewards:[{skillId:'skill:1',verifiedSkillName:'架空のヒント',level:2}]}]},
   {id:'gt-30080-event-002',name:'架空のイベントB',type:'auto',rewards:[]},
   {id:'usl:30080:curated:001',name:'独自仮イベント',type:'auto',
    rewards:[],requires:{all:[{eventId:'gt-30080-event-002'}]}}
  ]
 }]};
 const lineage={
  crossSourceGtExceptionIds:[{cardId:'30080',eventId:'gt-30080-event-001'}],
  curatedOnlyEventIds:[{cardId:'30080',eventId:'usl:30080:curated:001'}]
 };
 return {catalog:project(raw).catalog,lineage};
}
test('creates exact source batches for technical review, never a rights/approval ledger',()=>{
 const data=sample(),before=JSON.stringify(data);
 const w=worksheet(data);
 assert.equal(w.totalEvents,3);
 assert.equal(w.cohorts.length,2);
 assert.equal(w.cohorts[0].expectedEvents,1);
 assert.equal(w.cohorts[1].expectedEvents,1);
 assert.equal(w.individualExceptionReviewsPending.length,1);
 assert.equal(w.remainingUnknownEventKeys,0);
 assert.equal(w.checks.noApprovalRecordsGenerated,true);
 assert.equal(w.checks.usableAsV2ApprovalLedger,false);
 assert.equal(w.cohorts[1].rightsAssessment,'must-partition-by-source-before-approval');
 assert.equal(Object.hasOwn(w.cohorts[0],'review'),false);
 assert.equal(w.cohorts[0].eventsSha256,
   inventory(data.catalog,[w.cohorts[0].selector]).groups[0].eventsSha256);
 assert.throws(()=>verifyRelease(data.catalog,w),/レビュー証跡/);
 assert.throws(()=>verifyRelease(data.catalog,{
  schemaVersion:2,cohorts:w.cohorts,entries:[]}),/未定義フィールド|出典・権利|審査者/);
 assert.equal(JSON.stringify(data),before);
 for(const phrase of ['架空のイベントA','架空のヒント','架空の台詞'])
  assert.equal(JSON.stringify(w).includes(phrase),false);
});
test('event content mutation changes worksheet digest even with stable event IDs',()=>{
 const data=sample(),a=worksheet(data);
 const mutated=sample();mutated.catalog.cards[0].events[1].terminal=true;
 const b=worksheet(mutated);
 assert.notEqual(a.cohorts[0].eventsSha256,b.cohorts[0].eventsSha256);
});
test('source exception cannot be silently omitted, duplicated, or conflated',()=>{
 const data=sample();
 data.lineage.crossSourceGtExceptionIds=[];
 assert.throws(()=>worksheet(data),/例外情報が不足/);
 const duplicated=sample();
 duplicated.lineage.curatedOnlyEventIds.push(
  duplicated.lineage.curatedOnlyEventIds[0]);
 assert.throws(()=>worksheet(duplicated),/重複/);
 const wrong=sample();
 wrong.lineage.curatedOnlyEventIds=[{cardId:'30080',
  eventId:'gt-30080-event-002'}];
 assert.throws(()=>worksheet(wrong),/ID系列不一致/);
});
test('unredacted original choice wording is refused and strict gate requires real full count',()=>{
 const data=sample();
 data.catalog.cards[0].events[0].choices[0].label='元サイト選択肢の文章';
 assert.throws(()=>worksheet(data),/原文の残る候補/);
 assert.throws(()=>worksheet(sample(),{strict:true}),/固定2512件|固定母集団/);
});
