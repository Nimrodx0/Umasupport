'use strict';
// Explicit two-card batches. No source text, raw response or candidate files.
const {cardJsonUrl,extractBuildId,inspectCardJson,legacyCompare}=require('../src/official_gametora_card_json.cjs');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com';
const cohorts=[[['30001','special-week'],['30080','sasami-anshinzawa']],[['30030','matikanetannhauser'],['30041','mejiro-dober']],[['10149','azuma'],['30323','azuma']]];
let robots='';
async function read(url,type,max){
 const u=new URL(url);
 if(u.origin!==origin||u.search||u.hash||u.username||u.password)throw Error('invalid origin/scope');
 if(u.pathname!=='/robots.txt'){
  if(robotsDisallows(robots,u.pathname).length)throw Error('robots denied');
  await new Promise(r=>setTimeout(r,6000));
 }
 const res=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-readonly-card-json-probe/0.1'}});
 if(res.status!==200||!String(res.headers.get('content-type')).includes(type))throw Error('HTTP/content failure '+res.status);
 const reader=res.body.getReader(),chunks=[];let n=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max)throw Error('response cap');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
function summarize(x){
 return {cardId:x.cardId,buildId:x.buildId,bodyBytes:x.bodyBytes,bodySha256:x.bodySha256,
 events:x.events.map(e=>({sourceEventId:e.sourceEventId,category:e.category,categoryOrdinal:e.categoryOrdinal,titleSha256:e.titleSha256,historyCount:e.historyCount,blockers:e.blockers,
 groups:e.groups.map(g=>({ordinal:g.ordinal,blockers:g.blockers,routes:g.routes.map(r=>({ordinal:r.ordinal,hints:r.hints,directGrants:r.directGrants,effects:r.effects,markers:r.markers,unresolved:r.unresolved}))}))})),
 publicationApproved:false};
}
(async()=>{
 robots=await read(origin+'/robots.txt','text/plain',100000);
 const sourceUrl=origin+'/ja/umamusume/supports/30001-special-week';
 const buildId=extractBuildId({html:await read(sourceUrl,'text/html',512000),cardId:'30001',sourceUrl});
 const pending=[];
 for(const cohort of cohorts)for(const [cardId,slug] of cohort){
  const sourceUrl=origin+'/ja/umamusume/supports/'+cardId+'-'+slug;
  const url=cardJsonUrl({cardId,sourceUrl,buildId});
  const x=inspectCardJson({body:await read(url,'json',512000),cardId,sourceUrl,buildId});
  const old=catalog.cards.find(c=>c.cardId===cardId);
  if(old){
   const p=legacyCompare(x,old);
   console.log('ADAPTER_OLD='+JSON.stringify({cardId,bodyBytes:x.bodyBytes,sourceEventCount:p.sourceEventCount,oldEventCount:p.oldEventCount,rows:p.rows.map(r=>({sourceEventId:r.sourceEventId,oldEventId:r.oldEventId,status:r.status,groupsMatch:r.groupsMatch,knownFactsMatch:r.knownFactsMatch,allComparedRewardFactsMatch:r.allComparedRewardFactsMatch,rangeHypothesis:r.rangeHypothesis,groups:r.groups?.map(g=>({routeCountMatches:g.routeCountMatches,rangeBlocked:g.rangeBlocked,routeRows:g.routeRows.map(z=>({hintsMatch:z.hintsMatch,effectsMatch:z.effectsMatch,directGrantIdsMatch:z.directGrantIdsMatch,stopMarkerMatches:z.stopMarkerMatches,unresolved:z.unresolved,referenceNonScalarCount:z.referenceNonScalarCount}))}))})),unmatchedOldEventIds:p.unmatchedOldEventIds,publicationApproved:false}));
  }else{pending.push(x);console.log('ADAPTER_PENDING='+JSON.stringify(summarize(x)));}
 }
 if(pending.length!==2)throw Error('pending pair absent');
 const [r,s]=pending;
 const sig=e=>JSON.stringify(e.groups.map(g=>g.routes.map(r=>({hints:r.hints,directGrants:r.directGrants,effects:r.effects,markers:r.markers,unresolved:r.unresolved}))));
 console.log('ADAPTER_RARITY='+JSON.stringify({cards:[r.cardId,s.cardId],events:[r.events.length,s.events.length],paired:r.events.map(e=>{const z=s.events.filter(a=>a.titleSha256===e.titleSha256);return {sourceEventId:e.sourceEventId,ssrEventIds:z.map(x=>x.sourceEventId),factsEqual:z.length===1&&sig(z[0])===sig(e),rHints:e.groups.flatMap(g=>g.routes.flatMap(r=>r.hints)),ssrHints:z.length===1?z[0].groups.flatMap(g=>g.routes.flatMap(r=>r.hints)):null};}),ssrOnly:s.events.filter(e=>!r.events.some(x=>x.titleSha256===e.titleSha256)).map(e=>e.sourceEventId),publicationApproved:false}));
})().catch(e=>{console.error('ADAPTER_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
