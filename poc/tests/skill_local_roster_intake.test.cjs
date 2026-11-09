'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const intake=require('../tools/skill_local_roster_intake.cjs');
const metadata={
 schemaVersion:1,cohortId:'cm-2026-11-test-private',
 gameMode:'champions_meeting',eventMonth:'2026-11',
 round:'A_preliminary',captureMethod:'consecutive',
 expectedRaceCount:2
};
const header=intake.HEADER.join(',');
const sample=[
 'local-001,0,1,2,0,1,3,1,1,unknown',
 'local-002,1,1,0,1,0,3,2,1,verified-none'
];
const csv=(rows=sample)=>header+'\n'+rows.join('\n')+'\n';
const fresh=(m=metadata,c=csv())=>intake.aggregate(m,c);
test('local nine-runner intake separates three own and six opposing runner counts',()=>{
 const r=fresh();
 assert.equal(r.schemaVersion,1);
 assert.equal(r.status,'local-private-derived-roster-summary-not-population-estimate');
 assert.equal(r.sample.recordedMatches,2);
 assert.equal(r.sample.captureMethod,'consecutive');
 assert.equal(r.sample.declaredCompleteness,'matches-declared-count');
 assert.deepEqual(r.runners.ownThreeCounts,
  {Nige:1,Senkou:2,Sasi:2,Oikomi:1});
 assert.deepEqual(r.runners.opponentsSixCounts,
  {Nige:1,Senkou:6,Sasi:3,Oikomi:2});
 assert.deepEqual(r.runners.fullNineCounts,
  {Nige:2,Senkou:8,Sasi:5,Oikomi:3});
 assert.equal(r.distinctFullNineRosterPatterns,2);
 assert(r.fullNineRosterPatterns.every(x=>
  x.shareOfRecordedMatchesPercent===null));
 assert.deepEqual(r.noStyleRaces.ownAndOpponentsNine,
  {Nige:0,Senkou:0,Sasi:0,Oikomi:0});
 assert.deepEqual(r.noStyleRaces.opponentsSixOnly,
  {Nige:1,Senkou:0,Sasi:0,Oikomi:0});
 assert.equal(r.oonige.unverifiedRaceCount,1);
 assert.equal(r.oonige.classificationCompatibleWithFourStyleSimulation,false);
 assert.equal(r.sample.matchedPopulationRepresentative,false);
 assert.equal(r.modelSimulationWeightsAuthorized,false);
 assert.equal(r.thresholdDecisionAuthorized,false);
});
test('an empty source match race fails, and repeated local key cannot double count',()=>{
 assert.throws(()=>fresh(metadata,header+'\n'),/header and 1|1\.\.50000/);
 assert.throws(()=>fresh(metadata,csv([sample[0],sample[0]])),
  /Repeated local race key/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('local-001','user@example.com')])),
  /Anonymous local row key invalid/);
});
test('all four style numbers and own/opp field size must be exact integers',()=>{
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('0,1,2,0','0,1,1,0')])),
  /Own roster must total three/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('1,3,1,1','1,3,1,0')])),
  /opponent roster six/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('0,1,2,0','0,1,2,1.0')])),
  /Non-integer roster/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('0,1,2,0','-1,1,3,0')])),
  /Non-integer roster/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('0,1,2,0','0,1,02,0')])),
  /Non-integer roster/);
});
test('strict CSV blocks player identifiers and unexpected or quoted fields',()=>{
 assert.throws(()=>fresh(metadata,csv().replace('race_key,','player_name,race_key,')),
  /Unexpected CSV header/);
 assert.throws(()=>fresh(metadata,csv([sample[0]+',trainer_name'])),
  /Wrong number/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('local-001','"local-001"')])),
  /quoted/);
 assert.throws(()=>fresh(metadata,csv([sample[0].replace('unknown','verified')])) ,
  /Oonige must/);
});
test('metadata requires scope and excludes player handles or arbitrary identifying keys',()=>{
 assert.throws(()=>fresh({...metadata,round:'LoH'}),/league\/round/);
 assert.throws(()=>fresh({...metadata,eventMonth:'invalid'}),/event month/);
 assert.throws(()=>fresh({...metadata,captureMethod:'representative'}),/Sampling method/);
 assert.throws(()=>fresh({...metadata,playerName:'Alice'}),/Metadata must not/);
 assert.throws(()=>fresh({...metadata,notes:'email me@domain'}),/Notes may not/);
 assert.throws(()=>fresh({...metadata,expectedRaceCount:1}),/exceed declared/);
 const result=fresh({...metadata,expectedRaceCount:3});
 assert.equal(result.sample.declaredCompleteness,'short-of-declared-count');
 assert.equal(result.sample.recordedMatches,2);
});
test('a local raw record key, user note or private metadata cannot be exported',()=>{
 const r=fresh({...metadata,notes:'private diary'});
 const out=JSON.stringify(r);
 assert(!out.includes('local-001'));
 assert(!out.includes('local-002'));
 assert(!out.includes('private diary'));
 assert(!out.includes('sourceUrl'));
 assert.equal(r.privacy.rawIndividualRowsExported,false);
 assert.equal(r.privacy.noNetworkAccessOrExternalSubmission,true);
});
test('>=30 observed matches only permits descriptive shares, NOT a representative prior',()=>{
 const rows=Array.from({length:30},(_,i)=>{
  const a='r'+String(i).padStart(3,'0');
  return i<20?a+',0,1,2,0,1,3,1,1,verified-none':
   a+',1,1,0,1,0,3,2,1,verified-none';
 });
 const r=fresh({...metadata,expectedRaceCount:30},csv(rows));
 assert.equal(r.sample.recordedMatches,30);
 assert.equal(r.distinctFullNineRosterPatterns,2);
 assert.deepEqual(r.fullNineRosterPatterns.map(x=>
  x.shareOfRecordedMatchesPercent),[66.67,33.33]);
 assert.equal(r.oonige.classificationCompatibleWithFourStyleSimulation,true);
 assert.equal(r.sample.matchedPopulationRepresentative,false);
 assert.equal(r.publishedPrevalenceEstimationAuthorized,false);
 assert.equal(r.modelSimulationWeightsAuthorized,false);
});
test('no-style 9-runner and no-style 6-opponent scenarios remain different',()=>{
 const allNonnige='no-nige,0,1,2,0,0,2,2,2,unknown';
 const ownNige='own-nige,1,1,1,0,0,2,2,2,unknown';
 const r=fresh({...metadata,expectedRaceCount:null},
  csv([allNonnige,ownNige]));
 assert.equal(r.noStyleRaces.opponentsSixOnly.Nige,2);
 assert.equal(r.noStyleRaces.ownAndOpponentsNine.Nige,1);
});
