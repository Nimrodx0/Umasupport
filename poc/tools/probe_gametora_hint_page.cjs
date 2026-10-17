'use strict';
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({locale:'ja-JP'});
  await page.route(/\.(png|jpe?g|webp|gif|avif|woff2?)(\?|$)/i,r=>r.abort());
  const index='https://gametora.com/ja/umamusume/supports';
  const listing=await page.goto(index,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForSelector('a[href*="/supports/30311"]',{timeout:15000});
  const links=await page.locator('a[href*="/supports/30311"]').evaluateAll(items=>items.map(x=>x.getAttribute('href')));
  if(links.length!==1)throw Error('Expected one exact matching detail card link; got '+JSON.stringify(links));
  const url=new URL(links[0],index).href;
  const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForTimeout(700);
  const result=await page.evaluate(()=>{
   const body=document.body.innerText;
   const words=['所持スキル','ヒントスキル','通常ヒント','ヒント','スキル','Skills','Hint Skills'];
   const found=words.map(word=>({word,index:body.indexOf(word)}));
   const around=found.filter(x=>x.index>=0).slice(0,3).map(x=>({
     word:x.word,excerpt:body.slice(Math.max(0,x.index-80),x.index+350)}));
   const headings=[...document.querySelectorAll('h1,h2,h3,h4')].slice(0,35).map(x=>x.innerText.slice(0,70));
   return {title:document.title,textLength:body.length,headings,found,around,
     linkCount:document.querySelectorAll('a[href]').length};
  });
  console.log(JSON.stringify({indexStatus:listing.status(),url,status:res?.status(),...result},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(String(e.stack||e));process.exitCode=1});
