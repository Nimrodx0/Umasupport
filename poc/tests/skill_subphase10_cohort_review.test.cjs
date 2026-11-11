'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const source=require('../src/skill_rank_timing.js');
const generator=require('../tools/globalsim_subphase_random_10m.cjs');
const overlay=require('../tools/skill_subphase10_cohort_review.cjs');
const full=require('../tools/skill_phase10_cohort_review.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const c=(type,operator,value)=>({type,operator,value});
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,a+' != '+b);
function artificial(){
 const agg=generator.collect();
 const styles=Object.keys(full.STYLE_IDS);
 for(const window of generator.WINDOWS)
  for(const band of bands)
   for(const mode of ['equal','jitter10'])
    for(const id of [10501,10502,10304,10504,10604,10506])
     for(const n of [9,12])
      for(const style of styles){
       for(let j=0;j<30;j++)
        agg.append({course:{id},fieldSize:n,mode},window,band,style,{
         pointOccupancy:.2,tenMetreWindowOpportunity:.25,difference:.05
        });
      }
 return generator.report(agg,30);
}
function mockFull(){
 const rows=[];
 for(const phase of [0,1,2,3])
  for(const band of bands)
   for(const mode of ['equal','jitter10'])
    for(const courseId of [10501,10502,10304,10504,10604,10506])
     for(const fieldSize of [9,12])
      for(const style of Object.keys(full.STYLE_IDS))
       rows.push({courseId,fieldSize,mode,phase,bandId:band.id,
        style,runners:60,pointPercent:20,
        random10mOpportunityPercent:30,upliftPoints:10});
 return {schemaVersion:1,
  status:'research-GlobalSim-10m-rank-opportunity-not-game-activation',
  sourceRevision:full.MODEL_REV,scenario:'balanced',
  simulations:720,seedsPerCell:30,contexts:24,
  phaseBands:44,perContextRows:4224,windowMetres:10,
  contextRows:rows};
}
function sourcePath(type,phase,bandId,{surface='no-explicit-surface-gate-turf-model-provisional-transfer',
 courses=[10501,10502,10304,10504,10604,10506],
 prior='held-no-matching-rank-window'}={}){
 const ranks=bands.find(x=>x.id===bandId).predicates;
 const conditions=[...ranks,c(type,'==',phase)];
 return {status:prior,sourceConditions:conditions,phase:null,
  bandId,matchingCourseIds:courses,surfaceAssessment:surface,
  nonModelledReasons:['phase-random-full-window-not-matched',
   'additional-AND-or-other-timing-unmodelled',
   ...(surface.startsWith('held-')?['held-unverified-surface-requirement']:[])],
  styles:Object.fromEntries(Object.keys(full.STYLE_IDS)
   .map(s=>[s,{status:'held-whole-skill-with-rank-component-only',
    partialRankOpportunity:null}]))};
}
test('all four short windows exactly represent source timing and keep fractional boundaries',()=>{
 const windows=generator.WINDOWS;
 assert.deepEqual(windows.map(w=>w.key),[
  'phase_laterhalf_random:0','phase_firsthalf_random:1',
  'phase_laterhalf_random:1','phase_firsthalf_random:2'
 ]);
 close(windows[0].startRate,1/12);
 close(windows[0].endRate,1/6);
 close(windows[1].startRate,1/6);
 close(windows[1].endRate,5/12);
 close(windows[2].startRate,5/12);
 close(windows[2].endRate,2/3);
 close(windows[3].startRate,2/3);
 close(windows[3].endRate,3/4);
 for(const w of windows)assert.equal(
  source.timing(w.sourceCondition).status,'source-defined');
 assert.throws(()=>generator.exactWindow('phase_random',1),
  /Unrecognized/);
});
test('full coverage is four windows times eleven original bands with 24 contexts per style',()=>{
 const m=artificial();
 assert.equal(m.windowBands,44);
 assert.equal(m.perContextRows,4224);
 assert.equal(m.byWindowBand.length,44);
 const x=overlay.indexSubphase(m);
 assert.equal(x.size,4*11*4);
 const r=x.get('phase_laterhalf_random:0|top50|Nige');
 assert.equal(r.length,24);
 assert.equal(r[0].random10mOpportunityPercent,25);
 const noContext=artificial();noContext.contextRows.pop();
 assert.throws(()=>overlay.indexSubphase(noContext),
  /Incomplete|model report/);
 const changed=artificial();changed.windows[0].startRate=.5;
 assert.throws(()=>overlay.indexSubphase(changed),
  /definition drift/);
});
test('strict source matching permits short subphase, NOT whole-phase substitution',()=>{
 const model=overlay.indexSubphase(artificial());
 const old=full.indexModel(mockFull());
 const p=sourcePath('phase_laterhalf_random',0,'top50');
 const x=overlay.subwindowPath(p,model,old);
 assert.equal(x.status,'rank-and-short-random-window-component-modelled');
 assert.equal(x.sourceWindowKey,'phase_laterhalf_random:0');
 assert.equal(x.styles.Nige.opportunity.opportunityPercent,25);
 assert.equal(x.styles.Nige.opportunity.contexts,24);
 assert.equal(x.styles.Nige.fullPhaseReferencePercent,30);
 assert.equal(x.styles.Nige.differenceFromFullPhasePoints,-5);
 const out=sourcePath('phase_firstquarter_random',1,'top50');
 assert.equal(overlay.subwindowPath(out,model,old).status,
  'held-original-condition-not-modelled');
});
test('dirt stays held even with a measured short-window rank component',()=>{
 const model=overlay.indexSubphase(artificial());
 const old=full.indexModel(mockFull());
 const p=sourcePath('phase_laterhalf_random',0,'top50',
  {surface:'held-unverified-surface-requirement'});
 p.sourceConditions.unshift(c('ground_type','==',2));
 const x=overlay.subwindowPath(p,model,old);
 assert.equal(x.status,'held-unverified-surface-rank-component-available');
 assert.equal(x.styles.Senkou.opportunity.opportunityPercent,25);
 assert.equal(x.styles.Senkou.status,'held-unverified-surface-rank-component-only');
});
test('extra AND, preconditions, and unexpected course projection hold',()=>{
 const sub=overlay.indexSubphase(artificial()),old=full.indexModel(mockFull());
 const p=sourcePath('phase_laterhalf_random',1,'top50');
 p.sourceConditions.push(c('is_overtake','==',1));
 assert.equal(overlay.subwindowPath(p,sub,old).status,
  'held-original-condition-not-modelled');
 const q=sourcePath('phase_laterhalf_random',1,'top50');
 q.nonModelledReasons.push('invoke-preconditions-unmodelled');
 assert.equal(overlay.subwindowPath(q,sub,old).status,
  'held-original-condition-not-modelled');
 const d=sourcePath('phase_laterhalf_random',1,'top50');
 d.sourceConditions.push(c('distance_type','==',2));
 assert.equal(overlay.subwindowPath(d,sub,old).status,
  'held-original-course-outside-model');
});
test('uncertified original full-phase result, blank or incomplete source contexts fail closed',()=>{
 const s=artificial();
 const x=mockFull();
 x.sourceRevision='other';
 assert.throws(()=>full.indexModel(x),/Unverified/);
 const m=overlay.indexSubphase(s);
 const p=sourcePath('phase_firsthalf_random',1,'top50');
 const row=m.get('phase_firsthalf_random:1|top50|Nige');
 row.splice(0,1);
 assert.throws(()=>overlay.subwindowPath(p,m,
  full.indexModel(mockFull())),/Missing matched model/);
 assert.throws(()=>overlay.checkSource({}),/Fixed full-phase/);
});

test('unchanged full 30-seed report and new 15+15 W/O observations use same exact source windows',()=>{
 const agg=generator.collect();
 const styles=Object.keys(full.STYLE_IDS);
 for(const window of generator.WINDOWS)
  for(const band of bands)
   for(const mode of ['equal','jitter10'])
    for(const courseId of [10501,10502,10304,10504,10604,10506])
     for(const fieldSize of [9,12])
      for(const style of styles)
       for(let rep=0;rep<30;rep++)
        agg.append({course:{id:courseId},fieldSize,mode,rep},
         window,band,style,{pointOccupancy:.20+rep/1000,
          tenMetreWindowOpportunity:.30+rep/1000,difference:.10});
 const original=generator.report(agg,30);
 const split=generator.splitReport(agg,30);
 assert.equal(original.simulations,720);
 assert.equal(original.perContextRows,4224);
 assert.equal(split.perContextRows,8448);
 assert.equal(split.seedsPerHalf,15);
 const row=original.contextRows[0];
 const halves=split.contextRows.filter(x=>x.courseId===row.courseId&&
  x.fieldSize===row.fieldSize&&x.mode===row.mode&&
  x.windowKey===row.windowKey&&x.bandId===row.bandId&&
  x.style===row.style);
 assert.equal(halves.length,2);
 close((halves[0].pointPercent+halves[1].pointPercent)/2,row.pointPercent);
 close((halves[0].random10mOpportunityPercent+
  halves[1].random10mOpportunityPercent)/2,row.random10mOpportunityPercent);
 assert.throws(()=>generator.splitReport(generator.collect(),30),/Incomplete/);
});
