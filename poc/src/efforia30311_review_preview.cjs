/* SSR30311 / Efforia: NON-PUBLISHED, ordinal-labelled review preview.
 * Structured numeric facts: GameWith card article (updated 2026-10-08);
 * provisional numeric story IDs: Umamusume Wiki rendered SSR30311 article.
 * No game/guide dialogue, choice prose, images, or copied effect sentences.
 *
 * WARNING: GameWith does not supply story IDs. Pairing its ordered sections
 * with Wiki story IDs and assuming nonterminal progression is PROVISIONAL.
 * This builder is NOT authorized for the published reviewed_events database.
 */
'use strict';
const schema=require('./event_schema.js');
const core=require('./core.js');
const CARD='30311', PREFIX='evt_'+CARD+'_';
const ARTICLES=Object.freeze({
 effects:'https://gamewith.jp/uma-musume/article/show/573288',
 ids:'https://umamusu.wiki/Game:SSR_Efforia_(As_if_Guided)'
});
// Minimal ID/name/level facts only, NOT copied external event wording.
const SKILLS=Object.freeze({
 '204072':'気持ちを乗せて',
 '204372':'流れに任せて',
 '204532':'華麗な踏み込み',
 '204701':'素質の証明',
 '204531':'清麗高雅',
 '204571':'純真無垢',
 '203712':'勇気の一歩',
 '203711':'ショーダウン'
});
const reward=(number,level)=>{
 const name=SKILLS[String(number)];
 if(!name)throw Error('Unreviewed skill number: '+number);
 return {skillId:'skill:'+number,verifiedSkillName:name,level};
};
const choice=(number,rest={})=>({id:'option'+number,label:'選択肢'+number+'（位置のみ、仮表示）',...rest});
const base=(story,category,options,requires)=>({
 id:PREFIX+story,name:category+' / '+story+'（仮の番号表示）',type:'choice',
 ...(requires?{requires:{all:[{eventId:PREFIX+requires}]}}:{}),
 choices:options
});
function buildUnpublishedPreview(){
 const chain1=base('830311001','連続1',[
  choice(1),choice(2)
 ]);
 const chain2=base('830311002','連続2',[
  choice(1,{rewards:[reward(204072,1)]}),choice(2)
 ],'830311001');
 const finaleHints=[
  [[204532,204701,204531],[5,2,2]],
  [[204701,204571],[2,2]],
  [[203712,204701,203711],[5,2,2]]
 ];
 const finale=base('830311003','連続3',finaleHints.map(([ids,levels],i)=>
  choice(i+1,{outcomes:[
   {id:'success',label:'成功',rewards:ids.map(id=>reward(id,1))},
   {id:'great',label:'大成功',rewards:ids.map((id,j)=>reward(id,levels[j]))}
  ]})
 ),'830311002');
 const other1=base('801146001','通常1',[choice(1),choice(2)]);
 const other2=base('801146002','通常2',[
  choice(1,{rewards:[reward(204372,1)]}),choice(2)
 ]);
 return {schemaVersion:1,cards:[{
  cardId:CARD,coverageStatus:'partial',
  events:[chain1,chain2,finale,other1,other2]
 }]};
}
function blockers(){
 return [
  'GameWith does not expose story IDs: Wiki-to-GameWith event ordering is a provisional join',
  'Chain progression and any early termination are not independently verified',
  'All conditional outcomes other than the documented success/great-success tiers may be absent',
  'Skill numeric ID/name crosswalk still needs the pinned UmaSim registry at admission time',
  'Independent confirmation of current game, data/publication rights and original UI labels is pending',
  'Android/Windows physical-device acceptance is not complete'
 ];
}
function inspect(){
 const catalog=buildUnpublishedPreview();
 const model={
  cards:[{id:CARD}],cardById:{[CARD]:{id:CARD}},
  skillById:Object.fromEntries(Object.entries(SKILLS).map(([id,name])=>[
   'skill:'+id,{id:'skill:'+id,name}
  ]))
 };
 const coverage=schema.validateCatalog(catalog,model);
 const events=catalog.cards[0].events;
 const sourceEvents=events.length;
 const choicePositions=events.reduce((sum,e)=>sum+e.choices.length,0);
 const finale=events[2];
 const outcomeGroups=finale.choices.reduce((sum,c)=>sum+c.outcomes.length,0);
 const finaleRewardRows=finale.choices.reduce((sum,c)=>
  sum+c.outcomes.reduce((n,o)=>n+o.rewards.length,0),0);
 if(sourceEvents!==5||choicePositions!==11||outcomeGroups!==6||finaleRewardRows!==16)
  throw Error('SSR30311 provisional coverage count changed');
 const selected={...Object.fromEntries(events.map(e=>[e.id,'option1']))};
 const routes=core.directRoutes({events,hints:[]},{choices:selected,stage:4});
 // Total matrix rows are 16 finale outcome hints + two earlier hints.
 // Only ONE finale choice can be selected per cultivation run:
 // option1 yields six conditional hints + two non-finale routes.
 const allChoiceSkillHintRows=events.reduce((sum,e)=>sum+e.choices.reduce((n,c)=>
  n+(c.rewards||[]).length+(c.outcomes||[]).reduce((m,o)=>m+o.rewards.length,0),0),0);
 if(allChoiceSkillHintRows!==18||routes.length!==8||
    routes.filter(x=>x.conditional).length!==6)
  throw Error('SSR30311 provisional route count changed');
 return {source:'GameWith-first + Wiki numeric ID candidates',
  cardId:CARD,previewOnly:true,releaseEligible:false,
  originURLs:ARTICLES,sourceEvents,choicePositions,outcomeGroups,
  finaleSkillHintRows:finaleRewardRows,otherSkillHintRows:2,
  allSelectedOption1RouteRows:routes.length,
  conditionalRouteRows:routes.filter(x=>x.conditional).length,
  coverage,blockers:blockers()};
}
module.exports={CARD,ARTICLES,SKILLS,buildUnpublishedPreview,inspect,blockers};
