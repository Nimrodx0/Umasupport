'use strict';
// D074: a published snapshot is immutable; moving branch points to a
// manifest commit referencing the preceding data-only snapshot commit.
const crypto=require('node:crypto');
const {verifyRelease,digest}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const REF='heads/data/events',CATALOG='poc/data/reviewed_events.v1.json',APPROVALS='poc/config/event-release-approvals.gt2487.v2.json',MANIFEST='manifest.json';
const SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/;
const fail=s=>{throw Error('D074 data branch: '+s);};
const rawHash=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.split(',').sort().join(',');
function facts(catalogText,approvalsText){
 if(typeof catalogText!=='string'||typeof approvalsText!=='string'||Buffer.byteLength(catalogText)>15000000||Buffer.byteLength(approvalsText)>5000000)fail('data size or type');
 const catalog=JSON.parse(catalogText),approvals=JSON.parse(approvalsText);
 if(approvals.schemaVersion!==2)fail('approval ledger version');
 const v=verifyRelease(catalog,approvals);
 return {cardCount:v.publicCards,eventCount:v.publicEvents,catalogSha256:rawHash(catalogText),approvalSha256:rawHash(approvalsText),
  catalogContentSha256:digest(catalog),approvalContentSha256:digest(approvals)};
}
function manifest({catalogText,approvalsText,snapshotCommit,codeCommit,revision=1,previousManifestCommit=null}={}){
 if(!SHA.test(snapshotCommit||'')||!SHA.test(codeCommit||'')||!Number.isSafeInteger(revision)||revision<1||
    (revision===1?previousManifestCommit!==null:!SHA.test(previousManifestCommit||'')))fail('manifest coordinates');
 return {dataKind:'umasupport-event-data-manifest',schemaVersion:1,catalogSchemaVersion:1,revision,snapshotCommit,codeCommit,previousManifestCommit,
  ...facts(catalogText,approvalsText)};
}
function verifySnapshot(m,catalogText,approvalsText){
 if(!exact(m,'dataKind,schemaVersion,catalogSchemaVersion,revision,snapshotCommit,codeCommit,previousManifestCommit,cardCount,eventCount,catalogSha256,approvalSha256,catalogContentSha256,approvalContentSha256')||
    m.dataKind!=='umasupport-event-data-manifest'||m.schemaVersion!==1||m.catalogSchemaVersion!==1||
    ![m.catalogSha256,m.approvalSha256,m.catalogContentSha256,m.approvalContentSha256].every(x=>HASH.test(x||'')))fail('manifest shape');
 const expected=manifest({catalogText,approvalsText,snapshotCommit:m.snapshotCommit,codeCommit:m.codeCommit,revision:m.revision,previousManifestCommit:m.previousManifestCommit});
 if(digest(m)!==digest(expected))fail('snapshot digest or counts');
 return m;
}
async function bootstrap({github,owner,repo,baseSha,catalogText,approvalsText,allowCreate=false}={}){
 if(!github?.rest?.git||!owner||!repo||!SHA.test(baseSha||''))fail('scope');
 const g=github.rest.git,coord={owner,repo};
 const getRef=async ref=>(await g.getRef({...coord,ref})).data.object.sha;
 const main=async()=>{if(await getRef('heads/main')!==baseSha)fail('main drift');};
 const getCommit=async sha=>{const c=(await g.getCommit({...coord,commit_sha:sha})).data;if(c.sha!==sha||!SHA.test(c.tree?.sha||''))fail('commit mismatch');return c;};
 const getTree=async c=>{const t=(await g.getTree({...coord,tree_sha:c.tree.sha,recursive:'1'})).data;if(t.sha!==c.tree.sha||t.truncated!==false||!Array.isArray(t.tree))fail('tree incomplete');return t.tree;};
 const entry=(tree,path)=>{const rows=tree.filter(x=>x.path===path);if(rows.length!==1||rows[0].mode!=='100644'||rows[0].type!=='blob'||!SHA.test(rows[0].sha||''))fail('file scope '+path);return rows[0];};
 async function read(e){const b=(await g.getBlob({...coord,file_sha:e.sha})).data;if(b.sha!==e.sha||b.encoding!=='base64'||typeof b.content!=='string')fail('blob encoding');const bytes=Buffer.from(b.content,'base64'),text=bytes.toString('utf8');if(bytes.length!==b.size||gitBlobSha(text)!==e.sha)fail('blob mismatch');return text;}
 async function checkExisting(head){
  const c=await getCommit(head),tree=await getTree(c);
  if(tree.filter(x=>x.type!=='tree').length!==3)fail('unexpected data branch paths');
  const m=JSON.parse(await read(entry(tree,MANIFEST)));
  if(c.parents?.length!==1||c.parents[0].sha!==m.snapshotCommit)fail('manifest parent mismatch');
  const snap=await getCommit(m.snapshotCommit),st=await getTree(snap);
  if(st.filter(x=>x.type!=='tree').length!==2||[CATALOG,APPROVALS].some(p=>entry(st,p).sha!==entry(tree,p).sha))fail('snapshot tree mismatch');
  verifySnapshot(m,await read(entry(st,CATALOG)),await read(entry(st,APPROVALS)));
  return {status:'existing-verified',head,manifest:m,branchWritten:false};
 }
 // Never overwrite an existing branch; it may already contain newer data.
 let prior;try{prior=await getRef(REF);}catch(e){if(e.status!==404)throw e;}
 if(prior)return checkExisting(prior);
 if(allowCreate!==true)fail('missing branch; explicit initial creation required');
 await main();
 const base=await getCommit(baseSha),tree=await getTree(base);
 const ct=entry(tree,CATALOG),at=entry(tree,APPROVALS);
 if(ct.sha!==gitBlobSha(catalogText)||at.sha!==gitBlobSha(approvalsText))fail('checkout mismatch');
 facts(catalogText,approvalsText);
 const entries=[ct,at].map(({path,mode,type,sha})=>({path,mode,type,sha}));
 const makeTree=async entries=>{const sha=(await g.createTree({...coord,tree:entries})).data.sha;if(!SHA.test(sha||''))fail('created tree');return sha;};
 const makeCommit=async(tree,parent,message)=>{const sha=(await g.createCommit({...coord,message,tree,parents:[parent]})).data.sha;if(!SHA.test(sha||''))fail('created commit');return sha;};
 const snapshotCommit=await makeCommit(await makeTree(entries),baseSha,'D074 existing approved event snapshot');
 const m=manifest({catalogText,approvalsText,snapshotCommit,codeCommit:baseSha});
 const text=JSON.stringify(m,null,2)+'\n',sha=(await g.createBlob({...coord,content:text,encoding:'utf-8'})).data.sha;
 if(sha!==gitBlobSha(text))fail('manifest blob mismatch');
 const head=await makeCommit(await makeTree([...entries,{path:MANIFEST,mode:'100644',type:'blob',sha}]),snapshotCommit,'D074 initial data manifest');
 const verified=await checkExisting(head);
 await main();
 // Creation only, no updateRef, no main write or force. A race fails closed.
 const created=(await g.createRef({...coord,ref:'refs/'+REF,sha:head})).data;
 if(created.object?.sha!==head)fail('ref creation not confirmed');
 if(await getRef(REF)!==head)fail('published ref drift');
 return {...verified,status:'initialized',branchWritten:true};
}
module.exports={REF,CATALOG,APPROVALS,MANIFEST,manifest,verifySnapshot,bootstrap};
