#!/usr/bin/env node
'use strict';
/* P2 exploratory sensitivity audit. Never alters game data or skill labels.
 * Compares condition-specific GlobalSim model estimates; no activation-rate inference.
 */
const fs=require('node:fs');
const pilot=require('./globalsim_position_pilot.cjs');
const expanded=require('./globalsim_position_expanded.cjs');
const windows=require('./globalsim_window_profile.cjs');

const pp=x=>Number((100*x).toFixed(6));
const key=(row,fields)=>fields.map(f=>String(row[f])).join('|');
const cmp=(a,b)=>a.localeCompare(b,'en');
const stable=(a,b)=>cmp(JSON.stringify(a),JSON.stringify(b));
function validate(summary,profile){
 if(!summary||summary.schemaVersion!==2||summary.sourceRevision!==pilot.PIN||
  summary.status!=='experimental-GlobalSim-v77-probabilities-not-actual-skill-rates'||
  !Number.isInteger(summary.raceCount)||summary.raceCount<1||
  !Array.isArray(summary.samples)||!summary.samples.length||
  !profile||profile.schemaVersion!==1||profile.sourceRevision!==pilot.PIN||
  profile.sourceSummarySchema!==2||profile.sourceRaceCount!==summary.raceCount||
  profile.sourceSeedCount!==summary.seedCount||
  profile.status!=='model-window-rank-occupancy-estimate-not-skill-activation-rate'||
  !Array.isArray(profile.windows)||!profile.windows.length)
  throw Error('Mismatched pinned GlobalSim summary and window profile');
 const fromSummary=new Map();
 for(const s of summary.samples){
  windows.assertSample(s);
  const k=key(s,['courseId','fieldSize','scenario','mode','style','fraction']);
  if(fromSummary.has(k))throw Error('Duplicate original model sample '+k);
  fromSummary.set(k,s);
 }
 return fromSummary;
}
function inspect(summary,profile){
 const source=validate(summary,profile);
 const observed=new Set(),rows=[];
 let unknownRankCounts=0;
 for(const s of summary.samples)unknownRankCounts+=s.unknown;
 for(const w of profile.windows){
  if(!w||![9,12].includes(w.fieldSize)||
   !expanded.COURSES.some(c=>c.id===w.courseId)||
   !expanded.STYLES.includes(w.style)||
   !(w.scenario in expanded.SOURCES)||
   !expanded.MODES.includes(w.mode)||
   !windows.WINDOWS.some(def=>def.id===w.windowId&&
    Math.abs(def.startRate-w.startRate)<1e-8&&
    Math.abs(def.endRate-w.endRate)<1e-8))
   throw Error('Invalid window provenance/identity');
  const k=key(w,['courseId','fieldSize','scenario','mode','style','windowId']);
  if(observed.has(k))throw Error('Duplicate window estimate '+k);
  observed.add(k);
  if(!['estimate','incomplete-grid','no-valid-ranks'].includes(w.status))
   throw Error('Unknown window state');
  if(w.status==='estimate'&&
   (!Number.isFinite(w.pTopHalf)||!Number.isFinite(w.pBackHalf)||
    w.pTopHalf<0||w.pTopHalf>1||w.pBackHalf<0||w.pBackHalf>1||
    Math.abs(w.pTopHalf+w.pBackHalf-1)>1e-8))
   throw Error('Invalid window probability');
  if(w.status!=='estimate'&&
   (w.pTopHalf!==null||w.pBackHalf!==null))
   throw Error('Missing window cannot contain probability');
  if(!Number.isInteger(w.sampledPoints)||w.sampledPoints<0)
   throw Error('Invalid window observation count');
  const expected=pilot.POINTS.filter(f=>f>=w.startRate-1e-7&&
   f<=w.endRate+1e-7);
  for(const f of expected){
   if(!source.has(key({...w,fraction:f},[
    'courseId','fieldSize','scenario','mode','style','fraction'])))
    throw Error('Window references absent source model fraction');
  }
  rows.push(w);
 }
 const complete=rows.filter(w=>w.status==='estimate');
 function pair(fields,valueA,valueB,selector){
  const paired=new Map();
  for(const w of complete){
   const k=key(w,fields);
   if(!paired.has(k))paired.set(k,{});
   const pair=paired.get(k),val=w[selector];
   if(pair[val])throw Error('Duplicate paired window '+k);
   pair[val]=w;
  }
  const output=[];
  for(const [k,items] of paired){
   if(!items[valueA]||!items[valueB])continue;
   const a=items[valueA],b=items[valueB];
   const identity=Object.fromEntries(fields.map(f=>[f,a[f]]));
   output.push({...identity,first:valueA,second:valueB,
    firstTopPercent:pp(a.pTopHalf),secondTopPercent:pp(b.pTopHalf),
    deltaTopPercentagePoints:pp(b.pTopHalf-a.pTopHalf)});
  }
  return output.sort(stable);
 }
 const firstToFull=pair(['courseId','fieldSize','scenario','mode','style'],
  'final-first-half','final-full','windowId');
 const equalToJitter=pair(['courseId','fieldSize','scenario','style','windowId'],
  'equal','jitter10','mode');
 const nineToTwelve=pair(['courseId','scenario','mode','style','windowId'],
  9,12,'fieldSize');
 const spreadGroups=new Map();
 for(const w of complete){
  const fields=['courseId','fieldSize','mode','style','windowId'];
  const k=key(w,fields);
  if(!spreadGroups.has(k))spreadGroups.set(k,[]);
  spreadGroups.get(k).push(w);
 }
 const scenarioSpreads=[...spreadGroups.values()].map(group=>{
  const first=group[0],vals=group.map(w=>w.pTopHalf);
  return {courseId:first.courseId,fieldSize:first.fieldSize,
   mode:first.mode,style:first.style,windowId:first.windowId,
   scenarios:group.map(w=>w.scenario).sort(cmp),
   minTopPercent:pp(Math.min(...vals)),
   maxTopPercent:pp(Math.max(...vals)),
   rangePercentagePoints:pp(Math.max(...vals)-Math.min(...vals))};
 }).sort(stable);
 const deltaByStyle=expanded.STYLES.map(style=>{
  const deltas=firstToFull.filter(x=>x.style===style)
   .map(x=>x.deltaTopPercentagePoints).sort((a,b)=>a-b);
  if(!deltas.length)return {style,validComparisons:0};
  return {style,validComparisons:deltas.length,
   minDeltaPercentagePoints:deltas[0],
   maxDeltaPercentagePoints:deltas.at(-1),
   meanDeltaPercentagePoints:Number((deltas.reduce((a,b)=>a+b,0)/deltas.length).toFixed(6)),
   increases:deltas.filter(d=>d>1e-7).length,
   decreases:deltas.filter(d=>d< -1e-7).length,
   unchanged:deltas.filter(d=>Math.abs(d)<=1e-7).length};
 });
 const anchor=complete.filter(w=>w.courseId===10504&&w.fieldSize===9&&
  w.scenario==='balanced'&&w.mode==='equal'&&
  ['final-first-half','final-full'].includes(w.windowId))
  .map(w=>({style:w.style,windowId:w.windowId,
   pTopHalfPercent:pp(w.pTopHalf),
   validRunnersMin:w.minValidRunners,
   validRunnersMax:w.maxValidRunners})).sort(stable);
 return {schemaVersion:1,
  status:'model-sensitivity-audit-not-a-skill-activation-probability',
  sourceRevision:pilot.PIN,sourceRaceCount:summary.raceCount,
  sourceSeedCount:summary.seedCount,
  counts:{summaryRows:summary.samples.length,windowRows:rows.length,
   estimatedWindows:complete.length,
   heldWindows:rows.length-complete.length,
   unknownRankCounts,firstToFullPairs:firstToFull.length,
   equalToJitterPairs:equalToJitter.length,
   nineToTwelvePairs:nineToTwelve.length,
   scenarioSpreadGroups:scenarioSpreads.length},
  deltaByStyle,anchor,
  firstToFull,scenarioSpreads,equalToJitter,nineToTwelve,
  limitations:[
   'Only 15 simulator seeds per model cell in the referenced CI artifact.',
   'Comparisons between different position windows are not skill activation probabilities.',
   'Sampled probability grids and linear interpolation can miss rapid rank changes.',
   'The observed running-style marginals are event-specific, not a representative overall race mix.',
   'No statistical confidence interval assumes correlated runners/seeds are independent.',
   'No suitability threshold, skill classifier, card ranking or live UI is changed.'
  ]};
}
function main(){
 const [summaryPath,windowsPath,reportPath]=process.argv.slice(2);
 if(!summaryPath||!windowsPath||!reportPath)
  throw Error('Usage: globalsim_window_sensitivity.cjs summary.json window-profile.json report.json');
 const out=inspect(JSON.parse(fs.readFileSync(summaryPath,'utf8')),
  JSON.parse(fs.readFileSync(windowsPath,'utf8')));
 fs.writeFileSync(reportPath,JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify({sourceRaceCount:out.sourceRaceCount,
  counts:out.counts,deltaByStyle:out.deltaByStyle}));
}
if(require.main===module)
 try{main()}catch(e){console.error(e);process.exitCode=1}
module.exports={inspect,validate,pp};
