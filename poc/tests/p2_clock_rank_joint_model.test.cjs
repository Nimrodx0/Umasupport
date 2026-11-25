'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),m=require('../src/p2_clock_rank_joint_model.cjs');
const ast={lookup:new Map([['time',{type:'accumulatetime',operator:'>=',value:5}],['rank',{type:'change_order_onetime',operator:'<',value:0}]])};
test('clock and signed rank are added separately; unknown previous rank is not zero',()=>{
 a.deepEqual(m.targetFacts(ast,5,-1,0),[]);
 a.deepEqual(m.targetFacts(ast,5,-1,1).map(x=>[x.type,x.satisfied]),[['accumulatetime',true]]);
 a.deepEqual(m.targetFacts(ast,4,-1,2).map(x=>[x.type,x.satisfied]),[['accumulatetime',false],['change_order_onetime',true]]);
 a.deepEqual(m.targetFacts(ast,5,null,2).map(x=>x.type),['accumulatetime']);
});
