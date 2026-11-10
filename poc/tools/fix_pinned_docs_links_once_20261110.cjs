'use strict';
(function fixPinnedLinks(){
 const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path').posix;
 const files=cp.execFileSync('git',['ls-files','-z'],{encoding:'utf8',maxBuffer:80*1024*1024}).split('\0').filter(Boolean);
 const checkCache=new Map();
 function at(sha,p){
  const key=sha+':'+p;if(checkCache.has(key))return checkCache.get(key);
  let good=false;try{cp.execFileSync('git',['cat-file','-e',key],{stdio:'ignore'});good=true}catch{}
  checkCache.set(key,good);return good;
 }
 let count=0;const examples=[];
 const pattern=/(https:\/\/github\.com\/Nimrodx0\/Umasupport\/(?:blob|raw)\/)([0-9a-f]{7,40})\/(docs\/[A-Za-z0-9_.\/-]+\.md)(#[^\s)>"']*)?/gi;
 for(const p of files){
  if(!/\.(md|json|yml|yaml|js|cjs|mjs|html|py|txt)$/.test(p)||!fs.existsSync(p))continue;
  const content=fs.readFileSync(p,'utf8');
  const updated=content.replace(pattern,(all,pre,sha,docPath,hash='')=>{
   if(at(sha,docPath))return all;
   if(!docPath.startsWith('docs/'))return all;
   const name=path.basename(docPath),prior='docs/'+name;
   if(prior===docPath||!at(sha,prior))return all;
   count++;if(examples.length<15)examples.push({source:p,from:docPath,to:prior,sha});
   return pre+sha+'/'+prior+hash;
  });
  if(updated!==content)fs.writeFileSync(p,updated);
 }
 console.log(JSON.stringify({repairedPinnedGithubLinks:count,examples,shaPathTests:checkCache.size},null,2));
})();
