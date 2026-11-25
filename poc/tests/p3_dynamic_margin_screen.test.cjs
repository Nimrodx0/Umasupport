'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{bounds,relation,screen}=require('../src/p3_dynamic_margin_screen.cjs');
const counts=(t,u=0)=>({true:t,false:100-t-u,unknown:u});
const rows=(values,m=15)=>Array.from({length:8},()=>values.map((v,i)=>({style:i+1,groundStateNecessaryMask:m,counts:[null,null,null,v]})));
test('bounds use unknown mass, strict margin and unequal denominators',()=>{
 a.equal(relation(bounds(counts(50,40)),bounds(counts(60)),5),'hold');
 a.equal(relation(bounds(counts(60)),bounds(counts(50)),10),'within');
 a.equal(relation(bounds(counts(60)),bounds({true:1,false:1,unknown:0}),5),'left');
});
test('same top group across all contexts, no label from static restrictions or sample ties',()=>{
 const x=rows([counts(90),counts(90),counts(20),counts(20)]);
 a.deepEqual(screen(x,10).styles,[1,2]);a.equal(screen(x,10).state,'targeted-in-fixed-sample');
 x[7][0].counts[3]=counts(10);
 a.equal(screen(x,10).state,'undetermined');
 a.equal(screen(rows([counts(0),counts(0),counts(0),counts(0)]),0).state,'within-margin-in-fixed-sample');
 a.equal(screen(rows([counts(90),counts(90),counts(20),counts(20)],1),10).state,'undetermined');
});
