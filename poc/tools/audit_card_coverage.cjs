'use strict';
/* Compare independently curated SUBSETS by numeric card ID.
 * This is NOT an all-card proof: sources intentionally have different populations.
 * Prints only metadata, counts, and IDs of discrepancies, never publisher records.
 */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const sha256=s=>crypto.createHash('sha256').update(s).digest('hex');

function readUmaSim(txt){
 const byId=new Map(),stages=new Map();
 for(const [index,line] of txt.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  if(!line.trim())continue;
  const f=line.split('\t');
  if(f.length!==62||!/^\d{5}$/.test(f[0])||!/^[0-4]$/.test(f[4])||!['1','2','3'].includes(f[3]))
   throw Error('Bad UmaSim source row '+(index+1));
  const id=Number(f[0]),entry={id,name:f[1],rarity:{1:'R',2:'SR',3:'SSR'}[f[3]],type:f[6]};
  if(byId.has(id)&&JSON.stringify(byId.get(id))!==JSON.stringify(entry))throw Error('Conflicting card '+id);
  byId.set(id,entry);
  const seen=stages.get(id)||new Set();
  if(seen.has(f[4]))throw Error('Repeated limit break row '+id);
  seen.add(f[4]);stages.set(id,seen);
 }
 for(const [id,seen] of stages)if(seen.size!==5||![0,1,2,3,4].every(i=>seen.has(String(i))))
  throw Error('Incomplete limit break data '+id);
 return byId;
}
function checkIndependent({umasim,japan,english}){
 const cards=readUmaSim(umasim),sources=[
  {name:'Japanese 2026-09 selected supports',records:japan,id:c=>c.id,rarity:c=>c.rarity,name:c=>c.name},
  {sourceName:'English version support registry',records:english,id:c=>c.support_id,
   rarity:c=>({1:'R',2:'SR',3:'SSR'}[c.rarity]),name:null}
 ];
 const union=new Set(),checks=[];
 for(const source of sources){
  if(!Array.isArray(source.records)||!source.records.length)throw Error(source.sourceName+' empty');
  const seen=new Set(),missing=[],rarityConflicts=[],nameConflicts=[];
  for(const entry of source.records){
   const id=Number(source.id(entry));
   if(!Number.isSafeInteger(id)||seen.has(id))throw Error('Invalid/repeated independent ID in '+source.name);
   seen.add(id);union.add(id);
   const card=cards.get(id);
   if(!card){missing.push(id);continue;}
   if(source.rarity(entry)!==card.rarity)rarityConflicts.push(id);
   if(source.name&&entry.name!==card.name)nameConflicts.push(id);
  }
  checks.push({source:source.sourceName,records:seen.size,idMatched:seen.size-missing.length,
   absentFromUmaSim:missing,rarityConflicts,nameConflicts});
 }
 const counts={R:0,SR:0,SSR:0};
 for(const card of cards.values())counts[card.rarity]++;
 const tackR=cards.get(10128),tackSSR=cards.get(30257);
 return {umasimCards:cards.size,rarityCounts:counts,
  independentUnion:union.size,independentOverlapBetweenSources:checks[0].records+checks[1].records-union.size,
  cardsOutsideIndependentSubsets:cards.size-[...union].filter(x=>cards.has(x)).length,
  checks,tucker:{R:{id:10128,present:!!tackR,rarity:tackR?.rarity,hasExpectedName:/タッカーブライン/.test(tackR?.name||'')},
    SSR:{id:30257,present:!!tackSSR,rarity:tackSSR?.rarity,hasExpectedName:/タッカーブライン/.test(tackSSR?.name||'')}}};
}
async function httpText(url){
 const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),45000);
 try{const r=await fetch(url,{signal:ctrl.signal,headers:{'User-Agent':'Umasupport-card-audit/1.0'}});
  if(!r.ok)throw Error('HTTP '+r.status+' '+url);return await r.text();
 }finally{clearTimeout(timeout);}
}
async function gametoraCount(){
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({locale:'ja-JP'});
  // Avoid loading hundreds of card images. No login, no bypass, one page navigation.
  await page.route(/\.(png|jpe?g|webp|avif|gif|woff2?)(\?|$)/i,r=>r.abort());
  const res=await page.goto('https://gametora.com/ja/umamusume/supports',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>/\d+\s*件の結果が見つかりました/.test(document.body.innerText),{timeout:30000}).catch(()=>{});
  const observed=await page.evaluate(()=>{
   const match=document.body.innerText.match(/(\d+)\s*件の結果が見つかりました/);
   const links=[...document.querySelectorAll('a[href]')]
    .map(e=>e.getAttribute('href')).filter(x=>x&&/\/supports\/\d{5}(?:\b|\/|$)/.test(x));
   const ids=[...new Set(links.map(x=>Number(x.match(/\/supports\/(\d{5})/)[1])))];
   return {total:match?Number(match[1]):null,idCount:ids.length,ids};
  });
  return {status:res?.status(),total:observed.total,linkedIds:observed.idCount,ids:observed.ids};
 }finally{await browser.close();}
}
async function main(){
 const revisions={
  umasim:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
  japan:'0cacbb1aaf9dca10283d5b9ea20b205b9d204535',
  english:'main'};
 const [a,b,c]=await Promise.all([
  httpText('https://raw.githubusercontent.com/mee1080/umasim/'+revisions.umasim+'/data/support_card.txt'),
  httpText('https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/'+revisions.japan+'/data/supports.json'),
  httpText('https://raw.githubusercontent.com/mikevskater/uma-musume-card-tracker/'+revisions.english+'/data/cards.json')
 ]);
 const report=checkIndependent({umasim:a,japan:JSON.parse(b),english:JSON.parse(c)});
 assert.equal(report.umasimCards,563);
 assert.equal(report.checks[0].records,45);
 assert.equal(report.checks[1].records,259);
 assert.ok(report.checks.every(x=>x.absentFromUmaSim.length===0&&
   x.rarityConflicts.length===0&&x.nameConflicts.length===0));
 assert.ok(report.tucker.R.present&&report.tucker.R.rarity==='R'&&report.tucker.R.hasExpectedName);
 assert.ok(report.tucker.SSR.present&&report.tucker.SSR.rarity==='SSR'&&report.tucker.SSR.hasExpectedName);
 let site={status:'unavailable'};
 try{
  const result=await gametoraCount();
  // Number-only comparison is not an ID-level match; don't upgrade coverage gate.
  const sim=readUmaSim(a),siteSet=new Set(result.ids);
  const absentIDs=result.ids.filter(id=>!sim.has(id));
  const missingFromSite=[...sim.keys()].filter(id=>!siteSet.has(id));
  site={status:result.status,total:result.total,linkedIds:result.linkedIds,
   absentIDs,missingFromSite,overlapIDs:result.ids.length-absentIDs.length,
   sameCompleteIdSet:result.status===200&&result.total===sim.size&&
     result.linkedIds===sim.size&&!absentIDs.length&&!missingFromSite.length};
 }catch(e){site={status:'unavailable',reason:String(e.message).slice(0,140)};}
 if(!site.sameCompleteIdSet)throw Error('GameTora full 563 ID population could not be independently confirmed: '+JSON.stringify(site));
 console.log(JSON.stringify({revisions,sha256:{umasim:sha256(a),japan:sha256(b),english:sha256(c)},
  report,gameTora:site,conclusion:'full_563_id_set_matches_Gametora_listing; independent provenance_and_in_game_truth_not_proven'},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={readUmaSim,checkIndependent};
