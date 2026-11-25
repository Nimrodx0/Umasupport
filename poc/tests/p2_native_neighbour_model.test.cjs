'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),m=require('../src/p2_native_neighbour_model.cjs');
const pack=xs=>xs.reduce((p,v)=>p*256+v,1);
test('native packet fields and missing previous rank',()=>{
 const q=m.unpack(pack([32,2,3,4,5,1]),pack([6,2,1,3,2,3]),9);
 a.equal(q.current,2);a.equal(q.previous,0);a.equal(q.values.is_overtake,1);a.equal(q.values.blocked_side_continuetime,3);a.equal(q.values.near_infront_count,2);
 a.throws(()=>m.unpack(0,0,9));
 a.throws(()=>m.unpack(pack([32,2,3,4,5,1]),pack([6,2,1,1,2,3]),9));
});
test('missing predicates stay unknown, exact operators retained',()=>{
 const ast={lookup:new Map([['a',{type:'blocked_side_continuetime',operator:'>=',value:2}],['b',{type:'is_overtake',operator:'==',value:1}],['c',{type:'hp_per',operator:'<=',value:30}]])};
 a.deepEqual(m.targetFacts(ast,{blocked_side_continuetime:2,is_overtake:0},1).map(x=>[x.type,x.satisfied]),[['blocked_side_continuetime',true],['is_overtake',false]]);
 a.deepEqual(m.targetFacts(ast,{},1),[]);
});
