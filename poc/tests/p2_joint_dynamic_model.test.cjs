'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{interval,compare}=require('../src/p2_joint_dynamic_model.cjs');
test('unknown outcome bounds and unequal denominators are not point estimates',()=>{
 const x={true:2,false:3,unknown:5},y={true:1,false:3,unknown:0};
 a.deepEqual(interval(x),[.2,.7]);a.equal(compare(x,y),'overlap-or-uncertain');
 a.equal(compare({true:8,false:2,unknown:0},y),'left-separated');
 a.equal(compare(y,{true:2,false:6,unknown:0}),'exact-tie-in-sample');
 a.equal(compare({true:0,false:0,unknown:1},y),'overlap-or-uncertain');
});
