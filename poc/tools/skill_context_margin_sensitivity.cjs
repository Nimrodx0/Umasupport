#!/usr/bin/env node
'use strict';
/*
 * P2.30: sensitivity to a CERTIFIED MINIMUM model W gap, never a game proc
 * or a product grade. A gap is certified only against the rank-tie interval
 * across every source-eligible course/ability and every *comparable*
 * synthetic roster+headcount context. 30 pooled seeds remain un-split.
 */
const fs=require('node:fs');
const p229=require('./skill_reference_scenario_gate.cjs');
const specificity=require('./skill_specificity32_research.cjs');
const model=require('./globalsim_roster32.cjs');
const TRIAL_POINTS=Object.freeze([0.1,1,5,10]);
const STRICT_STATUS=Object.freeze({
 'first-strict-all-matched-contexts':'first',
 'second-strict-all-matched-contexts':'second'
});
const CONSISTENT=new Set(['consistent-in-all-tested-contexts',
 'consistent-in-observed-contexts-missing-style-scenario']);
const round=x=>Number(x.toFixed(6));
const key=(...xs)=>xs.join('|');
const keyFrom=(c,a,b)=>key(c.sourceNumericId,c.surface,c.distanceScope,
 c.timing,c.bandId,a,b);
function crossContextMargins(conditions,rows){
 if(!Array.isArray(conditions)||!Array.isArray(rows))
  throw Error('P2.30 missing original context or P2.29 consensus');
 const index=new Map();
 for(const c of conditions){
  if(![9,12].includes(c.fieldSize)||!Array.isArray(c.pairwise))
   throw Error('P2.30 malformed source context');
  for(const p of c.pairwise){
   const id=keyFrom(c,p.first,p.second),n=c.fieldSize;
   if(!index.has(id))index.set(id,new Map());
   const group=index.get(id);
   if(group.has(n))throw Error('P2.30 duplicate headcount source pair');
   group.set(n,p);
  }
 }
 const out=[],seen=new Set();
 for(const p of rows){
  const id=keyFrom(p,p.first,p.second);
  if(seen.has(id))throw Error('P2.30 duplicate consensus pair');
  seen.add(id);
  const group=index.get(id);
  if(!group||group.size!==2||![9,12].every(n=>group.has(n)))
   throw Error('P2.30 missing original 9/12 pair');
  const marginCandidates=[],missing=[],held=[];
  for(const n of [9,12]){
   const x=group.get(n);
   for(const scenario of model.SCENARIOS){
    const cell=x.byScenario?.[scenario];
    if(!cell||typeof cell.status!=='string')
     throw Error('P2.30 missing original roster scenario');
    const cellDirection=STRICT_STATUS[cell.status];
    const raw=cell.minimumCertifiedLeadPoints;
    if(cellDirection){
     if(!Number.isFinite(raw)||raw<=specificity.EPS)
      throw Error('P2.30 strict source comparison without certified gap');
     if(CONSISTENT.has(p.result)&&cellDirection!==p.observedDirection)
      throw Error('P2.30 direction drift between source and consensus');
     marginCandidates.push({fieldSize:n,scenario,
      certifiedLowerGapPoints:raw,direction:cellDirection});
    }else{
     if(raw!==null)
      throw Error('P2.30 held/absent comparison cannot claim certified gap');
     if(cell.status==='held-absent-style')missing.push({fieldSize:n,scenario});
     else held.push({fieldSize:n,scenario,status:cell.status});
    }
   }
  }
  if(marginCandidates.length+missing.length+held.length!==8)
   throw Error('P2.30 lost scenario/headcount comparison cell');
  const eligible=CONSISTENT.has(p.result);
  if(eligible&&(!marginCandidates.length||held.length||
   marginCandidates.length!==p.comparableScenarioHeadcounts||
   missing.length!==p.missingStyleScenarioHeadcounts||
   (p.result==='consistent-in-all-tested-contexts'&&missing.length)||
   (p.result==='consistent-in-observed-contexts-missing-style-scenario'&&!missing.length)))
   throw Error('P2.30 inconsistent strict-coverage claim');
  if(!eligible&&p.result==='no-comparable-scenario'&&marginCandidates.length)
   throw Error('P2.30 no-comparable claim contradicts source evidence');
  const min=eligible?round(Math.min(...marginCandidates
   .map(x=>x.certifiedLowerGapPoints))):null;
  const thresholdTrial=eligible?Object.fromEntries(
   TRIAL_POINTS.map(t=>[String(t),min>=t])):null;
  out.push({sourceNumericId:p.sourceNumericId,
   surface:p.surface,distanceScope:p.distanceScope,
   timing:p.timing,bandId:p.bandId,first:p.first,second:p.second,
   P229ContextStatus:p.result,observedDirection:p.observedDirection,
   comparableCells:marginCandidates.length,absentStyleCells:missing.length,
   heldOrTiedCells:held.length,
   smallestIntervalCertifiedWGapPoints:min,
   experimentalGapRequirements:thresholdTrial,
   researchOnly:true
  });
 }
 if(out.length!==rows.length||seen.size!==index.size)
  throw Error('P2.30 source / consensus cohort mismatch');
 return out;
}
function sensitivity(rows){
 const sum=[];
 for(const t of TRIAL_POINTS){
  const eligible=rows.filter(r=>CONSISTENT.has(r.P229ContextStatus));
  const full=eligible.filter(r=>
   r.P229ContextStatus==='consistent-in-all-tested-contexts');
  const limited=eligible.filter(r=>
   r.P229ContextStatus==='consistent-in-observed-contexts-missing-style-scenario');
  const enough=xs=>xs.filter(r=>r.experimentalGapRequirements[String(t)]).length;
  sum.push({minimumCertifiedGapPoints:t,
   fullEightContextComparisons:enough(full),
   observedOnlyComparisonsWithAbsentStyle:enough(limited),
   allComparableConsistent:enough(eligible),
   eligibleButBelowTrialGap:eligible.length-enough(eligible),
   alreadyReversedOrHeld:rows.length-eligible.length,
   candidateNotAdopted:true});
 }
 for(let i=1;i<sum.length;i++){
  if(sum[i].allComparableConsistent>sum[i-1].allComparableConsistent||
   sum[i].fullEightContextComparisons>sum[i-1].fullEightContextComparisons||
   sum[i].observedOnlyComparisonsWithAbsentStyle>
    sum[i-1].observedOnlyComparisonsWithAbsentStyle)
   throw Error('P2.30 sensitivity cannot increase with stricter gap');
 }
 return sum;
}
function audit(input){
 const baseline=p229.audit(input); // all P2.29 fixed-sha, 32 profile, 9/12 and pair gates
 const rows=crossContextMargins(input.conditions,baseline.crossContextConsistency.rows);
 if(rows.length!==192||rows.filter(r=>
   r.P229ContextStatus==='consistent-in-all-tested-contexts').length!==69||
  rows.filter(r=>
   r.P229ContextStatus==='consistent-in-observed-contexts-missing-style-scenario').length!==66)
  throw Error('P2.30 fixed source consensus population drift');
 const gaps=rows.filter(r=>r.smallestIntervalCertifiedWGapPoints!==null)
  .map(r=>r.smallestIntervalCertifiedWGapPoints);
 const summary={sourceConditionStylePairs:192,
  fullCoverageDirectionOnly:69,observedOnlyDirectionOnly:66,
  reversedOrHeld:57,certifiedGapObservedIn: gaps.length,
  minimumRecordedCertifiedGapPoints:round(Math.min(...gaps)),
  maximumRecordedCertifiedGapPoints:round(Math.max(...gaps)),
  gapTrialSensitivity:sensitivity(rows)};
 return {schemaVersion:1,
  status:'P2.30-interval-certified-relative-W-gap-sensitivity-not-skill-or-product-rating',
  source:{modelRevision:baseline.originalFixedModelRevision,
   umaSimSkillSHA256:baseline.sourceSkillRegistrySha256},
  reference:{P229Status:baseline.status,
   sourceConditions:32,stylePairs:192,scenarios:model.SCENARIOS,
   headcounts:[9,12],sourceEligibleCourseContexts:true,
   abilityModes:model.MODES,
   sourceDataIsPooled30Seeds:true,
   distinctSeedSplitConfidence:'NOT TESTED IN THIS STUDY',
   representativeness:'NOT ESTABLISHED'},
  summary,rows,
  limitations:[
   'Illustrative 0.1/1/5/10 percentage-point cutoffs are sensitivity probes, not adopted product suitability thresholds.',
   'Minimum guaranteed margin is within each modeled course/ability/roster/headcount rank-tie interval only; it is NOT a sampling confidence bound.',
   '30 pooled paired seeds are NOT independent 15+15 stability checks; no statistical confidence interval is claimed.',
   'The 66 observed-only comparisons omit noFront Nige contexts; missing runners are never a zero margin or a loss.',
   'Rank/time source subconditions are NOT full AND/OR/Invoke skill activation, effects, or card suitability.',
   'No realistic opponent or event/course population weights and no real game proc probability can be derived.'
  ]};
}
function main(args){
 if(args.length!==2)throw Error('Usage: skill_context_margin_sensitivity.cjs <p2-source-two-axis.json> <output.json>');
 const out=audit(JSON.parse(fs.readFileSync(args[0],'utf8')));
 fs.writeFileSync(args[1],JSON.stringify(out,null,2)+'\n');
 console.log('P2_30_CERTIFIED_W_GAP='+JSON.stringify({summary:out.summary,
  limits:out.limitations.slice(0,3)}));
}
if(require.main===module)try{main(process.argv.slice(2))}
 catch(e){console.error(e.stack||e);process.exitCode=1}
module.exports={TRIAL_POINTS,crossContextMargins,sensitivity,audit,main};
