'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{classifyRoute}=require('../src/p2_limited_study_screen.cjs');
const p=(type,operator='==',value=1)=>({type,operator,value});
const route={conditionOrIndex:0,preconditionOrIndex:null},approved=new Set(['phase_random']);
test('elapsed time lower bound alone differs from a time-position or time-rank conjunction',()=>{
 const run=terms=>classifyRoute({conditions:[terms]},route,'accumulatetime',approved);
 a.equal(run([p('accumulatetime','>=',5)]).timeOnlyLowerBound,true);
 a.equal(run([p('accumulatetime','<=',5)]).timeOnlyLowerBound,false);
 a.equal(run([p('accumulatetime','>=',5),p('phase_random')]).disposition,'bounded-source-state-and-window-candidate');
 a.equal(run([p('accumulatetime','>=',5),p('order_rate')]).disposition,'needs-other-state-before-study');
});
test('preconditions remain held even when their type is approved for standalone research exclusion',()=>{
 const x=classifyRoute({conditions:[[p('is_lastspurt')]],preConditions:[[p('phase_random')]]},{...route,preconditionOrIndex:0},'is_lastspurt',approved);
 a.equal(x.disposition,'history-first');
});
