'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),m=require('../src/p2_d051_interim_receipt.cjs');
test('all four styles require common context and a common ground state',()=>{
 const panel=[1,2].flatMap(d=>[1,2,3,4].map(s=>({distance_type:d,ground_type:1,running_style:s})));
 a.equal(m.allFourInSameContext([1,1,2,1,0,0,0,0],panel),false);
 a.equal(m.allFourInSameContext([1,1,0,0,0,0,1,1],panel),false);
 a.equal(m.allFourInSameContext([1,3,1,5,0,0,0,0],panel),true);
});
test('scope decisions are research boundaries, not source truth',()=>{
 const scope={geometry:['phase'],cost:['season']};
 a.equal(m.scopeFor({type:'phase'},scope),'D-051-standalone-geometry-research-excluded');
 a.equal(m.scopeFor({type:'season'},scope),'D-051-dedicated-context-research-excluded');
 a.equal(m.scopeFor({type:'motivation'},scope),'D-049-excluded-context-research');
 a.equal(m.scopeFor({type:'order'},scope),'existing-rank-research-only');
 a.equal(m.scopeFor({type:'is_overtake'},scope),'pending-G4-review');
});
