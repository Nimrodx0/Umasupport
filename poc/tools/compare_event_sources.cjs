#!/usr/bin/env node
'use strict';
/* Temporary read-only diagnostic: log counts and keys, not copyrighted event text. */
const {buildModel}=require('../src/live_loader.js');
const norm=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const urls={
 checker:'https://raw.githubusercontent.com/Cilda/UmaUmaChecker/master/UmaUmaChecker/Library/Events.json',
 cruise:'https://raw.githubusercontent.com/po-po-po-pong/umaumacruise_customjson/main/UmaMusumeLibrary.json',
 uma:'https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt'
};
async function get(url) {
 const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(url+' HTTP '+response.status);
 const body=await response.text();
 return body;
}
function findEntries(node,path=[],depth=0,out=[]){
 if(depth>6||!node||typeof node!=='object')return out;
 if(!Array.isArray(node)&&Array.isArray(node.Events)){
   out.push({path,events:node.Events});
   return out;
 }
 if(!Array.isArray(node))for(const [key,val] of Object.entries(node))findEntries(val,[...path,key],depth+1,out);
 return out;
}
function keysOf(v){return v&&typeof v==='object'?Object.keys(v).slice(0,15):[];}
function eventStats(entries){
 let events=0,options=0,empty=0,notArray=0;const fields=new Set(),firsts=[];
 for(const e of entries)for(const event of e.events){
   if(!event||typeof event!=='object'||Array.isArray(event)){notArray++;continue;}
   for(const optionArr of Object.values(event)){
     events++;
     if(!Array.isArray(optionArr)){notArray++;continue;}
     if(optionArr.length===0)empty++;
     options+=optionArr.length;
     for(const opt of optionArr)if(opt&&typeof opt==='object')for(const k of Object.keys(opt))fields.add(k);
   }
 }
 return {events,options,empty,notArray,optionFields:[...fields]};
}
function matched(entries,model){
 const index=new Map(model.cards.map(c=>[c.rarity+'|'+norm(c.name),c.id]));
 const onlySS=new Set(model.cards.filter(c=>c.rarity!=='R').map(c=>c.id));
 const source=new Map(),hits=new Set(),unknown=[],byRarity={SSR:0,SR:0,R:0,other:0},hitrate={SSR:0,SR:0,R:0,other:0};
 for(const e of entries){
   const rarity=e.path.find(x=>['SSR','SR','R'].includes(x))||'other',name=e.path[e.path.length-1];
   byRarity[rarity]++;
   const id=index.get(rarity+'|'+norm(name));
   if(id){hits.add(id);hitrate[rarity]++}
   else unknown.push({rarity,name});
   source.set(rarity+'|'+norm(name),{id:id||null,events:e.events.length});
 }
 return {hits,source,unknown,byRarity,hitrate,
    matchesSSR_SR:[...hits].filter(id=>onlySS.has(id)).length,
    matchesTotal:hits.size};
}
async function main(){
 const [checkerText,cruiseText,umaText]=await Promise.all(Object.values(urls).map(get));
 const checker=JSON.parse(checkerText.replace(/^\uFEFF/,'')),cruise=JSON.parse(cruiseText),model=buildModel(umaText);
 const checkerEntries=findEntries(checker);
 const cruiseEntries=['SSR','SR','R'].flatMap(r=>Object.entries(cruise.Support?.[r]||{}).map(([name,item])=>({path:['Support',r,name],events:item.Event||[]})));
 const a=matched(checkerEntries,model),b=matched(cruiseEntries,model);
 const union=new Set([...a.hits,...b.hits]);
 const modelSS=model.cards.filter(c=>c.rarity!=='R');
 const unionSS=modelSS.filter(c=>union.has(c.id));
 const cOnly=[...a.hits].filter(id=>!b.hits.has(id));
 const cruiseOnly=[...b.hits].filter(id=>!a.hits.has(id));

 const unmatchedModel=modelSS.filter(c=>!a.hits.has(c.id));
 const unmatchedChecker=a.unknown.filter(e=>e.rarity!=='R');
 function splitName(name){
   const normalized=norm(name);
   const match=/^\[([^\]]+)\](.+)$/.exec(normalized);
   return match?{title:match[1],character:match[2]}:{title:normalized,character:''};
 }
 function simplify(x){return x.normalize('NFKC').toLowerCase().replace(/[\s!"'’“”‘「」『』（）()！？!?,.，．・:：\-‐〜～～♯#♪☆★∞&＆]/g,'');}
 function distance(a,b){
   let p=Array.from({length:b.length+1},(_,i)=>i);
   for(let i=1;i<=a.length;i++){let next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=next;}
   return p[b.length];
 }
 const aliasCandidates=unmatchedModel.map(card=>{
   const m=splitName(card.name);
   const candidates=unmatchedChecker.filter(src=>src.rarity===card.rarity).map(src=>{
     const x=splitName(src.name);
     const sameCharacter=x.character===m.character&&m.character.length>0;
     const dist=distance(simplify(x.title),simplify(m.title));
     return {sourceName:src.name,sameCharacter,titleEditDistance:dist,titleAfterPunctuationMatch:simplify(x.title)===simplify(m.title)};
   }).sort((a,b)=>Number(b.sameCharacter)-Number(a.sameCharacter)||a.titleEditDistance-b.titleEditDistance);
   return {id:card.id,rarity:card.rarity,modelName:card.name,candidates:candidates.slice(0,3)};
 });
 const countByEventLength={}, checkerEventTitleStats={total:0,distinct:0};
 const titles=new Set();
 for(const e of checkerEntries){
   const n=e.events.length;countByEventLength[n]=(countByEventLength[n]||0)+1;
   for(const event of e.events){for(const title of Object.keys(event||{})){titles.add(norm(title));checkerEventTitleStats.total++}}
 }
 checkerEventTitleStats.distinct=titles.size;

 const r={
  time:new Date().toISOString(),
  sourceSizes:{checker:Buffer.byteLength(checkerText),cruise:Buffer.byteLength(cruiseText),uma:Buffer.byteLength(umaText)},
  checkerRootKeys:keysOf(checker),checkerRootChildren:Object.fromEntries(Object.entries(checker).slice(0,4).map(([k,v])=>[k,keysOf(v)])),
  checkerFirstPath:checkerEntries[0]?.path.map((x,i)=>i===checkerEntries[0].path.length-1?'<card name>':x),
  checkerEventFields:checkerEntries[0]?.events?.[0]?keysOf(checkerEntries[0].events[0]).map(_=>'<event title>'):[],
  checkerFirstChoiceFields:checkerEntries[0]?.events?.[0]?keysOf(Object.values(checkerEntries[0].events[0])[0]?.[0]):[],
  modelCount:model.cards.length,modelSSR_SR:modelSS.length,
  checker:{cards:checkerEntries.length,byRarity:a.byRarity,strictMatches:a.hits.size,strictMatchesByRarity:a.hitrate,matchedSSR_SR:a.matchesSSR_SR,...eventStats(checkerEntries),unmatchedCount:a.unknown.length,unmatchedSample:a.unknown.slice(0,8)},
  cruise:{cards:cruiseEntries.length,byRarity:b.byRarity,strictMatches:b.hits.size,strictMatchesByRarity:b.hitrate,matchedSSR_SR:b.matchesSSR_SR,...eventStats(cruiseEntries)},
  checkerEventCountDistribution:countByEventLength,checkerEventTitleStats,unmatchedAliasCandidates:aliasCandidates,
  union:{all:union.size,SSR_SR:unionSS.length,SSR_SR_target:modelSS.length,
   missingSSR_SR:modelSS.filter(c=>!union.has(c.id)).map(c=>({id:c.id,rarity:c.rarity,name:c.name})),
   checkerOnlyCount:cOnly.length,cruiseOnlyCount:cruiseOnly.length,
   checkerOnlySSR_SR:cOnly.filter(id=>modelSS.some(c=>c.id===id)).length,
   cruiseOnlySSR_SR:cruiseOnly.filter(id=>modelSS.some(c=>c.id===id)).length}
 };
 console.log('SECOND_SOURCE_AUDIT_START');
 console.log(JSON.stringify(r,null,2));
 console.log('SECOND_SOURCE_AUDIT_END');
}
main().catch(e=>{console.error('AUDIT_FAILED',e.stack);process.exitCode=1});
