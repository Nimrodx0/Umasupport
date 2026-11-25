'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {classify,windowCells,dynamicCells}=require('../src/p3_combined_style_superiority.cjs');
const cell=(xs)=>xs.map(x=>({lo:x,hi:x,D:x}));
test('D058 two criteria complement one another, not a top equivalence group',()=>{
 const q=x=>classify([cell(x)]);
 a.deepEqual(q([38,58,72,76]),{state:'targeted',styles:[2,3,4],individual:[3,4],group:[2,3,4]});
 a.deepEqual(q([10,20,60,90]).styles,[3,4]);
 a.deepEqual(q([30,39,48,57]),{state:'targeted',styles:[4],individual:[4],group:[]});
 a.equal(q([50,53,55,58]).state,'within-margin-only');
});
test('10pt is strict, context reversal and unknown bounds prevent promotion',()=>{
 a.equal(classify([cell([20,20,30,30])]).state,'within-margin-only');
 a.deepEqual(classify([cell([10,20,60,90]),cell([90,60,20,10])]).styles,[]);
 a.deepEqual(classify([[{lo:0,hi:100},{lo:0,hi:100},{lo:20,hi:90},{lo:20,hi:100}]]).styles,[]);
 a.deepEqual(classify([[{lo:0,hi:0,D:90},{lo:0,hi:0,D:80},{lo:90,hi:90,D:0},{lo:90,hi:90,D:0}]]).styles,[]);
});
test('exact paired averages, not pooled or independently selected extremes',()=>{
 const q=classify([cell([35,0,80,100]),cell([0,35,80,100])]);
 a.deepEqual(q.styles,[3,4]);
});
