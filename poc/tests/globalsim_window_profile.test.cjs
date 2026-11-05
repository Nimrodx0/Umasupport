'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_window_profile.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');
const rank=require('../src/skill_rank_timing.js');
const PREFIX='experimental-GlobalSim-v77-probabilities-not-actual-skill-rates';
const rows=(style='Sasi',fieldSize=9)=>pilot.POINTS.map(f=>{
 const n=600,front=Math.round(f*n);
 return {courseId:10504,courseDistance:2000,fieldSize,scenario:'balanced',
  mode:'equal',style,fraction:f,n,unknown:0,front,back:n-front,
  rankSum:500,pTopHalf:front/n,pBackHalf:(n-front)/n,meanRank:1.5};
});
const source=(samples=rows())=>({schemaVersion:2,status:PREFIX,
 sourceRevision:pilot.PIN,raceCount:2,seedCount:1,samples});

test('source-defined random windows inherit P2 facts, not invented 75-percent rule',()=>{
 assert.deepEqual(m.WINDOWS.map(w=>w.id),
  ['middle-full','final-first-half','final-full','final-later-half']);
 for(const w of m.WINDOWS){
  const p=rank.timing({type:w.condition,operator:'==',value:w.phase});
  assert.equal(p.randomWindow,true);
  assert.equal(w.startRate,p.windows[0].startRate);
  assert.equal(w.endRate,p.windows[0].endRate);
 }
 assert.equal(m.WINDOWS.find(w=>w.id==='final-first-half').endRate,0.75);
 assert.equal(m.WINDOWS.find(w=>w.id==='final-later-half').startRate,0.75);
});

test('trapezoid exactly averages a linear rank profile across each window',()=>{
 // Synthetic pTopHalf(progress)=progress, represented exactly by 600 observations.
 // Its uniform-window average is (start+end)/2; pBackHalf=1-pTopHalf.
 const report=m.analyze(source());
 assert.equal(report.windows.length,4);
 assert.match(report.status,/not-skill-activation-rate/);
 assert(report.assumptions.some(s=>s.includes('sparse')));
 assert(report.windows.every(w=>w.status==='estimate'&&w.style==='Sasi'));
 for(const w of report.windows){
  assert(Math.abs(w.pTopHalf-(w.startRate+w.endRate)/2)<1e-7);
  assert(Math.abs(w.pTopHalf+w.pBackHalf-1)<1e-12);
  assert.equal(w.minValidRunners,600);
  assert.equal(w.maxValidRunners,600);
  assert.equal(w.unknownRankObservationsByPoint.length,w.sampledPoints);
 }
 assert(Math.abs(report.windows.find(w=>w.windowId==='final-full').pTopHalf-0.75)<1e-9);
});

test('different styles and 9/12 runner fields are never pooled',()=>{
 const all=[...rows('Sasi',9),...rows('Nige',9),...rows('Sasi',12)];
 const output=m.analyze(source(all));
 assert.equal(output.windows.length,12);
 assert.deepEqual(new Set(output.windows.map(w=>w.fieldSize)),new Set([9,12]));
 assert.deepEqual(new Set(output.windows.map(w=>w.style)),new Set(['Sasi','Nige']));
 for(const w of output.windows)
  assert.match(w.rankSplit,/round\((9|12)\*0\.5\)/);
});

test('missing grid values fail closed, not silently interpolated or extrapolated',()=>{
 const absent=rows().filter(s=>Math.abs(s.fraction-0.75)>1e-9);
 const out=m.analyze(source(absent));
 assert.equal(out.windows.find(w=>w.windowId==='middle-full').status,'estimate');
 for(const name of ['final-first-half','final-full','final-later-half']){
  const w=out.windows.find(w=>w.windowId===name);
  assert.equal(w.status,'incomplete-grid');
  assert.equal(w.pTopHalf,null);
  assert(w.missingFractions.some(f=>Math.abs(f-.75)<1e-9));
 }
});

test('no valid rank observations are missing, not probability zero',()=>{
 const samples=rows().map(s=>Math.abs(s.fraction-.75)<1e-9?
  {...s,n:0,unknown:600,front:0,back:0,pTopHalf:null,pBackHalf:null}:s);
 const output=m.analyze(source(samples));
 assert.equal(output.windows.find(w=>w.windowId==='middle-full').status,'estimate');
 const late=output.windows.find(w=>w.windowId==='final-full');
 assert.equal(late.status,'no-valid-ranks');
 assert.equal(late.pTopHalf,null);
 assert.deepEqual(late.emptyFractions,[.75]);
});

test('provenance, source sample identity and counts are strict',()=>{
 const s=source();
 assert.throws(()=>m.analyze({...s,sourceRevision:'latest'}),/pinned/);
 assert.throws(()=>m.analyze({...s,status:'actual-game-rate'}),/pinned/);
 assert.throws(()=>m.analyze({...s,samples:[]}),/pinned/);
 assert.throws(()=>m.analyze(source([...rows(),rows()[0]])),/Duplicate/);
 const bad=rows();
 bad[0]={...bad[0],pTopHalf:0.99};
 assert.throws(()=>m.analyze(source(bad)),/Probability and count mismatch/);
 const bad2=rows();
 bad2[0]={...bad2[0],back:1};
 assert.throws(()=>m.analyze(source(bad2)),/do not partition/);
 const bad3=rows();
 bad3[0]={...bad3[0],fraction:0.1};
 assert.throws(()=>m.analyze(source(bad3)),/Unexpected sampled/);
});
