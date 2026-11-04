/* Runtime-only display enrichment from UmaSim's validated skill_data.txt info.
 * No game master or skill description is bundled with the public application. */
(function(g){
'use strict';
const bridge=typeof module!=='undefined'&&module.exports
 ?require('./skill_bridge.js'):g.UmaSkillBridge;
const normalize=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function attach(model,{skillText=null,pinnedSkillText=null}={}){
 if(!model||!model.skillById||!Array.isArray(model.skills))
  throw Error('スキル効果表示用のモデルが不正');
 const current=typeof skillText==='string'?bridge.parseSource(skillText):null;
 const pinned=typeof pinnedSkillText==='string'?bridge.parseSource(pinnedSkillText):null;
 const changes=[];
 let currentCount=0,pinnedCount=0;
 for(const skill of model.skills){
  if(!skill||typeof skill.id!=='string')continue;
  const name=normalize(skill.name);
  const numeric=String(skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1]||'');
  let record=null,source=null;
  if(numeric){
   const live=current?.byId.get(numeric),old=pinned?.byId.get(numeric);
   // A fixed historical ID wins when the moving live dictionary renamed it.
   if(old?.name===name&&(!live||live.name!==name)){record=old;source='pinned';}
   else if(live?.name===name){record=live;source='current';}
   else if(old?.name===name){record=old;source='pinned';}
  }else if(skill.id.startsWith('hint:')){
   const list=current?.byName.get(name);
   // Name-only hint IDs are safe only with a unique source match.
   if(list?.length===1){record=list[0];source='current';}
  }
  if(!record?.description)continue;
  changes.push({skill,description:record.description,
   technicalDetails:record.technicalDetails||null,
   technicalDetailLines:Array.isArray(record.technicalDetailLines)
    ?[...record.technicalDetailLines]:[],source});
 }
 // Atomically apply after every source file has passed parseSource validation.
 for(const c of changes){
  c.skill.effectDescription=c.description;
  c.skill.effectTechnicalDetails=c.technicalDetails;
  c.skill.effectTechnicalDetailLines=c.technicalDetailLines;
  c.skill.effectSource=c.source;
  if(c.source==='current')currentCount++;else pinnedCount++;
 }
 return {enriched:changes.length,current:currentCount,pinned:pinnedCount,
  total:model.skills.length,missing:model.skills.length-changes.length};
}
const api={attach};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillEffects=api;
})(typeof globalThis!=='undefined'?globalThis:this);
