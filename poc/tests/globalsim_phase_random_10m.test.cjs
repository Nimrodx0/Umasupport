'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const study=require('../tools/globalsim_phase_random_10m.cjs');
const eq=(a,b)=>assert(Math.abs(a-b)<1e-9,
 'Expected '+a+' ~ '+b);
const w=(segments,rank)=>study.measureWindows(segments,new Set([rank]),0,100);
test('random 10m window can catch a valid rank later than its sampled start',()=>{
 const frames=[
  {t:0,horses:[{pos:0},{pos:-1}]},
  {t:1,horses:[{pos:100},{pos:101}]}
 ];
 const trace=study.rankSegments(frames,0,0,100);
 assert.equal(trace.status,'estimate');
 assert.equal(trace.segments.length,2);
 eq(trace.segments[0].start,0);
 eq(trace.segments[0].end,50);
 assert.equal(trace.segments[0].rank,1);
 eq(trace.segments[1].start,50);
 eq(trace.segments[1].end,100);
 assert.equal(trace.segments[1].rank,2);
 const front=w(trace.segments,1),back=w(trace.segments,2);
 eq(front.pointOccupancy,.5);
 eq(front.tenMetreWindowOpportunity,.5);
 eq(back.pointOccupancy,.5);
 eq(back.tenMetreWindowOpportunity,.6);
 eq(back.difference,.1);
});
test('eligible 10m patch gains up to 10m of earlier trigger starts',()=>{
 const r=w([
  {start:0,end:20,rank:2},
  {start:20,end:30,rank:1},
  {start:30,end:100,rank:2}],1);
 eq(r.pointOccupancy,.1);
 eq(r.tenMetreWindowOpportunity,.2);
 const first=w([
  {start:0,end:10,rank:1},
  {start:10,end:100,rank:2}],1);
 eq(first.pointOccupancy,.1);
 eq(first.tenMetreWindowOpportunity,.1);
});
test('terminal clamp to zoneEnd-2 preserves the last 2m of sampled U',()=>{
 const last=w([
  {start:0,end:98,rank:2},
  {start:98,end:100,rank:1}],1);
 eq(last.pointOccupancy,.02);
 eq(last.tenMetreWindowOpportunity,.12);
 const none=w([{start:0,end:100,rank:2}],1);
 eq(none.pointOccupancy,0);
 eq(none.tenMetreWindowOpportunity,0);
 const all=w([{start:0,end:100,rank:1}],1);
 eq(all.pointOccupancy,1);
 eq(all.tenMetreWindowOpportunity,1);
});
test('overlapping candidate starts are unioned, not counted twice',()=>{
 const r=w([
  {start:0,end:10,rank:2},
  {start:10,end:11,rank:1},
  {start:11,end:12,rank:2},
  {start:12,end:13,rank:1},
  {start:13,end:100,rank:2}],1);
 eq(r.pointOccupancy,.02);
 eq(r.tenMetreWindowOpportunity,.13);
});
test('permanent ties and missing phase distance hold, never yield false opportunity',()=>{
 const ties=[
  {t:0,horses:[{pos:0},{pos:0}]},
  {t:1,horses:[{pos:100},{pos:100}]}
 ];
 assert.equal(study.rankSegments(ties,0,0,100).status,'held-tied-position');
 const incomplete=[
  {t:0,horses:[{pos:20},{pos:18}]},
  {t:1,horses:[{pos:100},{pos:98}]}
 ];
 assert.equal(study.rankSegments(incomplete,0,0,100).status,
  'held-incomplete-distance');
 assert.throws(()=>w([{start:-1,end:100,rank:1}],1),
  /Invalid rank trajectory/);
 assert.throws(()=>study.measureWindows(null,new Set([1]),0,100),
  /Bad random-window/);
});
test('a segment crossing multiple other horses computes the exact rank piecewise',()=>{
 const frames=[
  {t:0,horses:[{pos:0},{pos:-1},{pos:-2}]},
  {t:1,horses:[{pos:100},{pos:101},{pos:102}]}
 ];
 const x=study.rankSegments(frames,0,0,100);
 assert.equal(x.status,'estimate');
 assert.deepEqual(x.segments.map(s=>s.rank),[1,2,3]);
 eq(x.segments.reduce((sum,s)=>sum+s.end-s.start,0),100);
 for(const rank of [1,2,3]){
  const r=w(x.segments,rank);
  assert(r.tenMetreWindowOpportunity+1e-9>=r.pointOccupancy);
 }
});
