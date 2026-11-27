'use strict';
// Dedicated Git ref. Non-force fast-forward of a child of the exact read
// head is the atomic compare-and-set. No force, merge, retries, or resets.
const {verify}=require('./d069_json_attempt_ledger.cjs');
const {canonical}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const REF='heads/state/d069-json-attempts',PATH='.d069/attempt-ledger.json';
const SHA=/^[a-f0-9]{40}$/;
const fail=s=>{throw Error('D069 Git attempt store: '+s);};
const same=(a,b)=>canonical(a)===canonical(b);
function transition(old,next){
 verify(old);verify(next);
 if(next.revision!==old.revision+1||next.rows.length<old.rows.length)fail('revision or deletion');
 const added=next.rows.slice(old.rows.length);
 let changed=0;
 for(let i=0;i<old.rows.length;i++){
  const a=old.rows[i],b=next.rows[i];
  if(same(a,b))continue;
  if(a.status!=='reserved'||b.status==='reserved'||a.cardId!==b.cardId||!same(a.sourcePin,b.sourcePin))fail('invalid row transition');
  changed++;
 }
 if(added.length){
  if(changed||added.length>2||added.some(x=>x.status!=='reserved'))fail('invalid reservation');
 }else if(changed<1||changed>2)fail('invalid completion');
 return next;
}
function createStore({github,owner,repo,ref=REF}={}){
 // Production ref only. Test ref is deliberately distinct and caller
 // must explicitly create it; never initialize/reset an absent live ref.
 if(!github?.rest?.git||!github?.rest?.repos||!owner||!repo||
    ![REF,'heads/test/d069-attempt-store'].includes(ref))fail('scope');
 const g=github.rest.git,coord={owner,repo};
 async function read(){
  const head=(await g.getRef({...coord,ref})).data.object?.sha;
  if(!SHA.test(head||''))fail('head');
  const commit=(await g.getCommit({...coord,commit_sha:head})).data;
  if(!SHA.test(commit.tree?.sha||''))fail('tree');
  const file=(await github.rest.repos.getContent({...coord,path:PATH,ref:head})).data;
  if(file?.type!=='file'||file.encoding!=='base64'||!SHA.test(file.sha||'')||
     typeof file.content!=='string'||file.content.length>1400000)fail('file');
  const raw=Buffer.from(file.content,'base64').toString('utf8');
  if(gitBlobSha(raw)!==file.sha)fail('blob hash');
  return {head,tree:commit.tree.sha,state:verify(JSON.parse(raw))};
 }
 return {
  load:async()=>structuredClone((await read()).state),
  compareAndSet:async(old,next)=>{
   transition(old,next);
   const cur=await read();
   if(!same(cur.state,old))return false;
   const raw=JSON.stringify(next,null,2)+'\n';
   const blob=(await g.createBlob({...coord,content:raw,encoding:'utf-8'})).data.sha;
   if(blob!==gitBlobSha(raw))fail('created blob mismatch');
   const tree=(await g.createTree({...coord,base_tree:cur.tree,tree:[{path:PATH,mode:'100644',type:'blob',sha:blob}]})).data.sha;
   if(!SHA.test(tree||''))fail('created tree');
   const commit=(await g.createCommit({...coord,message:'D069 attempt ledger revision '+next.revision,tree,parents:[cur.head]})).data.sha;
   if(!SHA.test(commit||''))fail('created commit');
   try{
    const r=await g.updateRef({...coord,ref,sha:commit,force:false});
    if(r.data.object?.sha!==commit)fail('ref confirmation');
   }catch(e){
    if([409,422].includes(e.status))return false;
    throw e;
   }
   // A later concurrent reservation may advance the ref. This commit
   // must still have been accepted; do not retry an ambiguous response.
   return true;
  }
 };
}
module.exports={createStore,transition,REF,PATH};
