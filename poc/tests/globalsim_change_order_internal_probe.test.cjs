'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const study=require('../tools/globalsim_change_order_internal_probe.cjs');
test('source patch requires exactly one pinned replay site; replaces only slots 4 and 5',()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'p2-rank-probe-'));
 const file=path.join(folder,'lib.rs');
 try{
  const source='field.step_all(dt, visited);\n'+
   'if capture_frames { frames.capture(t, |i| {\n'+
   'if retail_runtime || finished[i].is_none() { s.rushing_mode as f64 } else { 0.0 },\n'+
   '                 blocker as f64]\n}) }\n';
  fs.writeFileSync(file,source);
  const meta=study.patch(file);
  assert.equal(meta.modelRevision,study.PIN);
  assert.notEqual(meta.originalLibSHA256,meta.instrumentedLibSHA256);
  const changed=fs.readFileSync(file,'utf8');
  assert.match(changed,/field\.order_of\(i\) \* 64 \+ field\.previous_order_of\(i\)/);
  assert.match(changed,/field\.order_of\(i\) as f64 - field\.previous_order_of\(i\) as f64/);
  assert.throws(()=>study.patch(file),/patch site changed/);
 }finally{fs.rmSync(folder,{recursive:true,force:true})}
});
test('only pinned 2 courses, 9/12, 2 rosters and 4 seed repetitions are selected',()=>{
 const plans=study.plans();
 assert.equal(plans.length,32);
 assert.deepEqual([...new Set(plans.map(p=>p.course.id))],[10502,10504]);
 assert.deepEqual([...new Set(plans.map(p=>p.fieldSize))],[9,12]);
 assert.deepEqual([...new Set(plans.map(p=>p.scenario))],['balanced','backHeavy']);
});
test('direct internal signed difference is checked against both source rank buffers on every runner tick',()=>{
 const plans=study.plans();
 const originals=[],probes=[];
 for(const p of plans){
  const physical=Array.from({length:p.fieldSize},(_,i)=>[
   (p.fieldSize-i)*10,20,100,0.2,0,-1]);
  const original={frames:[{t:0,horses:physical},{t:1,horses:physical},{t:2,horses:physical}]};
  const patched=physical.map((h,i)=>{
   const current=i+1,prev=i===0?2:i===1?1:current;
   return [...h.slice(0,4),current-prev,current*64+prev];
  });
  originals.push(original);
  probes.push({frames:[{t:0,horses:physical},{t:1,horses:patched},{t:2,horses:patched}]});
 }
 const r=study.analyze(originals,probes,plans);
 assert.equal(r.status,'P2-GlobalSim-direct-cached-order-change-state-probe-only');
 assert.equal(r.rows.length,32);
 assert.equal(r.design.races,32);
 assert.equal(r.observations.uninstrumentedRetailInitializationSamples,
  plans.reduce((sum,p)=>sum+p.fieldSize,0));
 assert(r.observations.movedUpTicks>0);
 assert(r.observations.movedDownTicks>0);
 assert.equal(r.validation.allModelPhysicsColumnsIdentical,true);
 const corrupt=structuredClone(probes);
 corrupt[0].frames[1].horses[0][4]=7;
 assert.throws(()=>study.analyze(originals,corrupt,plans),/condition formula/);
 const physics=structuredClone(probes);
 physics[0].frames[0].horses[0][0]+=0.5;
 assert.throws(()=>study.analyze(originals,physics,plans),/changed original position/);
});
test('probe readout works with numeric or keyed JSON replay frames',()=>{
 const array=[9,20,100,0.3,64,0];
 const object={pos:9,speed:20,hp:100,lane:0.3,
  temptationMode:64,blockFrontHorseIndex:0};
 for(let i=0;i<6;i++)
  assert.equal(study.get(array,i),study.get(object,i));
});
