/* Angle-bracket category candidates from verified UmaSim info[].
 * Mathematical comparisons also contain angle characters: never interpret
 * an arbitrary <...> fragment as a game-category restriction. */
(function(g){
'use strict';
const ATOMS=new Set(['逃げ','先行','差し','追込','短距離','マイル',
 '中距離','長距離','芝','ダート']);
const STYLE=new Set(['逃げ','先行','差し','追込']);
const DISTANCE=new Set(['短距離','マイル','中距離','長距離']);
const SURFACE=new Set(['芝','ダート']);
function parse(text){
 const label=String(text??'').normalize('NFKC').trim();
 const prefix=label.startsWith('作戦・');
 const tail=prefix?label.slice(3):label;
 const atoms=tail.split(/[・/]/);
 if(!atoms.length||!atoms.every(a=>ATOMS.has(a)))return null;
 return {text:label,dimensions:{
  style:atoms.filter(a=>STYLE.has(a)),
  distance:atoms.filter(a=>DISTANCE.has(a)),
  surface:atoms.filter(a=>SURFACE.has(a))}};
}
function candidates(info){
 const rows=Array.isArray(info)?info:[];
 const found=[];
 for(const [infoIndex,row] of rows.entries()){
  if(typeof row!=='string')continue;
  for(const m of row.matchAll(/[＜〈]([^＞〉]{1,100})[＞〉]/g))
   found.push({text:m[1].normalize('NFKC').trim(),infoIndex});
  for(const m of row.matchAll(/<([^<>\\r\\n]{1,100})>/g))
   found.push({text:m[1].normalize('NFKC').trim(),infoIndex});
 }
 return found.filter(x=>x.text);
}
function recognized(info){
 return candidates(info).flatMap(({text,infoIndex})=>{
  const parsed=parse(text);
  return parsed?[{...parsed,infoIndex,origin:'publisher-info-angle'}]:[];
 });
}
const api={parse,candidates,recognized};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillConditionTags=api;
})(typeof globalThis!=='undefined'?globalThis:this);
