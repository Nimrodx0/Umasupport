'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {manifest,verifySnapshot,bootstrap,readCurrent,appendReviewed,REF,CATALOG,APPROVALS,MANIFEST}=require('../src/d074_event_data_branch.cjs');
const {digest}=require('../src/event_release_gate.cjs'),{gitBlobSha}=require('../src/current_umasim_roster_delta.cjs');
const base='a'.repeat(40),snap='b'.repeat(40);
const e={id:'test:1',name:'Synthetic',type:'auto',rewards:[]};
const keys=['card','event','choices','outcomes','dependencies','publication'];
const catalog={schemaVersion:1,cards:[{cardId:'39998',coverageStatus:'partial',events:[e]}]};
const approvals={schemaVersion:2,cohorts:[],entries:[{cardId:'39998',eventId:e.id,eventSha256:digest(e),reviewer:'synthetic',reviewedAt:'2026-11-28',checks:Object.fromEntries(keys.map(k=>[k,true])),evidence:Object.fromEntries(keys.map(k=>[k,['https://example.org/synthetic']])),publicationBasis:{kind:'original-factual-description',reason:'synthetic'}}]};
const json=x=>JSON.stringify(x,null,2)+'\n',catalogText=json(catalog),approvalsText=json(approvals);
test('manifest binds exact bytes, approved content, counts, revision and fixed coordinates',()=>{
 const m=manifest({catalogText,approvalsText,snapshotCommit:snap,codeCommit:base});
 a.equal(m.cardCount,1);a.equal(m.eventCount,1);a.deepEqual(verifySnapshot(m,catalogText,approvalsText),m);
 a.throws(()=>verifySnapshot(m,catalogText+' ',approvalsText),/digest/);
 a.throws(()=>verifySnapshot({...m,eventCount:2},catalogText,approvalsText),/digest/);
 a.throws(()=>verifySnapshot({...m,extra:true},catalogText,approvalsText),/shape/);
 a.throws(()=>manifest({catalogText,approvalsText:json({...approvals,entries:[]}),snapshotCommit:snap,codeCommit:base}));
});
function fixture({seedCatalog=catalog,seedApprovals=approvals}={}){
 const catalogText=json(seedCatalog),approvalsText=json(seedApprovals);
 const refs=new Map([['heads/main',base]]),commits=new Map(),trees=new Map(),blobs=new Map(),writes=[];
 let serial=10;const id=()=> (++serial).toString(16).padStart(40,'0');
 const data=x=>({data:x});const blob=text=>{const sha=gitBlobSha(text);blobs.set(sha,text);return sha;};
 const entries=[{path:CATALOG,mode:'100644',type:'blob',sha:blob(catalogText)},{path:APPROVALS,mode:'100644',type:'blob',sha:blob(approvalsText)}];
 const bt=id();trees.set(bt,entries);commits.set(base,{sha:base,tree:{sha:bt},parents:[]});
 const github={rest:{pulls:{list:async()=>data([])},git:{
  getRef:async({ref})=>{if(!refs.has(ref))throw Object.assign(Error('missing'),{status:404});return data({object:{sha:refs.get(ref)}});},
  getCommit:async({commit_sha})=>data(commits.get(commit_sha)),
  getTree:async({tree_sha})=>data({sha:tree_sha,truncated:false,tree:trees.get(tree_sha)}),
  getBlob:async({file_sha})=>{const text=blobs.get(file_sha);return data({sha:file_sha,encoding:'base64',size:Buffer.byteLength(text),content:Buffer.from(text).toString('base64')});},
  createBlob:async({content})=>{writes.push('blob');return data({sha:blob(content)});},
  createTree:async({tree})=>{writes.push('tree');const sha=id();trees.set(sha,tree);return data({sha});},
  createCommit:async({tree,parents,message})=>{writes.push('commit');const sha=id();commits.set(sha,{sha,tree:{sha:tree},parents:parents.map(sha=>({sha})),message});return data({sha});},
  updateRef:async({ref,sha,force})=>{a.equal(ref,REF);a.equal(force,false);const prior=commits.get(commits.get(sha).parents[0].sha).parents[0].sha;if(refs.get(ref)!==prior)throw Object.assign(Error('non-fast-forward'),{status:422});writes.push('update');refs.set(ref,sha);return data({object:{sha}});},
  createRef:async({ref,sha})=>{a.equal(ref,'refs/'+REF);writes.push('ref');refs.set(REF,sha);return data({object:{sha}});}
 }}};
 return {refs,commits,trees,writes,args:{github,owner:'o',repo:'r',baseSha:base,catalogText,approvalsText,allowCreate:true}};
}
test('seed is atomic, verified before ref creation, re-run read only and main unchanged',async()=>{
 const f=fixture();
 await a.rejects(bootstrap({...f.args,allowCreate:false}),/explicit initial/);a.deepEqual(f.writes,[]);
 const r=await bootstrap(f.args);
 a.equal(r.status,'initialized');a.equal(r.branchWritten,true);a.equal(f.refs.get('heads/main'),base);
 a.equal(f.refs.get(REF),r.head);a.equal(f.writes.at(-1),'ref');
 a.deepEqual(f.trees.get(f.commits.get(r.head).tree.sha).map(x=>x.path).sort(),[CATALOG,APPROVALS,MANIFEST].sort());
 const n=f.writes.length,again=await bootstrap({...f.args,allowCreate:false});
 a.equal(again.status,'existing-verified');a.equal(again.branchWritten,false);a.equal(f.writes.length,n);
 f.trees.get(f.commits.get(r.head).tree.sha).push({path:'unexpected',type:'blob'});
 await a.rejects(bootstrap(f.args),/unexpected data branch paths/);
});
test('changed checkout or main stops before any writes',async()=>{
 const f=fixture();await a.rejects(bootstrap({...f.args,catalogText:catalogText+' '}),/checkout mismatch/);a.deepEqual(f.writes,[]);
 f.refs.set('heads/main',snap);await a.rejects(bootstrap(f.args),/main drift/);a.deepEqual(f.writes,[]);
});

const pin={commit:'c'.repeat(40),cardBlob:'d'.repeat(40),skillBlob:'e'.repeat(40)};
const packetSha256='1'.repeat(64),cardId='39999';
function addition(oldCatalog,oldApprovals,id=cardId){
 const event={id:'test:'+id,name:'Synthetic new',type:'auto',rewards:[]};
 return {catalog:{...oldCatalog,cards:[...oldCatalog.cards,{cardId:id,coverageStatus:'partial',events:[event]}]},
  approvals:{...oldApprovals,entries:[...oldApprovals.entries,{...approvals.entries[0],cardId:id,eventId:event.id,eventSha256:digest(event)}]},
  status:'ready-to-append',existingCatalogUnchanged:true,newCardIds:[id],appendedCardCount:1,appendedEventCount:1,releasePin:pin,
  proofs:[{cardId:id,packetSha256,sourcePin:pin,releasePin:pin,matchedSkillIds:[]}],
  independentReviewReceipts:[{schemaVersion:1,cardId:id,packetSha256,independentEvidenceSha256:'2'.repeat(64),reviewer:'synthetic',reviewedAt:'2026-11-28',evidenceUrls:['https://example.org/synthetic'],publicationApproved:false}]};
}
async function appendFixture(){
 const f=fixture(),seed=await bootstrap(f.args);
 const args={github:f.args.github,owner:'o',repo:'r',baseSha:base,expectedHead:seed.head,evidence:[{cardId,packetSha256}],newApprovals:{synthetic:true},
  intake:{stage:async x=>addition(x.existingCatalog,x.existingApprovals)}};
 return {f,seed,args};
}
test('approved plan read only; publish atomically changes only data ref; fixed receipt and next revision',async()=>{
 const {f,seed,args}=await appendFixture(),n=f.writes.length;
 const plan=await appendReviewed(args);a.equal(plan.status,'planned');a.equal(f.writes.length,n);
 a.equal(plan.revision,2);a.deepEqual(plan.before,{cards:1,events:1});a.deepEqual(plan.after,{cards:2,events:2});
 const pub=await appendReviewed({...args,mode:'publish'});a.equal(pub.branchWritten,true);a.equal(pub.receiptSha256,plan.receiptSha256);
 a.equal(f.refs.get('heads/main'),base);a.equal(f.refs.get(REF),pub.head);a.equal(f.writes.at(-1),'update');
 const curr=await readCurrent(args);a.equal(curr.manifest.revision,2);a.equal(curr.manifest.previousManifestCommit,seed.head);
 a.deepEqual(JSON.parse(curr.catalogText).cards.slice(0,1),catalog.cards);
 a.deepEqual(JSON.parse(curr.approvalsText).entries.slice(0,1),approvals.entries);
 const msg=f.commits.get(pub.snapshotCommit).message,proof=JSON.parse(msg.split('\n\n')[1]);
 a.equal(digest(proof),pub.receiptSha256);
 const writes=f.writes.length;
 await a.rejects(appendReviewed({...args,mode:'publish'}),/data head drift/);a.equal(f.writes.length,writes);
 const id='39996',next=await appendReviewed({...args,expectedHead:pub.head,evidence:[{cardId:id,packetSha256}],mode:'publish',intake:{stage:async x=>addition(x.existingCatalog,x.existingApprovals,id)}});
 a.equal(next.revision,3);a.deepEqual(next.before,{cards:2,events:2});a.deepEqual(next.after,{cards:3,events:3});
});
test('unapproved, modified prior, mismatched evidence, and drift all fail before ref change',async()=>{
 for(const alter of [
  x=>{x.approvals.entries.pop();},
  x=>{x.catalog.cards[0].events[0].name='changed';x.approvals.entries[0].eventSha256=digest(x.catalog.cards[0].events[0]);},
  x=>{x.proofs[0].packetSha256='3'.repeat(64);x.independentReviewReceipts[0].packetSha256='3'.repeat(64);}
 ]){
  const {f,seed,args}=await appendFixture(),n=f.writes.length;
  args.intake={stage:async x=>{const r=addition(x.existingCatalog,x.existingApprovals);alter(r);return r;}};
  await a.rejects(appendReviewed({...args,mode:'publish'}));a.equal(f.writes.length,n);a.equal(f.refs.get(REF),seed.head);
 }
 const {f,seed,args}=await appendFixture(),n=f.writes.length;
 args.intake={stage:async x=>{f.refs.set('heads/main',snap);return addition(x.existingCatalog,x.existingApprovals);}};
 await a.rejects(appendReviewed({...args,mode:'publish'}),/main drift/);a.equal(f.writes.length,n);a.equal(f.refs.get(REF),seed.head);
});
test('concurrent non-fast-forward write fails, no force or silent retry',async()=>{
 const {f,args}=await appendFixture();let calls=0;
 f.args.github.rest.git.updateRef=async()=>{calls++;throw Object.assign(Error('non-fast-forward'),{status:422});};
 await a.rejects(appendReviewed({...args,mode:'publish'}),/non-fast-forward/);a.equal(calls,1);a.equal(f.refs.get(REF),args.expectedHead);
});

test('routine queue receipts bind the staged candidate before any git objects are created',async()=>{
 const {f,args}=await appendFixture();
 const r=addition(catalog,approvals),source={dataKind:'d073-source-fact-receipt',schemaVersion:1,cardId,packetSha256,
  sourceFactsSha256:'4'.repeat(64),titleInputSha256:'5'.repeat(64),chainEvidenceSha256:null,chainEvidenceUrls:[],independentGameVerification:false,publicationApproved:false};
 r.independentReviewReceipts=[];r.sourceFactReceipts=[source];
 args.intake={stage:async()=>structuredClone(r)};
 const expectedRoutine=[{cardId,receiptSha256:digest(source),eventDigestsSha256:digest({events:r.catalog.cards.at(-1).events.map(e=>({eventId:e.id,sha256:digest(e)}))})}];
 const n=f.writes.length;
 await a.rejects(appendReviewed({...args,mode:'publish',expectedRoutine:[{...expectedRoutine[0],eventDigestsSha256:'0'.repeat(64)}]}),/routine receipt changed/);
 a.equal(f.writes.length,n);
 const plan=await appendReviewed({...args,expectedRoutine});a.equal(plan.status,'planned');
 const pub=await appendReviewed({...args,expectedRoutine,mode:'publish'});a.equal(pub.branchWritten,true);
 const {verifyPublicRaw}=require('../src/d074_event_data_branch.cjs');
 const read=await readCurrent(args);
 const raw=await verifyPublicRaw({owner:'o',repo:'r',report:pub,attempts:1,fetchImpl:async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(pub.manifest):url.endsWith(CATALOG)?read.catalogText:read.approvalsText)});
 a.equal(raw.publicRawVerified,true);
 await a.rejects(verifyPublicRaw({owner:'o',repo:'r',report:pub,attempts:1,fetchImpl:async()=>new Response('{}')}),/public Raw verification failed/);
});

test('D076 connected rehearsal: new roster IDs through real transport, archive, review, append and Raw; no replay',async()=>{
 const {canonical,verifyRelease}=require('../src/event_release_gate.cjs');
 const {empty}=require('../src/d069_json_attempt_ledger.cjs');
 const {runAutomatic}=require('../src/d072_automatic_json_intake.cjs');
 const {createObserver}=require('../src/d069_card_json_transport.cjs');
 const {buildReviewQueue}=require('../src/d072_offline_review_queue.cjs');
 const {createReviewedIntake}=require('../src/d072_github_reviewed_intake.cjs');
 const {runDailyData}=require('../src/d074_daily_data.cjs');
 const {verifyPublicRaw}=require('../src/d074_event_data_branch.cjs');
 const {discoverNewCardsFromUmaSim}=require('../src/new_card_event_incremental.cjs');
 const {partitionBatches}=require('../src/direct_pending_review.cjs');
 const acquisitionPolicy=require('../config/direct-event-intake-policy.v1.json');
 const productionConfig=require('../config/d074-daily-data.v1.json');
 const publicationPolicy=require('../config/d074-publication-policy.v1.json');
 const known=Array.from({length:120},(_,i)=>String(10000+i)),ids=['39996','39997','39999'];
 const support=id=>Array.from({length:5},(_,stage)=>{const f=Array(62).fill('0');f[0]=id;f[1]='[Synthetic]カード'+id;f[3]='2';f[4]=String(stage);f[6]='スピード';f[59]='末脚';return f.join('\t');}).join('\n')+'\n';
 const before=Array.from({length:500},(_,i)=>support(String(10000+i))).join('');
 const supportText=before+ids.map(support).join('');
 const skillText=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
 const pin={commit:'c'.repeat(40),cardBlob:gitBlobSha(supportText),skillBlob:gitBlobSha(skillText)};
 const sourceInput={pin,supportText,skillText};
 const seedCatalog={schemaVersion:1,cards:known.map(cardId=>({cardId,coverageStatus:'partial',events:[{...e,id:'test:'+cardId}]}))};
 const seedApprovals={schemaVersion:2,cohorts:[],entries:seedCatalog.cards.map(c=>({...approvals.entries[0],cardId:c.cardId,eventId:c.events[0].id,eventSha256:digest(c.events[0])}))};
 const f=fixture({seedCatalog,seedApprovals}),seed=await bootstrap(f.args),initialWrites=f.writes.length;
 const source={load:async p=>{a.deepEqual(p,pin);return sourceInput;},latest:async()=>sourceInput,baseline:async()=>({cardBlob:gitBlobSha(before),supportText:before}),historicalSkill:async()=>skillText};
 let ledger=empty();const packets=new Map();
 const archive=require('../src/d069_review_packet_archive.cjs');
 const store={load:async()=>structuredClone(ledger),loadPacket:async id=>structuredClone(archive.open(packets.get(id),ledger.rows.find(r=>r.cardId===id))),compareAndSet:async(old,next,ps=[])=>{
  if(canonical(old)!==canonical(ledger))return false;
  require('../src/d069_github_attempt_store.cjs').transition(old,next);
  for(const p of ps){const row=next.rows.find(r=>r.cardId===p.cardId);packets.set(p.cardId,archive.record(p,row));}
  ledger=structuredClone(next);return true;
 }};
 const discovered=discoverNewCardsFromUmaSim({previousSupportText:before,currentSupportText:supportText});
 a.deepEqual(discovered.addedCardIds,ids);
 const plan={dataKind:'d069-event-driven-intake-plan',schemaVersion:1,sourcePin:{commit:pin.commit,cardBlob:pin.cardBlob},eligibleIds:ids,heldIds:[],batches:partitionBatches(ids),siteAccessAuthorized:false,publicationApproved:false};
 const origin='https://gametora.com',list=origin+'/ja/umamusume/supports',url=id=>list+'/'+id+'-example';
 const jsonUrl=id=>origin+'/_next/data/example/ja/umamusume/supports/'+id+'-example.json';
 const boot=id=>'<script id="__NEXT_DATA__">'+JSON.stringify({page:'/ja/umamusume/supports/[id]',buildId:'example',props:{pageProps:{sourceData:{support_id:Number(id)}}}})+'</script>';
 const event=(i)=>({i,n:'Synthetic event '+i,c:[{o:'',r:[{t:'sk',v:'+2',d:990001}]}]});
 const body=(id,category,n)=>JSON.stringify({pageProps:{sourceData:{support_id:Number(id)},eventData:{ja:JSON.stringify({[category]:Array.from({length:n},(_,i)=>event(i+1))})}}});
 const listing=known.concat(ids.slice(0,2)).map(id=>'<a href="'+url(id)+'">x</a>').join('');
 const requests=[],rawRequests=[];
 const responses=new Map([[origin+'/robots.txt',['text/plain','User-agent: *\nDisallow: /private']], [list,['text/html',listing]],[url(ids[0]),['text/html',boot(ids[0])]],[jsonUrl(ids[0]),['application/json',body(ids[0],'random',1)]],[jsonUrl(ids[1]),['application/json',body(ids[1],'arrows',3)]]]);
 const observerFactory=opts=>createObserver({...opts,sleep:async()=>{},fetchImpl:async u=>{
  requests.push(u);a.ok(responses.has(u),'unexpected synthetic URL '+u);
  const [type,b]=responses.get(u),res=new Response(b,{headers:{'content-type':type}});Object.defineProperty(res,'url',{value:u});return res;
 }});
 const autoArgs={plan,sourcePin:pin,policy:acquisitionPolicy,existingCatalog:seedCatalog,store,loadSkillText:async()=>skillText,observerFactory};
 const auto=await runAutomatic(autoArgs);
 a.deepEqual(auto.attemptedIds,ids);a.equal(auto.stopReason,null);
 a.equal(requests.length,5);a.equal(packets.size,2);a.equal(ledger.rows.at(-1).status,'not-listed');
 const queue=await buildReviewQueue({store,pendingIds:ids,existingCatalog:seedCatalog,loadSkillText:async()=>skillText});
 a.deepEqual(queue.rows.map(x=>x.status),['ready-for-publication-decision','ready-for-publication-decision','not-listed']);
 const syntheticPolicy={...productionConfig.routinePublicationPolicy,reviewer:'synthetic rehearsal',reviewedAt:'2000-01-01',evidenceUrls:['https://example.org/synthetic'],publicationBasis:{kind:'original-factual-description',reason:'Synthetic rehearsal only'}};
 const intake=createReviewedIntake({source,store});
 const daily={config:{...productionConfig,routinePublicationPolicy:syntheticPolicy},publicationPolicy,queue,auto,store,github:f.args.github,owner:'o',repo:'r',baseSha:base,expectedHead:seed.head,
  appender:args=>appendReviewed({...args,intake}),rawVerifier:async args=>{
   const current=await readCurrent(f.args);
   return verifyPublicRaw({...args,attempts:1,fetchImpl:async u=>{
    rawRequests.push(u);
    const root='https://raw.githubusercontent.com/o/r/';
    const bytes=new Map([[root+'refs/heads/data/events/manifest.json',json(current.manifest)],[root+current.manifest.snapshotCommit+'/'+CATALOG,current.catalogText],[root+current.manifest.snapshotCommit+'/'+APPROVALS,current.approvalsText]]);
    a.ok(bytes.has(u),'unrecognized fixed Raw coordinate');return new Response(bytes.get(u));
   }});
  }};
 const preview=await runDailyData({...daily,config:{...daily.config,mode:'plan'}});
 a.equal(preview.status,'planned');a.equal(f.writes.length,initialWrites);a.deepEqual(rawRequests,[]);
 const published=await runDailyData(daily);
 a.equal(published.status,'published-raw-verified');a.deepEqual(published.selectedIds,ids.slice(0,2));
 a.equal(published.receiptSha256,preview.receiptSha256);a.equal(published.revision,2);a.equal(rawRequests.length,3);
 const current=await readCurrent(f.args),cat=JSON.parse(current.catalogText),app=JSON.parse(current.approvalsText);
 a.deepEqual(cat.cards.slice(0,known.length),seedCatalog.cards);a.deepEqual(app.entries.slice(0,known.length),seedApprovals.entries);
 a.equal(current.manifest.cardCount,122);a.equal(current.manifest.eventCount,124);verifyRelease(cat,app);
 a.equal(cat.cards.at(-1).events.length,3);a.deepEqual(cat.cards.at(-1).events[2].requires,{all:[{eventId:'gt-json:'+ids[1]+':2'}]});
 a.equal(f.refs.get('heads/main'),base);
 const afterWrites=f.writes.length,afterRequests=requests.length,afterRevision=ledger.revision;
 const replayPlan={...plan,eligibleIds:[ids[2]],batches:[[ids[2]]]};
 const replay=await runAutomatic({...autoArgs,plan:replayPlan,existingCatalog:cat});
 a.equal(replay.sourceRequestsPerformed,false);a.equal(requests.length,afterRequests);a.equal(ledger.revision,afterRevision);
 const replayQueue=await buildReviewQueue({store,pendingIds:[ids[2]],existingCatalog:cat,loadSkillText:async()=>skillText});
 const idle=await runDailyData({...daily,queue:replayQueue,auto:replay,expectedHead:published.head});
 a.equal(idle.status,'no-routine-candidates');a.equal(f.writes.length,afterWrites);a.equal(f.refs.get(REF),published.head);
});
