/* Pure card search: published normal hints and explicitly approved event rewards only.
 * Never promote historical/checker/reference skill candidates into live routes. */
(function(g){
'use strict';
const str=x=>String(x??'').normalize('NFKC').toLocaleLowerCase().trim();
const ids=x=>Array.isArray(x)?x.filter(s=>typeof s==='string'):[];
const APPROVED_EVENT_TYPES=new Set(['auto','choice']);
function approvedEventSkillIds(card,model){
 const out=new Set();
 // c.events is populated only through the reviewed public catalog loader.
 // When no event records have been validated, even a stray events property is untrusted.
 if(!model?.meta?.reviewedEventRecords||!Array.isArray(card?.events))return out;
 function rewards(xs){
  if(!Array.isArray(xs))return;
  for(const r of xs)if(typeof r?.skillId==='string'&&Object.hasOwn(model.skillById||{},r.skillId))out.add(r.skillId);
 }
 function branch(x){
  if(!x||typeof x!=='object')return;
  rewards(x.rewards);
  for(const v of Array.isArray(x.outcomes)?x.outcomes:[])rewards(v?.rewards);
 }
 for(const ev of card.events){
  if(!APPROVED_EVENT_TYPES.has(ev?.type))continue;
  branch(ev);
  for(const choice of Array.isArray(ev.choices)?ev.choices:[])branch(choice);
 }
 return out;
}
function normalHintIds(card,model){
 const result=new Set();
 const stages=card?.hintsByStage;
 // Union of verified 0-4 limits. Stage 4 alone is NOT a proof that earlier
 // stages offer exactly the same hints.
 if(!card?.sourceStatus?.startsWith('verified_hints'))return result;
 const list=stages&&typeof stages==='object'?
  [0,1,2,3,4].flatMap(n=>ids(stages[String(n)])):ids(card?.hints);
 for(const id of list)if(Object.hasOwn(model?.skillById||{},id))result.add(id);
 return result;
}
function skillMatches(id,query,model){
 if(!query)return true;
 const name=model?.skillById?.[id]?.name;
 return str(id).includes(query)||str(name).includes(query);
}
function routeOf(card,model,skillQuery=''){
 const q=str(skillQuery),hintIds=normalHintIds(card,model),eventIds=approvedEventSkillIds(card,model);
 const hint=[...hintIds].filter(id=>skillMatches(id,q,model));
 const event=[...eventIds].filter(id=>skillMatches(id,q,model));
 const h=hint.length>0,e=event.length>0;
 return {hint, event, kind:h&&e?'both':h?'hint':e?'event':'none'};
}
function matches(card,model,filters={},owned={}){
 const {query='',skillQuery='',rarity='all',type='all',ownership='all',route='all'}=filters;
 if(!card||typeof card.id!=='string')return false;
 if(rarity!=='all'&&card.rarity!==rarity)return false;
 if(type!=='all'&&card.type!==type)return false;
 const status=owned[card.id]?.status||'unregistered';
 if(ownership!=='all'&&status!==ownership)return false;
 const q=str(query);
 if(q&&!str([card.id,card.name,card.character,card.type,card.rarity,...ids(card.searchAliases)].join(' ')).includes(q))return false;
 const sk=str(skillQuery);
 if(!['all','hint','event','both'].includes(route))return false;
 // Empty skillQuery + 'all': no route constraint; skillQuery uses only known
 // hints/approved rewards, NOT unreviewed older referenceSkills.
 if(route==='all'&&!sk)return true;
 const matched=routeOf(card,model,sk);
 if(route==='all')return matched.kind!=='none';
 if(route==='both')return matched.hint.length>0&&matched.event.length>0;
 return matched[route].length>0;
}
function filterCards(cards,model,filters={},owned={}){
 if(!Array.isArray(cards))throw new Error('Card list must be an array');
 return cards.filter(card=>matches(card,model,filters,owned));
}
const api={normalHintIds,approvedEventSkillIds,routeOf,matches,filterCards};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCardSearch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
