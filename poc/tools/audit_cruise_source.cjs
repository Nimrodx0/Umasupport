#!/usr/bin/env node
'use strict';
// Read-only source reconnaissance. No copyrighted event text is published in logs.
const URL='https://raw.githubusercontent.com/po-po-po-pong/umaumacruise_customjson/main/UmaMusumeLibrary.json';
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
async function fetchText(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{accept:'application/json'}});
 if(!r.ok)throw new Error('HTTP '+r.status+' '+url);
 return r.text();
}
const describe=(v,depth=0)=>{
 if(Array.isArray(v))return {type:'array',length:v.length,element:depth<3?describe(v[0],depth+1):typeof v[0]};
 if(v&&typeof v==='object')return {type:'object',entries:Object.keys(v).length,
   keys:Object.keys(v).slice(0,16),
   sampleValues:depth<3?Object.fromEntries(Object.entries(v).slice(0,3).map(([key,item])=>[key,describe(item,depth+1)])):undefined};
 if(typeof v==='string')return {type:'string',length:v.length,isNumericId:/^\d{5}$/.test(v)};
 return {type:typeof v,value:typeof v==='number'?v:undefined};
};
async function main(){
 const dataText=await fetchText(URL),data=JSON.parse(dataText);
 console.log('SOURCE_SCHEMA_START');
 console.log(JSON.stringify({downloadBytes:Buffer.byteLength(dataText),root:describe(data)},null,2));
 console.log('SOURCE_SCHEMA_END');
 await fullAudit(data);
}

function classify(value){
 if(Array.isArray(value))return 'array('+value.length+')';
 if(value&&typeof value==='object')return 'object('+Object.keys(value).length+')';
 return typeof value;
}
function sampleShape(value,depth=0){
 if(depth>5)return classify(value);
 if(Array.isArray(value))return {type:'array',size:value.length,first:sampleShape(value[0],depth+1)};
 if(value&&typeof value==='object')return {type:'object',size:Object.keys(value).length,
  sample:Object.fromEntries(Object.entries(value).slice(0,2).map(([k,v])=>[k.length>24?k.slice(0,24)+'…':k,sampleShape(v,depth+1)]))};
 return classify(value);
}
function histogram(list){const result={};for(const x of list)result[String(x)]=(result[String(x)]||0)+1;return result;}
async function fullAudit(data){
 const umaText=await fetchText('https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt');
 const loader=require('../src/live_loader.js');
 const model=loader.buildModel(umaText);
 const keys=['SSR','SR','R'];
 const records=keys.flatMap(rarity=>Object.entries(data.Support[rarity]||{}).map(([name,value])=>({rarity,name,value})));
 const norm=normalize;
 const exactByName=new Map();
 for(const c of model.cards){const k=c.rarity+'|'+norm(c.name);if(!exactByName.has(k))exactByName.set(k,[]);exactByName.get(k).push(c);}
 const allNames=new Map();
 for(const c of model.cards){const k=norm(c.name);if(!allNames.has(k))allNames.set(k,[]);allNames.get(k).push(c);}
 const nameOnly=new Map(records.map((v)=>[norm(v.name),v]));
 const combined=records.map(r=>{let candidates=exactByName.get(r.rarity+'|'+norm(r.name))||[];return {...r,
  matchedIds:candidates.map(x=>x.id),nameOnlyIds:(allNames.get(norm(r.name))||[]).map(x=>x.id)};});
 const matchedIds=new Set(combined.flatMap(r=>r.matchedIds));
 const noMatch=combined.filter(r=>r.matchedIds.length!==1);
 const missing=model.cards.filter(c=>!matchedIds.has(c.id));
 const Event=records.map(r=>r.value?.Event);
 const eventTypes=histogram(Event.map(classify));
 const events=records.flatMap(r=>Object.entries(r.value?.Event||{}).map(([eventName,eventValue])=>({rarity:r.rarity,eventName,eventValue})));
 const eventKinds=histogram(events.map(e=>classify(e.eventValue)));
 const eventEntries=events.map(e=>({fields:e.eventValue&&typeof e.eventValue==='object'&&!Array.isArray(e.eventValue)?Object.keys(e.eventValue):[],
    shape:classify(e.eventValue)}));
 const eventFieldFreq={};
 for(const e of eventEntries)for(const k of e.fields)eventFieldFreq[k]=(eventFieldFreq[k]||0)+1;
 console.log('SOURCE_COVERAGE_START');
 console.log(JSON.stringify({
  sourceCards:records.length,sourceByRarity:Object.fromEntries(keys.map(k=>[k,records.filter(r=>r.rarity===k).length])),
  umaSimCards:model.cards.length,matchedCardIds:matchedIds.size,strictOneToOne:combined.filter(r=>r.matchedIds.length===1).length,
  missingUmaCards:missing.length,sourceUnmatchedCards:noMatch.length,
  sourceAmbiguities:combined.filter(r=>r.matchedIds.length>1).length,
  unmatchedSample:noMatch.slice(0,22).map(r=>({rarity:r.rarity,name:r.name,modelSameNameIds:r.nameOnlyIds})),
  missingSample:missing.slice(0,22).map(x=>({id:x.id,rarity:x.rarity,name:x.name})),
  eventContainerShapes:eventTypes,totalEventKeys:events.length,
  perCardEventKeyDistribution:histogram(records.map(r=>Object.keys(r.value?.Event||{}).length)),
  eventValueKinds:eventKinds,eventFieldFrequency:eventFieldFreq,
  firstEventShape:sampleShape(events[0]?.eventValue),
  secondEventShape:sampleShape(events[1]?.eventValue),
  selectedEventWithMultipleChildren:sampleShape(events.find(e=>e.eventValue&&typeof e.eventValue==='object'&&Object.keys(e.eventValue).length>1)?.eventValue),
  supportEntryShape:sampleShape(records[0]?.value),
  sourceIdsPresent:records.filter(r=>Object.keys(r.value||{}).some(k=>/id/i.test(k))).length
 },null,2));
 console.log('SOURCE_COVERAGE_END');
}

main().catch(e=>{console.error('SOURCE_AUDIT_ERROR '+e.stack);process.exitCode=1;});
