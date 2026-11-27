'use strict';
// Read only official UmaSim Git objects, binding both paths to the exact
// same commit before reading any blob. No moving raw URL fallback.
const crypto=require('node:crypto');
const {gitBlobSha,POLICY}=require('./current_umasim_roster_delta.cjs');
const {PINNED_URL,PINNED_SHA256}=require('./skill_bridge.js');
const SHA=/^[a-f0-9]{40}$/;
const coord={owner:'mee1080',repo:'umasim'};
const supportPath='data/support_card.txt',skillPath='data/skill_data.txt';
const fail=m=>{throw Error('D072 verified UmaSim source: '+m);};
function createSourceReader(github){
 const g=github?.rest?.git,repos=github?.rest?.repos;
 if(typeof repos?.getCommit!=='function'||typeof g?.getTree!=='function'||typeof g?.getBlob!=='function')fail('read-only Git API required');
 const pins=new Map(),texts=new Map();
 async function resolve(ref){
  if(ref!=='main'&&!SHA.test(ref||''))fail('commit coordinate');
  if(ref!=='main'&&pins.has(ref))return {...pins.get(ref)};
  const c=(await repos.getCommit({...coord,ref})).data;
  if(!SHA.test(c?.sha||'')||ref!=='main'&&c.sha!==ref||!SHA.test(c.commit?.tree?.sha||''))fail('commit mismatch');
  if(pins.has(c.sha))return {...pins.get(c.sha)};
  const tree=(await g.getTree({...coord,tree_sha:c.commit.tree.sha,recursive:'1'})).data;
  if(tree?.sha!==c.commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree))fail('incomplete tree');
  function blob(path){
   const list=tree.tree.filter(x=>x.path===path);
   if(list.length!==1||list[0].type!=='blob'||list[0].mode!=='100644'||!SHA.test(list[0].sha||''))fail('immutable file missing: '+path);
   return list[0].sha;
  }
  const pin={commit:c.sha,cardBlob:blob(supportPath),skillBlob:blob(skillPath)};
  pins.set(c.sha,pin);return {...pin};
 }
 async function readBlob(sha){
  if(!SHA.test(sha||''))fail('blob coordinate');
  if(texts.has(sha))return texts.get(sha);
  const d=(await g.getBlob({...coord,file_sha:sha})).data;
  if(d?.sha!==sha||d.encoding!=='base64'||typeof d.content!=='string'||d.content.length>14_000_000||
     !Number.isSafeInteger(d.size)||d.size<1||d.size>10_000_000)fail('blob response');
  const base64=d.content.replace(/[\r\n]/g,'');
  const bytes=Buffer.from(base64,'base64');
  if(bytes.toString('base64')!==base64||bytes.length!==d.size)fail('blob encoding/size');
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  if(gitBlobSha(text)!==sha)fail('blob content mismatch');
  texts.set(sha,text);return text;
 }
 async function load(pin){
  const actual=await resolve(pin?.commit);
  if(Object.keys(pin||{}).sort().join(',')!=='cardBlob,commit,skillBlob'||
    actual.cardBlob!==pin.cardBlob||actual.skillBlob!==pin.skillBlob)fail('commit/blob path mismatch');
  const supportText=await readBlob(actual.cardBlob),skillText=await readBlob(actual.skillBlob);
  return {pin:actual,supportText,skillText};
 }
 async function baseline(){
  const pin=await resolve(POLICY.beforeCommit);
  if(pin.cardBlob!==POLICY.beforeBlob)fail('baseline pin mismatch');
  return {cardBlob:pin.cardBlob,supportText:await readBlob(pin.cardBlob)};
 }
 async function historicalSkill(){
  const revision=PINNED_URL.split('/')[5];
  const pin=await resolve(revision);
  const text=await readBlob(pin.skillBlob);
  if(crypto.createHash('sha256').update(text).digest('hex')!==PINNED_SHA256)fail('historical dictionary SHA mismatch');
  return text;
 }
 return {resolve,load,baseline,historicalSkill,latest:async()=>load(await resolve('main'))};
}
module.exports={createSourceReader};
