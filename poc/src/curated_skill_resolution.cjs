/* Editor-only resolver: match every draft skill to the complete UmaSim numeric
 * registry, NOT to the support-card normal-hint subset.
 * "unresolvedRewards" is a draft-only evidence placeholder and is never published.
 */
'use strict';
const bridge=require('./skill_bridge.js');
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const clean=v=>String(v).normalize('NFKC').replace(/[\u25ef\u3007]/g,'\u25cb').replace(/\s+/g,' ').trim();
const fail=msg=>{throw Error('独自イベントのスキル照合: '+msg);};
function indexSkills(skillText,supplemental={schemaVersion:1,skills:[]}){
 if(!obj(supplemental)||supplemental.schemaVersion!==1||!Array.isArray(supplemental.skills))
  fail('補完スキル辞書の構造・版が不正');
 const source=bridge.parseSource(skillText);
 const names=new Map();
 const supplementalRecords=[];
 const used=new Set();
 for(const record of source.byId.values()){
  if(!['normal','rare'].includes(record.rarity))continue;
  const key=clean(record.name),list=names.get(key)||[];
  list.push(record);names.set(key,list);
 }
 for(const candidate of supplemental.skills){
  if(!obj(candidate)||typeof candidate.id!=='string'||!/^[1-9][0-9]*$/.test(candidate.id)||
   !Number.isSafeInteger(Number(candidate.id))||typeof candidate.name!=='string'||
   !clean(candidate.name)||candidate.rarity!=='normal'&&candidate.rarity!=='rare'||
   candidate.scope!=='curation-only'||!/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(candidate.checkedAt)||
   !obj(candidate.evidence)||
   candidate.evidence.numericId!=='https://umamusu.wiki/Game:Skills/'+candidate.id||
   !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/[1-9][0-9]+$/.test(candidate.evidence.nameAndEffect)||
   Object.keys(candidate).some(k=>!['id','name','rarity','checkedAt','scope','evidence'].includes(k))||
   Object.keys(candidate.evidence).some(k=>!['numericId','nameAndEffect'].includes(k))||
   used.has(candidate.id))fail('根拠不十分・重複・形式不正の補完スキル');
  used.add(candidate.id);
  const sourceRecord=source.byId.get(candidate.id);
  if(sourceRecord){
   if(clean(sourceRecord.name)!==clean(candidate.name)||sourceRecord.rarity!==candidate.rarity)
    fail('元辞書のIDと補完辞書が矛盾: '+candidate.id);
   continue; // upstream added the same ID/name; no duplicate insertion
  }
  const sameName=names.get(clean(candidate.name))||[];
  if(sameName.length)fail('元辞書内の異なるIDと補完名称が衝突: '+candidate.name);
  const record={id:candidate.id,name:candidate.name,rarity:candidate.rarity,
   group:-Number(candidate.id),origin:'supplemental'};
  // The negative group is INTERNAL and must never be interpreted as a real
  // game's skill hierarchy relationship.
  names.set(clean(candidate.name),[record]);
  supplementalRecords.push(record);
 }
 return {source,names,supplementalRecords,
  mergedSkillText:JSON.stringify([...source.byId.values(),...supplementalRecords])};
}
function match(name,names){
 const arr=names.get(clean(name))||[];
 if(arr.length===1)return {status:'matched',record:arr[0]};
 if(arr.length>1)return {status:'ambiguous',ids:arr.map(x=>x.id)};
 return {status:'missing'};
}
function prepareDraft(catalog,skillText,{supplemental}={}){
 if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail('草稿カタログの形式が不正');
 const {source,names,mergedSkillText,supplementalRecords}=indexSkills(skillText,supplemental);
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
   const convertedRewards=[];
   for(const r of part.rewards){
    if(!obj(r)||typeof r.skillId!=='string')fail(context+': スキル報酬が不正');
    if(!r.skillId.startsWith('hint:')){convertedRewards.push(r);continue;}
    const name=r.skillId.slice(5);
    if(!name||!Number.isInteger(r.level)||r.level<1)fail(context+': ヒントLvが不正');
    const result=match(name,names);
    if(result.status!=='matched'){
     // Preserve original named entry in the source draft, but never silently
     // treat it as an identified skill in the ephemeral validator model.
     pending.push({location:context,skillName:name,level:r.level,
      reason:result.status,inputKind:'legacy-hint-name',
      ...result.status==='ambiguous'?{candidateIds:result.ids}:{}});
     continue;
    }
    mappedRegular.count++;
    convertedRewards.push(numeric(result.record,r));
   }
   part.rewards=convertedRewards;
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
     resolvedNames.push({location:context,skillName:r.skillName,skillId:result.record.id,
      source:result.record.origin==='supplemental'?'supplemental':'umasim'});
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
  mergedSkillText,supplementalAdded:supplementalRecords.length,
  matchedHintRewards:mappedRegular.count,
  // This transformed result is for checking only. A publisher must use the
  // original draft and must reject ANY unresolvedRewards before release.
  releaseEligible:false};
}
module.exports={clean,indexSkills,match,prepareDraft};
