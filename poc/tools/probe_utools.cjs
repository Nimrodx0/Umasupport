#!/usr/bin/env node
// Targeted technical check for U-tools. Two public pages maximum, no content mirroring.
// Safe output: HTTP metadata and presence/shape booleans, never event text.
'use strict';
const base='https://xn--gck1f423k.xn--1bvt37a.tools';
const ids=['30302','30295'];
const origin='https://nimrodx0.github.io';
async function check(url){
 try{
  const response=await fetch(url,{
   redirect:'follow',
   headers:{'Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8','Origin':origin,
    'User-Agent':'UmaSupportLab-FeasibilityAudit/1.0 (+https://github.com/Nimrodx0/Umasupport)'},
   signal:AbortSignal.timeout(15000)
  });
  const html=await response.text();
  const h=response.headers;
  return {status:response.status,urlFinal:(new URL(response.url)).pathname,
   bytes:Buffer.byteLength(html),
   contentType:h.get('content-type'),
   corsAllowOrigin:h.get('access-control-allow-origin'),
   corsAllowMethods:h.get('access-control-allow-methods'),
   vary:h.get('vary'),
   cacheControl:h.get('cache-control'),
   cfMitigation:h.get('cf-mitigated')||null,
   hasContinuousSection:/連続イベント/.test(html),
   hasRandomSection:/ランダムイベント/.test(html),
   hasSkillHint:/ヒントLv/.test(html),
   hasJsonNextData:/__NEXT_DATA__/.test(html),
   hasRscFlight:/__next_f|self\.__next_f/.test(html),
   hasJsonLd:/application\/ld\+json/.test(html),
   hasApiHint:/[\/"']api\//i.test(html),
   hasExplicitIdInHtml:ids.some(id=>url.endsWith('/'+id+'/event')&&html.includes(id)),
   summaryOnly:true};
 }catch(e){return {error:e.name||'NetworkError',message:String(e.message).slice(0,160)}}
}
async function main(){
 const robots=await check(base+'/robots.txt');
 console.log('U_TOOLS_ROBOTS',JSON.stringify({status:robots.status,error:robots.error,contentType:robots.contentType,bytes:robots.bytes}));
 if(robots.status===200){
  const r=await fetch(base+'/robots.txt',{signal:AbortSignal.timeout(10000)}).then(x=>x.text()).catch(()=>null);
  const disallowed=r&&/Disallow:\s*\/(?:supports(?:\/|$)|\*|$)/im.test(r);
  console.log('U_TOOLS_ROBOTS_RULE',JSON.stringify({explicitSupportsDisallow:!!disallowed,available:!!r}));
  if(disallowed){console.log('U_TOOLS_PROBE_SKIPPED_ROBOTS');return}
 }
 for(const id of ids){
  const result=await check(base+'/supports/'+id+'/event');
  console.log('U_TOOLS_PAGE_'+id,JSON.stringify(result));
  if(result.status===429||result.status===403){
   console.log('U_TOOLS_PROBE_STOPPED_HTTP_'+result.status);break
  }
 }
}
main().catch(e=>{console.error('U_TOOLS_AUDIT_ERROR',e.name);process.exitCode=1});
