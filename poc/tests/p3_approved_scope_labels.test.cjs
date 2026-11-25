'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{resolve,approvedStyles}=require('../src/p3_approved_scope_labels.cjs');
test('limited targeted label never becomes global, dirt or missing context',()=>{
 const row={label:{state:'targeted',styles:[2],scope:{kind:'rank-window-fixed-model',branches:[{distanceType:2,courseIds:[10502]}]}}};
 const ctx={courseId:10502,distance_type:2,ground_type:1,ground_condition:1,fieldSize:9,scenario:'balanced'};
 a.equal(resolve(row,ctx).state,'targeted');a.equal(resolve(row).state,'undetermined');a.equal(resolve(row,{...ctx,ground_type:2}).state,'undetermined');a.equal(resolve(row,{...ctx,scenario:'backHeavy'}).state,'undetermined');
 a.equal(resolve(row,{...ctx,courseId:10504}).state,'undetermined');
});
test('general maintains independent static context; single style and unknown are not invented',()=>{
 const ctx={distance_type:3,ground_type:1,ground_condition:1};
 const r={label:{state:'general',styles:[],scope:{kind:'source-logic',contexts:[ctx]}}};
 a.equal(resolve(r).state,'general');a.equal(resolve(r,ctx).state,'general');a.equal(resolve(r,{...ctx,distance_type:2}).state,'undetermined');
 a.throws(()=>approvedStyles([1,2,3,4]));a.throws(()=>approvedStyles([1,1]));a.deepEqual(approvedStyles([3,2]),[2,3]);
});
