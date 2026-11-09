#!/usr/bin/env node
'use strict';
/*
 * LOCAL-ONLY research intake for observed CM 9-runner roster counts.
 * Never contacts a server, stores individual player data, or exports raw
 * race keys. This is NOT an observed population estimator or a P3 prior.
 */
const fs=require('node:fs');
const STYLES=Object.freeze(['Nige','Senkou','Sasi','Oikomi']);
const HEADER=Object.freeze(['race_key',
 'own_nige','own_senkou','own_sasi','own_oikomi',
 'opp_nige','opp_senkou','opp_sasi','opp_oikomi',
 'oonige_check']);
const PHASES=Object.freeze([
 'round1','A_preliminary','B_preliminary','A_final','B_final'
]);
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const count=(v)=>Number.isSafeInteger(v)&&v>=0;
const total=o=>STYLES.reduce((s,k)=>s+o[k],0);
const signature=o=>STYLES.map(s=>o[s]).join('-');
function parseCsv(text){
 assert(typeof text==='string'&&text.length<=2000000,
  'Only local, bounded CSV input supported');
 text=text.replace(/^\uFEFF/,'');
 const lines=text.split(/\r?\n/);
 if(lines.at(-1)==='')lines.pop();
 assert(lines.length>=2&&lines.length<=50001,
  'Provide one header and 1..50000 observed race rows');
 // Strict no-quoted CSV avoids formula/linebreak ambiguities and
 // refuses extra columns that might contain identifying information.
 const headers=lines[0].split(',');
 assert(headers.length===HEADER.length&&
  headers.every((h,i)=>h===HEADER[i]),
  'Unexpected CSV header: exact roster-only columns required, no names or IDs');
 return lines.slice(1).map((line,i)=>{
  assert(line.length>0&&!/[\r"\0]/.test(line),
   'Empty/quoted/invalid CSV race row '+(i+2));
  const vals=line.split(',');
  assert(vals.length===HEADER.length,
   'Wrong number of roster-only columns on row '+(i+2));
  return Object.fromEntries(HEADER.map((key,j)=>[key,vals[j]]));
 });
}
function validateMeta(meta){
 assert(meta&&typeof meta==='object'&&
  !Array.isArray(meta)&&meta.schemaVersion===1,
  'Require local collector metadata schema v1');
 const allowed=new Set(['schemaVersion','cohortId','gameMode','eventMonth',
  'round','captureMethod','expectedRaceCount','notes']);
 assert(Object.keys(meta).every(k=>allowed.has(k)),
  'Metadata must not contain player handles, timestamps or raw logs');
 assert(typeof meta.cohortId==='string'&&
  /^[a-z0-9][a-z0-9_-]{7,80}$/.test(meta.cohortId),
  'Cohort key must be non-identifying ASCII');
 assert(meta.gameMode==='champions_meeting',
  'Only nine-runner Champions Meeting data supported');
 assert(/^20\d\d-(0[1-9]|1[0-2])$/.test(meta.eventMonth),
  'Missing event month');
 assert(PHASES.includes(meta.round),'Unrecognized league/round');
 assert(['consecutive','selected','unknown'].includes(meta.captureMethod),
  'Sampling method must disclose whether races were recorded consecutively');
 assert(meta.expectedRaceCount===null||meta.expectedRaceCount===undefined||
  count(meta.expectedRaceCount)&&meta.expectedRaceCount>0,
  'Expected number of attempts must be a positive integer or null');
 assert(meta.notes===undefined||
  (typeof meta.notes==='string'&&meta.notes.length<=240&&
   !/@|https?:\/\/|\d{5,}|[\\/]/.test(meta.notes)),
  'Notes may not include URLs, handles, paths or personal identifiers');
 return true;
}
function validateRows(rows){
 assert(Array.isArray(rows)&&rows.length>0&&rows.length<=50000,
  'Expect 1..50000 independent recorded matches');
 const seen=new Set(),output=[];
 for(const [i,r] of rows.entries()){
  assert(typeof r.race_key==='string'&&
   /^[a-z0-9][a-z0-9_-]{0,40}$/.test(r.race_key),
   'Anonymous local row key invalid '+(i+2));
  assert(!seen.has(r.race_key),
   'Repeated local race key '+r.race_key);
  seen.add(r.race_key);
  const own={},opp={};
  for(const [dest,prefix] of [[own,'own_'],[opp,'opp_']]){
   for(const s of STYLES){
    const v=r[prefix+s.toLowerCase()];
    assert(typeof v==='string'&&/^(0|[1-9][0-9]{0,3})$/.test(v),
     'Non-integer roster value at row '+(i+2));
    dest[s]=Number(v);
   }
  }
  assert(total(own)===3&&total(opp)===6,
   'Own roster must total three and opponent roster six at row '+(i+2));
  assert(['unknown','verified-none'].includes(r.oonige_check),
   'Oonige must be explicitly marked unknown or independently verified absent');
  output.push({own,opp,oonigeCheck:r.oonige_check});
 }
 return output;
}
function aggregate(metadata,csv){
 validateMeta(metadata);
 const rows=validateRows(parseCsv(csv));
 if(metadata.expectedRaceCount!==null&&
  metadata.expectedRaceCount!==undefined)
  assert(rows.length<=metadata.expectedRaceCount,
   'Recorded matches exceed declared sampling scope');
 const n=rows.length;
 const counts=(list)=>{
  const result=Object.fromEntries(STYLES.map(k=>[k,0]));
  for(const x of list)for(const s of STYLES)result[s]+=x[s];
  return result;
 };
 const own=counts(rows.map(x=>x.own)),
  opponents=counts(rows.map(x=>x.opp));
 const all=counts(rows.map(x=>
  Object.fromEntries(STYLES.map(s=>[s,x.own[s]+x.opp[s]])));
 const patterns=new Map();
 const absentSix=Object.fromEntries(STYLES.map(s=>[s,0]));
 const absentNine=Object.fromEntries(STYLES.map(s=>[s,0]));
 for(const r of rows){
  const joint=Object.fromEntries(STYLES.map(s=>[s,r.own[s]+r.opp[s]]));
  const key=signature(joint);
  if(!patterns.has(key))patterns.set(key,{
   counts:joint,recordedMatches:0});
  patterns.get(key).recordedMatches++;
  for(const s of STYLES){
   if(r.opp[s]===0)absentSix[s]++;
   if(joint[s]===0)absentNine[s]++;
  }
 }
 const oonigeNotVerified=rows.filter(x=>x.oonigeCheck==='unknown').length;
 const complete=metadata.expectedRaceCount===undefined||
  metadata.expectedRaceCount===null?'not-declared':
   n===metadata.expectedRaceCount?'matches-declared-count':'short-of-declared-count';
 const patternsSorted=[...patterns.values()].sort((a,b)=>
  b.recordedMatches-a.recordedMatches||
  signature(a.counts).localeCompare(signature(b.counts)))
  .map(v=>({...v,shareOfRecordedMatchesPercent:n>=30?
   Number((100*v.recordedMatches/n).toFixed(2)):null}));
 return {schemaVersion:1,
  status:'local-private-derived-roster-summary-not-population-estimate',
  cohortId:metadata.cohortId,
  eventMonth:metadata.eventMonth,round:metadata.round,
  gameMode:metadata.gameMode,fieldSize:9,
  sourceKind:'self-observed-local-counts-not-independent-verification',
  sample:{captureMethod:metadata.captureMethod,
   recordedMatches:n,expectedMatches:metadata.expectedRaceCount??null,
   declaredCompleteness:complete,
   repeatedOpponentTeamsIndependentlyVerified:false,
   matchedPopulationRepresentative:false},
  runners:{ownThreeCounts:own,opponentsSixCounts:opponents,fullNineCounts:all},
  distinctFullNineRosterPatterns:patternsSorted.length,
  fullNineRosterPatterns:patternsSorted,
  noStyleRaces:{
   ownAndOpponentsNine:absentNine,opponentsSixOnly:absentSix
  },
  oonige:{unverifiedRaceCount:oonigeNotVerified,
   classificationCompatibleWithFourStyleSimulation:oonigeNotVerified===0,
   note:'verified-none must be checked against actual race, unknown is NOT zero Oonige'},
  publishedPrevalenceEstimationAuthorized:false,
  modelSimulationWeightsAuthorized:false,
  thresholdDecisionAuthorized:false,
  privacy:{
   rawRaceKeysExported:false,
   rawIndividualRowsExported:false,
   playerNamesOrHandlesExported:false,
   noNetworkAccessOrExternalSubmission:true,
   generatedSummaryShouldRemainPrivateUntilSourceRightsAndSamplingReviewed:true
  },
  cautions:[
   'Local user-entered counts are not independent verified observations.',
   'The sample may be convenience-selected and opponents can repeat across matches.',
   'N<30 suppresses roster percentages only as a disclosure guard, not a statistical sufficiency boundary.',
   'A >=30 sample is descriptive only and NEVER automatically becomes an all-players frequency prior.',
   'This derived JSON must not be committed as public game evidence without explicit approval and source-rights review.',
   'The P3 standard remains the separately approved artificial balanced roster.'
  ]};
}
function main([metaPath,csvPath,outPath]){
 if(!outPath)throw Error(
  'Usage: node poc/tools/skill_local_roster_intake.cjs metadata.json private-races.csv /private/local/summary.json');
 const metadata=JSON.parse(fs.readFileSync(metaPath,'utf8'));
 const summary=aggregate(metadata,fs.readFileSync(csvPath,'utf8'));
 fs.writeFileSync(outPath,JSON.stringify(summary,null,2)+'\n',
  {flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:summary.status,
  eventMonth:summary.eventMonth,round:summary.round,
  recordedMatches:summary.sample.recordedMatches,
  oonigeUnverified:summary.oonige.unverifiedRaceCount,
  output:'local derived JSON only (raw rows and keys excluded)'},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={HEADER,STYLES,PHASES,parseCsv,validateMeta,
 validateRows,aggregate,main};
