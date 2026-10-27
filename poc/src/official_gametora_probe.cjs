'use strict';
/*
 * One-shot, read-only feasibility check of GameTora's ORIGINAL website.
 * Never stores response HTML, prose, choice labels, cookies or JSON payloads.
 * Not an approved bulk scraper / publication or runtime ingestion path.
 */
const {URL}=require('node:url');
const TARGETS=Object.freeze([
 Object.freeze({cardId:'30001',slug:'special-week'}),
 Object.freeze({cardId:'30322',slug:'mayano-top-gun'}),
 Object.freeze({cardId:'30323',slug:'azuma'})
]);
const BASE='https://gametora.com';
const MAX_BYTES=2*1024*1024;
const fail=message=>{throw Error('GameTora元サイト限定調査: '+message);};
function pageUrl(target){
 if(!TARGETS.some(t=>t.cardId===target?.cardId&&t.slug===target.slug))
  fail('登録外のカードへの自動リクエストを拒否');
 return BASE+'/ja/umamusume/supports/'+target.cardId+'-'+target.slug;
}
function robotsDisallows(robotsText,path){
 if(typeof robotsText!=='string'||typeof path!=='string'||!path.startsWith('/'))
  fail('robots情報が不正');
 let applies=false,hasAgent=false;
 const denied=[];
 for(const raw of robotsText.split(/\r?\n/)){
  const line=raw.replace(/#.*/,'').trim();
  const m=/^([^:]+):\s*(.*)$/i.exec(line);
  if(!m)continue;
  const key=m[1].trim().toLowerCase(),value=m[2].trim();
  if(key==='user-agent'){
   if(!hasAgent)applies=false;
   hasAgent=true;
   if(value==='*')applies=true;
   continue;
  }
  if(key==='disallow'&&applies&&value&&
    (path===value||path.startsWith(value)))denied.push(value);
  if(key!=='user-agent'&&key!=='disallow'&&key!=='allow')hasAgent=false;
 }
 return denied;
}
function visibleHtml(html){
 if(typeof html!=='string'||html.length===0||Buffer.byteLength(html,'utf8')>MAX_BYTES)
  fail('HTMLが空またはサイズ超過');
 return html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
  .replace(/<!--[\s\S]*?-->/g,' ');
}
function inspectPage(html,target){
 pageUrl(target);
 const visible=visibleHtml(html);
 const text=visible.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
 const title=/\<title\b[^>]*\>([\s\S]*?)\<\/title\s*\>/i.exec(visible)?.[1]||'';
 const likelySupportPage=/サポートカード|Support Card/i.test(title);
 const training=/育成イベント|Training Events/.test(text);
 const chain=/連続イベント|Chain Events/.test(text);
 const random=/ランダムイベント|Random Events/.test(text);
 // DOM markers are *not* verified outcomes. Interactive data may load later.
 const scriptCount=(html.match(/<script\b/gi)||[]).length;
 const hydrationHints={
  nextData:/<script[^>]+id=["']__NEXT_DATA__["']/i.test(html),
  nuxtData:/__NUXT_DATA__|__NUXT__/.test(html),
  applicationJson:/<script[^>]+type=["']application\/json["']/i.test(html)
 };
 return {
  cardId:target.cardId,
  pageLikelySupport:likelySupportPage,
  trainingEventHeadingInInitialHtml:training,
  chainHeadingInInitialHtml:chain,
  randomHeadingInInitialHtml:random,
  initialHtmlContainsButtons:(visible.match(/<button\b/gi)||[]).length>0,
  scriptTags:scriptCount,
  hydrationHints,
  eventChoicesAndRewardsVerified:false,
  eventChainDependenciesVerified:false,
  officialSourceReuseApproved:false,
  automaticDatabaseUpdateAllowed:false
 };
}
async function readLimited(url,kind){
 const address=new URL(url);
 if(address.origin!==BASE||
    (kind==='robots'?address.pathname!=='/robots.txt':
      !TARGETS.some(x=>address.href===pageUrl(x))))
  fail('要求先が限定リスト外');
 const result=await fetch(url,{
  headers:{'User-Agent':'Umasupport-source-feasibility/0.1 (limited 3-card prototype; see github.com/Nimrodx0/Umasupport)','Accept':kind==='robots'?'text/plain':'text/html'},
  redirect:'manual',signal:AbortSignal.timeout(20000)
 });
 if(result.status===403||result.status===429)
  fail('元サイトがアクセスを制限しています: HTTP '+result.status+'。追加試行禁止');
 if(result.status!==200)fail(kind+' 取得失敗: HTTP '+result.status);
 const type=result.headers.get('content-type')||'';
 if(kind==='robots'?!type.includes('text/plain'):!type.includes('text/html'))
  fail(kind+' 期待外のContent-Type');
 const reader=result.body.getReader();
 const chunks=[];
 let len=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   len+=value.byteLength;
   if(len>MAX_BYTES)fail(kind+' 応答サイズ上限超過');
   chunks.push(Buffer.from(value));
  }
 }finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
async function probe(){
 const robots=await readLimited(BASE+'/robots.txt','robots');
 const results=[];
 for(const [idx,target] of TARGETS.entries()){
  const page=pageUrl(target);
  if(robotsDisallows(robots,new URL(page).pathname).length)
   fail('robots.txtにより取得対象外');
  if(idx)await new Promise(done=>setTimeout(done,6000));
  const html=await readLimited(page,'html');
  // Only boolean/structural signals may reach CI output.
  results.push(inspectPage(html,target));
 }
 return {source:'gametora.com',mode:'limited-official-page-feasibility',
  targetCount:TARGETS.length,reviewOnly:true,publishing:false,
  pageObservations:results};
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--live')
  fail('実サイト確認は明示的な --live の場合のみ実行');
 probe().then(x=>{process.stdout.write('OFFICIAL_GT_FEASIBILITY='+JSON.stringify(x)+'\n');})
 .catch(e=>{process.stderr.write(String(e.message).slice(0,240)+'\n');process.exitCode=1;});
}
module.exports={TARGETS,pageUrl,robotsDisallows,visibleHtml,inspectPage,probe};
