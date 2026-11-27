'use strict';
// Optional diagnostic only; never invoked by routine intake.
// A second extraction path over explicitly supplied card HTML. It does
// not execute page scripts, fetch assets, or revisit the site. Display facts
// corroborate JSON, not internal game dependencies or publication rights.
const crypto=require('node:crypto');
const {canonical,digest}=require('./event_release_gate.cjs');
const {extractRoutePieces}=require('./official_gametora_route_dom_extractor.cjs');
const {assembleLiveEvent}=require('./official_gametora_live_event_assembler.cjs');
const {registryFromSkillText}=require('./official_gametora_skill_id_crosswalk.cjs');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const allowed=new Set(['site-choice-versus-result-meaning-unverified','all-skill-rewards-not-verified','numeric-effect-recipients-not-verified','event-chain-reachability-not-verified','event-and-choice-wording-not-reviewed','publication-rights-not-reviewed']);
const sortHints=h=>h.map(x=>({skillId:x.skillId,level:x.level})).sort((a,b)=>a.skillId.localeCompare(b.skillId)||a.level-b.level);
function shapeFromDisplay({cardId,panels,skillText}){
 if(!Array.isArray(panels)||!panels.length||panels.length>20)throw Error('display panels unavailable');
 const registry=registryFromSkillText(skillText),counts=new Map(),seen=new Set();
 return panels.map((p,i)=>{
  const category={'連続イベント':'arrows','ランダムイベント':'random'}[p.category];
  if(!category||typeof p.title!=='string'||!p.title.trim()||p.title.length>300)throw Error('display heading unavailable');
  const title=p.title.trim().replace(/^\s*\(?\s*[❯›»>→]+\s*\)?\s*/u,'').trim();
  if(!title||title.length>80)throw Error('display title unavailable');
  const exactTitleSha256=sha(title);if(seen.has(exactTitleSha256))throw Error('duplicate display title');seen.add(exactTitleSha256);
  const ordinal=(counts.get(category)||0)+1;counts.set(category,ordinal);
  const o=assembleLiveEvent({cardId,siteEventOrdinal:i+1,routePieces:p.pieces,registry});
  if(o.status!=='unified-unapproved'||o.numericDraft.excludedNonScalarNumericCount||o.numericDraft.unparsedNumericCount||
     o.hintDraft.unresolvedHintRows||o.directDraft.unresolvedDirectLikeTexts)throw Error('display facts unresolved');
  const groups=[];
  for(const route of o.joined.routes){
   if(route.directSkills.length||route.unlocatedVisibleFlowMarkers.length||route.visibleFlowMarkers.some(m=>m!=='explicit-chain-stop')||
      route.unresolvedReasons.some(m=>!allowed.has(m)))throw Error('display route unresolved');
   const n=route.choiceGroupOrdinal;
   if(!groups[n-1])groups[n-1]={ordinal:n,labelPresent:o.joined.visibleGroupCount>1,routes:[]};
   groups[n-1].routes.push({ordinal:route.resultOrdinal,hints:sortHints(route.skillHints.map(h=>({skillId:'skill:'+h.numericId,level:h.level}))),
    terminal:route.visibleFlowMarkers.includes('explicit-chain-stop'),nonSkillCount:route.numericEffects.length});
  }
  return {exactTitleSha256,category,categoryOrdinal:ordinal,groups};
 });
}
function compareDisplay(packet,observation){
 const base={schemaVersion:1,status:'unavailable',htmlSha256:observation?.htmlSha256??null,
  observedEvents:0,observationSha256:null,topologyVerified:false,publicationApproved:false};
 if(!observation||!Array.isArray(observation.events))return base;
 const expected=packet.events.map(e=>({exactTitleSha256:e.exactTitleSha256,category:e.category,categoryOrdinal:e.categoryOrdinal,
  groups:e.groups.map(g=>({ordinal:g.ordinal,labelPresent:g.labelPresent,routes:g.routes.map(r=>({ordinal:r.ordinal,hints:sortHints(r.hints),terminal:r.terminal,nonSkillCount:r.nonSkillCount}))}))}));
 const sort=x=>x.slice().sort((a,b)=>a.exactTitleSha256.localeCompare(b.exactTitleSha256));
 const events=sort(observation.events);
 return {...base,status:canonical(events)===canonical(sort(expected))?'matched-visible-facts':'mismatch',
  observedEvents:events.length,observationSha256:digest({events})};
}
async function observeHtml({html,cardId,skillText,launch}={}){
 if(typeof html!=='string'||html.length>512000)throw Error('display HTML scope');
 const htmlSha256=sha(html);
 let browser;
 try{
  // Browser dependency is loaded only for an eligible first acquisition.
  const open=launch??(()=>require('playwright').chromium.launch({headless:true}));
  browser=await open();
  const context=await browser.newContext({javaScriptEnabled:false,offline:true,serviceWorkers:'block'});
  await context.route('**/*',route=>route.abort());
  const page=await context.newPage();
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:10000});
  const heading=page.getByRole('heading',{name:'育成イベント',exact:true});
  if(await heading.count()!==1)return {htmlSha256,events:null};
  const headings=heading.locator('..').locator('h3'),n=await headings.count();
  if(n<1||n>20)return {htmlSha256,events:null};
  const panels=[];
  for(let i=0;i<n;i++){
   const h=headings.nth(i),section=h.locator('xpath=ancestor::section[1]');
   if(await section.count()!==1||await section.locator('h3').count()!==1)return {htmlSha256,events:null};
   const category=await section.evaluate(el=>el.parentElement?.parentElement?.firstElementChild?.innerText?.trim()||'');
   panels.push({category,title:await h.innerText(),pieces:await section.evaluate(extractRoutePieces)});
  }
  return {htmlSha256,events:shapeFromDisplay({cardId,panels,skillText})};
 }catch{return {htmlSha256,events:null};}
 finally{if(browser)await browser.close().catch(()=>{});}
}
const {verifyDisplay}=require('./d069_review_packet_archive.cjs');
module.exports={shapeFromDisplay,compareDisplay,observeHtml,verifyDisplay};
