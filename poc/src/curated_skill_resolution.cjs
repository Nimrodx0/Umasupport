/* Editor-only resolver: match every draft skill to the complete UmaSim numeric
 * registry, NOT to the support-card normal-hint subset.
 * "unresolvedRewards" is a draft-only evidence placeholder and is never published.
 */
'use strict';
const bridge=require('./skill_bridge.js');
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const clean=v=>String(v).normalize('NFKC').replace(/[\u25ef\u3007]/g,'\u25cb').replace(/\s+/g,' ').trim();
const fail=msg=>{throw Error('独自イベントのスキル照合: '+msg);};
function indexSkills(skillText){
 const source=bridge.parseSource(skillText);
 const names=new Map();
 for(const record of source.byId.values()){
  if(!['normal','rare'].includes(record.rarity))continue;
  const key=clean(record.name),list=names.get(key)||[];
  list.push(record);names.set(key,list);
 }
 return {source,names};
}
function match(name,names){
 const arr=names.get(clean(name))||[];
 if(arr.length===1)return {status:'matched',record:arr[0]};
 if(arr.length>1)return {status:'ambiguous',ids:arr.map(x=>x.id)};
 return {status:'missing'};
}
function prepareDraft(catalog,skillText){
 if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail('草稿カタログの形式が不正');
 const {source,names}=indexSkills(skillText);
 const converted=JSON.parse(JSON.stringify(catalog));
 const pending=[],resolvedNames=[],mappedRegular= {count:0};
 const numeric=(record,reward)=>({skillId:'skill:'+record.id,
  verifiedSkillName:record.name,level:reward.level,
  ...(reward.condition?{condition:reward.condition}:{})});
 function walk(part,context){
  if(!obj(part))fail(context+': 報酬階層が不正');
  if(part.outcomes!==undefined&&part.unresolvedRewards!==undefined)
   fail(context+': 結果別の未照合報酬はoutcomes各結果に記録する');
  if(part.rewards!==undefined){
   if(!Array.isArray(part.rewards))fail(context+': rewards配列が不正');
   part.rewards=part.rewards.map(r=>{
    if(!obj(r)||typeof r.skillId!=='string')fail(context+': スキル報酬が不正');
    if(!r.skillId.startsWith('hint:'))return r;
    const name=r.skillId.slice(5);
    if(!name||!Number.isInteger(r.level)||r.level<1)fail(context+': ヒントLvが不正');
    const result=match(name,names);
    if(result.status!=='matched')
     fail(context+': '+name+'が全スキル辞書で'+
      (result.status==='ambiguous'?'複数IDに該当':'見つからない')+
      '。出典のスキル名とLvをunresolvedRewardsに保存する');
    mappedRegular.count++;
    return numeric(result.record,r);
   });
  }
  if(part.unresolvedRewards!==undefined){
   if(!Array.isArray(part.unresolvedRewards)||!part.unresolvedRewards.length)
    fail(context+': 未照合報酬は空配列にできません');
   const seen=new Set(part.rewards?.map(r=>r.skillId)||[]);
   for(const r of part.unresolvedRewards){
    if(!obj(r)||typeof r.skillName!=='string'||!clean(r.skillName)||
       r.skillName.length>140||!Number.isSafeInteger(r.level)||r.level<1||r.level>10||
       Object.keys(r).some(k=>!['skillName','level','condition'].includes(k))||
       (r.condition!==undefined&&(typeof r.condition!=='string'||!r.condition.trim())))
      fail(context+': 未照合スキルはskillName,level,任意conditionだけ');
    const result=match(r.skillName,names);
    if(result.status==='matched'){
     const reward=numeric(result.record,r);
     if(seen.has(reward.skillId))fail(context+': 既存報酬との重複');
     seen.add(reward.skillId);
     (part.rewards??=[]).push(reward);
     resolvedNames.push({location:context,skillName:r.skillName,skillId:result.record.id});
    }else{
     pending.push({location:context,skillName:r.skillName,level:r.level,
      reason:result.status,...result.status==='ambiguous'?{candidateIds:result.ids}:{}});
    }
   }
   delete part.unresolvedRewards;
  }
  if(part.outcomes!==undefined){
   if(!Array.isArray(part.outcomes))fail(context+': outcomes配列が不正');
   for(const outcome of part.outcomes){
    if(!obj(outcome)||typeof outcome.id!=='string')fail(context+': 結果ID不正');
    walk(outcome,context+'/outcome:'+outcome.id);
   }
  }
 }
 for(const card of converted.cards){
  if(!obj(card)||!Array.isArray(card.events))fail('カード形式不正');
  for(const ev of card.events){
   const ctx=card.cardId+'/'+ev.id;
   walk(ev,ctx);
   if(ev.choices!==undefined){
    if(!Array.isArray(ev.choices))fail(ctx+': choices配列不正');
    for(const c of ev.choices){
     if(!obj(c)||typeof c.id!=='string')fail(ctx+': choice形式不正');
     walk(c,ctx+'/choice:'+c.id);
    }
   }
  }
 }
 return {catalog:converted,registryCount:source.count,pending,resolvedNames,
  matchedHintRewards:mappedRegular.count,
  // This transformed result is for checking only. A publisher must use the
  // original draft and must reject ANY unresolvedRewards before release.
  releaseEligible:false};
}
module.exports={clean,indexSkills,match,prepareDraft};
