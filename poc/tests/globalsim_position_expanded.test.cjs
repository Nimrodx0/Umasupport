'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const x=require('../tools/globalsim_position_expanded.cjs');
const base={courseId:10504,skillData:{10071:{alternatives:[]}},
 horses:Array.from({length:9},(_,i)=>({gateIndex:i,strategy:'Senkou',skills:[],
 speed:1000,stamina:1000,power:1000,guts:800,wisdom:900}))};
test('observed prior counts retain source identity, sum and are not an aggregate 2026 average',()=>{
 assert.deepEqual(x.SOURCES.jan2026.counts,[21,144,34,41]);
 assert.deepEqual(x.SOURCES.oct2025.counts,[39,64,114,23]);
 assert.deepEqual(x.SOURCES.dec2025.counts,[22,88,117,13]);
 assert.deepEqual(x.SOURCES.observedPool.counts,[82,296,265,77]);
 assert.equal(x.SOURCES.observedPool.n,720);
 assert.equal(x.SOURCES.jan2026.n,240);
 assert.equal(x.SOURCES.dec2025.n,240);
 assert.equal(x.SOURCES.observedPool.counts.reduce((a,b)=>a+b,0),720);
 assert.equal(x.SOURCES.oct2025.n,240);
 assert.notEqual(x.SOURCES.oct2025.url,x.SOURCES.jan2026.url);
 const counts=x.sampleCounts(12,x.SOURCES.jan2026,x.rng(101));
 assert.equal(counts.reduce((a,b)=>a+b,0),12);
 assert.throws(()=>x.sampleCounts(9,{counts:[1,2,3,4],n:9},x.rng(1)),/corrupted/);
});
test('9 and 12 runners, three distances, observed-prior draws, stats modes',()=>{
 const plans=x.makePlan({seedsPerCell:2});
 assert.equal(plans.length,6*2*6*2*2);
 assert.deepEqual(new Set(plans.map(p=>p.course.distance)),new Set([1200,1600,2000,2500]));
 assert.equal(new Set(plans.map(p=>p.course.id)).size,6);
 assert.deepEqual(new Set(plans.map(p=>Math.floor(p.course.id/100))),
  new Set([105,103,106]));
 assert.deepEqual(new Set(plans.map(p=>p.fieldSize)),new Set([9,12]));
 assert.deepEqual(new Set(plans.map(p=>p.mode)),new Set(['equal','jitter10']));
 assert.deepEqual(new Set(plans.map(p=>p.scenario)),
  new Set(['balanced','jan2026','oct2025','dec2025','observedPool','noFront']));
 assert(plans.every(p=>p.counts.reduce((a,b)=>a+b,0)===p.fieldSize));
 assert(plans.every(p=>p.strategies.length===p.fieldSize));
 const balanced9=plans.find(p=>p.scenario==='balanced'&&p.fieldSize===9);
 const balanced12=plans.find(p=>p.scenario==='balanced'&&p.fieldSize===12);
 assert.deepEqual(balanced9.counts,[2,2,3,2]);
 assert.deepEqual(balanced12.counts,[3,3,3,3]);
 const noFront9=plans.find(p=>p.scenario==='noFront'&&p.fieldSize===9);
 assert.equal(noFront9.strategies.filter(s=>s==='Nige').length,0);
 assert.throws(()=>x.makePlan({seedsPerCell:61}),/1..60/);
});
test('equal and jitter variants share roster, field order and seed for paired estimates',()=>{
 const plans=x.makePlan({seedsPerCell:15});
 const paired=new Map();
 const identities=new Set();
 for(const p of plans){
  const k=[p.course.id,p.fieldSize,p.scenario,p.rep].join('|');
  if(!paired.has(k))paired.set(k,{});
  paired.get(k)[p.mode]=p;
  if(p.mode==='equal'){
   assert(!identities.has(p.seed),'independent scenario key must have unique seed');
   identities.add(p.seed);
  }
  assert.equal(p.seed,x.seedFor(p.course.id,p.fieldSize,p.scenario,p.rep));
 }
 assert.equal(paired.size,6*2*6*15);
 for(const pair of paired.values()){
  assert(pair.equal&&pair.jitter10);
  assert.equal(pair.equal.seed,pair.jitter10.seed);
  assert.deepEqual(pair.equal.counts,pair.jitter10.counts);
  assert.deepEqual(pair.equal.strategies,pair.jitter10.strategies);
  const a=x.makeRace(base,pair.equal),b=x.makeRace(base,pair.jitter10);
  assert.equal(a.seed,b.seed);
  assert.deepEqual(a.horses.map(h=>h.strategy),b.horses.map(h=>h.strategy));
  assert.deepEqual(a.horses.map(h=>h.gateIndex),b.horses.map(h=>h.gateIndex));
  assert.notDeepEqual(a.horses.map(h=>h.speed),b.horses.map(h=>h.speed));
 }
 assert.equal(x.seedFor(10504,9,'balanced',0),
  x.makePlan({seedsPerCell:1}).find(p=>p.course.id===10504&&
   p.fieldSize===9&&p.scenario==='balanced'&&p.mode==='equal').seed);
});
test('same seed reproduces actual roster including absent runaways',()=>{
 const a=x.roster(9,'jan2026',5,110),b=x.roster(9,'jan2026',5,110);
 assert.deepEqual(a,b);
 const race9=x.makeRace(base,{...x.makePlan({seedsPerCell:1})[0],
  course:x.COURSES[0]});
 assert.equal(race9.courseId,10501);
 assert.equal(race9.horses.length,9);
 assert(race9.horses.every(h=>h.skills.length===0));
 const plan12=x.makePlan({seedsPerCell:1}).find(p=>p.fieldSize===12&&p.mode==='jitter10');
 const race12=x.makeRace(base,plan12);
 assert.equal(race12.horses.length,12);
 assert.deepEqual(race12.horses.map(h=>h.gateIndex),Array.from({length:12},(_,i)=>i));
 assert(race12.horses.every(h=>h.skills.length===0));
 assert(race12.horses.every(h=>h.speed>=900&&h.speed<=1100));
 assert(race12.horses.every(h=>h.guts>=720&&h.guts<=880));
 assert.deepEqual(race12,x.makeRace(base,plan12));
 assert.equal(race12.retainAllFrames,true);
 assert.equal(race12.skillData,base.skillData);
 assert.throws(()=>x.makeRace({...base,courseId:10501},plan12),/v77 example required/);
});
test('rank samples from 12 field retain correct 1..6 top-half and total counts',()=>{
 const plan=x.makePlan({seedsPerCell:1}).find(p=>p.fieldSize===12);
 const frames=[0,900,1800,3000].map((d,t)=>({t,
  horses:Array.from({length:12},(_,i)=>({pos:d-i*0.9, speed:30}))}));
 const groups=new Map();
 x.observe(groups,plan,{frames});
 const all=[...groups.values()];
 assert.equal(all.reduce((s,a)=>s+a.n+a.unknown,0),12*9);
 const totals=all.filter(a=>a.fraction===.8);
 assert.equal(totals.reduce((s,a)=>s+a.front,0),6);
 assert.equal(totals.reduce((s,a)=>s+a.back,0),6);
 assert(totals.every(a=>a.front+a.back===a.n));
 assert.throws(()=>x.observe(new Map(),plan,{error:'bad model'}),/failed/);
});
