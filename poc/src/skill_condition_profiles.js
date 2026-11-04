/* P1: read-only, source-provenanced classification of explicit predicates.
 * Never equate publisher <...> tokens with a parsed simulator restriction,
 * collapse OR/AND, infer race-style suitability, or affect reward calculations. */
(function(g){
'use strict';
const bridge=typeof module!=='undefined'&&module.exports
 ?require('./skill_bridge.js'):g.UmaSkillBridge;
const angle=typeof module!=='undefined'&&module.exports
 ?require('./skill_condition_tags.js'):g.UmaSkillConditionTags;
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const OPS=new Set(['==','!=','>=','<=','>','<']);
const VALUE_LABELS=Object.freeze({
 running_style:{axis:'style',values:{1:'逃げ',2:'先行',3:'差し',4:'追込'}},
 distance_type:{axis:'distance',values:{1:'短距離',2:'マイル',3:'中距離',4:'長距離'}},
 ground_type:{axis:'surface',values:{1:'芝',2:'ダート'}},
 ground_condition:{axis:'trackCondition',values:{1:'良',2:'稍重',3:'重',4:'不良'}}
});
const numId=skill=>String(skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1]||'');
function parse(text){
 if(typeof text!=='string')return null;
 const normalized=bridge.parseSource(text);
 const records=JSON.parse(text.replace(/^\uFEFF/,''));
 return {index:normalized,byId:new Map(records.map(r=>[r.id,r]))};
}
function sourceFor(skill,current,pinned){
 const name=normalize(skill.name);
 const num=numId(skill);
 if(num){
  const old=pinned?.index.byId.get(num),live=current?.index.byId.get(num);
  if(old?.name===name&&(!live||live.name!==name))
   return {record:pinned.byId.get(num),source:'pinned'};
  if(live?.name===name)return {record:current.byId.get(num),source:'current'};
  if(old?.name===name)return {record:pinned.byId.get(num),source:'pinned'};
  return null;
 }
 if(skill.id.startsWith('hint:')){
  const matches=current?.index.byName.get(name);
  if(matches?.length===1)
   return {record:current.byId.get(matches[0].id),source:'current'};
 }
 return null;
}
function matrix(raw,label){
 if(raw===undefined)raw=[];
 if(!Array.isArray(raw))throw Error('Invalid '+label+' OR matrix');
 return raw.map((andTerms,orIndex)=>{
  if(!Array.isArray(andTerms))throw Error('Invalid '+label+' AND row '+orIndex);
  return andTerms.map((c,andIndex)=>{
   if(!isObj(c)||typeof c.type!=='string'||!c.type||!OPS.has(c.operator)||
      !Number.isSafeInteger(c.value))
    throw Error('Invalid '+label+' predicate at '+orIndex+'/'+andIndex);
   const spec=VALUE_LABELS[c.type]||null;
   return {type:c.type,operator:c.operator,value:c.value,
    ...(spec?{axis:spec.axis,valueLabel:spec.values[c.value]||null}:{})};
  });
 });
}
function project(record,source){
 if(!record||typeof record.id!=='string')throw Error('Invalid matched source skill');
 if(!Array.isArray(record.invokes))
  return {status:'no-activation-record',source,sourceNumericId:record.id,
   angleTags:angle.recognized(record.info),invokes:[]};
 const invokes=record.invokes.map((invoke,n)=>{
  if(!isObj(invoke))throw Error('Invalid invoke '+record.id+'/'+n);
  const effects=invoke.effects===undefined?[]:invoke.effects;
  if(!Array.isArray(effects))throw Error('Invalid invoke effects '+record.id+'/'+n);
  const effectTypes=[];
  for(const e of effects){
   if(!isObj(e)||typeof e.type!=='string'||!e.type)
    throw Error('Invalid effect type '+record.id+'/'+n);
   if(!effectTypes.includes(e.type))effectTypes.push(e.type);
  }
  const preConditions=matrix(invoke.preConditions,'preConditions');
  const conditions=matrix(invoke.conditions,'conditions');
  return {index:Number.isSafeInteger(invoke.index)?invoke.index:n,
   preConditions,conditions,effectTypes};
 });
 if(!invokes.length)return {status:'no-activation-record',source,
  sourceNumericId:record.id,angleTags:angle.recognized(record.info),invokes:[]};
 return {status:'source-structure',source,sourceNumericId:record.id,
  angleTags:angle.recognized(record.info),invokes};
}
function attach(model,{skillText=null,pinnedSkillText=null}={}){
 if(!model||!Array.isArray(model.skills)||!isObj(model.skillById))
  throw Error('Invalid activation analysis model');
 const current=parse(skillText),pinned=parse(pinnedSkillText);
 const staged=[],counts={total:model.skills.length,matched:0,unavailable:0,
  noActivationRecord:0,pinned:0,current:0,explicitPredicates:0};
 for(const skill of model.skills){
  if(!skill||typeof skill.id!=='string'||!isObj(model.skillById[skill.id]))
   throw Error('Invalid activation analysis skill identity');
  const picked=sourceFor(skill,current,pinned);
  let profile;
  if(!picked)profile={status:'unavailable',reason:'skill-dictionary-id-name-unmatched',
   angleTags:[],invokes:[]};
  else profile=project(picked.record,picked.source);
  if(profile.status==='source-structure'){
   counts.matched++;
   counts[picked.source]++;
   for(const invoke of profile.invokes){
    for(const side of ['preConditions','conditions'])for(const group of invoke[side])
     for(const predicate of group)if(predicate.axis)counts.explicitPredicates++;
   }
  }else if(profile.status==='no-activation-record')counts.noActivationRecord++;
  else counts.unavailable++;
  staged.push({skill,profile});
 }
 // Atomic update only after all matched sources and ASTs pass validation.
 for(const {skill,profile} of staged)skill.activationProfile=profile;
 const report={...counts,scope:'source-condition-structure-only',
  inference:'not-calculated'};
 model.meta??={};
 model.meta.skillConditionProfiles=report;
 return report;
}
const api={attach,project,sourceFor,VALUE_LABELS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillConditionProfiles=api;
})(typeof globalThis!=='undefined'?globalThis:this);
