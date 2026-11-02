#!/usr/bin/env node
'use strict';
/*
 * Release-aware CI tripwire. The old empty public catalog was replaced by
 * owner-approved 2487 facts. A stale deepEqual against empty public JSON can
 * print megabytes of data and terminate GitHub Actions runners. Flag it
 * before any long-running tests or a misleading (fatal) diff.
 */
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../tests');
const results=[];
function reEscape(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
for(const filename of fs.readdirSync(root)){
 if(!/\.test\.(?:cjs|js)$/.test(filename))continue;
 const source=fs.readFileSync(path.join(root,filename),'utf8');
 if(!source.includes('reviewed_events.v1.json'))continue;
 const vars=new Set();
 const paths=[
  /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"][^'"]*reviewed_events\.v1\.json['"]\s*\)/g,
  /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*JSON\.parse\(fs\.readFileSync\([^;\n]*reviewed_events\.v1\.json[^;\n]*/g
 ];
 for(const pattern of paths)for(const m of source.matchAll(pattern))vars.add(m[1]);
 for(const name of vars){
  const regex=new RegExp('assert\\.deepEqual\\(\\s*'+reEscape(name)+
   '(?:\\.cards)?\\s*,\\s*(?:\\[\\]|\\{schemaVersion:1,cards:\\[\\]\\})\\s*\\)','g');
  for(const m of source.matchAll(regex)){
   const line=source.slice(0,m.index).split('\n').length;
   results.push(filename+':'+line+': previously published JSON compared to empty');
  }
 }
 const direct=/assert\.deepEqual\(\s*require\(['"]\.\.\/data\/reviewed_events\.v1\.json['"]\)(?:\.cards)?\s*,\s*(?:\[\]|\{schemaVersion:1,cards:\[\]\})\s*\)/g;
 for(const m of source.matchAll(direct))results.push(filename+':'+
  source.slice(0,m.index).split('\n').length+': direct stale empty-public assertion');
}
if(results.length){
 console.error('GT2487 FIRST-PUBLICATION REGRESSION: '+results.length+
  ' stale assertions still expect 0 public event records:\n'+results.join('\n'));
 process.exitCode=1;
}else console.log('Release-aware test assumption scan PASS');
