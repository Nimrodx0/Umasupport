'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const generator=require('../tools/globalsim_balanced_two_axis.cjs');
const overlay=require('../src/skill_two_axis_research.cjs');
const pinned=require('../src/skill_balanced_four_style_fit.cjs');
const c=(type,operator,value)=>({type,operator,value});
const rank=[c('order_rate','>=',40),c('order_rate','<=',80),
 c('phase_random','==',1)];
const source=(paths,opts={})=>({status:'source-structure',
 sourceNumericId:'TEST:two-axis',invokes:[{
  index:0,conditions:paths,preConditions:opts.preConditions||[]
 }]});
const orders=pinned.EVIDENCE.directionByPhase;
const styles=pinned.EVIDENCE.styles;
function toyReport(){
 const vals=[.01,.5,.8,.4];
 const gates=['second-consistently-higher','second-consistently-higher',
  'second-consistently-higher','second-consistently-higher',
  'first-consistently-higher','first-consistently-higher'];
 return {schemaVersion:1,sourceRevision:pinned.EVIDENCE.sourceRevision,
  status:'research-four-style-pairwise-model-occupancy-not-game-activation',
  raceCount:2160,seedCount:30,splitSeedCounts:[15,15],
  contextCount:288,
  comparisons:[{courseId:10501,fieldSize:9,mode:'equal',
   scenario:'balanced',phase:1,bandId:'middle40to80',
   integerRanks:[4,5,6,7],
   styles:Object.fromEntries(styles.map((s,i)=>[s,{status:'estimate',
    fraction:vals[i],runnerCount:30}]))}],
  byPairScenarioBand:pinned.EVIDENCE.pairs.map(([first,second],i)=>({
   phase:1,bandId:'middle40to80',scenario:'balanced',
   first,second,contexts:1,comparable:1,absent:0,unresolved:0,
   splitTested:true,gate:gates[i]
  }))};
}
function fabricatedSummary(){
 const data=generator.summarize(toyReport(),{requireComplete:false});
 const sample=data.results[0];
 return {...data,results:pinned.EVIDENCE.bands.flatMap(bandId=>
   Array.from({length:4},(_,phase)=>({...sample,bandId,phase})))};
}
test('derive absolute opportunity and relative specificity separately, without a high/low label',()=>{
 const result=generator.summarize(toyReport(),{requireComplete:false});
 assert.equal(result.results.length,1);
 const r=result.results[0];
 assert.equal(r.scenario,'balanced');
 assert.equal(r.styles.Sasi.opportunity.meanPercent,80);
 assert.equal(r.styles.Sasi.opportunity.minContextPercent,80);
 assert.equal(r.styles.Sasi.opportunity.maxContextPercent,80);
 assert.equal(r.styles.Sasi.opportunity.byFieldSize['9'],80);
 assert.equal(r.styles.Sasi.opportunity.byFieldSize['12'],null);
 assert.equal(r.styles.Sasi.specificity.uniformRankReferencePercent,44.444444);
 assert.equal(r.styles.Sasi.specificity.deviationFromUniformReferencePoints,35.555556);
 assert.deepEqual(r.styles.Sasi.specificity.higherThan,['Nige','Senkou','Oikomi']);
 assert.equal(r.styles.Sasi.specificity.allThreePairsConfirmed,true);
 assert.equal(Object.hasOwn(r.styles.Sasi,'effectUtility'),false);
});
test('unconfirmed pair is held but numeric opportunity remains measured',()=>{
 const source=toyReport();
 source.byPairScenarioBand[4].gate='held';
 const doc=generator.summarize(source,{requireComplete:false});
 assert.equal(doc.results[0].styles.Senkou.opportunity.meanPercent,50);
 assert.deepEqual(doc.results[0].styles.Senkou.specificity.heldAgainst,['Oikomi']);
 assert.equal(doc.results[0].styles.Senkou.specificity.allThreePairsConfirmed,false);
});
test('exact source rank projection and missing runner data fail closed',()=>{
 const report=toyReport();
 report.comparisons[0].integerRanks=[4,5,6];
 assert.throws(()=>generator.summarize(report,{requireComplete:false}),
  /projection drift/);
 const report2=toyReport();
 report2.comparisons[0].styles.Sasi.fraction=null;
 assert.throws(()=>generator.summarize(report2,{requireComplete:false}),
  /Unmeasured balanced style/);
});
test('matched rank condition attaches both research axes but does not invent skill activation probability',()=>{
 const report=fabricatedSummary();
 const v=overlay.evaluate(source([rank]),report);
 assert.equal(v.status,'research-only-not-production');
 assert.equal(v.effectUtility.status,'future-separate-axis-not-assessed');
 assert.equal(v.styles['差し'].twoAxisStatus,'measured-rank-component');
 assert.equal(v.styles['差し'].twoAxis.opportunity.meanPercent,80);
 assert.equal(v.styles['先行'].twoAxis.specificity.deviationFromUniformReferencePoints,5.555556);
 assert.equal(v.styles['逃げ'].twoAxis.opportunity.meanPercent,1);
 assert.equal(v.styles['追込'].twoAxis.specificity.higherThan.length,1);
 assert.equal(v.styles['差し'].twoAxis.wholeSkillValidated,false);
 assert(!('activationProbability' in v.styles['差し'].twoAxis));
});
test('extra AND, OR, preconditions, and explicit exclusions retain original blockers',()=>{
 const report=fabricatedSummary();
 const a=overlay.evaluate(source([[...rank,c('is_overtake','==',1)]]),report);
 assert.equal(a.styles['差し'].status,'held');
 assert.equal(a.styles['差し'].twoAxis,null);
 assert.equal(a.styles['差し'].paths[0].twoAxis.opportunity.meanPercent,80);
 assert.equal(a.styles['差し'].paths[0].twoAxis.conditionMatched,false);
 const b=overlay.evaluate(source([rank,[...rank,c('distance_type','==',3)]]),report);
 assert.equal(b.styles['差し'].twoAxis,null);
 assert.equal(b.styles['差し'].paths.length,2);
 const p=overlay.evaluate(source([rank],{preConditions:[
  [c('running_style','==',3)]
 ]}),report);
 assert.equal(p.styles['差し'].twoAxis,null);
 const excl=overlay.evaluate(source([[...rank,c('running_style','==',2)]]),report);
 assert.equal(excl.styles['逃げ'].status,'ineligible');
 assert.equal(excl.styles['逃げ'].twoAxis,null);
 assert.equal(excl.styles['先行'].twoAxis.opportunity.meanPercent,50);
});
test('unknown, incomplete, other-roster or manipulated source evidence is rejected',()=>{
 const r=fabricatedSummary();
 r.scenario='jan2026';
 assert.throws(()=>overlay.evaluate(source([rank]),r),/Unpinned/);
 const q=fabricatedSummary();
 q.results[0].styles.Sasi.opportunity.meanPercent=NaN;
 assert.throws(()=>overlay.evaluate(source([rank]),q),/Malformed/);
 assert.throws(()=>generator.summarize({comparisons:[]}),
  /Not the source-pinned/);
 assert.equal(orders[1][7],'SSSSFF');
});
