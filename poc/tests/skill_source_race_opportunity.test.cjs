'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../src/skill_source_race_opportunity.cjs');
const trace=(...outcomes)=>{
 const t=a.makeTrace();
 for(const x of outcomes)a.append(t,x);
 return t;
};
const trial=(skill,style,race,runner,trace,context={})=>({
 sourceNumericId:skill,style,modelRaceIndex:race,runnerIndex:runner,
 courseId:context.courseId??10502,distanceType:context.distanceType??2,
 surface:context.surface??'turf',fieldSize:context.fieldSize??9,
 scenario:context.scenario??'balanced',mode:context.mode??'equal',
 trace
});
test('a single true at any stage dominates other false/unknown stages within same runner and race',()=>{
 const r=a.conclude(trace('unknown','false','true','false'));
 assert.equal(r.verdict,'observed-at-least-once-true');
 assert.equal(r.observedPriorityTicks,4);
 assert.deepEqual(r.observedSourceConditionTicks,{true:1,false:2,unknown:1});
});
test('a runner-race with unknown ticks cannot be promoted to false, even after later false',()=>{
 const r=a.conclude(trace('unknown','false','false'));
 assert.equal(r.verdict,'observed-unknown-without-true');
 assert.equal(a.conclude(trace('false','false')).verdict,'observed-all-false');
 assert.equal(a.conclude(trace()).verdict,'no-observed-priority-ticks');
});
test('one original skill runner race is counted once, not once per simulated tick',()=>{
 const items=[
  trial('200701','Nige',0,0,trace('true','true','false')),
  trial('200701','Nige',0,1,trace('unknown','false')),
  trial('200701','Senkou',0,2,trace('false','false')),
  trial('200701','Nige',1,0,trace()),
  trial('200701','Nige',1,1,trace('unknown','true')),
  trial('200702','Nige',0,0,trace('false','true'))
 ];
 const x=a.aggregate(items);
 assert.equal(x.denominators.skillRunnerRaceTrials,6);
 assert.equal(x.denominators.observedSkillRunnerRaceTrials,5);
 assert.equal(x.denominators.sourceSkillStyleCells,3);
 assert.equal(x.denominators.groupedRaceStyleInstances,4);
 assert.equal(x.totals.modelRacesWithStylePresent,2);
 assert.equal(x.byStyle.find(y=>y.style==='Nige').modelRacesWithStylePresent,2);
 assert.equal(x.totals.verdicts['observed-at-least-once-true'],3);
 assert.equal(x.totals.verdicts['observed-unknown-without-true'],1);
 assert.equal(x.totals.verdicts['observed-all-false'],1);
 assert.equal(x.totals.verdicts['no-observed-priority-ticks'],1);
 assert.equal(x.totals.skillRunnerPriorityTicks,11);
 assert.equal(x.totals.observedStageConfirmedFractionLower,0.5);
 assert.equal(x.totals.observedStagePossibleFractionUpper,5/6);
 const row=x.bySkillStyle.find(y=>y.sourceNumericId==='200701'&&y.style==='Nige');
 assert.equal(row.runnerRaceTrials,4);
 assert.equal(row.modelRacesWithStylePresent,2);
 assert.equal(row.verdicts['observed-at-least-once-true'],2);
 assert.equal(row.observedStageConfirmedFractionLower,0.5);
 assert.equal(row.observedStagePossibleFractionUpper,1);
 assert.equal(x.bySkillStyle.find(y=>y.sourceNumericId==='200701'&&
  y.style==='Senkou').observedStagePossibleFractionUpper,0);
 assert.equal(x.byStyle.find(y=>y.style==='Oikomi').observedStageConfirmedFractionLower,null);
 assert.equal(x.gates.actualSkillProcRateMeasured,false);
 assert.equal(x.gates.eligibleForP3CardScoring,false);
});
test('course, race composition, surface and synthetic ability setting remain separated',()=>{
 const results=a.aggregate([
  trial('200701','Sasi',0,0,trace('true')),
  trial('200701','Sasi',1,0,trace('unknown'),{
   courseId:10506,distanceType:4
  }),
  trial('200701','Sasi',2,0,trace('false'),{
   courseId:10502,scenario:'backHeavy'
  })
 ]);
 assert.equal(results.bySkillStyle.length,1);
 assert.equal(results.bySkillStyleContext.length,3);
 assert(results.bySkillStyleContext.some(x=>x.distanceType===4&&x.courseId===10506));
 assert(results.bySkillStyleContext.some(x=>x.scenario==='backHeavy'));
 assert.equal(results.bySkillStyle[0].runnerRaceTrials,3);
 assert.equal(results.bySkillStyle[0].modelRacesWithStylePresent,3);
});
test('multiple runners same style in the same race are not misrepresented as multiple races',()=>{
 const x=a.aggregate([
  trial('200701','Nige',0,0,trace('true')),
  trial('200701','Nige',0,1,trace('true')),
  trial('200701','Nige',0,2,trace('false')),
  trial('200701','Nige',1,0,trace('false'))
 ]);
 assert.equal(x.denominators.skillRunnerRaceTrials,4);
 assert.equal(x.bySkillStyle[0].modelRacesWithStylePresent,2);
 assert.equal(x.bySkillStyle[0].runnerRaceTrials,4);
 assert.equal(x.bySkillStyle[0].verdicts['observed-at-least-once-true'],2);
});
test('no-observed-ticks, invalid outcomes and corrupted totals are rejected, not counted as failures',()=>{
 assert.throws(()=>a.append(trace(),'TRUE'),/invalid source condition outcome/);
 const malformed=trace('false');malformed.ticks=2;
 assert.throws(()=>a.conclude(malformed),/inconsistent/);
 assert.throws(()=>a.aggregate([]),/nonempty/);
 assert.throws(()=>a.aggregate([
  trial('200701','Nige',0,0,trace('false')),
  trial('200701','Nige',0,0,trace('true'))
 ]),/duplicate/);
 assert.throws(()=>a.aggregate([
  trial('200701','Nige',0,0,trace('true'),{surface:'snow'})
 ]),/invalid original source skill/);
});
