'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const experiment=require('../tools/globalsim_paired_nine_twelve.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
test('sourced integer cutoff is independently applied on one identical 12-horse trajectory',()=>{
 assert.deepEqual([...experiment.eligible(9,'top50',9)],[1,2,3,4,5]);
 assert.deepEqual([...experiment.eligible(12,'top50',9)],[1,2,3,4,5]);
 assert.deepEqual([...experiment.eligible(12,'top50',12)],[1,2,3,4,5,6]);
 assert.deepEqual([...experiment.eligible(9,'from40',9)],[4,5,6,7,8,9]);
 assert.deepEqual([...experiment.eligible(12,'from40',9)],
  [4,5,6,7,8,9,10,11,12]);
 assert.deepEqual([...experiment.eligible(12,'from40',12)],
  [5,6,7,8,9,10,11,12]);
 assert.equal(experiment.cutoffs('top50').nine[0].boundary,5);
 assert.equal(experiment.cutoffs('top50').twelve[0].boundary,6);
 assert.throws(()=>experiment.eligible(10,'top50'),/Only source-verified/);
 assert.throws(()=>experiment.eligible(12,'unconfirmed'),/Unknown source band/);
});
test('all original source windows match exact parent/fractional subphase positions',()=>{
 const mile=experiment.TARGETS.find(p=>p.id==='mile-ruler');
 const high=experiment.TARGETS.find(p=>p.id==='high-voltage');
 const gear=experiment.TARGETS.find(p=>p.id==='gear-shift');
 const close=(a,b)=>assert(Math.abs(a-b)<1e-8);
 const a=experiment.timeZone(mile,1600);
 close(a.start,1600/12);close(a.end,1600/6);
 const b=experiment.timeZone(high,1600);
 close(b.start,1600*2/3);close(b.end,1600*3/4);
 const c=experiment.timeZone(gear,1600);
 close(c.start,1600/6);close(c.end,1600*2/3);
 assert.throws(()=>experiment.timeZone({timing:'unknown:1'},1600),
  /Unrecognized/);
});
test('five twelve-horse variants append entrants WITHOUT modifying nine anchors',()=>{
 const ps=experiment.plans(2);
 assert.equal(ps.length,48);
 assert.deepEqual(experiment.VARIANTS,[
  'mixed','extraNige','extraSenkou','extraSasi','extraOikomi'
 ]);
 for(let k=0;k<ps.length;k+=6){
  const original=ps[k];
  assert.equal(original.scenario,'nine');
  assert.equal(original.fieldSize,9);
  assert.deepEqual(original.anchor9.reduce((counts,s)=>
   (counts[expanded.STYLES.indexOf(s)]++,counts),[0,0,0,0]),[2,2,3,2]);
  for(let j=1;j<6;j++){
   const test=ps[k+j];
   assert.equal(test.seed,original.seed);
   assert.equal(test.mode,original.mode);
   assert.equal(test.fieldSize,12);
   assert.deepEqual(test.strategies.slice(0,9),original.strategies);
   assert.equal(test.strategies.length,12);
  }
 }
 assert.throws(()=>experiment.plans(3),/even/);
});
test('input race must conserve initial nine horses byte-for-byte under any added composition',()=>{
 const base={seed:1,courseId:10502,
  horses:Array.from({length:9},(_,i)=>({strategy:'Nige',gateIndex:i,
   speed:1200+i,skills:[]}))};
 const extra={...base,horses:[...base.horses,
  {strategy:'Sasi',gateIndex:9},{strategy:'Sasi',gateIndex:10},
  {strategy:'Sasi',gateIndex:11}]};
 assert.equal(experiment.coreNineSame(base,extra),true);
 const corrupted=structuredClone(extra);
 corrupted.horses[0].speed++;
 assert.throws(()=>experiment.coreNineSame(base,corrupted),/not kept identical/);
});
function fixture(n=2){
 const ps=experiment.plans(n);
 const results=ps.map(plan=>{
  const metrics={};
  for(const t of experiment.TARGETS){
   if(t.courseId!==plan.course.id)continue;
   metrics[t.id]={};
   for(const style of expanded.STYLES){
    const count=plan.anchor9.filter(s=>s===style).length;
    const original=style==='Sasi'?20:80;
    const change=t.bandId==='from40'?-10:10;
    const v=plan.scenario==='nine'?original:
     original+15+change+(plan.scenario==='extraSasi'?5:0);
    const nineCutoff=plan.scenario==='nine'?0:
     original+15+(plan.scenario==='extraSasi'?5:0);
    metrics[t.id][style]={count,sourceSum:count*v,
     cutoffNineSum:count*nineCutoff};
   }
  }
  return {plan,metrics};
 });
 return {ps,results};
}
test('source cutoff and additional-entrant residual decompose the 9-to-12 difference exactly',()=>{
 const {ps,results}=fixture(2);
 const a=experiment.analyzePairs(ps,results);
 assert.equal(a.totalRaceCases,48);
 assert.equal(a.summaries.length,20);
 assert.equal(a.pairs.length,400);
 const ruler=a.summaries.find(x=>x.profileId==='mile-ruler'&&
  x.style==='Sasi');
 assert(ruler);
 assert.equal(ruler.mixedBaseline.ninePercent,20);
 assert.equal(ruler.mixedBaseline.twelveWithNineCutoffPercent,35);
 assert.equal(ruler.mixedBaseline.twelvePercent,45);
 assert.equal(ruler.mixedBaseline.boundaryComponentPoints,10);
 assert.equal(ruler.mixedBaseline.addedEntrantsComponentPoints,15);
 assert.equal(ruler.mixedBaseline.totalDifferencePoints,25);
 assert.equal(ruler.additionStyleSensitivity.rangePoints,5);
 const dirt=a.summaries.find(x=>x.profileId==='dirt-expert'&&
  x.style==='Sasi');
 assert.equal(dirt.mixedBaseline.boundaryComponentPoints,-10);
 assert.equal(dirt.mixedBaseline.addedEntrantsComponentPoints,15);
 assert.equal(dirt.mixedBaseline.totalDifferencePoints,5);
});
test('missing and duplicated paired variants cannot silently be interpreted as zero',()=>{
 const {ps,results}=fixture(2);
 assert.throws(()=>experiment.analyzePairs(ps.slice(1),results.slice(1)),
  /Missing original nine/);
 assert.throws(()=>experiment.analyzePairs(ps.slice(0,-1),results.slice(0,-1)),
  /Missing original nine or any/);
 const broken=structuredClone(results);
 broken[1].metrics['mile-ruler'].Nige.count=3;
 assert.throws(()=>experiment.analyzePairs(ps,broken),
  /Anchor runner population changed/);
});
