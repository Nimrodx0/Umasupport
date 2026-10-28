'use strict';
/*
 * New-card admission gate, fixed two-card and read-only. Page HTML, source
 * strings, images and JSON do not leave process memory. No event ingest here.
 */
const {TARGETS,pageUrl,robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {registryFromSkillText,matchContextToId}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {scanOwnText}=require('../src/official_gametora_numeric_fact_parser.cjs');
const {summarizeCandidateRouteHints}=require('../src/official_gametora_new_card_route_hints.cjs');
const fs=require('node:fs');
const crypto=require('node:crypto');
const NEW_CARD_IDS=Object.freeze(['30322','30323']);
const fail=s=>{throw Error('GameTora新サポカ限定表示検査: '+s);};
function validateTargets(targets){
 if(!Array.isArray(targets)||targets.length!==2||
    targets.some((t,i)=>t?.cardId!==NEW_CARD_IDS[i]||
     !TARGETS.some(x=>x.cardId===t.cardId&&x.slug===t.slug)))
  fail('対象カードが固定2枚以外');
 return targets;
}
function summarizeEvents(visible){
 if(!visible||typeof visible!=='object'||
    !Number.isSafeInteger(visible.accordionButtons)||
    !Number.isSafeInteger(visible.trainingSections)||
    !Number.isSafeInteger(visible.chainSections)||
    !Number.isSafeInteger(visible.randomSections)||
    !Number.isSafeInteger(visible.outingSections))
  fail('画面構造が不正');
 return {
  supportEventAccordions:visible.accordionButtons,
  trainingSectionCount:visible.trainingSections,
  chainSectionCount:visible.chainSections,
  randomSectionCount:visible.randomSections,
  outingSectionCount:visible.outingSections,
  chainHeadingCount:visible.chainHeadings,
  randomHeadingCount:visible.randomHeadings,
  outingHeadingCount:visible.outingHeadings,
  sampledEventPanels:visible.sampledEventPanels,
  sampledPanelsWithNumericEffects:visible.sampledPanelsWithNumericEffects,
  eventRewardRoutesVerified:false,
  choiceWordingVerified:false,
  independentSkillIdVerified:false,
  gameCurrentnessVerified:false,
  publicationApproved:false
 };
}
const PINNED_NEW_CARD_SAMPLE={
 '30322':Object.freeze({accordionPanelsOpened:6,candidateChoiceGroups:10,
  visibleOrSeparators:3,candidateOutcomeRoutes:13,skillHintCandidateRows:14,
  uniquelyMappedUmaSimSkillIdHintRows:14}),
 '30323':Object.freeze({accordionPanelsOpened:12,candidateChoiceGroups:14,
  visibleOrSeparators:0,candidateOutcomeRoutes:14,skillHintCandidateRows:4,
  uniquelyMappedUmaSimSkillIdHintRows:4})
};
function verifyPinnedNewCardCandidate(cardId,census){
 if(!Object.hasOwn(PINNED_NEW_CARD_SAMPLE,cardId))
  fail('未知の候補カード');
 const expected=PINNED_NEW_CARD_SAMPLE[cardId];
 if(Object.entries(expected).some(([name,n])=>census?.[name]!==n))
  fail('2026-10-27実サイト新サポカの候補トポロジーが変化。要再確認');
 return {candidateTopologyMatches20261027Sample:true,
  sourceEvidenceRevalidationStillRequired:true,
  officialEventPublicationApproved:false};
}

const PINNED_ROUTE_BINDING={
 '30322':Object.freeze({candidateRoutesObserved:13,
  wholePanelHintCandidates:14,hintIdLevelCandidatesBoundToRoute:14,
  eventsWithUnresolvedOrStructure:0,eventsWithoutVisibleRouteGroups:1}),
 '30323':Object.freeze({candidateRoutesObserved:14,
  wholePanelHintCandidates:4,hintIdLevelCandidatesBoundToRoute:4,
  eventsWithUnresolvedOrStructure:0,eventsWithoutVisibleRouteGroups:1})
};
function verifyPinnedNewCardRouteBinding(cardId,census,routes){
 const expected=PINNED_ROUTE_BINDING[cardId];
 if(!expected||!routes||!census||
    Object.entries(expected).some(([k,n])=>routes[k]!==n)||
    census.candidateOutcomeRoutes!==routes.candidateRoutesObserved||
    census.skillHintCandidateRows!==routes.wholePanelHintCandidates||
    census.uniquelyMappedUmaSimSkillIdHintRows!==routes.hintIdLevelCandidatesBoundToRoute||
    routes.missingNormalizedPairs!==0||routes.extraNormalizedPairs!==0||
    routes.unclassifiedWholePanelHintCandidates!==0||
    routes.unclassifiedRouteHintCandidates!==0)
  fail('新SSR画面の候補経路またはヒントID/Lvの対応に差分。元サイトを再調査');
 return {
  sampleRouteIdLevelMultisetVerified:true,
  incompletePanelsStillExcludedFromCompleteClaim:true,
  actualGameRouteSemanticsVerified:false,
  maleChoiceTextPublicationApproved:false,
  automaticPublicationAllowed:false
 };
}

function summarizeExpandedCensus(rows){
 if(!Array.isArray(rows)||rows.length>20||rows.some(x=>!x||
  !Number.isSafeInteger(x.eventPanelHasContent)||x.eventPanelHasContent<0||x.eventPanelHasContent>1||
  !Number.isSafeInteger(x.choiceGroups)||x.choiceGroups<0||x.choiceGroups>30||
  !Number.isSafeInteger(x.orMarkers)||x.orMarkers<0||x.orMarkers>30||
  !Number.isSafeInteger(x.signedNumericLeaves)||x.signedNumericLeaves<0||
  !Number.isSafeInteger(x.hintCandidates)||x.hintCandidates<0||
  !Number.isSafeInteger(x.uniqueSkillIdHints)||x.uniqueSkillIdHints<0||
  !Number.isSafeInteger(x.unresolvedSkillIdHints)||x.unresolvedSkillIdHints<0||
  x.uniqueSkillIdHints+x.unresolvedSkillIdHints!==x.hintCandidates))
  fail('表示イベントの集計契約に不正な値');
 const total=field=>rows.reduce((n,x)=>n+x[field],0);
 return {
  accordionPanelsOpened:rows.length,
  panelsWithVisibleDetails:total('eventPanelHasContent'),
  candidateChoiceGroups:total('choiceGroups'),
  visibleOrSeparators:total('orMarkers'),
  candidateOutcomeRoutes:total('choiceGroups')+total('orMarkers'),
  signedNumericLeafTexts:total('signedNumericLeaves'),
  skillHintCandidateRows:total('hintCandidates'),
  uniquelyMappedUmaSimSkillIdHintRows:total('uniqueSkillIdHints'),
  unresolvedSkillIdHintRows:total('unresolvedSkillIdHints'),
  choiceAndOutcomeSemanticsVerified:false,
  continuityAndOutingUnlockVerified:false,
  skillIdHintLevelRoutePairingVerified:false,
  eventRewardCompletenessVerified:false,
  siteContentOrLabelsIncluded:false,
  publicationApproved:false
 };
}
async function getPinnedSkillRegistry(){
 const file=process.env.GT_SKILL_REGISTRY_SAMPLE;
 if(!file)return null;
 const raw=fs.readFileSync(file);
 if(raw.byteLength>6*1024*1024)fail('辞書サイズが上限を超えています');
 const sha=crypto.createHash('sha1').update('blob '+raw.length+'\0')
  .update(raw).digest('hex');
 if(sha!=='0c6ea6d72b037b24ee40860f73b0e86db47aab1d')
  fail('参照する数値スキル辞書のGit blobが固定版と異なります');
 return registryFromSkillText(raw.toString('utf8'));
}

async function ensureAllowedByRobots(){
 const response=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'Umasupport-source-feasibility/0.1 (2-card metadata-only browser check)'},
  redirect:'manual',signal:AbortSignal.timeout(20000)
 });
 if(response.status!==200)fail('robots.txtを取得できませんでした HTTP '+response.status);
 const text=await response.text();
 if(text.length>100000)fail('robots.txtが想定外の長さ');
 return text;
}
async function probe(){
 const {chromium}=require('playwright');
 const targets=validateTargets(TARGETS.filter(t=>NEW_CARD_IDS.includes(t.cardId)));
 const registry=await getPinnedSkillRegistry();
 const robots=await ensureAllowedByRobots();
 for(const target of targets){
  if(robotsDisallows(robots,new URL(pageUrl(target)).pathname).length)
   fail('robots.txtでカードページの取得を許可していません');
 }
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 const observed=[];
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.protocol!=='https:'||url.hostname!=='gametora.com'||
      ['image','font','media'].includes(request.resourceType()))
    return route.abort();
   return route.continue();
  });
  let forbidden=false;
  page.on('response',response=>{if([403,429].includes(response.status()))forbidden=true;});
  for(const [i,target] of targets.entries()){
   if(i)await page.waitForTimeout(6000);
   forbidden=false;
   const response=await page.goto(pageUrl(target),{waitUntil:'domcontentloaded',timeout:30000});
   if(!response||response.status()!==200||forbidden)
    fail('指定カードの画面表示に失敗 HTTP '+(response?.status()||'no response'));
   await page.waitForTimeout(3500);
   if(forbidden)fail('403/429により追加処理を中止');
   const counters=await page.evaluate(()=>{
    const parts=[...document.querySelectorAll('section')].map(el=>({
     heading:el.querySelector('h2,h3,h4')?.innerText||'',
     accordions:el.querySelectorAll('button[aria-expanded]').length
    }));
    const categories={chainSections:0,randomSections:0,outingSections:0,
     trainingSections:0,accordionButtons:0};
    for(const p of parts){
     if(/連続イベント|Chain Events/i.test(p.heading))categories.chainSections++;
     if(/ランダムイベント|Random Events/i.test(p.heading))categories.randomSections++;
     if(/お出かけイベント|Outing Events/i.test(p.heading))categories.outingSections++;
     if(/育成イベント|Training Events/i.test(p.heading))categories.trainingSections++;
    }
    const headings=[...document.querySelectorAll('h2,h3,h4')]
     .map(x=>(x.innerText||'').trim());
    categories.chainHeadings=headings.filter(x=>/連続イベント|Chain Events/i.test(x)).length;
    categories.randomHeadings=headings.filter(x=>/ランダムイベント|Random Events/i.test(x)).length;
    categories.outingHeadings=headings.filter(x=>/お出かけイベント|Outing Events/i.test(x)).length;
    categories.accordionButtons=document.querySelectorAll('section button[aria-expanded]').length;
    categories.sampledEventPanels=0;
    categories.sampledPanelsWithNumericEffects=0;
    return categories;
   });
   const eventButtons=page.locator('section button[aria-expanded]');
   for(let n=0;n<Math.min(await eventButtons.count(),2);n++){
    const btn=eventButtons.nth(n);
    if((await btn.getAttribute('aria-expanded'))!=='true')
     await btn.click({timeout:5000});
    await page.waitForTimeout(800);
    const measured=await btn.evaluate(button=>{
     const panel=[...button.parentElement.children].find(x=>x.tagName==='DIV');
     const text=(panel?.innerText||'');
     return {hasDetail:!!text.trim(),
      hasSignedEffect:/[+＋\-－−]\s*\d/.test(text)};
    });
    if(measured.hasDetail)counters.sampledEventPanels++;
    if(measured.hasSignedEffect)counters.sampledPanelsWithNumericEffects++;
   }
   const allRows=[];
   const eventRouteHints=[];
   for(let idx=0;idx<Math.min(await eventButtons.count(),20);idx++){
    const eventButton=eventButtons.nth(idx);
    if((await eventButton.getAttribute('aria-expanded'))!=='true')
     await eventButton.click({timeout:5000});
    await page.waitForTimeout(650);
    if(forbidden)fail('元サイトが通信を制限。追加イベントを処理しない');
    const view=await eventButton.evaluate(button=>{
     const panel=[...button.parentElement.children].find(x=>x.tagName==='DIV');
     if(!panel)return {eventPanelHasContent:0,choiceGroups:0,orMarkers:0,
      signedNumericLeaves:0,hintContexts:[],hintOriginalTexts:[]};
     const content=panel.innerText||'';
     const body=panel.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild?.children?.[1];
     const choiceGroups=body?[...body.children]:[];
     const all=[panel,...panel.querySelectorAll('*')];
     const ownParts=all.map(el=>({el,own:[...el.childNodes]
      .filter(n=>n.nodeType===3).map(n=>n.textContent||'').join('').trim()}))
      .filter(x=>x.own.length>0);
     const hints=ownParts.filter(x=>/ヒント|hint/i.test(x.own)&&
      /[+＋\-－−]\s*\d/.test(x.own)).slice(0,30);
     return {
      eventPanelHasContent:content.trim()?1:0,
      choiceGroups:choiceGroups.length,
      orMarkers:choiceGroups.reduce((sum,g)=>sum+
       [...g.querySelectorAll('*')].filter(el=>
        /^(?:OR|または|又は)$/i.test((el.innerText||'').trim())&&
        el.children.length===0).length,0),
      signedNumericLeaves:ownParts.filter(x=>/[+＋\-－−]\s*\d/.test(x.own)).length,
      hintOriginalTexts:hints.map(({own})=>own.slice(0,240)),
      hintContexts:hints.map(({el})=>{
       const contexts=[];
       for(let p=el,d=0;p&&panel.contains(p)&&d<5;p=p.parentElement,d++){
        const text=p.innerText||'';
        if(text.length<=240)contexts.push(text);
       }
       return contexts;
      })
     };
    });
    const routePieces=await eventButton.evaluate(button=>{
     const panel=[...button.parentElement.children].find(x=>x.tagName==='DIV');
     const body=panel?.firstElementChild?.firstElementChild?.firstElementChild
      ?.firstElementChild?.children?.[1];
     if(!body)return [];
     const groups=[...body.children];
     return groups.slice(0,30).flatMap((group,choiceIndex)=>{
      const inner=group.children.length===1?group.firstElementChild:group;
      const rows=[...inner.children];
      const separators=rows.map((el,i)=>({el,i})).filter(x=>
       /^(?:OR|または|又は)$/i.test((x.el.innerText||'').trim()));
      const allOrLeaves=[...group.querySelectorAll('*')].filter(el=>
       el.children.length===0&&/^(?:OR|または|又は)$/i.test((el.innerText||'').trim()));
      let segments=[[group]],ambiguous=allOrLeaves.length>0;
      if(separators.length===1){
       const pos=separators[0].i;
       if(pos>0&&pos<rows.length-1){
        segments=[rows.slice(0,pos),rows.slice(pos+1)];
        ambiguous=false;
       }
      }else if(allOrLeaves.length===1){
       // Some newly released cards nest an OR into a reward row instead
       // of placing it among the direct children of the choice group.
       // Find a *structurally explicit* delimiter with nonempty siblings
       // on both sides. Do not fabricate branch counts from old mirrors.
       const orLeaf=allOrLeaves[0];
       let at=orLeaf;
       while(at&&group.contains(at.parentElement)){
        const parent=at.parentElement;
        const siblings=[...parent.children];
        const index=siblings.indexOf(at);
        if(index>0&&index<siblings.length-1&&
           /^(?:OR|または|又は)$/i.test((at.innerText||'').trim())){
         segments=[siblings.slice(0,index),siblings.slice(index+1)];
         ambiguous=false;
         break;
        }
        at=parent;
       }
      }
      return segments.map((roots,outcomeIndex)=>{
       const own=[];
       for(const root of roots)for(const el of [root,...root.querySelectorAll('*')]){
        const t=[...el.childNodes].filter(x=>x.nodeType===3)
         .map(n=>n.textContent||'').join('').trim();
        if(/ヒント|hint/i.test(t)&&/[+＋\-－−]\s*\d/.test(t)){
         const contexts=[];
         for(let p=el,d=0;p&&group.contains(p)&&d<5;p=p.parentElement,d++){
          const str=p.innerText||'';
          if(str.length<=240)contexts.push(str);
         }
         own.push({text:t.slice(0,240),contexts:contexts.slice(0,5)});
        }
       }
       return {
        choiceOrdinal:choiceIndex+1,
        outcomeOrdinal:outcomeIndex+1,
        unresolvedOr:ambiguous,
        hints:own.slice(0,60)
       };
      });
     });
    });
    const routes=routePieces.map(r=>({
     choiceOrdinal:r.choiceOrdinal,
     outcomeOrdinal:r.outcomeOrdinal,
     unresolvedOr:r.unresolvedOr,
     hints:r.hints.map(h=>{
      const fact=scanOwnText(h.text);
      const level=fact?.kind==='skill_hint'&&Number.isInteger(fact.amount)?
       fact.amount:null;
      if(!registry)return {status:'registry-not-loaded',level};
      const candidates=h.contexts.map(text=>matchContextToId(text,registry));
      const match=candidates.find(x=>x.status==='unique-verified-name')||
       candidates.find(x=>x.status==='ambiguous-name-or-id')||
       candidates.find(x=>x.status!=='not-a-hint')||{status:'name-not-found'};
      return {...match,level};
     })
    }));
    const matched=view.hintContexts.map(contexts=>{
     if(!registry)return {status:'registry-not-loaded'};
     const results=contexts.map(s=>matchContextToId(s,registry));
     return results.find(x=>x.status==='unique-verified-name')||
      results.find(x=>x.status==='ambiguous-name-or-id')||
      results.find(x=>x.status!=='not-a-hint')||{status:'name-not-found'};
    });
    const global=view.hintContexts.map((contexts,i)=>{
     const original=view.hintOriginalTexts[i];
     const parsed=scanOwnText(original);
     const level=parsed?.kind==='skill_hint'&&Number.isInteger(parsed.amount)?
      parsed.amount:null;
     return {...matched[i],level};
    });
    eventRouteHints.push({globalHints:global,routes});
    allRows.push({
     eventPanelHasContent:view.eventPanelHasContent,
     choiceGroups:view.choiceGroups,
     orMarkers:view.orMarkers,
     signedNumericLeaves:view.signedNumericLeaves,
     hintCandidates:matched.length,
     uniqueSkillIdHints:matched.filter(x=>x.status==='unique-verified-name').length,
     unresolvedSkillIdHints:matched.filter(x=>x.status!=='unique-verified-name').length
    });
   }
   const census=summarizeExpandedCensus(allRows);
   const routeHintBinding=summarizeCandidateRouteHints(eventRouteHints);
   const routeIntegrity=verifyPinnedNewCardRouteBinding(target.cardId,census,routeHintBinding);
   const drift=verifyPinnedNewCardCandidate(target.cardId,census);
   if(census.accordionPanelsOpened!==await eventButtons.count())
    fail('すべての画面開閉パネルを検査できませんでした');
   observed.push({
    cardId:target.cardId,
    pageReceived200:true,
    pageRenderedInChrome:true,
    ...summarizeEvents(counters),
    census,
    routeHintBinding,
    routeIntegrity,
    sourceDrift:drift,
    umaSimSkillRegistryPinned:!!registry
   });
  }
  return {
   source:'https://gametora.com',
   purpose:'new-card-render-coverage-only',
   targetCount:targets.length,
   observations:observed,
   fullEventCoverageClaimed:false,
   automaticAcquisitionAuthorized:false,
   publicationApproved:false
  };
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--live-new-cards')
  fail('明示的な --live-new-cards が必要');
 probe().then(x=>process.stdout.write('OFFICIAL_GT_NEW_CARDS='+JSON.stringify(x)+'\n'))
 .catch(e=>{process.stderr.write(e.message.slice(0,200)+'\n');process.exitCode=1;});
}
module.exports={validateTargets,summarizeEvents,summarizeExpandedCensus,verifyPinnedNewCardCandidate,verifyPinnedNewCardRouteBinding,probe};
