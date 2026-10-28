'use strict';
/*
 * Direct-site skill-hint ID crosswalk, using only an official page's rendered
 * label text and an independently pinned UmaSim registry. Do not use the old
 * GameTora mirror to assign an unknown number.
 * Nothing with raw skill names is returned or persisted.
 */
const bridge=require('./skill_bridge.js');
const normalize=x=>String(x??'').normalize('NFKC')
 .replace(/\s+/g,' ').trim();
const failure=x=>{throw Error('公式GameToraからのスキルID候補: '+x);};
const numeric=x=>typeof x==='string'&&/^\d+$/.test(x);
function registryFromSkillText(text){
 const parsed=bridge.parseSource(text);
 return parsed;
}
function matchContextToId(context,registry){
 if(typeof context!=='string'||context.length>1000||
    !(registry?.byName instanceof Map))failure('元のスキル辞書・文字列が不正');
 if(!/ヒント|hint/i.test(context))return {status:'not-a-hint'};
 const input=normalize(context);
 const matches=[];
 for(const [name,records] of registry.byName.entries()){
  // Preserve duplicate IDs under the same official skill name.
  if(input.includes(normalize(name)))matches.push({name,records});
 }
 if(!matches.length)return {status:'name-not-found'};
 // Avoid any false resolution when the text contains more than one different
 // skill name: a full branch can display multiple separate reward items.
 const maxlen=Math.max(...matches.map(x=>normalize(x.name).length));
 const maximal=matches.filter(x=>normalize(x.name).length===maxlen);
 const chosen=maximal.length===1?maximal[0]:null;
 if(!chosen||chosen.records.length!==1)
  return {status:'ambiguous-name-or-id',possibleNames:matches.length,
   possibleNumericIds:matches.reduce((n,x)=>n+x.records.length,0)};
 // A maximal name is still potentially a substring of an unrelated phrase.
 // Demand quotation delimiters or a bounded hint-label context, and never
 // accept multiple unrelated skill name hits.
 if(matches.some(x=>x!==chosen&&!normalize(chosen.name).includes(normalize(x.name))))
  return {status:'ambiguous-name-or-id',possibleNames:matches.length,
   possibleNumericIds:matches.reduce((n,x)=>n+x.records.length,0)};
 const index=input.indexOf(normalize(chosen.name));
 const start=input.slice(0,index),end=input.slice(index+normalize(chosen.name).length);
 const quotedLeft=/(?:[『「【\["]|<)\s*$/.test(start);
 const quotedRight=/^\s*(?:[』」】\]"]|>)/.test(end);
 const closeToHint=(/ヒント|hint/i.test(end.slice(0,45))||
  /ヒント|hint/i.test(start.slice(-45)))&&input.length<=160;
 if(!(quotedLeft&&quotedRight)&&!closeToHint)
  return {status:'name-needs-context-verification'};
 const record=chosen.records[0];
 if(!numeric(record?.id))failure('数値スキルIDが不正');
 return {status:'unique-verified-name',numericId:record.id,
  rarity:record.rarity};
}
/*
 * DOM ancestry goes from the smallest hint-owning element to broad parents.
 * Broader containers may list unrelated skill rewards. They cannot override
 * the nearest unique hint row. Independent distinct unique IDs or ambiguity
 * closer to the hint row remain unsafe. Returned objects contain no prose.
 */
function resolveHintContextChain(contexts,registry){
 if(!Array.isArray(contexts)||contexts.length>6||
    contexts.some(c=>typeof c!=='string'||c.length>300)||
    !(registry?.byName instanceof Map))
  failure('局所ヒントDOMの文脈系列が不正');
 const states=contexts.map(text=>matchContextToId(text,registry));
 const named=states.filter(x=>x.status==='unique-verified-name');
 const ids=new Set(named.map(x=>x.numericId));
 if(ids.size>1)return {status:'conflicting-skill-ids'};
 const nearest=states.findIndex(x=>x.status==='unique-verified-name');
 if(nearest>=0){
  if(states.slice(0,nearest).some(x=>x.status==='ambiguous-name-or-id'))
   return {status:'ambiguous-name-or-id'};
  const winner=states[nearest];
  return {status:'unique-verified-name',numericId:winner.numericId,
   rarity:winner.rarity};
 }
 if(states.some(x=>x.status==='ambiguous-name-or-id'))
  return {status:'ambiguous-name-or-id'};
 return states.find(x=>x.status!=='not-a-hint')||{status:'name-not-found'};
}

function summarizeHints(referenceEvent,observed){
 if(!referenceEvent||!Array.isArray(referenceEvent.choices)||
    !Array.isArray(observed)||observed.length>40)
  failure('限定イベントの形が不正');
 const reference=[];
 for(const choice of referenceEvent.choices){
  const variants=Array.isArray(choice.outcomes)?choice.outcomes:[choice.effects||[]];
  for(const effects of variants)for(const e of effects){
   if(e?.type!=='skill_hint')continue;
   if(!Number.isSafeInteger(e.skill_id)||e.skill_id<=0)continue;
   reference.push({id:String(e.skill_id),level:Number(e.value)});
  }
 }
 const resolved=observed.filter(x=>x.status==='unique-verified-name'),
       byId=new Map();
 for(const item of resolved){
  if(!numeric(item.numericId))failure('観測されたスキルIDが不正');
  byId.set(item.numericId,(byId.get(item.numericId)||0)+1);
 }
 let matched=0;
 for(const item of reference){
  if((byId.get(item.id)||0)>0){matched++;byId.set(item.id,byId.get(item.id)-1);}
 }
 return {
  referenceHintOccurrences:reference.length,
  observedHintCandidates:observed.length,
  namedUniqueIds:resolved.length,
  referenceIdOccurrencesMatched:matched,
  unresolvedNames:observed.filter(x=>x.status!=='unique-verified-name').length,
  sourceSkillIdsVerified:false, // comparison is unpaired: no choice/result binding
  outcomeAndChoicePairingVerified:false,
  hintLevelPairedWithIdVerified:false,
  publicationApproved:false,
  noProseIncluded:true
 };
}
module.exports={registryFromSkillText,matchContextToId,resolveHintContextChain,summarizeHints};
