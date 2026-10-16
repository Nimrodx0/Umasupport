/* Audit third-party event metadata without importing unreviewed rewards into the live app. */
(function(g){
'use strict';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const numericId=x=>typeof x==='number'&&Number.isInteger(x)&&x>0||typeof x==='string'&&/^\d+$/.test(x);
const ID_RE=/^evt_(\d{5})_(.+)$/;
const validText=x=>typeof x==='string'&&x.trim().length>0;
function audit({supports,eventsDocument,model}){
 if(!Array.isArray(supports)||!obj(eventsDocument)||!Array.isArray(eventsDocument.events)||
    !obj(model)||!Array.isArray(model.cards)||!obj(model.cardById)||!obj(model.skillById))
   throw new Error('監査対象のJSON構造またはUmaSimモデルが不正です');
 const supported=new Map(),cards=new Map(),issues=[],seenEvents=new Set(),skills=new Map();
 for(const s of supports){
   if(!obj(s)||!numericId(s.id)||!validText(s.name))throw new Error('supports.json に不正なサポカ定義があります');
   const id=String(s.id);
   if(supported.has(id))throw new Error('supports.json に重複サポカID: '+id);
   const current=model.cardById[id];
   let reason=current?normalize(current.name)===normalize(s.name)?null:'card-name-mismatch':'card-id-missing';
   supported.set(id,{sourceId:id,name:s.name,matched:!reason,reason});
   if(reason)issues.push({kind:reason,cardId:id});
 }
 for(const event of eventsDocument.events){
   if(!obj(event)||!validText(event.id)||seenEvents.has(event.id)){
     issues.push({kind:'invalid-or-duplicate-event-id',eventId:obj(event)?event.id:null});continue;
   }
   seenEvents.add(event.id);
   const match=ID_RE.exec(event.id);
   const cardId=match?match[1]:null;
   let reason=!cardId?'non-numeric-event-id':
     !supported.has(cardId)?'event-support-not-listed':
     !supported.get(cardId).matched?'event-support-unmatched':null;
   if(!reason&&(event.selection!=='single'&&event.selection!=='auto'))reason='unsupported-selection';
   if(!reason&&!validText(event.label))reason='missing-event-label';
   let rows=[];
   if(!reason){
     if(event.selection==='auto'){
       if(!Array.isArray(event.skills)||!event.skills.length)reason='missing-auto-skills';
       else rows=event.skills;
     }else{
       if(!Array.isArray(event.choices)||!event.choices.length||
          !event.choices.every(c=>obj(c)&&validText(c.id)&&validText(c.label)&&Array.isArray(c.skills)))
         reason='invalid-choices';
       else if(new Set(event.choices.map(c=>c.id)).size!==event.choices.length)
         reason='duplicate-choice-id';
       else if(event.defaultChoiceId!==undefined&&!event.choices.some(c=>c.id===event.defaultChoiceId))
         reason='invalid-default-choice';
       else rows=event.choices.flatMap(c=>c.skills);
     }
   }
   if(!reason){
     const localNames=new Map();
     for(const s of rows){
       if(!obj(s)||!numericId(s.skillId)||!validText(s.skillName)||
          !Number.isInteger(s.hintLevel)||s.hintLevel<1){
         reason='invalid-skill-row';break;
       }
       const key=String(s.skillId),name=normalize(s.skillName);
       if((skills.has(key)&&skills.get(key).name!==name)||
          (localNames.has(key)&&localNames.get(key)!==name)){
         reason='conflicting-skill-names';break;
       }
       localNames.set(key,name);
     }
   }
   if(reason){issues.push({kind:reason,eventId:event.id,...(cardId?{cardId}:{})});continue;}
   for(const s of rows){
     const key=String(s.skillId),name=normalize(s.skillName);
     const found=model.skillById['hint:'+name];
     const entry=skills.get(key)||{sourceSkillId:key,name,modelSkillId:found&&normalize(found.name)===name?found.id:null};
     skills.set(key,entry);
   }
   const card=cards.get(cardId)||{cardId,eventCount:0,choiceEvents:0,autoEvents:0,sourceEventIds:[]};
   card.eventCount++;
   if(event.selection==='single')card.choiceEvents++;else card.autoEvents++;
   card.sourceEventIds.push(event.id);
   cards.set(cardId,card);
 }
 const skillEntries=[...skills.values()].sort((a,b)=>a.sourceSkillId.localeCompare(b.sourceSkillId));
 const perCard=Object.fromEntries([...supported].map(([id,s])=>{
   const c=cards.get(id);
   return [id,{matched:s.matched,nameMatch:s.matched,sourceEventCount:c?.eventCount||0,
     choiceEvents:c?.choiceEvents||0,autoEvents:c?.autoEvents||0,
     auditStatus:s.matched?'needs-event-chain-review':'unmatched'}];
 }));
 return {sourceSupports:supports.length,matchedSupports:[...supported.values()].filter(x=>x.matched).length,
   sourceEvents:eventsDocument.events.length,assignedEvents:[...cards.values()].reduce((n,c)=>n+c.eventCount,0),
   quarantinedEvents:issues.filter(x=>x.eventId!==undefined).length,
   choiceEvents:[...cards.values()].reduce((n,c)=>n+c.choiceEvents,0),
   autoEvents:[...cards.values()].reduce((n,c)=>n+c.autoEvents,0),
   uniqueSourceSkills:skillEntries.length,
   exactHintNameCandidates:skillEntries.filter(x=>x.modelSkillId!==null).length,
   unresolvedSkills:skillEntries.filter(x=>x.modelSkillId===null).length,
   eventChainVerified:0,
   issues,perCard,skillMatches:skillEntries,
   note:'Source card ID/name matching is not event chain verification. No event rewards are installed.'};
}
const api={audit,normalize};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaEventSourceAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this);
