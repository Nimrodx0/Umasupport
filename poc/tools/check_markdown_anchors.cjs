#!/usr/bin/env node
'use strict';
/* Conservative GitHub-style Markdown fragment verifier. Treat unsupported syntax
 * as a warning; --strict fails on links whose target headings are unambiguous. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const files=cp.execFileSync('git',['ls-files','--','*.md'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const get=p=>fs.readFileSync(path.join(root,p),'utf8');
const cache=new Map();
function headingSlug(text){
 const pure=text.replace(/<[^>]*>/g,'').replace(/!\[([^\]]+)\]\([^)]+\)/g,'$1')
   .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim();
 return pure.toLowerCase().replace(/[^\p{L}\p{N}\p{M}_ -]/gu,'').replace(/ /g,'-');
}
function getAnchors(p){
 if(cache.has(p))return cache.get(p);
 const s=get(p),seen=new Map(),out=new Set();
 let fenced=false;
 for(const line of s.split(/\r?\n/)){
  if(/^\s{0,3}(`{3,}|~{3,})/.test(line)){fenced=!fenced;continue;}
  if(fenced)continue;
  const h=/^\s{0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(line);
  if(h){const slug=headingSlug(h[1]),c=seen.get(slug)||0;out.add(slug+(c?'-'+c:''));seen.set(slug,c+1);}
  const ids=line.matchAll(/<a\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi);
  for(const id of ids)out.add(id[1]);
 }
 cache.set(p,out);return out;
}
const errors=[],warnings=[];
for(const p of files){
 const s=get(p);let fenced=false;
 for(const line of s.split(/\r?\n/)){
  if(/^\s*(`{3,}|~{3,})/.test(line)){fenced=!fenced;continue;}
  if(fenced)continue;
  for(const match of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)){
   const url=match[1];if(/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(url))continue;
   const pos=url.indexOf('#');if(pos<0)continue;
   const pathPart=url.slice(0,pos),fragment=url.slice(pos+1);
   if(!fragment)continue;
   const target=pathPart?path.normalize(path.join(path.dirname(p),decodeURIComponent(pathPart))):p;
   if(!target.endsWith('.md')&&!target.endsWith('.markdown'))continue;
   if(!fs.existsSync(path.join(root,target)))continue;
   let anchor;try{anchor=decodeURIComponent(fragment).toLowerCase();}catch{warnings.push(p+': invalid URL escape '+url);continue;}
   const anchors=getAnchors(target);
   if(!anchors.has(anchor))errors.push(p+': missing #'+fragment+' in '+target);
  }
 }
}
console.log(JSON.stringify({checkedFiles:files.length,invalidAnchors:errors.length,warnings:warnings.length,errors:errors.slice(0,140)},null,2));
if(process.argv.includes('--strict')&&errors.length)process.exitCode=1;
