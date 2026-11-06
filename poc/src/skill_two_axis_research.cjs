'use strict';
/* Research-only overlay. Do NOT replace existing labels or infer trigger rates.
 * Unknown AND / OR / preconditions still block full-skill inference. */
const base=require('./skill_balanced_four_style_fit.cjs');
const VERSION='balanced-two-axis-rank-component-v1';
function summaryIndex(report){
 if(!report||report.schemaVersion!==1||
  report.status!=='research-two-axis-rank-condition-only-not-skill-activation'||
  report.scenario!=='balanced'||
  report.modelRevision!==base.EVIDENCE.sourceRevision||
  report.sourceFourStyleReportSha256!==base.EVIDENCE.fullReportSha256||
  !Array.isArray(report.results)||report.results.length!==44)
  throw Error('Unpinned or incomplete balanced two-axis report');
 const index=new Map();
 for(const row of report.results){
  const k=row.phase+'|'+row.bandId;
  if(index.has(k)||!Number.isInteger(row.phase)||
   row.phase<0||row.phase>3||row.scenario!=='balanced'||
   !base.EVIDENCE.bands.includes(row.bandId)||
   !row.styles||typeof row.styles!=='object')
   throw Error('Duplicate or invalid model two-axis row '+k);
  for(const s of base.EVIDENCE.styles){
   const v=row.styles[s];
   if(!v||v.opportunity?.status!=='model-rank-distance-occupancy'||
    v.specificity?.status!=='rank-band-relative-advantage-not-skill-utility'||
    !Number.isFinite(v.opportunity.meanPercent)||
    v.opportunity.meanPercent<0||v.opportunity.meanPercent>100||
    !Number.isFinite(v.specificity.deviationFromUniformReferencePoints)||
    !Array.isArray(v.specificity.heldAgainst))
    throw Error('Malformed model axes '+k+' '+s);
  }
  index.set(k,row);
 }
 return index;
}
function evaluate(profile,twoAxisReport){
 const index=summaryIndex(twoAxisReport);
 const prior=base.evaluate(profile);
 if(prior.status!=='research-only-not-production')
  return {...prior,twoAxisVersion:VERSION,twoAxisStatus:'held-input'};
 const styles=Object.fromEntries(Object.entries(prior.styles)
  .map(([name,style])=>{
   const code=base.STYLES.find(s=>s.name===name)?.code;
   if(!code)throw Error('Unexpected style identity '+name);
   const paths=style.paths.map(path=>{
    const e=path.modelRankEvidence||path.partialRankEvidence;
    if(!e)return {...path,twoAxis:null};
    const row=index.get(e.phase+'|'+e.bandId);
    if(!row)throw Error('Model two-axis data missing '+e.phase+'/'+e.bandId);
    const axes=row.styles[code];
    return {...path,twoAxis:{
     status:'rank-condition-component-only',
     wholeSkillValidated:false,
     conditionMatched:path.status==='model-comparative-evidence',
     scenario:'balanced',phase:e.phase,bandId:e.bandId,
     opportunity:axes.opportunity,specificity:axes.specificity,
     note:'Position occupancy is not an activation probability; specificity is not skill effect utility.'
    }};
   });
   const complete=style.status==='model-comparative-evidence'&&
    paths.length===1&&paths[0].twoAxis?.conditionMatched===true;
   return [name,{...style,paths,
    twoAxis:complete?paths[0].twoAxis:null,
    twoAxisStatus:complete?'measured-rank-component':
     'held-or-unmeasured-full-skill'}];
  }));
 return {...prior,styles,twoAxisVersion:VERSION,
  twoAxisStatus:'research-only-rank-component',
  twoAxisPolicy:'opportunity-and-specificity-separated-no-high-low-threshold',
  effectUtility:{status:'future-separate-axis-not-assessed'},
  neverClaimed:['real-game-trigger-rate','complete-skill-usefulness',
   'support-card-total-score']};
}
module.exports={VERSION,summaryIndex,evaluate};
