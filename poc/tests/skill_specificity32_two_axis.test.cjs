'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const replay=require('../tools/globalsim_specificity32_split_replay.cjs');
const specificity=require('../tools/skill_specificity32_two_axis.cjs');
const source=require('../tools/globalsim_roster32.cjs');
const manifest=JSON.parse(fs.readFileSync(
 path.join(__dirname,'../data/p2_position_condition32_research.v1.json'),'utf8'));
const d=(full,first,second)=>[{full,first,second}];
test('original source 32 conditions include duplicate ID but distinct OR AND paths',()=>{
 assert.equal(source.verifyManifest(manifest),true);
 assert.equal(manifest.profiles.length,32);
 assert.equal(new Set(manifest.profiles.map(p=>p.sourceNumericId)).size,31);
 const two=manifest.profiles.filter(p=>p.sourceNumericId==='204511');
 assert.equal(two.length,2);
 assert.equal(new Set(two.map(p=>p.distanceScope)).size,2);
 assert.equal(specificity.pairIds.length,6);
});
test('all-context direction and both seed halves must agree strictly',()=>{
 const x=specificity.classifyPair([...d(23,22,24),...d(5,2,8)]);
 assert.equal(x.direction,'first-higher');
 assert.equal(x.heldReasons.length,0);
 assert.equal(x.allFullContextDirection,'first-higher');
 assert.equal(x.eligibleContexts,2);
 const negative=specificity.classifyPair([...d(-3,-2,-4)]);
 assert.equal(negative.direction,'second-higher');
 assert.equal(negative.heldReasons.length,0);
 const reversal=specificity.classifyPair([...d(11,12,9),...d(-1,-2,-0.5)]);
 assert.equal(reversal.direction,'held');
 assert(reversal.heldReasons.includes('full-context-sign-variation-or-tie'));
});
test('a consistent full 30-seed sign can be held on disagreement in 15+15 seed halves',()=>{
 const x=specificity.classifyPair([...d(0.5,-1.1,2.1),...d(0.3,0.2,0.4)]);
 assert.equal(x.allFullContextDirection,'first-higher');
 assert.equal(x.direction,'held');
 assert.deepEqual(x.heldReasons,['split-seed-direction-not-concordant']);
 const tie=specificity.classifyPair([...d(0,0,0)]);
 assert.equal(tie.direction,'held');
 assert(tie.heldReasons.includes('one-or-more-exact-rounded-ties'));
 assert.throws(()=>specificity.classifyPair([]),/No comparable/);
});
test('no universal difference threshold is invented for strict model directions',()=>{
 assert.equal(specificity.classifyPair([...d(.000001,.000001,.000001)])
  .direction,'first-higher');
 assert.equal(specificity.classifyPair([...d(.000001,0,.000002)])
  .direction,'held');
});
test('pinned all-30 source SHA and both halves must be present before generating specificity',()=>{
 assert.equal(replay.EXPECTED_BALANCED_SHA,
  '63a6e44656684bf94cebe4dba7c2118a1c9668e8d4623c02321876949ec2a6b2');
 assert.throws(()=>specificity.validate({},manifest),/Missing or altered/);
 assert.throws(()=>specificity.produce(manifest,{}),/Missing or altered/);
 const invalid=structuredClone(manifest);
 invalid.profiles[0].distanceScope='unknown';
 assert.throws(()=>specificity.validate({},invalid),/Invalid manifest/);
});
function syntheticRows(seeds=30){
 return Array.from({length:3},(_,i)=>({
  surface:'turf',courseId:10502,fieldSize:9,mode:'equal',
  timing:'phase_random:1',bandId:'top50',style:specificity.STYLES[i],
  status:'complete-model-measurement',runners:2*seeds,
  opportunityPercent:50,pointOccupancyPercent:49
 }));
}
test('split-half reconciliation catches incomplete/averaged-mismatch research samples',()=>{
 const data={schemaVersion:2,scenario:'balanced',
  seedsPerCell:30,simulations:1440,heldContextCells:0,
  unresolvedRunnerWindows:0,contextRows:syntheticRows(30)};
 const first={...data,seedsPerCell:15,simulations:720,
  contextRows:syntheticRows(15)};
 const second={...first,contextRows:syntheticRows(15)};
 // Small synthetic evidence cannot masquerade as the fixed 1200 source cells.
 assert.throws(()=>replay.validateHalfReconciliation(data,first,second),
  /Nonmatching fixed full/);
 const forged={...data,contextRows:Array.from({length:1200},(_,i)=>({
  ...data.contextRows[i%3],courseId:10502+i
 }))};
 assert.throws(()=>replay.validateHalfReconciliation(forged,first,second),
  /Incomplete source-verifiable/);
});
