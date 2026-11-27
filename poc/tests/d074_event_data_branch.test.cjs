'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {manifest,verifySnapshot,bootstrap,REF,CATALOG,APPROVALS,MANIFEST}=require('../src/d074_event_data_branch.cjs');
const {digest}=require('../src/event_release_gate.cjs'),{gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const base='a'.repeat(40),snap='b'.repeat(40);
const e={id:'test:1',name:'Synthetic',type:'auto',rewards:[]};
const keys=['card','event','choices','outcomes','dependencies','publication'];
const catalog={schemaVersion:1,cards:[{cardId:'39998',coverageStatus:'partial',events:[e]}]};
const approvals={schemaVersion:2,cohorts:[],entries:[{cardId:'39998',eventId:e.id,eventSha256:digest(e),reviewer:'synthetic',reviewedAt:'2026-11-28',checks:Object.fromEntries(keys.map(k=>[k,true])),evidence:Object.fromEntries(keys.map(k=>[k,['https://example.org/synthetic']])),publicationBasis:{kind:'original-factual-description',reason:'synthetic'}}]};
const json=x=>JSON.stringify(x,null,2)+'\n',catalogText=json(catalog),approvalsText=json(approvals);
test('manifest binds exact bytes, approved content, counts, revision and fixed coordinates',()=>{
 const m=manifest({catalogText,approvalsText,snapshotCommit:snap,codeCommit:base});
 a.equal(m.cardCount,1);a.equal(m.eventCount,1);a.deepEqual(verifySnapshot(m,catalogText,approvalsText),m);
 a.throws(()=>verifySnapshot(m,catalogText+' ',approvalsText),/digest/);
 a.throws(()=>verifySnapshot({...m,eventCount:2},catalogText,approvalsText),/digest/);
 a.throws(()=>verifySnapshot({...m,extra:true},catalogText,approvalsText),/shape/);
 a.throws(()=>manifest({catalogText,approvalsText:json({...approvals,entries:[]}),snapshotCommit:snap,codeCommit:base}));
});
function fixture(){
 const refs=new Map([['heads/main',base]]),commits=new Map(),trees=new Map(),blobs=new Map(),writes=[];
 let serial=10;const id=()=> (++serial).toString(16).padStart(40,'0');
 const data=x=>({data:x});const blob=text=>{const sha=gitBlobSha(text);blobs.set(sha,text);return sha;};
 const entries=[{path:CATALOG,mode:'100644',type:'blob',sha:blob(catalogText)},{path:APPROVALS,mode:'100644',type:'blob',sha:blob(approvalsText)}];
 const bt=id();trees.set(bt,entries);commits.set(base,{sha:base,tree:{sha:bt},parents:[]});
 const github={rest:{git:{
  getRef:async({ref})=>{if(!refs.has(ref))throw Object.assign(Error('missing'),{status:404});return data({object:{sha:refs.get(ref)}});},
  getCommit:async({commit_sha})=>data(commits.get(commit_sha)),
  getTree:async({tree_sha})=>data({sha:tree_sha,truncated:false,tree:trees.get(tree_sha)}),
  getBlob:async({file_sha})=>{const text=blobs.get(file_sha);return data({sha:file_sha,encoding:'base64',size:Buffer.byteLength(text),content:Buffer.from(text).toString('base64')});},
  createBlob:async({content})=>{writes.push('blob');return data({sha:blob(content)});},
  createTree:async({tree})=>{writes.push('tree');const sha=id();trees.set(sha,tree);return data({sha});},
  createCommit:async({tree,parents})=>{writes.push('commit');const sha=id();commits.set(sha,{sha,tree:{sha:tree},parents:parents.map(sha=>({sha}))});return data({sha});},
  createRef:async({ref,sha})=>{a.equal(ref,'refs/'+REF);writes.push('ref');refs.set(REF,sha);return data({object:{sha}});}
 }}};
 return {refs,commits,trees,writes,args:{github,owner:'o',repo:'r',baseSha:base,catalogText,approvalsText,allowCreate:true}};
}
test('seed is atomic, verified before ref creation, re-run read only and main unchanged',async()=>{
 const f=fixture();
 await a.rejects(bootstrap({...f.args,allowCreate:false}),/explicit initial/);a.deepEqual(f.writes,[]);
 const r=await bootstrap(f.args);
 a.equal(r.status,'initialized');a.equal(r.branchWritten,true);a.equal(f.refs.get('heads/main'),base);
 a.equal(f.refs.get(REF),r.head);a.equal(f.writes.at(-1),'ref');
 a.deepEqual(f.trees.get(f.commits.get(r.head).tree.sha).map(x=>x.path).sort(),[CATALOG,APPROVALS,MANIFEST].sort());
 const n=f.writes.length,again=await bootstrap({...f.args,allowCreate:false});
 a.equal(again.status,'existing-verified');a.equal(again.branchWritten,false);a.equal(f.writes.length,n);
 f.trees.get(f.commits.get(r.head).tree.sha).push({path:'unexpected',type:'blob'});
 await a.rejects(bootstrap(f.args),/unexpected data branch paths/);
});
test('changed checkout or main stops before any writes',async()=>{
 const f=fixture();await a.rejects(bootstrap({...f.args,catalogText:catalogText+' '}),/checkout mismatch/);a.deepEqual(f.writes,[]);
 f.refs.set('heads/main',snap);await a.rejects(bootstrap(f.args),/main drift/);a.deepEqual(f.writes,[]);
});
