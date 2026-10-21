'use strict';
/*
 * Complete, numeric-only event BRANCH SEMANTICS inventory.
 * "skill_hint_or" is an EFFECT, NOT a count of all alternative results.
 * This is a non-publishing audit over already normalized GameTora input.
 */
const fail=x=>{throw Error('GameTora分岐母集団診断: '+x);};
const VALID=new Set(['random','arrows','special','dates','dates_random']);
const sorted=m=>Object.fromEntries([...m.entries()].sort(([a],[b])=>a.localeCompare(b)));
function inventory(candidate){
 if(candidate?.dataKind!=='gametora-whole-event-numeric-candidate'||
    candidate.releaseApproved!==false||
    candidate.noEventCanPublishFromThisCandidate!==true||
    candidate.originalSourceTextIncluded!==false||
    !Array.isArray(candidate.cards)||
    !Number.isSafeInteger(candidate.totals?.sourceEvents)||
    !Number.isSafeInteger(candidate.totals?.sourceChoices)||
    !Number.isSafeInteger(candidate.totals?.expandedRoutes))
  fail('元データと未公開の出典情報が不正');
 const totals={
  rosterCards:0,sourceEvents:0,sourceChoices:0,sourceRoutes:0,
  multiRouteChoices:0,explicitRandomMultiRouteChoices:0,
  unflaggedMultiRouteChoices:0,randomFlagSingleRouteChoices:0,
  multiRouteEvents:0,eventsWithSkillHintOr:0,
  skillHintOrEffectMentions:0,skillHintOrOptions:0,
  rangeLevelHintMentions:0,rangeLevelOrOptions:0,eventsWithRangeLevels:0,
  explicitChainEndRoutes:0,nonChainEndRoutes:0,
  guardedRoutes:0,eventsWithGuards:0,directSkillGrantMentions:0,
  eventsWithDirectGrants:0
 };
 const sections=new Map(),terminationSections=new Map();
 const rows=[];
 const cardIds=new Set();
 for(const card of candidate.cards){
  if(!card||typeof card.cardId!=='string'||cardIds.has(card.cardId)||
     !Array.isArray(card.events)||
     card.sourceMissing!==undefined&&typeof card.sourceMissing!=='boolean'||
     card.sourceMissing===true&&card.events.length!==0)
   fail('サポカ集合の重複・構造不正');
  cardIds.add(card.cardId);totals.rosterCards++;
  const ordinals=new Set();
  for(const e of card.events){
   if(!e||!Number.isSafeInteger(e.sourceOrdinal)||ordinals.has(e.sourceOrdinal)||
      !VALID.has(e.section)||!Array.isArray(e.choices)||!e.choices.length)
    fail('イベント位置・分類不正');
   ordinals.add(e.sourceOrdinal);
   totals.sourceEvents++;
   sections.set(e.section,(sections.get(e.section)||0)+1);
   let mult=0,or=0,range=0,guarded=0,grant=0,term=0;
   for(const ch of e.choices){
    if(!ch||!Array.isArray(ch.routes)||!ch.routes.length||
       typeof ch.reportedRandomAlternative!=='boolean')
     fail('選択肢経路不正');
    totals.sourceChoices++;totals.sourceRoutes+=ch.routes.length;
    if(ch.routes.length>1){
     mult++;totals.multiRouteChoices++;
     if(ch.reportedRandomAlternative)totals.explicitRandomMultiRouteChoices++;
     else totals.unflaggedMultiRouteChoices++;
    }else if(ch.reportedRandomAlternative)totals.randomFlagSingleRouteChoices++;
    for(const r of ch.routes){
     if(!Array.isArray(r.numericHintFacts)||!Array.isArray(r.guardKinds)||
        !Array.isArray(r.directSkillGrantFacts)||typeof r.explicitChainEnd!=='boolean')
      fail('結果経路事実不正');
     if(r.explicitChainEnd){
      term++;totals.explicitChainEndRoutes++;
      terminationSections.set(e.section,(terminationSections.get(e.section)||0)+1);
      if(e.section!=='arrows')totals.nonChainEndRoutes++;
     }
     if(r.guardKinds.length){guarded++;totals.guardedRoutes++;}
     grant+=r.directSkillGrantFacts.length;
     totals.directSkillGrantMentions+=r.directSkillGrantFacts.length;
     for(const h of r.numericHintFacts){
      if(h.originType==='skill_hint_or'){
       if(!Array.isArray(h.alternatives))fail('OR候補の配列が欠損');
       or++;totals.skillHintOrEffectMentions++;
       totals.skillHintOrOptions+=h.alternatives.length;
       for(const o of h.alternatives){
        if(Array.isArray(o.levelRange)){range++;totals.rangeLevelOrOptions++;}
       }
      }else if(h.originType==='skill_hint'){
       if(Array.isArray(h.levelRange)){range++;totals.rangeLevelHintMentions++;}
      }else fail('元ヒント種別不正');
     }
    }
   }
   if(mult)totals.multiRouteEvents++;
   if(or)totals.eventsWithSkillHintOr++;
   if(range)totals.eventsWithRangeLevels++;
   if(guarded)totals.eventsWithGuards++;
   if(grant)totals.eventsWithDirectGrants++;
   // Numeric review positions are deliberately limited to events with
   // branching / skill alternatives / terminal effects, not source prose.
   if(mult||or||range||guarded||grant||term)
    rows.push({cardId:card.cardId,sourceOrdinal:e.sourceOrdinal,
     section:e.section,multiRouteChoices:mult,skillHintOrEffects:or,
     rangeLevelMentions:range,guardedRoutes:guarded,
     directGrantMentions:grant,terminalRoutes:term});
  }
 }
 if(totals.sourceEvents!==candidate.totals.sourceEvents||
    totals.sourceChoices!==candidate.totals.sourceChoices||
    totals.sourceRoutes!==candidate.totals.expandedRoutes||
    totals.rosterCards!==candidate.totals.rosterCards||
    totals.explicitChainEndRoutes!==candidate.totals.explicitTerminalRoutes||
    totals.directSkillGrantMentions!==candidate.totals.directSkillGrantMentions)
  fail('出典の全件母数・終了／直接獲得の整合不一致');
 if(totals.multiRouteChoices!==totals.explicitRandomMultiRouteChoices+
     totals.unflaggedMultiRouteChoices||
    totals.explicitChainEndRoutes!==
     [...terminationSections.values()].reduce((a,b)=>a+b,0)||
    totals.nonChainEndRoutes>totals.explicitChainEndRoutes)
  fail('分類の排他性・網羅性が崩れました');
 return {schemaVersion:1,dataKind:'gametora-numeric-branch-semantics-inventory',
  publicationApproved:false,gameVerified:false,sourceProseIncluded:false,
  populationIsNotGameWideCompleteness:true,
  description:'Choices, expanded outcomes, alternative skill effects and level ranges are disjoint measurement dimensions.',
  totals,sourceSectionEvents:sorted(sections),
  terminalRoutesBySection:sorted(terminationSections),
  numericOnlyReviewPositions:rows};
}
module.exports={inventory};
