'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {fingerprint,sourceEvents,pairEvents}=require('../tools/build_whole_event_index.cjs');
const c=(title,sourceKey,optionCount=1,ordinal=1)=>({
 sourceKey,sourceIndex:ordinal-1,optionCount,
 strict:fingerprint(title),soft:fingerprint(title,true)
});
const g=(title,sourceOrdinal=1,section='arrows',choiceCount=1)=>({
 sourceOrdinal,section,choiceCount,
 strict:fingerprint(title),soft:fingerprint(title,true)
});
test('NFKC exact Japanese names and typographic fallback are kept distinct',()=>{
 assert.equal(fingerprint('  あＢ　C  '),fingerprint('あB C'));
 assert.notEqual(fingerprint('！あ、'),fingerprint('あ'));
 assert.equal(fingerprint('！あ、',true),fingerprint('あ',true));
});
test('strict same-name matching is one-to-one, with source ordinals retained',()=>{
 const linked=pairEvents([c('普通の努力','a'),c('連続！２','b',2,2)],
   [g('連続！２',1,'arrows',2),g('普通の努力',2,'random',1)]);
 assert.deepEqual(linked.selected.map(x=>[x.ci,x.gi,x.status]),
   [[0,1,'exact-name-provisional'],[1,0,'exact-name-provisional']]);
 assert.deepEqual(linked.unmatchedC,[]);
 assert.deepEqual(linked.unmatchedG,[]);
});
test('only unique and previously-unmatched events may become typography candidates',()=>{
 const linked=pairEvents([c('第一章！','a'),c('第二章','b')],
   [g('第一章'),g('第二章?')]);
 assert.equal(linked.selected.length,2);
 assert(linked.selected.every(x=>x.status==='typography-provisional'));
});
test('duplicated titles stay unresolved, even if the other side has one matching name',()=>{
 const a=pairEvents([c('同名','a'),c('同名','b')],[g('同名')]);
 assert.equal(a.selected.length,0);
 assert.deepEqual(a.unmatchedC,[0,1]);
 assert.deepEqual(a.unmatchedG,[0]);
});
test('source language prioritizes JA; chain and random are counted separately',()=>{
 const got=sourceEvents({id:30001,kind:'support',events:{hello:{name:'English name',section:'arrows',choices:[]}},
  events_ja:{one:{name:'イベントＡ',id:21,section:'random',choices:[{}]},
    two:{name:'イベントＢ',id:22,section:'arrows',choices:[{},{}]},
    three:{name:'イベントＣ',id:23,section:'arrows',choices:[{}]}}});
 assert.equal(got.language,'ja');
 assert.equal(got.events.length,3);
 assert.deepEqual(got.events.map(e=>e.chainOrdinal),[null,1,2]);
 assert.deepEqual(got.events.map(e=>e.sourceLocalEventId),[21,22,23]);
 assert.deepEqual(got.events.map(e=>e.choiceCount),[1,2,1]);
});
test('fallback English does not get silently claimed as matched Japanese',()=>{
 const got=sourceEvents({id:30001,kind:'support',events:{one:{name:'English name',section:'arrows',choices:[{}]}}});
 assert.equal(got.language,'fallback');
 const match=pairEvents([c('日本語タイトル','a')],got.events);
 assert.deepEqual(match.unmatchedC,[0]);
 assert.deepEqual(match.unmatchedG,[0]);
});
test('invalid GameTora event shape is rejected',()=>{
 assert.throws(()=>sourceEvents({id:30001,events_ja:{bad:{name:'X'}}}),/malformed/);
 assert.throws(()=>sourceEvents({id:30001,events_ja:{},events:null}),/missing/);
});
