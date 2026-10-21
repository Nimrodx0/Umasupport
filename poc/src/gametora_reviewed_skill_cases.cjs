'use strict';
/*
 * Targeted, non-publishing numeric-source exceptions. Every accepted event
 * has an exact pinned source shape and independently corroborated SKILL facts.
 * Stat/bond differences are NOT reconstructed by these rules.
 *
 * References and competing claims: docs/phase2-final-three-outcome-review-20261021.md
 */
const KEY=(c,e,o,r,i)=>JSON.stringify([c,e,o,r,i]);
function hint({cardId,ordinal,choice=1,route=1,index,fact,locator,registry,supplementalIds,historicalIds}){
 if(!fact||fact.originType!=='skill_hint'||fact.numericFactParsed!==true)return null;
 const key=KEY(cardId,ordinal,choice,route,index),proof=locator.get(key);
 if(!proof||proof.kind!=='hint'||proof.numericId!==fact.skillNumericId||
    proof.level!==fact.level)return null;
 const supplement=proof.status==='curation-only-not-in-runtime-registry'&&
  supplementalIds.has(fact.skillNumericId);
 const history=proof.status==='not-in-pinned-umasim-registry'&&
  historicalIds.has(fact.skillNumericId);
 if(!['mapped-existing-normal-hint','mapped-numeric-event-skill'].includes(proof.status)&&
    !supplement&&!history)return null;
 const source=registry.byId.get(fact.skillNumericId);
 if(!source||!['normal','rare'].includes(source.rarity))return null;
 return {key,id:source.id,fromSupplement:supplement,fromHistorical:history,
  reward:{skillId:'skill:'+source.id,verifiedSkillName:source.name,level:fact.level}};
}
const withoutConditions=e=>Array.isArray(e.reviewReasons)&&e.reviewReasons.length===0;
const plainChoice=e=>e.choices?.length===1&&e.choices[0].sourceLabelWasEmpty===true&&
 e.choices[0].reportedRandomAlternative===false&&e.choices[0].routes.length===1;
const uncheckedRoute=r=>r.explicitChainEnd===false&&r.guardKinds?.length===0&&
 r.directSkillGrantFacts?.length===0;
function rhein({card,event,chainByOrdinal,locator,registry,supplementalIds,historicalIds}){
 const e=event,c=card;
 if(c.cardId!=='30253'||e.sourceOrdinal!==5||e.sourceChainOrdinal!==3||
    e.section!=='arrows'||!plainChoice(e)||!withoutConditions(e))return null;
 const parent=chainByOrdinal.get(2);
 const r=e.choices[0].routes[0],effects=r.effects||[],facts=r.numericHintFacts||[];
 if(!parent||!uncheckedRoute(r)||r.conditionsRequiringReview?.length!==0||
    facts.length!==4||effects.length!==8||
    JSON.stringify(effects.slice(0,4))!==JSON.stringify(effects.slice(4))||
    ['speed','skill_hint','skill_hint','bond'].some((t,i)=>effects[i].type!==t)||
    ['201051','202671','201051','202671'].some((id,i)=>
     facts[i].skillNumericId!==id||facts[i].level!==1))return null;
 const proofs=facts.map((fact,i)=>hint({
  cardId:c.cardId,ordinal:e.sourceOrdinal,index:i+1,fact,locator,registry,
  supplementalIds,historicalIds}));
 if(proofs.some(x=>!x)||proofs[0].id!==proofs[2].id||
    proofs[1].id!==proofs[3].id||proofs[0].id===proofs[1].id)return null;
 // These are two identical source blocks for the earlier-choice variants,
 // not four different skills and NOT hint level +2. Two independent guides
 // confirm both variants grant the same two +1 hints.
 return {kind:'rheinkraft',event:{id:e.eventId,name:e.displayName,type:'auto',
   rewards:[proofs[0].reward,proofs[1].reward],
   requires:{all:[{eventId:parent}]}},
  sourceKeys:proofs.map(x=>x.key),beneficialRewards:2,collapsedSourceMentions:2,
  supplementalMentions:proofs.filter(x=>x.fromSupplement).length,
  historicalMentions:proofs.filter(x=>x.fromHistorical).length};
}
function matitan({card,event,chainByOrdinal,locator,registry,supplementalIds,historicalIds}){
 const e=event,c=card;
 if(c.cardId!=='30103'||e.sourceOrdinal!==5||e.sourceChainOrdinal!==3||
    e.section!=='arrows'||!plainChoice(e))return null;
 const p1=chainByOrdinal.get(1),p2=chainByOrdinal.get(2);
 const parents=c.events.filter(x=>x.section==='arrows'&&x.sourceChainOrdinal<=2);
 if(!p1||!p2||parents.length!==2)return null;
 const validParent=ev=>ev.choices.length===1&&ev.choices[0].sourceLabelWasEmpty===true&&
  ev.choices[0].reportedRandomAlternative===true&&
  ev.choices[0].routes.length===2&&
  ev.choices[0].routes.every(x=>x.guardKinds.length===0&&
   x.explicitChainEnd===false&&x.directSkillGrantFacts.length===0)&&
  // In these two events source branch 1 gives one hint; branch 2 gives none.
  ev.choices[0].routes[0].numericHintFacts.length===1&&
  ev.choices[0].routes[1].numericHintFacts.length===0;
 if(!parents.every(validParent))return null;
 const r=e.choices[0].routes[0],facts=r.numericHintFacts;
 if(!uncheckedRoute(r)||facts?.length!==3||r.conditionsRequiringReview?.length!==1||
    r.conditionsRequiringReview[0]!=='PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW'||
    !Array.isArray(e.reviewReasons)||e.reviewReasons.length!==1||
    e.reviewReasons[0]!=='PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW'||
    facts.some((h,i)=>h.skillNumericId!=='200461'||h.level!==3-i))return null;
 const flags=['both_previous_chain_good','one_previous_chain_good','both_previous_chain_bad'];
 const safeTypes=new Set(['speed','stamina','power','guts','energy','bond','skill_hint']);
 const groups=[];let current=null;
 for(const effect of r.effects||[]){
  if(flags.includes(effect.type)){
   if(current)groups.push(current);
   current={flag:effect.type,hints:[]};
  }else{
   if(!current||!safeTypes.has(effect.type))return null;
   if(effect.type==='skill_hint')current.hints.push(effect);
  }
 }
 if(current)groups.push(current);
 if(groups.length!==3||groups.some((g,i)=>g.flag!==flags[i]||
    g.hints.length!==1||g.hints[0].skillNumericId!=='200461'||
    g.hints[0].numericValue!==3-i))return null;
 const proofs=facts.map((fact,i)=>hint({
  cardId:c.cardId,ordinal:e.sourceOrdinal,index:i+1,fact,locator,registry,
  supplementalIds,historicalIds}));
 if(proofs.some(x=>!x)||new Set(proofs.map(x=>x.id)).size!==1)return null;
 const good=(id)=>({eventId:id,outcomeId:'route-01'});
 const bad=(id)=>({eventId:id,outcomeId:'route-02'});
 const outcomes=[
  {id:'previous-both-good',label:'前段2回とも成功（仮）',
   requires:{any:[{all:[good(p1),good(p2)]}]}},
  {id:'previous-one-good',label:'前段どちらか成功（仮）',
   requires:{any:[{all:[good(p1),bad(p2)]},{all:[bad(p1),good(p2)]}]}},
  {id:'previous-both-bad',label:'前段2回とも失敗（仮）',
   requires:{any:[{all:[bad(p1),bad(p2)]}]}}
 ].map((o,i)=>({...o,rewards:[proofs[i].reward]}));
 return {kind:'matitan',event:{id:e.eventId,name:e.displayName,
  type:'auto',outcomes,requires:{all:[{eventId:p2}]}},
  sourceKeys:proofs.map(x=>x.key),beneficialRewards:3,collapsedSourceMentions:0,
  supplementalMentions:proofs.filter(x=>x.fromSupplement).length,
  historicalMentions:proofs.filter(x=>x.fromHistorical).length};
}
function tryProject(args){
 if(args.card.cardId==='30103')return matitan(args);
 if(args.card.cardId==='30253')return rhein(args);
 return null;
}
module.exports={tryProject};
