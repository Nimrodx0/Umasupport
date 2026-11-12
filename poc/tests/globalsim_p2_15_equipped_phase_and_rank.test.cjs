'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const tool=require('../tools/globalsim_p2_15_equipped_phase_and_rank.cjs');
const anchors=[
 'fn order_rate_get_pos(rate: f64, _s: &RaceSolver, field: Option<&RaceField>) -> f64',
 '(n * (rate / 100.0)).round()',
 'c.insert("phase_random".into(), random_cond().eq(Box::new(phase_random_filter_eq)))',
 '"distance_type".into(),',
 'fn distance_type_filter_eq(regions: &[Region], distance_type: f64, course: &CourseData',
 'course.distance_type as f64 == distance_type'
].join('\n');
const retail=[
 'fn distance_window(rng:&mut RetailRandom,start:f32,end:f32)',
 'let value=rng.real_distance(start,start.max(end-10.0));(value,value+10.0)',
 '"phase_random" | "phase_firsthalf_random" | "phase_laterhalf_random"'
].join('\n');
const solver=[
 'pos >= sk.trigger.start && pos < sk.trigger.end',
 'self.process_pending_full(self.pos, field, priority)'
].join('\n');
test('original GlobalSim model source anchors are explicit, not inferred from model event counts',()=>{
 const v=tool.verifyPinnedGlobalSimSource(anchors,retail,solver);
 assert.equal(v.globalSimRevision,tool.PIN);
 assert.equal(v.modelRuntimeIntervalSemanticsAnchored,true);
 assert.equal(v.sourceUmaSimPhaseRandomModelEquivalenceVerified,false);
 assert.equal(v.actualGameProcRateMeasured,false);
});
test('RNG, phase semantics, order percentage and stage anchors changing fails closed',()=>{
 assert.throws(()=>tool.verifyPinnedGlobalSimSource(
  anchors.replace('.round()', '.floor()'),retail,solver),/condition runtime changed/);
 assert.throws(()=>tool.verifyPinnedGlobalSimSource(
  anchors,retail.replace('end-10.0','end-5.0'),solver),/sampled window source changed/);
 assert.throws(()=>tool.verifyPinnedGlobalSimSource(
  anchors,retail,solver.replace('pos < sk.trigger.end','pos <= sk.trigger.end')),
  /skill check stage changed/);
});
test('no original source cohort or game proc is claimed by model harness',()=>{
 assert.equal(tool.STATUS,
  'P2.15-equipped-GlobalSim-actual-phase-random-and-rank-same-tick-not-UmaSim-game');
});
