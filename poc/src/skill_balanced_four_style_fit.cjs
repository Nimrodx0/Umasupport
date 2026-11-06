'use strict';
/* P2 research ONLY. Baseline is balanced opponents. A 4-style ordinal model
 * comparison is not the probability or usefulness of a skill activating.
 * Never substitute results from the three other/pooled opponent scenarios. */
const bounds=require('./skill_order_rate_bounds.cjs');
const older=require('./skill_activation_fit_v1.cjs');
const dominance=require('../tools/globalsim_rank_band_dominance.cjs');
const EVIDENCE=require('../data/p2_balanced_four_style_rank_direction.v1.json');
const VERSION='balanced-four-style-rank-research-v1';
const STYLES=Object.freeze([
 {id:1,code:'Nige',name:'逃げ'},
 {id:2,code:'Senkou',name:'先行'},
 {id:3,code:'Sasi',name:'差し'},
 {id:4,code:'Oikomi',name:'追込'}
]);
const sig=terms=>terms.map(c=>[c.type,c.operator,c.value].join('|'))
 .sort().join('&&');
const ranks=dominance.BANDS;
const codePairs=dominance.STYLES.flatMap((x,i)=>
 dominance.STYLES.slice(i+1).map(y=>[x,y]));
function validEvidence(e=EVIDENCE){
 if(!e||e.schemaVersion!==1||
  e.status!=='pinned-GlobalSim-balanced-four-style-pairwise-model-not-game-activation'||
  e.sourceRevision!=='80b54cacf174b54ff6f7ca27ee7f88b5856c0bd1'||
  !/^[a-f0-9]{64}$/.test(e.fullReportSha256)||
  e.races!==2160||e.seedsPerCell!==30||
  JSON.stringify(e.splitSeeds)!=='[15,15]'||
  e.sourceScenario!=='balanced'||e.contextsPerPhaseBand!==24||
  JSON.stringify(e.phases)!=='[0,1,2,3]'||
  JSON.stringify(e.styles)!==JSON.stringify(STYLES.map(s=>s.code))||
  JSON.stringify(e.pairs)!==JSON.stringify(codePairs)||
  JSON.stringify(e.bands)!==JSON.stringify(ranks.map(x=>x.id))||
  !Array.isArray(e.directionByPhase)||e.directionByPhase.length!==4)
  return false;
 return e.directionByPhase.every(phase=>Array.isArray(phase)&&
  phase.length===ranks.length&&phase.every(row=>
   typeof row==='string'&&/^[FS?]{6}$/.test(row)));
}
function exactBand(rankPredicates){
 if(!Array.isArray(rankPredicates)||!rankPredicates.length)
  return null;
 return ranks.find(b=>sig(b.predicates)===sig(rankPredicates))||null;
}
function bandProof(rankPredicates,phaseCondition,e=EVIDENCE){
 if(!validEvidence(e)||!phaseCondition||
  phaseCondition.type!=='phase_random'||
  phaseCondition.operator!=='=='||
  !Number.isSafeInteger(phaseCondition.value)||
  phaseCondition.value<0||phaseCondition.value>3)
  return null;
 const band=exactBand(rankPredicates);
 if(!band)return null;
 const row=e.directionByPhase[phaseCondition.value][
  ranks.findIndex(b=>b.id===band.id)];
 if(!row)return null;
 const relations=codePairs.map(([first,second],i)=>({
  first,second,direction:row[i]==='F'?'first-higher':
   row[i]==='S'?'second-higher':'held'
 }));
 const byStyle=Object.fromEntries(STYLES.map(style=>{
  const higherThan=[],lowerThan=[],heldAgainst=[];
  for(const other of STYLES.filter(s=>s.code!==style.code)){
   const p=relations.find(x=>(x.first===style.code&&
    x.second===other.code)||(x.second===style.code&&
    x.first===other.code));
   if(!p)throw Error('Incomplete balanced pair matrix');
   if(p.direction==='held')heldAgainst.push(other.code);
   else if((p.direction==='first-higher'&&p.first===style.code)||
    (p.direction==='second-higher'&&p.second===style.code))
    higherThan.push(other.code);
   else lowerThan.push(other.code);
  }
  const tier=heldAgainst.length?'partial-order-unresolved':
   higherThan.length===3?'relative-leader':
   lowerThan.length===3?'relative-trailer':'relative-intermediate';
  return [style.name,{style:style.code,tier,higherThan,lowerThan,
   heldAgainst}];
 }));
 return {status:'model-balanced-strict-comparison-not-skill-rate',
  sourceRevision:e.sourceRevision,sourceScenario:e.sourceScenario,
  modelEvidenceSha256:e.fullReportSha256,
  phase:phaseCondition.value,bandId:band.id,
  sourceRankPredicates:band.predicates,
  positionsByField:Object.fromEntries([9,12].map(n=>[n,
   bounds.andProjection(band.predicates,n).positions])),
  contextsPerPair:e.contextsPerPhaseBand,splitSeedHalves:e.splitSeeds,
  relations,byStyle};
}
const condOk=c=>c&&typeof c.type==='string'&&
 ['==','!=','<','<=','>','>='].includes(c.operator)&&
 Number.isSafeInteger(c.value);
const isRaceGate=c=>
 c.type==='distance_type'&&c.operator==='=='&&
 c.value>=1&&c.value<=4||
 (c.type==='ground_type'||c.type==='ground_condition')&&
 older.supportedGroundGate(c)&&
 (c.type==='ground_type'?[1,2]:[1,2,3,4]).some(v=>
  older.testOperator(v,c.operator,c.value));
const isRaceCondition=c=>['distance_type','ground_type',
 'ground_condition'].includes(c.type);
function branch(row,styleId,{preconditionRows=[] ,evidence=EVIDENCE}={}){
 if(!Array.isArray(row)||row.some(c=>!condOk(c))||
  !Array.isArray(preconditionRows)||preconditionRows.some(p=>
   !Array.isArray(p)||p.some(c=>!condOk(c))))
  throw Error('Invalid source condition AND/OR structure');
 const conditions=row.map(c=>({...c}));
 const style=STYLES.find(s=>s.id===styleId);
 if(!style)throw Error('Invalid style ID');
 const raceRequirements=conditions.filter(isRaceCondition);
 const excluded=older.explicitStyle(row,styleId)===false||
  preconditionRows.length>0&&preconditionRows.every(p=>
   older.explicitStyle(p,styleId)===false);
 if(excluded)return {status:'ineligible',
  reason:'explicit-source-running-style-exclusion',
  sourceConditions:conditions,raceRequirements};
 const rankTerms=row.filter(c=>c.type==='order_rate');
 const times=row.filter(c=>Object.hasOwn(
  require('./skill_rank_timing.js').TIME_SPECS,c.type));
 const phase=times.length===1?times[0]:null;
 const partial=bandProof(rankTerms,phase,evidence);
 const extra=row.filter(c=>c.type!=='order_rate'&&
  c.type!=='running_style'&&!Object.hasOwn(
   require('./skill_rank_timing.js').TIME_SPECS,c.type)&&
  !isRaceGate(c));
 const reasons=[];
 if(preconditionRows.length)reasons.push('source-preconditions-unmodelled');
 if(!partial)reasons.push('exact-rank-band-full-phase-unverified');
 if(times.length!==1)reasons.push('timing-predicates-not-one-full-phase');
 if(extra.length)reasons.push('extra-AND-conditions-unmeasured');
 if(reasons.length)return {status:'held',reason:reasons[0],allReasons:reasons,
  sourceConditions:conditions,raceRequirements,
  extraPredicates:extra,partialRankEvidence:partial?
   {bandId:partial.bandId,phase:partial.phase,
    byStyle:partial.byStyle[style.name]}:null};
 return {status:'model-comparative-evidence',
  reason:'pinned-balanced-rank-band-and-full-phase-only',
  sourceConditions:conditions,raceRequirements,
  provisionalSurfaceTransfer:raceRequirements.some(c=>
   c.type==='ground_type'||c.type==='ground_condition'),
  modelRankEvidence:{phase:partial.phase,bandId:partial.bandId,
   sourceScenario:partial.sourceScenario,
   sourceReportSha256:partial.modelEvidenceSha256,
   positionsByField:partial.positionsByField,
   contextsPerPair:partial.contextsPerPair,
   seedHalves:partial.splitSeedHalves},
  comparison:partial.byStyle[style.name]};
}
function evaluate(profile,evidence=EVIDENCE){
 if(!profile||profile.status!=='source-structure'||
  !Array.isArray(profile.invokes)||!profile.invokes.length)
  return {ruleVersion:VERSION,status:'held',
   reason:'source-activation-profile-unavailable'};
 const styles={};
 for(const style of STYLES){
  const paths=[];
  for(const [invokeIndex,invoke] of profile.invokes.entries()){
   if(!invoke||!Array.isArray(invoke.conditions)||
    !Array.isArray(invoke.preConditions))
    throw Error('Malformed source invoke structure');
   if(!invoke.conditions.length){
    paths.push({invokeIndex,orIndex:null,status:'held',
     reason:'empty-source-conditions'});
    continue;
   }
   invoke.conditions.forEach((row,orIndex)=>
    paths.push({invokeIndex,orIndex,
     ...branch(row,style.id,{preconditionRows:invoke.preConditions,
      evidence})}));
  }
  const overall=paths.every(p=>p.status==='ineligible')?'ineligible':
   paths.length===1?paths[0].status:'held-multiple-OR-or-invoke-paths';
  styles[style.name]={status:overall,
   comparison:overall==='model-comparative-evidence'?
    paths[0].comparison:null,paths};
 }
 return {ruleVersion:VERSION,status:'research-only-not-production',
  sourceNumericId:profile.sourceNumericId??null,
  scenario:'balanced',modelOnly:true,
  scope:'rank-condition-relative-comparison-not-real-activation-or-utility',
  styles};
}
module.exports={VERSION,STYLES,EVIDENCE,codePairs,sig,validEvidence,
 exactBand,bandProof,branch,evaluate};
