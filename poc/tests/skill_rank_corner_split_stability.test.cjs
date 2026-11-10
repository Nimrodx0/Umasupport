'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const study=require('../tools/skill_rank_corner_split_stability.cjs');
const style=(name,a,b,OA=a,OB=b)=>({
 style:name,W10mOpportunityPercent:(a+b)/2,
 OPointOccupancyPercent:(OA+OB)/2,
 split15SeedGroups:[
  {WmeanPercent:a,OmeanPercent:OA},
  {WmeanPercent:b,OmeanPercent:OB}]
});
const group=(items)=>({
 sourcePathId:'200711|0|conditions|0|absolute-order',
 candidate:'absolute-order',courseId:10504,fieldSize:9,
 mode:'equal',styles:new Map(items.map(c=>[c.style,c]))});
test('only directional agreement across independent halves is called strict',()=>{
 const g=group([style('Nige',80,70),style('Senkou',45,35)]);
 const result=study.pair(g,'Nige','Senkou','W');
 assert.equal(result.status,'strict-direction-repeated');
 assert.equal(result.direction,'Nige');
 assert.equal(result.fullMeanGapPoints,35);
 assert.equal(result.uncertainForProduct,true);
});
test('split reversal is held even though aggregate mean has a direction',()=>{
 const g=group([style('Nige',80,20),style('Senkou',10,70)]);
 const a=study.pair(g,'Nige','Senkou','W');
 assert.equal(a.status,'direction-reversed-between-halves');
 assert.equal(a.direction,null);
 assert.equal(a.fullMeanGapPoints,10);
});
test('true ties and one-half ties stay separate from strict support',()=>{
 const g=group([style('Nige',50,50),style('Senkou',50,40),
  style('Sasi',50,50)]);
 assert.equal(study.pair(g,'Nige','Senkou','W').status,
  'at-least-one-half-tied');
 assert.equal(study.pair(g,'Nige','Sasi','W').status,'both-halves-tied');
});
test('W and O directions must not overwrite one another',()=>{
 const g=group([style('Nige',80,90,15,10),
  style('Senkou',20,30,45,40)]);
 assert.equal(study.pair(g,'Nige','Senkou','W').direction,'Nige');
 assert.equal(study.pair(g,'Nige','Senkou','O').direction,'Senkou');
});
test('9 and 12 differ only when both headcounts are strictly signed',()=>{
 const a={sourcePathId:'x',courseId:1,mode:'equal',
  styleA:'Nige',styleB:'Sasi',axis:'W',fieldSize:9,
  status:'strict-direction-repeated',direction:'Nige'};
 const b={...a,fieldSize:12,direction:'Sasi'};
 assert.equal(study.compareSizes(a,b).status,
  'strict-direction-reversed-between-field-sizes');
 assert.equal(study.compareSizes(a,{...b,status:'both-halves-tied'}).status,
  'held-at-least-one-field-size');
 assert.throws(()=>study.compareSizes(a,{...b,courseId:2}),/Mismatched/);
});
test('corrupt report is rejected before any research comparison',()=>{
 assert.throws(()=>study.validate({schemaVersion:1}),/Not the verified/);
});
