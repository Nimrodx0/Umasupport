'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {parseEffect}=require('../src/checker_explicit_result_extract.cjs');
const hint=(skillId,level)=>({skillId,level});
test('multi-section success/failure retain distinct numeric levels and empty outcome',()=>{
 const e='大成功時：\n「架空A」のヒントLv+5\n成功時：\n「架空A」のヒントLv+1\n失敗時：\n体力+5';
 const x=parseEffect(e,{observedHints:[hint('1',5),hint('1',1)]});
 a.equal(x.structure,'explicit-result-headings');
 a.deepEqual(x.results.map(r=>r.resultKind),['great','success','failure']);
 a.deepEqual(x.results.map(r=>r.skillHints.map(h=>h.level)),[[5],[1],[]]);
 a.ok(!JSON.stringify(x).includes('架空A'));
});
test('explicit termination belongs to only affected outcome',()=>{
 const e='大成功時：\n「架空」のヒントLv+2\n※連続イベントが終了する\n成功時：\n「架空」のヒントLv+1';
 const x=parseEffect(e,{observedHints:[hint('3',2),hint('3',1)]});
 a.deepEqual(x.results.map(r=>r.terminalObserved),[true,false]);
});
test('unknown or one-label conditions are not filled by conjecture',()=>{
 const x=parseEffect('成功時：\n「架空」のヒントLv+1',
   {observedHints:[hint('7',1)]});
 a.equal(x.structure,'unspecified');
 a.equal(x.results[0].resultKind,'unspecified');
 a.ok(x.diagnostics.includes('SINGLE_RESULT_LABEL'));
 const y=parseEffect('1回目で上選択：\n「架空」のヒントLv+2',
   {observedHints:[hint('7',2)]});
 a.equal(y.structure,'unspecified');
});
test('range hints retain min/max rather than pretending single level',()=>{
 const x=parseEffect('成功時：\n「架空」のヒントLv+1~3\n失敗時：\n「他」のヒントLv+1',
   {observedHints:[hint('7',1),hint('8',1)]});
 a.equal(x.results[0].skillHints[0].levelMin,1);
 a.equal(x.results[0].skillHints[0].levelMax,3);
 a.ok(x.diagnostics.includes('HINT_LEVEL_RANGE'));
});
test('original hint count and level mismatch fail closed',()=>{
 a.throws(()=>parseEffect('成功時：\n「架空」のヒントLv+5',{observedHints:[]}),/候補/);
 a.throws(()=>parseEffect('成功時：\n「架空」のヒントLv+5',{observedHints:[hint('7',1)]}),/ヒントLv/);
});
test('unlabeled skill prior to result headings prevents misleading result assignment',()=>{
 const x=parseEffect('「架空」のヒントLv+1\n成功時：\n体力+2\n失敗時：\n体力+1',
   {observedHints:[hint('7',1)]});
 a.equal(x.structure,'unspecified');
 a.ok(x.diagnostics.includes('UNLABELED_HINT_BEFORE_RESULTS'));
});
test('never reproduce effects/choice titles in numeric output',()=>{
 const x=parseEffect('連続イベントが終了\n「架空の効果文」のヒントLv+1',
   {observedHints:[hint('7',1)]});
 a.equal(x.results[0].terminalObserved,true);
 a.ok(!JSON.stringify(x).includes('架空の効果文'));
});

test('both next-event-not-fired phrasings terminate the observed branch only',()=>{
 const x=parseEffect('成功時：\n体力+10\n失敗時：\n体力-5\n※次回イベントが発生しない',
  {observedHints:[]});
 a.equal(x.structure,'explicit-result-headings');
 a.deepEqual(x.results.map(r=>r.terminalObserved),[false,true]);
 a.ok(x.diagnostics.includes('NEXT_EVENT_NOT_FIRED_STATEMENT'));
 const y=parseEffect('体力+10\n※3連続目イベントが発生しない',
  {observedHints:[]});
 a.equal(y.results[0].terminalObserved,true);
 a.ok(y.diagnostics.includes('NEXT_EVENT_NOT_FIRED_STATEMENT'));
 const z=parseEffect('次回イベントが発生する\n体力+10',{observedHints:[]});
 a.equal(z.results[0].terminalObserved,false);
});
