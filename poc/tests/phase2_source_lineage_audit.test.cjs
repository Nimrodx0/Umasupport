'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('../src/phase2_source_lineage_audit.cjs');
const copy=x=>structuredClone(x);
const e=(id,name)=>({id,name,type:'choice',choices:[
 {id:'choice-01',label:'選択肢1（仮）',rewards:[]}]});
const baseline=()=>({schemaVersion:1,cards:[
 {cardId:'30001',coverageStatus:'partial',events:[
  e('gt-30001-event-001','元見出しA'),e('gt-30001-event-002','元見出しB')]},
 {cardId:'30002',coverageStatus:'partial',events:[
  e('gt-30002-event-001','元見出しC')]}
]});
function history(){
 const base=baseline();
 const cross=copy(base);
 cross.cards[0].events[0].choices[0].rewards.push({skillId:'skill:4',level:1});
 cross.cards[0].events.push(e('usl:30001:random:1','独立編集A'));
 const chain=copy(cross);chain.cards[1].events.push(e('usl:30002:chain:1','独立編集B'));
 const secondCross=copy(chain);
 secondCross.cards[1].events[0].choices[0].terminal=true;
 const enrich=copy(secondCross);
 enrich.cards[0].events[1].choices[0].effects=[{kind:'bond',delta:5}];
 const display=copy(enrich);
 display.cards[0].events[1].choices[0].label='選択肢1（仮）';
 return {baseline:base,stages:[
  {name:'first-cross',category:'cross-source-editorial',catalog:cross},
  {name:'chain-cross',category:'cross-source-editorial',catalog:chain},
  {name:'second-cross',category:'cross-source-editorial',catalog:secondCross},
  {name:'numeric',category:'structured-source-enrichment',catalog:enrich},
  {name:'labels',category:'display-only',catalog:display}
 ],finalCatalog:display};
}
test('realistic synthetic stage history preserves distinct original, curated and cross-source GT sets',()=>{
 const i=history(),report=build(i,{strict:false});
 assert.equal(report.baselineGT,3);
 assert.equal(report.finalEvents,5);
 assert.equal(report.gtWithTrackedCrossSourceTouch,2);
 assert.equal(report.gtWithoutTrackedCrossSourceTouch,1);
 assert.equal(report.addedCuratedEvents,2);
 assert.equal(report.categories[0].added,1);
 assert.equal(report.categories[0].modified,1);
 assert.deepEqual(report.crossSourceGtExceptionIds,[
  {cardId:'30001',eventId:'gt-30001-event-001'},
  {cardId:'30002',eventId:'gt-30002-event-001'}
 ]);
 assert.equal(report.technicalGtSelector.excludedEventKeys.length,2);
 assert.equal(report.rightsOrTermsApproved,false);
 assert.equal(report.publishedEvents,0);
});
test('missing stages, silent deletes, unexpected added source and final SHA drift are rejected',()=>{
 const i=history();
 assert.throws(()=>build({...i,stages:[]},{strict:false}),/変換過程/);
 const erased=history();erased.stages[0].catalog.cards[0].events.shift();
 assert.throws(()=>build(erased,{strict:false}),/既存イベントが消えた/);
 const unexpected=history();unexpected.stages[0].catalog.cards[0].events.push(e('thirdparty:unknown','未知のイベント'));
 assert.throws(()=>build(unexpected,{strict:false}),/既存イベントが消えた|追加イベントの技術系列/);
 const drift=history();drift.finalCatalog=copy(drift.finalCatalog);
 drift.finalCatalog.cards[0].events[0].name='改変';
 assert.throws(()=>build(drift,{strict:false}),/最終データ/);
});
test('display-only transformations cannot quietly add a new event',()=>{
 const i=history();i.stages[i.stages.length-1].catalog.cards[0].events.push(
  e('usl:30001:random:2','仮称表示以外の追加'));
 assert.throws(()=>build(i,{strict:false}),/表示変更時に新しいイベント/);
});
