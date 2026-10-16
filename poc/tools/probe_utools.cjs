#!/usr/bin/env node
'use strict';
// One-off, low-volume feasibility probe. No event/option text is persisted or printed.
// Requests: robots.txt (GET) + 2 public event pages (GET), only if robots permits.
const base='https://xn--gck1f423k.xn--1bvt37a.tools';
const origin='https://nimrodx0.github.io';
const routes=['/supports/30302/event','/supports/30164/event'];
async function call(path){
 const response=await fetch(base+path,{signal:AbortSignal.timeout(15000),
  headers:{'User-Agent':'UmaSupportLab-Feasibility-Research/1.0','Accept':'text/html,*/*',
   'Origin':origin},redirect:'follow'});
 const ct=response.headers.get('content-type')||'';
 const text=ct.includes('text/')||ct.includes('html')?await response.text():'';
 const h={};
 for(const key of ['content-type','content-length','access-control-allow-origin',
     'access-control-allow-methods','cache-control','server','vary','x-powered-by'])
   h[key]=response.headers.get(key);
 return {status:response.status,finalUrl:response.url,headers:h,body:text};
}
function disallowsRobots(robots,route){
 const groups=robots.split(/\r?\n/);
 let applicable=false,disallow=[];
 for(const raw of groups){
  const line=raw.replace(/#.*/,'').trim();
  const m=/^([^:]+):\s*(.*)$/.exec(line);
  if(!m)continue;
  const key=m[1].toLowerCase(),value=m[2].trim();
  if(key==='user-agent')applicable=value==='*';
  if(key==='disallow'&&applicable&&value)disallow.push(value);
 }
 return disallow.some(d=>route.startsWith(d)&&d!=='/');
}
async function main(){
 const robots=await call('/robots.txt').catch(e=>({status:0,body:'',error:String(e)}));
 const output={robotsStatus:robots.status,robotsError:robots.error||null,
   blockedRoutes:[],routes:[]};
 for(const route of routes){
  if(robots.status===200&&disallowsRobots(robots.body,route)){
   output.blockedRoutes.push(route);continue;
  }
  try{
   const p=await call(route);
   const html=p.body;
   const jsonScripts=[...html.matchAll(/<script[^>]+type=['"]application\/(?:json|ld\+json)['"][^>]*>/gi)].length;
   const scriptSrcs=[...html.matchAll(/<script[^>]+src=['"]([^'"]+)['"][^>]*>/gi)].map(x=>x[1]);
   output.routes.push({route,status:p.status,finalUrl:p.finalUrl,headers:p.headers,
     bodyLength:html.length,
     structure:{htmlPresent:html.includes('<html'),eventSection:html.includes('連続イベント'),
       randomSection:html.includes('ランダムイベント'),eventStop:html.includes('イベント終了'),
       hintLevel:html.includes('ヒントLv'),hasNextData:html.includes('__NEXT_DATA__'),
       hasNuxt:html.includes('__NUXT__'),jsonScripts,scriptSrcCount:scriptSrcs.length,
       scriptHosts:[...new Set(scriptSrcs.map(x=>{try{return new URL(x,base).hostname}catch{return 'invalid'}}))]},
     browserCORS:p.headers['access-control-allow-origin']===origin||
       p.headers['access-control-allow-origin']==='*'});
  }catch(e){output.routes.push({route,error:String(e)})}
 }
 console.log('UTOOLS_FEASIBILITY_START');
 console.log(JSON.stringify(output,null,2));
 console.log('UTOOLS_FEASIBILITY_END');
}
main().catch(e=>{console.error('PROBE_FAILED',e.message);process.exitCode=1});
