'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const dominance=require('../tools/globalsim_rank_band_dominance.cjs');
const study=require('../tools/globalsim_rank_band_study.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');
const bounds=require('../src/skill_order_rate_bounds.cjs');
function fakeProfile(nSeeds=2,{rearAtFront=false}={}){
 const samples=[],SCENARIOS=['balanced','jan2026','noFront'];
 const courses=[10501,10502,10304,10504,10604,10506];
 for(const courseId of courses)
  for(const fieldSize of [9,12])
   for(const scenario of SCENARIOS)
    for(const mode of ['equal','jitter10'])
     for(let phase=0;phase<4;phase++)
      for(const style of dominance.STYLES){
       const absent=scenario==='noFront'&&style==='Nige';
       const isFront=['Nige','Senkou'].includes(style);
       const rank=rearAtFront?!isFront:isFront;
       const hist=Array(fieldSize).fill(0);
       hist[rank?0:fieldSize-1]=1;
       samples.push({courseId,fieldSize,scenario,mode,phase,style,
        status:absent?'no-style-runner-observations':'estimate',
        runners:absent?0:nSeeds,invalidRunners:0,
        rankFractions:absent?null:hist});
      }
 return {schemaVersion:1,sourceRevision:pilot.PIN,
  status:'model-all-recorded-positions-rank-distribution-not-actual-game',
  raceCount:courses.length*2*SCENARIOS.length*2*nSeeds,
  seedCount:nSeeds,samples};
}
test('required original source rank bands have exact 9/12 integer ranks',()=>{
 const byId=Object.fromEntries(dominance.BANDS.map(x=>[x.id,x]));
 assert.deepEqual(bounds.andProjection(byId.middle40to80.predicates,9).positions,
  [4,5,6,7]);
 assert.deepEqual(bounds.andProjection(byId.middle40to80.predicates,12).positions,
  [5,6,7,8,9,10]);
 assert.deepEqual(bounds.andProjection(byId.middle30to80.predicates,9).positions,
  [3,4,5,6,7]);
 assert.deepEqual(bounds.andProjection(byId.from40.predicates,12).positions,
  [5,6,7,8,9,10,11,12]);
 assert.deepEqual(bounds.andProjection(byId.equal50.predicates,9).positions,[5]);
 assert.deepEqual(bounds.andProjection(byId.equal50.predicates,12).positions,[6]);
 assert.equal(dominance.BANDS.length,11);
});
test('all 288 model contexts, source bands, zero substitutes and strict symmetric fronts/rears',()=>{
 const p=fakeProfile(4),first=fakeProfile(2),last=fakeProfile(2);
 const r=dominance.analyze(p,{firstProfile:first,lastProfile:last});
 assert.equal(r.raceCount,288);
 assert.equal(r.contextCount,288);
 assert.equal(r.comparisonCount,288*11);
 assert.equal(r.byPhaseBand.length,44);
 assert.deepEqual(r.splitSeedCounts,[2,2]);
 assert(r.byPhaseBand.filter(x=>x.bandId==='top50')
  .every(x=>x.front===72&&x.rear===0&&
   x.gate==='model-front-direction-consistent'));
 assert(r.byPhaseBand.filter(x=>x.bandId==='from40')
  .every(x=>x.rear===72&&x.front===0&&
   x.gate==='model-rear-direction-consistent'));
 assert(r.byPhaseBand.filter(x=>x.bandId==='middle40to80')
  .every(x=>x.mixed===72&&x.gate==='held-ambiguous-or-unconfirmed'));
 assert(r.comparisons.filter(x=>x.scenario==='noFront')
  .every(x=>x.values.Nige.status==='absent-style'&&
   x.values.Nige.fraction===null));
 assert(r.comparisons.every(x=>x.splitStatus!=='not-measured'));
});
test('rear ordering is tested with minRear > maxFront, NOT a weak negated front gap',()=>{
 const v={
  Nige:{status:'estimate',fraction:0.95},
  Senkou:{status:'estimate',fraction:0.10},
  Sasi:{status:'estimate',fraction:0.65},
  Oikomi:{status:'estimate',fraction:0.05}
 };
 const x=dominance.direction(v,'balanced');
 assert.equal(x.status,'mixed-or-tied');
 assert(x.frontGapPoints<0);assert(x.rearGapPoints<0);
 const y=dominance.direction({...v,
  Nige:{status:'estimate',fraction:0.08},
  Senkou:{status:'estimate',fraction:0.06},
  Sasi:{status:'estimate',fraction:0.55},
  Oikomi:{status:'estimate',fraction:0.70}
 },'balanced');
 assert.equal(y.status,'rear-all-ahead');
 assert(y.rearGapPoints>0);
});
test('unobserved runner groups fail closed instead of using 0% or a false strict gap',()=>{
 const p=fakeProfile(2);
 const i=p.samples.findIndex(x=>x.scenario==='balanced'&&
  x.courseId===10501&&x.fieldSize===9&&x.phase===1&&
  x.mode==='equal'&&x.style==='Oikomi');
 p.samples[i]={...p.samples[i],status:'held-unresolved-runners',
  invalidRunners:1,rankFractions:null};
 const r=dominance.analyze(p);
 const x=r.byPhaseBand.find(x=>x.phase===1&&x.bandId==='top50');
 assert.equal(x.unresolved,1);
 assert.equal(x.front,71);
 assert.equal(x.gate,'held-ambiguous-or-unconfirmed');
 const fake=fakeProfile(2);
 fake.samples.find(x=>x.scenario==='balanced'&&x.style==='Nige')
  .status='no-style-runner-observations';
 assert.throws(()=>dominance.analyze(fake),/Unresolved runner/);
 const dupe=fakeProfile(2);dupe.samples.push(dupe.samples[0]);
 assert.throws(()=>dominance.analyze(dupe),/Duplicate profile style/);
 const incomplete=fakeProfile(2);incomplete.samples.pop();
 assert.throws(()=>dominance.analyze(incomplete),/Incomplete style set/);
});
test('seed halves must both support pooled direction before it can become a gate',()=>{
 const p=fakeProfile(4),first=fakeProfile(2),last=fakeProfile(2);
 const s=last.samples.find(x=>x.courseId===10501&&x.fieldSize===9&&
  x.scenario==='balanced'&&x.mode==='equal'&&x.phase===1&&
  x.style==='Senkou');
 const hist=Array(s.fieldSize).fill(0);hist[s.fieldSize-1]=1;
 s.rankFractions=hist;
 const r=dominance.analyze(p,{firstProfile:first,lastProfile:last});
 const x=r.comparisons.find(x=>x.courseId===10501&&x.fieldSize===9&&
  x.scenario==='balanced'&&x.mode==='equal'&&x.phase===1&&
  x.bandId==='top50');
 assert.equal(x.status,'front-all-ahead');
 assert.equal(x.splitStatus,'not-confirmed-in-both-halves');
 const mid=r.byPhaseBand.find(x=>x.phase===1&&x.bandId==='top50');
 assert.equal(mid.front,72);
 assert.equal(mid.splitSameDirection,71);
 assert.equal(mid.gate,'held-ambiguous-or-unconfirmed');
 assert.throws(()=>dominance.analyze(p,{firstProfile:first}),
  /Both seed-halves/);
});
test('the full source plan stays 6×2×3×2×30 and splits evenly',()=>{
 const p=study.plans(30);
 assert.equal(p.length,2160);
 assert(p.every(x=>study.SCENARIOS.includes(x.scenario)));
 assert.equal(p.filter(x=>x.rep<15).length,1080);
 assert.equal(p.filter(x=>x.rep>=15).length,1080);
 assert(p.filter(x=>x.scenario==='noFront').every(x=>x.counts[0]===0));
 assert.throws(()=>study.plans(15),/even number/);
});
