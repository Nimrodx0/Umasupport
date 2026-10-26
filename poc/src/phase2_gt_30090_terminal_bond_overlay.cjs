'use strict';
/*
 * PRIVATE GT source-bound event 4 of SSR30090. Its second choice has a
 * correlated bond -5/+5 result, but BOTH results also end the chain.
 * Represent terminal at each leaf and never allow a "good bond" continuation.
 * The first choice's normal skill hint is left unchanged.
 */
const core=require('./core.js');
const POLICY=require('../config/event-source-priority.v1.json');
const {numeric}=require('./phase2_gt_correlated_numeric_range.cjs');
const fail=s=>{throw Error('GT30090絆幅・両結果打ち切り: '+s);};
const eventId='gt-30090-event-004';
const sourceRows=[
 [['energy','+10',null,null],['skill_points','+10',null,null],
  ['skill_hint','+1',null,201142],['bond','+5',1017,null]],
 [['energy','-10',null,null],['stamina','+25',null,null],
  ['guts','+25',null,null],['bond','-5/+5',1017,null],
  ['chain_end',null,null,null]]
];
const numericKinds=new Set(['energy','stamina','guts','bond','skill_points']);
function toEffect(e,tier){
 if(!numericKinds.has(e?.type)||
    Object.keys(e).some(k=>!['type','value','char_id'].includes(k))||
    (e.type==='bond'&&e.char_id!==1017)||
    (e.type!=='bond'&&e.char_id!==undefined))
  fail('数値効果の型・絆受け手が不正');
 const pair=numeric(e.value);
 if(!pair||pair[tier]===0)fail('絆範囲または符号付き値が不正');
 return {kind:e.type,delta:pair[tier],
  ...(e.char_id===undefined?{}:{recipientCharId:e.char_id})};
}
function enrich({catalog,documents,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !Array.isArray(documents)||review?.dataKind!=='phase2-gt-correlated-numeric-range-review'||
    review.sourcePin!==POLICY.baselineRevision||
    review.publicationApproved!==false||review.automaticRuntimeAdoption!==false||
    POLICY.automaticPublicationAllowed!==false||!Array.isArray(review.rows))
  fail('固定GT版・非公開ゲートが不正');
 const rows=review.rows.filter(x=>x.cardId==='30090'&&x.sourceOrdinal===4&&
  x.choiceOrdinal===2);
 if(rows.length!==1||rows[0].sourceRangeEffectCount!==1||
    rows[0].canProjectNumericTiers!==false||
    JSON.stringify(rows[0].blockers)!==JSON.stringify(['UNSUPPORTED_OTHER_EFFECT']))
  fail('元の絆幅と打ち切り保留記録が異なる');
 const origin=documents.filter(d=>String(d?.id)==='30090');
 if(origin.length!==1||origin[0].kind!=='support')
  fail('GT元カード数値IDが一意でない');
 const source=Object.values(origin[0].events_ja||origin[0].events||{})[3];
 if(source?.section!=='arrows'||source.choices?.length!==2)
  fail('GT元イベント順と2択が異なる');
 for(let i=0;i<2;i++){
  const ch=source.choices[i];
  if(ch?.random_either!==false||ch.outcomes!==undefined||
     ch.segments?.length||!Array.isArray(ch.effects)||
     JSON.stringify(ch.effects.map(e=>[
      e.type,e.value??null,e.char_id??null,e.skill_id??null
     ]))!==JSON.stringify(sourceRows[i])||
     ch.effects.some(e=>Object.keys(e).some(k=>
      !['type','value','char_id','skill_id'].includes(k))))
   fail('元の結果・数値・打ち切りマーカーが一致しない');
 }
 const priorSourceChoice=source.choices[0].effects;
 if(priorSourceChoice[2].type!=='skill_hint'||priorSourceChoice[2].skill_id!==201142||
    priorSourceChoice[2].value!=='+1'||
    source.choices[1].effects.at(-1)?.type!=='chain_end'||
    Object.keys(source.choices[1].effects.at(-1)).length!==1)
  fail('通常ヒントと終端の固定条件が異なる');
 const found=catalog.cards.filter(c=>c.cardId==='30090');
 if(found.length!==1)fail('非公開元カードが一意でない');
 const selected=found[0].events?.filter(e=>e.id===eventId);
 if(selected?.length!==1||selected[0].type!=='choice'||
    selected[0].choices?.length!==2)
  fail('元イベントのchoice形状が不一致');
 const [normal,terminal]=selected[0].choices;
 if(normal.id!=='choice-01'||terminal.id!=='choice-02'||
    normal.terminal!==undefined||normal.outcomes!==undefined||
    normal.effects!==undefined||normal.statusEffects!==undefined||
    normal.dynamicEffects!==undefined||
    normal.rewards?.length!==1||normal.rewards[0].skillId!=='skill:201142'||
    normal.rewards[0].level!==1||
    terminal.terminal!==true||terminal.outcomes!==undefined||
    terminal.rewards?.length!==0||terminal.effects!==undefined||
    terminal.statusEffects!==undefined||terminal.dynamicEffects!==undefined)
  fail('既存スキル枝または打ち切り枝が不一致');
 const original=structuredClone(catalog),copy=structuredClone(catalog);
 const e=copy.cards.find(c=>c.cardId==='30090').events.find(x=>x.id===eventId);
 e.choices[0].effects=source.choices[0].effects.filter(x=>x.type!=='skill_hint')
  .map(x=>toEffect(x,0));
 const stop=e.choices[1];
 delete stop.terminal;
 delete stop.rewards;
 stop.outcomes=[0,1].map(tier=>({
  id:'bond-tier-'+(tier+1),label:tier===0?'低側の結果':'高側の結果',
  terminal:true,rewards:[],
  effects:source.choices[1].effects.slice(0,-1).map(x=>toEffect(x,tier))
 }));
 const before={id:'30090',events:[{...selected[0],requires:undefined,
  availabilityKind:undefined}]};
 const after={id:'30090',events:[{...e,requires:undefined,
  availabilityKind:undefined}]};
 const cfg=choice=>({choices:{[eventId]:choice},outcomes:{}});
 // The old flat terminal choice must block a successor, even before a tier
 // is resolved; moving "terminal" to outcomes must remain equivalent.
 const successor={id:'gt-30090-event-005',type:'auto',name:'later',
  requires:{all:[{eventId,choiceId:'choice-02'}]},rewards:[
   {skillId:'skill:dummy',level:1}]};
 for(const caseState of [
  cfg('choice-01'),cfg('choice-02'),
  {...cfg('choice-02'),outcomes:{[eventId]:'bond-tier-1'}},
  {...cfg('choice-02'),outcomes:{[eventId]:'bond-tier-2'}}
 ]){
  const base={...caseState,outcomes:{}};
  const prev=core.directRoutes(before,base),next=core.directRoutes(after,caseState);
  if(JSON.stringify(prev)!==JSON.stringify(next))
   fail('元スキル候補の結果・選択・打ち切りが変化');
  const gone=core.directRoutes({id:'30090',events:[...after.events,successor]},caseState);
  if(gone.some(x=>x.eventId===successor.id))
   fail('終端で後続イベントが開放された');
 }
 const noChoice=core.directEffectRoutes(after,{choices:{},outcomes:{}});
 const first=core.directEffectRoutes(after,cfg('choice-01'));
 const unresolved=core.directEffectRoutes(after,cfg('choice-02'));
 const low=core.directEffectRoutes(after,{...cfg('choice-02'),
  outcomes:{[eventId]:'bond-tier-1'}});
 const high=core.directEffectRoutes(after,{...cfg('choice-02'),
  outcomes:{[eventId]:'bond-tier-2'}});
 if(noChoice.length||first.length!==3||unresolved.length!==8||
    unresolved.some(x=>x.conditional!==true)||
    low.length!==4||high.length!==4||
    low.some(x=>x.outcomeId!=='bond-tier-1')||
    high.some(x=>x.outcomeId!=='bond-tier-2')||
    low[3].delta!==-5||high[3].delta!==5||
    first[2].delta!==5||first[2].recipientCharId!==1017)
  fail('低高の絆・他選択肢・未決定結果が不一致');
 // A global stability check protects unrelated cards and chained hints;
 // no modified narrative, publication flags, or existing skill IDs.
 if(copy.cards.length!==original.cards.length)
  fail('対象カードの母数が変わった');
 let skillCardChecks=0;
 for(const card of copy.cards){
  const old=original.cards.find(c=>c.cardId===card.cardId);
  if(!old||old.events?.length!==card.events?.length)
   fail('イベント件数を変更した');
  const selectedChoices={};
  const selectedOutcomes={};
  for(const item of old.events||[]){
   if(item.type==='choice'&&item.choices?.length){
    selectedChoices[item.id]=item.choices[0].id;
    const outcome=item.choices[0].outcomes?.[0];
    if(outcome)selectedOutcomes[item.id]=outcome.id;
   }else if(item.outcomes?.length)selectedOutcomes[item.id]=item.outcomes[0].id;
  }
  for(const state of [
   {stage:4,choices:{},outcomes:{}},
   {stage:4,choices:selectedChoices,outcomes:selectedOutcomes}
  ]){
   if(JSON.stringify(core.directRoutes({...old,id:card.cardId},state))!==
      JSON.stringify(core.directRoutes({...card,id:card.cardId},state)))
    fail('全カードのスキル経路不変性を破壊 '+card.cardId);
  }
  skillCardChecks++;
 }
 return {catalog:copy,summary:{
  cardId:'30090',sourceOrdinal:4,sourceChoiceOrdinal:2,
  existingTerminalChoiceReplacedByTwoTerminalOutcomes:true,
  terminalOutcomes:2,sourceSkillHintUnchanged:true,
  bondTierDeltas:[-5,5],numericComponentsAdded:11,
  otherChoiceComponents:3,terminalChoiceComponents:8,
  skillCardChecks,publicationApproved:false,sourceNarrativeIncluded:false
 }};
}
module.exports={enrich};
