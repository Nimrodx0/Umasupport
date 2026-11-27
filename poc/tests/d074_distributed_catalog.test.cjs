'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const api=require('../src/public_event_catalog.js');
const {manifest}=require('../src/d074_event_data_branch.cjs');
const {buildModel}=require('../src/live_loader.js');
const {digest}=require('../src/event_release_gate.cjs');
// Synthetic full-size catalog: no third-party names or data.
const ids=Array.from({length:564},(_,i)=>String(30000+i));
const catalog={schemaVersion:1,cards:ids.map((cardId,i)=>({cardId,coverageStatus:'partial',events:Array.from({length:i<265?5:4},(_,j)=>({id:'synthetic:'+cardId+':'+j,name:'Synthetic',type:'auto',rewards:[]}))}))};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const root='https://raw.githubusercontent.com/Nimrodx0/Umasupport/';
const text=JSON.stringify(catalog);
function makeManifest(revision=2,body=text){
 const c=JSON.parse(body);
 return {dataKind:'umasupport-event-data-manifest',schemaVersion:1,catalogSchemaVersion:1,revision,snapshotCommit:String(revision).repeat(40),codeCommit:'a'.repeat(40),previousManifestCommit:'b'.repeat(40),
 cardCount:c.cards.length,eventCount:c.cards.reduce((n,x)=>n+x.events.length,0),catalogSha256:hash(body),approvalSha256:'c'.repeat(64),catalogContentSha256:digest(c),approvalContentSha256:'d'.repeat(64)};
}
function fixture(){
 const cards=ids.map(id=>({id,hints:[],events:[]}));
 const model={cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),skills:[],skillById:{},meta:{}};
 let record=null,writes=0;const calls=[];
 const state={m:makeManifest(),body:text,offline:false};
 const store={get:async()=>structuredClone(record),put:async x=>{record=structuredClone(x);writes++;}};
 const args={model,store,legacyStore:null,fetchImpl:async(url,opts)=>{
  calls.push(url);a.equal(opts.redirect,'error');a.equal(opts.cache,'no-store');
  if(state.offline)throw Error('offline');
  if(url===api.MANIFEST_URL)return new Response(JSON.stringify(state.m));
  if(url===root+state.m.snapshotCommit+'/poc/data/reviewed_events.v1.json')return new Response(state.body);
  return new Response('',{status:404});
 }};
 return {args,state,calls,record:()=>record,writes:()=>writes};
}
test('production routing, fixed commit download and same revision cache reuse',async()=>{
 a.equal(api.isProduction({origin:'https://nimrodx0.github.io',pathname:'/Umasupport/poc/live.html'}),true);
 a.equal(api.isProduction({origin:'http://localhost:8080',pathname:'/Umasupport/poc/live.html'}),false);
 const f=fixture(),r=await api.loadDistributed(f.args);
 a.equal(r.mode,'online');a.equal(r.revision,2);a.deepEqual(r.catalog,catalog);
 a.deepEqual(f.calls,[api.MANIFEST_URL,root+f.state.m.snapshotCommit+'/poc/data/reviewed_events.v1.json']);
 a.equal(f.writes(),1);a.equal(f.record().manifest.catalogSha256,hash(text));
 const next=await api.loadDistributed(f.args);
 a.equal(next.mode,'online');a.equal(f.calls.length,3);a.equal(f.writes(),1);
});
test('wrong hash, unsupported schema, stale manifest, invalid model and outage preserve cache',async()=>{
 const f=fixture();await api.loadDistributed(f.args);const old=structuredClone(f.record());
 for(const m of [{...makeManifest(3),catalogSha256:'0'.repeat(64)},{...makeManifest(3),schemaVersion:9},{...makeManifest(),snapshotCommit:'f'.repeat(40)},{...makeManifest(3),cardCount:565}]){
  f.state.m=m;const r=await api.loadDistributed(f.args);a.equal(r.mode,'cached');a.equal(r.revision,2);a.deepEqual(f.record(),old);
 }
 f.state.m=makeManifest(3);f.state.body=text+' ';a.equal((await api.loadDistributed(f.args)).mode,'cached');
 f.state.body=text;f.state.offline=true;a.equal((await api.loadDistributed(f.args)).mode,'cached');
 a.equal(f.writes(),1);
 f.state.offline=false;const r=await api.loadDistributed(f.args);a.equal(r.revision,3);a.equal(f.writes(),2);
});
test('corrupt cache is rejected and unverified local fallback cannot be adopted',async()=>{
 const f=fixture();await api.loadDistributed(f.args);f.record().text+=' ';f.state.offline=true;
 await a.rejects(api.loadDistributed(f.args),/検証済みキャッシュもありません/);
 const g=fixture();g.state.m={...g.state.m,snapshotCommit:'https://other.invalid/'};
 await a.rejects(api.loadDistributed(g.args),/検証済みキャッシュもありません/);
 a.deepEqual(g.calls,[api.MANIFEST_URL,api.URL]);a.equal(g.writes(),0);
});
test('baseline exact manifest and catalog bytes match the already approved main snapshot',()=>{
 const catalogText=fs.readFileSync(path.resolve(__dirname,'../data/reviewed_events.v1.json'),'utf8');
 const approvalsText=fs.readFileSync(path.resolve(__dirname,'../config/event-release-approvals.gt2487.v2.json'),'utf8');
 const m=manifest({catalogText,approvalsText,snapshotCommit:'a'.repeat(40),codeCommit:'b'.repeat(40)});
 a.equal(api.manifestShape(m),m);
 a.throws(()=>api.manifestShape({...m,catalogSha256:'0'.repeat(64)}),/版情報/);
});
