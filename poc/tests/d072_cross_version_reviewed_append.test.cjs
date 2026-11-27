'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {stageReviewedAcrossVersions}=require('../src/d072_cross_version_reviewed_append.cjs');
const {inspect,prepare}=require('../src/d069_json_review_bridge.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const support=(id,name='カード'+id)=>Array.from({length:5},(_,stage)=>{
 const f=Array(62).fill('0');f[0]=id;f[1]='[Synthetic]'+name;f[3]='2';f[4]=String(stage);f[6]='スピード';f[59]='末脚';return f.join('\t');
}).join('\n')+'\n';
const baselineText=Array.from({length:500},(_,i)=>support(String(10000+i))).join('');
const baseSkills=Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i}));
const source=(commit,supportText,skills)=>{const skillText=JSON.stringify(skills);return {pin:{commit:commit.repeat(40),cardBlob:gitBlobSha(supportText),skillBlob:gitBlobSha(skillText)},supportText,skillText};};
const one=source('a',baselineText+support('39998'),baseSkills);
const two=source('b',one.supportText+support('39999'),[...baseSkills,{id:'999999',name:'New unrelated',rarity:'normal',group:99999}]);
const latest=source('c',two.supportText+support('39997'),[...JSON.parse(two.skillText),{id:'999998',name:'New unrelated 2',rarity:'normal',group:99998}]);
const catalog={schemaVersion:1,cards:[]},approvals={schemaVersion:1,entries:[]};
function item(cardId,source){
 const name='Synthetic title '+cardId;
 const input={cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/'+cardId+'-example',buildId:'synthetic',sourcePin:source.pin,skillText:source.skillText,existingCatalog:catalog,
 body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify({random:[{i:1,n:name,c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}]})}}})};
 const packet=inspect(input),e=packet.events[0];
 const review={schemaVersion:1,publicationApproved:false,cardId,packetSha256:digest(packet),nonSkillPolicy:'omit-explicitly-skill-path-only',events:[{sourceEventId:e.sourceEventId,titleSha256:e.titleSha256,selection:'auto',resultCounts:[1],routeFactsSha256:digest({groups:e.groups}),previousSourceEventId:null}]};
 const prepared=prepare(input,review),event=prepared.card.events[0],fields=['card','event','choices','outcomes','dependencies','publication'];
 const approval={cardId,eventId:event.id,eventSha256:digest(event),reviewer:'synthetic fixture',reviewedAt:'2026-11-27',checks:Object.fromEntries(fields.map(k=>[k,true])),evidence:Object.fromEntries(fields.map(k=>[k,['https://example.org/synthetic']])),publicationBasis:{kind:'original-factual-description',reason:'synthetic fixture'}};
 return {packet,review,titles:new Map([[1,name]]),source,approval};
}
function fixture(){
 const items=[item('39998',one),item('39999',two)];
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:4,rows:items.map(({packet})=>({cardId:packet.cardId,sourcePin:packet.sourcePin,status:'awaiting-fact-review',packetSha256:digest(packet)}))};
 return {items,ledger,baseline:{supportText:baselineText,cardBlob:gitBlobSha(baselineText)},release:latest,existingCatalog:catalog,existingApprovals:approvals,newApprovals:{schemaVersion:1,entries:items.map(x=>x.approval)}};
}
test('different observation pins can append together against a newer verified pin',()=>{
 const x=fixture(),result=stageReviewedAcrossVersions(x);
 a.equal(result.appendedCardCount,2);a.equal(result.appendedEventCount,2);
 a.deepEqual(result.newCardIds,['39998','39999']);
 a.deepEqual(result.proofs.map(p=>p.sourcePin),[one.pin,two.pin]);
 a.ok(result.proofs.every(p=>p.releasePin.commit===latest.pin.commit&&p.matchedSkillIds[0]==='990001'));
 a.deepEqual(result.pending,[{cardId:'39997',reason:'not-yet-fetched'}]);
 a.deepEqual(x.existingCatalog,catalog);a.deepEqual(x.existingApprovals,approvals);
 const first=stageReviewedAcrossVersions({...x,items:[x.items[0]],newApprovals:{schemaVersion:1,entries:[x.items[0].approval]}});
 const second=stageReviewedAcrossVersions({...x,items:[x.items[1]],existingCatalog:first.catalog,existingApprovals:first.approvals,newApprovals:{schemaVersion:1,entries:[x.items[1].approval]}});
 a.deepEqual(second.catalog,result.catalog);a.deepEqual(second.approvals,result.approvals);
});
test('missing or changed target, removed roster ID and changed skill identity fail closed',()=>{
 const x=fixture();
 for(const release of [
  source('d',latest.supportText.replaceAll('[Synthetic]カード39998','[Synthetic]Changed'),JSON.parse(latest.skillText)),
  source('d',latest.supportText.replace(support('39998'),''),JSON.parse(latest.skillText)),
  source('d',latest.supportText,JSON.parse(latest.skillText).map(s=>s.id==='990001'?{...s,name:'Changed'}:s)),
  source('d',latest.supportText,JSON.parse(latest.skillText).map(s=>s.id==='990001'?{...s,group:12345}:s)),
  source('d',latest.supportText,JSON.parse(latest.skillText).map(s=>s.id==='990001'?{...s,rarity:'rare'}:s)),
  source('d',latest.supportText,[...JSON.parse(latest.skillText),{id:'999997',name:'Synthetic 0',rarity:'normal',group:99997}])
 ])a.throws(()=>stageReviewedAcrossVersions({...x,release}),/target|new ID|skill identity|roster IDs/);
 a.throws(()=>stageReviewedAcrossVersions({...x,release:{...latest,skillText:one.skillText}}),/immutable source pin/);
 a.throws(()=>stageReviewedAcrossVersions({...x,items:[{...x.items[0],source:two}]}),/observation pin/);
});
test('independent review, exact packet, all release approvals remain mandatory',()=>{
 const x=fixture();
 a.throws(()=>stageReviewedAcrossVersions({...x,newApprovals:approvals}),/承認/);
 a.throws(()=>stageReviewedAcrossVersions({...x,items:[{...x.items[0],titles:new Map([[1,'wrong']])}]}),/title/);
 a.throws(()=>stageReviewedAcrossVersions({...x,ledger:{...x.ledger,rows:[]}}),/receipt/);
 a.throws(()=>stageReviewedAcrossVersions({...x,existingCatalog:{...catalog,metadata:'changed'}}),/catalog drift/);
});

test('separate fact evidence must match actual title, route facts and topology; release approval is still required',()=>{
 const x=fixture(),{compareIndependentReview,prepareIndependentCandidate,stageIndependentEvidenceAcrossVersions}=require('../src/d072_independent_review.cjs');
 const evidenceFor=(id,p)=>({schemaVersion:1,cardId:id,packetSha256:digest(p),reviewer:'synthetic independent reviewer',reviewedAt:'2026-11-27',evidenceUrls:['https://example.org/synthetic-view'],nonSkillPolicy:'omit-explicitly-skill-path-only',events:[{
  sourceEventId:1,title:'Synthetic title '+id,category:'random',categoryOrdinal:1,selection:'auto',previousSourceEventId:null,
  groups:[{ordinal:1,labelPresent:false,routes:[{ordinal:1,hints:[{skillId:'skill:990001',level:2}],terminal:false,nonSkillCount:0}]}]
 }]});
 const items=x.items.map(i=>({packet:i.packet,source:i.source,evidence:evidenceFor(i.packet.cardId,i.packet)}));
 const {packet,source,evidence}=items[0];
 const m=compareIndependentReview({packet,ledger:x.ledger,evidence});
 a.deepEqual(m.review,x.items[0].review);a.equal(m.receipt.publicationApproved,false);
 a.equal(m.receipt.independentEvidenceSha256,digest(evidence));
 const p=prepareIndependentCandidate({packet,ledger:x.ledger,evidence,skillText:source.skillText,existingCatalog:catalog});
 a.equal(p.candidate.publicationApproved,false);a.equal(p.candidate.eventDigests[0].sha256,x.items[0].approval.eventSha256);
 for(const alter of [
  v=>v.events[0].title+=' wrong',
  v=>v.events[0].previousSourceEventId=2,
  v=>v.events[0].groups[0].routes[0].hints[0].level=3,
  v=>v.events[0].groups[0].routes[0].terminal=true,
  v=>v.events[0].groups[0].routes[0].nonSkillCount=1,
  v=>v.evidenceUrls=[],
  v=>v.reviewedAt='2026-02-30',
  v=>v.packetSha256='0'.repeat(64)
 ]){const v=structuredClone(evidence);alter(v);a.throws(()=>compareIndependentReview({packet,ledger:x.ledger,evidence:v}),/D072 independent review/);}
 const staged=stageIndependentEvidenceAcrossVersions({...x,items});
 a.equal(staged.appendedCardCount,2);a.equal(staged.independentReviewReceipts.length,2);
 a.throws(()=>stageIndependentEvidenceAcrossVersions({...x,items,newApprovals:approvals}),/承認/);
});
