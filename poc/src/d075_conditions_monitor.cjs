'use strict';
// Fixed public policy documents, no card data. Exact byte fingerprints are
// intentionally conservative; no automatic enrollment or approval.
const {createHash}=require('node:crypto');
const {digest}=require('./event_release_gate.cjs');
const {checkRobots}=require('./d069_card_json_transport.cjs');
const DOCS=Object.freeze([
 ['gametora-robots','https://gametora.com/robots.txt','text/plain'],
 ['gametora-privacy','https://gametora.com/privacy-policy','text/html'],
 ['gametora-cla','https://gametora.com/docs/cla','text/html'],
 ['cygames-robots','https://umamusume.jp/robots.txt','text/plain'],
 ['cygames-guidelines','https://umamusume.jp/derivativework_guidelines/','text/html']
].map(Object.freeze));
const SHA=/^[a-f0-9]{64}$/,TITLE='D075 external conditions review required';
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===k.split(',').sort().join(',');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function validateBaseline(config,policy){
 if(!exact(config,'schemaVersion,baseline')||config.schemaVersion!==1)throw Error('D075 baseline config');
 if(config.baseline===null)return null;
 const b=config.baseline;
 if(!exact(b,'policySha256,documents')||b.policySha256!==digest(policy)||!Array.isArray(b.documents)||b.documents.length!==DOCS.length||
 b.documents.some((d,i)=>!exact(d,'id,sha256')||d.id!==DOCS[i][0]||!SHA.test(d.sha256||'')))throw Error('D075 baseline not bound to policy or fixed documents');
 return b;
}
async function probe({fetchImpl=fetch,wait=sleep,expected=null}={}){
 const documents=[],robots=new Map();
 for(const [id,url,type] of DOCS){
  try{
   const u=new URL(url);
   if(documents.length)await wait(6000);
   if(!id.endsWith('-robots'))checkRobots(robots.get(u.origin),u.pathname);
   const r=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-policy-monitor/1.0','Accept':type}});
   if([401,403,429,451].includes(r.status))return {status:'source-refused',documentId:id,documents};
   if(r.status!==200||r.url!==url||!String(r.headers.get('content-type')).toLowerCase().includes(type)||!r.body?.getReader)
    return {status:'document-unavailable',documentId:id,documents};
   const rd=r.body.getReader(),chunks=[];let n=0;
   try{while(true){const {done,value}=await rd.read();if(done)break;n+=value.length;if(n>(id.endsWith('-robots')?100000:2000000))throw Error('cap');chunks.push(Buffer.from(value));}}
   finally{await rd.cancel().catch(()=>{});}
   if(!n)throw Error('empty');
   const bytes=Buffer.concat(chunks),sha256=createHash('sha256').update(bytes).digest('hex');
   documents.push({id,sha256});
   if(expected&&expected[documents.length-1].sha256!==sha256)return {status:'document-changed',documentId:id,documents};
   if(id.endsWith('-robots'))robots.set(u.origin,bytes.toString('utf8'));
  }catch(e){return {status:require('./d069_card_json_transport.cjs').failureCode(e)==='source-refused'?'source-refused':'document-unavailable',documentId:id,documents};}
 }
 return {status:expected?'verified':'captured-not-approved',documents};
}
async function checkConditions({config,policy,github,owner,repo,observer=probe}={}){
 const policySha256=digest(policy),coord={owner,repo};
 const open=await github.paginate(github.rest.issues.listForRepo,{...coord,state:'open',per_page:100});
 const holds=open.filter(x=>!x.pull_request&&x.title===TITLE);
 if(holds.length>1)throw Error('D075 duplicate review holds');
 if(holds.length)return {status:'review-hold',policySha256,issueNumber:holds[0].number};
 let b;
 try{b=validateBaseline(config,policy);}catch{b=undefined;}
 const result=b===null?{status:'baseline-unreviewed'}:b===undefined?{status:'baseline-invalid'}:await observer({expected:b.documents});
 if(result.status==='verified'){
  if(digest(result.documents)!==digest(b.documents))throw Error('D075 observer mismatch');
  return {status:'verified',policySha256,baselineSha256:digest(b)};
 }
 const issue=await github.rest.issues.create({...coord,title:TITLE,body:[
  'Automatic event intake/publication is held. No automatic baseline acceptance.',
  'Reason: '+result.status+'; document: '+(result.documentId||'none'),
  'Policy SHA-256: '+policySha256,
  'Observed fingerprints: '+JSON.stringify(result.documents||[]),
  'Review the actual public documents and conditions; commit a reviewed baseline bound to the policy, then close this Issue explicitly. Do not close on an unexplained change.',
  'No document body, card JSON or source text stored.'
 ].join('\n')});
 return {status:result.status,policySha256,issueNumber:issue.data.number};
}
function requireVerified(report,policy,config){
 const b=validateBaseline(config,policy);
 return !!b&&report?.status==='verified'&&report.policySha256===digest(policy)&&report.baselineSha256===digest(b);
}
module.exports={DOCS,TITLE,probe,checkConditions,validateBaseline,requireVerified};
