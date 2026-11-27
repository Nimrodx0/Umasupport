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
 blobs.set(blob,raw);trees.set(tree,new Map([[PATH,blob]]));commits.set(head,{tree,parent:null});
 const data=x=>({data:x});
 const github={rest:{git:{
  getRef:async()=>data({object:{sha:head}}),
  getCommit:async({commit_sha})=>data({tree:{sha:commits.get(commit_sha).tree}}),
  createBlob:async({content})=>{const sha=gitBlobSha(content);blobs.set(sha,content);return data({sha});},
  createTree:async({base_tree,tree})=>{a.ok(trees.has(base_tree));a.equal(tree[0].path,PATH);const sha=id();trees.set(sha,new Map([...trees.get(base_tree),...tree.map(x=>[x.path,x.sha])]));return data({sha});},
  createCommit:async({tree,parents})=>{a.equal(parents.length,1);const sha=id();commits.set(sha,{tree,parent:parents[0]});return data({sha});},
  updateRef:async({ref,sha,force})=>{a.equal(ref,REF);a.equal(force,false);
   if(forceRace||commits.get(sha).parent!==head)throw Object.assign(Error('conflict'),{status:422});
   head=sha;return data({object:{sha}});}
 },repos:{getContent:async({path,ref})=>{const sha=trees.get(commits.get(ref).tree).get(path);return data({sha,type:'file',encoding:'base64',content:Buffer.from(blobs.get(sha)).toString('base64')});}}}};
 return {store:(archiveKey=null)=>createStore({github,owner:'example',repo:'example',archiveKey}),rawFiles:()=>[...trees.get(commits.get(head).tree)].map(([path,sha])=>({path,content:blobs.get(sha)})),race:()=>{forceRace=true;}};
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

const {digest}=require('../src/event_release_gate.cjs');
const {keyFromEnv,open,seal,pathFor}=require('../src/d069_review_packet_archive.cjs');
const {inspect}=require('../src/d069_json_review_bridge.cjs');
const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'合成'+i,rarity:'normal',group:i})));
const actualPin={...pin,skillBlob:gitBlobSha(skillText)};
function packet(){
 return inspect({cardId:'39999',sourceUrl:'https://gametora.com/ja/umamusume/supports/39999-example',buildId:'test',sourcePin:actualPin,skillText,
 existingCatalog:{schemaVersion:1,cards:[]},body:JSON.stringify({pageProps:{sourceData:{support_id:39999},eventData:{ja:JSON.stringify({random:[{i:1,n:'非保存タイトル',c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}]})}}})});
}
const key=Buffer.alloc(32,19);
test('atomic encrypted packet archive, recovery after reload, wrong key and corruption reject',async()=>{
 const f=fixture(),s=f.store(key),old=await s.load(),p=packet();
 const r=reserve(old);r.rows[0].sourcePin=actualPin;
 a.equal(await s.compareAndSet(old,r),true);
 const row={...r.rows[0],status:'awaiting-fact-review',packetSha256:digest(p)},next={...r,revision:2,rows:[row]};
 await a.rejects(s.compareAndSet(r,next),/packet set/);
 await a.rejects(f.store().compareAndSet(r,next,[p]),/archive key/);
 a.deepEqual(await s.load(),r);
 a.equal(await s.compareAndSet(r,next,[p]),true);
 a.deepEqual(await f.store(key).loadPacket('39999'),p);
 const file=f.rawFiles().find(x=>x.path===pathFor(row));
 a.ok(file);a.doesNotMatch(file.content,/非保存タイトル|skill:990001|sourceEventId|groups/);
 await a.rejects(f.store(Buffer.alloc(32,20)).loadPacket('39999'),/authentication/);
 const envelope=JSON.parse(file.content),b=Buffer.from(envelope.ciphertext,'base64');b[0]^=1;
 a.throws(()=>open({...envelope,ciphertext:b.toString('base64')},row,key),/authentication/);
 const unsafe={...p,events:[{...p.events[0],title:'raw text'}]};
 a.throws(()=>seal(unsafe,{...row,packetSha256:digest(unsafe)},key),/metadata/);
 a.deepEqual(keyFromEnv(key.toString('base64')),key);a.throws(()=>keyFromEnv(''),/key/);
});
test('archive and receipt are not committed on competing CAS',async()=>{
 const f=fixture(),s=f.store(key),old=await s.load(),p=packet(),r=reserve(old);
 r.rows[0].sourcePin=actualPin;await s.compareAndSet(old,r);
 const next={...r,revision:2,rows:[{...r.rows[0],status:'awaiting-fact-review',packetSha256:digest(p)}]};
 f.race();a.equal(await s.compareAndSet(r,next,[p]),false);
 a.deepEqual(await s.load(),r);a.equal(f.rawFiles().length,1);
});
