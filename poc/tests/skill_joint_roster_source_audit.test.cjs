'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const audit=require('../tools/skill_joint_roster_source_audit.cjs');
const full=JSON.parse(fs.readFileSync(
 path.join(__dirname,'../data/p2_public_full_race_one_20261109.json'),'utf8'));
const marginal=JSON.parse(fs.readFileSync(
 path.join(__dirname,'../data/p2_public_opponent6_marginals_20261109.json'),'utf8'));
test('a reported nine-runner final match is exactly ONE complete race, not a population estimate',()=>{
 const r=audit.produce(full,marginal);
 assert.equal(r.schemaVersion,1);
 assert.equal(r.findings.fullyDescribedPublicNineRaces,1);
 assert.equal(r.findings.independentFullRosterPopulationEstimateAvailable,false);
 assert.equal(r.findings.learnedRealMatchupWeights,false);
 const c=r.fullNineCohorts[0];
 assert.equal(c.observedRaceCount,1);
 assert.equal(c.uniqueRecordedFullRosters,1);
 assert.deepEqual(c.distribution[0].counts,{Nige:1,Senkou:4,Sasi:1,Oikomi:3});
 assert.equal(c.distribution[0].shareOfRecordedRacesPercent,null);
 assert.equal(c.shareReportingStatus,'suppressed-sample-fewer-than-30');
 assert.equal(c.opposingSixCountAvailable,false);
 assert.equal(c.compatibleWithFourStyleSimulation,false);
 assert.equal(c.populationFrequencyIdentified,false);
 assert.equal(r.marginalOnlySixOpponentCohorts.length,3);
});
test('six-opponent marginals constrain zero-escape races but cannot identify their joint roster',()=>{
 const r=audit.produce(full,marginal);
 const byMonth=Object.fromEntries(r.marginalOnlySixOpponentCohorts
  .map(c=>[c.eventMonth,c]));
 assert.deepEqual([
  byMonth['2025-10'].absentStyleBounds.Nige.minAbsentRaces,
  byMonth['2025-10'].absentStyleBounds.Nige.maxAbsentRaces
 ],[1,33]);
 assert.deepEqual([
  byMonth['2025-12'].absentStyleBounds.Nige.minAbsentRaces,
  byMonth['2025-12'].absentStyleBounds.Nige.maxAbsentRaces
 ],[18,36]);
 assert.deepEqual([
  byMonth['2026-01'].absentStyleBounds.Nige.minAbsentRaces,
  byMonth['2026-01'].absentStyleBounds.Nige.maxAbsentRaces
 ],[19,36]);
 for(const c of r.marginalOnlySixOpponentCohorts){
  assert.equal(c.observedMatches,40);
  assert.equal(c.totalObservedOpponentRunners,240);
  assert.equal(c.noExactJointFrequencyCanBeRecovered,true);
  assert.equal(c.observedFullNineRoster,false);
  assert.equal(c.observedOpponentSixJointRoster,false);
 }
});
test('mathematical extreme bounds include zero and fully clustered fields',()=>{
 assert.deepEqual(audit.countAbsentBounds(40,6,0),
  {minAbsentRaces:40,maxAbsentRaces:40,observedRaces:40,
   identification:'tight-combinatorial-bounds-not-observed-race-frequency',
   rangeAsPercentOfObservedMatches:[100,100]});
 assert.equal(audit.countAbsentBounds(40,6,240).maxAbsentRaces,0);
 assert.equal(audit.countAbsentBounds(40,6,240).minAbsentRaces,0);
 assert.deepEqual([audit.countAbsentBounds(40,6,6).minAbsentRaces,
  audit.countAbsentBounds(40,6,6).maxAbsentRaces],[34,39]);
 assert.throws(()=>audit.countAbsentBounds(40,6,241),/Invalid finite/);
});
test('identical style totals can describe incompatible joint full-race distributions',()=>{
 const a=[
  {Nige:9,Senkou:0,Sasi:0,Oikomi:0},
  {Nige:0,Senkou:9,Sasi:0,Oikomi:0}
 ];
 const b=[
  {Nige:5,Senkou:4,Sasi:0,Oikomi:0},
  {Nige:4,Senkou:5,Sasi:0,Oikomi:0}
 ];
 const totals=rows=>Object.fromEntries(audit.STYLES.map(s=>
  [s,rows.reduce((n,c)=>n+c[s],0)]));
 assert.deepEqual(totals(a),totals(b));
 assert.equal(a.filter(x=>x.Nige===0).length,1);
 assert.equal(b.filter(x=>x.Nige===0).length,0);
 // No inference from marginals can rule out either actual joint roster.
});
test('unverified six-opponent marginals cannot masquerade as full nine-runner sample',()=>{
 const bad=structuredClone(full);
 bad.cohorts[0].observationScope='opponents_six_aggregate_only';
 assert.throws(()=>audit.validateFull(bad),/Cannot reconstruct 9/);
 const b=structuredClone(full);
 b.cohorts[0].races[0].counts.Nige=0;
 assert.throws(()=>audit.validateFull(b),/runners do not sum/);
 const c=structuredClone(full);
 c.cohorts[0].races.push(structuredClone(c.cohorts[0].races[0]));
 assert.throws(()=>audit.validateFull(c),/Repeated race key/);
 const d=structuredClone(full);
 d.cohorts[0].oonigeResolution='auto-fold-to-Nige';
 assert.throws(()=>audit.validateFull(d),/Oonige must be resolved/);
 const e=structuredClone(full);
 e.cohorts[0].races[0].selfTeamCounts=
  {Nige:2,Senkou:1,Sasi:0,Oikomi:0};
 assert.throws(()=>audit.validateFull(e),/exceed full roster/);
 const badMarginal=structuredClone(marginal);
 badMarginal.cohorts[0].observedMatches=39;
 assert.throws(()=>audit.validateMarginals(badMarginal),/Cannot infer six-opponent/);
});
test('independent, explicitly verified 30-race cohort gives descriptive shares only',()=>{
 const testData=structuredClone(full);
 const src=testData.cohorts[0];
 src.cohortId='synthetic-consented-thirty-races';
 src.samplingMethod='consented-direct-complete-race-logs';
 src.oonigeResolution='verified_no_oonige';
 src.races=Array.from({length:30},(_,i)=>({
  recordKey:'local-race-'+i,
  counts:i<20?{Nige:2,Senkou:2,Sasi:3,Oikomi:2}:
   {Nige:0,Senkou:4,Sasi:3,Oikomi:2},
  verification:'consented-full-9-observation',
  selfTeamCounts:null
 }));
 const o=audit.analyzeFull(testData)[0];
 assert.equal(o.observedRaceCount,30);
 assert.equal(o.distribution.length,2);
 assert.equal(o.distribution[0].shareOfRecordedRacesPercent,66.67);
 assert.equal(o.distribution[1].shareOfRecordedRacesPercent,33.33);
 assert.equal(o.compatibleWithFourStyleSimulation,true);
 assert.equal(o.populationFrequencyIdentified,false);
});
