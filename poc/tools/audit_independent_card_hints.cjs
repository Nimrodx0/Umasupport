'use strict';
// One-off audit of names resolved through numeric skill IDs, without
// redistributing external card/skill records or upgrading an audit to game truth.
const crypto=require('node:crypto');
const {parseSupportCards}=require('../src/live_loader.js');
const {parseSource}=require('../src/skill_bridge.js');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();

function auditCards(simCards,skills,external,independentSkills=[]){
 if(!Array.isArray(external)||!external.length)throw Error('Independent card data is empty');
 const independentlyNamed=new Map();
 for(const entry of independentSkills){
  if(!Number.isSafeInteger(entry.id)||typeof entry.name!=='string'||!norm(entry.name)||
    independentlyNamed.has(entry.id))throw Error('Invalid/duplicate independent skill dictionary ID');
  independentlyNamed.set(entry.id,norm(entry.name));
 }
 const used=new Set(),groups={exact4:0,exact0:0,both:0,neither:0};
 const rows=[],missingPrimaryIds=new Set(),unresolvedIdsAll=new Set(),conflictingSkillIds=new Set();
 for(const card of external){
  if(!Number.isSafeInteger(card.id)||used.has(card.id))throw Error('Invalid/duplicate independent card ID');
  used.add(card.id);
  const sim=simCards.get(String(card.id));
  if(!sim){rows.push({id:card.id,status:'card_absent'});continue;}
  if(card.name!==sim.name||card.rarity!==sim.rarity)
   throw Error('Previously verified card identity changed at '+card.id);
  if(!Array.isArray(card.hintSkillIds)||!card.hintSkillIds.every(Number.isSafeInteger))
   throw Error('Missing numeric hint IDs at card '+card.id);
  const idSet=new Set(card.hintSkillIds);
  if(idSet.size!==card.hintSkillIds.length)throw Error('Duplicate independent hint IDs at card '+card.id);
  const mapped=[],missingPrimary=[],unresolved=[],conflicts=[];
  for(const id of card.hintSkillIds){
   const primary=skills.byId.get(String(id)),secondary=independentlyNamed.get(id);
   if(!primary){missingPrimaryIds.add(id);missingPrimary.push(id);}
   if(primary&&secondary&&norm(primary.name)!==secondary){
    conflictingSkillIds.add(id);conflicts.push(id);
   }
   const name=primary?norm(primary.name):secondary;
   if(name)mapped.push(name);
   else{unresolvedIdsAll.add(id);unresolved.push(id);}
  }
  const externalNames=new Set(mapped),stage4=new Set(sim.stages['4'].map(norm)),stage0=new Set(sim.stages['0'].map(norm));
  const only4=[...stage4].filter(n=>!externalNames.has(n));
  const only0=[...stage0].filter(n=>!externalNames.has(n));
  const onlyOther=[...externalNames].filter(n=>!stage4.has(n));
  const duplicateNames=mapped.length-externalNames.size;
  const exact4=only4.length===0&&onlyOther.length===0&&unresolved.length===0&&
    conflicts.length===0&&duplicateNames===0;
  const exact0=only0.length===0&&[...externalNames].every(n=>stage0.has(n))&&
    unresolved.length===0&&conflicts.length===0&&duplicateNames===0;
  if(exact4&&exact0)groups.both++;
  else if(exact4)groups.exact4++;
  else if(exact0)groups.exact0++;
  else groups.neither++;
  rows.push({id:card.id,stage0Hints:stage0.size,stage4Hints:stage4.size,externalHintIds:idSet.size,
   mappedSkillNames:mapped.length,missingPrimary,unresolved,conflicts,
   onlyUmaSimStage4:only4.length,onlyIndependent:onlyOther.length,duplicateNames,
   unresolvedCounterpartNames:unresolved.length?only4.slice(0,5):[],exact4,exact0});
 }
 const compared=rows.filter(x=>x.status!=='card_absent');
 const total=compared.reduce((a,x)=>a+x.externalHintIds,0);
 return {externalCards:external.length,compared:compared.length,
  missingCardIds:rows.filter(x=>x.status==='card_absent').map(x=>x.id),
  classification:groups,
  missingPrimarySkillIds:[...missingPrimaryIds].sort((a,b)=>a-b),
  unresolvedInBothSkillDictionaries:[...unresolvedIdsAll].sort((a,b)=>a-b),
  numericNameConflictIds:[...conflictingSkillIds].sort((a,b)=>a-b),
  totalIndependentHintLinks:total,
  resolvedByPrimaryDictionary:total-compared.reduce((a,x)=>a+x.missingPrimary.length,0),
  recoveredByIndependentDictionary:compared.reduce((a,x)=>a+x.missingPrimary.length-x.unresolved.length,0),
  stage4ExactCards:groups.exact4+groups.both,
  mismatches:compared.filter(x=>!x.exact4).map(x=>({id:x.id,stage4Hints:x.stage4Hints,
   externalHintIds:x.externalHintIds,missingPrimary:x.missingPrimary,
   unresolved:x.unresolved,conflicts:x.conflicts,
   onlyUmaSimStage4:x.onlyUmaSimStage4,onlyIndependent:x.onlyIndependent,
   duplicateNames:x.duplicateNames,unresolvedCounterpartNames:x.unresolvedCounterpartNames}))};
}
function sortSchemaProbe(skills){
 if(!Array.isArray(skills)||!skills.length)throw Error('Cannot inspect empty external skills array');
 const attrs=new Map();
 for(const row of skills){
  if(!row||typeof row!=='object')continue;
  for(const [k,v] of Object.entries(row)){
   const data=attrs.get(k)||{count:0,types:{}};
   data.count++;const type=Array.isArray(v)?'array':v===null?'null':typeof v;
   data.types[type]=(data.types[type]||0)+1;attrs.set(k,data);
  }
 }
 const keys=[...attrs].map(([key,value])=>({key,...value})).sort((a,b)=>a.key.localeCompare(b.key));
 const possibleOrder=keys.filter(x=>/order|sort|disp|priority|rank|index/i.test(x.key));
 return {records:skills.length,keys,possibleOrder};
}
async function load(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'Umasupport-one-off-hint-audit/1.0'}});
  if(!r.ok)throw Error(url+' HTTP '+r.status);
  return await r.text();
 }finally{clearTimeout(timer)}
}
async function main(){
 const revisions={umasim:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
  japanese:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535'};
 const [support,skill,externalCard,externalSkills]=await Promise.all([
  load('https://raw.githubusercontent.com/mee1080/umasim/'+revisions.umasim+'/data/support_card.txt'),
  load('https://raw.githubusercontent.com/mee1080/umasim/'+revisions.umasim+'/data/skill_data.txt'),
  load('https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/'+revisions.japanese+'/data/supports.json'),
  load('https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/'+revisions.japanese+'/data/skills.json')
 ]);
 const sim=parseSupportCards(support),dictionary=parseSource(skill);
 const cards=JSON.parse(externalCard),skills=JSON.parse(externalSkills);
 const comparison=auditCards(sim.cards,dictionary,cards,skills);
 const ordering=sortSchemaProbe(skills);
 const missingPrimarySkillDetails=comparison.missingPrimarySkillIds.map(id=>{
  const v=skills.find(x=>x.id===id);
  return {id,independentName:v?.name??null,independentRarity:v?.rarity??null,
   independentGroupId:v?.groupId??null};
 });
 console.log(JSON.stringify({revisions,sha256:{support:sha256(support),skills:sha256(skill),
  externalCards:sha256(externalCard),externalSkills:sha256(externalSkills)},
  sourceCounts:{umasimCards:sim.cards.size,skillDictionary:dictionary.count},
  comparison,missingPrimarySkillDetails,ordering,interpretation:{
   hintLevel:'independent_Japanese_subset_only_not_all_cards',
   possibleOrder:'JSON key inspection only, not game-UI sort evidence'
  }},null,2));
}
if(require.main===module)main().catch(e=>{console.error('Card hint/sort audit failed:',e);process.exitCode=1});
module.exports={auditCards,sortSchemaProbe};
