'use strict';
// Produce only a content-bound proposal from independently reviewed and
// individually approved records. Never merge, deploy or manufacture evidence.
const {canonical,digest,verifyRelease,secureUrl}=require('./event_release_gate.cjs');
const {gitBlobSha}=require('./current_umasim_roster_delta.cjs');
const {createReviewedIntake}=require('./d072_github_reviewed_intake.cjs');
const CATALOG='poc/data/reviewed_events.v1.json',APPROVALS='poc/config/event-release-approvals.gt2487.v2.json',
 STATUS='docs/project/status.md',ENTRY='index.html',LIVE='poc/live.html';
const PATHS=[CATALOG,APPROVALS,STATUS,ENTRY,LIVE];
const SHA=/^[a-f0-9]{40}$/;
const fail=m=>{throw Error('D072 release proposal: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const count=c=>({cards:c.cards.length,events:c.cards.reduce((n,x)=>n+x.events.length,0)});
function render({files,result,baseSha}){
 if(!SHA.test(baseSha||'')||PATHS.some(p=>typeof files?.[p]!=='string'))fail('fixed base files required');
 const old=JSON.parse(files[CATALOG]),approvals=JSON.parse(files[APPROVALS]);
 verifyRelease(old,approvals);verifyRelease(result.catalog,result.approvals);
 const sources=result.sourceFactReceipts??[],independent=result.independentReviewReceipts;
 if(!Array.isArray(sources)||!Array.isArray(independent))fail('review receipt arrays');
 const receipts=[...independent,...sources];
 const validSource=x=>x?.dataKind==='d073-source-fact-receipt'&&x.schemaVersion===1&&x.independentGameVerification===false&&
  Object.keys(x).sort().join(',')==='cardId,chainEvidenceSha256,chainEvidenceUrls,dataKind,independentGameVerification,packetSha256,publicationApproved,schemaVersion,sourceFactsSha256,titleInputSha256'&&
  /^[a-f0-9]{64}$/.test(x.sourceFactsSha256||'')&&/^[a-f0-9]{64}$/.test(x.titleInputSha256||'')&&
  Array.isArray(x.chainEvidenceUrls)&&x.chainEvidenceUrls.length<=20&&x.chainEvidenceUrls.every(secureUrl)&&
  (x.chainEvidenceSha256===null?x.chainEvidenceUrls.length===0:/^[a-f0-9]{64}$/.test(x.chainEvidenceSha256||'')&&x.chainEvidenceUrls.length>0);
 if(sources.some(x=>!validSource(x)))fail('source receipt shape');
 const before=count(old),after=count(result.catalog),ids=result.catalog.cards.slice(before.cards).map(c=>c.cardId);
 if(approvals.schemaVersion!==2||result.approvals.schemaVersion!==2||
    !['ready-to-append','partial-append'].includes(result.status)||result.existingCatalogUnchanged!==true||
    ids.length<1||ids.length>2||!same(ids,result.newCardIds)||ids.length!==result.appendedCardCount||
    after.events-before.events!==result.appendedEventCount||result.appendedEventCount<1||
    !same({...result.catalog,cards:result.catalog.cards.slice(0,before.cards)},old)||
    !same({...result.approvals,entries:result.approvals.entries.slice(0,approvals.entries.length)},approvals)||
    result.approvals.entries.length-approvals.entries.length!==result.appendedEventCount||
    !Array.isArray(result.independentReviewReceipts)||!Array.isArray(result.proofs)||
    receipts.length!==ids.length||result.proofs.length!==ids.length||
    ids.some(id=>{const a=receipts.filter(x=>x.cardId===id),b=result.proofs.filter(x=>x.cardId===id);
     return a.length!==1||b.length!==1||a[0].publicationApproved!==false||
      a[0].packetSha256!==b[0].packetSha256||!same(b[0].releasePin,result.releasePin)||
      !(sources.includes(a[0])?validSource(a[0]):/^[a-f0-9]{64}$/.test(a[0].independentEvidenceSha256||''));}))fail('non-destructive approved append proof');
 const receipt={schemaVersion:1,dataKind:'d072-reviewed-release-proposal',baseSha,releasePin:result.releasePin,
  beforeCatalogSha256:digest(old),afterCatalogSha256:digest(result.catalog),
  beforeApprovalsSha256:digest(approvals),afterApprovalsSha256:digest(result.approvals),
  newCardIds:ids,before,after,proofs:result.proofs,independentReviewReceipts:independent,...(sources.length?{sourceFactReceipts:sources}:{}),
  deploymentVerified:false};
 const proposalSha=digest(receipt),receiptPath='poc/config/d072-release-receipts/'+proposalSha+'.json';
 const version='d072-'+proposalSha.slice(0,16),entry=files[ENTRY],live=files[LIVE];
 const match=live.match(/data-release="([a-zA-Z0-9-]+)"/g);
 if(match?.length!==1)fail('release version marker');
 const oldVersion=match[0].slice(14,-1);
 const tokens=[...live.matchAll(/\?v=([a-zA-Z0-9-]+)/g),...entry.matchAll(/\?v=([a-zA-Z0-9-]+)/g)];
 if(tokens.length<3||tokens.some(x=>x[1]!==oldVersion)||!entry.includes('?v='+oldVersion))fail('mixed release versions');
 const field=/公開イベント（公開JSON実測）：\*\*([\d,]+)件\*\*／\*\*([\d,]+)カード\*\*/g;
 const status=files[STATUS],matches=[...status.matchAll(field)];
 if(matches.length!==1||Number(matches[0][1].replaceAll(',',''))!==before.events||Number(matches[0][2].replaceAll(',',''))!==before.cards||
    !status.includes('## 現在の到達点と残る課題\n'))fail('status count or heading mismatch');
 const fmt=n=>n.toLocaleString('en-US');
 const nextStatus=status.replace(field,'公開イベント（公開JSON実測）：**'+fmt(after.events)+'件**／**'+fmt(after.cards)+'カード**')
  .replace('## 現在の到達点と残る課題\n','## 現在の到達点と残る課題\n\n**D-072 増分公開提案 '+proposalSha.slice(0,16)+'**：対象 '+ids.join('、')+'、'+result.appendedEventCount+'件を個別承認と固定出典照合に基づき追記。既存DB・台帳不変。[固定証跡](../../'+receiptPath+')。このコミットのCI・main統合・Pages配信・公開受入は別途確認する。\n');
 const json=x=>JSON.stringify(x,null,2)+'\n';
 const output={[CATALOG]:json(result.catalog),[APPROVALS]:json(result.approvals),[STATUS]:nextStatus,
  [ENTRY]:entry.replaceAll('?v='+oldVersion,'?v='+version),
  [LIVE]:live.replaceAll(oldVersion,version),[receiptPath]:json(receipt)};
 return {proposalSha,branch:'automation/d072-release-'+proposalSha.slice(0,24),version,receipt,files:output};
}
async function propose({github,owner,repo,baseSha,files,evidence,newApprovals,attestations,publicationDecisions,mode='plan',intake=createReviewedIntake({github,owner,repo})}={}){
 if(!['plan','branch','pr'].includes(mode)||!SHA.test(baseSha||'')||!github?.rest?.git||!owner||!repo)fail('proposal scope');
 const g=github.rest.git,coord={owner,repo};
 const main=async()=>(await g.getRef({...coord,ref:'heads/main'})).data.object.sha;
 if(await main()!==baseSha)fail('main drift');
 const commit=(await g.getCommit({...coord,commit_sha:baseSha})).data;
 if(commit.sha!==baseSha||!SHA.test(commit.tree?.sha||''))fail('base commit mismatch');
 const tree=(await g.getTree({...coord,tree_sha:commit.tree.sha,recursive:'1'})).data;
 if(tree.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree))fail('incomplete base tree');
 for(const path of PATHS){
  const entries=tree.tree.filter(x=>x.path===path);
  if(entries.length!==1||entries[0].type!=='blob'||entries[0].mode!=='100644'||typeof files?.[path]!=='string'||
     gitBlobSha(files[path])!==entries[0].sha)fail('base file mismatch: '+path);
 }
 const result=await intake.stage({evidence,newApprovals,attestations,publicationDecisions,existingCatalog:JSON.parse(files[CATALOG]),existingApprovals:JSON.parse(files[APPROVALS])});
 const plan=render({files,result,baseSha});
 const summary={proposalSha:plan.proposalSha,branch:plan.branch,version:plan.version,newCardIds:plan.receipt.newCardIds,
  before:plan.receipt.before,after:plan.receipt.after,baseSha,releasePin:plan.receipt.releasePin,
  branchWritten:false,merged:false,deployed:false};
 if(await main()!==baseSha)fail('main drift after review');
 if(mode==='plan')return summary;
 if(tree.tree.some(x=>x.path in plan.files&&!PATHS.includes(x.path)))fail('receipt already exists');
 const entries=[];
 for(const [path,content] of Object.entries(plan.files)){
  const sha=(await g.createBlob({...coord,content,encoding:'utf-8'})).data.sha;
  if(sha!==gitBlobSha(content))fail('created blob mismatch');
  entries.push({path,mode:'100644',type:'blob',sha});
 }
 const targetTree=(await g.createTree({...coord,base_tree:commit.tree.sha,tree:entries})).data.sha;
 if(!SHA.test(targetTree||''))fail('created tree');
 // No ref update: an existing branch must be the same exact proposal or
 // the run fails. Creation is atomic; main is never written.
 const ref='heads/'+plan.branch;
 async function existing(){
  try{return (await g.getRef({...coord,ref})).data.object.sha;}
  catch(e){if(e.status===404)return null;throw e;}
 }
 async function confirm(sha){
  const c=(await g.getCommit({...coord,commit_sha:sha})).data;
  if(c.sha!==sha||c.tree?.sha!==targetTree||c.parents?.length!==1||c.parents[0].sha!==baseSha)fail('proposal branch collision');
  const verified={...summary,branchWritten:true,headSha:sha};
  return mode==='pr'?require('./d072_release_pr.cjs').openProposalPR({github,owner,repo,proposal:verified}):verified;
 }
 if(await main()!==baseSha)fail('main drift before branch creation');
 const prior=await existing();if(prior)return confirm(prior);
 const sha=(await g.createCommit({...coord,message:'D072 reviewed event release proposal '+plan.proposalSha,tree:targetTree,parents:[baseSha]})).data.sha;
 if(!SHA.test(sha||'')||await main()!==baseSha)fail('created commit or main drift');
 try{
  const created=(await g.createRef({...coord,ref:'refs/'+ref,sha})).data;
  if(created.object?.sha!==sha)fail('branch creation not confirmed');
 }catch(e){
  if(e.status!==422)throw e;
  const raced=await existing();if(!raced)throw e;return confirm(raced);
 }
 return confirm(sha);
}
module.exports={PATHS,render,propose};
