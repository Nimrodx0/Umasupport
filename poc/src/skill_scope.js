/* Runtime presentation/analysis boundary: display only skills recorded in
 * the validated UmaSim skill registry. Event source facts remain untouched.
 * This is not a judgment of whether a skill exists in the actual game. */
(function(g){
'use strict';
const bridge=typeof module!=='undefined'&&module.exports
  ?require('./skill_bridge.js'):g.UmaSkillBridge;
const normalize=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
function apply(model,{skillText=null,pinnedSkillText=null}={}){
 if(!model||!Array.isArray(model.skills)||!model.skillById||!Array.isArray(model.cards))
  throw Error('スキル収録範囲の適用モデルが不正');
 // Do not guess missing skills from an unavailable source. Keep the verified
 // runtime fallback intact and explicitly mark the scope as not verified.
 if(typeof skillText!=='string'){
  const report={applied:false,reason:'skill-data-unavailable',excluded:0,
   registered:model.skills.length};
  model.meta??={};model.meta.skillScope=report;
  return report;
 }
 const current=bridge.parseSource(skillText);
 const pinned=typeof pinnedSkillText==='string'?bridge.parseSource(pinnedSkillText):null;
 const excluded=new Set();
 for(const skill of model.skills){
  if(!skill||typeof skill.id!=='string')continue;
  const name=normalize(skill.name);
  let known=false;
  if(skill.id.startsWith('hint:')){
   // The text-only support_card.txt may still list outdated names; it is
   // not authoritative for the actual UmaSim skill registry.
   known=(current.byName.get(name)||[]).length===1;
  } else {
   const numeric=String(skill.sourceNumericId||(/^skill:(\d+)$/.exec(skill.id)||[])[1]||'');
   if(numeric){
    const record=current.byId.get(numeric)||pinned?.byId.get(numeric);
    known=!!record&&record.name===name;
   }
  }
  if(!known)excluded.add(skill.id);
 }
 // Preserve model.skillById identities for validating/restoring older saved
 // goal sets. No deletion or rewrite of the reviewed event source is required.
 for(const id of excluded)model.skillById[id].excludedFromUmaSim=true;
 model.skills=model.skills.filter(s=>!excluded.has(s.id));
 for(const card of model.cards){
  if(card.hintsByStage){
   for(const [stage,skills] of Object.entries(card.hintsByStage)){
    if(Array.isArray(skills))card.hintsByStage[stage]=skills.filter(id=>!excluded.has(id));
   }
  }
  if(Array.isArray(card.hints))card.hints=card.hints.filter(id=>!excluded.has(id));
  card.umaSimExcludedSkillIds=excluded;
 }
 const report={applied:true,excluded:excluded.size,registered:model.skills.length,
  excludedHints:[...excluded].filter(id=>id.startsWith('hint:')).length,
  excludedNumeric:[...excluded].filter(id=>id.startsWith('skill:')).length,
  source:'UmaSim skill_data.txt, unique name or matched numeric ID'};
 model.meta??={};model.meta.skillScope=report;
 return report;
}
const api={apply};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillScope=api;
})(typeof globalThis!=='undefined'?globalThis:this);
