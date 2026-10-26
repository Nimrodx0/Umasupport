'use strict';
/*
 * PRIVATE ONLY. SSR30010 GT arrow event 5 contains a single numeric range
 * AND a skill_hint_or with a ranged first alternative. The original private
 * skill projector already has four exclusive leaves (tier x OR option).
 * Attach numeric effects to those SAME leaves, without creating new draws,
 * changing hint availability, inferring probabilities or copying GT prose.
 */
const core=require('./core.js');
const {numeric}=require('./phase2_gt_correlated_numeric_range.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('GT30010連動範囲とORの結果照合: '+s);};
const serial=JSON.stringify;
const id='gt-30010-event-005';
const sourceRows=[
 ['energy','-10',null],
 ['guts','+5',null],
 ['wisdom','+5/+10',null],
 ['skill_points','+15',null]
];
const skillRows=[
 {skillId:'skill:200581',level:1},
 {skillId:'skill:200582',level:1},
 {skillId:'skill:200581',level:3},
 {skillId:'skill:200582',level:1}
];
function enrich({catalog,documents,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !Array.isArray(documents)||review?.dataKind!=='phase2-gt-correlated-numeric-range-review'||
    review.sourcePin!==POLICY.baselineRevision||review.publicationApproved!==false||
    review.automaticRuntimeAdoption!==false||
    POLICY.automaticPublicationAllowed!==false||!Array.isArray(review.rows))
  fail('固定元・非公開ゲートに一致しない');
 const located=review.rows.filter(r=>r.cardId==='30010'&&r.sourceOrdinal===5&&
  r.choiceOrdinal===1);
 if(located.length!==1||located[0].canProjectNumericTiers!==true||
    located[0].sourceRangeEffectCount!==1||located[0].sourceNumericEffects!==4||
    !Array.isArray(located[0].blockers)||located[0].blockers.length||
    !Array.isArray(located[0].numericTiers)||located[0].numericTiers.length!==2)
  fail('数値範囲監査の位置・ブロッカー不一致');
 const sourceCards=documents.filter(d=>String(d?.id)==='30010');
 if(sourceCards.length!==1||sourceCards[0].kind!=='support')fail('元GTカードが一意でない');
 const source=Object.values(sourceCards[0].events_ja||sourceCards[0].events||{})[4];
 if(source?.section!=='arrows'||source.choices?.length!==1||
    source.choices[0]?.label!==''||source.choices[0].random_either!==false||
    source.choices[0].outcomes!==undefined||
    source.choices[0].segments?.length)
  fail('元イベントの自動・通常結果条件の違い');
 const raw=source.choices[0].effects;
 if(!Array.isArray(raw)||raw.length!==5||
    serial(raw.slice(0,4).map(e=>[e.type,e.value,e.char_id??null]))!==serial(sourceRows)||
    serial(raw[4])!==serial({type:'skill_hint_or',options:[
     {skill_id:200581,value:'+1/+3'},{skill_id:200582,value:'+1'}]}))
  fail('元数値効果とORスキルID・元順序が違う');
 const tierEffects=[0,1].map(t=>raw.slice(0,4).map((e,i)=>{
  const pair=numeric(e.value);
  if(!pair||pair[t]===0||e.char_id!==undefined||
     !sourceRows[i]||e.type!==sourceRows[i][0])
   fail('数値範囲の対象と符号を判定できない');
  return {kind:e.type,delta:pair[t]};
 }));
 const expectedReview=[0,1].map(t=>tierEffects[t].map((e,i)=>({
  ...e,sourceEffectOrdinal:i+1
 })));
 if(serial(located[0].numericTiers)!==serial(expectedReview))
  fail('監査と実GT効果の数値段階に差異');
 const matches=catalog.cards.filter(c=>c.cardId==='30010');
 if(matches.length!==1)fail('非公開カタログで対象カードが一意でない');
 const original=matches[0].events?.filter(e=>e.id===id);
 if(original?.length!==1||original[0].type!=='auto'||
    original[0].rewards!==undefined||original[0].effects!==undefined||
    original[0].statusEffects!==undefined||original[0].dynamicEffects!==undefined||
    original[0].outcomes?.length!==4)
  fail('既存自動イベントの4結果が存在しない');
 for(let i=0;i<4;i++){
  const o=original[0].outcomes[i],expected=skillRows[i];
  if(o.id!=='route-01-or-'+(i+1)||o.terminal===true||
     o.effects!==undefined||o.statusEffects!==undefined||
     o.dynamicEffects!==undefined||o.rewards?.length!==1||
     o.rewards[0].skillId!==expected.skillId||o.rewards[0].level!==expected.level)
   fail('既存結果のスキルID・Lv・順位不一致 '+(i+1));
 }
 const copy=structuredClone(catalog);
 const event=copy.cards.find(c=>c.cardId==='30010').events.find(e=>e.id===id);
 for(let i=0;i<4;i++)event.outcomes[i].effects=structuredClone(tierEffects[Math.floor(i/2)]);
 const beforeCard={id:'30010',events:[{...original[0],requires:undefined,availabilityKind:undefined}]};
 const afterCard={id:'30010',events:[{...event,requires:undefined,availabilityKind:undefined}]};
 // Both OR options must share the same wisdom tier; OR cannot grant both.
 for(let i=0;i<4;i++){
  const state={outcomes:{[id]:'route-01-or-'+(i+1)}};
  const prior=core.directRoutes(beforeCard,state),next=core.directRoutes(afterCard,state);
  if(serial(prior)!==serial(next))
   fail('スキル候補または結果IDが変化');
  const effects=core.directEffectRoutes(afterCard,state);
  if(effects.length!==4||effects.some((x,j)=>
    x.effectKind!==tierEffects[Math.floor(i/2)][j].kind||
    x.delta!==tierEffects[Math.floor(i/2)][j].delta||
    x.outcomeId!=='route-01-or-'+(i+1)))
   fail('4結果の能力・体力・スキルPtの分岐に不一致');
 }
 const possible=core.directEffectRoutes(afterCard,{outcomes:{}});
 if(possible.length!==16||possible.some(r=>r.conditional!==true)||
    serial(core.directRoutes(beforeCard,{outcomes:{}}))!==
    serial(core.directRoutes(afterCard,{outcomes:{}})))
  fail('未確定結果の排他性・既存スキル不変性が崩れた');
 return {catalog:copy,summary:{
  sourceRevision:POLICY.baselineRevision,cardId:'30010',
  sourceOrdinal:5,sourceChoiceOrdinal:1,
  numericLowWisdom:5,numericHighWisdom:10,
  resultSkillNumericIds:[200581,200582,200581,200582],
  resultSkillLevels:[1,1,3,1],
  matchingExclusiveResults:4,attachedComponents:16,
  privateEffectEventAdded:1,existingSkillRoutesUnchanged:true,
  publicationApproved:false,sourceNarrativeIncluded:false
 }};
}
module.exports={enrich};
