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
   if(id(r.eventId)&&Object.keys(r).every(k=>['eventId','choiceId','outcomeId'].includes(k)))return [r]; // old artificial fixtures
   fail(e.id+': requiresは{all:[...]}で指定する');
 }
 const effectKinds=new Set(['speed','stamina','power','guts','wisdom',
   'energy','max_energy','mood','bond','skill_points','aptitude_points']);
 function checkEffects(effects,where){
   if(effects===undefined)return;
   if(!Array.isArray(effects)||effects.length===0)
     fail(where+': 非スキル効果は1件以上必要');
   const seen=new Set();
   for(const e of effects){
     if(!obj(e)||!effectKinds.has(e.kind)||
        !Number.isSafeInteger(e.delta)||e.delta===0||
        e.recipientCharId!==undefined&&(!Number.isSafeInteger(e.recipientCharId)||e.recipientCharId<=0)||
        e.sourceBundle!==undefined&&
          (e.sourceBundle!=='all_stats'||!['speed','stamina','power','guts','wisdom'].includes(e.kind))||
        e.sourceComponent!==undefined&&
          !['event-result','scenario-bonus'].includes(e.sourceComponent)||
        Object.keys(e).some(k=>!['kind','delta','sourceComponent','recipientCharId','sourceBundle'].includes(k)))
       fail(where+': 非スキル効果の種類・整数値・出典成分が不正');
     const key=e.kind+'|'+(e.sourceComponent||'')+'|'+(e.recipientCharId??'');
     if(seen.has(key))fail(where+': 同じ出典成分の効果を二重計上');
     seen.add(key);
   }
 }

 // Non-scalar condition operations are NOT stat deltas and may be guarded
 // by source-specific chance, existing state, or source implementation rules.
 // Even an explicit branch must not promise that the operation fires.
 function checkStatusEffects(statusEffects,where){
   if(statusEffects===undefined)return;
   if(!Array.isArray(statusEffects)||statusEffects.length===0)
     fail(where+': 状態操作候補は1件以上必要');
   const seen=new Set();
   for(const x of statusEffects){
     if(!obj(x)||!['add-condition','cure-one-bad'].includes(x.kind)||
        x.possible!==true||
        x.kind==='add-condition'&&
          (!Number.isSafeInteger(x.conditionId)||x.conditionId<=0)||
        x.kind==='cure-one-bad'&&x.conditionId!==undefined||
        x.chance!==undefined&&
          (typeof x.chance!=='number'||!Number.isFinite(x.chance)||
           x.chance<=0||x.chance>1)||
        Object.keys(x).some(k=>!['kind','conditionId','possible','chance'].includes(k)))
       fail(where+': 状態操作の種類・状態ID・任意確率が不正');
     const key=x.kind+'|'+(x.conditionId??'');
     if(seen.has(key))fail(where+': 状態操作の同一対象が重複');
     seen.add(key);
   }
 }
 function checkRewards(part,model,where){
   checkEffects(part.effects,where);
   checkStatusEffects(part.statusEffects,where);
   // Editorial pending rewards must NEVER enter published/runtime catalogs.
   if(part.unresolvedRewards!==undefined)fail(where+': 未照合報酬は公開イベントに登録できません');
   // A verified result tree is exclusive: alongside unconditional rewards,
   // the same skills could be falsely counted as guaranteed and conditional.
   // Shared rewards must be placed explicitly in each reviewed outcome.
   if((part.rewards!==undefined||part.effects!==undefined||
        part.statusEffects!==undefined)&&part.outcomes!==undefined)
     fail(where+': rewardsとoutcomesは同時指定できません');
   if(part.rewards!==undefined){
     if(!Array.isArray(part.rewards))fail(where+': rewardsが不正');
     for(const r of part.rewards){
       if(!obj(r)||!id(r.skillId)||!own(model.skillById,r.skillId))fail(where+': 未収録スキルID');
       // Omitted kind means a hint; a direct award has no hint level.
       if(r.kind!==undefined&&!['hint','obtained','negative'].includes(r.kind))
         fail(where+': 報酬種別が不正');
       if(['obtained','negative'].includes(r.kind)&&r.level!==undefined)
         fail(where+': 直接習得・マイナススキル付与にはヒントLvを設定できません');
       if(r.level!==undefined&&(!Number.isInteger(r.level)||r.level<1))
         fail(where+': ヒントLvが不正');
       if(r.condition!==undefined&&r.condition!==null&&!id(r.condition))fail(where+': 条件が不正');
     }
   }
   if(part.outcomes!==undefined){
     if(!Array.isArray(part.outcomes)||part.outcomes.length<2)fail(where+': outcomesは2種類以上必要');
     const seen=new Set();
     for(const out of part.outcomes){
       if(!obj(out)||!id(out.id)||!id(out.label)||seen.has(out.id)||
          (out.rewards===undefined&&out.effects===undefined&&out.statusEffects===undefined)||
          (out.rewards!==undefined&&!Array.isArray(out.rewards))||
          out.terminal!==undefined&&typeof out.terminal!=='boolean')fail(where+': 結果が不正');
       seen.add(out.id);
       checkRewards({rewards:out.rewards,effects:out.effects,
          statusEffects:out.statusEffects},model,where+'/'+out.id);
     }
   }
 }
 function validateEvents(events,model,cardId){
   if(!Array.isArray(events))fail(cardId+': eventsは配列');
   const byId=new Map();
   for(const e of events){
     if(!obj(e)||!id(e.id)||!id(e.name)||!['auto','choice'].includes(e.type)||byId.has(e.id))fail(cardId+': イベントID・形式が不正または重複');
     // Availability is distinct from prior event choices/results: trigger
     // types must not appear as unconditional guaranteed skill paths.
     if(e.availabilityKind!==undefined&&
        !['special-trigger','outing-sequence','outing-random',
          'scenario-overseas'].includes(e.availabilityKind))
       fail(e.id+': 特殊イベント発生条件が不正');
     byId.set(e.id,e);
     if(e.type==='choice'){
       if(e.rewards!==undefined||e.effects!==undefined||e.statusEffects!==undefined||
           e.outcomes!==undefined||!Array.isArray(e.choices)||e.choices.length===0)fail(e.id+': 選択式の構造が不正');
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
   function validateRequirement(r,e){
     if(!obj(r)||!id(r.eventId)||r.choiceId!==undefined&&!id(r.choiceId)||
        r.outcomeId!==undefined&&!id(r.outcomeId)||
        Object.keys(r).some(k=>!['eventId','choiceId','outcomeId'].includes(k)))
       fail(e.id+': 到達条件が不正');
     const parent=byId.get(r.eventId);
     if(!parent)fail(e.id+': 親イベントが未登録');
     let parts;
     if(parent.type==='choice'){
       if(r.choiceId===undefined){
         if(r.outcomeId!==undefined)fail(e.id+': 選択式の結果条件にはchoiceIdが必要');
         parts=parent.choices.filter(c=>c.terminal!==true);
         if(!parts.length)fail(e.id+': 全分岐打ち切りの親からは継続できません');
       }else{
         const picked=parent.choices.find(c=>c.id===r.choiceId);
         if(!picked)fail(e.id+': 親選択肢が未登録');
         if(picked.terminal)fail(e.id+': 打ち切りルートに後続イベント');
         parts=[picked];
       }
     }else{
       if(r.choiceId!==undefined)fail(e.id+': autoイベントにchoiceIdが指定されている');
       parts=[parent];
     }
     if(r.outcomeId!==undefined){
       const found=parts[0].outcomes?.find(o=>o.id===r.outcomeId);
       if(!found)fail(e.id+': 到達条件が不正（親結果IDが未登録）');
       if(found.terminal)fail(e.id+': 打ち切り結果に後続イベント');
     }else if(parts.every(p=>p.outcomes?.length&&p.outcomes.every(o=>o.terminal===true))){
       fail(e.id+': 全結果打ち切りの親からは継続できません');
     }
   }
   // Multiple prerequisites are AND-ed. Requiring two exclusive choices or
   // outcomes from the same event would create a phantom reachable route.
   function checkCompatible(requirements,where){
     const constraints=new Map();
     for(const r of requirements){
       const previous=constraints.get(r.eventId);
       if(previous){
         if(previous.choiceId!==undefined&&r.choiceId!==undefined&&previous.choiceId!==r.choiceId||
            previous.outcomeId!==undefined&&r.outcomeId!==undefined&&previous.outcomeId!==r.outcomeId)
           fail(where+': 同じ前段から両立しない選択肢・結果を同時指定できません');
         if(previous.choiceId===undefined&&r.choiceId!==undefined)previous.choiceId=r.choiceId;
         if(previous.outcomeId===undefined&&r.outcomeId!==undefined)previous.outcomeId=r.outcomeId;
       }else constraints.set(r.eventId,{choiceId:r.choiceId,outcomeId:r.outcomeId});
     }
   }
   // Individual result rewards can depend on several preceding result states.
   // This is DNF: at least one "all" clause must hold. Each clause is
   // validated independently because mutually exclusive results can be ORed.
   function outcomeClauses(out,where){
     if(out.requires===undefined)return [];
     const gate=out.requires;
     if(!obj(gate)||Object.keys(gate).length!==1||!Array.isArray(gate.any)||
        gate.any.length<1)fail(where+': 結果の条件は{any:[{all:[...]}]}');
     const clauses=[],seen=new Set();
     for(const clause of gate.any){
       if(!obj(clause)||Object.keys(clause).length!==1||!Array.isArray(clause.all)||
          clause.all.length===0)fail(where+': 結果条件のOR要素が不正');
       const key=JSON.stringify(clause.all);
       if(seen.has(key))fail(where+': 重複する結果条件');
       seen.add(key);checkCompatible(clause.all,where);
       clauses.push(clause.all);
     }
     return clauses;
   }
   for(const e of events){
     checkCompatible(prerequisites(e),e.id);
     for(const r of prerequisites(e))validateRequirement(r,e);
     if(e.type==='choice')for(const c of e.choices){
       checkCompatible(prerequisites(c),e.id+'/'+c.id);
       for(const r of prerequisites(c)){
         if(r.eventId===e.id)fail(e.id+'/'+c.id+': 選択肢の依存が自己参照');
         validateRequirement(r,e);
       }
     }
   }
   for(const e of events){
     const parts=e.type==='auto'?[e]:e.choices;
     for(const part of parts)for(const out of part.outcomes||[]){
       for(const clause of outcomeClauses(out,e.id+'/'+(part.id||'auto')+'/'+out.id))
        for(const r of clause){
          if(r.eventId===e.id)fail(e.id+': 結果条件が自己参照');
          validateRequirement(r,e);
        }
     }
   }
   const visiting=new Set(),done=new Set();
   function visit(e){
     if(visiting.has(e.id))fail(e.id+': 到達条件が循環');
     if(done.has(e.id))return;
     visiting.add(e.id);
     for(const r of prerequisites(e))visit(byId.get(r.eventId));
     if(e.type==='choice')for(const c of e.choices)
       for(const r of prerequisites(c))visit(byId.get(r.eventId));
     for(const part of e.type==='auto'?[e]:e.choices)
       for(const out of part.outcomes||[])
         for(const clause of outcomeClauses(out,e.id+'/'+out.id))
           for(const r of clause)visit(byId.get(r.eventId));
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
