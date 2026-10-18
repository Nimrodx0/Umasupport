/* Validates the unpublished SSR30311 preview's exact numeric skill names
 * against a separately supplied, full UmaSim registry. No external GET.
 * This is an audit, not an event release or proof of current game rewards. */
'use strict';
const bridge=require('./skill_bridge.js');
const preview=require('./efforia30311_review_preview.cjs');
function auditSkillRegistry(text){
 const source=bridge.parseSource(text);
 const catalog=preview.buildUnpublishedPreview();
 const skillNumbers=new Map(Object.entries(preview.SKILLS));
 const observed=new Map();
 let hintRows=0;
 function visitRewards(rs){
  for(const r of rs||[]){
   const key=String(r.skillId).replace(/^skill:/,'');
   if(!/^\d+$/.test(key))throw Error('Unexpected nonnumeric event skill ID');
   if(!skillNumbers.has(key)||r.verifiedSkillName!==skillNumbers.get(key))
    throw Error('Preview reward ID or name mismatches reviewed roster: '+key);
   if(!Number.isSafeInteger(r.level)||r.level<1||r.level>7)
    throw Error('Preview skill hint level is invalid');
   hintRows++;
   observed.set(key,r.verifiedSkillName);
  }
 }
 for(const card of catalog.cards){
  for(const e of card.events){
   visitRewards(e.rewards);
   for(const c of e.choices||[]){
    visitRewards(c.rewards);
    for(const result of c.outcomes||[])visitRewards(result.rewards);
   }
  }
 }
 if(observed.size!==8||hintRows!==18||observed.size!==skillNumbers.size)
  throw Error('Preview reward roster or total rows changed');
 for(const [skillId,name] of skillNumbers){
  const data=source.byId.get(skillId);
  if(!data||data.name!==name)
   throw Error('Pinned UmaSim numeric skill ID/name is absent or changed: '+skillId);
  if(!['normal','rare'].includes(data.rarity))
   throw Error('Unexpected skill rarity for hint reward: '+skillId);
 }
 return {cardId:preview.CARD,verifiedNumericSkillIds:skillNumbers.size,
  previewSkillHintRows:hintRows,sourceRegistryRecordCount:source.count,
  isCurrentGameRewardVerified:false,isPublicationApproved:false};
}
module.exports={auditSkillRegistry};
