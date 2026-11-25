'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{opportunity}=require('../src/p2_natural_spurt_opportunity.cjs');
test('uniform source-window union, overlap and final clamp mass',()=>{
 a.equal(opportunity([],0,100),0);
 a.equal(opportunity([20],0,100),0.1);
 a.equal(opportunity([20,25],0,100),0.15);
 a.equal(opportunity([100],0,100),0.1);
 a.equal(opportunity([98],0,100),0.12);
 a.equal(opportunity([-1,101],0,100),0);
 a.equal(opportunity(Array.from({length:101},(_,i)=>i),0,100),1);
});
