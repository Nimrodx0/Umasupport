'use strict';
// Explicit one-time two-card verification. No raw data or source prose persisted.
const fs=require('node:fs'),crypto=require('node:crypto');
const {cardJsonUrl,extractBuildId,inspectCardJson}=require('../src/official_gametora_card_json.cjs');
const {reviewAzuma}=require('../src/d070_azuma_json_outing_review.cjs');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {reachability,directRoutes}=require('../src/core.js');
const spec=require('../config/d070-azuma-json-flow-review.v1.json');
const origin='https://gametora.com';
const expectedSkillBlob='0bc7075be624880f6a6f3e65967db0b00d37c4a8';
const expectedCardBlob='a6fec178de309785ce049966122d11dc29506b8a';
function pinned(file,expected){const b=fs.readFileSync(file);const sha=crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');if(sha!==expected)throw Error('UmaSim blob mismatch');return b.toString('utf8');}
const registry=registryFromSkillText(pinned(process.argv[2],expectedSkillBlob));
const roster=require('../src/live_loader.js').parseSupportCards(pinned(process.argv[3],expectedCardBlob));
let robots='';
async function read(url,type,cap){
 const u=new URL(url);if(u.origin!==origin||u.search||u.hash||u.username||u.password)throw Error('invalid request scope');
 if(u.pathname!=='/robots.txt'){
  if(robotsDisallows(robots,u.pathname).length)throw Error('robots denied');
  await new Promise(r=>setTimeout(r,6000));
 }
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-readonly-card-json-probe/0.1'}});
 if(r.status!==200||!String(r.headers.get('content-type')).includes(type))throw Error('HTTP/content '+r.status);
 const reader=r.body.getReader(),parts=[];let n=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>cap)throw Error('response cap');parts.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(parts).toString('utf8');
}
(async()=>{
 robots=await read(origin+'/robots.txt','text/plain',100000);
 const first=spec.cards[0],sourceUrl=origin+'/ja/umamusume/supports/'+first.cardId+'-azuma';
 const buildId=extractBuildId({html:await read(sourceUrl,'text/html',512000),cardId:first.cardId,sourceUrl});
 const reviewedCards=[];
 for(const pin of spec.cards){
  const cardId=pin.cardId;if(!roster.cards.has(cardId)||buildId!==pin.buildId)throw Error('card/build drift');
  const sourceUrl=origin+'/ja/umamusume/supports/'+cardId+'-azuma';
  const body=await read(cardJsonUrl({cardId,sourceUrl,buildId}),'json',512000);
  const observation=inspectCardJson({body,cardId,sourceUrl,buildId});
  const source=JSON.parse(JSON.parse(body).pageProps.eventData.ja);
  const titles=new Map(Object.values(source).flatMap(es=>es.map(e=>[e.i,e.n])));
  const reviewed=reviewAzuma({observation,registry,titles});
  const events=reviewed.card.events,id=n=>'gt-json:'+cardId+':'+n,by=n=>events.find(e=>e.id===id(n));
  if(reachability(by(1500),{},events).status!=='blocked')throw Error('unselected unlock permits outing');
  for(const a of ['c1','c2'])for(const b of ['c1','c2']){
   const choices={[id(1496)]:a,[id(1502)]:b};
   if(reachability(by(1504),choices,events).status!=='conditional')throw Error('invalid final outing reachability');
   const skills=directRoutes({id:cardId,hints:[],events},{stage:4,choices,outcomes:{}});
   if(!skills.some(x=>x.skillId==='skill:202551'&&x.conditional))throw Error('final outing hint absent');
  }
  reviewedCards.push(reviewed);
  console.log('D070_NAMED_REHEARSAL='+JSON.stringify({sourceBodySha256:reviewed.sourceBodySha256,summary:reviewed.summary,
   omittedNonSkill:reviewed.omittedNonSkill,registrySkillBlob:expectedSkillBlob,registryCardBlob:expectedCardBlob,
   reachabilityCases:5,publicationApproved:false}));
 }
 const loader=require('../src/live_loader.js'),bridge=require('../src/skill_bridge.js');
 const oldRoster=pinned(process.argv[4],'215b1922fd385895acc48af583db41e32b69ff58');
 const current=pinned(process.argv[3],expectedCardBlob),skills=pinned(process.argv[2],expectedSkillBlob);
 const historical=fs.readFileSync(process.argv[5],'utf8');
 if(crypto.createHash('sha256').update(historical).digest('hex')!==bridge.PINNED_SHA256)throw Error('historical skill SHA');
 const {discoverNewCardsFromUmaSim}=require('../src/new_card_event_incremental.cjs');
 const payload=require('../src/d070_azuma_json_release.cjs').prepare({
  reviewed:reviewedCards,discovery:discoverNewCardsFromUmaSim({previousSupportText:oldRoster,currentSupportText:current}),
  existingCatalog:require('../data/reviewed_events.v1.json'),
  existingApprovals:require('../config/event-release-approvals.gt2487.v2.json'),
  model:loader.buildModel(current),skillText:skills,pinnedSkillText:historical,allowReviewedLegacy:true,
  pendingCardIds:['10149','30323']
 });
 console.log('D070_APPROVED_APPEND='+JSON.stringify(payload));
})().catch(e=>{console.error('D070_REHEARSAL_STOP='+String(e.message).slice(0,160));process.exitCode=1;});
