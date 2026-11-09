#!/usr/bin/env node
'use strict';
/* P2 research supplement: within-window four-style contrast
 * of the first axis's 10m random-window rank opportunity model.
 * W is not an actual game skill activation rate.
 * S_s = W_s - mean(W_Nige,W_Senkou,W_Sasi,W_Oikomi) within the SAME
 * source timing/rank/surface/distance and fixed context (equal style weights).
 * 'Strict' W pair comparisons require direction across every eligible context
 * AND both separate 15-seed halves. This is a reproducibility check, not
 * a sampling confidence interval or an approved skill suitability label.
 */
const fs=require('node:fs');
const source=require('./globalsim_roster32.cjs');
const replayTool=require('./globalsim_specificity32_split_replay.cjs');
const STYLES=source.STYLES;
const round=x=>Number(x.toFixed(6));
const avg=xs=>xs.reduce((a,x)=>a+x,0)/xs.length;
const key=r=>[r.surface,r.courseId,r.fieldSize,r.mode,
 r.timing,r.bandId,r.style].join('|');
const profileKey=p=>[p.surface,p.distanceScope,p.timing,p.bandId].join('|');
const contextKey=(p,c,n,m,s)=>
 [p.surface,c,n,m,p.timing,p.bandId,s].join('|');
const pairIds=STYLES.flatMap((s,i)=>STYLES.slice(i+1).map(t=>[s,t]));
function validate(replay,manifest){
 source.verifyManifest(manifest);
 if(!replay||replay.schemaVersion!==1||
  replay.status!=='p2-32-conditions-balanced-v77-30-seeds-and-paired-15-seed-halves'||
  replay.source?.modelRevision!==source.PIN||
  replay.source?.sourceSkillRegistrySha256!==source.SOURCE_SHA||
  replay.source?.derivedManifestSha256!==manifest.source.previousArtifactSha256||
  replay.design?.scenario!=='balanced'||replay.design?.raceCases!==1440||
  replay.design?.fullSeeds!==30||
  JSON.stringify(replay.design?.splitSeeds)!=='[15,15]'||
  replay.design?.conditions!==32||replay.design?.contexts!==1200||
  replay.source?.fullReportSha256!==replayTool.EXPECTED_BALANCED_SHA||
  replayTool.hash(replayTool.json(replay.full))!==
  replayTool.EXPECTED_BALANCED_SHA)
  throw Error('Missing or altered fixed balanced 32-condition replay and source SHA');
 replayTool.validateHalfReconciliation(replay.full,
  replay.splitSeedHalves?.first,replay.splitSeedHalves?.second);
 const indices={};
 for(const [part,report,seeds] of [
  ['full',replay.full,30],
  ['first',replay.splitSeedHalves.first,15],
  ['second',replay.splitSeedHalves.second,15]]){
  const rows=report.contextRows,idx=new Map();
  if(!Array.isArray(rows)||rows.length!==1200||
   report.schemaVersion!==2||report.scenario!=='balanced'||
   report.seedsPerCell!==seeds||report.heldContextCells!==0||
   report.models!==12||report.profileCount!==32||
   report.missingStyleContextCells!==0)
   throw Error('Unverified balanced report context population '+part);
  for(const row of rows){
   const k=key(row);
   if(idx.has(k)||row.status!=='complete-model-measurement'||
    row.scenario!=='balanced'||row.unresolvedRunners!==0||
    !STYLES.includes(row.style)||
    !source.MODES.includes(row.mode)||
    ![9,12].includes(row.fieldSize)||
    !Number.isFinite(row.opportunityPercent)||
    row.opportunityPercent<0||row.opportunityPercent>100||
    row.pointOccupancyPercent>row.opportunityPercent+0.000001)
    throw Error('Unsupported or duplicated balanced context '+k);
   const course=source.COURSES.find(x=>x.id===row.courseId);
   if(!course||course.surface!==row.surface||
    row.runners!==source.COUNTS.balanced[row.fieldSize][
     STYLES.indexOf(row.style)]*seeds)
    throw Error('Model runner count/cross-surface mismatch '+k);
   idx.set(k,row);
  }
  indices[part]=idx;
 }
 return indices;
}
function classifyPair(deltas){
 if(!Array.isArray(deltas)||!deltas.length)throw Error('No comparable source contexts');
 const signs=deltas.map(x=>({
  full:Math.sign(x.full),first:Math.sign(x.first),
  second:Math.sign(x.second)}));
 const allPositive=signs.every(x=>x.full===1&&x.first===1&&x.second===1);
 const allNegative=signs.every(x=>x.full===-1&&x.first===-1&&x.second===-1);
 const fullOnlyPositive=signs.every(x=>x.full===1);
 const fullOnlyNegative=signs.every(x=>x.full===-1);
 const tied=signs.some(x=>[x.full,x.first,x.second].includes(0));
 const changedFull=!(fullOnlyPositive||fullOnlyNegative);
 const splitInconsistent=signs.some(x=>x.full!==x.first||x.full!==x.second);
 const result=allPositive?'first-higher':
  allNegative?'second-higher':'held';
 return {
  direction:result,
  allFullContextDirection:fullOnlyPositive?'first-higher':
   fullOnlyNegative?'second-higher':'not-strict',
  heldReasons:result==='held'?
   [...(changedFull?['full-context-sign-variation-or-tie']:[]),
    ...(splitInconsistent?['split-seed-direction-not-concordant']:[]),
    ...(tied?['one-or-more-exact-rounded-ties']:[])]:[],
  fullMeanDifferencePoints:round(avg(deltas.map(x=>x.full))),
  fullMinDifferencePoints:round(Math.min(...deltas.map(x=>x.full))),
  fullMaxDifferencePoints:round(Math.max(...deltas.map(x=>x.full))),
  firstHalfMeanDifferencePoints:round(avg(deltas.map(x=>x.first))),
  secondHalfMeanDifferencePoints:round(avg(deltas.map(x=>x.second))),
  eligibleContexts:deltas.length
 };
}
function produce(manifest,replay){
 const idx=validate(replay,manifest);
 const conditions=[],allPairs=[],styleRows=[];
 const used=new Set();
 for(const p of manifest.profiles){
  const id=profileKey(p);
  if(used.has(id))throw Error('Duplicate original source condition signature');
  used.add(id);
  const courses=source.COURSES.filter(c=>c.surface===p.surface&&
   source.SCOPE[p.distanceScope].includes(c.distanceType)).map(c=>c.id);
  const contexts=courses.flatMap(courseId=>[9,12].flatMap(
   fieldSize=>source.MODES.map(mode=>({courseId,fieldSize,mode}))));
  if(contexts.length!==courses.length*4)
   throw Error('Missing source distance/ground scope');
  const measurements=contexts.map(c=>{
   const styles=Object.fromEntries(STYLES.map(s=>{
    const rows=Object.fromEntries(['full','first','second'].map(part=>{
     const row=idx[part].get(contextKey(p,c.courseId,c.fieldSize,c.mode,s));
     if(!row)throw Error('Missing source model style row '+id+' '+s);
     return [part,row.opportunityPercent];
    }));
    return [s,rows];
   }));
   return {...c,styles};
  });
  const rel=Object.fromEntries(STYLES.map(s=>[s,[]]));
  for(const c of measurements){
   const fourStyleMean=avg(STYLES.map(s=>c.styles[s].full));
   for(const s of STYLES)
    rel[s].push(c.styles[s].full-fourStyleMean);
  }
  const pairs=pairIds.map(([a,b])=>{
   const deltas=measurements.map(c=>({
    fieldSize:c.fieldSize,
    full:c.styles[a].full-c.styles[b].full,
    first:c.styles[a].first-c.styles[b].first,
    second:c.styles[a].second-c.styles[b].second
   }));
   const all=classifyPair(deltas);
   const byField=Object.fromEntries([9,12].map(n=>[
    n,classifyPair(deltas.filter(x=>x.fieldSize===n))]));
   const pair={conditionSignature:id,sourceNumericId:p.sourceNumericId,
    first:a,second:b,all,
    byFieldSize:byField,
    differsAcrossHeadcount:
     byField['9'].direction!=='held'&&byField['12'].direction!=='held'&&
     byField['9'].direction!==byField['12'].direction};
   allPairs.push(pair);
   return pair;
  });
  const byStyle=Object.fromEntries(STYLES.map(s=>{
   const results=pairs.map(pair=>{
    const first=pair.first===s;
    const peer=first?pair.second:pair.first;
    const dir=pair.all.direction==='held'?'held':
     pair.all.direction===(first?'first-higher':'second-higher')?
      'higher':'lower';
    return {peer,direction:dir};
   });
   const higher=results.filter(x=>x.direction==='higher').map(x=>x.peer);
   const lower=results.filter(x=>x.direction==='lower').map(x=>x.peer);
   const held=results.filter(x=>x.direction==='held').map(x=>x.peer);
   const role=held.length?'partial-order-unresolved':
    higher.length===3?'relative-leader':
    lower.length===3?'relative-trailer':'relative-intermediate';
   const opportunity=round(avg(measurements.map(c=>c.styles[s].full)));
   const relative=round(avg(rel[s]));
   const item={conditionSignature:id,sourceNumericId:p.sourceNumericId,
    surface:p.surface,distanceScope:p.distanceScope,
    timing:p.timing,bandId:p.bandId,style:s,
    eligibleContexts:contexts.length,
    // Axis 1, a model 10m random-window opportunity, never a skill proc rate
    opportunityAxis:{meanPercent:opportunity,
     byFieldSize:Object.fromEntries([9,12].map(n=>[
      n,round(avg(measurements.filter(c=>c.fieldSize===n)
       .map(c=>c.styles[s].full)))]))},
    // Supplemental W-based relative contrast, NOT the approved specificity
    // definition D=one-point-occupancy minus uniform-rank reference.
    windowRelativeContrast:{deltaFromEqualFourStyleMeanPoints:relative,
     byFieldSize:Object.fromEntries([9,12].map(n=>[
      n,round(avg(measurements.filter(c=>c.fieldSize===n)
       .map(c=>c.styles[s].full-
        avg(STYLES.map(t=>c.styles[t].full)))))])),
     role,higherThan:higher,lowerThan:lower,
     heldAgainst:held,
     fullContextMeanDifferenceCanMaskReversal:held.length>0}};
   styleRows.push(item);
   return [s,item];
  }));
  conditions.push({
   conditionSignature:id,sourceNumericId:p.sourceNumericId,
   surface:p.surface,distanceScope:p.distanceScope,
   timing:p.timing,bandId:p.bandId,
   sourceCourseIds:courses,
   numberOfMatchedContexts:contexts.length,
   byStyle,byPair:pairs.map(x=>({first:x.first,second:x.second,
    direction:x.all.direction,
    fullOnly:x.all.allFullContextDirection,
    firstHalfMeanDifferencePoints:x.all.firstHalfMeanDifferencePoints,
    secondHalfMeanDifferencePoints:x.all.secondHalfMeanDifferencePoints,
    minDifferencePoints:x.all.fullMinDifferencePoints,
    maxDifferencePoints:x.all.fullMaxDifferencePoints,
    heldReasons:x.all.heldReasons}))
  });
 }
 if(conditions.length!==32||allPairs.length!==192||styleRows.length!==128)
  throw Error('Expected precisely 32 distinct original AND condition paths');
 const count=(arr,field,val)=>arr.filter(x=>x[field]===val).length;
 const pairSummary=group=>({
  total:group.length,
  robustFirstHigher:group.filter(x=>x.all.direction==='first-higher').length,
  robustSecondHigher:group.filter(x=>x.all.direction==='second-higher').length,
  held:group.filter(x=>x.all.direction==='held').length,
  contextOnlyStrictWithoutHalves:group.filter(x=>
   x.all.direction==='held'&&x.all.allFullContextDirection!=='not-strict').length,
  fullContextNotStrict:group.filter(x=>
   x.all.allFullContextDirection==='not-strict').length,
  allFullStrict:group.filter(x=>
   x.all.allFullContextDirection!=='not-strict').length,
  headcountOppositeRobustDirections:group.filter(x=>
   x.differsAcrossHeadcount).length
 });
 const bySurface=Object.fromEntries(['turf','dirt'].map(surface=>
  [surface,pairSummary(allPairs.filter(x=>
   conditions.find(c=>c.conditionSignature===x.conditionSignature)?.surface===
    surface))]));
 const roles=Object.fromEntries(['relative-leader','relative-trailer',
  'relative-intermediate','partial-order-unresolved'].map(r=>
  [r,styleRows.filter(x=>x.windowRelativeContrast.role===r).length]));
 const out={schemaVersion:1,
  status:'P2-32-source-condition-10m-window-pair-stability-supplement-to-O-minus-U',
  provenance:{umaSimSha256:source.SOURCE_SHA,
   globalSimRevision:source.PIN,
   pinnedBalanced30SeedSha256:replayTool.EXPECTED_BALANCED_SHA,
   manifestReviewSha256:manifest.source.previousArtifactSha256,
   splitSeeds:[15,15],fixedBalancedRaces:1440,
   fixedModelContextsPerProfile:'4 / 8 / 24 (eligible courses × 9/12 × ability modes)'},
  definitions:{
   canonicalSpecificityAxis:'Retain PR #374: D=one-point rank occupancy O minus uniform position-band U; this report only tests W pairwise directions',
   axis1:'Mean 10m random-window eligible-rank opportunity for each style; not skill activation probability',
   supplementalWindowContrast:'This is W_style minus the equal-weight mean across four styles in the SAME source window and model context. It is NOT the approved second-axis D=O-U, which remains in skill_specificity32_research.cjs.',
   pairRule:'strict all-context direction AND same strict direction in first and last 15-seed halves, with numeric 0 treated as held, no arbitrary margin threshold',
   windowContrastNotIndependent:'The supplemental W peer contrast is computed from Axis 1 W and is not independent data; the existing D=O-U second-axis definition is unchanged.',
   noUniformRank10mBaseline:'Do NOT subtract former one-instant uniform-rank occupancy baseline from 10m opportunity: their sampling mechanisms differ',
   noSkillUnion:'Four double-OR source skills have separate AND-path profiles; do not combine their chance as skill-level rate',
   cohortNotPopulation:'32 intentionally selected original rank/timing/source profiles, not representative random skills',
   modelContextNotRaceFrequency:'Eligible 6-course subset, 9/12 field and equal/jitter modes receive equal context weight, not observed real matchup weights',
   stableDirectionNotStatisticalConfidence:'15+15 seed replication is a fixed-model diagnostic, not an uncertainty interval nor validation against Japanese game',
   effectUtility:'Post-activation skill usefulness is not measured or inferred',
   application:'Supplemental split-seed validation of the W pairwise relationships reported by the existing P2 D=O-U two-axis research; no replacement of D, no production labels/card scores/P3/P4 changes'
  },
  summary:{
   sourceSkills:77,sourceAndPaths:81,
   distinctConditions:conditions.length,styleCases:styleRows.length,
   pairComparisons:allPairs.length,
   pairs:pairSummary(allPairs),bySurface,
   roles,
   styleCasesWithAtLeastOneHeldPair:styleRows.filter(x=>
    x.windowRelativeContrast.heldAgainst.length>0).length,
   strictRoleCases:styleRows.filter(x=>
    x.windowRelativeContrast.heldAgainst.length===0).length
  },
  representativeExamples:conditions.filter(c=>
   ['200681','202671','202261','101902211','204511'].includes(c.sourceNumericId)),
  conditions,allPairs,styleRows};
 // Every context's four signed deviations sum to 0; condition-level means
 // must therefore also cancel exactly up to six-decimal rounding.
 for(const c of conditions){
  const sum=STYLES.reduce((x,s)=>x+
   c.byStyle[s].windowRelativeContrast.deltaFromEqualFourStyleMeanPoints,0);
  if(Math.abs(sum)>0.000004)
   throw Error('Unweighted four-style contrast does not sum to zero '+c.conditionSignature);
 }
 return out;
}
function main([manifestPath,replayPath,outPath]){
 if(!outPath)throw Error(
  'Usage: skill_specificity32_two_axis.cjs manifest.json balanced-split-replay.json output.json');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const replay=JSON.parse(fs.readFileSync(replayPath,'utf8'));
 const result=produce(manifest,replay);
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({status:result.status,summary:result.summary,
  examples:result.representativeExamples.map(c=>({
   condition:c.conditionSignature,byStyle:Object.fromEntries(
    STYLES.map(s=>[s,{opportunity:c.byStyle[s].opportunityAxis.meanPercent,
     relativeDelta:c.byStyle[s].windowRelativeContrast.deltaFromEqualFourStyleMeanPoints,
     role:c.byStyle[s].windowRelativeContrast.role}]))}))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1;}
module.exports={STYLES,pairIds,classifyPair,validate,produce,main};
