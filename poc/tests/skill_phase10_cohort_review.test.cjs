'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../tools/skill_phase10_cohort_review.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const sourceRevision='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1';
const c=(type,operator,value)=>({type,operator,value});
function mockModel(){
 const courses=[10304,10501,10502,10504,10506,10604];
 const rows=[];
 for(const courseId of courses)
  for(const fieldSize of [9,12])
   for(const mode of ['equal','jitter10'])
    for(const phase of [0,1,2,3])
     for(const band of bands)
      for(const style of Object.keys(a.STYLE_IDS))
       rows.push({courseId,fieldSize,mode,phase,bandId:band.id,
        style,runners:60,pointPercent:20,
        random10mOpportunityPercent:25,upliftPoints:5});
 return {schemaVersion:1,
  status:'research-GlobalSim-10m-rank-opportunity-not-game-activation',
  sourceRevision,scenario:'balanced',simulations:720,
  seedsPerCell:30,contexts:24,phaseBands:44,
  perContextRows:4224,windowMetres:10,contextRows:rows};
}
test('full 176 model cells and all 24 contexts must be pinned and unique',()=>{
 const model=mockModel();
 const index=a.indexModel(model);
 assert.equal(index.size,176);
 assert.equal(index.get('1|top50|Nige').length,24);
 const missing=mockModel();missing.contextRows.pop();
 assert.throws(()=>a.indexModel(missing),/model report/);
 const duplicate=mockModel();duplicate.contextRows[1]=duplicate.contextRows[0];
 assert.throws(()=>a.indexModel(duplicate),/Duplicate/);
 const extra=mockModel();extra.scenario='jan2026';
 assert.throws(()=>a.indexModel(extra),/Unverified/);
});
test('exact source AND rank and phase requires exact full phase window',()=>{
 const index=a.indexModel(mockModel());
 const x=a.assessPath([c('phase_random','==',1),c('order_rate','<=',50),
  c('distance_type','==',2)],[],index);
 assert.equal(x.status,'rank-window-and-race-gates-modelled');
 assert.equal(x.bandId,'top50');
 assert.equal(x.phase,1);
 assert.equal(x.matchingCourseIds.length,2);
 assert.equal(x.styles.Nige.partialRankOpportunity.contexts,8);
 assert.equal(x.styles.Nige.partialRankOpportunity.opportunityPercent,25);
 assert.equal(x.styles.Nige.partialRankOpportunity.byHeadcount['9'],25);
 const out=a.assessPath([c('phase_laterhalf_random','==',1),
  c('order_rate','<=',50)],[],index);
 assert.equal(out.status,'held-no-matching-rank-window');
 assert(out.nonModelledReasons.includes('phase-random-full-window-not-matched'));
 assert.equal(out.styles.Nige.partialRankOpportunity,null);
 const rank=a.assessPath([c('phase_random','==',1),
  c('order_rate','>',50)],[],index);
 assert.equal(rank.bandId,'from50strict');
});
test('additional AND does not turn partial rank evidence into whole-skill estimate',()=>{
 const index=a.indexModel(mockModel());
 const extra=a.assessPath([c('phase_random','==',1),
  c('order_rate','>=',40),c('is_overtake','==',1)],[],index);
 assert.equal(extra.bandId,'from40');
 assert.equal(extra.status,'held-other-conditions-but-rank-component-measured');
 assert.equal(extra.styles.Senkou.partialRankOpportunity.opportunityPercent,25);
 assert(extra.nonModelledReasons.includes('additional-AND-or-other-timing-unmodelled'));
 const pre=a.assessPath([c('phase_random','==',1),
  c('order_rate','>=',40)],[[c('is_overtake','==',1)]],index);
 assert(pre.nonModelledReasons.includes('invoke-preconditions-unmodelled'));
});
test('dirt and unmeasured track states cannot be considered validated opportunities',()=>{
 const index=a.indexModel(mockModel());
 const dirt=a.assessPath([c('ground_type','==',2),
  c('phase_random','==',1),c('order_rate','<=',50)],[],index);
 assert.equal(dirt.surfaceAssessment,'held-unverified-surface-requirement');
 assert.notEqual(dirt.status,'rank-window-and-race-gates-modelled');
 assert.equal(dirt.styles.Sasi.partialRankOpportunity.opportunityPercent,25);
 const unknown=a.assessPath([c('ground_condition','==',4),
  c('phase_random','==',1),c('order_rate','<=',50)],[],index);
 assert.notEqual(unknown.status,'rank-window-and-race-gates-modelled');
});
test('explicit style exclusion remains structural and cannot be scored zero',()=>{
 const index=a.indexModel(mockModel());
 const row=a.assessPath([c('running_style','==',3),
  c('phase_random','==',1),c('order_rate','<=',50)],[],index);
 assert.equal(row.styles.Nige.status,'source-style-ineligible');
 assert.equal(row.styles.Nige.partialRankOpportunity,null);
 assert.equal(row.styles.Sasi.partialRankOpportunity.opportunityPercent,25);
});
test('coarse descriptive bins are not fit thresholds or actual skill probabilities',()=>{
 const out=a.distribution([{opportunityPercent:0},
  {opportunityPercent:4},{opportunityPercent:10},
  {opportunityPercent:45},{opportunityPercent:60},
  {opportunityPercent:95}]);
 assert.equal(out.count,6);assert.equal(out.min,0);
 assert.equal(out.max,95);
 assert.equal(out.descriptiveBins['0-to-under-5'],2);
 assert.equal(out.descriptiveBins['5-to-under-20'],1);
 assert.equal(out.descriptiveBins['20-to-under-50'],1);
 assert.equal(out.descriptiveBins['50-to-under-80'],1);
 assert.equal(out.descriptiveBins['80-to-100'],1);
 assert.equal(out.median,27.5);
 assert.equal(a.distribution([]).median,null);
});
