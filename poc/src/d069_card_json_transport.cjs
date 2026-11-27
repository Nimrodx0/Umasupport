'use strict';
// Explicit bounded observation only. Never invoked from daily roster job.
// No redirect following, credentials, retries, raw disk output or fallback.
const {LISTING,canonicalSupportUrl,resolveListedPages}=require('./official_gametora_new_card_locator.cjs');
const {extractBuildId,cardJsonUrl,inspectCardJson}=require('./official_gametora_card_json.cjs');
const fail=s=>{throw Error('D069 JSON transport: '+s);};
class TransportFailure extends Error{
 constructor(code){super('D069 JSON transport: '+code);this.code=code;}
}
function failureCode(e){
 return e instanceof TransportFailure&&['network-transient','source-refused'].includes(e.code)?e.code:'unclassified';
}
const ORIGIN='https://gametora.com',ROBOTS=ORIGIN+'/robots.txt';
const ID=/^[1-9]\d{4}$/;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// Deliberately conservative: apply every disallow rule, even for other
// agents, and never override with Allow. Malformed syntax fails closed.
function checkRobots(text,path){
 if(typeof text!=='string'||!text.trim()||text.length>100000||!/^\/[^?#]*$/.test(path))fail('robots shape');
 let agent=false;
 for(const raw of text.split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim();if(!line)continue;
  const m=/^([a-zA-Z-]+):\s*(.*)$/.exec(line);
  if(!m)fail('robots syntax');
  if(m[1].toLowerCase()==='user-agent'){if(!m[2])fail('robots agent');agent=true;}
  if(m[1].toLowerCase()==='disallow'&&m[2]){
   if(!m[2].startsWith('/'))fail('robots rule');
   const end=m[2].endsWith('$'),rule=end?m[2].slice(0,-1):m[2];
   const re=new RegExp('^'+rule.split('*').map(x=>x.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':''));
   if(re.test(path))fail('robots denied');
  }
 }
 if(!agent)fail('robots agent missing');
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
function createObserver({fetchImpl=fetch,sleep=wait,knownIds,manualAuthorized=false}={}){
 if(manualAuthorized!==true||typeof fetchImpl!=='function'||typeof sleep!=='function')fail('manual scope required');
 return async ids=>{
  if(!Array.isArray(ids)||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!ID.test(id)))fail('target scope');
  if(!ids.length)return [];
  let robots=null,requests=0;
  async function read(url,type,cap){
   const u=new URL(url);
   if(u.origin!==ORIGIN||u.search||u.hash||u.username||u.password||++requests>5)fail('request scope');
   if(url!==ROBOTS){checkRobots(robots,u.pathname);await sleep(6000);}
   let r;
   try{r=await fetchImpl(url,{method:'GET',redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-readonly-card-json-probe/0.1'}});}
   catch(e){if(e instanceof TypeError||e?.name==='TimeoutError')throw new TransportFailure('network-transient');throw e;}
   if([401,403,429,451].includes(r.status))throw new TransportFailure('source-refused');
   if(r.status!==200||r.url!==url||!String(r.headers.get('content-type')).toLowerCase().includes(type))fail('HTTP or content failure');
   if(!r.body?.getReader)fail('response body');
   const rd=r.body.getReader(),chunks=[];let n=0;
   try{while(true){const {done,value}=await rd.read();if(done)break;n+=value.length;if(n>cap)fail('response cap');chunks.push(Buffer.from(value));}}
   finally{await rd.cancel().catch(()=>{});}
   return Buffer.concat(chunks).toString('utf8');
  }
  robots=await read(ROBOTS,'text/plain',100000);
  const hrefs=listingLinks(await read(LISTING,'text/html',3000000),knownIds);
  const pages=resolveListedPages({targetCardIds:ids,hrefs});
  let buildId=null;
  const result=[];
  for(const p of pages){
   if(p.status!=='listed'){result.push({cardId:p.cardId,status:'not-listed'});continue;}
   if(buildId===null)buildId=extractBuildId({html:await read(p.url,'text/html',512000),cardId:p.cardId,sourceUrl:p.url});
   const body=await read(cardJsonUrl({cardId:p.cardId,sourceUrl:p.url,buildId}),'application/json',512000);
   // Validate immediately before even considering the next card.
   inspectCardJson({body,cardId:p.cardId,sourceUrl:p.url,buildId});
   result.push({cardId:p.cardId,status:'json',sourceUrl:p.url,buildId,body});
  }
  return result;
 };
}
module.exports={checkRobots,listingLinks,createObserver,failureCode};
