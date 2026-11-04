/* P2: qualitative POSITION (not effect-value) tendency for race running styles.
 * Independent from P1 explicit restrictions, rewards and hint availability.
 * Inputs must be source-matched activationProfiles. Never infer probability.
 * A skill-wide tendency requires all alternative activation branches to agree. */
(function(root){
'use strict';
const rankTiming=typeof module!=='undefined'&&module.exports
 ?require('./skill_rank_timing.js'):root.UmaSkillRankTiming;
const RULE_VERSION='rank-phase-style-v2';
const RULES=Object.freeze({
 FRONT:{id:'P2-RANK-AT-MOST-50-v1',band:'front-half',styles:[1,2],
  styleNames:['逃げ','先行'],primaryStyles:[1,2],additionalStyles:[],
  label:'逃げ・先行寄り'},
 FRONT_LATE:{id:'P2-RANK-AT-MOST-50-LATE-RANDOM-v2',
  band:'front-half-late-random',styles:[1,2,3,4],
  styleNames:['逃げ','先行','差し','追込'],
  primaryStyles:[1,2],additionalStyles:[3,4],
  label:'逃げ・先行／差し・追込も適性'},
 BACK:{id:'P2-RANK-OVER-50-v1',band:'back-half',styles:[3,4],
  styleNames:['差し','追込'],primaryStyles:[3,4],additionalStyles:[],
  label:'差し・追込寄り'}
});
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const unresolved=(status,reason,rest={})=>({status,reason,styles:[],
 inferred:false,ruleVersion:RULE_VERSION,...rest});
function direction(range){
 if(!range||range.empty||range.excluded.length)return null;
 const lo=range.lowerInclusive,hi=range.upperInclusive;
 // These bands use the source integer order_rate scale only. Do not
 // translate into fixed placings or assume a fixed field size.
 if(hi!==null&&hi<=50&&(lo===null||lo<=hi)&&hi>=1)return RULES.FRONT;
 if(lo!==null&&lo>50&&(hi===null||hi>=lo)&&lo<=100)return RULES.BACK;
 return null; // >=40, 30..80 etc span both halves.
}
// Only a source-defined *random* trigger which can occur within the latter
// half of phase 2 (after 75% of the race) broadens a FRONT rank condition.
// phase==2 is not a random trigger and must not be promoted based only on
// its theoretical interval. This is qualitative, not a measured frequency.
function contextualRule(baseRule,timeFacts){
 if(baseRule!==RULES.FRONT||!Array.isArray(timeFacts)||timeFacts.length!==1)
  return baseRule;
 const time=timeFacts[0];
 if(time.status!=='source-defined'||!time.randomWindow||time.courseDependent)
  return baseRule;
 if(time.windows.some(w=>w.phase>=2&&w.endRate>0.75000001))
  return RULES.FRONT_LATE;
 return baseRule;
}
function infer(profile){
 if(!isObj(profile)||profile.status!=='source-structure')
  return unresolved('unavailable','no-matched-condition-source');
 if(!Array.isArray(profile.invokes)||!profile.invokes.length)
  return unresolved('unavailable','no-activation-invoke');
 const sourceNumericId=profile.sourceNumericId||null;
 const parsed=rankTiming.analyze({id:sourceNumericId,name:'',
  invokes:profile.invokes});
 const explicitTag=Array.isArray(profile.angleTags)&&
  profile.angleTags.some(x=>Array.isArray(x?.dimensions?.style)&&x.dimensions.style.length);
 if(parsed.hasExplicitStyleConstraint||explicitTag)
  return unresolved('explicit-only','source-has-explicit-style-condition',
   {sourceNumericId,hasExplicitStyleConstraint:parsed.hasExplicitStyleConstraint,
    hasExplicitStyleTag:!!explicitTag,
    note:'明示脚質条件を優先。位置条件由来の推定を専用指定に格上げしない'});
 if(!parsed.pairs.length)
  return unresolved('not-inferable','no-rank-timing-in-source',
   {sourceNumericId,ruleVersion:RULE_VERSION,branches:[]});
 const branches=[];
 for(const [invokeOffset,invoke] of profile.invokes.entries()){
  if(!isObj(invoke)||!Array.isArray(invoke.conditions))
   throw Error('Invalid activation invoke at '+invokeOffset);
  for(const [orIndex,row] of invoke.conditions.entries()){
   if(!Array.isArray(row))throw Error('Invalid condition branch');
   const evidence=parsed.pairs.find(p=>p.invokeOffset===invokeOffset&&p.orIndex===orIndex);
   const ref={invokeOffset,invokeIndex:invoke.index??invokeOffset,orIndex,
    sourceConditions:row.map(c=>({type:c.type,operator:c.operator,value:c.value}))};
   if(!evidence){
    branches.push({status:'not-inferable',reason:'no-rank-and-timing-pair',...ref});
    continue;
   }
   // Alternative OR paths are not intrinsically disqualifying. We only
   // combine them after ALL paths independently yield the same direction.
   const blockers=evidence.reviewReasons.filter(x=>x!=='or-alternative-exists');
   if(evidence.timing.some(t=>t.courseDependent))
    blockers.push('course-shape-dependent-timing');
   if(blockers.length){
    branches.push({status:'needs-review',reasons:blockers,...ref});
    continue;
   }
   const baseRule=direction(evidence.rank);
   const rule=baseRule&&contextualRule(baseRule,evidence.timing);
   if(!rule){
    branches.push({status:'needs-review',reasons:['rank-band-overlaps-or-ambiguous'],
     rank:evidence.rank,...ref});
    continue;
   }
   branches.push({status:'inferred-branch',basisRuleId:rule.id,
    band:rule.band,styles:[...rule.styles],styleNames:[...rule.styleNames],
    primaryStyles:[...rule.primaryStyles],additionalStyles:[...rule.additionalStyles],
    label:rule.label,rank:evidence.rank,timing:evidence.timing,...ref});
  }
  if(invoke.conditions.length===0)
   branches.push({status:'not-inferable',reason:'no-activation-condition-row',
    invokeOffset,invokeIndex:invoke.index??invokeOffset,orIndex:null});
 }
 const common={sourceNumericId,ruleVersion:RULE_VERSION,branches,
  scope:'activation-condition-likelihood-only'};
 if(profile.invokes.length!==1)
  return unresolved('needs-review','multiple-invokes-not-merged',common);
 if(!branches.length)
  return unresolved('not-inferable','no-rank-timing-branches',common);
 if(branches.some(b=>b.status!=='inferred-branch'))
  return unresolved('needs-review','not-all-or-branches-inferable',common);
 const ids=[...new Set(branches.map(b=>b.basisRuleId))];
 if(ids.length!==1)
  return unresolved('needs-review','different-or-branch-style-tendencies',common);
 const rule=Object.values(RULES).find(r=>r.id===ids[0]);
 return {status:'inferred',inferred:true,kind:'inferred-not-explicit',
  confidence:'qualitative-not-probabilistic',
  sourceNumericId,ruleVersion:RULE_VERSION,scope:common.scope,
  styles:[...rule.styles],styleNames:[...rule.styleNames],label:rule.label,
  primaryStyles:[...rule.primaryStyles],additionalStyles:[...rule.additionalStyles],
  basisRuleIds:ids,branches,
  note:rule===RULES.FRONT_LATE?
   '終盤前半の後半にもランダム発動の機会があるため差し・追込も適性対象。四脚質が等確率という意味ではない':
   'レースの一般的な位置取りに基づく傾向。厳格な作戦指定・発動確率ではない'};
}
function attach(model){
 if(!isObj(model)||!Array.isArray(model.skills)||!isObj(model.skillById))
  throw Error('Invalid skill style tendency model');
 const rows=[];
 const counts={total:model.skills.length,inferred:0,front:0,back:0,broadLateFront:0,
  explicitOnly:0,needsReview:0,notInferable:0,unavailable:0};
 for(const skill of model.skills){
  if(!isObj(skill)||typeof skill.id!=='string'||!isObj(model.skillById[skill.id]))
   throw Error('Invalid skill identity in model');
  const value=infer(skill.activationProfile);
  rows.push({skill,value});
  if(value.status==='inferred'){
   counts.inferred++;
   if(value.basisRuleIds[0]===RULES.FRONT.id)counts.front++;
   else if(value.basisRuleIds[0]===RULES.BACK.id)counts.back++;
   else if(value.basisRuleIds[0]===RULES.FRONT_LATE.id)counts.broadLateFront++;
   else throw Error('Unexpected P2 inferred rule');
  }else if(value.status==='explicit-only')counts.explicitOnly++;
  else if(value.status==='needs-review')counts.needsReview++;
  else if(value.status==='not-inferable')counts.notInferable++;
  else counts.unavailable++;
 }
 if(counts.inferred!==counts.front+counts.back+counts.broadLateFront)
  throw Error('P2 inferred style group count mismatch');
 if(counts.total!==counts.inferred+counts.explicitOnly+
     counts.needsReview+counts.notInferable+counts.unavailable)
  throw Error('Style inference coverage mismatch');
 // No partial mutations even if a record fails late.
 for(const {skill,value} of rows)skill.activationTendency=value;
 model.meta??={};
 model.meta.skillStyleTendencies={...counts,ruleVersion:RULE_VERSION,
  scope:'qualitative-rank-and-timing-only',eventAndHintDataChanged:false};
 return model.meta.skillStyleTendencies;
}
const api={infer,attach,direction,contextualRule,RULES,RULE_VERSION};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.UmaSkillStyleTendency=api;
})(typeof globalThis!=='undefined'?globalThis:this);
