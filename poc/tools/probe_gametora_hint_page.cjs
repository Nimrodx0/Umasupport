'use strict';
const fs=require('node:fs');
const {parseSupportCards}=require('../src/live_loader.js');
const norm=s=>String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim();
const ids=[30311,30090,20098,30302,30284,30299,
  30042,10025,10080,10105,30191,30199,30108,30039,20084,30146,20025,30025,20059,
  10146,10147,10148];
function extractHints(renderedText){
 const start=renderedText.indexOf('\nサポートヒント\n');
 if(start<0)return {status:'missing-support-hints-heading',names:[]};
 const endCandidates=['\nイベントで貰えるスキル\n','\n育成イベント\n']
  .map(text=>renderedText.indexOf(text,start+1)).filter(pos=>pos>start);
 const end=endCandidates.length?Math.min(...endCandidates):-1;
 if(end<0)return {status:'missing-next-section-boundary',names:[],diagnostic:{hasEvent:renderedText.includes('イベントで貰えるスキル'),hasTraining:renderedText.includes('育成イベント'),tail:renderedText.slice(start+20,start+160)}};
 const sec=renderedText.slice(start,end);
 // GameTora detail list renders: "詳細", skill name, brief skill description.
 // Restrict extraction to between explicit headings to exclude all event skills.
 const names=[...sec.matchAll(/(?:^|\n)詳細\n([^\n]+)/g)].map(x=>norm(x[1]));
 if(!names.length)return {status:'no-parsed-skills',names:[]};
 if(names.some(x=>!x)||new Set(names).size!==names.length)
   return {status:'invalid-or-duplicate-skill',names:[]};
 return {status:'ok',names};
}
async function audit(supportFile){
 const {chromium}=require('playwright');
 const source=parseSupportCards(fs.readFileSync(supportFile,'utf8')),byId=new Map([...source.cards].map(([k,v])=>[Number(k),v]));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({locale:'ja-JP'});
  await page.route(/\.(png|jpe?g|webp|gif|avif|woff2?)(\?|$)/i,r=>r.abort());
  const listUrl='https://gametora.com/ja/umamusume/supports';
  const listing=await page.goto(listUrl,{waitUntil:'domcontentloaded',timeout:45000});
  if(!listing?.ok())throw Error('GameTora index unavailable');
  await page.waitForSelector('a[href*="/supports/30311"]',{timeout:25000});
  const hrefs=await page.evaluate(()=>[...document.querySelectorAll('a[href]')]
    .map(a=>a.getAttribute('href'))
    .filter(x=>x&&/\/supports\/\d{5}(?:[-/?#]|$)/.test(x)));
  const detailById=new Map();
  for(const href of hrefs){
   const match=href.match(/\/supports\/(\d{5})(?:[-/?#]|$)/);
   if(!match)continue;
   const key=Number(match[1]);
   if(detailById.has(key)&&detailById.get(key)!==href)throw Error('Ambiguous detail URL '+key);
   detailById.set(key,href);
  }
  const rows=[];
  for(const id of ids){
   const card=byId.get(id),href=detailById.get(id);
   if(!card||!href){rows.push({id,status:'no-card-or-index-link'});continue;}
   const url=new URL(href,listUrl).href;
   let result;
   try{
    const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    if(res?.status()!==200){rows.push({id,status:'http-'+res?.status()});continue;}
    await page.waitForTimeout(700);
    result=extractHints(await page.locator('body').innerText());
   }catch(e){rows.push({id,status:'navigation-error',reason:String(e.message).slice(0,150)});continue;}
   if(result.status!=='ok'){rows.push({id,status:result.status,...(rows.length<2?{diagnostic:result.diagnostic}: {})});continue;}
   const expected=new Set(card.stages['4'].map(norm)),found=new Set(result.names);
   const missing=[...expected].filter(x=>!found.has(x)),extra=[...found].filter(x=>!expected.has(x));
   rows.push({id,url,status:'parsed',expected:expected.size,gameTora:found.size,
     verified:expected.size-missing.length,missingInGameTora:missing,onlyInGameTora:extra,
     complete:missing.length===0&&extra.length===0});
   await page.waitForTimeout(150);
  }
  return {checked:ids.length,parsed:rows.filter(x=>x.status==='parsed').length,
    exact:rows.filter(x=>x.complete).length,
    normalHintsTotal:rows.reduce((a,x)=>a+(x.expected||0),0),
    normalHintsCorroborated:rows.reduce((a,x)=>a+(x.verified||0),0),
    sourceBoundary:'Rendered GameTora support hints ONLY, not event skills',
    rows};
 }finally{await browser.close();}
}
if(require.main===module){
 audit(process.argv[2]).then(x=>{console.log(JSON.stringify(x,null,2));
  if(x.parsed!==x.checked)process.exitCode=1;
 }).catch(e=>{console.error(String(e.stack||e));process.exitCode=1});
}
module.exports={extractHints};
