/* Compile ONLY manually reviewed events; merely appearing in source is not approval. */
(function(g){
'use strict';
const auditApi=typeof module!=='undefined'&&module.exports
  ?require('./event_source_audit.js'):g.UmaEventSourceAudit;
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const fail=msg=>{throw new Error('イベント変換: '+msg)};
function buildReviewedCatalog({supports,eventsDocument,model,review}){
 if(!review||!Array.isArray(review.events)||!review.skillMap||typeof review.skillMap!=='object'||
    Array.isArray(review.skillMap))fail('明示的なレビュー済みイベント一覧とskillMapが必要');
 const report=auditApi.audit({supports,eventsDocument,model});
 const validIds=new Set(eventsDocument.events.map(e=>e.id));
 const available=new Map(eventsDocument.events.map(e=>[e.id,e]));
 const seen=new Set(),cards=new Map();
 const toReward=(raw,eventId)=>{
   if(!raw||!Number.isInteger(raw.skillId)||!Number.isInteger(raw.hintLevel))fail(eventId+': 未知の報酬形式');
   const key=String(raw.skillId);
   if(!own(review.skillMap,key))fail(eventId+': 対応が承認されていないスキルID '+key);
   const skillId=review.skillMap[key],target=model.skillById[skillId];
   if(!target)fail(eventId+': 辞書にない統合スキルID '+skillId);
   if(auditApi.normalize(target.name)!==auditApi.normalize(raw.skillName))
     fail(eventId+': スキル名が不一致 '+key);
   return {skillId,level:raw.hintLevel};
 };
 for(const p of review.events){
   if(!p||typeof p.sourceEventId!=='string'||!validIds.has(p.sourceEventId)||
      seen.has(p.sourceEventId)||p.chainVerified!==true)fail('未承認・重複・不存在のイベントが含まれます');
   seen.add(p.sourceEventId);
   const event=available.get(p.sourceEventId);
   const idMatch=/^evt_(\d{5})_/.exec(event.id);
   const cardId=idMatch?.[1];
   if(!cardId||cardId!==String(p.cardId)||report.perCard[cardId]?.matched!==true||
      report.issues.some(x=>x.eventId===event.id))
     fail('カードIDとイベントIDの照合が失敗: '+event.id);
   if(p.requires!==undefined&&
      (!p.requires||!Array.isArray(p.requires.all)))fail(event.id+': requires形式が不正');
   const converted={id:event.id,name:event.label,
     type:event.selection==='single'?'choice':'auto',
     ...(p.requires?{requires:p.requires}:{})};
   if(event.selection==='auto'){
     converted.rewards=event.skills.map(raw=>toReward(raw,event.id));
     if(p.terminalChoiceIds!==undefined)fail(event.id+': autoにterminalChoiceIdsは使えない');
   }else if(event.selection==='single'){
     const terminals=new Set(p.terminalChoiceIds||[]);
     if(!Array.isArray(p.terminalChoiceIds||[])||
        (p.terminalChoiceIds||[]).length!==terminals.size||
        [...terminals].some(id=>!event.choices.some(c=>c.id===id)))
       fail(event.id+': 未知または重複した打ち切り選択肢');
     converted.choices=event.choices.map(c=>({id:c.id,label:c.label,
       ...(terminals.has(c.id)?{terminal:true}:{}),
       rewards:c.skills.map(raw=>toReward(raw,event.id))}));
     // Source defaultChoiceId is a UI preference, NOT a user-selected route.
   }else fail(event.id+': 非対応イベント形式');
   const collection=cards.get(cardId)||[];
   collection.push(converted);cards.set(cardId,collection);
 }
 const catalog={schemaVersion:1,cards:[...cards].map(([cardId,events])=>({
   cardId,coverageStatus:'partial',events
 }))};
 const coverage=schema.validateCatalog(catalog,model);
 return {catalog,coverage};
}
const api={buildReviewedCatalog};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaEventReviewCompiler=api;
})(typeof globalThis!=='undefined'?globalThis:this);
