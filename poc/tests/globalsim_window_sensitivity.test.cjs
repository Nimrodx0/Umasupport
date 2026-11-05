'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const pilot=require('../tools/globalsim_position_pilot.cjs');
const windowProfile=require('../tools/globalsim_window_profile.cjs');
const audit=require('../tools/globalsim_window_sensitivity.cjs');

function fixture(){
 const samples=[];
 for(const fieldSize of [9,12])
  for(const scenario of ['balanced','dec2025'])
   for(const mode of ['equal','jitter10'])
    for(const style of ['Nige','Sasi'])
     for(const fraction of pilot.POINTS){
      const n=600,offset=(fieldSize===12?0.04:0)+
       (scenario==='dec2025'?0.03:0)+(mode==='jitter10'?0.02:0)+
       (style==='Sasi'?0.01:0);
      const front=Math.round(n*(0.1+fraction*0.6+offset));
      samples.push({courseId:10504,fieldSize,scenario,mode,style,
       fraction,n,unknown:0,front,back:n-front,pTopHalf:front/n,
       pBackHalf:(n-front)/n});
     }
 const summary={schemaVersion:2,
  status:'experimental-GlobalSim-v77-probabilities-not-actual-skill-rates',
  sourceRevision:pilot.PIN,raceCount:16,seedCount:1,samples};
 const profile=windowProfile.analyze(summary);
 return {summary,profile};
}

test('all 4 window families and all scenario/size/stat pairs reconcile',()=>{
 const {summary,profile}=fixture(),out=audit.inspect(summary,profile);
 assert.equal(out.sourceRevision,pilot.PIN);
 assert.equal(out.counts.summaryRows,16*9);
 assert.equal(out.counts.windowRows,16*4);
 assert.equal(out.counts.estimatedWindows,64);
 assert.equal(out.counts.heldWindows,0);
 assert.equal(out.counts.firstToFullPairs,16);
 assert.equal(out.counts.equalToJitterPairs,32);
 assert.equal(out.counts.nineToTwelvePairs,32);
 assert.equal(out.counts.scenarioSpreadGroups,32);
 assert.equal(out.deltaByStyle.reduce((n,r)=>n+r.validComparisons,0),16);
 assert.equal(out.anchor.length,4);
 assert.equal(out.counts.unknownRankCounts,0);
 assert.equal(out.status,'model-sensitivity-audit-not-a-skill-activation-probability');
 assert(out.limitations.some(s=>s.includes('activation probabilities')));
});

test('controlled synthetic offset is separated by scenario, mode and field size',()=>{
 const out=audit.inspect(...Object.values(fixture()));
 const p=out.scenarioSpreads.find(x=>x.fieldSize===9&&x.mode==='equal'&&
  x.style==='Sasi'&&x.windowId==='final-full');
 assert.equal(p.scenarios.length,2);
 assert(Math.abs(p.rangePercentagePoints-3)<0.00001);
 const stat=out.equalToJitter.find(x=>x.fieldSize===9&&
  x.scenario==='balanced'&&x.style==='Sasi'&&x.windowId==='final-full');
 assert(Math.abs(stat.deltaTopPercentagePoints-2)<0.00001);
 const size=out.nineToTwelve.find(x=>x.mode==='equal'&&
  x.scenario==='balanced'&&x.style==='Sasi'&&x.windowId==='final-full');
 assert(Math.abs(size.deltaTopPercentagePoints-4)<0.00001);
 // 0.1 + 0.6 * phase-rate gives full-window average ~0.55.
 const representative=out.anchor.find(x=>x.style==='Nige'&&x.windowId==='final-full');
 assert(Math.abs(representative.pTopHalfPercent-55)<0.00001);
});

test('held/unknown rank cells never turn into a zero probability',()=>{
 const {summary}=fixture();
 const affected=summary.samples.find(s=>s.style==='Nige'&&s.fraction===.75&&
  s.fieldSize===9&&s.mode==='equal'&&s.scenario==='balanced');
 affected.n=0;affected.front=0;affected.back=0;
 affected.unknown=600;affected.pTopHalf=null;affected.pBackHalf=null;
 const profile=windowProfile.analyze(summary),out=audit.inspect(summary,profile);
 assert(out.counts.heldWindows>0);
 assert(out.counts.unknownRankCounts===600);
 assert(!out.firstToFull.some(p=>p.style==='Nige'&&
  p.fieldSize===9&&p.scenario==='balanced'&&p.mode==='equal'));
});

test('wrong source, tampered probabilities and forged identities fail closed',()=>{
 const {summary,profile}=fixture();
 assert.throws(()=>audit.inspect({...summary,sourceRevision:'latest'},profile),/Mismatched/);
 assert.throws(()=>audit.inspect(summary,{...profile,sourceRaceCount:99}),/Mismatched/);
 assert.throws(()=>audit.inspect(summary,{...profile,sourceSeedCount:99}),/Mismatched/);
 assert.throws(()=>audit.inspect(summary,{...profile,
  windows:[...profile.windows,profile.windows[0]]}),/Duplicate/);
 assert.throws(()=>audit.inspect(summary,{...profile,
  windows:[{...profile.windows[0],pTopHalf:1.5},...profile.windows.slice(1)]}),
  /Invalid window probability/);
 assert.throws(()=>audit.inspect(summary,{...profile,
  windows:[{...profile.windows[0],courseId:9999},...profile.windows.slice(1)]}),
  /Invalid window provenance/);
 assert.throws(()=>audit.inspect({...summary,samples:summary.samples.slice(1)},profile),
  /absent source model fraction/);
});
