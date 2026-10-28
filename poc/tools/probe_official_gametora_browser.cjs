'use strict';
/*
 * One support-card page, as a normal browser user sees it. No page text,
 * choice labels, screenshots, HTML, response bodies or JSON are persisted.
 * This does not bypass site protections or run as a recurring crawler.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {compareTitles}=require('../src/official_gametora_title_crosscheck.cjs');
const {scanOwnText,compareProvisionalFacts}=require('../src/official_gametora_numeric_fact_parser.cjs');
const {registryFromSkillText,matchContextToId,summarizeHints}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {compareRenderedGroups}=require('../src/official_gametora_route_group_probe.cjs');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const {buildPinnedCardDraft,comparePinnedAppDraftToOriginalSite}=require('../src/official_gametora_app_schema_parity.cjs');
const {buildPinnedEffectDraft,comparePinnedEffectsToSite}=require('../src/official_gametora_app_effects_parity.cjs');
const {compareConvertedCardToSite}=require('../src/official_gametora_existing_normalized_parity.cjs');
const {inspectRenderedChoices,correlateExplicitTerminal}=require('../src/official_gametora_choice_outcome_semantics.cjs');
const {chromium}=require('playwright');
const {TARGETS,pageUrl}=require('../src/official_gametora_probe.cjs');
const fail=s=>{throw Error('GameToraブラウザ実地調査: '+s);};
function classifyJson(root){
 const totals={eventKeys:0,choiceArrays:0,outcomeArrays:0,effectArrays:0,
  numericSkillIdFields:0,recordsWithChoicesAndSection:0};
 const queue=[root];let idx=0;
 while(idx<queue.length&&idx<70000){
  const value=queue[idx++];
  if(!value||typeof value!=='object')continue;
  if(Array.isArray(value)){
   for(const n of value)if(n&&typeof n==='object')queue.push(n);
   continue;
  }
  const keys=Object.keys(value);
  if(Array.isArray(value.choices)&&('section' in value||'event_id' in value||'id' in value))
   totals.recordsWithChoicesAndSection++;
  for(const key of keys){
   const k=key.toLowerCase(),item=value[key];
   if(/events?|eventdata|trainingevents/.test(k))totals.eventKeys++;
   if(/choices?/.test(k)&&Array.isArray(item))totals.choiceArrays++;
   if(/outcomes?|resultgroups?/.test(k)&&Array.isArray(item))totals.outcomeArrays++;
   if(/effects?|rewards?/.test(k)&&Array.isArray(item))totals.effectArrays++;
   if(/^(skill_?id|skillnumericid)$/.test(k)&&typeof item==='number')
    totals.numericSkillIdFields++;
   if(item&&typeof item==='object')queue.push(item);
  }
 }
 return totals;
}


function measureRenderedEventDetails(page){
 return page.evaluate(()=>{
  const body=document.body;
  const panels=[...document.querySelectorAll('[role="dialog"],[role="tabpanel"],[aria-expanded],details,table')];
  return {
   dialogs:document.querySelectorAll('[role="dialog"]').length,
   expandedControls:document.querySelectorAll('[aria-expanded="true"],details[open]').length,
   collapsedControls:document.querySelectorAll('[aria-expanded="false"],details:not([open])').length,
   visibleTables:panels.filter(e=>e.tagName==='TABLE'&&e.getClientRects().length).length,
   visibleElements:document.querySelectorAll('body *').length,
   bodyTextCharacters:(body.innerText||'').length,
   headingCount:document.querySelectorAll('h2,h3,h4').length,
   buttons:document.querySelectorAll('button').length,
   documentHeight:Math.round(body.scrollHeight)
  };
 });
}
function eventButtonAncestors(button){
 let e=button;const rows=[];
 for(let i=0;i<5&&e;i++,e=e.parentElement){
  rows.push({
   tag:e.tagName.toLowerCase(),
   role:e.getAttribute('role')||null,
   ariaExpanded:e.getAttribute('aria-expanded'),
   directChildTags:[...e.children].map(x=>x.tagName.toLowerCase()).slice(0,20),
   descendantButtons:e.querySelectorAll('button').length,
   descendantLinks:e.querySelectorAll('a').length,
   visibleTextLength:(e.innerText||'').length
  });
 }
 return rows;
}


function analyzeExpandedPanel(button){
 const row=button.parentElement;
 const panel=[...row?.children||[]].find(e=>e.tagName==='DIV');
 if(!panel)return {panelFound:false};
 const elements=[panel,...panel.querySelectorAll('*')];
 const histogram={};
 for(const e of elements){
  const k=e.tagName.toLowerCase();histogram[k]=(histogram[k]||0)+1;
 }
 const links=[...panel.querySelectorAll('a[href]')];
 return {
  panelFound:true,
  provisionalDetailRowCount:panel.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild?.children?.[1]?.children?.length??null,
  panelTag:panel.tagName.toLowerCase(),
  panelChildTags:[...panel.children].slice(0,30).map(e=>e.tagName.toLowerCase()),
  totalElements:elements.length,
  tagHistogram:histogram,
  panelVisibleTextCharacters:(panel.innerText||'').length,
  leafTextElements:elements.filter(e=>e.childElementCount===0&&(e.innerText||'').trim()).length,
  leafElementsWithArabicDigits:elements.filter(e=>e.childElementCount===0&&/[0-9０-９]/.test(e.innerText||'')).length,
  hyperlinks:links.length,
  skillLinks:links.filter(e=>/\/(?:umamusume\/)?skills?\//.test(e.getAttribute('href')||'')).length,
  maxNestedDepth:(function depth(e){return e.children.length?1+Math.max(...[...e.children].map(depth)):1;})(panel)

 };
}
async function inspectEventSections(page){
 const known=page.getByRole('button',{name:/蹄鉄で/}).first();
 if(await known.count()!==1)return [{knownEventButtonCount:await known.count(),failure:'target-event-not-unique'}];
 const section=known.locator('xpath=ancestor::section[1]');
 const buttons=section.locator('button[aria-expanded]');
 const total=await buttons.count();
 const events=[];
 for(let n=0;n<Math.min(total,8);n++){
  const button=buttons.nth(n);
  if(await button.getAttribute('aria-expanded')!=='true')
   await button.click({timeout:5000});
  await page.waitForTimeout(950);
  events.push({
   position:n+1,
   sameRowAccordionButtons:await button.evaluate(el=>[...el.parentElement.children].filter(x=>x.tagName==='BUTTON'&&x.hasAttribute('aria-expanded')).length),
   expanded:(await button.getAttribute('aria-expanded'))==='true',
   panel:await button.evaluate(analyzeExpandedPanel)
  });
 }
 return [{targetSectionFound:true,accordionCount:total,events}];
}

async function probe(){
 const target=TARGETS[0]; // only the old, already-listed 30001 card
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext({locale:'ja-JP'});
  const page=await context.newPage();
  const network={sameOriginFetchOrXhr:0,jsonResponses:0,blockedResponses:0};
  const jsonTasks=[];
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(!['https:'].includes(url.protocol)||
      ![ 'gametora.com' ].includes(url.hostname)||
      ['image','font','media'].includes(req.resourceType()))
    return route.abort();
   return route.continue();
  });
  page.on('response',response=>{
   const req=response.request();
   if(['fetch','xhr'].includes(req.resourceType())){
    network.sameOriginFetchOrXhr++;
    if((response.headers()['content-type']||'').includes('json')){
     network.jsonResponses++;
     const length=Number(response.headers()['content-length']||0);
     if(jsonTasks.length<35&&(!length||length<=2*1024*1024))
      jsonTasks.push(response.json().then(classifyJson).catch(()=>null));
    }
   }
   if([403,429].includes(response.status()))network.blockedResponses++;
  });
  const response=await page.goto(pageUrl(target),{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||[403,429].includes(response.status()))fail('アクセス制限。追加試行を行わない');
  if(response.status()!==200)fail('HTTP '+response.status());
  await page.waitForTimeout(3500);
  const text=await page.locator('body').innerText();
  const shapes=await Promise.all(jsonTasks);
  const annotated=shapes.filter(Boolean);
  const hit=key=>annotated.filter(shape=>shape[key]>0).length;
  const total=key=>annotated.reduce((sum,shape)=>sum+shape[key],0);
  const visible={
   cardId:target.cardId,
   trainingEventLabelVisible:/育成イベント|Training Events/.test(text),
   chainLabelVisible:/連続イベント|Chain Events/.test(text),
   randomLabelVisible:/ランダムイベント|Random Events/.test(text),
   totalRenderedButtons:await page.locator('button').count(),
   sameOriginFetchOrXhr:network.sameOriginFetchOrXhr,
   jsonResponses:network.jsonResponses,
   jsonBodiesInspected:annotated.length,
   responseShapeSignals:{
    withEventKeys:hit('eventKeys'),
    withChoiceArrays:hit('choiceArrays'),
    withOutcomeArrays:hit('outcomeArrays'),
    withEffectArrays:hit('effectArrays'),
    withNumericSkillIdFields:hit('numericSkillIdFields'),
    withEventLikeRecords:hit('recordsWithChoicesAndSection'),
    eventLikeRecordsTotal:total('recordsWithChoicesAndSection')
   },
   blockedResponses:network.blockedResponses,
   fullChoiceOutcomeCoverageVerified:false,
   publishing:false
  };
  if(network.blockedResponses)fail('403/429を受信。追加操作を行わない');
  // Optional one visible user action, only if the expected known old
  // support-card event is present. Never log its original label or text.
  const firstKnownEvent=page.getByRole('button',{name:/蹄鉄で/}).first();
  const found=(await firstKnownEvent.count())>0;
  visible.oneKnownEventControlPresent=found;
  visible.eventDomBefore=await measureRenderedEventDetails(page);
  if(found){
   visible.knownEventAncestorBefore=await firstKnownEvent.evaluate(eventButtonAncestors);
   const before=text.length;
   await firstKnownEvent.click({timeout:5000});
   await page.waitForTimeout(600);
   const after=(await page.locator('body').innerText()).length;
   visible.eventExpansionChangedRenderedTextLength=before!==after;
   visible.eventDomAfter=await measureRenderedEventDetails(page);
   visible.samePageAfterClick=page.url()===pageUrl(target);
   visible.knownEventAncestorAfter=await firstKnownEvent.evaluate(eventButtonAncestors).catch(()=>null);
  }else visible.eventExpansionChangedRenderedTextLength=null;
  visible.allEventSectionStructures=await inspectEventSections(page);
  if(process.env.GT_REFERENCE_SAMPLE){
   const raw=fs.readFileSync(process.env.GT_REFERENCE_SAMPLE);
   const gitSha=crypto.createHash('sha1').update('blob '+raw.byteLength+'\0')
    .update(raw).digest('hex');
   if(gitSha!=='6aca60590854f402a67da82c2ffa7295e564b40f')
    fail('旧サンプルの固定Git blob署名が不一致');
   const expected=JSON.parse(raw.toString('utf8'));
   const section=firstKnownEvent.locator('xpath=ancestor::section[1]');
   const events=section.locator('button[aria-expanded]');
   const headings=[];
   for(let index=0;index<await events.count();index++){
    const button=events.nth(index);
    headings.push({
     title:await button.innerText(),
     sameGroupSize:await button.evaluate(e=>
      [...e.parentElement.children].filter(x=>
       x.tagName==='BUTTON'&&x.hasAttribute('aria-expanded')).length),
     provisionalDetailRows:(await button.evaluate(analyzeExpandedPanel)).provisionalDetailRowCount
    });
   }
   visible.historicalTitleCrosscheck=compareTitles(expected,headings);
   const reference=Object.values(expected.events_ja);
   const observedFacts=[];
   for(let index=0;index<await events.count();index++){
    const eventButton=events.nth(index);
    if((await eventButton.getAttribute('aria-expanded'))!=='true')
     await eventButton.click({timeout:5000});
    await page.waitForTimeout(950);
    const ownLines=await eventButton.evaluate(button=>{
     const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
     if(!panel)return [];
     return [panel,...panel.querySelectorAll('*')].map(el=>
      [...el.childNodes].filter(n=>n.nodeType===3)
       .map(n=>n.textContent||'').join('').trim()).filter(Boolean);
    });
    // Keep original wording in process memory only; report only typed numeric facts.
    observedFacts.push(ownLines.map(scanOwnText).filter(Boolean));
   }
   const comparisons=visible.historicalTitleCrosscheck.provisionalComparisons.map(x=>({
    sourceOrdinal:x.historicalEventOrdinal,renderedPosition:x.renderedEventPosition,
    ...compareProvisionalFacts(
     reference[x.historicalEventOrdinal-1],
     observedFacts[x.renderedEventPosition-1])
   }));
   visible.officialNumericFactPilot={
    cards:1,eventsCompared:comparisons.length,comparisons,
    allEffectFactsVerified:false,chainBranchCompletenessVerified:false,
    approvedForDatabaseIngestion:false
   };
   if(process.env.GT_SKILL_REGISTRY_SAMPLE){
    const skillRaw=fs.readFileSync(process.env.GT_SKILL_REGISTRY_SAMPLE);
    if(crypto.createHash('sha1').update('blob '+skillRaw.byteLength+'\0')
        .update(skillRaw).digest('hex')!=='0c6ea6d72b037b24ee40860f73b0e86db47aab1d')
     fail('独立UmaSimスキル辞書のGit blob署名が不一致');
    const registry=registryFromSkillText(skillRaw.toString('utf8'));
    const routeMatches=[];
    for(let index=0;index<await events.count();index++){
     const eventButton=events.nth(index);
     if(await eventButton.getAttribute('aria-expanded')!=='true')
      await eventButton.click({timeout:5000});
     await page.waitForTimeout(950);
     const fragments=await eventButton.evaluate(button=>{
      const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
      if(!panel)return [];
      const texts=[];
      for(const node of [panel,...panel.querySelectorAll('*')]){
       const own=[...node.childNodes].filter(n=>n.nodeType===3)
        .map(n=>n.textContent||'').join('').trim();
       if(!/ヒント|hint/i.test(own)||!/[+＋\-－−]\s*\d/.test(own))continue;
       // Different ancestors may include skill names in their child span.
       // Find the *smallest* text context that resolves one numeric ID.
       const contexts=[];
       for(let p=node,depth=0;p&&depth<4&&panel.contains(p);p=p.parentElement,depth++){
        const body=p.innerText||'';
        if(body.length<=250)contexts.push(body);
       }
       texts.push(contexts);
      }
      return texts.slice(0,30);
     });
     const resolved=fragments.map(contexts=>{
      const tries=contexts.map(v=>matchContextToId(v,registry));
      return tries.find(x=>x.status==='unique-verified-name')||
       tries.find(x=>x.status==='ambiguous-name-or-id')||
       tries.find(x=>x.status!=='not-a-hint')||{status:'name-not-found'};
     });
     routeMatches.push(resolved);
    }

    const allRenderedGroups=[];
    const splitByOrEvents=[];
    const allChoiceEvidence=[];
    const labelScopeEvidence=[];
    for(let index=0;index<await events.count();index++){
     const btn=events.nth(index);
     if((await btn.getAttribute('aria-expanded'))!=='true')
      await btn.click({timeout:5000});
     await page.waitForTimeout(950);
     const historicOrdinal=visible.historicalTitleCrosscheck.provisionalComparisons
      .find(x=>x.renderedEventPosition===index+1)?.historicalEventOrdinal;
     const expectedLabels=reference[historicOrdinal-1]?.choices
      .map(x=>x.label).filter(x=>typeof x==='string'&&x.trim())||[];
     const labelScopes=await btn.evaluate((button,labels)=>{
      const normalized=s=>String(s||'').normalize('NFKC')
       .replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
      const row=normalized(button.parentElement?.innerText||'');
      const panel=[...button.parentElement.children].find(e=>e.tagName==='DIV');
      const detail=normalized(panel?.innerText||'');
      const pageText=normalized(document.body?.innerText||'');
      return {
       namedChoiceLabels:labels.length,
       matchesInCurrentEventContainer:labels.filter(x=>row.includes(normalized(x))).length,
       matchesInExpandedPanel:labels.filter(x=>detail.includes(normalized(x))).length,
       matchesInFullDocument:labels.filter(x=>pageText.includes(normalized(x))).length
      };
     },expectedLabels);
     labelScopeEvidence.push(labelScopes);
     const groups=await btn.evaluate(button=>{
      const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
      const section=panel?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
      const body=section?.children?.[1];
      if(!body)return [];
      return [...body.children].slice(0,20).flatMap((group,outerIndex)=>{
       // A "one-choice, two-outcome" event may render one outer group,
       // with two separate result rows divided by an explicit OR marker.
       // Only split on an actual visible separator, never on source counts.
       const inner=group.children.length===1?group.firstElementChild:group;
       const rows=[...inner.children];
       const dividers=rows.map((el,i)=>({el,i})).filter(({el})=>
        /^(?:OR|または|又は)$/i.test((el.innerText||'').trim()));
       let segments=[[group]],splitByVisibleOr=false;
       if(dividers.length===1){
        const p=dividers[0].i;
        if(p>0&&p<rows.length-1){
         segments=[rows.slice(0,p),rows.slice(p+1)];
         splitByVisibleOr=true;
        }
       }
       return segments.map(roots=>{
        const effectTexts=[],effectContexts=[],hintContexts=[];
        for(const root of roots){
         for(const el of [root,...root.querySelectorAll('*')]){
          const own=[...el.childNodes].filter(node=>node.nodeType===3)
           .map(node=>node.textContent||'').join('').trim();
          if(!own||!/[+＋\-－−]\s*\d/.test(own))continue;
          effectTexts.push(own);
          const near=[];
          for(let p=el,d=0;p&&d<5&&group.contains(p);p=p.parentElement,d++){
           const value=p.innerText||'';
           if(value.length<=300)near.push(value);
          }
          effectContexts.push(near.slice(0,6));
          if(/ヒント|hint/i.test(own)){
           const contexts=[];
           for(let p=el,d=0;p&&d<5&&group.contains(p);p=p.parentElement,d++){
            const value=p.innerText||'';
            if(value.length<=250)contexts.push(value);
           }
           hintContexts.push({own,contexts});
          }
         }
        }
        return {effectTexts:effectTexts.slice(0,50),
         effectContexts:effectContexts.slice(0,50),
         hintContexts:hintContexts.slice(0,10),splitByVisibleOr,
         outerGroupIndex:outerIndex+1,
         outerVisibleText:(group.innerText||'').slice(0,2800),
         outerDirectTextFragments:[group,...group.querySelectorAll('*')].map(el=>
          [...el.childNodes].filter(x=>x.nodeType===3)
           .map(x=>x.textContent||'').join('').trim().slice(0,250)).filter(Boolean).slice(0,90),
         outerOrSeparatorCount:dividers.length};
       });
      });
     });
     const normalized=groups.map(group=>({
      effectTexts:group.effectTexts,
      effectContexts:group.effectContexts,
      hintLinks:group.hintContexts.map(({own,contexts})=>{
       const level=scanOwnText(own)?.amount;
       const matches=contexts.map(c=>matchContextToId(c,registry));
       const best=matches.find(m=>m.status==='unique-verified-name')||
        matches.find(m=>m.status==='ambiguous-name-or-id')||
        matches.find(m=>m.status!=='not-a-hint')||{status:'name-not-found'};
       return {...best,level};
      })
     }));
     allRenderedGroups.push(normalized);
     splitByOrEvents.push(groups.filter(x=>x.splitByVisibleOr).length);
     const distinct=new Map();
     for(const group of groups){
      if(!distinct.has(group.outerGroupIndex))
       distinct.set(group.outerGroupIndex,{
        visibleText:group.outerVisibleText,
        ownTextFragments:group.outerDirectTextFragments,
        orSeparatorCount:group.outerOrSeparatorCount,
        routeCandidateCount:groups.filter(g=>g.outerGroupIndex===group.outerGroupIndex).length
       });
     }
     allChoiceEvidence.push([...distinct.values()]);

    }
    visible.officialRouteGroupingPilot={
     eventCount:visible.historicalTitleCrosscheck.provisionalComparisons.length,
     comparisons:visible.historicalTitleCrosscheck.provisionalComparisons.map(x=>({
      historicalEventOrdinal:x.historicalEventOrdinal,
      displayedEventPosition:x.renderedEventPosition,
      ...compareRenderedGroups(
       reference[x.historicalEventOrdinal-1],
       allRenderedGroups[x.renderedEventPosition-1]
      )
     })),
     explicitOrSplitGroups:splitByOrEvents.reduce((n,x)=>n+x,0),
     allEventsHaveVerifiedRouteSemantics:false,
     publicationApproved:false,sourceProseIncluded:false
    };

    // Compare the original site's rendered numeric groups to the ACTUAL
    // existing UmaSupport converter's output, not just to the old JSON rows.
    // The same historical pinned input and its SHA were checked above.
    const existingNormalized=transformDocument(expected);
    visible.existingConverterVsOriginalSitePilot=compareConvertedCardToSite(
      existingNormalized,
      visible.historicalTitleCrosscheck.provisionalComparisons,
      allRenderedGroups
    );
    const intake=visible.existingConverterVsOriginalSitePilot;
    // Pin full source-vs-DOM numeric comparisons for five historical
    // events including eight explicitly labeled bond effects. This does NOT
    // demonstrate full app JSON, game semantics or rights verification.
    if(intake.eventsCompared!==5||intake.sourceRouteCount!==9||
       intake.siteRouteCount!==9||intake.matchedUniqueRoutes!==9||
       intake.parityEvents!==5||intake.unresolvedEvents!==0||
       intake.events.reduce((n,x)=>n+x.renderedUnclassifiedNumeric,0)!==0||
       intake.events.reduce((n,x)=>n+x.existingConverterBondFacts,0)!==8||
       intake.events.reduce((n,x)=>n+x.directlyParsedSiteBondFacts,0)!==8||
       intake.events.some(x=>x.existingConverterBondFacts!==x.directlyParsedSiteBondFacts)||
       intake.allFiveEventNumericProjectionsMatch!==true||
       intake.fullAppEventJsonReproductionVerified!==false)
      fail('30001の既存数値変換候補と本体DOMの5イベント9経路・絆数値8件の全経路照合が変化');


    visible.officialChoiceOutcomeSemanticsPilot={
     eventCount:visible.historicalTitleCrosscheck.provisionalComparisons.length,
     comparisons:visible.historicalTitleCrosscheck.provisionalComparisons.map(x=>{
      const historicalEvent=reference[x.historicalEventOrdinal-1];
      const semantics=inspectRenderedChoices(
       historicalEvent,{groups:allChoiceEvidence[x.renderedEventPosition-1]});
      const route=visible.officialRouteGroupingPilot.comparisons.find(r=>
       r.historicalEventOrdinal===x.historicalEventOrdinal);
      return {
       historicalEventOrdinal:x.historicalEventOrdinal,
       displayedEventPosition:x.renderedEventPosition,
       ...semantics,
       explicitTerminalRouteCheck:correlateExplicitTerminal(historicalEvent,semantics,route),
       labelScopeEvidence:labelScopeEvidence[x.renderedEventPosition-1]
      };
     }),
     actualGameBranchingVerified:false,
     publicationApproved:false,
     sourceProseIncluded:false
    };
    // Execute the actual source->app-schema projection in isolated RAM with
    // the pinned 30001 old source and the independent UmaSim skill dictionary.
    // Compare ONLY app skill rewards, branch topology and positive site
    // terminal-marker locations. Neither source prose nor the unpublished
    // complete app JSON can enter CI output.
    const privateAppDraft=buildPinnedCardDraft(expected,skillRaw.toString('utf8'));
    visible.originalSiteVsAppSkillProjection=comparePinnedAppDraftToOriginalSite({
      draft:privateAppDraft,
      siteParity:visible.existingConverterVsOriginalSitePilot,
      siteEventGroups:allRenderedGroups,
      siteChoiceSemantics:visible.officialChoiceOutcomeSemanticsPilot.comparisons
    });
    const projection=visible.originalSiteVsAppSkillProjection;
    if(projection.eventsCompared!==5||projection.appEventsPresent!==5||
       projection.matchedSkillRoutes!==9||
       projection.matchedHintRewards!==5||projection.siteHintRewards!==5||
       projection.appHintRewards!==5||projection.websiteParsedBondDeltas!==8||
       projection.appSkillRouteParity!==true||
       projection.siteChoiceCardinalityConfirmed!==true||
       projection.appTerminalRoutes!==1||
       projection.terminalRouteEvidenceEvents!==1||
       projection.draftEventsWithRequires!==2||
       projection.fullAppJsonParityVerified!==false||
       projection.nonSkillAppEffectsParityVerified!==false||
       projection.publicationApproved!==false)
      fail('SSR30001の元サイトと実アプリ用スキル報酬投影に差分');
    // Full scalar non-skill app shape is produced by a DIFFERENT existing
    // converter. This compares its own isolated results to site DOM numeric
    // facts instead of assuming the skill-only projection includes effects.
    const privateEffectDraft=buildPinnedEffectDraft(expected);
    visible.originalSiteVsAppEffectsProjection=comparePinnedEffectsToSite({
      draft:privateEffectDraft,
      siteParity:visible.existingConverterVsOriginalSitePilot,
      siteEventGroups:allRenderedGroups
    });
    const effectsProof=visible.originalSiteVsAppEffectsProjection;
    if(effectsProof.eventsCompared!==5||effectsProof.appEffectEvents!==5||
       effectsProof.matchedEvents!==5||effectsProof.matchedEffectRoutes!==9||
       effectsProof.siteEffectCount!==31||effectsProof.appEffectCount!==31||
       effectsProof.matchedEffectCount!==31||
       effectsProof.siteBondEffectCount!==8||
       effectsProof.appBondEffectCount!==8||
       effectsProof.allRenderedNonSkillNumericEffectsMatch!==true||
       effectsProof.recipientCharIdSourceSiteVerified!==false||
       effectsProof.fullCombinedAppEventJsonVerified!==false||
       effectsProof.publicationApproved!==false)
      fail('SSR30001の元サイト数値と実非スキルアプリ用孤立投影が不一致');
    const semanticCases=visible.officialChoiceOutcomeSemanticsPilot.comparisons;
    const verifiedEnd=semanticCases.find(x=>x.historicalEventOrdinal===4);
    const explicitOr=semanticCases.find(x=>x.historicalEventOrdinal===5);
    if(semanticCases.length!==5||
       semanticCases.some(x=>x.choiceCardinalityAgrees!==true||
        x.alternativeOutcomeStructureAgrees!==true)||
       verifiedEnd?.explicitTerminalRouteCheck?.explicitTerminalRouteLocationVerified!==true||
       verifiedEnd.explicitTerminalRouteCheck.routeEvidencePairCount!==1||
       explicitOr?.sourceChoiceCount!==1||
       explicitOr?.visibleCandidateRoutes!==2||
       explicitOr?.visibleOrSeparators!==1)
     fail('元サイトの選択肢数・OR二結果・経路別明示打ち切りの照合が退行しました');
    const matches=visible.officialRouteGroupingPilot.comparisons;
    if(matches.length!==5||matches.reduce((n,r)=>n+r.sourceRoutes,0)!==9||
       matches.reduce((n,r)=>n+r.renderedGroupCandidates,0)!==9||
       matches.some(r=>r.uniqueRouteGroupAssignment!==true||
        r.unmatchedSourceRoutes!==0||r.ambiguousSourceRoutes!==0||
        r.unresolvedHintNames!==0)||
       visible.officialRouteGroupingPilot.explicitOrSplitGroups!==2)
     fail('旧カード5イベント/9経路の元サイトDOM照合に回帰差分があります');
    visible.officialSkillIdCrosswalkPilot={
     registryEntries:registry.count,
     cards:1,
     comparisons:visible.historicalTitleCrosscheck.provisionalComparisons.map(x=>({
      sourceOrdinal:x.historicalEventOrdinal,renderedPosition:x.renderedEventPosition,
      ...summarizeHints(
       reference[x.historicalEventOrdinal-1],
       routeMatches[x.renderedEventPosition-1]
      )
     })),
     routeSpecificSkillIdVerified:false,
     publicationApproved:false,
     sourceProseIncluded:false
    };
   }

  }
  return visible;
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==3||process.argv[2]!=='--live-browser')
  fail('明示的な --live-browser が必要');
 probe().then(result=>process.stdout.write('OFFICIAL_GT_BROWSER='+JSON.stringify(result)+'\n'))
 .catch(e=>{process.stderr.write(String(e.message).slice(0,220)+'\n');process.exitCode=1;});
}
module.exports={probe,classifyJson};
