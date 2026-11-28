'use strict';
// D072: bounded observation of new unattempted cards only.
// No redirect following, credentials, retries, raw disk output or fallback.
const {LISTING,canonicalSupportUrl,resolveListedPages}=require('./official_gametora_new_card_locator.cjs');
const {extractBuildId,cardJsonUrl,inspectCardJson}=require('./official_gametora_card_json.cjs');
const fail=s=>{throw Error('D069 JSON transport: '+s);};
class TransportFailure extends Error{
 constructor(code,notBefore=null){super('D069 JSON transport: '+code);this.code=code;this.notBefore=notBefore;}
}
function failureCode(e){
 return e instanceof TransportFailure&&['network-transient','source-refused','rate-limited'].includes(e.code)?e.code:'unclassified';
}
function retryAfter(e){return e instanceof TransportFailure?e.notBefore:null;}
function parseRetryAfter(value,now=Date.now()){
 if(typeof value!=='string'||!value.trim())return null;
 const n=/^\d+$/.test(value.trim())?now+Number(value.trim())*1000:Date.parse(value);
 return Number.isFinite(n)&&n>=now&&n<=8640000000000000?n:null;
}
const ORIGIN='https://gametora.com',ROBOTS=ORIGIN+'/robots.txt';
const ID=/^[1-9]\d{4}$/;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// RFC 9309 matching: product-specific groups, otherwise wildcard; longest
// matching rule wins, equal specificity prefers Allow. Unknown lines ignored.
const PRODUCT='Umasupport-readonly-card-json-probe';
function normalizePath(s){
 return s.replace(/%[0-9a-f]{2}|[^\x00-\x7f]/giu,m=>{
  if(m[0]==='%'){const c=String.fromCharCode(parseInt(m.slice(1),16));return /[A-Za-z0-9._~-]/.test(c)?c:m.toUpperCase();}
  return encodeURIComponent(m);
 });
}
function checkRobots(text,path){
 if(typeof text!=='string'||text.length>100000||!/^\/[^?#]*$/.test(path))fail('robots shape');
 const groups=[];let group=null;
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  const m=/^([a-zA-Z-]+):\s*(.*)$/.exec(raw.replace(/#.*/,'').trim());if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){
   if(!/^(?:\*|[A-Za-z_-]+)$/.test(value))continue;
   if(!group||group.rules.length){group={agents:[],rules:[]};groups.push(group);}
   group.agents.push(value.toLowerCase());
  }else if(group&&['allow','disallow'].includes(key)){
   // Empty rules delimit groups but never match.
   group.rules.push({allow:key==='allow',value});
  }
 }
 const exact=groups.filter(g=>g.agents.includes(PRODUCT.toLowerCase()));
 const rules=(exact.length?exact:groups.filter(g=>g.agents.includes('*'))).flatMap(g=>g.rules);
 let best=null;
 for(const rule of rules){
  if(!rule.value.startsWith('/'))continue;
  const normalized=normalizePath(rule.value),end=normalized.endsWith('$'),pattern=end?normalized.slice(0,-1):normalized;
  const re=new RegExp('^'+pattern.split('*').map(x=>x.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':''));
  const score=Buffer.byteLength(normalized.replace(/%[0-9A-F]{2}/g,'x'));
  if(re.test(normalizePath(path))&&(!best||score>best.score||score===best.score&&rule.allow))best={score,allow:rule.allow};
 }
 if(best&&!best.allow)throw new TransportFailure('source-refused');
}
function listingLinks(html,knownIds){
 if(typeof html!=='string'||!Array.isArray(knownIds)||knownIds.length<100)fail('listing baseline');
 // Only actual anchor start tags, not URLs found in script JSON. Require
 // substantial overlap with known catalog cards; no arbitrary slug guess.
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const links=[...clean.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([^"']+)\1[^>]*>/gi)].map(x=>x[2]);
 if(links.length>10000)fail('listing cap');
 const known=new Set(knownIds),seen=new Set();
 for(const x of links){const p=canonicalSupportUrl(x);if(p&&known.has(p.cardId))seen.add(p.cardId);}
 if(seen.size<100||seen.size<Math.floor(known.size*0.8))fail('listing incomplete or client-rendered');
 return links;
}
function createObserver({fetchImpl=fetch,sleep=wait,knownIds,manualAuthorized=false,automaticAuthorized=false}={}){
 if((manualAuthorized!==true&&automaticAuthorized!==true)||typeof fetchImpl!=='function'||typeof sleep!=='function')fail('manual or automatic scope required');
 let session=null,lastRequest=false;
 return async ids=>{
  if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!ID.test(id)))fail('target scope');
  if(!ids.length)return [];
  let robots=automaticAuthorized?session?.robots??null:null,requests=0;
  async function read(url,type,cap){
   const u=new URL(url);
   if(u.origin!==ORIGIN||u.search||u.hash||u.username||u.password||++requests>5)fail('request scope');
   if(url!==ROBOTS)checkRobots(robots,u.pathname);
   if(url!==ROBOTS||automaticAuthorized&&lastRequest)await sleep(6000);
   lastRequest=true;
   let r;
   try{r=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(20000),headers:{'User-Agent':PRODUCT+'/0.1'}});}
   catch(e){if(e instanceof TypeError||e?.name==='TimeoutError')throw new TransportFailure('network-transient');throw e;}
   if(r.status===429)throw new TransportFailure('rate-limited',parseRetryAfter(r.headers.get('retry-after')));
   if([401,403,451].includes(r.status))throw new TransportFailure('source-refused');
   if(r.status>=500&&r.status<=599)throw new TransportFailure('network-transient',parseRetryAfter(r.headers.get('retry-after')));
   if(r.status!==200||r.url!==url||!String(r.headers.get('content-type')).toLowerCase().includes(type))fail('HTTP or content failure');
   if(!r.body?.getReader)fail('response body');
   const rd=r.body.getReader(),chunks=[];let n=0;
   try{while(true){const {done,value}=await rd.read();if(done)break;n+=value.length;if(n>cap)fail('response cap');chunks.push(Buffer.from(value));}}
   catch(e){if(e instanceof TypeError||['TimeoutError','AbortError'].includes(e?.name))throw new TransportFailure('network-transient');throw e;}
   finally{await rd.cancel().catch(()=>{});}
   return Buffer.concat(chunks).toString('utf8');
  }
  if(robots===null)robots=await read(ROBOTS,'text/plain',100000);
  const hrefs=automaticAuthorized&&session?session.hrefs:listingLinks(await read(LISTING,'text/html',3000000),knownIds);
  if(automaticAuthorized&&!session)session={robots,hrefs,buildId:null};
  const pages=resolveListedPages({targetCardIds:ids,hrefs});
  let buildId=automaticAuthorized?session.buildId:null;
  const result=[];
  for(const p of pages){
   if(p.status!=='listed'){result.push({cardId:p.cardId,status:'not-listed'});continue;}
   if(buildId===null)buildId=extractBuildId({html:await read(p.url,'text/html',512000),cardId:p.cardId,sourceUrl:p.url});
   if(automaticAuthorized)session.buildId=buildId;
   const body=await read(cardJsonUrl({cardId:p.cardId,sourceUrl:p.url,buildId}),'application/json',512000);
   // Validate immediately before even considering the next card.
   inspectCardJson({body,cardId:p.cardId,sourceUrl:p.url,buildId});
   result.push({cardId:p.cardId,status:'json',sourceUrl:p.url,buildId,body});
  }
  return result;
 };
}
module.exports={checkRobots,listingLinks,createObserver,failureCode,retryAfter,parseRetryAfter};
