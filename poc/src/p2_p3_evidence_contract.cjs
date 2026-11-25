'use strict';
/*
 * Read-only bridge between the P2 32-source-condition two-axis report and
 * future P3 consumers. This is CONDITION-LEVEL research evidence, not a
 * skill activation probability, acquired skill rating, card suitability,
 * or an approved display format.
 *
 * A report's embedded provenance identifies its claimed fixed source.
 * It is NOT an authenticity proof for an arbitrary JSON file: callers must
 * separately pin the artifact checksum / validated CI provenance.
 */
const manifestDefault=require('../data/p2_position_condition32_research.v1.json');
const roster=require('../tools/globalsim_roster32.cjs');
const rank=require('./skill_order_rate_bounds.cjs');
const BANDS=require('../tools/globalsim_rank_band_dominance.cjs').BANDS;
const research=require('../tools/skill_specificity32_research.cjs');
const STATUS='P2-source32-two-axis-point-specificity-and-10m-pairwise-research-only';
const STYLES=Object.freeze([...roster.STYLES]);
const FIELD_SIZES=Object.freeze([9,12]);
const STRICT=new Set(['first-strict-all-matched-contexts',
 'second-strict-all-matched-contexts']);
const EPS=.000011; // Rounding check only, not a suitability threshold.
const key=x=>[x.sourceNumericId,x.surface,x.distanceScope,
 x.timing,x.bandId].join('|');
const keyFor=(x,n)=>key(x)+'|'+n;
const isNum=n=>typeof n==='number'&&Number.isFinite(n);
const close=(a,b)=>Math.abs(a-b)<=EPS;
function fail(message){throw Error('P2 evidence contract: '+message)}
function isExactList(x,y){
 return Array.isArray(x)&&x.length===y.length&&x.every((v,i)=>v===y[i]);
}
function checkNumber(x,lo,hi,description){
 if(!isNum(x)||x<lo-EPS||x>hi+EPS)fail('invalid '+description);
}
function matchedManifest(manifest){
 roster.verifyManifest(manifest);
 const keys=new Set(manifest.profiles.map(key));
 if(keys.size!==32)fail('duplicate manifest condition signature');
 return keys;
}
function validate(report,manifest=manifestDefault){
 const keys=matchedManifest(manifest);
 if(!report||report.schemaVersion!==1||report.status!==STATUS||
    report.source?.modelRevision!==roster.PIN||
    report.source?.fixedUmaSimSkillRegistrySha256!==roster.SOURCE_SHA||
    report.source?.sourceManifestPreviousReviewSha256!==
      manifest.source.previousArtifactSha256||
    !report.source?.pinnedFullRosterInputSha256||
    !Object.entries(research.PINNED).every(([k,v])=>
      report.source.pinnedFullRosterInputSha256[k]===v))
  fail('unrecognized or unpinned P2 two-axis source report');
 if(report.model?.sourceConditions!==32||
    !isExactList(report.model.fieldSizes,FIELD_SIZES)||
    !isExactList(report.model.styles,STYLES)||
    !report.model.seedSplitConfirmation?.startsWith('NOT TESTED'))
  fail('P2 model scope/seed uncertainty changed');
 if(!Array.isArray(report.conditions)||report.conditions.length!==64)
  fail('exactly 32×2 source conditions are required');
 const result=new Map();
 for(const cell of report.conditions){
  if(!keys.has(key(cell))||!FIELD_SIZES.includes(cell.fieldSize)||
     result.has(keyFor(cell,cell.fieldSize)))
   fail('duplicate, out-of-scope or mismatched source condition');
  const band=BANDS.find(b=>b.id===cell.bandId);
  const projected=rank.andProjection(band.predicates,cell.fieldSize);
  const u=100*projected.positions.length/cell.fieldSize;
  if(!isExactList(cell.sourceIntegerPositions,projected.positions))
   fail('source integer-rank projection differs');
  if(!cell.styles||!Array.isArray(cell.pairwise)||
     cell.pairwise.length!==6)
   fail('four-style measurements / six pairwise comparisons missing');
  for(const s of STYLES){
   const x=cell.styles[s];
   if(!x)fail('missing style '+s);
   for(const [metric,min,max] of [
     ['opportunity10mPercent',0,100],
     ['pointOccupancyPercent',0,100],
     ['uniformOnePointRankReferencePercent',0,100],
     ['pointDeviationFromUniformRankReferencePoints',-100,100],
     ['pointTo10mUpliftPoints',0,100]
   ])checkNumber(x[metric],min,max,metric);
   if(!close(x.uniformOnePointRankReferencePercent,u)||
      !close(x.pointDeviationFromUniformRankReferencePoints,
        x.pointOccupancyPercent-u)||
      !close(x.pointTo10mUpliftPoints,
        x.opportunity10mPercent-x.pointOccupancyPercent)||
      x.pointOccupancyPercent>x.opportunity10mPercent+EPS)
     fail('W, O and U were mixed or numerical context invalid');
  }
  const expectedPairs=research.PAIRS.map(([a,b])=>a+'|'+b);
  const pairKeys=cell.pairwise.map(p=>p.first+'|'+p.second);
  if(!isExactList(pairKeys,expectedPairs))
   fail('pairwise identities/order changed');
  for(const pair of cell.pairwise){
   const status=pair.balancedMatchedContextDirection;
   if(typeof status!=='string'||!pair.byScenario||
      pair.byScenario.balanced?.status!==status||
      !roster.SCENARIOS.every(s=>typeof pair.byScenario[s]?.status==='string'))
    fail('pairwise comparison source status missing');
   const a=cell.styles[pair.first],b=cell.styles[pair.second];
   if(!close(pair.balancedMeanOpportunityDifferencePoints,
      a.opportunity10mPercent-b.opportunity10mPercent)||
      !close(pair.balancedMeanPointOccupancyDifferencePoints,
      a.pointOccupancyPercent-b.pointOccupancyPercent))
     fail('pairwise numerical contrast mismatch');
  }
  const allStrict=cell.pairwise.every(p=>
    STRICT.has(p.balancedMatchedContextDirection));
  if(cell.allSixPairDirectionsStrictAcrossBalancedContexts!==allStrict)
   fail('four-style ordering certainty mismatch');
  for(const s of STYLES){
   const higher=[],lower=[],held=[];
   for(const p of cell.pairwise){
    if(p.first!==s&&p.second!==s)continue;
    const other=p.first===s?p.second:p.first;
    if(!STRICT.has(p.balancedMatchedContextDirection)){held.push(other);continue}
    const firstHigher=p.balancedMatchedContextDirection===
      'first-strict-all-matched-contexts';
    if((p.first===s&&firstHigher)||(p.second===s&&!firstHigher))
      higher.push(other);
    else lower.push(other);
   }
   const resultOrder=cell.styles[s].relativeOrder;
   if(!resultOrder||!isExactList(resultOrder.higherThan,higher)||
      !isExactList(resultOrder.lowerThan,lower)||
      !isExactList(resultOrder.heldAgainst,held))
     fail('style pairwise relation disagrees with its original six pairs');
  }
  result.set(keyFor(cell,cell.fieldSize),cell);
 }
 if(result.size!==64||
    [...keys].some(k=>FIELD_SIZES.some(n=>!result.has(k+'|'+n))))
  fail('incomplete 32-condition cross-field coverage');
 if(!Array.isArray(report.crossHeadcountPairs)||
    report.crossHeadcountPairs.length!==192)
  fail('9-/12-runner comparison audit is incomplete');
 const cross=new Map();
 for(const p of report.crossHeadcountPairs){
  const pk=[p.sourceNumericId,p.distanceScope,p.timing,p.bandId].join('|');
  const m=manifest.profiles.filter(x=>[x.sourceNumericId,x.distanceScope,
    x.timing,x.bandId].join('|')===pk);
  if(m.length!==1)fail('cross-field pair lacks unique source condition');
  const signature=key(m[0]);
  const ref=research.PAIRS.some(([a,b])=>a===p.first&&b===p.second);
  const x9=result.get(signature+'|9').pairwise.find(x=>
    x.first===p.first&&x.second===p.second);
  const x12=result.get(signature+'|12').pairwise.find(x=>
    x.first===p.first&&x.second===p.second);
  const cp=signature+'|'+p.first+'|'+p.second;
  if(!ref||cross.has(cp)||!x9||!x12||
     p.nineStatus!==x9.balancedMatchedContextDirection||
     p.twelveStatus!==x12.balancedMatchedContextDirection)
   fail('cross-field pair conflicts with its two source measurements');
  const relation=STRICT.has(p.nineStatus)&&STRICT.has(p.twelveStatus)?
    (p.nineStatus===p.twelveStatus?'same-strict-direction':'headcount-reversal'):
    'held-at-least-one-headcount';
  if(p.relation!==relation)fail('headcount sensitivity was dropped');
  cross.set(cp,p);
 }
 if(cross.size!==192)fail('source headcount comparison duplicates');
 return {byCondition:result,byHeadcountPair:cross,manifest};
}
function openEvidence(report,manifest=manifestDefault){
 const index=validate(report,manifest);
 return Object.freeze({
  status:'read-only-p2-source-condition-evidence-not-card-grade',
  source:Object.freeze({...report.source}),
  scope:Object.freeze({conditionProfiles:32,fieldSizes:[...FIELD_SIZES],
   styles:[...STYLES],scenario:'balanced as reference; other rosters are sensitivity only',
   seedSplit:'unverified',gameActivationProbability:'not measured'}),
  lookup(signature){
   if(!signature||typeof signature!=='object')fail('full source signature required');
   const allow=['sourceNumericId','surface','distanceScope','timing','bandId'];
   if(allow.some(x=>typeof signature[x]!=='string'||!signature[x])||
      Object.keys(signature).some(k=>!allow.includes(k)))
    fail('exact five-field original source signature required');
   const id=key(signature);
   if(!index.byCondition.has(id+'|9'))return Object.freeze({
     status:'not-in-research-cohort',sourceSignature:{...signature}});
   const fields=FIELD_SIZES.map(n=>{
     const r=index.byCondition.get(id+'|'+n);
     const styles=Object.fromEntries(STYLES.map(s=>{
       const x=r.styles[s];
       return [s,{
         W10mOpportunityPercent:x.opportunity10mPercent,
         OPointOccupancyPercent:x.pointOccupancyPercent,
         UUniformPointReferencePercent:x.uniformOnePointRankReferencePercent,
         OminusUDeviationPoints:x.pointDeviationFromUniformRankReferencePoints,
         relativeOrder:{...x.relativeOrder}
       }];
     }));
     return {fieldSize:n,modelCourseIds:[...r.modelCourseIds],
       sourceIntegerPositions:[...r.sourceIntegerPositions],
       styles,pairwise:r.pairwise.map(p=>({
         first:p.first,second:p.second,
         balancedStatus:p.balancedMatchedContextDirection,
         acrossArtificialRosters:p.underFourArtificialRosters
       }))};
   });
   const sensitivity=research.PAIRS.map(([a,b])=>{
     const cp=index.byHeadcountPair.get(id+'|'+a+'|'+b);
     return {first:a,second:b,status:cp.relation,
       nineStatus:cp.nineStatus,twelveStatus:cp.twelveStatus};
   });
   return {status:'source-rank-condition-only-not-full-skill',
     sourceSignature:{...signature},fields,
     headcountSensitivity:sensitivity,
     limitations:[
       '10m window W is not a real game activation probability.',
       'O minus U uses single-point occupancy, not W minus U.',
       'This result covers a source rank/time condition only; any unmodelled AND/OR, explicit style, preconditions and source skill identity must be checked before P3 skill or card adoption.',
       '9 and 12 runner models remain separate; not averaged into an overall fit.',
       'Nonbalanced artificial rosters are sensitivity checks, not weighted match frequencies.',
       '30-seed direction was not independently confirmed in 15+15 groups for these 32 profiles.',
       'This adapter deliberately makes no card grade, user-facing label or display-format decision.'
     ]};
  }
 });
}
module.exports={STATUS,STYLES,FIELD_SIZES,key,validate,openEvidence};
