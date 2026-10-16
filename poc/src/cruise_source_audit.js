/* Read-only, data-free coverage audit for UmaUmaCruise style libraries. */
(function(g){
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
function audit(library,model){
 if(!object(library)||!object(library.Support)||!model||!Array.isArray(model.cards))
   throw new Error('Source or UmaSim structure is invalid');
 const rarities=['SSR','SR','R'];
 const modelIndex=new Map(),modelCounts={SSR:0,SR:0,R:0};
 for(const card of model.cards){
   if(!rarities.includes(card.rarity)||typeof card.name!=='string'||typeof card.id!=='string')throw new Error('Invalid UmaSim card');
   modelCounts[card.rarity]++;
   const key=card.rarity+'|'+normalize(card.name);
   const list=modelIndex.get(key)||[];
   list.push(card);
   modelIndex.set(key,list);
 }
 const sourceCounts={SSR:0,SR:0,R:0},matchedByRarity={SSR:0,SR:0,R:0},records=[];
 const anomalies=[],matches=new Set(),missingSource=[];
 const regexes={skill:/ヒント|スキル/,stop:/打ち切り|イベント終了|連続イベント終了|イベント打切/,
  success:/成功|失敗|確率|ランダム|抽選/,sequence:/連続|次のイベント|イベント発生/};
 const markers=Object.fromEntries(Object.keys(regexes).map(k=>[k,0]));
 const counter={},optionKeys=new Set(),effectKeys=new Set();
 let totalEvents=0,optionRows=0,withEffects=0,malformedEvents=0,
   matchedEvents=0,unmatchedEvents=0,eventsWithChoices=0,eventsWithSingleRow=0;
 for(const rarity of rarities){
   const group=library.Support[rarity];
   if(!object(group))throw new Error('Missing support rarity: '+rarity);
   for(const [name,record] of Object.entries(group)){
     sourceCounts[rarity]++;
     const ids=modelIndex.get(rarity+'|'+normalize(name))||[];
     if(ids.length===1){matches.add(ids[0].id);matchedByRarity[rarity]++}
     else{missingSource.push({rarity,name,matchCount:ids.length})}
     const value=record?.Event;
     if(!Array.isArray(value)){anomalies.push({kind:'non-array-events',rarity,name});continue}
     let perCardEvents=0;
     for(const event of value){
       if(!object(event)||Object.keys(event).length!==1){malformedEvents++;continue}
       const [title,options]=Object.entries(event)[0];
       if(!Array.isArray(options)){malformedEvents++;continue}
       totalEvents++;perCardEvents++;
       if(options.length===1)eventsWithSingleRow++;
       if(options.length>1)eventsWithChoices++;
       optionRows+=options.length;
       if(ids.length===1)matchedEvents++;else unmatchedEvents++;
       counter[String(options.length)]=(counter[String(options.length)]||0)+1;
       for(const opt of options){
         if(!object(opt)){malformedEvents++;continue}
         for(const k of Object.keys(opt))optionKeys.add(k);
         if(typeof opt.Effect==='string'){
           withEffects++;
           for(const [kind,re] of Object.entries(regexes))if(re.test(opt.Effect))markers[kind]++;
         }
         if(own(opt,'Effect'))effectKeys.add(typeof opt.Effect);
       }
     }
     records.push({rarity,name,cardId:ids.length===1?ids[0].id:null,eventCount:perCardEvents});
   }
 }
 const missingModel=model.cards.filter(x=>!matches.has(x.id));
 const missingByRarity=Object.fromEntries(rarities.map(r=>[r,missingModel.filter(x=>x.rarity===r).length]));
 return {sourceCards:records.length,sourceByRarity:sourceCounts,umaSimCards:model.cards.length,umaSimByRarity:modelCounts,
   exactMatchedCards:matches.size,matchedByRarity,missingUmaCards:missingModel.length,missingUmaByRarity:missingByRarity,
   unmatchedSourceCards:missingSource.length,unmatchedSourceByRarity:Object.fromEntries(rarities.map(r=>[r,missingSource.filter(x=>x.rarity===r).length])),
   recordsWithNoEvents:records.filter(x=>x.eventCount===0).length,
   totalEventRecords:totalEvents,matchedEventRecords:matchedEvents,unmatchedEventRecords:unmatchedEvents,
   optionRows,optionRowCountDistribution:counter,eventsWithChoices,eventsWithSingleRow,
   effectRows:withEffects,effectFieldTypes:[...effectKeys],optionRowFields:[...optionKeys].sort(),
   rawEffectMarkerCounts:markers,malformedEvents,anomalyCount:anomalies.length,
   eventIdFieldCount:0,cardIdFieldCount:0,explicitDependencyEdges:0,
   unresolvedSourceSample:missingSource.slice(0,25),missingUmaSample:missingModel.slice(0,25).map(c=>({id:c.id,rarity:c.rarity,name:c.name})),
   records:records.map(x=>({rarity:x.rarity,cardId:x.cardId,eventCount:x.eventCount})),
   warnings:[
     'Names and rarity were matched, not authoritative game IDs.',
     'Effect string markers indicate text only, not verified conditions.',
     'Record availability is not proven completeness of all in-game events.'
   ]};
}
const api={audit,normalize};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCruiseSourceAudit=api;
})(typeof globalThis!=='undefined'?globalThis:this);
