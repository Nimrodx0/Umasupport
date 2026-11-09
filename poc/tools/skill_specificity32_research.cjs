#!/usr/bin/env node
'use strict';
/*
 * P2 research: explicitly separate model 10-m random-window rank opportunity W
 * from point-in-zone rank occupancy O and the uniform-rank reference U.
 * Specificity is (O-U) PLUS held-aware pairwise rank comparisons. W-U is
 * NOT computed: a 10m "ever within a window" event is NOT a point event.
 * Every comparison uses the exact same course/field/mode/source time window.
 * No game proc rates, high/low grading, card effects or production changes.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const model=require('./globalsim_roster32.cjs');
const aggregate=require('./skill_roster32_aggregate.cjs');
const rank=require('../src/skill_order_rate_bounds.cjs');
const BANDS=require('./globalsim_rank_band_dominance.cjs').BANDS;
const STYLES=model.STYLES;
const SCENARIOS=model.SCENARIOS;
const EPS=0.00001; // Only numeric precision guard, NOT an effect threshold.
const PINNED=Object.freeze({
 balanced:'63a6e44656684bf94cebe4dba7c2118a1c9668e8d4623c02321876949ec2a6b2',
 frontHeavy:'0c735e9b53da56a257e3097ccf45fbde74bc8b7ec1bad185a5b1dc182a9430da',
 backHeavy:'35c36816856df5e8ec8acd82de8ecf8a19f85bb2c508ffd73fc2654686d07857',
 noFront:'b67e4f5a0c67c839ded8e8e694651472ef36c1ae1fae606099240a3978b8dbfe',
 priorAggregate:'d8f01c8e0d0736a2f1473d73b96128b5bf54df031afe9143e3b8decd7b083e99'
});
const PAIRS=Object.freeze(STYLES.flatMap((s,i)=>STYLES.slice(i+1).map(t=>[s,t])));
const round=x=>Number(x.toFixed(6));
const mean=xs=>xs.reduce((a,v)=>a+v,0)/xs.length;
const k=(course,n,mode,timing,band,style)=>
 [course,n,mode,timing,band,style].join('|');
const profileKey=(p,n)=>[p.sourceNumericId,p.surface,
 p.distanceScope,p.timing,p.bandId,n].join('|');
const pairStatus=(lo,hi)=>lo>EPS?'first-strictly-higher':
 hi< -EPS?'second-strictly-higher':'held-overlap-or-tie';
function sameContextContrast(a,b){
 if(!a||!b)return {status:'not-applicable-absent-style',
  differenceLowerPoints:null,differenceUpperPoints:null,
  firstIsPresent:Boolean(a),secondIsPresent:Boolean(b)};
 const low=a.opportunityLowerBoundPercent-b.opportunityUpperBoundPercent;
 const high=a.opportunityUpperBoundPercent-b.opportunityLowerBoundPercent;
 if(!Number.isFinite(low)||!Number.isFinite(high)||low>high+EPS)
  throw Error('Invalid interval for source-matched style comparison');
 return {status:pairStatus(low,high),
  differenceLowerPoints:round(low),differenceUpperPoints:round(high),
  firstIsPresent:true,secondIsPresent:true};
}
function strictAcrossContexts(comparisons){
 if(!comparisons.length)return 'held-no-contexts';
 const statuses=comparisons.map(x=>x.status);
 if(statuses.some(x=>x==='not-applicable-absent-style'))
  return 'held-absent-style';
 if(statuses.every(x=>x==='first-strictly-higher'))
  return 'first-strict-all-matched-contexts';
 if(statuses.every(x=>x==='second-strictly-higher'))
  return 'second-strict-all-matched-contexts';
 if(statuses.includes('first-strictly-higher')&&
    statuses.includes('second-strictly-higher'))
  return 'held-context-direction-reversal';
 return 'held-overlap-or-context-mixed';
}
function compareScenario(index,profile,n,a,b,scenario,courses){
 const cells=[],presence=model.COUNTS[scenario][n];
 if(!presence[STYLES.indexOf(a)]||!presence[STYLES.indexOf(b)])
  return {scenario,status:'held-absent-style',contexts:0,
   means:null,lowerMeanDifferencePoints:null,
   upperMeanDifferencePoints:null,contextDiagnostics:null};
 for(const course of courses)for(const mode of model.MODES){
  const ca=index.get(scenario).get(k(course,n,mode,
   profile.timing,profile.bandId,a));
  const cb=index.get(scenario).get(k(course,n,mode,
   profile.timing,profile.bandId,b));
  if(!ca||!cb)throw Error('Missing source-matched style context '+
   JSON.stringify({scenario,course,n,mode,a,b,profile}));
  cells.push(sameContextContrast(ca,cb));
 }
 const status=strictAcrossContexts(cells);
 return {scenario,status,contexts:cells.length,
  means:{
   firstLowerBoundPercent:round(mean(courses.flatMap(course=>
    model.MODES.map(mode=>index.get(scenario).get(k(course,n,mode,
     profile.timing,profile.bandId,a)).opportunityLowerBoundPercent)))),
   firstUpperBoundPercent:round(mean(courses.flatMap(course=>
    model.MODES.map(mode=>index.get(scenario).get(k(course,n,mode,
     profile.timing,profile.bandId,a)).opportunityUpperBoundPercent)))),
   secondLowerBoundPercent:round(mean(courses.flatMap(course=>
    model.MODES.map(mode=>index.get(scenario).get(k(course,n,mode,
     profile.timing,profile.bandId,b)).opportunityLowerBoundPercent)))),
   secondUpperBoundPercent:round(mean(courses.flatMap(course=>
    model.MODES.map(mode=>index.get(scenario).get(k(course,n,mode,
     profile.timing,profile.bandId,b)).opportunityUpperBoundPercent))))
  },
  lowerMeanDifferencePoints:round(mean(cells.map(c=>c.differenceLowerPoints))),
  upperMeanDifferencePoints:round(mean(cells.map(c=>c.differenceUpperPoints))),
  contextDiagnostics:{
   firstHigher:cells.filter(c=>c.status==='first-strictly-higher').length,
   secondHigher:cells.filter(c=>c.status==='second-strictly-higher').length,
   heldOverlapOrTie:cells.filter(c=>c.status==='held-overlap-or-tie').length,
   heldByRankTie:cells.filter(c=>c.differenceLowerPoints!==
    c.differenceUpperPoints).length
  }};
}
function acrossFour(compare){
 const vals=SCENARIOS.map(s=>compare[s].status);
 if(vals.includes('held-absent-style'))return 'not-four-way-comparable-style-absent';
 if(vals.every(x=>x==='first-strict-all-matched-contexts'))
  return 'first-higher-in-all-four-rosters-and-matched-contexts';
 if(vals.every(x=>x==='second-strict-all-matched-contexts'))
  return 'second-higher-in-all-four-rosters-and-matched-contexts';
 if(vals.includes('first-strict-all-matched-contexts')&&
  vals.includes('second-strict-all-matched-contexts'))
  return 'direction-reversed-between-fully-observed-rosters';
 return 'held-some-roster-or-context-comparisons';
}
function quantify(manifest,reports,prior){
 model.verifyManifest(manifest);
 const index=aggregate.validateReports(manifest,reports,30);
 if(prior?.schemaVersion!==2||
  prior.status!=='p2-model-only-32-source-condition-opportunities-across-four-artificial-rosters'||
  prior.design?.sourceConditionProfiles!==32||
  prior.design?.raceCases!==5760||
  !Array.isArray(prior.profiles)||prior.profiles.length!==256)
  throw Error('Missing earlier full-source 32×2×4 balanced roster evidence');
 const original=new Map(prior.profiles.map(p=>
  [profileKey(p,p.fieldSize)+'|'+p.style,p]));
 if(original.size!==256)throw Error('Duplicate source condition prior evidence');
 const results=[],pairResults=[];
 const counts={};
 for(const profile of manifest.profiles){
  const courses=model.COURSES.filter(c=>c.surface===profile.surface&&
   model.SCOPE[profile.distanceScope].includes(c.distanceType))
   .map(c=>c.id);
  for(const n of [9,12]){
   const band=BANDS.find(x=>x.id===profile.bandId);
   const projection=rank.andProjection(band.predicates,n);
   if(projection.status!=='rank-subcondition-projection'||
    !projection.positions.length)
    throw Error('Unverified integer rank reference '+profile.bandId);
   const neutral=100*projection.positions.length/n;
   const byStyle={};
   for(const style of STYLES){
    const context=courses.flatMap(course=>model.MODES.map(mode=>{
     const row=index.get('balanced').get(k(course,n,mode,
      profile.timing,profile.bandId,style));
     if(!row||row.status!=='complete-model-measurement')
      throw Error('Balanced source occupancy was held, cannot calibrate point reference');
     return row;
    }));
    const w=mean(context.map(x=>x.opportunityPercent));
    const o=mean(context.map(x=>x.pointOccupancyPercent));
    const priorRecord=original.get(profileKey(profile,n)+'|'+style);
    if(!priorRecord||
     Math.abs(priorRecord.scenarios.balanced.opportunityPercent-w)>0.00001)
     throw Error('Published balanced 10m opportunity cannot be reproduced');
    if(w+EPS<o)throw Error('10m window opportunity smaller than point occupancy');
    byStyle[style]={opportunity10mPercent:round(w),
     pointOccupancyPercent:round(o),
     uniformOnePointRankReferencePercent:round(neutral),
     pointDeviationFromUniformRankReferencePoints:round(o-neutral),
     pointTo10mUpliftPoints:round(w-o),
     balancedCourseModeContexts:context.length,
     baselineType:'uniform-single-rank-not-a-10m-window-null-model'};
   }
   const pairwise=[];
   for(const [first,second] of PAIRS){
    const byScenario=Object.fromEntries(SCENARIOS.map(s=>[
     s,compareScenario(index,profile,n,first,second,s,courses)]));
    const direction=byScenario.balanced.status;
    const four=acrossFour(byScenario);
    pairwise.push({first,second,
     balancedMatchedContextDirection:direction,
     balancedMeanOpportunityDifferencePoints:round(
      byStyle[first].opportunity10mPercent-
      byStyle[second].opportunity10mPercent),
     balancedMeanPointOccupancyDifferencePoints:round(
      byStyle[first].pointOccupancyPercent-
      byStyle[second].pointOccupancyPercent),
     underFourArtificialRosters:four,
     byScenario});
    pairResults.push({sourceNumericId:profile.sourceNumericId,
     surface:profile.surface,distanceScope:profile.distanceScope,
     timing:profile.timing,bandId:profile.bandId,fieldSize:n,
     first,second,balancedStatus:direction,rosterStatus:four});
   }
   for(const style of STYLES){
    const comparisons=pairwise.filter(p=>p.first===style||p.second===style);
    const higher=[],lower=[],heldAgainst=[];
    for(const p of comparisons){
     const other=p.first===style?p.second:p.first;
     const rel=p.balancedMatchedContextDirection;
     if(!['first-strict-all-matched-contexts',
      'second-strict-all-matched-contexts'].includes(rel)){
      heldAgainst.push(other);continue;
     }
     const firstHigher=rel==='first-strict-all-matched-contexts';
     if((p.first===style&&firstHigher)||(p.second===style&&!firstHigher))
      higher.push(other);
     else lower.push(other);
    }
    const type=heldAgainst.length?'partial-order-unresolved':
     higher.length===3?'relative-leader':
     lower.length===3?'relative-trailer':'relative-intermediate';
    byStyle[style].relativeOrder={status:type,
     higherThan:higher,lowerThan:lower,heldAgainst};
   }
   const allStrict=pairwise.every(p=>
    p.balancedMatchedContextDirection==='first-strict-all-matched-contexts'||
    p.balancedMatchedContextDirection==='second-strict-all-matched-contexts');
   results.push({sourceNumericId:profile.sourceNumericId,
    surface:profile.surface,distanceScope:profile.distanceScope,
    timing:profile.timing,bandId:profile.bandId,
    modelCourseIds:courses,fieldSize:n,
    sourceIntegerPositions:projection.positions,
    allSixPairDirectionsStrictAcrossBalancedContexts:allStrict,
    styles:byStyle,pairwise});
 }
 }
 if(results.length!==64||pairResults.length!==384)
  throw Error('Expected exactly 32 source conditions × 2 sizes × 4 styles and 6 pairs');
 const tally=(xs,prop)=>Object.fromEntries(
  [...new Set(xs.map(x=>x[prop]))].sort().map(t=>
   [t,xs.filter(x=>x[prop]===t).length]));
 const crossHeadcount=[];
 for(const profile of manifest.profiles)for(const [a,b] of PAIRS){
  const k0=p=>[p.sourceNumericId,p.surface,p.distanceScope,p.timing,p.bandId].join('|');
  const key=k0(profile);
  const xs=pairResults.filter(p=>k0(p)===key&&
   p.first===a&&p.second===b);
  if(xs.length!==2)throw Error('Missing 9/12 paired condition contrast');
  const n9=xs.find(p=>p.fieldSize===9).balancedStatus;
  const n12=xs.find(p=>p.fieldSize===12).balancedStatus;
  const strict=['first-strict-all-matched-contexts',
   'second-strict-all-matched-contexts'];
  crossHeadcount.push({sourceNumericId:profile.sourceNumericId,
   distanceScope:profile.distanceScope,timing:profile.timing,
   bandId:profile.bandId,first:a,second:b,
   nineStatus:n9,twelveStatus:n12,
   relation:strict.includes(n9)&&strict.includes(n12)?
    n9===n12?'same-strict-direction':'headcount-reversal':
    'held-at-least-one-headcount'});
 }
 return {schemaVersion:1,
  status:'P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only',
  source:{
   modelRevision:model.PIN,
   fixedUmaSimSkillRegistrySha256:model.SOURCE_SHA,
   sourceManifestPreviousReviewSha256:manifest.source.previousArtifactSha256,
   pinnedFullRosterInputSha256:PINNED,
   originalBalancedReportStatus:prior.status
  },
  model:{scenarios:SCENARIOS,sourceConditions:32,fieldSizes:[9,12],
   styles:STYLES,matchedCourseModeContexts:
    'Only source-eligible model courses and equal/jitter10 modes per field size',
   opportunityMetric:'10m rank-condition window intersect model',
   specificityMetric:'point occupancy minus uniform 1-position rank reference; plus model pairwise strict context order',
   seedSplitConfirmation:'NOT TESTED: 30-seed aggregates cannot prove split-seed directional stability'},
  summary:{
   totalConditionHeadcounts:results.length,
   totalConditionHeadcountPairs:pairResults.length,
   balancedPairDirections:tally(pairResults,'balancedStatus'),
   fourRosterPairDirections:tally(pairResults,'rosterStatus'),
   fullyStrictBalancedFourStyleOrders:results.filter(x=>
    x.allSixPairDirectionsStrictAcrossBalancedContexts).length,
   fullyStrictOrdersByHeadcount:Object.fromEntries([9,12].map(n=>[
    n,results.filter(x=>x.fieldSize===n&&
     x.allSixPairDirectionsStrictAcrossBalancedContexts).length])),
   crossHeadcountPairs:tally(crossHeadcount,'relation'),
   styleRelativeOrders:Object.fromEntries(STYLES.map(s=>[
    s,tally(results.map(x=>({style:s,status:x.styles[s].relativeOrder.status})),
     'status')]))
  },
  representativeConditions:results.filter(x=>[
   '200681','202671','101902211','202261','202951'
  ].includes(x.sourceNumericId)),
  conditions:results,crossHeadcountPairs:crossHeadcount,
  limitations:[
   'A source skill condition signature, not independent skill frequency, is the 32-profile unit; sample selection biased toward front/rear rank gates.',
   'The first axis W is a 10m random-window event. The uniform-rank U is for an instantaneous rank, so ONLY point occupancy O is contrasted with U, never W-U.',
   'Paired W differences describe raw model rank-window opportunity, not actual skill proc probability, effect usefulness or suitability grades.',
   'Strict directional order means every matching source course × equal/jitter10 model cell has a strictly signed 30-seed aggregate difference; there is NO seed-split significance or inferential confidence interval.',
   'The artificial nonbalanced scenarios are sensitivity tests, not real opponent frequency weights; Nige is absent in noFront and must never become zero.',
   'Unresolved tied-rank simulator trajectories remain lower/upper intervals and do NOT give an arbitrary ordinal winner.',
   'When even one opposing style pair is held, full four-way ranking must be held. No arbitrary deterministic tie-breaking or approved high/low thresholds.',
   'The original source path additional AND, preconditions, OR union and explicit running-style applicability are not assessed by rank-window-only models.',
   'Production P3/P4, existing skill suitability labels, card scoring and user save format remain untouched.'
  ]};
}
function main([manifestPath,balancedPath,frontPath,backPath,noFrontPath,priorPath,outPath]){
 if(!outPath)throw Error('Usage: skill_specificity32_research.cjs manifest.json balanced.json frontHeavy.json backHeavy.json noFront.json prior-aggregate.json research.json');
 const read=p=>fs.readFileSync(p);
 const paths=[balancedPath,frontPath,backPath,noFrontPath,priorPath];
 for(const [i,s] of [...SCENARIOS,'priorAggregate'].entries()){
  const digest=crypto.createHash('sha256').update(read(paths[i])).digest('hex');
  if(digest!==PINNED[s])throw Error('Pinned source research JSON SHA drift '+s);
 }
 const data=quantify(JSON.parse(read(manifestPath)),
  paths.slice(0,4).map(p=>JSON.parse(read(p))),
  JSON.parse(read(priorPath)));
 fs.writeFileSync(outPath,JSON.stringify(data,null,2)+'\n');
 console.log(JSON.stringify({summary:data.summary,
  examples:data.representativeConditions.map(x=>({
   id:x.sourceNumericId,fieldSize:x.fieldSize,
   W:Object.fromEntries(STYLES.map(s=>[s,x.styles[s].opportunity10mPercent])),
   pointDeviation:Object.fromEntries(STYLES.map(s=>
    [s,x.styles[s].pointDeviationFromUniformRankReferencePoints])),
   fullOrder:x.allSixPairDirectionsStrictAcrossBalancedContexts
  }))},null,2));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={PINNED,EPS,PAIRS,sameContextContrast,
 strictAcrossContexts,acrossFour,compareScenario,quantify,main};
