'use strict';
/* Narrow unpublished correction: linked low/high numeric-only outcomes.
 * GT event_engine splits slash effects together, not independently.
 * DO NOT map a separate choice or a skill_hint_or to this random outcome.
 */
const {numeric}=require('./phase2_gt_correlated_numeric_range.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const core=require('./core.js');
const fail=x=>{throw Error('GT数値限定連動結果: '+x);};
const plans=[
 {cardId:'30030',ordinal:3,choiceOrdinal:2,recipient:1062,
  ranges:[['energy','+10/+30'],['bond','+5']],
  siblings:[['mood','+1'],['bond','+5']]},
 {cardId:'30041',ordinal:3,choiceOrdinal:1,recipient:1059,
  ranges:[['energy','-10'],['skill_points','+15/+45'],['bond','+5']],
  siblings:[['guts','+5'],['wisdom','+5'],['bond','+5']]}
];
function enrich({catalog,documents,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !Array.isArray(documents)||review?.dataKind!=='phase2-gt-correlated-numeric-range-review'||
    review.sourcePin!==POLICY.baselineRevision||
    review.automaticRuntimeAdoption!==false||review.publicationApproved!==false)
  fail('出典版または非公開契約が違う');
 const copy=structuredClone(catalog),seen=new Set(),deltas=[];
 for(const plan of plans){
  const key=plan.cardId+':'+plan.ordinal+':'+plan.choiceOrdinal;
  const indexRows=review.rows.filter(r=>[r.cardId,r.sourceOrdinal,r.choiceOrdinal].join(':')===key);
  if(indexRows.length!==1||!indexRows[0].canProjectNumericTiers||
     indexRows[0].sourceRangeEffectCount!==1)
   fail(key+' 固定範囲を特定できない');
  const docs=documents.filter(d=>String(d.id)===plan.cardId&&d.kind==='support');
  if(docs.length!==1)fail(key+' 元サポカがない');
  const source=Object.values(docs[0].events_ja||docs[0].events)[plan.ordinal-1];
  if(source?.section!=='arrows'||source.choices?.length!==2)
   fail(key+' 連続イベントの選択肢数が違う');
  const eventId='gt-'+plan.cardId+'-event-'+String(plan.ordinal).padStart(3,'0');
  const cards=copy.cards.filter(c=>c.cardId===plan.cardId);
  if(cards.length!==1)fail(key+' 非公開サポカがない');
  const found=cards[0].events.filter(e=>e.id===eventId);
  if(found.length!==1||found[0].type!=='choice'||found[0].choices?.length!==2)
   fail(key+' 非公開イベントの選択肢数が違う');
  const event=found[0];
  if(copy.cards.some(c=>(c.events||[]).some(e=>e.requires?.all?.some(p=>
       p.eventId===eventId&&(p.choiceId||p.outcomeId)))))
   fail(key+' 選択／結果別の後続条件がある');
  const targeted=source.choices[plan.choiceOrdinal-1],
   sibling=source.choices[plan.choiceOrdinal===1?1:0];
  for(const ch of [targeted,sibling])
   if(!Array.isArray(ch.effects)||ch.random_either||ch.outcomes||
      ch.segments?.length||ch.effects.some(x=>
       !['energy','skill_points','guts','wisdom','mood','bond'].includes(x.type)||
       x.char_id!==undefined&&(x.type!=='bond'||x.char_id!==plan.recipient)||
       Object.keys(x).some(k=>!['type','value','char_id'].includes(k))))
    fail(key+' 元選択肢が別の枝・報酬を持つ');
  const fingerprint=ch=>ch.effects.map(e=>[e.type,e.value]);
  if(JSON.stringify(fingerprint(targeted))!==JSON.stringify(plan.ranges)||
     JSON.stringify(fingerprint(sibling))!==JSON.stringify(plan.siblings))
   fail(key+' 元数値と結果段階が一致しない');
  const dest=event.choices[plan.choiceOrdinal-1],
   other=event.choices[plan.choiceOrdinal===1?1:0];
  if(dest.id!=='choice-'+String(plan.choiceOrdinal).padStart(2,'0')||
     other.id!=='choice-'+String(plan.choiceOrdinal===1?2:1).padStart(2,'0')||
     dest.outcomes||dest.terminal||dest.effects||dest.statusEffects||
     dest.dynamicEffects||other.outcomes||other.effects||
     other.statusEffects||other.dynamicEffects||
     (dest.rewards?.length||0)!==0||(other.rewards?.length||0)!==0)
   fail(key+' スキル側の元結果が平坦でない');
  const convert=(effects,tier)=>effects.map(e=>({
   kind:e.type,delta:numeric(e.value)[tier],
   ...(e.char_id?{recipientCharId:e.char_id}:{})
  }));
  other.effects=convert(sibling.effects,0);
  dest.outcomes=[0,1].map(tier=>({
   id:'range-tier-'+(tier+1),label:'結果'+(tier+1)+'（非公開）',
   rewards:[],effects:convert(targeted.effects,tier)
  }));
  const isolated={id:plan.cardId,events:[{...event,requires:undefined}]};
  const selected=(tier)=>core.directEffectRoutes(isolated,{
   choices:{[event.id]:dest.id},
   outcomes:{[event.id]:'range-tier-'+(tier+1)}});
  const low=selected(0),high=selected(1);
  if(low.length!==plan.ranges.length||high.length!==plan.ranges.length||
     low.some((x,i)=>x.delta!==numeric(plan.ranges[i][1])[0])||
     high.some((x,i)=>x.delta!==numeric(plan.ranges[i][1])[1])||
     core.directEffectRoutes(isolated,{choices:{},outcomes:{}}).length)
   fail(key+' 数値の低高が他の結果へ漏れた');
  deltas.push({cardId:plan.cardId,sourceOrdinal:plan.ordinal,
   choiceOrdinal:plan.choiceOrdinal,low:low.map(x=>x.delta),
   high:high.map(x=>x.delta),siblingEffects:other.effects.length});
  seen.add(key);
 }
 if(seen.size!==2)fail('固定2イベントの追加数が違う');
 return {catalog:copy,summary:{newCorrelatedChoiceEvents:2,
  newCorrelatedResultLeaves:4,addedNumericComponents:15,
  sourceContexts: deltas,publicationApproved:false}};
}
module.exports={enrich};
