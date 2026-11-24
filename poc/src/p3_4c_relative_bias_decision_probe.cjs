'use strict';
/*
 * P3.4c research ONLY:
 * (A) Demonstrate a 3-state relative-bias classification on explicitly
 *     SYNTHETIC, complete, same-scope four-style pairwise difference envelopes.
 * (B) Audit the genuine 881-source P3.4a intake WITHOUT assigning any label.
 *
 * "General" means no materially important difference between styles,
 * independent of the absolute opportunity/proc level. An unobserved difference
 * is NOT evidence of equivalence. No production scoring or source-game proc.
 */
const p34=require('./p3_4_uncertainty_semantics.cjs');
const STYLES=Object.freeze(['Nige','Senkou','Sasi','Oikomi']);
const SOURCE_PAIRS=Object.freeze(STYLES.flatMap((a,i)=>
 STYLES.slice(i+1).map(b=>a+'|'+b)));
const STATUS='P3.4c-relative-bias-synthetic-logic-plus-real-source-blockers-no-label';
const fail=(x,reason)=>{if(!x)throw Error('P3.4c relative bias probe: '+reason)};
const canonical=(a,b)=>STYLES.indexOf(a)<STYLES.indexOf(b)?
 a+'|'+b:b+'|'+a;
function illustrativeClassification(panel,materialMarginPoints){
 fail(panel?.basis==='synthetic-illustration-not-game-source'&&
  typeof panel.scopeId==='string'&&panel.scopeId.length>0,
  'only explicitly synthetic same-scope evidence may be classified');
 fail(Number.isFinite(materialMarginPoints)&&materialMarginPoints>=0&&
  materialMarginPoints<=100,
  'nonnegative finite illustrative point margin must be supplied explicitly');
 fail(Array.isArray(panel.eligibleStyles)&&
  panel.eligibleStyles.length===4&&
  STYLES.every(s=>panel.eligibleStyles.includes(s))&&
  new Set(panel.eligibleStyles).size===4,
  'all four styles must be comparable in the same source scope');
 fail(Array.isArray(panel.pairs),'six same-scope synthetic comparisons required');
 const map=new Map();
 for(const item of panel.pairs){
  fail(item&&STYLES.includes(item.first)&&STYLES.includes(item.second)&&
   item.first!==item.second&&item.scopeId===panel.scopeId,
   'style or source context scope missing/mismatched');
  const k=canonical(item.first,item.second);
  fail(SOURCE_PAIRS.includes(k)&&!map.has(k),
   'duplicate/unknown synthetic pair');
  fail(Number.isFinite(item.lowerDifferencePoints)&&
   Number.isFinite(item.upperDifferencePoints)&&
   item.lowerDifferencePoints<=item.upperDifferencePoints&&
   item.lowerDifferencePoints>=-100&&item.upperDifferencePoints<=100,
   'invalid hypothetical pairwise difference envelope');
  const sign=SOURCE_PAIRS.includes(item.first+'|'+item.second)?1:-1;
  const low=sign===1?item.lowerDifferencePoints:-item.upperDifferencePoints;
  const high=sign===1?item.upperDifferencePoints:-item.lowerDifferencePoints;
  map.set(k,{low,high});
 }
 fail(map.size===SOURCE_PAIRS.length,'incomplete four-style comparison');
 const classifications={};
 let unresolved=0,strong=0;
 for(const key of SOURCE_PAIRS){
  const {low,high}=map.get(key);
  let relation;
  if(low>materialMarginPoints){relation='first-stronger';strong++}
  else if(high< -materialMarginPoints){relation='second-stronger';strong++}
  else if(low>= -materialMarginPoints&&high<=materialMarginPoints)
   relation='within-illustrative-equivalence-bound';
  else {relation='undetermined-overlapping-margin';unresolved++}
  classifications[key]=relation;
 }
 const make=(state,styles,reason)=>({
  schemaVersion:1,analysisOnly:true,approvedForP3OrP4:false,
  realSkillLabel:null,wholeSkillActivationProbability:null,
  comparisonScopeId:panel.scopeId,
  materialMarginPoints,classification:state,styleTargets:styles,
  reason,pairedHypotheticalRelations:classifications
 });
 if(unresolved)return make('undetermined',[],
  'some pairwise difference ranges cross the illustrative materiality boundary');
 if(strong===0)return make('general',[],
  'all six pair differences are bounded inside the same relative margin; absolute opportunity is irrelevant');
 const compare=(a,b)=>{
  const relation=classifications[canonical(a,b)];
  if(relation==='within-illustrative-equivalence-bound')return 'equal';
  if(relation==='first-stronger')
   return STYLES.indexOf(a)<STYLES.indexOf(b)?'win':'loss';
  return STYLES.indexOf(a)<STYLES.indexOf(b)?'loss':'win';
 };
 const tops=STYLES.filter(a=>STYLES.every(b=>
  a===b||compare(a,b)!=='loss'));
 if(tops.length===0||tops.length===4)return make('undetermined',[],
  'cyclic or inconsistent synthetic ordering');
 // Winners must form one unambiguous common top equivalence class.
 if(!tops.every((a,i)=>tops.slice(i+1).every(b=>
  compare(a,b)==='equal'))||
  !tops.every(a=>STYLES.filter(b=>!tops.includes(b)).every(b=>
  compare(a,b)==='win')))
  return make('undetermined',[],
   'near-equivalence is nontransitive or top styles are not uniformly stronger');
 // Exclude cycles in all equivalence classes, not just the leading styles.
 for(const a of STYLES)for(const b of STYLES)for(const c of STYLES){
  if(a!==b&&b!==c&&a!==c&&compare(a,b)==='equal'&&
   compare(b,c)==='equal'&&compare(a,c)!=='equal')
   return make('undetermined',[],'nontransitive synthetic equivalence');
  if(a!==b&&b!==c&&a!==c&&compare(a,b)==='win'&&
   compare(b,c)==='win'&&compare(a,c)!=='win')
   return make('undetermined',[],'nontransitive synthetic ordering');
 }
 return make('targeted',tops,
  'synthetic top group has a material relative advantage over every outside style');
}
function illustrativeSweep(panel,margins){
 fail(Array.isArray(margins)&&margins.length>0&&margins.length<=12&&
  new Set(margins).size===margins.length,
  'distinct small illustrative margin panel required');
 return margins.map(margin=>illustrativeClassification(panel,margin));
}
function inspectP34aRealResearch(preview){
 fail(preview?.status===p34.STATUS&&
  preview?.provenance?.officialPolicyApproved===false&&
  preview?.denominators?.appSkills===881&&
  preview?.denominators?.sourceMatchedSkills===818&&
  preview?.denominators?.sourceUnavailableSkills===63&&
  preview?.denominators?.officialSkillOrCardScores===0&&
  Array.isArray(preview.rows)&&preview.rows.length===881,
  'unexpected or approved source research intake');
 const byStudy={},sourcePresence={matched:0,unmatched:0};
 const rows=[],seen=new Set();
 for(const row of preview.rows){
  fail(typeof row?.appSkillId==='string'&&!seen.has(row.appSkillId)&&
   row.wholeSkillSuitability===null&&row.suitabilityLabel===null&&
   row.cardScore===null&&row.eligibleForP3CardScoring===false&&
   row.officialGameProcRate===null&&
   Array.isArray(row.unresolvedReasons)&&
   row.unresolvedReasons.includes('full-original-AND-OR-Invoke-unverified'),
   'research row may not be treated as whole skill suitability');
  seen.add(row.appSkillId);
  const bucket=row.modelPartialWD?.status;
  fail(['partial-source-window-research-only',
   'held-source-ground-not-covered-by-model',
   'no-additional-short-window-study'].includes(bucket),
   'unrecognized source P2 model evidence');
  byStudy[bucket]=(byStudy[bucket]||0)+1;
  const matched=row.staticSourceApplicability?.sourceMatch==='matched';
  fail(matched||
   row.staticSourceApplicability?.sourceMatch==='unmatched',
   'missing original source match state');
  sourcePresence[matched?'matched':'unmatched']++;
  const blocked=[...row.unresolvedReasons];
  rows.push({
   appSkillId:row.appSkillId,
   sourceNumericId:row.sourceNumericId,
   sourceMatch:row.staticSourceApplicability.sourceMatch,
   partialResearchStatus:bucket,
   blockers:blocked,
   officialStyleSuitability:null,
   internalStylePreview:null,
   eligibleForCardScoring:false
  });
 }
 fail(byStudy['partial-source-window-research-only']===81&&
  byStudy['held-source-ground-not-covered-by-model']===6&&
  byStudy['no-additional-short-window-study']===794&&
  sourcePresence.matched===818&&sourcePresence.unmatched===63,
  'P2 study cohort has changed unexpectedly');
 return {
  schemaVersion:1,status:STATUS,
  provenance:{sourceP34aStatus:preview.status,
   sourceUmaSimSHA256:preview.provenance.sourceOriginalRegistrySHA256,
   thisIsNotCommercialGameProc:true,
   userApprovedRelativeOnlyGeneralDefinition:true,
   modelComparisonToUserLabelConversionApproved:false},
  summary:{appSkills:rows.length,originalMatched:sourcePresence.matched,
   sourceUnmatched:sourcePresence.unmatched,
   modelPartialWDSourceSkills:byStudy['partial-source-window-research-only'],
   modelGroundHeld:byStudy['held-source-ground-not-covered-by-model'],
   noAdditionalShortWindow:byStudy['no-additional-short-window-study'],
   actualSkillBiasLabelsApproved:0,
   generalSkillLabelsApproved:0,targetedSkillLabelsApproved:0,
   cardSuitabilityScoresApproved:0},
  nextEvidenceNeeds:[
   'original-source skill AND/OR and omitted-condition impact review by scope',
   'all necessary same-scope comparable style pairs or source-logic neutrality certificate',
   'relative-gap materiality and uncertainty bounds approved for explicit axis',
   'equal-no-material-bias supported, NOT just failure-to-detect-a-difference',
   'comparison course/field/seed transfer and distance-OR branch applicability',
   'separate confirmed acquisition path before support-card aggregation'
  ],
  rows
 };
}
module.exports={STATUS,STYLES,SOURCE_PAIRS,illustrativeClassification,
 illustrativeSweep,inspectP34aRealResearch};
