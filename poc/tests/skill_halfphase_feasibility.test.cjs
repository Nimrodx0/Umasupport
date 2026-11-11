'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cohort}=require('../src/skill_halfphase_feasibility.cjs');
const c=(type,operator,value)=>({type,operator,value});
const row=(phaseType='phase_firsthalf_random',rank=[
  c('order_rate','<=',50)])=>[c(phaseType,'==',1),...rank];
const skill=(id,rows,preConditions=[])=>({
 id:'skill:'+id,name:'test '+id,
 activationProfile:{status:'source-structure',sourceNumericId:String(id),
  invokes:[{index:0,conditions:rows,preConditions,effectTypes:[]}]}
});
test('a single exact rank band and half-phase timing is a DIRECT research candidate, not a rating',()=>{
 const source=skill(200001,[row()]);
 const r=cohort({skills:[source]});
 assert.equal(r.baseline.sourceMatched,1);
 assert.equal(r.baseline.heldSkills,0);
 assert.equal(r.baseline.needsFourStyleStudy,1);
 assert.equal(r.counts.halfTimeWithOrderRate,1);
 assert.equal(r.counts.halfTimeAndExactBand,1);
 assert.equal(r.counts.halfTimeExactBandDirect,1);
 assert.equal(r.counts.halfTimeExactBandWithOtherAND,0);
 assert.equal(r.counts.halfTimeExactBandWithAlternativePaths,0);
 assert.equal(r.examples[0].paths[0].direct,true);
 assert.equal(r.status,'P2-source-only-half-phase-rank-feasibility-not-style-rating');
});
test('additional AND and alternative OR do not become full-skill candidates',()=>{
 const extra=skill(200002,[[...row(),c('is_overtake','==',1)]]);
 const alternate=skill(200003,[row(),[c('is_overtake','==',1)]]);
 const r=cohort({skills:[extra,alternate]});
 assert.equal(r.counts.halfTimeAndExactBand,2);
 assert.equal(r.counts.halfTimeExactBandDirect,0);
 assert.equal(r.counts.halfTimeExactBandWithOtherAND,1);
 assert.equal(r.counts.halfTimeExactBandWithAlternativePaths,1);
 assert(r.examples.some(x=>x.paths[0].extraAndTypes.includes('is_overtake')));
});
test('half-phase without rank and unmatched rank band are separate questions',()=>{
 const noRank=skill(200004,[[c('phase_laterhalf_random','==',2),c('is_overtake','==',1)]]);
 const unknownBand=skill(200005,[row('phase_firsthalf_random',[
  c('order_rate','==',41)])]);
 const r=cohort({skills:[noRank,unknownBand]});
 assert.equal(r.counts.halfTimeWithOrderRate,1);
 assert.equal(r.counts.halfTimeWithoutOrderRate,1);
 assert.equal(r.counts.halfTimeNonExactBand,1);
 assert.equal(r.counts.halfTimeAndExactBand,0);
});
test('known full-phase proof and unknown source are not counted as half-phase research gaps',()=>{
 const known=skill(200006,[row('phase_random')]);
 const unknown={id:'skill:unknown',name:'unmatched',
  activationProfile:{status:'unavailable',reason:'identity'}};
 const r=cohort({skills:[known,unknown]});
 assert.equal(r.baseline.sourceMatched,1);
 assert.equal(r.counts.halfTimeAndExactBand,0);
 assert.equal(r.counts.halfTimeExactBandDirect,0);
});
test('explicit style eligibility must be kept, never promoted to four-style rating',()=>{
 const x=skill(200007,[[...row('phase_laterhalf_random'),
  c('running_style','==',2)]]);
 const r=cohort({skills:[x]});
 assert.equal(r.counts.halfTimeExactBandDirect,1);
 assert.deepEqual(r.examples[0].paths[0].eligibleStyles,['先行']);
});
