/*
 * Read-only skill name to UmaSim numeric ID candidate audit.
 * Strict Unicode NFKC equality only. Never asserts official game ID,
 * publication consent, acquisition route, rarity hierarchy or reward success.
 */
'use strict';
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function parseSkillData(json){
  if(typeof json!=='string')throw Error('UmaSim skill_data.txt must be JSON text');
  let list;
  try {list=JSON.parse(json.replace(/^\uFEFF/,''));}
  catch(e){throw Error('Invalid UmaSim skill JSON: '+e.message)}
  if(!Array.isArray(list)||list.length<100)throw Error('UmaSim skills dataset is suspiciously short');
  const ids=new Set(),byName=new Map();
  for(const [i,item] of list.entries()){
    if(!obj(item)||!/^\d+$/.test(String(item.id))||typeof item.id!=='string'||!norm(item.name)||
       !Number.isSafeInteger(item.group)||!['normal','rare','unique','evo','scenario'].includes(item.rarity))
      throw Error('Invalid skill item at index '+i);
    if(ids.has(item.id))throw Error('Duplicate UmaSim numeric skill id: '+item.id);
    ids.add(item.id);
    const name=norm(item.name),entry={id:item.id,name,rarity:item.rarity,group:item.group};
    const found=byName.get(name)||[];found.push(entry);byName.set(name,found);
  }
  return {byName,totalSkillRecords:list.length};
}
function audit(facts,skillRecords){
 if(!obj(facts)||facts.kind!=='review-candidates-only'||!Array.isArray(facts.cards)||
    !skillRecords?.byName||!(skillRecords.byName instanceof Map))
   throw Error('Invalid audit inputs');
 const input=new Map();
 for(const card of facts.cards){
   if(!obj(card)||typeof card.cardId!=='string'||!Array.isArray(card.chain)||!Array.isArray(card.random))
      throw Error('Malformed fact card');
   for(const item of [...card.chain,...card.random]){
     if(!Array.isArray(item.hints))throw Error('Malformed hint array');
     for(const hint of item.hints){
       if(!obj(hint)||typeof hint.skillName!=='string'||!Number.isInteger(hint.hintLevel))throw Error('Malformed skill hint');
       const name=norm(hint.skillName);
       if(!name)throw Error('Empty skill name');
       const entry=input.get(name)||{name,occurrences:0,fromCards:new Set(),placement:'event-option-or-auto'};
       entry.occurrences++;entry.fromCards.add(card.cardId);input.set(name,entry);
     }
   }
   for(const nameOriginal of card.cardLevelSkillCandidates||[]){
     if(typeof nameOriginal!=='string'||!norm(nameOriginal))throw Error('Malformed card-level name');
     const name=norm(nameOriginal);
     const entry=input.get(name)||{name,occurrences:0,fromCards:new Set(),placement:'card-level-only'};
     entry.fromCards.add(card.cardId);
     if(entry.placement!=='event-option-or-auto')entry.placement='card-level-only';
     input.set(name,entry);
   }
 }
 const rows=[];
 for(const val of input.values()){
   const candidates=skillRecords.byName.get(val.name)||[];
   const eligible=candidates.filter(x=>x.rarity==='normal'||x.rarity==='rare');
   const status=eligible.length===1&&candidates.length===1?'unique':
     candidates.length===0?'not-in-source':'ambiguous';
   rows.push({name:val.name,status,occurrences:val.occurrences,
     fromCards:[...val.fromCards].sort(),placement:val.placement,
     candidates:candidates.map(x=>({id:x.id,rarity:x.rarity,group:x.group}))});
 }
 rows.sort((a,b)=>a.name.localeCompare(b.name,'ja'));
 return {source:'UmaSim data/skill_data.txt',status:'RESEARCH_CANDIDATES_NOT_PUBLISHABLE',totalSkillRecords:skillRecords.totalSkillRecords,
  uniqueNameCount:rows.length,uniqueMatches:rows.filter(x=>x.status==='unique').length,
  missingNames:rows.filter(x=>x.status==='not-in-source').length,
  ambiguousNames:rows.filter(x=>x.status==='ambiguous').length,
  hintOccurrences:rows.reduce((s,x)=>s+x.occurrences,0),rows,
  warning:'Numeric IDs, rarity and group are UmaSim data-derived candidates. Do not automatically treat them as verified official game IDs or confirmed source-event rewards.'};
}
module.exports={parseSkillData,audit};
