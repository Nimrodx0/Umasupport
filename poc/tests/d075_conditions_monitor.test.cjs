'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const {DOCS,TITLE,probe,checkConditions,requireVerified}=require('../src/d075_conditions_monitor.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {validatePolicy}=require('../src/d073_routine_publication_policy.cjs');
const policy=require('../config/d074-daily-data.v1.json').routinePublicationPolicy;
const body=i=>i.endsWith('-robots')?'User-agent: *\nDisallow: /private\n':'<html>synthetic '+i+'</html>';
const docs=DOCS.map(([id])=>({id,sha256:crypto.createHash('sha256').update(body(id)).digest('hex')}));
const config={schemaVersion:1,baseline:{policySha256:digest(policy),documents:docs}};
function transport({changed,refused,blocked,redirected,oversize}={}){
 const calls=[];
 return {calls,fetchImpl:async(url,opts)=>{
  calls.push(url);a.equal(opts.redirect,'manual');a.equal(opts.credentials,'omit');
  const [id,,type]=DOCS.find(d=>d[1]===url);
  const r=new Response(id===blocked?'User-agent: *\nDisallow: /docs\n':id===oversize?'x'.repeat(2000001):body(id)+(id===changed?' changed':''),{status:id===refused?429:200,headers:{'content-type':type}});
  Object.defineProperty(r,'url',{value:id===redirected?'https://example.org/':url});
  return r;
 }};
}
function fakeGithub(){
 const issues=[],calls=[];
 return {issues,calls,github:{paginate:async()=>issues.filter(i=>i.state==='open'),rest:{issues:{listForRepo:()=>{},create:async x=>{calls.push(x);const row={number:issues.length+1,title:x.title,state:'open'};issues.push(row);return {data:row};}}}}};
}
test('indefinite policy is valid years later; legacy dated policy remains bounded',()=>{
 a.equal(validatePolicy(policy,'2099-01-01'),policy);
 a.throws(()=>validatePolicy({...policy,validThrough:'2099-01-01'},'2026-11-28'),/explicit valid/);
 a.throws(()=>validatePolicy({...policy,schemaVersion:1},'2026-11-28'),/explicit valid/);
 a.throws(()=>validatePolicy({...policy,schemaVersion:1,validThrough:'2026-11-28'},'2026-11-29'),/explicit valid/);
});
test('capture never approves; verify exact reviewed fingerprints; stop first mismatch or refusal',async()=>{
 const f=transport(),waits=[];
 const x=await probe({...f,wait:async n=>waits.push(n)});
 a.deepEqual(x,{status:'captured-not-approved',documents:docs});a.equal(f.calls.length,DOCS.length);a.deepEqual(waits,[6000,6000,6000,6000]);
 a.equal((await probe({...transport(),wait:async()=>{},expected:docs})).status,'verified');
 for(const [options,status,count] of [[{changed:'gametora-privacy'},'document-changed',2],[{refused:'gametora-robots'},'source-refused',1],[{redirected:'gametora-privacy'},'document-unavailable',2],[{oversize:'gametora-privacy'},'document-unavailable',2],[{blocked:'gametora-robots'},'source-refused',2]]){
  const t=transport(options),y=await probe({...t,wait:async()=>{},expected:options.blocked?null:docs});
  a.equal(y.status,status);a.equal(t.calls.length,count);a.doesNotMatch(JSON.stringify(y),/synthetic|<html>/);
 }
});
test('missing baseline holds before network, change latches Issue until explicit closure, no duplicate notification',async()=>{
 const f=fakeGithub(),args={config,policy,github:f.github,owner:'o',repo:'r'};
 let calls=0;
 const observer=async()=>{calls++;return {status:'document-changed',documentId:'gametora-privacy',documents:docs.slice(0,2)};};
 const missing=await checkConditions({...args,config:{schemaVersion:1,baseline:null},observer});a.equal(missing.status,'baseline-unreviewed');a.equal(calls,0);
 a.equal(f.issues[0].title,TITLE);a.equal((await checkConditions({...args,observer})).status,'review-hold');a.equal(calls,0);
 f.issues[0].state='closed';
 const changed=await checkConditions({...args,observer});a.equal(changed.status,'document-changed');a.equal(calls,1);
 a.equal((await checkConditions({...args,observer})).status,'review-hold');a.equal(calls,1);a.equal(f.calls.length,2);
 f.issues[1].state='closed';
 const verified=await checkConditions({...args,observer:async()=>({status:'verified',documents:docs})});
 a.equal(requireVerified(verified,policy,config),true);a.equal(requireVerified({...verified,policySha256:'0'.repeat(64)},policy,config),false);
 await a.rejects(checkConditions({...args,observer:async()=>({status:'verified',documents:[]})}),/observer mismatch/);
});

test('all inline GitHub scripts compile, including the live handoff',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const filename of ['derived-github-pending-intake.yml','d075-condition-baseline.yml']){
  const lines=fs.readFileSync(path.join(__dirname,'../../.github/workflows',filename),'utf8').split('\n');
  let n=0;
  for(let i=0;i<lines.length;i++){
   if(!/^\s*script: \|\s*$/.test(lines[i]))continue;
   const indent=lines[i].match(/^\s*/)[0].length;
   const body=[];
   for(let j=i+1;j<lines.length;j++){
    if(lines[j].trim()&&lines[j].match(/^\s*/)[0].length<=indent)break;
    body.push(lines[j].slice(indent+2));
   }
   a.doesNotThrow(()=>new AsyncFunction('github','context','core',body.join('\n')),filename+':'+(i+1));n++;
  }
  a.ok(n>0,filename);
 }
});
