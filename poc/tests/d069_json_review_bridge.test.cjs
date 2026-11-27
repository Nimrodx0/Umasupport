'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {inspect,prepare,append}=require('../src/d069_json_review_bridge.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const cardId='39999',skillText=JSON.stringify([...Array.from({length:100},(_,i)=>({id:String(800000+i),name:'合成'+i,rarity:'normal',group:i})),{id:'990001',name:'架空スキル',rarity:'normal',group:101}]);
function fixture(doc,text=skillText){
 return {cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/39999-example',buildId:'synthetic',
  body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify(doc)}}}),
  skillText:text,sourcePin:{commit:'a'.repeat(40),cardBlob:'b'.repeat(40),skillBlob:gitBlobSha(text)},existingCatalog:{schemaVersion:1,cards:[]}};
}
const e=(i,c)=>({i,n:'架空イベント'+i,c}),g=(o,r)=>({o,r});
const pt={t:'pt',v:'+5'},hint={t:'sk',v:'+2',d:990001};
// Test fixture ONLY. The production module never manufactures review records.
function review(p){return {schemaVersion:1,publicationApproved:false,cardId:p.cardId,packetSha256:digest(p),nonSkillPolicy:'omit-explicitly-skill-path-only',
 events:p.events.map(e=>({sourceEventId:e.sourceEventId,titleSha256:e.titleSha256,selection:e.selection,resultCounts:e.groups.map(g=>g.routes.length),routeFactsSha256:digest({groups:e.groups}),previousSourceEventId:e.category==='arrows'&&e.categoryOrdinal>1?p.events.find(x=>x.category==='arrows'&&x.categoryOrdinal===e.categoryOrdinal-1).sourceEventId:null}))};}
test('generic packet, exact review, explicit outcomes and ordinary chain are private',()=>{
 const input=fixture({arrows:[e(11,[g('選択A',[hint,{t:'di'},pt]),g('選択B',[pt,{t:'ee'}])]),e(12,[g('',[hint])])],random:[e(13,[g('',[pt])])]});
 const p=inspect(input);a.equal(p.status,'awaiting-independent-fact-review');
 a.doesNotMatch(JSON.stringify(p),/架空イベント|選択A|架空スキル/);
 const r=prepare(input,review(p));a.equal(r.card.events.length,3);a.equal(r.publicationApproved,false);
 a.equal(r.card.events[0].choices[0].outcomes.length,2);a.equal(r.card.events[0].choices[1].terminal,true);
 a.deepEqual(r.card.events[1].requires,{all:[{eventId:'gt-json:39999:11'}]});
 a.equal(r.omissions.length,3);a.equal(r.card.events[0].choices[0].outcomes[0].rewards[0].verifiedSkillName,'架空スキル');
 a.throws(()=>prepare(input,{...review(p),packetSha256:'0'.repeat(64)}),/stale/);
 const invalid=review(p);invalid.events[1].previousSourceEventId=null;a.throws(()=>prepare(input,invalid),/predecessor/);
 a.throws(()=>append({inputs:[input],reviews:[review(p)],existingCatalog:input.existingCatalog,skillText}),/roster blob mismatch/);
});
test('unresolved codes, special events, ambiguous groups and unrecognized skill IDs stay held',()=>{
 for(const doc of [{special:[e(1,[g('',[hint])])]},{random:[e(1,[g('',[{t:'ds'}])])]},{random:[e(1,[g('',[{t:'xx'}])])]},{random:[e(1,[g('',[{...hint,d:990002}])])]},{random:[e(1,[g('only label',[pt])])]}]){
  const input=fixture(doc),p=inspect(input);a.equal(p.status,'held');a.throws(()=>prepare(input,review(p)),/held/);
 }
 const input=fixture({random:[e(1,[g('',[pt])])]});
 a.throws(()=>inspect({...input,sourcePin:{...input.sourcePin,skillBlob:'0'.repeat(40)}}),/pin/);
 a.throws(()=>inspect({...input,existingCatalog:{schemaVersion:1,cards:[{cardId}]}}),/already imported/);
});
test('even a reviewed packet cannot be reused after source or catalog changes',()=>{
 const input=fixture({random:[e(1,[g('',[hint])])]}),v=review(inspect(input));
 const changed=fixture({random:[e(1,[g('',[{...hint,v:'+3'}])])]});
 a.throws(()=>prepare(changed,v),/stale/);
 a.throws(()=>prepare({...input,existingCatalog:{schemaVersion:1,cards:[{cardId:'39998',events:[]}]}},v),/stale/);
});

test('generic approved append actually traverses the existing gate and preserves old data',()=>{
 const supportRow=(id,stage)=>{
  const f=Array(62).fill('0');f[0]=id;f[1]='[Synthetic]カード'+id;f[3]='2';f[4]=String(stage);f[6]='スピード';f[59]='末脚';return f.join('\t');
 };
 const before=Array.from({length:500},(_,i)=>String(10000+i)).flatMap(id=>Array.from({length:5},(_,j)=>supportRow(id,j))).join('\n')+'\n';
 const current=before+['39999','39998'].flatMap(id=>Array.from({length:5},(_,j)=>supportRow(id,j))).join('\n')+'\n';
 const discovery=require('../src/new_card_event_incremental.cjs').discoverNewCardsFromUmaSim({previousSupportText:before,currentSupportText:current});
 const input=fixture({random:[e(1,[g('',[hint])])]});
 input.sourcePin.cardBlob=gitBlobSha(current);
 const v=review(inspect(input)),candidate=prepare(input,v);
 const checks=Object.fromEntries(['card','event','choices','outcomes','dependencies','publication'].map(k=>[k,true]));
 const evidence=Object.fromEntries(Object.keys(checks).map(k=>[k,['https://example.org/synthetic']]));
 const entry={cardId,eventId:candidate.card.events[0].id,eventSha256:digest(candidate.card.events[0]),reviewer:'synthetic fixture',reviewedAt:'2026-11-27',checks,evidence,publicationBasis:{kind:'original-factual-description',reason:'synthetic fixture'}};
 const old={schemaVersion:1,entries:[]},model=require('../src/live_loader.js').buildModel(current);
 const args={inputs:[input],reviews:[v],existingCatalog:input.existingCatalog,existingApprovals:old,
  newApprovals:{schemaVersion:1,entries:[entry]},discovery,model,skillText,currentSupportText:current,previousSupportText:before};
 const out=append(args);a.equal(out.appendedEventCount,1);
 const packet=inspect(input),ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:2,rows:[{cardId,sourcePin:input.sourcePin,status:'awaiting-fact-review',packetSha256:digest(packet)}]};
 const {inputs,...rest}=args;
 const resumedArgs={...rest,packets:[packet],titles:[new Map([[1,'架空イベント1']])],ledger};
 const {appendResumed}=require('../src/d069_json_review_bridge.cjs');
 a.deepEqual(appendResumed(resumedArgs),out);
 a.throws(()=>appendResumed({...resumedArgs,newApprovals:{schemaVersion:1,entries:[]}}),/承認/);a.equal(out.existingCatalogUnchanged,true);
 a.equal(out.catalog.cards[0].events[0].rewards[0].skillId,'skill:990001');
 a.deepEqual(input.existingCatalog.cards,[]);a.deepEqual(old.entries,[]);
 a.throws(()=>append({...args,newApprovals:{schemaVersion:1,entries:[]}}),/承認/);
 a.throws(()=>append({...args,newApprovals:{schemaVersion:1,entries:[{...entry,eventSha256:'0'.repeat(64)}]}}),/SHA|変更|ハッシュ/);
 a.throws(()=>append({...args,currentSupportText:before}),/roster blob/);
 // A second card acquired against the same empty catalog may be published
 // after the first card, without changing its archived packet or approval.
 const second={...input,cardId:'39998',sourceUrl:'https://gametora.com/ja/umamusume/supports/39998-example',body:input.body.replace('39999','39998')};
 const p2=inspect(second),v2=review(p2),c2=prepare(second,v2);
 const entry2={...entry,cardId:'39998',eventId:c2.card.events[0].id,eventSha256:digest(c2.card.events[0])};
 const ledger2={...ledger,rows:[...ledger.rows,{cardId:'39998',sourcePin:second.sourcePin,status:'awaiting-fact-review',packetSha256:digest(p2)}]};
 const a2={...resumedArgs,packets:[p2],reviews:[v2],titles:[new Map([[1,'架空イベント1']])],ledger:ledger2,existingCatalog:out.catalog,existingApprovals:out.approvals,newApprovals:{schemaVersion:1,entries:[entry2]}};
 const result2=appendResumed(a2);
 a.equal(result2.appendedEventCount,1);a.deepEqual(result2.catalog.cards[0],out.catalog.cards[0]);a.deepEqual(result2.approvals.entries[0],out.approvals.entries[0]);
 a.throws(()=>appendResumed({...a2,newApprovals:{schemaVersion:1,entries:[]}}),/承認/);
 a.throws(()=>appendResumed({...a2,existingCatalog:{...out.catalog,changed:true}}),/catalog drift/);
 a.throws(()=>appendResumed({...a2,existingCatalog:result2.catalog}),/already imported/);
});

test('resume uses durable receipt and exact independently supplied title, not raw JSON',()=>{
 const {resume}=require('../src/d069_json_review_bridge.cjs');
 const input=fixture({random:[e(1,[g('',[hint])])]}),packet=inspect(input),v=review(packet);
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:2,rows:[{cardId,sourcePin:input.sourcePin,status:'awaiting-fact-review',packetSha256:digest(packet)}]};
 const args={packet,titles:new Map([[1,'架空イベント1']]),skillText,existingCatalog:input.existingCatalog,ledger,review:v};
 a.deepEqual(resume(args),prepare(input,v));
 a.throws(()=>resume({...args,titles:new Map([[1,'架空イベント１']])}),/title/);
 a.throws(()=>resume({...args,ledger:{...ledger,rows:[]}}),/receipt/);
 const changed=structuredClone(packet);changed.events[0].groups[0].routes[0].hints[0].level=5;
 a.throws(()=>resume({...args,packet:changed,review:review(changed)}),/receipt/);
 a.throws(()=>resume({...args,existingCatalog:{schemaVersion:1,cards:[{cardId:'39998',events:[]}]}}),/drift/);
});

test('JSON-only oracle: explicit choice and result position, hint IDs/Lv and non-skill count survive conversion',()=>{
 const input=fixture({arrows:[
  e(101,[g('A',[hint,pt,{t:'di'},{...hint,v:'+3'},{t:'ee'}]),g('B',[pt,{t:'5s',v:'+3'}])]),
  e(102,[g('',[{...hint,v:'+1'},{t:'fe'}])])],
  random:[e(103,[g('',[pt])])]});
 const packet=inspect(input);
 const projection=packet.events.map(e=>({id:e.sourceEventId,category:e.category,ordinal:e.categoryOrdinal,selection:e.selection,
  groups:e.groups.map(g=>({ordinal:g.ordinal,label:g.labelPresent,routes:g.routes.map(r=>({ordinal:r.ordinal,
   hints:r.hints,terminal:r.terminal,nonSkillCount:r.nonSkillCount,unresolved:r.unresolved}))}))}));
 const route=(ordinal,hints,terminal,nonSkillCount)=>({ordinal,hints,terminal,nonSkillCount,unresolved:[]});
 const h=(level,sourceOrdinal)=>({skillId:'skill:990001',level,sourceOrdinal});
 a.deepEqual(projection,[
  {id:101,category:'arrows',ordinal:1,selection:'choice',groups:[
   {ordinal:1,label:true,routes:[route(1,[h(2,1)],false,1),route(2,[h(3,4)],true,0)]},
   {ordinal:2,label:true,routes:[route(1,[],false,6)]}]},
  {id:102,category:'arrows',ordinal:2,selection:'auto',groups:[{ordinal:1,label:false,routes:[route(1,[h(1,1)],false,1)]}]},
  {id:103,category:'random',ordinal:1,selection:'auto',groups:[{ordinal:1,label:false,routes:[route(1,[],false,1)]}]}
 ]);
 a.equal(packet.status,'awaiting-independent-fact-review');a.equal(packet.publicationApproved,false);
 a.equal(Object.hasOwn(packet,'domEvidence'),false);
 a.throws(()=>prepare(input,undefined),/review/);
});
test('JSON-only review rejects new semantic fields and malformed hint/flow rather than silently adopting them',()=>{
 const cases=[
  {random:[{...e(1,[g('',[hint])]),unexpected:true}]},
  {random:[e(1,[{...g('',[hint]),unexpected:true}])]},
  {random:[e(1,[g('',[{...hint,d:'990001'}])])]},
  {random:[e(1,[g('',[{t:'ee',v:'+1'}])])]},
  {random:[e(1,[g('',[{t:'en',v:'+1/+2'}])])]},
  {random:[e(1,[g('',[{t:'sg',v:null,d:990001}])])]}
 ];
 for(const doc of cases){const input=fixture(doc),p=inspect(input);a.equal(p.status,'held');a.ok(p.reasonCodes.length);a.throws(()=>prepare(input,review(p)),/held/);}
});
