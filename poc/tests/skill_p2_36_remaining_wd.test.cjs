'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const tested=require('../tools/skill_p2_36_remaining_wd.cjs');
const original=require('../tools/skill_halfphase_two_axis_review.cjs');
const window=require('../tools/globalsim_subphase_random_10m.cjs');
const expanded=require('../tools/globalsim_position_expanded.cjs');
const bands=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const narrow=require('../tools/skill_p2_36_narrow_rank_observer.cjs');
const source=require('../src/skill_p2_35_short_window_exception_decisions.cjs');
const PIN=require('../tools/globalsim_position_pilot.cjs').PIN;
const styles=['Nige','Senkou','Sasi','Oikomi'];
const signature=xs=>xs.map(x=>[x.type,x.operator,x.value].join('|')).sort().join('&&');
function fixture(){
 const full=[],split=[];
 for(const w of window.WINDOWS)for(const band of bands)
  for(const course of expanded.COURSES)for(const fieldSize of [9,12])
   for(const mode of ['equal','jitter10'])for(let i=0;i<styles.length;i++){
    const k={courseId:course.id,fieldSize,mode,windowKey:w.key,
     bandId:band.id,style:styles[i]},O=12+i*12,W=O+8;
    full.push({...k,runners:60,pointPercent:O,
     random10mOpportunityPercent:W});
    for(const [half,d] of [['first15',1],['last15',-1]])
     split.push({...k,runners:30,half,pointPercent:O+d,
      random10mOpportunityPercent:W+d});
   }
 const half={status:'P2-source-only-half-phase-rank-feasibility-not-style-rating',
  source:{sha256:original.SOURCE_SHA},
  baseline:{appSkills:881,sourceMatched:818},
  counts:{halfTimeExactBandDirect:75},examples:[]};
 const short={status:'research-GlobalSim-subphase-random-10m-rank-opportunity-not-game-skill-rate',
  sourceRevision:PIN,scenario:'balanced',simulations:720,seedsPerCell:30,
  contextsPerWindow:24,perContextRows:4224,windows:window.WINDOWS,
  contextRows:full};
 const halves={status:'p2-fixed-15-plus-15-short-window-bands-not-game-activation',
  sourceRevision:PIN,seedsPerHalf:15,baseRaces:720,perContextRows:8448,
  contextRows:split};
 const rows=[];
 const mechanisms=[
  {band:'middle30to80',type:'phase_firsthalf_random',phase:2},
  {band:'top50',type:'phase_firsthalf_random',phase:2},
  {band:'from40',type:'phase_firsthalf_random',phase:2},
  {band:'from40',type:'phase_firsthalf_random',phase:1},
  {band:'top50',type:'phase_firsthalf_random',phase:1}
 ];
 for(let i=0;i<10;i++){
  const id=String(204000+i),name='Distance '+i;
  const m=mechanisms[Math.floor(i/2)];
  const band=bands.find(b=>b.id===m.band);
  rows.push({sourceNumericId:id,skillId:'skill:'+id,skillName:name,
   decision:'source-logic-adopt-distance-exclusive-OR',
   modelWAndD:'not-calculated-for-this-source-skill',
   permittedDistanceTypes:[3,4],
   mechanismKey:signature([...band.predicates,
    {type:m.type,operator:'==',value:m.phase}]),
   branches:[3,4].map(distanceType=>({
    distanceType,originalTimingCode:m.type,
    originalTimingValue:m.phase,originalRankBandId:m.band
   }))});
  half.examples.push({sourceNumericId:id,skillId:'skill:'+id,name});
 }
 for(let i=0;i<2;i++){
  const id=String(205000+i),name='Narrow '+i;
  rows.push({sourceNumericId:id,skillId:'skill:'+id,skillName:name,
   decision:'source-logic-adopt-intersection-but-hold-original-W-D',
   modelWAndD:'not-calculated-for-conjoined-rank-band',
   distanceType:1,originalTimingCode:'phase_laterhalf_random',
   originalTimingValue:1,
   sourceAbsoluteRankPredicate:{operator:'>=',value:2},
   sourceRankRatePredicate:{operator:'<=',value:50},
   projectedRanksByFieldSize:{
    9:{sourceConjunctionRankPositions:[2,3,4,5]},
    12:{sourceConjunctionRankPositions:[2,3,4,5,6]}}
  });
  half.examples.push({sourceNumericId:id,skillId:'skill:'+id,name});
 }
 const exceptions={schemaVersion:1,status:source.STATUS,
  source:{sha256:source.SOURCE_SHA},
  summary:{sourceExceptionSkills:12,sourceDistanceExclusiveOR:10,
   originalRankIntersection:2,otherHeld:0},rows};
 const narrowRows=[];
 for(const fieldSize of [9,12])for(const mode of ['equal','jitter10'])
  for(let i=0;i<styles.length;i++){
   const U=Number((100*narrow.eligibleRanks(fieldSize).length/fieldSize).toFixed(6));
   const O=12+i*12,W=O+8;
   const part=(d,n)=>({runners:n,W:W+d,O:O+d,U,
    D:Number((O+d-U).toFixed(6))});
   narrowRows.push({courseId:10501,fieldSize,mode,style:styles[i],
    bandId:narrow.bandId,windowKey:narrow.windowKey,
    ranks:narrow.eligibleRanks(fieldSize),
    all:part(0,60),first15:part(1,30),last15:part(-1,30)});
  }
 const extra={schemaVersion:1,status:narrow.STATUS,
  originalModelRaces:720,sourceModelRevision:PIN,
  sourceTimePredicate:{type:'phase_laterhalf_random',operator:'==',value:1},
  sourceRankPredicates:[{type:'order',operator:'>=',value:2},
   {type:'order_rate',operator:'<=',value:50}],
  contextRows:narrowRows};
 return {short,halves,half,exceptions,extra};
}
const run=x=>tested.audit(x.short,x.halves,x.half,x.exceptions,x.extra);
test('10 exact distance OR skills and 2 exact narrow rank skills get model W/D, not full skill scores',()=>{
 const x=fixture(),out=run(x);
 assert.equal(out.status,tested.STATUS);
 assert.equal(out.source.original720RaceModelRevision,PIN);
 assert.equal(out.source.originalShortReportSHA256,
  require('../tools/skill_halfphase_two_axis_review.cjs').SHORT_SHA);
 assert.equal(out.summary.originalExceptionSkills,12);
 assert.equal(out.summary.originalDistanceScopedBranches,22);
 assert.equal(out.summary.distinctOriginalModeledProfiles,11);
 assert.equal(out.summary.modelComparableStylePairs,132);
 assert.equal(out.summary.modelStableWPairs,132);
 assert.equal(out.summary.modelStableDPairs,132);
 assert.equal(out.summary.eligibleForP3CardScores,0);
 assert.equal(out.rows[0].branchAnalyses[0].modelCourses.length,2);
 assert.equal(out.rows[0].branchAnalyses[1].modelCourses.length,1);
 assert.equal(out.rows[10].branchAnalyses[0].bandId,narrow.bandId);
 assert(out.rows.every(r=>r.productSkillScore===null));
 assert.equal(out.rows[0].branchAnalyses[0].styles.Nige.WPercent.min,20);
});
test('same original source skill or model structure cannot be altered to fabricate evidence',()=>{
 const x=fixture();x.exceptions.rows[0].sourceNumericId='0000';
 assert.throws(()=>run(x),/unmatched\/duplicate/);
 const y=fixture();y.exceptions.rows[0].mechanismKey+='&&is_overtake';
 assert.throws(()=>run(y),/shape not in fixed reference model/);
 const z=fixture();z.exceptions.rows[10].projectedRanksByFieldSize[9]
  .sourceConjunctionRankPositions=[1,2,3,4,5];
 assert.throws(()=>run(z),/original skill\/source narrow rank differs/);
});
test('missing pinned or split observations fail closed, no false zero',()=>{
 const x=fixture();x.short.contextRows.pop();
 assert.throws(()=>run(x),/Not the pinned balanced 720-race model report/);
 const y=fixture();y.extra.contextRows[0].first15.O+=3;
 assert.throws(()=>run(y),/invalid narrow rank W\/O\/D or seed split/);
});
