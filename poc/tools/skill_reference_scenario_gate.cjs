#!/usr/bin/env node
'use strict';
/*
 * P2.29: assess how much the chosen balanced *comparison* reference depends
 * on the other recorded scenario/context assumptions. This audit does NOT
 * establish a population-representative baseline, and it cannot select one.
 * Source is an already SHA-gated 32-condition fixed-GlobalSim research output.
 */
const fs=require('node:fs');
const model=require('./globalsim_roster32.cjs');
const prior=require('./skill_specificity32_research.cjs');
const SCENARIOS=model.SCENARIOS;
const STYLES=model.STYLES;
const STRICT=new Set(['first-strict-all-matched-contexts',
 'second-strict-all-matched-contexts']);
const tally=(rows,key)=>Object.fromEntries(
 [...new Set(rows.map(x=>x[key]))].sort().map(label=>
  [label,rows.filter(x=>x[key]===label).length]));
const positive=(v,what)=>{if(!Number.isSafeInteger(v)||v<0)
 throw Error('Invalid '+what);return v};
function audit(input){
 if(!input||input.schemaVersion!==1||
  input.status!=='P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only'||
  input.source?.modelRevision!==model.PIN||
  input.source?.fixedUmaSimSkillRegistrySha256!==model.SOURCE_SHA||
  !Array.isArray(input.conditions)||input.conditions.length!==64||
  !Array.isArray(input.crossHeadcountPairs)||
  input.crossHeadcountPairs.length!==192||
  input.summary?.totalConditionHeadcounts!==64||
  input.summary?.totalConditionHeadcountPairs!==384||
  JSON.stringify(input.model?.scenarios)!==JSON.stringify(SCENARIOS)||
  JSON.stringify(input.model?.fieldSizes)!=='[9,12]')
  throw Error('P2.29 source 32 condition two-axis evidence not verified');
 const keys=new Set(),pairs=[];
 const courseSizeDistribution=new Map();
 const styleReference={};
 for(const n of [9,12]){
  styleReference[n]=Object.fromEntries(SCENARIOS.map(s=>
   [s,[...model.COUNTS[s][n]]]));
 }
 for(const condition of input.conditions){
  if(!['turf','dirt'].includes(condition.surface)||
   ![9,12].includes(condition.fieldSize)||
   typeof condition.sourceNumericId!=='string'||
   !Array.isArray(condition.modelCourseIds)||!condition.modelCourseIds.length||
   !Array.isArray(condition.pairwise)||condition.pairwise.length!==6||
   !condition.modelCourseIds.every(id=>Number.isSafeInteger(id)&&
    model.COURSES.some(c=>c.id===id&&c.surface===condition.surface)))
   throw Error('P2.29 malformed source-matched course/field condition');
  const id=[condition.sourceNumericId,condition.surface,
   condition.distanceScope,condition.timing,condition.bandId,
   condition.fieldSize].join('|');
  if(keys.has(id))throw Error('P2.29 duplicate original condition');
  keys.add(id);
  const courseCount=condition.modelCourseIds.length;
  courseSizeDistribution.set(courseCount,(courseSizeDistribution.get(courseCount)||0)+1);
  const seenPairs=new Set();
  for(const pair of condition.pairwise){
   const k=[pair.first,pair.second].join('|');
   if(seenPairs.has(k)||!prior.PAIRS.some(p=>p[0]===pair.first&&p[1]===pair.second)||
    !pair.byScenario||JSON.stringify(Object.keys(pair.byScenario))!==
      JSON.stringify(SCENARIOS))
    throw Error('P2.29 invalid or duplicated style pair');
   seenPairs.add(k);
   if(pair.balancedMatchedContextDirection!==pair.byScenario.balanced.status||
    pair.underFourArtificialRosters!==prior.acrossFour(pair.byScenario))
    throw Error('P2.29 stale within-scenario or across-scenario classification');
   for(const scenario of SCENARIOS){
    const sample=pair.byScenario[scenario];
    if(!sample||sample.scenario!==scenario||
     typeof sample.status!=='string'||
     !Number.isSafeInteger(sample.contexts)||sample.contexts<0||
     (sample.status==='held-absent-style'&&sample.contexts!==0)||
     (sample.status!=='held-absent-style'&&
       sample.contexts!==courseCount*model.MODES.length))
     throw Error('P2.29 mismatched course/mode context');
   }
   const balancedStrict=STRICT.has(pair.balancedMatchedContextDirection);
   const fullRobust=pair.underFourArtificialRosters===
    'first-higher-in-all-four-rosters-and-matched-contexts'||
    pair.underFourArtificialRosters===
    'second-higher-in-all-four-rosters-and-matched-contexts';
   if(fullRobust&&!balancedStrict)throw Error('P2.29 full robustness without balanced strict');
   pairs.push({sourceNumericId:condition.sourceNumericId,
    fieldSize:condition.fieldSize,courseCount,
    first:pair.first,second:pair.second,
    balancedStatus:pair.balancedMatchedContextDirection,
    balancedStrict,acrossFour:pair.underFourArtificialRosters,
    fourRosterRobust:fullRobust,
    balancedStrictButNotFourRobust:balancedStrict&&!fullRobust,
    noFrontStyleAbsent:pair.byScenario.noFront.status==='held-absent-style',
    balancedMixedCourseOrAbility:
     pair.byScenario.balanced.status==='held-overlap-or-context-mixed'||
     pair.byScenario.balanced.status==='held-context-direction-reversal'});
  }
 }
 if(pairs.length!==384||keys.size!==64)
  throw Error('P2.29 source condition/pair denominator drift');
 const headcount=[];
 const seenHead=new Set();
 for(const pair of input.crossHeadcountPairs){
  const key=[pair.sourceNumericId,pair.distanceScope,pair.timing,
   pair.bandId,pair.first,pair.second].join('|');
  if(seenHead.has(key))throw Error('P2.29 repeated headcount contrast');
  seenHead.add(key);
  const s9=pair.nineStatus,s12=pair.twelveStatus;
  const relation=STRICT.has(s9)&&STRICT.has(s12)?
   s9===s12?'same-strict-direction':'headcount-reversal':
   'held-at-least-one-headcount';
  if(pair.relation!==relation)throw Error('P2.29 headcount status not reproducible');
  headcount.push({relation,sourceNumericId:pair.sourceNumericId,
   first:pair.first,second:pair.second});
 }
 const balancedStrict=pairs.filter(x=>x.balancedStrict).length;
 const fourRobust=pairs.filter(x=>x.fourRosterRobust).length;
 const overlap=pairs.filter(x=>x.balancedStrictButNotFourRobust).length;
 const missingNige=pairs.filter(x=>x.noFrontStyleAbsent).length;
 if(balancedStrict!==positive(input.summary.balancedPairDirections[
  'first-strict-all-matched-contexts']||0,'balanced higher')+
 positive(input.summary.balancedPairDirections[
  'second-strict-all-matched-contexts']||0,'balanced lower')||
 fourRobust!==(input.summary.fourRosterPairDirections[
  'first-higher-in-all-four-rosters-and-matched-contexts']||0)+
 (input.summary.fourRosterPairDirections[
  'second-higher-in-all-four-rosters-and-matched-contexts']||0)||
 tally(headcount,'relation')['same-strict-direction']!==
 input.summary.crossHeadcountPairs['same-strict-direction'])
  throw Error('P2.29 summary disagrees with individual paired comparisons');
 const byHeadcount=Object.fromEntries([9,12].map(n=>{
  const subset=pairs.filter(x=>x.fieldSize===n);
  return [n,{pairs:subset.length,
   balancedStrict:subset.filter(x=>x.balancedStrict).length,
   fourRosterStrict:subset.filter(x=>x.fourRosterRobust).length,
   balancedHeld:subset.filter(x=>!x.balancedStrict).length,
   balancedStrictButNotFourRobust:subset.filter(x=>x.balancedStrictButNotFourRobust).length,
   absentStyleInNoFront:subset.filter(x=>x.noFrontStyleAbsent).length}];
 }));
 return {
  schemaVersion:1,status:'P2.29-comparison-reference-context-sensitivity-not-population-validation',
  originalFixedModelRevision:model.PIN,
  sourceSkillRegistrySha256:model.SOURCE_SHA,
  decisionStatus:{
   balancedRoster:'adopted-fixed-comparison-control-representativeness-unverified',
   headcount:'both-9-and-12-separate-no-population-weights',
   course:'only-original-skill-eligible-fixed-model-courses-unweighted',
   ability:'equal-and-artificial-jitter10-tested-not-real-population-calibrated',
   opponentSkills:'no-skill-control-not-typical-trained-opponents',
   raceType:'unselected-no-default-event-or-round',
   surface:'source-restricted-turf-or-dirt-not-universalized',
   realRosterJointDistribution:'not-identified',
   selectedProductStandard:'hold-existing-user-approved-comparison-control',
   newSuitabilityLabel:'not-authorized'
  },
  fixedReferenceRosterCounts:styleReference,
  comparisonSummary:{
   originalSourceConditions:64,
   stylePairComparisons:384,
   balancedStrict,
   balancedHeld:384-balancedStrict,
   strictAcrossAllFourArtificialRosters:fourRobust,
   balancedStrictButNotFourRobust:overlap,
   noFrontAbsencePairComparisons:missingNige,
   crossHeadcountSameStrict:headcount.filter(x=>
    x.relation==='same-strict-direction').length,
   crossHeadcountHeld:headcount.filter(x=>
    x.relation==='held-at-least-one-headcount').length,
   crossHeadcountStrictReverse:headcount.filter(x=>
    x.relation==='headcount-reversal').length,
   sourceConditionHeadcountCourseCountDistribution:
    [...courseSizeDistribution.entries()].sort((a,b)=>a[0]-b[0])
     .map(([eligibleModelCourses,conditionHeadcounts])=>
      ({eligibleModelCourses,conditionHeadcounts})),
   byHeadcount,
   byFourRosterStatus:tally(pairs,'acrossFour')
  },
  // Deliberately no real-world weights or adopted single aggregate score.
  unresolvedReferenceDecisions:[
   {axis:'competition-context',question:'What event, mode and round is the standard intended to represent?',
    minimumEvidence:'Define use case; distinguish 9-horse PvP from 12-horse events/NPC participation.'},
   {axis:'opponent-joint-roster',question:'Are fixed equal-style rosters representative of the chosen competition?',
    minimumEvidence:'Repeated full field-level 9/12 horse joint observations in the same event/round; assess large runners, repeats and selection.'},
   {axis:'field-size',question:'Is 9 or 12 relevant for each target setting? Should both be shown independently?',
    minimumEvidence:'Mode/competition rule and matched evidence; never average 9 and 12 with invented weights.'},
   {axis:'course',question:'Which eligible course should be assumed, and what weight if multiple?',
    minimumEvidence:'Target event course or documented target event frequency distribution, not unweighted means as real popularity.'},
   {axis:'surface-and-going',question:'What turf/dirt and track-state conditions apply?',
    minimumEvidence:'Respect exact source limits and target event; do not transfer turf results to dirt by default.'},
   {axis:'runner-strength',question:'Are equal and ±10% artificial stat spreads representative?',
    minimumEvidence:'Validate actual trained horses/skills/aptitudes; existing no-skill simulations are only controls.'},
   {axis:'stability-and-transfer',question:'Does chosen context preserve relevant four-style comparisons?',
    minimumEvidence:'Matched course, headcount, roster, seed and skill source AND; keep holds/reversals as unknown.'},
   {axis:'public-adoption',question:'Has the user approved the proposed standard and disclosure?',
    minimumEvidence:'User decision after evidence review; do not change P3/P4 or existing D-002 by code alone.'}
  ],
  limitations:[
   'This audit compares choices already simulated. A repeatable comparison control is NOT a validated opponent-population prior.',
   'Balanced strictness within courses/ability modes is not representativeness and does not imply full skills trigger.',
   'No-front absent Nige means unavailable comparison, NOT zero suitability.',
   'Repeated source signatures, pairwise comparisons and matched races share source trajectories and are not independent population samples.',
   'Course and ability modes are artificially enumerated; they cannot be interpreted as realistic frequency weights.',
   'No high/mid/low threshold, model rate, P3 scoring, public UI or existing user decision changed.'
  ]
 };
}
function main(args){
 if(args.length!==2)throw Error('Usage: skill_reference_scenario_gate.cjs <source32-two-axis.json> <output.json>');
 const [input,output]=args;
 const report=audit(JSON.parse(fs.readFileSync(input,'utf8')));
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log('P2_29_REFERENCE_CONTEXT_AUDIT='+JSON.stringify({
  decisionStatus:report.decisionStatus,summary:report.comparisonSummary,
  unresolved:report.unresolvedReferenceDecisions.map(x=>x.axis)}));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={audit,main,STRICT};
