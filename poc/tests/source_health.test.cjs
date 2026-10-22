'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const health=require('../src/source_health.js');

const c=(id,complete=true)=>({id,events:[],hintsByStage:complete?{
 '0':['hint:a'],'1':['hint:a'],'2':['hint:a'],'3':['hint:a'],'4':['hint:a']
 }:{'0':['hint:a']},
 hintPerformanceByStage:complete?Object.fromEntries(Array.from({length:5},(_,i)=>[
  String(i),{levelBase:i,levelUnique:0,frequencyBase:10,frequencyUnique:0}])):{'4':{}}
});
const model=()=>({
 cards:[c('30241'),c('30242',false)],
 skills:[{id:'hint:a',name:'仮名',tier:'unknown'}],
 meta:{sourceUrl:'https://example.org/support_card.txt',dataMode:'online',
  fetchedAt:'2026-10-18T01:00:00Z',checkedAt:'2026-10-18T01:00:00Z',
  totalHints:2,reviewedEventRecords:0,reviewedEventCards:0,eventStatus:'reviewed-empty',
  runtimeSources:{
   cards:{mode:'online',url:'https://example.org/support_card.txt',fetchedAt:'2026-10-18T01:00:00Z'},
   skills:{mode:'online',url:'https://example.org/skill_data.txt',fetchedAt:'2026-10-18T01:00:01Z'},
   events:{mode:'reviewed',url:'./data/reviewed_events.v1.json'}}
 }
});
test('validated empty event JSON has a definite zero and independent stage completeness',()=>{
 const r=health.summarize(model());
 assert.equal(r.cards.count,2);
 assert.equal(r.cards.stageComplete,1);
 assert.equal(r.cards.hintPerformanceComplete,1);
 assert.equal(r.cards.hints4,2);
 assert.equal(r.events.mode,'reviewed');
 assert.equal(r.events.records,0);
 assert.equal(r.events.cards,0);
 assert.equal(r.events.label,'公開JSONの検証成功');
 assert.equal(r.skills.mode,'online');
 assert.match(r.disclaimer,/更新日/);
});
test('failed event JSON is unknown even if an empty fallback was attached',()=>{
 const m=model();m.meta.runtimeSources.events.mode='failed';
 m.meta.eventStatus='reviewed-empty'; // Simulate the old accidental fallback label.
 const r=health.summarize(m);
 assert.equal(r.events.mode,'failed');
 assert.equal(r.events.records,null);
 assert.equal(r.events.cards,null);
 assert.equal(r.events.label,'公開JSONの検証失敗・未反映');
 assert.equal(r.events.attachedRecords,0);
});
test('cached source keeps original fetched timestamp and different last check',()=>{
 const m=model();
 m.meta.runtimeSources.cards={mode:'cached',url:'https://example.org/support_card.txt',
  fetchedAt:'2026-10-10T01:00:00Z',checkedAt:'2026-10-18T01:00:00Z'};
 m.meta.runtimeSources.skills={mode:'cached',fetchedAt:'2026-10-11T01:00:00Z'};
 const r=health.summarize(m);
 assert.equal(r.cards.label,'保存済み検証データを利用');
 assert.equal(r.cards.fetchedAt,'2026-10-10T01:00:00Z');
 assert.equal(r.cards.checkedAt,'2026-10-18T01:00:00Z');
 assert.equal(r.skills.mode,'cached');
 assert.notEqual(r.cards.fetchedAt,r.cards.checkedAt);
});
test('failed skill source does not claim numerical hierarchy verification',()=>{
 const m=model();m.meta.runtimeSources.skills={mode:'unavailable'};
 m.skills=m.skills.slice(0,1);
 const r=health.summarize(m);
 assert.equal(r.skills.hierarchyPairs,null);
 assert.equal(r.skills.label,'取得できず・未適用');
});
test('stage and performance completeness require all five verified-shaped records',()=>{
 const m=model();m.cards[0].hintPerformanceByStage['2'].frequencyBase='10';
 m.cards[1].hintPerformanceByStage=null;
 const r=health.summarize(m);
 assert.equal(r.cards.stageComplete,1);
 assert.equal(r.cards.hintPerformanceComplete,0);
 assert.equal(health.hintStageComplete(null),false);
 assert.equal(health.perfStageComplete({hintPerformanceByStage:[]}),false);
});
test('invalid model cannot silently become empty verified data',()=>{
 assert.throws(()=>health.summarize({cards:[]}),/表示用データ/);
 assert.equal(health.modeLabel('impossible'),'取得状態不明');
 assert.equal(health.modeLabel('impossible','event'),'検証状況不明');
});

test('verified cached event source is counted, not confused with an unavailable empty catalog',()=>{
 const m=model();
 m.meta.runtimeSources.events={mode:'cached',url:'./data/reviewed_events.v1.json',
  fetchedAt:'2026-10-19T02:00:00Z',checkedAt:'2026-10-22T02:00:00Z'};
 m.meta.reviewedEventRecords=1;m.meta.reviewedEventCards=1;
 const r=health.summarize(m);
 assert.equal(r.events.mode,'cached');
 assert.equal(r.events.records,1);
 assert.equal(r.events.cards,1);
 assert.match(r.events.label,/保存済みの検証済み公開イベントJSON/);
 assert.equal(r.events.fetchedAt,'2026-10-19T02:00:00Z');
 assert.equal(r.events.checkedAt,'2026-10-22T02:00:00Z');
});
