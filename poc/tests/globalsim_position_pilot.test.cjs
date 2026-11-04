'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const m=require('../tools/globalsim_position_pilot.cjs');
const fixture={courseId:10504,skillData:{'skill':{value:1}},
 horses:Array.from({length:9},(_,i)=>({gateIndex:i,strategy:'Senkou',skills:[],
 speed:1000,stamina:1000,power:1000,guts:800,wisdom:900}))};
test('nine/12 horse rank-rate 50% and 40% round exactly as GlobalSim',()=>{
 assert.equal(m.threshold(9,50),5);
 assert.equal(m.threshold(12,50),6);
 assert.equal(m.threshold(9,40),4);
 assert.equal(m.threshold(12,40),5);
});
test('same source settings, reproducible seeds, rotated gates, four roster compositions',()=>{
 const x=m.create(fixture,{seedsPerScenario:9});
 assert.equal(x.length,36);
 assert.deepEqual([...new Set(x.map(y=>y.scenario))].sort(),
 ['backHeavy','balanced','frontHeavy','noFront']);
 assert.deepEqual(x.slice(0,9).map(y=>y.horses.filter(h=>h.strategy==='Nige').length),
  Array(9).fill(2));
 assert.notDeepEqual(x[0].horses.map(y=>y.strategy),
  x[1].horses.map(y=>y.strategy));
 assert(x.every(y=>y.race.horses.every(h=>h.skills.length===0)));
 assert(x.every(y=>y.race.retainAllFrames===true));
 assert(x.every(y=>y.race.skillData===fixture.skillData));
 assert.throws(()=>m.create(fixture,{seedsPerScenario:201}),/Pilot seed count/);
});
test('own distance crossing and contemporaneous rival positions, never compare asynchronously',()=>{
 const frames=[{t:0,horses:[[0],[0],[0],[0]]},
 {t:1,horses:[[10],[9],[8],[5]]},
 {t:2,horses:[[20],[18],[21],[19]]},
 {t:3,horses:[[30],[28],[32],[35]]}];
 assert.equal(m.crossing(frames,0,15),1);
 // JSON replay contains position in named horse objects. The Rust
 // in-process/binary API uses six-element numeric arrays instead.
 const jsonFrames=frames.map(f=>({t:f.t,
  horses:f.horses.map(row=>({pos:row[0],speed:10,hp:100}))}));
 assert.equal(m.crossing(jsonFrames,0,15),1);
 assert.equal(m.crossing(jsonFrames,2,14.6),2);
 m.checkFrames(jsonFrames,4);
 assert.equal(m.crossing(frames,2,14.6),2);
 assert.equal(m.crossing(frames,3,100),null);
 assert.equal(m.crossing([{t:0,horses:[[0],[0]]},
  {t:1,horses:[[10],[10]]}],0,5),null);
});
test('pilot analysis is labeled simulated, ensures field identity and full replay',()=>{
 const trial=m.create(fixture,{seedsPerScenario:1})[0];
 const rows=[
  {t:0,horses:Array.from({length:9},()=>[0])},
  {t:1,horses:Array.from({length:9},(_,i)=>[700-i*.2])},
  {t:2,horses:Array.from({length:9},(_,i)=>[1400-i*.5])},
  {t:3,horses:Array.from({length:9},(_,i)=>[2100-i*.7])}
 ];
 const manifest={sourceRevision:m.PIN,courseId:10504,courseDistance:2000,
  trials:[{scenario:trial.scenario,seed:trial.seed,horses:trial.horses}]};
 const jsonRows=rows.map(f=>({t:f.t,
  horses:f.horses.map(row=>({pos:row[0],speed:10}))}));
 const output=m.analyze(manifest,[{seed:trial.seed,frames:jsonRows}]);
 assert.equal(output.trialCount,1);
 assert.equal(output.fieldSize,9);
 assert.match(output.status,/simulator-estimate-not-JP/);
 assert.equal(output.samples.length,4*m.POINTS.length);
 assert(output.samples.some(v=>v.valid>0));
 assert.throws(()=>m.analyze(manifest,[]),/Reply count mismatch/);
 assert.throws(()=>m.analyze(manifest,[{error:'bad'}]),/Engine failed/);
 assert.throws(()=>m.analyze({...manifest,sourceRevision:'main'},[{frames:rows}]),/manifest drift/);
});
