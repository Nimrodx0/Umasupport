'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{screen}=require('../src/p3_dynamic_scope_screen.cjs');
const row=(style,t,mask)=>({style,courseId:10502,fieldSize:9,scenario:'balanced',groundStateNecessaryMask:mask,counts:[null,null,null,{true:t,false:100-t,unknown:0}]});
const panel=(values,mask=15)=>Array.from({length:4},()=>values.map((v,i)=>row(i+1,v,mask)));
test('exclude only all-zero contexts, not partially eligible ones',()=>{
 const cells=[...panel([90,90,30,50]),...panel([0,0,0,0],0)];
 a.deepEqual(screen(cells,10).styles,[1,2]);
 a.equal(screen(cells,10).evaluatedContexts.length,4);
 cells[4][0].groundStateNecessaryMask=15;
 a.equal(screen(cells,10).state,'scope-held');
});
test('lower styles can differ; any eligible-context reversal holds',()=>{
 const cells=[...panel([90,90,30,50]),...panel([90,90,30,50])];
 a.deepEqual(screen(cells,10).styles,[1,2]);
 cells[7][0].counts[3]={true:10,false:90,unknown:0};
 a.equal(screen(cells,10).state,'undetermined');
});
