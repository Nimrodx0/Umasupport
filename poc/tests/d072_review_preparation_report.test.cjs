'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {prepareReport}=require('../src/d072_review_preparation_report.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const base='a'.repeat(40),tree='b'.repeat(40);
function fixture(){
 const catalogText=JSON.stringify({schemaVersion:1,cards:[]}),evidence=[{cardId:'39998',title:'Synthetic title'}];
 const event={id:'gt-json:39998:1',name:'Synthetic title',type:'auto',rewards:[]};
 const packetSha256='c'.repeat(64);
 const item={candidate:{publicationApproved:false,packetSha256,card:{cardId:'39998',events:[event]},
  eventDigests:[{eventId:event.id,sha256:digest(event)}],omissions:[]},
  receipt:{cardId:'39998',packetSha256,independentEvidenceSha256:digest(evidence[0]),publicationApproved:false}};
 const state={main:base,read:0};
 const github={rest:{git:{getRef:async()=>({data:{object:{sha:state.main}}}),
  getCommit:async()=>({data:{sha:base,tree:{sha:tree}}}),
  getTree:async()=>({data:{sha:tree,truncated:false,tree:[{path:'poc/data/reviewed_events.v1.json',type:'blob',mode:'100644',sha:gitBlobSha(catalogText)}]}})}}};
 const intake={prepare:async args=>{state.read++;a.deepEqual(args.evidence,evidence);return {publicationApproved:false,items:[item]};}};
 return {state,item,args:{github,owner:'test',repo:'repo',baseSha:base,catalogText,evidence,intake}};
}
test('read-only preparation reports exact event digests without title, source prose or approval',async()=>{
 const f=fixture(),report=await prepareReport(f.args);
 a.equal(report.publicationApproved,false);a.equal(f.state.read,1);
 a.deepEqual(report.cards[0].events,f.item.candidate.eventDigests);
 a.doesNotMatch(JSON.stringify(report),/Synthetic title|reviewer|publicationBasis/);
 a.deepEqual(report.requiredChecks,['card','event','choices','outcomes','dependencies','publication']);
});
test('reject changed base, candidate receipt or candidate content',async()=>{
 const f=fixture();await a.rejects(prepareReport({...f.args,catalogText:f.args.catalogText+' '}),/catalog mismatch/);a.equal(f.state.read,0);
 const g=fixture();g.state.main='d'.repeat(40);await a.rejects(prepareReport(g.args),/main drift/);a.equal(g.state.read,0);
 const h=fixture();h.item.candidate.card.events[0].name='changed';await a.rejects(prepareReport(h.args),/receipt mismatch/);
 const i=fixture();i.item.receipt.independentEvidenceSha256='d'.repeat(64);await a.rejects(prepareReport(i.args),/receipt mismatch/);
 const j=fixture();const original=j.args.intake.prepare;j.args.intake.prepare=async args=>{const p=await original(args);j.state.main='d'.repeat(40);return p;};
 await a.rejects(prepareReport(j.args),/main drift after/);
});
