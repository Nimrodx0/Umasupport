'use strict';
/*
 * Narrow, pinned source-fact correction for GT SSR30028 arrow event 4.
 * Its second player choice has ONE correlated binary draw:
 * speed +5/+10 is coupled to skill hint 200362 level +1/+3.
 * Never infer that a sibling skill_hint_or is an equivalent draw.
 * Private 2512 catalog only, with no copied game narrative.
 */
const crypto=require('node:crypto');
const core=require('./core.js');
const {numeric}=require('./phase2_gt_correlated_numeric_range.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('GT連動範囲スキル同時結果照合: '+s);};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const permitted=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points']);
function scalar(e){
 if(!permitted.has(e?.type)||Object.keys(e).some(k=>!['type','value','char_id'].includes(k)))fail('元数値の不明な種別');
 const n=numeric(e.value);
 if(!n)fail('元数値が不正');
 if(e.char_id!==undefined&&(e.type!=='bond'||e.char_id!==1068))fail('元絆の受け手相違');
 return n.map(v=>({kind:e.type,delta:v,...(e.char_id?{recipientCharId:e.char_id}:{})}));
}
function enrich({catalog,documents,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !Array.isArray(documents)||review?.dataKind!=='phase2-gt-correlated-numeric-range-review'||
    review.sourcePin!==POLICY.baselineRevision||
    review.publicationApproved!==false||
    review.automaticRuntimeAdoption!==false)fail('非公開・固定元の条件違反');
 const range=review.rows.filter(x=>x.cardId==='30028'&&
  x.sourceOrdinal===4&&x.choiceOrdinal===2);
 if(range.length!==1||range[0].canProjectNumericTiers!==true||
    range[0].sourceRangeEffectCount!==2)fail('元GTの2段階選択肢が異なる');
 const doc=documents.filter(d=>d.id===30028);
 if(doc.length!==1||doc[0].kind!=='support')fail('元GTカード数違反');
 const events=Object.values(doc[0].events_ja||doc[0].events);
 const source=events[3];
 if(source?.section!=='arrows'||source.choices?.length!==2)fail('元GTイベントの形状違い');
 const [c1,c2]=source.choices;
 if(c1.random_either||c2.random_either||c1.segments?.length||c2.segments?.length||
    !Array.isArray(c1.effects)||!Array.isArray(c2.effects)||
    c1.outcomes||c2.outcomes)fail('元GTが既に分岐済み');
 // Scope this exceptional fix to independently checked source effects and IDs.
 if(JSON.stringify(c1.effects.map(e=>[e.type,e.value,e.char_id??null]))!==
      JSON.stringify([['energy','+10',null],['mood','+1',null],['bond','+5',1068]])||
    JSON.stringify(c2.effects.map(e=>[e.type,e.value,e.char_id??null,e.skill_id??null]))!==
      JSON.stringify([['speed','+5/+10',null,null],
       ['skill_hint','+1/+3',null,200362],['bond','+5',1068,null]]))
  fail('元GTの能力・スキルLv相関に差異');
 const match=catalog.cards.filter(c=>c.cardId==='30028');
 if(match.length!==1)fail('非公開2,512に対象カード不在');
 const current=match[0].events?.filter(e=>e.id==='gt-30028-event-004');
 if(current?.length!==1||current[0].type!=='choice'||current[0].choices?.length!==2)
  fail('既存スキル候補の出典位置・選択数に不一致');
 const event=current[0],skillFirst=event.choices[0],skillSecond=event.choices[1];
 if(skillFirst.id!=='choice-01'||skillSecond.id!=='choice-02'||
    skillFirst.effects!==undefined||skillSecond.effects!==undefined||
    skillFirst.statusEffects!==undefined||skillSecond.statusEffects!==undefined||
    skillFirst.dynamicEffects!==undefined||skillSecond.dynamicEffects!==undefined||
    skillFirst.outcomes!==undefined||skillSecond.outcomes?.length!==2||
    skillSecond.outcomes.some((o,i)=>
     o.id!=='route-01-or-'+(i+1)||o.terminal===true||
     o.effects!==undefined||o.statusEffects!==undefined||o.dynamicEffects!==undefined||
     o.rewards?.length!==1||o.rewards[0].skillId!=='skill:200362'||
     o.rewards[0].level!==[1,3][i]))
  fail('元と既存スキルの2結果（ヒントLv1/3）が一致しない');
 const before=hash(catalog.cards.map(c=>({
  cardId:c.cardId,events:c.events?.map(e=>({
   id:e.id,sk:e.type==='auto'?e.rewards:e.choices?.map(ch=>
    [ch.id,ch.rewards,ch.outcomes?.map(o=>[o.id,o.rewards])])}))})));
 const copy=structuredClone(catalog),target=copy.cards.find(c=>c.cardId==='30028')
  .events.find(e=>e.id==='gt-30028-event-004');
 target.choices[0].effects=c1.effects.map(x=>scalar(x)[0]);
 target.choices[1].outcomes.forEach((out,i)=>{
  const a=scalar(c2.effects[0])[i],b=scalar(c2.effects[2])[i];
  out.effects=[a,b];
 });
 const after=hash(copy.cards.map(c=>({
  cardId:c.cardId,events:c.events?.map(e=>({
   id:e.id,sk:e.type==='auto'?e.rewards:e.choices?.map(ch=>
    [ch.id,ch.rewards,ch.outcomes?.map(o=>[o.id,o.rewards])])}))})));
 if(before!==after)fail('スキル報酬の出典条件が変化');
 const beforeCard=match[0],afterCard=copy.cards.find(c=>c.cardId==='30028');
 const chooses={choices:{[event.id]:'choice-02'},outcomes:{}};
 // Isolate this effect leaf for the outcome-correlation proof. The real
 // card may have a preceding chain stage not selected in this static check;
 // a missing predecessor must not be confused with mismatched result tiers.
 const isolated={id:'30028',events:[{...target,requires:undefined,
  availabilityKind:undefined}]};
 const low=core.directEffectRoutes(isolated,{
  ...chooses,outcomes:{[event.id]:'route-01-or-1'}});
 const high=core.directEffectRoutes(isolated,{
  ...chooses,outcomes:{[event.id]:'route-01-or-2'}});
 if(low.length!==2||high.length!==2||
    low[0].delta!==5||high[0].delta!==10||
    low[1].delta!==5||high[1].delta!==5||
    core.directEffectRoutes({...afterCard,id:'30028'},{choices:{},outcomes:{}})
      .some(x=>x.delta===5||x.delta===10)||
    core.directRoutes({...beforeCard,id:'30028'},chooses).length!==
      core.directRoutes({...afterCard,id:'30028'},chooses).length)
  fail('非公開アプリの連動分岐に位置ずれ '+JSON.stringify({
   low:low.map(x=>[x.effectKind,x.delta]),high:high.map(x=>[x.effectKind,x.delta]),
   unselected:core.directEffectRoutes(isolated,{choices:{},outcomes:{}}).length,
   beforeSkill:core.directRoutes({...beforeCard,id:'30028'},chooses).length,
   afterSkill:core.directRoutes({...afterCard,id:'30028'},chooses).length
  }));
 return {catalog:copy,summary:{
  cardId:'30028',sourceOrdinal:4,choiceOrdinal:2,
  linkedHintNumericId:'200362',linkedHintTiers:[1,3],
  linkedStatTiers:[5,10],privateEffectEventAdded:1,
  attachedComponents:7,correlatedResultCount:2,
  skillRouteIdentityPreserved:true,publicationApproved:false}};
}
module.exports={enrich};
