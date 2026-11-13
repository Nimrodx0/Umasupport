'use strict';
/*
 * P2.32: source-preserving, game-specification-first omission triage.
 *
 * This is NOT a predicate evaluator and applies ZERO omissions. It only
 * identifies source predicate occurrences that can be left out of a
 * CONDITIONAL three-axis comparison after documented assumptions are met.
 * It never makes an unknown AND true, or publishes skill/card ratings.
 */
const SOURCE_REV='f6e4501ee6c6c2d4ac8698e7796e309d31575bde';
const CHECKER_URL='https://github.com/mee1080/umasim/blob/'+SOURCE_REV+
 '/race/src/commonMain/kotlin/io/github/mee1080/umasim/race/calc2/SkillChecker.kt#L66';
const AXES=Object.freeze(['style','distance','surface']);
const OPERATORS=new Set(['==','!=','<','<=','>','>=']);
const EXPLICIT_GATES=new Set([
 'running_style','distance_type','ground_type','ground_condition',
 'rotation','track_id','is_basis_distance'
]);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const SPEC_RULES=Object.freeze({
 motivation:Object.freeze({
  sourceType:'motivation',
  rule:'fixed-motivation-conditional-axis-comparison',
  mechanism:'UmaSim checks motivation against baseSetting.umaStatus.condition.value before the race.',
  sourceReference:CHECKER_URL,
  comparableAxes:AXES,
  requiredAssumptions:Object.freeze([
   'motivation-predicate-satisfied-in-all-compared-cases',
   'same-motivation-value-in-all-compared-cases'
  ]),
  doesNotProve:Object.freeze([
   'unconditional-activation-opportunity',
   'independence-of-real-world-motivation-distributions',
   'skill-trigger-probability',
   'independence-of-all-other-AND-preconditions'
  ])
 })
});
function classify(type){
 if(Object.hasOwn(SPEC_RULES,type))
  return {classification:'conditional-axis-omission-candidate',
   evidenceKind:'pinned-game-model-specification',
   rule:SPEC_RULES[type].rule};
 if(EXPLICIT_GATES.has(type))
  return {classification:'retain-explicit-eligibility',
   evidenceKind:'source-condition-structure',rule:null};
 return {classification:'hold-for-spec-or-impact-review',
  evidenceKind:'not-yet-established',rule:null};
}
function validatedRows(rows,sourceSide){
 if(!Array.isArray(rows))throw Error('P2.32 invalid '+sourceSide+' OR matrix');
 return rows.map((terms,orIndex)=>{
  if(!Array.isArray(terms))
   throw Error('P2.32 invalid '+sourceSide+' AND group');
  return terms.map((p,andIndex)=>{
   if(!isObject(p)||typeof p.type!=='string'||!p.type||
      !OPERATORS.has(p.operator)||!Number.isSafeInteger(p.value))
    throw Error('P2.32 invalid source predicate '+sourceSide+'/'+orIndex+'/'+andIndex);
   return {sourceSide,orIndex,andIndex,type:p.type,...classify(p.type)};
  });
 });
}
function analyzeSkill(skill){
 if(!isObject(skill)||typeof skill.id!=='string'||!skill.id)
  throw Error('P2.32 invalid app skill');
 const profile=skill.activationProfile;
 if(profile?.status!=='source-structure')
  return {skillId:skill.id,status:'source-unavailable',
   sourceNumericId:null,occurrences:[],reason:profile?.reason||profile?.status||'missing'};
 if(!/^\d+$/.test(profile.sourceNumericId||'')||
    !Array.isArray(profile.invokes)||!profile.invokes.length)
  throw Error('P2.32 invalid source identity or invokes');
 const occurrences=[];
 for(const [invokeOffset,invoke] of profile.invokes.entries()){
  if(!isObject(invoke))throw Error('P2.32 invalid invoke');
  const invokeIndex=invoke.index??invokeOffset;
  if(!Number.isSafeInteger(invokeIndex))
   throw Error('P2.32 invalid invoke index');
  for(const sourceSide of ['preConditions','conditions']){
   const rows=validatedRows(invoke[sourceSide],sourceSide);
   for(const row of rows)for(const occurrence of row)
    occurrences.push({invokeOffset,invokeIndex,...occurrence});
  }
 }
 return {skillId:skill.id,sourceNumericId:profile.sourceNumericId,
  status:'original-source-structure-classified-not-runtime-measured',
  occurrences};
}
function audit(model){
 if(!isObject(model)||!Array.isArray(model.skills)||!isObject(model.skillById))
  throw Error('P2.32 app skill model required');
 const before=JSON.stringify(model);
 const rows=model.skills.map(analyzeSkill);
 if(JSON.stringify(model)!==before)
  throw Error('P2.32 must not mutate app model');
 if(new Set(rows.map(x=>x.skillId)).size!==rows.length)
  throw Error('P2.32 duplicated app skill ID');
 const matched=rows.filter(x=>x.sourceNumericId!==null);
 if(new Set(matched.map(x=>x.sourceNumericId)).size!==matched.length)
  throw Error('P2.32 duplicate original numeric skill identity');
 const all=matched.flatMap(x=>x.occurrences);
 const byClassification={};
 for(const row of all)
  byClassification[row.classification]=(byClassification[row.classification]||0)+1;
 const candidates=matched.filter(x=>x.occurrences.some(o=>
  o.classification==='conditional-axis-omission-candidate'));
 const count=cls=>byClassification[cls]||0;
 return {
  schemaVersion:1,
  status:'p2-32-game-spec-conditional-omission-triage-only',
  scope:'source-matched-app-skills-read-only',
  axes:AXES,
  pinnedGameModelRevision:SOURCE_REV,
  specRules:SPEC_RULES,
  denominators:{
   appSkills:rows.length,sourceMatchedSkills:matched.length,
   sourceUnavailableSkills:rows.length-matched.length,
   originalPredicateOccurrences:all.length,
   conditionalOmissionCandidateOccurrences:count('conditional-axis-omission-candidate'),
   conditionalOmissionCandidateSkills:candidates.length,
   explicitGateOccurrences:count('retain-explicit-eligibility'),
   holdForReviewOccurrences:count('hold-for-spec-or-impact-review'),
   actualAppliedOmissions:0,
   confirmedUnconditionalSkillActivation:0,
   officialSkillOrCardRatings:0
  },
  byClassification,
  rows,
  boundaries:[
   'Candidate only. The source predicate is not removed, replaced with TRUE or applied to a model.',
   'The motivation rule concerns a three-axis contrast only after its predicate is satisfied at the SAME FIXED motivation in every compared case.',
   'Even a common gating predicate can strongly restrict absolute opportunity outside the fixed-state scenario.',
   'A shared condition need not have identical real-world prevalence across styles, distances or surfaces.',
   'Other source types and AND/OR/Invoke/preConditions remain intact; missing evidence never means axis-neutrality.',
   'No actual skill triggers, P2 W/D suitability, probability, real-game reproduction or P3/P4 adoption are claimed.'
  ]
 };
}
module.exports={AXES,SOURCE_REV,SPEC_RULES,EXPLICIT_GATES,
 classify,analyzeSkill,audit};
