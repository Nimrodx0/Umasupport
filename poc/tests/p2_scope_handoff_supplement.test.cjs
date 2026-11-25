'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const x=require('../src/p2_scope_handoff_supplement.cjs'),g4=require('../src/p2_g4_occurrence_disposition.cjs');
const occurrence=(type,andIndex)=>({invokeOffset:0,invokeIndex:1,sourceSide:'conditions',orIndex:0,andIndex,...g4.decision(type)});
test('same AND keeps excluded context, static and other dynamic evidence separate',()=>{
 const list=['track_id','weather','running_style','order_rate','near_count'].map(occurrence);
 const g=x.partition(list);
 a.equal(g.excludedResearch.length,2);a.equal(g.necessaryStatic.length,1);
 a.deepEqual(g.otherUnresolved.map(o=>o.type),['order_rate','near_count']);
 a(g.excludedResearch.every(o=>o.researchScope.assumeTrue===false));
 a.equal(Object.values(g).flat().length,list.length);
});
test('cannot silently exclude dynamic or axis conditions, or mark source truth',()=>{
 const o=occurrence('order_rate',0);o.researchScope=g4.researchScope('weather');
 a.throws(()=>x.partition([o]));
 const p=occurrence('weather',0);p.actualOmissionApplied=true;
 a.throws(()=>x.partition([p]));
 const q=occurrence('track_id',0);a.throws(()=>x.partition([q,q]));
});
