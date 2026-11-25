'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),x=require('../src/p2_remaining_route_review.cjs');
test('compare two styles only in the same distance, surface and overlapping ground state',()=>{
 const panel=[{running_style:1,distance_type:1,ground_type:1},{running_style:2,distance_type:1,ground_type:1},{running_style:3,distance_type:2,ground_type:1}];
 a.equal(x.stylePairExists([1,2,1],panel),false);
 a.equal(x.stylePairExists([1,3,0],panel),true);
 a.equal(x.stylePairExists([0,0,1],panel),false);
});
