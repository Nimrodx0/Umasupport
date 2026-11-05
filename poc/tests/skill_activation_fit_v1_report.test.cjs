'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const reporter=require('../tools/skill_activation_fit_v1_report.cjs');
const fit=require('../src/skill_activation_fit_v1.cjs');
const c=(type,operator,value)=>({type,operator,value});
const fixed=()=>({
 auditVersion:7,
 source:{revision:'f6e4501ee6c6c2d4ac8698e7796e309d31575bde',
  sha256:'4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5'},
 p2StyleTendency:{app:{inferred:53}},
 p2StyleReview:{total:53,groups:[{skills:Array.from({length:53},(_,i)=>{
  const back=i%2===1,late=i===52;
  const rank=c('order_rate',back?'>':'<=',50);
  const period=c('phase_random','==',late?3:1);
  return {sourceNumericId:String(200000+i),id:'skill:'+String(200000+i),
   name:'テストスキル'+i,paths:[{invokeIndex:0,orIndex:0,
    sourceConditions:[rank,period,...(i===0?[c('ground_type','==',2)]:[])]}],
   signature:'synthetic',tendency:back?'差し・追込寄り':'逃げ・先行寄り'};
 })}]}
});
test('reviewed 53 skills have 212 style cases, all six statuses are tracked without invented data',()=>{
 const out=reporter.audit53(fixed());
 assert.equal(out.counts.skills,53);
 assert.equal(out.items.length,53);
 assert.equal(out.counts.styleCases,212);
 assert.equal(out.counts.byStatus.dependent,4);
 assert.equal(out.counts.byStatus.high,104);
 assert.equal(out.counts.byStatus.low,104);
 assert.equal(out.counts.byStatus.ineligible,0);
 assert.equal(out.counts.byStatus.neutral,0);
 assert.equal(out.counts.byStatus.held,0);
 assert.equal(out.counts.terrainRaceGateSkills,1);
 assert.equal(out.counts.terrainRaceGateResolvedSkills,1);
 assert.equal(out.counts.terrainRaceGateStillHeldSkills,0);
 assert.equal(out.status,'research-only-activation-condition-fit-not-production-classification');
 assert.equal(out.items[0].styles['逃げ'].status,'high');
 assert.equal(out.items[1].styles['差し'].status,'high');
 assert.equal(out.items[52].styles['逃げ'].status,'dependent');
 assert.match(out.boundaries[0],/order_rate/);
 assert.equal(out.items[0].styles['逃げ'].branches[0].sourceConditions.length,3);
 assert.deepEqual(out.items[0].styles['逃げ'].branches[0].raceRequirements,
  [c('ground_type','==',2)]);
 assert.equal(out.items[0].styles['逃げ'].branches[0].surfaceTransfer.status,
  'provisional-cross-surface-direction-not-verified');
 assert.equal(out.items[1].styles['差し'].branches[0].surfaceTransfer,null);
});
test('modified, incomplete or duplicated pinned source cohort fails closed',()=>{
 const x=fixed();x.p2StyleReview.total=52;
 assert.throws(()=>reporter.audit53(x),/exact pinned 53-skill/);
 const forged=fixed();forged.source.revision='unverified';
 assert.throws(()=>reporter.audit53(forged),/exact pinned 53-skill/);
 const y=fixed();y.p2StyleReview.groups[0].skills[1].sourceNumericId='200000';
 assert.throws(()=>reporter.audit53(y),/Unexpected or duplicate/);
 const z=fixed();z.p2StyleReview.groups[0].skills[0].tendency='差し・追込寄り';
 assert.throws(()=>reporter.audit53(z),/disagrees with existing 53/);
});
test('source OR order must be continuous and must stay in original invoke',()=>{
 const original=fixed().p2StyleReview.groups[0].skills[0];
 const expanded={...original,paths:[original.paths[0],
  {invokeIndex:0,orIndex:2,sourceConditions:original.paths[0].sourceConditions}]};
 assert.throws(()=>reporter.rehydrate(expanded),/Missing or duplicate/);
 const invoked={...original,paths:[original.paths[0],
  {invokeIndex:1,orIndex:1,sourceConditions:original.paths[0].sourceConditions}]};
 assert.throws(()=>reporter.rehydrate(invoked),/unsupported invoke alternative/);
});
