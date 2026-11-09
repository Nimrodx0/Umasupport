#!/usr/bin/env node
'use strict';
/*
 * P2: audit real-source team composition evidence WITHOUT recovering a
 * joint race distribution from per-style marginals. Research only.
 *
 * No direct identifiers, screenshots, raw race replays, player names, model
 * weights, skill activation probabilities or card suitability labels.
 */
const fs=require('node:fs');
const STYLES=Object.freeze(['Nige','Senkou','Sasi','Oikomi']);
const EXACT_COUNTS=new Set(STYLES);
function assert(ok,message){if(!ok)throw new Error(message)}
function integer(v){return Number.isSafeInteger(v)&&v>=0}
function counts(x,expected,label){
 assert(x&&typeof x==='object'&&!Array.isArray(x)&&
  Object.keys(x).length===4&&
  Object.keys(x).every(s=>EXACT_COUNTS.has(s))&&
  STYLES.every(s=>integer(x[s])),label+': requires exactly four integer styles');
 assert(STYLES.reduce((a,s)=>a+x[s],0)===expected,
  label+': runners do not sum to declared field');
 return x;
}
function info(c){
 assert(typeof c.cohortId==='string'&&
  /^[a-z0-9][a-z0-9_-]{7,100}$/.test(c.cohortId),
  'Missing stable source cohort ID');
 assert(c.gameMode==='champions_meeting',
  'Only CM matching with known trainer composition is audited');
 assert(/^20\d\d-(0[1-9]|1[0-2])$/.test(c.eventMonth),
  'Missing competition month');
 assert(['A_preliminary','B_preliminary','round1','A_final','B_final'].includes(c.round),
  'Unknown round, cannot pool by unrelated matching population');
 assert(c.source&&/^https:\/\//.test(c.source.url)&&
  /^20\d\d-\d\d-\d\d$/.test(c.source.publishedDate)&&
  typeof c.source.sourceSection==='string'&&c.source.sourceSection.length>0,
  'Missing dated, attributable public source and section');
}
function fingerprint(x){return STYLES.map(s=>x[s]).join('-')}
function validateFull(d){
 assert(d?.schemaVersion===1&&
  d.status==='public-one-race-aggregate-only-not-population'&&
  Array.isArray(d.cohorts)&&d.cohorts.length>0,'Expected derived full-race source dataset');
 const ids=new Set();
 for(const c of d.cohorts){
  info(c);
  assert(!ids.has(c.cohortId),'Duplicate public cohort ID');ids.add(c.cohortId);
  assert(c.observationScope==='full_nine_runners'&&c.fieldSize===9,
   'Cannot reconstruct 9 runners from six opponents or style marginals');
  assert(c.oonigeResolution==='not_distinguished'||
   c.oonigeResolution==='verified_no_oonige',
   'Oonige must be resolved or explicitly held unknown');
  assert(['one-author-reported-final-not-random',
   'consented-direct-complete-race-logs'].includes(c.samplingMethod),
   'Unknown sampling provenance');
  assert(Array.isArray(c.races)&&c.races.length>0,
   'A cohort needs individually counted races');
  const seen=new Set();
  for(const r of c.races){
   assert(r&&typeof r.recordKey==='string'&&
    /^[a-z0-9][a-z0-9_-]{1,100}$/.test(r.recordKey),
    'Missing locally anonymous race key');
   assert(!seen.has(r.recordKey),'Repeated race key within source cohort');
   seen.add(r.recordKey);
   counts(r.counts,9,'Full source race');
   assert(r.verification==='reported-full-race-composition'||
    r.verification==='consented-full-9-observation',
    'Source is not nine-race joint roster evidence');
   if(r.selfTeamCounts!==null&&r.selfTeamCounts!==undefined){
    counts(r.selfTeamCounts,3,'Own three runners');
    for(const s of STYLES)assert(r.selfTeamCounts[s]<=r.counts[s],
     'Own three runners exceed full roster count');
   }
  }
 }
 return true;
}
function validateMarginals(d){
 assert(d?.schemaVersion===1&&
  d.status==='event-specific-six-opponent-marginals-not-joint-race-data'&&
  Array.isArray(d.cohorts)&&d.cohorts.length>0,'Expected marginal-only source dataset');
 const ids=new Set();
 for(const c of d.cohorts){
  info(c);
  assert(!ids.has(c.cohortId),'Duplicate marginal cohort');ids.add(c.cohortId);
  assert(c.observationScope==='opponents_six_aggregate_only'&&
   integer(c.observedMatches)&&c.observedMatches>0&&
   c.opponentsPerMatch===6&&
   c.totalObservedOpponents===c.observedMatches*6,
   'Cannot infer six-opponent samples or matching count from raw style totals');
  counts(c.counts,c.totalObservedOpponents,'Six-opponent source marginals');
  assert(['prior-source-audit-20261105','public-text-direct-20261109'].includes(
   c.verification),'Source verification state unknown');
 }
 return true;
}
function countAbsentBounds(matched,observedSlots,styleCount){
 assert(Number.isSafeInteger(matched)&&matched>0&&
  Number.isSafeInteger(observedSlots)&&observedSlots>0&&
  integer(styleCount)&&styleCount<=matched*observedSlots,
  'Invalid finite marginal-composition bound problem');
 // Disperse this style one per race for minimum absent count;
 // pack up to observedSlots per race for maximum absent count.
 const minEmpty=matched-Math.min(matched,styleCount);
 const maxEmpty=matched-Math.ceil(styleCount/observedSlots);
 assert(minEmpty>=0&&maxEmpty>=minEmpty&&maxEmpty<=matched,
  'Marginal bound constraints inconsistent');
 return {minAbsentRaces:minEmpty,maxAbsentRaces:maxEmpty,
  observedRaces:matched,
  identification:'tight-combinatorial-bounds-not-observed-race-frequency',
  rangeAsPercentOfObservedMatches:[
   Number((100*minEmpty/matched).toFixed(2)),
   Number((100*maxEmpty/matched).toFixed(2))
  ]};
}
function analyzeFull(d){
 validateFull(d);
 return d.cohorts.map(c=>{
  const patterns=new Map();
  for(const r of c.races){
   const f=fingerprint(r.counts);
   if(!patterns.has(f))patterns.set(f,{counts:{...r.counts},matches:0});
   patterns.get(f).matches++;
  }
  const n=c.races.length;
  return {
   cohortId:c.cohortId,source:c.source,eventMonth:c.eventMonth,
   round:c.round,observationScope:c.observationScope,
   observedRaceCount:n,uniqueRecordedFullRosters:patterns.size,
   distribution:[...patterns.values()].sort((a,b)=>
    b.matches-a.matches||fingerprint(a.counts).localeCompare(fingerprint(b.counts)))
    .map(x=>({...x,shareOfRecordedRacesPercent:n>=30?
     Number((100*x.matches/n).toFixed(2)):null})),
   shareReportingStatus:n<30?'suppressed-sample-fewer-than-30':
    'descriptive-nonrepresentative-with-source-denominator',
   opposingSixCountAvailable:c.races.every(r=>r.selfTeamCounts!==null&&
    r.selfTeamCounts!==undefined),
   oonigeResolution:c.oonigeResolution,
   compatibleWithFourStyleSimulation:c.oonigeResolution==='verified_no_oonige',
   jointRosterObserved:true,
   populationFrequencyIdentified:false,
   provenance:c.samplingMethod,
   warnings:[
    'A recorded final is a selected individual match; no prevalence estimation from one race.',
    'No population weights for P2/P3 or skill activation rates are authorized.',
    'Reporter self-selection, duplicated opponents between reporters and group/round sampling may bias a larger cohort.',
    'Oonige has no independently identifiable count unless a source verifies it.'
   ]
  };
 });
}
function analyzeMarginals(d){
 validateMarginals(d);
 return d.cohorts.map(c=>({
  cohortId:c.cohortId,source:c.source,eventMonth:c.eventMonth,
  round:c.round,observationScope:c.observationScope,
  observedMatches:c.observedMatches,
  totalObservedOpponentRunners:c.totalObservedOpponents,
  aggregateCounts:{...c.counts},
  absentStyleBounds:Object.fromEntries(STYLES.map(style=>[
   style,countAbsentBounds(c.observedMatches,c.opponentsPerMatch,c.counts[style])])),
  observedFullNineRoster:false,observedOpponentSixJointRoster:false,
  noExactJointFrequencyCanBeRecovered:true,
  verification:c.verification,
  warnings:[
   'All marginal bounds refer to six opponents, not the nine-person race including the reporter own three.',
   'The count of zero-style matches is a mathematical interval, NOT a measured interval or statistical confidence interval.',
   'Per-style totals do not preserve which four styles co-occurred in one race.',
   'Round, event and reporting sources cannot be mixed into an all-events joint roster prior.',
   'The source Nige category may combine Nige and Oonige; do not claim the simulation four-bucket roster is confirmed.'
  ]
 }));
}
function produce(full,marginals){
 const fullCohorts=analyzeFull(full),marginalCohorts=analyzeMarginals(marginals);
 const ids=new Set(fullCohorts.map(x=>x.cohortId));
 for(const c of marginalCohorts){
  assert(!ids.has(c.cohortId),'Marginal and full observation cohort collision');
  ids.add(c.cohortId);
 }
 return {schemaVersion:1,
  status:'P2-public-source-roster-evidence-audit-no-population-joint-prior',
  fullNineCohorts:fullCohorts,
  marginalOnlySixOpponentCohorts:marginalCohorts,
  findings:{fullyDescribedPublicNineRaces:
   fullCohorts.reduce((a,x)=>a+x.observedRaceCount,0),
   independentFullRosterPopulationEstimateAvailable:false,
   opponentSixStyleMarginalCohorts:marginalCohorts.length,
   sourceSpecificMediansNotComputed:true,
   learnedRealMatchupWeights:false,
   calibratedModelToObservedRosters:false},
  decision:{
   P2:'research only, no guessed frequencies and no skill proc rates',
   P3:'keep fixed balanced standard 9/12 roster, do not weight by these sources',
   optionalCustomRoster:'separate future user-approved feature only'
  },
  caveats:[
   'One full nine-runner final match supplies one observed vector, not a joint population frequency.',
   'Three 240-opponent observations are six opposing horses times 40 matches each and do not contain per-match joint vectors.',
   'A mathematical extremal bound is not an observed rate or game sampling confidence interval.',
   'There is no automatic pooling across course, month, race round or sampling provenance.',
   'The source split of Oonige and Nige is not independently validated for these reports.',
   'No unapproved external original text, personal race logs or screenshots are redistributed.'
  ]};
}
function main([fullPath,marginalPath,outPath]){
 if(!outPath)throw Error('Usage: skill_joint_roster_source_audit.cjs full-races.json marginals.json output.json');
 const result=produce(JSON.parse(fs.readFileSync(fullPath,'utf8')),
  JSON.parse(fs.readFileSync(marginalPath,'utf8')));
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,findings:result.findings,
  exemplar:result.fullNineCohorts.map(x=>({cohort:x.cohortId,
   n:x.observedRaceCount,distribution:x.distribution})),
  sixOpponentNigeBounds:result.marginalOnlySixOpponentCohorts.map(x=>({
   eventMonth:x.eventMonth,bounds:x.absentStyleBounds.Nige}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STYLES,counts,validateFull,validateMarginals,countAbsentBounds,
 analyzeFull,analyzeMarginals,produce,main};
