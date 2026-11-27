'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const {createSourceReader}=require('../src/d072_verified_umasim_source.cjs');
const {gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
const {createReviewedIntake}=require('../src/d072_github_reviewed_intake.cjs');
const {digest}=require('../src/event_release_gate.cjs');
const {inspect,prepare}=require('../src/d069_json_review_bridge.cjs');
function gitFixture(){
 const commit='a'.repeat(40),treeSha='b'.repeat(40),support='synthetic roster',skills='synthetic dictionary';
 const pin={commit,cardBlob:gitBlobSha(support),skillBlob:gitBlobSha(skills)};
 const files=[{path:'data/support_card.txt',mode:'100644',type:'blob',sha:pin.cardBlob},{path:'data/skill_data.txt',mode:'100644',type:'blob',sha:pin.skillBlob}];
 const texts=new Map([[pin.cardBlob,support],[pin.skillBlob,skills]]);
 const calls=[],state={};
 const check=(x)=>{a.equal(x.owner,'mee1080');a.equal(x.repo,'umasim');};
 const github={rest:{repos:{getCommit:async x=>{check(x);calls.push(['commit',x.ref]);return {data:{sha:state.commit??commit,commit:{tree:{sha:treeSha}}}};}},git:{
  getTree:async x=>{check(x);a.equal(x.tree_sha,treeSha);a.equal(x.recursive,'1');calls.push(['tree']);return {data:{sha:treeSha,truncated:state.truncated??false,tree:state.files??files}};},
  getBlob:async x=>{check(x);calls.push(['blob',x.file_sha]);const text=texts.get(x.file_sha);return {data:{sha:x.file_sha,encoding:'base64',size:Buffer.byteLength(text),content:Buffer.from(state.badBlob?'bad':text).toString('base64')}};}
 }}};
 return {pin,support,skills,github,calls,state,files};
}
test('verify same-commit file coordinates and blob contents, cache only immutable coordinates',async()=>{
 const f=gitFixture(),s=createSourceReader(f.github);
 a.deepEqual(await s.latest(),{pin:f.pin,supportText:f.support,skillText:f.skills});
 a.deepEqual(await s.load(f.pin),{pin:f.pin,supportText:f.support,skillText:f.skills});
 a.equal(f.calls.filter(x=>x[0]==='blob').length,2);
 await a.rejects(s.load({...f.pin,skillBlob:f.pin.cardBlob}),/commit\/blob path mismatch/);
 await a.rejects(s.resolve('other'),/commit coordinate/);
});
test('truncated trees, duplicate paths, bad bytes and changed commit fail closed',async()=>{
 for(const alter of [f=>f.state.truncated=true,f=>f.state.files=[...f.files,f.files[0]],f=>f.state.badBlob=true]){
  const f=gitFixture();alter(f);await a.rejects(createSourceReader(f.github).load(f.pin),/incomplete tree|immutable file missing|blob encoding\/size|blob content mismatch/);
 }
 const f=gitFixture();f.state.commit='c'.repeat(40);await a.rejects(createSourceReader(f.github).load(f.pin),/commit mismatch/);
});
test('GitHub preparation and staging require durable receipt, separately supplied evidence and final approval',async()=>{
 const cardId='39998',name='Synthetic event';
 const support=(id)=>Array.from({length:5},(_,stage)=>{const f=Array(62).fill('0');f[0]=id;f[1]='[Synthetic]カード'+id;f[3]='2';f[4]=String(stage);f[6]='スピード';f[59]='末脚';return f.join('\t');}).join('\n')+'\n';
 const before=Array.from({length:500},(_,i)=>support(String(10000+i))).join(''),supportText=before+support(cardId);
 const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
 const pin={commit:'a'.repeat(40),cardBlob:gitBlobSha(supportText),skillBlob:gitBlobSha(skillText)},sourceInput={pin,supportText,skillText};
 const existingCatalog={schemaVersion:1,cards:[]},existingApprovals={schemaVersion:1,entries:[]};
 const packet=inspect({retainIdentifyingTitles:true,cardId,sourceUrl:'https://gametora.com/ja/umamusume/supports/'+cardId+'-example',buildId:'synthetic',sourcePin:pin,skillText,existingCatalog,
  body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify({random:[{i:1,n:name,c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}]})}}})});
 const ledger={schemaVersion:1,dataKind:'d069-json-attempt-ledger',revision:2,rows:[{cardId,sourcePin:pin,status:'awaiting-fact-review',packetSha256:digest(packet)}]};
 let reads=0;
 const store={load:async()=>structuredClone(ledger),loadPacket:async id=>{a.equal(id,cardId);reads++;return structuredClone(packet);}};
 const source={load:async p=>{a.deepEqual(p,pin);return sourceInput;},latest:async()=>sourceInput,baseline:async()=>({cardBlob:gitBlobSha(before),supportText:before}),historicalSkill:async()=>skillText};
 const evidence={schemaVersion:1,cardId,packetSha256:digest(packet),reviewer:'synthetic',reviewedAt:'2026-11-27',evidenceUrls:['https://example.org/synthetic'],nonSkillPolicy:'omit-explicitly-skill-path-only',events:[{sourceEventId:1,title:name,category:'random',categoryOrdinal:1,selection:'auto',previousSourceEventId:null,groups:[{ordinal:1,labelPresent:false,routes:[{ordinal:1,hints:[{skillId:'skill:990001',level:2}],terminal:false,nonSkillCount:0}]}]}]};
 const intake=createReviewedIntake({store,source}),prep=await intake.prepare({evidence:[evidence],existingCatalog});
 a.equal(prep.publicationApproved,false);a.equal(reads,1);
 const event=prep.items[0].candidate.card.events[0],fields=['card','event','choices','outcomes','dependencies','publication'];
 const entry={cardId,eventId:event.id,eventSha256:digest(event),reviewer:'synthetic',reviewedAt:'2026-11-27',checks:Object.fromEntries(fields.map(k=>[k,true])),evidence:Object.fromEntries(fields.map(k=>[k,['https://example.org/synthetic']])),publicationBasis:{kind:'original-factual-description',reason:'synthetic fixture'}};
 const args={evidence:[evidence],existingCatalog,existingApprovals,newApprovals:{schemaVersion:1,entries:[entry]}};
 const result=await intake.stage(args);
 a.equal(result.appendedCardCount,1);a.equal(result.appendedEventCount,1);
 a.equal(result.independentReviewReceipts[0].packetSha256,digest(packet));
 const {eventId,eventSha256,...common}=entry;
 const attestations=[{...common,schemaVersion:1,packetSha256:digest(packet),independentEvidenceSha256:digest(evidence),events:[{eventId,sha256:eventSha256}]}];
 const {newApprovals,...compact}=args;
 a.deepEqual(await intake.stage({...compact,attestations}),result);
 await a.rejects(intake.stage({...compact,attestations:[]}),/batch scope/);
 await a.rejects(intake.stage({...args,attestations}),/exactly one/);
 await a.rejects(intake.stage(compact),/exactly one/);
 await a.rejects(intake.stage({...compact,attestations:[{...attestations[0],events:[]}]}),/digest coverage/);
 await a.rejects(intake.stage({...args,newApprovals:existingApprovals}),/承認/);
 await a.rejects(intake.prepare({evidence:[{...evidence,packetSha256:'0'.repeat(64)}],existingCatalog}),/receipt unavailable/);
 const titleInput={dataKind:'d073-source-title-input',schemaVersion:1,cardId,packetSha256:digest(packet),titles:[{sourceEventId:1,title:name}],chainEvidence:null};
 const preparedSource=await intake.prepare({evidence:[titleInput],existingCatalog});
 a.deepEqual(preparedSource.items[0].candidate.card,prep.items[0].candidate.card);
 a.equal(preparedSource.items[0].receipt.independentGameVerification,false);
 a.equal(preparedSource.items[0].receipt.independentEvidenceSha256,undefined);
 const sourceResult=await intake.stage({...args,evidence:[titleInput]});
 a.deepEqual(sourceResult.catalog,result.catalog);a.deepEqual(sourceResult.approvals,result.approvals);
 a.deepEqual(sourceResult.independentReviewReceipts,[]);a.equal(sourceResult.sourceFactReceipts.length,1);
 await a.rejects(intake.stage({...args,evidence:[titleInput],newApprovals:existingApprovals}),/承認/);
 await a.rejects(intake.prepare({evidence:[{...titleInput,titles:[{sourceEventId:1,title:'wrong'}]}],existingCatalog}),/title/);
 const archivedInput={...titleInput,titles:null};
 const archivedPrep=(await intake.prepare({evidence:[archivedInput],existingCatalog})).items[0];
 a.deepEqual(archivedPrep,preparedSource.items[0]);
 const decision={schemaVersion:1,cardId,packetSha256:digest(packet),receiptSha256:digest(archivedPrep.receipt),
  eventDigestsSha256:digest({events:archivedPrep.candidate.eventDigests}),reviewer:'synthetic',reviewedAt:'2026-11-27',
  accessConditionsReviewed:true,publicationApproved:true,evidenceUrls:['https://example.org/synthetic'],
  publicationBasis:{kind:'original-factual-description',reason:'synthetic fixture'}};
 const autoArgs={evidence:[archivedInput],existingCatalog,existingApprovals,publicationDecisions:[decision]};
 const auto=await intake.stage(autoArgs);
 a.deepEqual(auto.catalog,result.catalog);a.equal(auto.approvals.entries[0].eventSha256,entry.eventSha256);
 a.match(auto.approvals.entries[0].reviewer,/mechanical facts/);
 a.deepEqual(auto.approvals.entries[0].evidence.publication,decision.evidenceUrls);
 a.deepEqual(auto.independentReviewReceipts,[]);
 for(const change of [{accessConditionsReviewed:false},{publicationApproved:false},{receiptSha256:'0'.repeat(64)},{eventDigestsSha256:'0'.repeat(64)},{evidenceUrls:[]}]){
  await a.rejects(intake.stage({...autoArgs,publicationDecisions:[{...decision,...change}]}),/publication decision/);
 }
 await a.rejects(intake.stage({...autoArgs,newApprovals:args.newApprovals}),/exactly one/);
 const today=new Date().toISOString().slice(0,10);
 const policy={schemaVersion:1,scope:'D073-normal-random-skill-path-identifying-titles-only',reviewer:'synthetic common reviewer',reviewedAt:today,validThrough:today,
  accessConditionsReviewed:true,publicationApproved:true,evidenceUrls:['https://example.org/synthetic-policy'],
  publicationBasis:{kind:'original-factual-description',reason:'synthetic common policy only'}};
 const commonArgs={evidence:[archivedInput],existingCatalog,existingApprovals,routinePublicationPolicy:policy};
 const commonResult=await intake.stage(commonArgs);
 a.deepEqual(commonResult.catalog,result.catalog);
 a.equal(commonResult.approvals.entries[0].eventSha256,entry.eventSha256);
 a.ok(commonResult.approvals.entries[0].publicationBasis.reason.includes(digest(policy)));
 a.deepEqual(commonResult.approvals.entries[0].evidence.publication,policy.evidenceUrls);
 a.deepEqual(commonResult.independentReviewReceipts,[]);
 for(const change of [{accessConditionsReviewed:false},{publicationApproved:false},{validThrough:'2000-01-01'},{reviewedAt:'2999-01-01'},{scope:'all-cards'},{evidenceUrls:[]}]){
  await a.rejects(intake.stage({...commonArgs,routinePublicationPolicy:{...policy,...change}}),/routine policy/);
 }
 await a.rejects(intake.stage({...commonArgs,evidence:[titleInput]}),/outside routine scope/);
 await a.rejects(intake.stage({...commonArgs,publicationDecisions:[decision]}),/exactly one/);
 ledger.rows.push({cardId:'39999',sourcePin:pin,status:'uncertain',packetSha256:null,failureCode:'source-refused'});
 await a.rejects(intake.stage(commonArgs),/prior source refusal/);
 ledger.rows.pop();
 // Exercise the full staging path again with an ordinary three-stage chain.
 const p=inspect({retainIdentifyingTitles:true,cardId,sourceUrl:packet.sourceUrl,buildId:'synthetic',sourcePin:pin,skillText,existingCatalog,
  body:JSON.stringify({pageProps:{sourceData:{support_id:Number(cardId)},eventData:{ja:JSON.stringify({arrows:[1,2,3].map(i=>({i,n:'Synthetic stage '+i,c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]}))})}}})});
 const chainLedger={...ledger,rows:[{...ledger.rows[0],packetSha256:digest(p)}]};
 const chainIntake=createReviewedIntake({source,store:{load:async()=>structuredClone(chainLedger),loadPacket:async()=>structuredClone(p)}});
 const chainInput={...archivedInput,packetSha256:digest(p),chainEvidence:require('../src/d073_json_adoption.cjs').ordinaryChainEvidence(p)};
 const chainArgs={...commonArgs,evidence:[chainInput]};
 await a.rejects(chainIntake.stage(chainArgs),/outside routine scope/);
 const expanded={...policy,scope:'D073-normal-random-and-ordinary-chain-skill-path-identifying-titles-only'};
 const chainResult=await chainIntake.stage({...chainArgs,routinePublicationPolicy:expanded});
 a.equal(chainResult.appendedEventCount,3);
 a.equal(chainResult.sourceFactReceipts[0].chainEvidenceSha256,digest(chainInput.chainEvidence));
 a.equal(chainResult.sourceFactReceipts[0].independentGameVerification,false);
 a.deepEqual(chainResult.catalog.cards[0].events[2].requires,{all:[{eventId:'gt-json:'+cardId+':2'}]});
 const current=await intake.verifyCurrent({existingCatalog,existingApprovals});
 a.equal(current.currentRosterCount,501);a.equal(current.sourceRequestsToGameTora,0);a.equal(current.publicationChanged,false);
});
