/* Event catalog validation, separate from any third-party source or its license. */
(function(g){
 'use strict';
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const id=x=>typeof x==='string'&&x.length>0;
 const fail=m=>{throw new Error('イベント検証: '+m);};
 function prerequisites(e){
   if(!e.requires)return [];
   const r=e.requires;
   if(!obj(r))fail(e.id+': requiresが不正');
   if(Array.isArray(r.all)&&Object.keys(r).length===1)return r.all;
   if(id(r.eventId)&&Object.keys(r).every(k=>['eventId','choiceId'].includes(k)))return [r]; // old artificial fixtures
   fail(e.id+': requiresは{all:[...]}で指定する');
 }
 function checkRewards(part,model,where){
   // Editorial pending rewards must NEVER enter published/runtime catalogs.
   if(part.unresolvedRewards!==undefined)fail(where+': 未照合報酬は公開イベントに登録できません');
   // A verified result tree is exclusive: alongside unconditional rewards,
   // the same skills could be falsely counted as guaranteed and conditional.
   // Shared rewards must be placed explicitly in each reviewed outcome.
   if(part.rewards!==undefined&&part.outcomes!==undefined)
     fail(where+': rewardsとoutcomesは同時指定できません');
   if(part.rewards!==undefined){
     if(!Array.isArray(part.rewards))fail(where+': rewardsが不正');
     for(const r of part.rewards){
       if(!obj(r)||!id(r.skillId)||!own(model.skillById,r.skillId))fail(where+': 未収録スキルID');
       if(r.level!==undefined&&(!Number.isInteger(r.level)||r.level<1))fail(where+': ヒントLvが不正');
       if(r.condition!==undefined&&r.condition!==null&&!id(r.condition))fail(where+': 条件が不正');
     }
   }
   if(part.outcomes!==undefined){
     if(!Array.isArray(part.outcomes)||part.outcomes.length<2)fail(where+': outcomesは2種類以上必要');
     const seen=new Set();
     for(const out of part.outcomes){
       if(!obj(out)||!id(out.id)||!id(out.label)||seen.has(out.id)||!Array.isArray(out.rewards))fail(where+': 結果が不正');
       seen.add(out.id);
       checkRewards({rewards:out.rewards},model,where+'/'+out.id);
     }
   }
 }
 function validateEvents(events,model,cardId){
   if(!Array.isArray(events))fail(cardId+': eventsは配列');
   const byId=new Map();
   for(const e of events){
     if(!obj(e)||!id(e.id)||!id(e.name)||!['auto','choice'].includes(e.type)||byId.has(e.id))fail(cardId+': イベントID・形式が不正または重複');
     byId.set(e.id,e);
     if(e.type==='choice'){
       if(e.rewards!==undefined||e.outcomes!==undefined||!Array.isArray(e.choices)||e.choices.length===0)fail(e.id+': 選択式の構造が不正');
       const used=new Set();
       for(const c of e.choices){
         if(!obj(c)||!id(c.id)||!id(c.label)||used.has(c.id)||c.terminal!==undefined&&typeof c.terminal!=='boolean')fail(e.id+': 選択肢が不正・重複');
         used.add(c.id);
         checkRewards(c,model,e.id+'/'+c.id);
       }
     }else{
       if(e.choices!==undefined)fail(e.id+': 自動イベントに選択肢はない');
       checkRewards(e,model,e.id);
     }
   }
   for(const e of events){
     for(const r of prerequisites(e)){
       if(!obj(r)||!id(r.eventId)||r.choiceId!==undefined&&!id(r.choiceId)||r.outcomeId!==undefined||Object.keys(r).some(k=>!['eventId','choiceId'].includes(k)))
         fail(e.id+': 到達条件が不正（結果分岐の依存は未対応）');
       const parent=byId.get(r.eventId);
       if(!parent)fail(e.id+': 親イベントが未登録');
       if(parent.type==='choice'){
         // No choiceId means any *selected non-terminal* choice can advance.
         // The runtime reachability evaluator independently requires a selection.
         if(r.choiceId===undefined){
           if(parent.choices.every(c=>c.terminal===true))fail(e.id+': 全分岐打ち切りの親からは継続できません');
         }else{
           const picked=parent.choices.find(c=>c.id===r.choiceId);
           if(!picked)fail(e.id+': 親選択肢が未登録');
           if(picked.terminal)fail(e.id+': 打ち切りルートに後続イベント');
         }
       }else if(r.choiceId!==undefined)fail(e.id+': autoイベントにchoiceIdが指定されている');
     }
   }
   const visiting=new Set(),done=new Set();
   function visit(e){
     if(visiting.has(e.id))fail(e.id+': 到達条件が循環');
     if(done.has(e.id))return;
     visiting.add(e.id);
     for(const r of prerequisites(e))visit(byId.get(r.eventId));
     visiting.delete(e.id);done.add(e.id);
   }
   for(const e of events)visit(e);
 }
 function validateCatalog(catalog,model){
   if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))fail('スキーマバージョンが不正');
   if(!obj(model)||!Array.isArray(model.cards)||!obj(model.cardById)||!obj(model.skillById))fail('照合用モデルが不正');
   const seen=new Set(),perCard={};
   let eventsWithRecords=0;
   for(const entry of catalog.cards){
     if(!obj(entry)||!id(entry.cardId)||seen.has(entry.cardId))fail('カードIDが不正または重複');
     seen.add(entry.cardId);
     if(!own(model.cardById,entry.cardId))fail('実カードIDが未照合: '+entry.cardId);
     validateEvents(entry.events,model,entry.cardId);
     const status=entry.coverageStatus||'partial';
     if(!['partial','complete'].includes(status))fail('収録状態が不正: '+entry.cardId);
     perCard[entry.cardId]={eventCount:entry.events.length,coverageStatus:status};
     eventsWithRecords+=entry.events.length;
   }
   // Number of records in the input, NOT verified coverage of the real game.
   return {totalModelCards:model.cards.length,cardsWithRecords:catalog.cards.length,eventsWithRecords,perCard};
 }
 const api={prerequisites,validateEvents,validateCatalog};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 g.UmaEventSchema=api;
})(typeof globalThis!=='undefined'?globalThis:this);
