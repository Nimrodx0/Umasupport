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
function access({github,owner,repo}={}){
 if(!github?.rest?.git||!owner||!repo)fail('scope');
 const g=github.rest.git,coord={owner,repo};
 const getRef=async ref=>(await g.getRef({...coord,ref})).data.object.sha;
 const main=async baseSha=>{if(!SHA.test(baseSha||'')||await getRef('heads/main')!==baseSha)fail('main drift');};
 const getCommit=async sha=>{const c=(await g.getCommit({...coord,commit_sha:sha})).data;if(c.sha!==sha||!SHA.test(c.tree?.sha||''))fail('commit mismatch');return c;};
 const getTree=async c=>{const t=(await g.getTree({...coord,tree_sha:c.tree.sha,recursive:'1'})).data;if(t.sha!==c.tree.sha||t.truncated!==false||!Array.isArray(t.tree))fail('tree incomplete');return t.tree;};
 const entry=(tree,path)=>{const rows=tree.filter(x=>x.path===path);if(rows.length!==1||rows[0].mode!=='100644'||rows[0].type!=='blob'||!SHA.test(rows[0].sha||''))fail('file scope '+path);return rows[0];};
 async function read(e){const b=(await g.getBlob({...coord,file_sha:e.sha})).data;if(b.sha!==e.sha||b.encoding!=='base64'||typeof b.content!=='string'||!Number.isSafeInteger(b.size)||b.size<0||b.size>15000000||b.content.length>22000000)fail('blob encoding');const bytes=Buffer.from(b.content,'base64'),text=bytes.toString('utf8');if(bytes.length!==b.size||gitBlobSha(text)!==e.sha)fail('blob mismatch');return text;}
 async function readVersion(head){
  const c=await getCommit(head),tree=await getTree(c);
  if(tree.filter(x=>x.type!=='tree').length!==3)fail('unexpected data branch paths');
  const m=JSON.parse(await read(entry(tree,MANIFEST)));
  if(c.parents?.length!==1||c.parents[0].sha!==m.snapshotCommit)fail('manifest parent mismatch');
  const snap=await getCommit(m.snapshotCommit),st=await getTree(snap);
  if(st.filter(x=>x.type!=='tree').length!==2||[CATALOG,APPROVALS].some(p=>entry(st,p).sha!==entry(tree,p).sha))fail('snapshot tree mismatch');
  const catalogText=await read(entry(st,CATALOG)),approvalsText=await read(entry(st,APPROVALS));
  verifySnapshot(m,catalogText,approvalsText);
  if(snap.parents?.length!==1||snap.parents[0].sha!==(m.previousManifestCommit??m.codeCommit))fail('snapshot parent mismatch');
  return {head,manifest:m,catalogText,approvalsText,snapshotMessage:snap.message,manifestMessage:c.message};
 }
 async function checkExisting(head){
  const cur=await readVersion(head),m=cur.manifest;
  if(m.revision>1){
   const prior=await readVersion(m.previousManifestCommit);
   if(prior.manifest.revision!==m.revision-1)fail('revision discontinuity');
   const msg=cur.snapshotMessage;
   if(typeof msg!=='string'||Buffer.byteLength(msg)>60000)fail('append receipt message');
   const match=/^D074 reviewed data append ([a-f0-9]{64})\n\n([\s\S]+)$/.exec(msg);
   if(!match||cur.manifestMessage!=='D074 data manifest '+match[1])fail('append receipt message');
   const p=JSON.parse(match[2]),r=p?.receipt;
   if(!exact(p,'schemaVersion,dataKind,previousManifestCommit,revision,receipt')||p.schemaVersion!==1||
      p.dataKind!=='d074-reviewed-data-append'||p.previousManifestCommit!==prior.head||p.revision!==m.revision||
      digest(p)!==match[1]||r?.baseSha!==m.codeCommit)fail('append receipt coordinates');
   const result={catalog:JSON.parse(cur.catalogText),approvals:JSON.parse(cur.approvalsText),
    status:'ready-to-append',existingCatalogUnchanged:true,newCardIds:r.newCardIds,appendedCardCount:r.after.cards-r.before.cards,
    appendedEventCount:r.after.events-r.before.events,releasePin:r.releasePin,proofs:r.proofs,
    independentReviewReceipts:r.independentReviewReceipts,sourceFactReceipts:r.sourceFactReceipts};
   const reconstructed=require('./d072_release_proposal.cjs').validateAppend({old:JSON.parse(prior.catalogText),
    approvals:JSON.parse(prior.approvalsText),result,baseSha:m.codeCommit});
   if(digest(reconstructed)!==digest(r))fail('append receipt mismatch');
  }
  const {snapshotMessage,manifestMessage,...value}=cur;return value;
 }
 const makeTree=async entries=>{const sha=(await g.createTree({...coord,tree:entries})).data.sha;if(!SHA.test(sha||''))fail('created tree');return sha;};
 const makeCommit=async(tree,parent,message)=>{const sha=(await g.createCommit({...coord,message,tree,parents:[parent]})).data.sha;if(!SHA.test(sha||''))fail('created commit');return sha;};
 const makeBlob=async(path,content)=>{const sha=(await g.createBlob({...coord,content,encoding:'utf-8'})).data.sha;if(sha!==gitBlobSha(content))fail('created blob mismatch');return {path,mode:'100644',type:'blob',sha};};
 return {g,coord,getRef,main,getCommit,getTree,entry,checkExisting,makeTree,makeCommit,makeBlob};
}
const publicReport=(x,status,branchWritten)=>({status,head:x.head,manifest:x.manifest,branchWritten});
async function readCurrent(args){const a=access(args);return a.checkExisting(await a.getRef(REF));}
async function bootstrap({github,owner,repo,baseSha,catalogText,approvalsText,allowCreate=false}={}){
 if(!SHA.test(baseSha||''))fail('scope');
 const {g,coord,getRef,main,getCommit,getTree,entry,checkExisting,makeTree,makeCommit}=access({github,owner,repo});
 // Never overwrite an existing branch; it may already contain newer data.
 let prior;try{prior=await getRef(REF);}catch(e){if(e.status!==404)throw e;}
 if(prior)return publicReport(await checkExisting(prior),'existing-verified',false);
 if(allowCreate!==true)fail('missing branch; explicit initial creation required');
 await main(baseSha);
 const base=await getCommit(baseSha),tree=await getTree(base);
 const ct=entry(tree,CATALOG),at=entry(tree,APPROVALS);
 if(ct.sha!==gitBlobSha(catalogText)||at.sha!==gitBlobSha(approvalsText))fail('checkout mismatch');
 facts(catalogText,approvalsText);
 const entries=[ct,at].map(({path,mode,type,sha})=>({path,mode,type,sha}));
 const snapshotCommit=await makeCommit(await makeTree(entries),baseSha,'D074 existing approved event snapshot');
 const m=manifest({catalogText,approvalsText,snapshotCommit,codeCommit:baseSha});
 const text=JSON.stringify(m,null,2)+'\n',sha=(await g.createBlob({...coord,content:text,encoding:'utf-8'})).data.sha;
 if(sha!==gitBlobSha(text))fail('manifest blob mismatch');
 const head=await makeCommit(await makeTree([...entries,{path:MANIFEST,mode:'100644',type:'blob',sha}]),snapshotCommit,'D074 initial data manifest');
 const verified=await checkExisting(head);
 await main(baseSha);
 // Creation only, no updateRef, no main write or force. A race fails closed.
 const created=(await g.createRef({...coord,ref:'refs/'+REF,sha:head})).data;
 if(created.object?.sha!==head)fail('ref creation not confirmed');
 if(await getRef(REF)!==head)fail('published ref drift');
 return publicReport(verified,'initialized',true);
}
// Explicit reviewed append only. readCurrent is the new data authority;
// the main checkout remains the code authority and fixed recovery fixture.
async function appendReviewed({github,owner,repo,baseSha,expectedHead,mode='plan',evidence,newApprovals,attestations,publicationDecisions,routinePublicationPolicy,
 intake=require('./d072_github_reviewed_intake.cjs').createReviewedIntake({github,owner,repo})}={}){
 if(!SHA.test(baseSha||'')||!SHA.test(expectedHead||'')||!['plan','publish'].includes(mode))fail('append scope');
 const {g,coord,getRef,main,checkExisting,makeTree,makeCommit,makeBlob}=access({github,owner,repo});
 const stable=async()=>{await main(baseSha);if(await getRef(REF)!==expectedHead)fail('data head drift');};
 await stable();
 const old=await checkExisting(expectedHead);
 const catalog=JSON.parse(old.catalogText),approvals=JSON.parse(old.approvalsText);
 const result=await intake.stage({evidence,newApprovals,attestations,publicationDecisions,routinePublicationPolicy,existingCatalog:catalog,existingApprovals:approvals});
 const receipt=require('./d072_release_proposal.cjs').validateAppend({old:catalog,approvals,result,baseSha});
 if(!Array.isArray(evidence)||evidence.length!==receipt.newCardIds.length||evidence.some((x,i)=>x?.cardId!==receipt.newCardIds[i]||
   x.packetSha256!==receipt.proofs.find(p=>p.cardId===x.cardId)?.packetSha256))fail('evidence coordinates mismatch');
 const proof={schemaVersion:1,dataKind:'d074-reviewed-data-append',previousManifestCommit:expectedHead,revision:old.manifest.revision+1,receipt};
 const proofSha=digest(proof),message='D074 reviewed data append '+proofSha+'\n\n'+JSON.stringify(proof);
 if(Buffer.byteLength(message)>60000)fail('receipt too large');
 const json=x=>JSON.stringify(x,null,2)+'\n';
 const catalogText=json(result.catalog),approvalsText=json(result.approvals);
 facts(catalogText,approvalsText);
 const summary={status:'planned',baseSha,previousHead:expectedHead,revision:proof.revision,newCardIds:receipt.newCardIds,
  before:receipt.before,after:receipt.after,receiptSha256:proofSha,branchWritten:false,mainWritten:false,pagesDeployed:false,publicRawVerified:false};
 await stable();
 if(mode==='plan')return summary;
 const entries=[await makeBlob(CATALOG,catalogText),await makeBlob(APPROVALS,approvalsText)];
 const snapshotCommit=await makeCommit(await makeTree(entries),expectedHead,message);
 const m=manifest({catalogText,approvalsText,snapshotCommit,codeCommit:baseSha,revision:proof.revision,previousManifestCommit:expectedHead});
 const head=await makeCommit(await makeTree([...entries,await makeBlob(MANIFEST,json(m))]),snapshotCommit,'D074 data manifest '+proofSha);
 const verified=await checkExisting(head);
 if(digest(verified.manifest)!==digest(m)||verified.catalogText!==catalogText||verified.approvalsText!==approvalsText)fail('prepared snapshot mismatch');
 await stable();
 // Only a descendant of the exact prior head, no force, no reset. Never
 // retry an ambiguous write. Another writer's sibling commit must conflict.
 const updated=await g.updateRef({...coord,ref:REF,sha:head,force:false});
 if(updated.data.object?.sha!==head||await getRef(REF)!==head)fail('published ref not confirmed');
 return {...summary,status:'published-ref',head,snapshotCommit,manifest:m,branchWritten:true};
}
module.exports={REF,CATALOG,APPROVALS,MANIFEST,manifest,verifySnapshot,bootstrap,readCurrent,appendReviewed};
