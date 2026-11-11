'use strict';
/*
 * P2, deliberately SMALL product-oriented review bridge.
 *
 * Reuse the existing documented P1 structural profile and existing P2
 * balanced-four-style and source-fit evaluators. No new thresholds, race
 * physics, random probability model, user-facing rating or card mutation.
 *
 * The purpose is to answer which SKILLS have enough evidence for a rough
 * running-style hint; missing AND / OR coverage must remain visibly partial.
 */
const four=require('./skill_balanced_four_style_fit.cjs');
const old=require('./skill_activation_fit_v1.cjs');
const STYLES=four.STYLES.map(x=>x.name);
const VERSION='p2-coarse-skill-4style-review-v1';
const TIER={
 'relative-leader':'モデル順位で上位傾向',
 'relative-intermediate':'モデル順位で中間',
 'relative-trailer':'モデル順位で下位傾向',
 'partial-order-unresolved':'モデル脚質間の優劣未確定'
};
const labels={
 'explicit-ineligible':'明示条件で発動不可',
 'four-style-direction':'4脚質別の順位傾向',
 'partial-four-style-direction':'順位条件だけの部分的な傾向',
 'two-group-reference':'旧2群の参考傾向',
 'race-global-only':'確認済み条件に脚質差なし',
 'held':'脚質適性の判断保留',
 'unavailable':'元スキル条件が未照合'
};
function summarize(skill){
 if(!skill||typeof skill.id!=='string'||typeof skill.name!=='string')
  throw Error('Missing app skill identity');
 const profile=skill.activationProfile;
 if(profile?.status!=='source-structure'){
  return {skillId:skill.id,skillName:skill.name,
   sourceNumericId:null,sourceStatus:profile?.status||'absent',
   styles:Object.fromEntries(STYLES.map(name=>[name,{
    status:'unavailable',label:labels.unavailable,
    reason:profile?.reason||'no-source-profile'}]))};
 }
 const f=four.evaluate(profile),o=old.evaluate(profile);
 const styles={};
 for(const name of STYLES){
  const a=f.styles[name],b=o.styles[name];
  if(!a||!b)throw Error('Evaluator lost style '+name);
  const supported=a.paths.flatMap((p,j)=>{
   const raw=p.status==='model-comparative-evidence'?
    p.comparison:p.partialRankEvidence?.byStyle;
   if(!raw)return [];
   return [{invokeIndex:p.invokeIndex,orIndex:p.orIndex,
    status:p.status==='model-comparative-evidence'?'fully-supported-rank-subcondition':
     'partial-rank-only-other-conditions-unchecked',
    tier:raw.tier,higherThan:raw.higherThan,lowerThan:raw.lowerThan,
    heldAgainst:raw.heldAgainst}];
  });
  let status,detail=null,reason=null;
  if(a.status==='ineligible'&&b.status==='ineligible')
   status='explicit-ineligible';
  else if(a.status==='model-comparative-evidence'){
   status='four-style-direction';detail=a.comparison;
  }else if(supported.length){
   status='partial-four-style-direction';reason=a.status;
  }else if(['high','low','dependent'].includes(b.status)){
   status='two-group-reference';reason=b.status;
  }else if(b.status==='neutral'){
   status='race-global-only';
  }else{
   status='held';reason=b.reason||a.status;
  }
  // Never expose an overall 4-style rank if any source alternative is
  // unresolved. A partial evidence row is an informational hint only.
  if(status==='four-style-direction'&&a.paths.length!==1)
   throw Error('Unsupported whole-skill rank merge');
  if(status==='explicit-ineligible'&&a.paths.some(p=>p.status!=='ineligible'))
   throw Error('Excluded style still has reachable source alternative');
  styles[name]={
   status,label:labels[status],
   ...(detail?{rankEvidence:TIER[detail.tier]||null,
    modelTier:detail.tier,
    higherThan:detail.higherThan,
    lowerThan:detail.lowerThan,
    heldAgainst:detail.heldAgainst}:{}),
   ...(supported.length?{supportedRankBranches:supported}:{}),
   ...(reason?{reason}:{}),
   scope:status==='explicit-ineligible'?'exact-source-running-style-exclusion':
    status==='race-global-only'?'known-race-global-conditions-only':
    status==='four-style-direction'?'model-balanced-comparative-rank-only':
    status==='two-group-reference'?'older-front-vs-back-model-reference':
    'no-whole-skill-style-suitability-claim'
  };
 }
 return {skillId:skill.id,skillName:skill.name,
  sourceNumericId:profile.sourceNumericId,
  sourceStatus:'source-structure',
  styles};
}
function report(model){
 if(!model||!Array.isArray(model.skills))
  throw Error('Expected app skill registry');
 const rows=model.skills.map(summarize);
 const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,0]));
 const atLeastOne={fourStyle:0,partialFourStyle:0,twoGroupReference:0,
  explicitIneligible:0,raceGlobalOnly:0,unavailable:0,held:0};
 for(const x of rows){
  const types=new Set();
  for(const style of STYLES){
   const s=x.styles[style];
   if(!s||!Object.hasOwn(counts,s.status))
    throw Error('Unaccounted source style evidence class');
   counts[s.status]++;types.add(s.status);
  }
  if(types.has('four-style-direction'))atLeastOne.fourStyle++;
  if(types.has('partial-four-style-direction'))atLeastOne.partialFourStyle++;
  if(types.has('two-group-reference'))atLeastOne.twoGroupReference++;
  if(types.has('explicit-ineligible'))atLeastOne.explicitIneligible++;
  if(types.has('race-global-only'))atLeastOne.raceGlobalOnly++;
  if(types.has('unavailable'))atLeastOne.unavailable++;
  if(types.has('held'))atLeastOne.held++;
 }
 if(rows.length!==model.skills.length||
  Object.values(counts).reduce((a,b)=>a+b,0)!==rows.length*4)
  throw Error('4-style skill cohort lost rows');
 return {schemaVersion:1,
  status:'P2-rough-skill-by-skill-evidence-review-not-production-rating',
  version:VERSION,
  sourceMatchedSkills:rows.filter(x=>x.sourceStatus==='source-structure').length,
  appSkillCount:rows.length,styles:STYLES,
  modelScenario:'balanced-only',fixedReferenceFieldSizes:[9,12],
  perStyleCounts:counts,skillCoverage:atLeastOne,rows,
  warnings:[
   'Intended for rough skill-by-skill visual inspection, NOT quantitative probabilities or user-facing card scores.',
   'A model ordinal comparison is rank-condition evidence, never a full skill activation guarantee; 4-style relative tier does not assert in-game skill usefulness.',
   'Partial rank evidence retains other AND/OR paths unresolved: do not promote it to a whole-skill high/low value.',
   'Old two-group evidence is included for comparison only and must not be treated as a distinct four-style ranking.',
   'Explicit ineligibility applies only when all source alternative paths rule out the running style.',
   'Missing 63 source matches remain unknown rather than generic or false; no skill text/source payload is redistributed.'
  ]};
}
module.exports={VERSION,STYLES,TIER,labels,summarize,report};
