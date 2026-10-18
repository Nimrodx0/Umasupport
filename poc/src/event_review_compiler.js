/* Compile ONLY manually reviewed events; merely appearing in source is not approval. */
(function(g){
'use strict';
const auditApi=typeof module!=='undefined'&&module.exports
  ?require('./event_source_audit.js'):g.UmaEventSourceAudit;
const schema=typeof module!=='undefined'&&module.exports
  ?require('./event_schema.js'):g.UmaEventSchema;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
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
      seen.has(p.sourceEventId)||p.chainVerified!==true||p.rewardSemanticsVerified!==true||
      p.selectionSemanticsVerified!==true||p.publicationReviewed!==true)
     fail('未承認・重複・不存在のイベントが含まれます');
   seen.add(p.sourceEventId);
   const event=available.get(p.sourceEventId);
   const idMatch=/^evt_(\d{5})_/.exec(event.id);
   const cardId=idMatch?.[1];
   if(!cardId||cardId!==String(p.cardId)||report.perCard[cardId]?.matched!==true||
      report.issues.some(x=>x.eventId===event.id))
     fail('カードIDとイベントIDの照合が失敗: '+event.id);
   if(p.requires!==undefined&&
      (!p.requires||!Array.isArray(p.requires.all)))fail(event.id+': requires形式が不正');
   // An event may grant a reward only upon success/failure; source JSON does not encode that distinction.
 // The reviewer must separately confirm reward semantics and prerequisites.
 const converted={id:event.id,name:event.label,
     type:event.selection==='single'?'choice':'auto',
     ...(p.requires?{requires:p.requires}:{})};
   if(event.selection==='auto'){
     if(p.choiceOutcomeReviews!==undefined)
       fail(event.id+': 選択肢のない候補への結果分岐指定はできません');
     converted.rewards=event.skills.map(raw=>toReward(raw,event.id));
     if(p.terminalChoiceIds!==undefined)fail(event.id+': autoにterminalChoiceIdsは使えない');
   }else if(event.selection==='single'){
     const terminals=new Set(p.terminalChoiceIds||[]);
     if(!Array.isArray(p.terminalChoiceIds||[])||
        (p.terminalChoiceIds||[]).length!==terminals.size||
        [...terminals].some(id=>!event.choices.some(c=>c.id===id)))
       fail(event.id+': 未知または重複した打ち切り選択肢');
     // Optional independently reviewed result trees replace the source's
     // flattened per-choice skill rewards. They are never silently combined.
     const reviews=p.choiceOutcomeReviews;
     if(reviews!==undefined){
       if(!obj(reviews)||Object.keys(reviews).length!==event.choices.length||
          event.choices.some(c=>!own(reviews,c.id))||
          Object.keys(reviews).some(id=>!event.choices.some(c=>c.id===id)))
         fail(event.id+': 全選択肢の結果分岐レビューが必要');
     }
     converted.choices=event.choices.map(c=>{
       const convertedChoice={id:c.id,label:c.label,
         ...(terminals.has(c.id)?{terminal:true}:{})};
       if(reviews===undefined){
         convertedChoice.rewards=c.skills.map(raw=>toReward(raw,event.id));
       }else{
         const outcomes=reviews[c.id];
         if(!Array.isArray(outcomes)||outcomes.length<2)
           fail(event.id+'/'+c.id+': 2つ以上の結果分岐が必要');
         const usedResults=new Set();
         convertedChoice.outcomes=outcomes.map(result=>{
           if(!obj(result)||!nonempty(result.id)||!nonempty(result.label)||
              usedResults.has(result.id)||!Array.isArray(result.skills))
             fail(event.id+'/'+c.id+': 重複または不正な結果分岐');
           usedResults.add(result.id);
           return {id:result.id,label:result.label,
             rewards:result.skills.map(raw=>toReward(raw,event.id))};
         });
       }
       return convertedChoice;
     });
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
