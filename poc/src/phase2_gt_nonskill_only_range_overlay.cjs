'use strict';
/*
 * Two narrowly identified GT support-chain events have a correlated
 * high/low numeric effect but NO skill-range award. Convert their selected
 * choice into two mutually exclusive outcome leaves, never two guaranteed
 * gains and never inferred percentages. The other player choice stays flat.
 *
 * This overlay is for the private 2512 runtime only. No narrative or source
 * event choice label is persisted.
 */
const core=require('./core.js');
const POLICY=require('../config/event-source-priority.v1.json');
const {numeric}=require('./phase2_gt_correlated_numeric_range.cjs');
const fail=s=>{throw Error('GT数値のみ連動結果: '+s);};
const row=e=>[e.type,e.value,e.char_id??null];
const PROFILES=[
 {cardId:'30030',sourceOrdinal:3,rangeChoiceOrdinal:2,
  expected:[
   [['mood','+1',null],['bond','+5',1062]],
   [['energy','+10/+30',null],['bond','+5',1062]]
  ],
  low:10,high:30,rangeKind:'energy'},
 {cardId:'30041',sourceOrdinal:3,rangeChoiceOrdinal:1,
  expected:[
   [['energy','-10',null],['skill_points','+15/+45',null],
    ['bond','+5',1059]],
   [['guts','+5',null],['wisdom','+5',null],['bond','+5',1059]]
  ],
  low:15,high:45,rangeKind:'skill_points'}
];
const supported=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points']);
function scalar(effect,tier){
 if(!supported.has(effect?.type)||
    Object.keys(effect).some(k=>!['type','value','char_id'].includes(k))||
    effect.char_id!==undefined&&
     (effect.type!=='bond'||!Number.isSafeInteger(effect.char_id)||effect.char_id<=0))
  fail('元GT数値形状・受け手の違い');
 const values=numeric(effect.value);
 if(!values||values[tier]===0)fail('元GT符号付き数値が不正またはゼロ');
 return {kind:effect.type,delta:values[tier],
  ...(effect.char_id===undefined?{}:{recipientCharId:effect.char_id})};
}
function apply({catalog,documents,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !Array.isArray(documents)||review?.dataKind!=='phase2-gt-correlated-numeric-range-review'||
    review.sourcePin!==POLICY.baselineRevision||
    review.publicationApproved!==false||
    review.automaticRuntimeAdoption!==false||
    POLICY.automaticPublicationAllowed!==false)
  fail('非公開カタログ・元固定版の保証がない');
 const clone=structuredClone(catalog),changed=[],distinct=new Set();
 const docs=new Map(documents.map(d=>[String(d.id),d]));
 if(docs.size!==documents.length)fail('GT元カードID重複');
 for(const spec of PROFILES){
  const id='gt-'+spec.cardId+'-event-'+String(spec.sourceOrdinal).padStart(3,'0');
  const r=review.rows.filter(x=>x.cardId===spec.cardId&&
   x.sourceOrdinal===spec.sourceOrdinal&&
   x.choiceOrdinal===spec.rangeChoiceOrdinal);
  if(r.length!==1||r[0].canProjectNumericTiers!==true||
     r[0].sourceRangeEffectCount!==1||r[0].blockers.length!==0)
   fail('元範囲選択肢の事実と監査が一致しない '+spec.cardId);
  const doc=docs.get(spec.cardId);
  if(doc?.kind!=='support')fail('GT元カード不在');
  const source=Object.values(doc.events_ja||doc.events||{})[spec.sourceOrdinal-1];
  if(source?.section!=='arrows'||source.choices?.length!==2)
   fail('GTイベント区分・選択数の違い');
  for(let i=0;i<2;i++){
   const c=source.choices[i];
   if(!Array.isArray(c?.effects)||c.random_either===true||
      c.segments?.length||c.outcomes!==undefined||
      JSON.stringify(c.effects.map(row))!==JSON.stringify(spec.expected[i]))
    fail('元GT選択肢の数値・結果が改変されている '+spec.cardId);
  }
  const card=clone.cards.find(c=>c.cardId===spec.cardId);
  if(!card||clone.cards.filter(c=>c.cardId===spec.cardId).length!==1)
   fail('元スキルカードに同一IDがない');
  const candidate=card.events?.filter(e=>e.id===id);
  if(candidate?.length!==1||candidate[0].type!=='choice'||
     candidate[0].choices?.length!==2)
   fail('元のスキル用イベントと結果形状の違い '+id);
  const event=candidate[0],prior=structuredClone(event);
  for(let i=0;i<2;i++){
   const choice=event.choices[i];
   if(choice.id!=='choice-0'+(i+1)||choice.terminal===true||
      !Array.isArray(choice.rewards)||choice.rewards.length!==0||
      choice.outcomes!==undefined||choice.effects!==undefined||
      choice.statusEffects!==undefined||choice.dynamicEffects!==undefined)
    fail('選択肢のスキル構造が無報酬・分岐なしでない '+id);
  }
  const k=spec.rangeChoiceOrdinal-1,base=event.choices;
  for(let i=0;i<2;i++){
   const c=base[i],sourceEffects=source.choices[i].effects;
   if(i===k){
    delete c.rewards;
    c.outcomes=[0,1].map(tier=>({
     id:'range-tier-'+(tier+1),
     label:tier===0?'低側の結果':'高側の結果',
     rewards:[],
     effects:sourceEffects.map(e=>scalar(e,tier))
    }));
    const tierValue=c.outcomes.map(out=>out.effects.find(e=>e.kind===spec.rangeKind)?.delta);
    if(tierValue[0]!==spec.low||tierValue[1]!==spec.high)
     fail('低／高の元数値が不一致');
   }else c.effects=sourceEffects.map(e=>scalar(e,0));
  }
  // Preconditions, ids, names and other event records are immutable.
  if(event.id!==prior.id||event.name!==prior.name||
     JSON.stringify(event.requires)!==JSON.stringify(prior.requires)||
     JSON.stringify(event.availabilityKind)!==JSON.stringify(prior.availabilityKind)||
     card.events.length<1)
   fail('先行連続イベント条件・IDが変わった');
  const isolated={id:spec.cardId,events:[{...event,requires:undefined,
   availabilityKind:undefined}]};
  const choiceId='choice-0'+spec.rangeChoiceOrdinal;
  const open=core.directEffectRoutes(isolated,{choices:{[id]:choiceId}});
  const low=core.directEffectRoutes(isolated,{choices:{[id]:choiceId},
   outcomes:{[id]:'range-tier-1'}});
  const high=core.directEffectRoutes(isolated,{choices:{[id]:choiceId},
   outcomes:{[id]:'range-tier-2'}});
  const oldSkills=core.directRoutes({id:spec.cardId,events:[{...prior,requires:undefined,
   availabilityKind:undefined}]},{choices:{[id]:choiceId}});
  const newSkills=core.directRoutes(isolated,{choices:{[id]:choiceId}});
  if(open.length!==low.length+high.length||
     !open.every(x=>x.conditional===true)||
     low.some(x=>x.outcomeId!=='range-tier-1')||
     high.some(x=>x.outcomeId!=='range-tier-2')||
     low.length!==source.choices[k].effects.length||
     high.length!==source.choices[k].effects.length||
     JSON.stringify(oldSkills.map(x=>x.skillId))!==JSON.stringify(newSkills.map(x=>x.skillId))||
     core.directEffectRoutes(isolated,{choices:{},outcomes:{}}).length!==0)
   fail('結果別の排他性・スキル計算の不変性を破壊');
  const siblingIndex=1-k,otherId='choice-0'+(siblingIndex+1);
  const sibling=core.directEffectRoutes(isolated,{choices:{[id]:otherId}});
  if(sibling.length!==source.choices[siblingIndex].effects.length||
     sibling.some(x=>x.outcomeId!==undefined))
   fail('他のプレイヤー選択肢に結果分岐を混入');
  if(distinct.has(spec.cardId+'|'+id))fail('同じ元イベントを重複処理');
  distinct.add(spec.cardId+'|'+id);
  changed.push({cardId:spec.cardId,sourceOrdinal:spec.sourceOrdinal,
   rangeChoiceOrdinal:spec.rangeChoiceOrdinal,low:spec.low,high:spec.high,
   addedComponents:low.length+high.length+sibling.length,
   outcomeCount:2,sourceSkillRewardsAltered:false,
   chainConditionsAltered:false});
 }
 if(changed.length!==2)fail('対象2件の連動範囲を確認できない');
 return {catalog:clone,summary:{sourceRevision:POLICY.baselineRevision,
  eventsWithNumericTierOverlay:2,updatedCards:2,
  addedComponents:changed.reduce((n,r)=>n+r.addedComponents,0),
  twoResultChoices:2,otherChoiceResultsUnchanged:true,
  publicationApproved:false,changes:changed}};
}
module.exports={apply};
