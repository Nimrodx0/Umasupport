'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fit=require('../tools/globalsim_four_style_rank_fit.cjs');
const dominance=require('../tools/globalsim_rank_band_dominance.cjs');
const pilot=require('../tools/globalsim_position_pilot.cjs');
function fixture(seedCount=4){
 const samples=[];
 for(const courseId of [10501,10502,10304,10504,10604,10506])
  for(const fieldSize of [9,12])
   for(const scenario of ['balanced','jan2026','noFront'])
    for(const mode of ['equal','jitter10'])
     for(let phase=0;phase<4;phase++)
      for(const style of dominance.STYLES){
       const absent=scenario==='noFront'&&style==='Nige';
       const middle=style==='Senkou'||style==='Sasi';
       const pos=style==='Nige'?1:
        middle?(fieldSize===9?5:6):fieldSize;
       const rankFractions=Array(fieldSize).fill(0);
       rankFractions[pos-1]=1;
       samples.push({courseId,fieldSize,scenario,mode,phase,style,
        status:absent?'no-style-runner-observations':'estimate',
        runners:absent?0:seedCount,invalidRunners:0,
        rankFractions:absent?null:rankFractions});
      }
 return {schemaVersion:1,sourceRevision:pilot.PIN,
  status:'model-all-recorded-positions-rank-distribution-not-actual-game',
  raceCount:6*2*3*2*seedCount,seedCount,samples};
}
function study(){
 return fit.analyze(fixture(4),{firstProfile:fixture(2),
  lastProfile:fixture(2)});
}
test('four-style mid-band evidence resolves both center styles without falsely preferring either group',()=>{
 const x=study();
 assert.equal(x.contextCount,288);
 assert.equal(x.comparisons.length,288*11);
 assert.equal(x.byPairPhaseBand.length,4*11*6);
 assert.equal(x.byPairScenarioBand.length,4*11*6*3);
 assert.equal(x.byStylePhaseBand.length,4*11*4);
 const get=style=>x.byStylePhaseBand.find(r=>
  r.phase===1&&r.bandId==='middle40to80'&&r.style===style);
 for(const style of ['Senkou','Sasi']){
  assert.deepEqual(get(style).higherThan.sort(),['Nige','Oikomi']);
  assert.deepEqual(get(style).unresolvedAgainst,
   [style==='Senkou'?'Sasi':'Senkou']);
  assert.equal(get(style).meanModelOccupancyPercent,100);
 }
 assert.equal(get('Nige').meanModelOccupancyPercent,0);
 assert.equal(get('Oikomi').meanModelOccupancyPercent,0);
 const pair=x.byPairPhaseBand.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.first==='Nige'&&r.second==='Senkou');
 assert.deepEqual([pair.contexts,pair.comparable,pair.absent],
  [72,48,24]);
 assert.equal(pair.gate,'second-consistently-higher');
 const centerPair=x.byPairPhaseBand.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.first==='Senkou'&&r.second==='Sasi');
 assert.equal(centerPair.tie,72);
 assert.equal(centerPair.gate,'held');
 const example=x.comparisons.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.scenario==='balanced');
 assert.equal(example.styles.Senkou.fraction,1);
 assert.equal(example.styles.Sasi.fraction,1);
 assert.equal(example.styles.Nige.fraction,0);
 assert.equal(example.styles.Oikomi.fraction,0);
 assert(!('skillSuitability' in x));
});
test('seed-half disagreement fails only that pair instead of inventing high-fit labels',()=>{
 const full=fixture(4),first=fixture(2),last=fixture(2);
 const one=last.samples.find(r=>r.courseId===10501&&r.fieldSize===9&&
  r.scenario==='balanced'&&r.mode==='equal'&&r.phase===1&&
  r.style==='Senkou');
 one.rankFractions=Array(9).fill(0);
 one.rankFractions[0]=1; // outside middle band: first-half > last-half
 const x=fit.analyze(full,{firstProfile:first,lastProfile:last});
 const pair=x.byPairPhaseBand.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.first==='Nige'&&r.second==='Senkou');
 assert.equal(pair.secondHigher,48);
 assert.equal(pair.unstable,1);
 assert.equal(pair.gate,'held');
 const detail=x.comparisons.find(r=>r.courseId===10501&&
  r.fieldSize===9&&r.scenario==='balanced'&&r.mode==='equal'&&
  r.phase===1&&r.bandId==='middle40to80');
 const conflict=detail.pairwise.find(p=>p.first==='Nige'&&p.second==='Senkou');
 assert.deepEqual(conflict.halfStatuses,['second-higher','tie']);
});
test('missing runner and no-front absent styles are not silently treated as 0%',()=>{
 const p=fixture(4);
 const item=p.samples.find(r=>r.courseId===10501&&r.fieldSize===9&&
  r.scenario==='balanced'&&r.mode==='equal'&&r.phase===1&&
  r.style==='Sasi');
 item.status='held-unresolved-runners';
 item.rankFractions=null;
 item.invalidRunners=1;
 const x=fit.analyze(p,{firstProfile:fixture(2),
  lastProfile:fixture(2)});
 const pair=x.byPairPhaseBand.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.first==='Sasi'&&r.second==='Oikomi');
 assert.equal(pair.unresolved,1);
 assert.equal(pair.gate,'held');
 const absent=x.comparisons.find(r=>r.phase===1&&
  r.bandId==='middle40to80'&&r.scenario==='noFront');
 assert.equal(absent.styles.Nige.status,'absent-style');
 assert.equal(absent.styles.Nige.fraction,null);
});
test('no seed halves means pairwise result is not certified as stable',()=>{
 const x=fit.analyze(fixture(4));
 assert(x.byPairPhaseBand.every(r=>r.gate==='held'));
 assert.throws(()=>fit.analyze(fixture(4),{firstProfile:fixture(2)}),
  /Both seed-halves/);
});
