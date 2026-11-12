'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const geometry=require('../src/skill_phase_random_draw_support.cjs');
const study=require('../tools/globalsim_p2_15_phase_draw_support.cjs');
const original=require('../src/skill_phase_random_source_window_audit.cjs');
const prior=require('../tools/globalsim_p2_15_preskill_phase_position.cjs');
const approximately=(x,y,tol=1e-10)=>assert(Math.abs(x-y)<tol,
 'expected '+x+' approximately '+y);

function fakeSourceFiles(){
 const checker=[
  '"phase_random" -> checkInRandom(calculatedAreas, condition.type + condition.value) {',
  '    baseSetting.initPhaseRandom(condition.value)','}',
  ...original.CHECKER_ANCHORS.slice(2),
  'class RandomEntry(start: Double, end: Double) : ClosedFloatingPointRange<Double> by start..end',
  'RandomPosition.RANDOM -> Random.nextDouble()'
 ].join('\n')+'\n'+('C'.repeat(1200));
 const race=geometry.RACE_ANCHORS.join('\n')+'\n'+('R'.repeat(1200));
 return {checker,race};
}
function fixtureCohort(){
 const rows=[];
 for(let id=0;id<102;id++){
  const name=String(300000+id);
  for(let j=0;j<(id<9?4:3);j++){
   const predicate=[{side:'conditions',predicateIndex:0,
    operator:'==',phaseId:0,phaseNumberSupportedByResearch:true}];
   const path=k=>({invokeOffset:0,conditionOrIndex:k,
    preconditionOrIndex:null,phasePredicates:predicate,
    finitePredicates:[{side:'conditions',predicateIndex:1,
     type:'running_style',operator:'==',value:j+1}],
    state:'original-window-shape-verified-not-same-tick-evaluated'});
   const row={sourceNumericId:name,
    style:['逃げ','先行','差し','追込'][j],researchPaths:[path(0)]};
   if(rows.length<56)row.researchPaths.push(path(1));
   rows.push(row);
  }
 }
 assert.equal(rows.length,315);
 assert.equal(rows.reduce((s,r)=>s+r.researchPaths.length,0),371);
 return {status:original.STATUS,summary:{
  phaseRandomSingletonCandidateSkills:102,
  phaseRandomSingletonCandidateStyleCells:315,
  exactPhaseWindowSourcePaths:371},rows};
}
function fixture(){
 const plan={course:{id:10502,distance:120,
  distanceType:2,surface:'turf'},fieldSize:1,
  strategies:['Nige']};
 const physical=pos=>[pos,15,100,0.5,0,-1];
 const frames=[10,15,18].map((pos,t)=>({t,horses:[physical(pos)]}));
 const orig=[{skillEvents:[],frames}];
 const probe=structuredClone(orig);
 for(let t=1;t<3;t++){
  probe[0].frames[t].horses[0][4]=frames[t-1].horses[0][0];
  probe[0].frames[t].horses[0][5]=frames[t-1].horses[0][0];
 }
 return {plans:[plan],orig,probe};
}
function verified(){
 const s=fakeSourceFiles();
 return geometry.verifyPinnedSources(s.checker,s.race);
}
test('pinned UmaSim source checks original phase boundaries, closed intervals, RNG distribution and b-2 clipping',()=>{
 const x=verified();
 assert.equal(x.umaSimRevision,original.SOURCE_REV);
 assert.equal(x.randomDrawFractionUniformInSource,true);
 assert.equal(x.actualDrawObserved,false);
 const s=fakeSourceFiles();
 assert.throws(()=>geometry.verifyPinnedSources(s.checker,
  s.race.replace('courseLength / 6.0','courseLength / 5.0')),
  /phase boundary changed/);
 assert.throws(()=>geometry.verifyPinnedSources(
  s.checker.replace('ClosedFloatingPointRange<Double> by start..end','OpenInterval'),
  s.race),/interval no longer closed/);
 assert.throws(()=>geometry.verifyPinnedSources(
  s.checker.replaceAll('RandomPosition.RANDOM -> Random.nextDouble()',
   'RandomPosition.RANDOM -> 0.5'),s.race),
  /missing, duplicate or changed|uniform draw setting changed/);
});
test('source b-2 clipping contributes a genuine nonzero final random-draw fraction',()=>{
 // A=0, B=20. Normal u in [0,.9], all u>=.9 clip to [18,20].
 const inside=geometry.measuredPositionSupport(120,0,[19]);
 approximately(inside.unclippedDrawFractionWithAnyObservedWindowHit,.45);
 approximately(inside.clippedTailDrawFractionWithAnyObservedWindowHit,.1);
 approximately(inside.drawFractionWithAnyObservedWindowHit,.55);
 const first=geometry.measuredPositionSupport(120,0,[0]);
 approximately(first.drawFractionWithAnyObservedWindowHit,0);
 const outside=geometry.measuredPositionSupport(120,0,[40]);
 approximately(outside.drawFractionWithAnyObservedWindowHit,0);
 const endpoint=geometry.measuredPositionSupport(120,0,[20]);
 approximately(endpoint.drawFractionWithAnyObservedWindowHit,.5);
 assert.equal(endpoint.originalRandomDrawActuallyObserved,false);
});
test('overlapping observed position ranges are unioned over ONE source draw per runner-race',()=>{
 const a=geometry.measuredPositionSupport(120,0,[10]);
 approximately(a.drawFractionWithAnyObservedWindowHit,.5);
 const b=geometry.measuredPositionSupport(120,0,[13]);
 approximately(b.drawFractionWithAnyObservedWindowHit,.5);
 const joined=geometry.measuredPositionSupport(120,0,[10,13,10]);
 approximately(joined.drawFractionWithAnyObservedWindowHit,.65);
 assert.notEqual(joined.drawFractionWithAnyObservedWindowHit,
  1-(1-a.drawFractionWithAnyObservedWindowHit)*
   (1-b.drawFractionWithAnyObservedWindowHit),
  'dependent observed ticks must not be treated as independent draws');
 approximately(geometry.unionLength([[0,.4],[.2,.6],[.6,.9]]),.9);
 assert.throws(()=>geometry.unionLength([[0,1.2]]),/invalid bounded/);
 assert.throws(()=>geometry.measuredPositionSupport(120,4,[10]),
  /invalid pinned course/);
});
test('analytical draw support agrees with direct original-window formula across uniform hypothetical draws',()=>{
 const L=120;
 for(const sample of [[10,15],[19],[2,6,13,17],[20]]){
  const expected=geometry.measuredPositionSupport(L,0,sample)
   .drawFractionWithAnyObservedWindowHit;
  let hits=0,steps=20000;
  for(let i=0;i<steps;i++){
   const window=prior.sourceShapedWindow(L,0,(i+.5)/steps);
   if(sample.some(x=>x>=window.start&&x<=window.end))hits++;
  }
  approximately(expected,hits/steps,.0002);
 }
});
test('32-model-race-style original cohort supports per-path measurements, not whole-skill activation',()=>{
 const f=fixture(),cohort=fixtureCohort();
 const out=study.analyze(f.orig,f.probe,f.plans,cohort,verified());
 assert.equal(out.status,study.STATUS);
 assert.equal(out.provenance.originalSourceRouteAlternatives,371);
 assert.equal(out.priorModelParity.modelPriorityPositions,2);
 assert.equal(out.counts.modelRunnerRacesWithPositionSamples,1);
 assert.equal(out.counts.modelPriorityPositionSamples,2);
 assert(out.counts.modelSourcePathRunnerRaceUnitsEvaluated>0);
 assert.equal(out.counts.modelSourcePathRunnerRaceUnitsHeldMultiplePhasePredicates,0);
 assert.equal(out.counts.originalSourcePaths,371);
 assert.deepEqual(out.byStyle.map(x=>x.style),['逃げ','先行','差し','追込']);
 assert.equal(out.byStyle.reduce((n,x)=>n+x.originalSourcePaths,0),371);
 assert.equal(out.byStyle.reduce((n,x)=>n+x.modelSourcePathRunnerRaceUnits,0),
  out.counts.modelSourcePathRunnerRaceUnitsEvaluated);
 assert(out.byStyle.filter(x=>x.modelSourcePathRunnerRaceUnits>0)
  .every(x=>x.originalSourceWholeSkillProcObserved===false));
 const row=out.rows.find(x=>x.sourceNumericId==='300000'&&
   x.style==='逃げ'&&x.conditionOrIndex===0);
 assert(row);
 approximately(row.meanUniformDrawSupportFraction,.75);
 assert.equal(row.fullOriginalSourceConditionProven,false);
 assert.equal(row.gameActivationRate,null);
 assert.equal(out.gates.originalUmaSimActualRandomDrawObserved,false);
 assert.equal(out.gates.originalSourceWholeSkillProcMeasured,false);
 assert.equal(out.gates.P3CardSuitabilityApproved,false);
});
test('multiple phase predicates and historical preconditions are held, not multiplied or flattened',()=>{
 const f=fixture(),cohort=fixtureCohort();
 cohort.rows[0].researchPaths[0].phasePredicates.push({
  side:'conditions',predicateIndex:2,operator:'==',phaseId:1,
  phaseNumberSupportedByResearch:true});
 cohort.rows[0].researchPaths[1].preconditionOrIndex=0;
 const out=study.analyze(f.orig,f.probe,f.plans,cohort,verified());
 const rows=out.rows.filter(x=>x.sourceNumericId==='300000'&&x.style==='逃げ');
 assert.equal(rows[0].modelRunnerRaceUnitsHeldMultiplePhasePredicates,1);
 assert.equal(rows[0].modelRunnerRaceUnitsWithObservedDrawSupport,0);
 assert.equal(rows[1].modelContextsHeldUnknownOrHistorical,1);
 assert.equal(rows[1].modelRunnerRaceUnitsWithObservedDrawSupport,0);
 assert.equal(out.counts.modelSourcePathRunnerRaceUnitsHeldMultiplePhasePredicates,1);
});
test('source identity and model position parity failures abort full-source draw support',()=>{
 const f=fixture(),cohort=fixtureCohort();
 const wrong=structuredClone(f.probe);
 wrong[0].frames[1].horses[0][5]++;
 assert.throws(()=>study.analyze(f.orig,wrong,f.plans,cohort,verified()),
  /Priority1\/priority0/);
 const missing=fixtureCohort();missing.rows.pop();
 assert.throws(()=>study.analyze(f.orig,f.probe,f.plans,missing,verified()),
  /not pinned to 102\/315\/371/);
 const changedEvents=structuredClone(f.probe);
 changedEvents[0].skillEvents.push({skillId:123,horseIndex:0});
 assert.throws(()=>study.analyze(f.orig,changedEvents,f.plans,cohort,verified()),
  /probe changed model event records/);
 assert.throws(()=>study.analyze(f.orig,f.probe,f.plans,cohort,{
  ...verified(),actualDrawObserved:true}),
  /geometry was not independently source-checked/);
});
