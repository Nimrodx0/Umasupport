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
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
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
    for(let index=0;index<await events.count();index++){
     const btn=events.nth(index);
     if((await btn.getAttribute('aria-expanded'))!=='true')
      await btn.click({timeout:5000});
     await page.waitForTimeout(950);
     const groups=await btn.evaluate(button=>{
      const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
      const section=panel?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
      const body=section?.children?.[1];
      if(!body)return [];
      return [...body.children].slice(0,20).flatMap(group=>{
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
        const effectTexts=[],hintContexts=[];
        for(const root of roots){
         for(const el of [root,...root.querySelectorAll('*')]){
          const own=[...el.childNodes].filter(node=>node.nodeType===3)
           .map(node=>node.textContent||'').join('').trim();
          if(!own||!/[+＋\-－−]\s*\d/.test(own))continue;
          effectTexts.push(own);
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
         hintContexts:hintContexts.slice(0,10),splitByVisibleOr};
       });
      });
     });
     const normalized=groups.map(group=>({
      effectTexts:group.effectTexts,
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
