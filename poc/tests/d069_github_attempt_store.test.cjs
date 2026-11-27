'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createStore,transition,REF,PATH}=require('../src/d069_github_attempt_store.cjs');
const {empty}=require('../src/d069_json_attempt_ledger.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const pin={commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:'c'.repeat(40)};
const reserve=(old,id='39999')=>({...old,revision:old.revision+1,rows:[...old.rows,{cardId:id,sourcePin:pin,status:'reserved',packetSha256:null}]});
const finish=old=>({...old,revision:old.revision+1,rows:old.rows.map(r=>({...r,status:'uncertain'}))});
function fixture(){
 const commits=new Map(),trees=new Map(),blobs=new Map();let head='1'.repeat(40),counter=10,forceRace=false;
 const id=()=>String(++counter).padStart(40,'0'),raw=JSON.stringify(empty()),blob=gitBlobSha(raw),tree='2'.repeat(40);
 blobs.set(blob,raw);trees.set(tree,blob);commits.set(head,{tree,parent:null});
 const data=x=>({data:x});
 const github={rest:{git:{
  getRef:async()=>data({object:{sha:head}}),
  getCommit:async({commit_sha})=>data({tree:{sha:commits.get(commit_sha).tree}}),
  createBlob:async({content})=>{const sha=gitBlobSha(content);blobs.set(sha,content);return data({sha});},
  createTree:async({base_tree,tree})=>{a.ok(trees.has(base_tree));a.equal(tree[0].path,PATH);const sha=id();trees.set(sha,tree[0].sha);return data({sha});},
  createCommit:async({tree,parents})=>{a.equal(parents.length,1);const sha=id();commits.set(sha,{tree,parent:parents[0]});return data({sha});},
  updateRef:async({ref,sha,force})=>{a.equal(ref,REF);a.equal(force,false);
   if(forceRace||commits.get(sha).parent!==head)throw Object.assign(Error('conflict'),{status:422});
   head=sha;return data({object:{sha}});}
 },repos:{getContent:async({path,ref})=>{a.equal(path,PATH);const sha=trees.get(commits.get(ref).tree);return data({sha,type:'file',encoding:'base64',content:Buffer.from(blobs.get(sha)).toString('base64')});}}}};
 return {store:()=>createStore({github,owner:'example',repo:'example'}),race:()=>{forceRace=true;}};
}
test('persistent read, reservation, completion, restart and stale CAS',async()=>{
 const f=fixture(),s=f.store(),old=await s.load(),r=reserve(old);
 a.equal(await s.compareAndSet(old,r),true);
 a.deepEqual(await f.store().load(),r);
 a.equal(await s.compareAndSet(old,reserve(old,'39998')),false);
 a.equal(await s.compareAndSet(r,finish(r)),true);
 a.deepEqual(await f.store().load(),finish(r));
 a.throws(()=>transition(finish(r),{...empty(),revision:3}),/deletion/);
 a.throws(()=>transition(finish(r),{...r,revision:3}),/transition/);
});
test('non-fast-forward race rejects without reporting success',async()=>{
 const f=fixture(),s=f.store(),old=await s.load();f.race();
 a.equal(await s.compareAndSet(old,reserve(old)),false);
 a.deepEqual(await s.load(),old);
});
