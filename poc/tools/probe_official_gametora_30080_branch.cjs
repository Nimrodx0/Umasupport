'use strict';
/*
 * One explicit original-site card, one historical event. No extraction into a
 * publishable database; outputs only strict structural flags and counts.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {inspectOne,EXPECTED}=require('../src/official_gametora_old_structural_cohorts.cjs');
const {inspectSiteTopology}=require('../src/official_gametora_rendered_branch_topology.cjs');
const {compareNumericRoutes}=require('../src/official_gametora_old_numeric_route_parity.cjs');
const {siteOnlyNumericDraft,summarizeNumericDraft}=require('../src/official_gametora_site_numeric_draft.cjs');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const {hintOnlyDraft,summarizeHintDraft}=require('../src/official_gametora_site_hint_draft.cjs');
const {siteDirectSkillDraft,summarizeDirectSkillDraft}=require('../src/official_gametora_direct_skill_draft.cjs');
const {routeFlowCandidates,summarizeFlowDraft}=require('../src/official_gametora_site_flow_draft.cjs');
const {buildUnifiedSiteDraft,summarizeUnifiedSiteDraft}=require('../src/official_gametora_site_unified_draft.cjs');
const CARD_ID='30080';
const PAGE_URL='https://gametora.com/ja/umamusume/supports/30080-sasami-anshinzawa';
const BLOB='8ce27e74dd18de7a08efa6a0bcf53d5be7a59a86';
const fail=code=>{throw Error('GameTora元サイトSSR30080限定分岐: '+code);};
let auditStage='not-started';
const key=s=>String(s||'').normalize('NFKC')
 .replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
function loadPinnedIndependentSkillRegistry(){
 const path=process.env.GT_SKILL_REGISTRY_SAMPLE;
 if(!path)fail('pinned-independent-skill-dictionary-required');
 const bytes=fs.readFileSync(path);
 if(bytes.length>6*1024*1024)fail('pinned-dictionary-oversize');
 const sha=crypto.createHash('sha1').update('blob '+bytes.length+'\0')
  .update(bytes).digest('hex');
 if(sha!=='0c6ea6d72b037b24ee40860f73b0e86db47aab1d')
  fail('pinned-independent-skill-dictionary-sha-drift');
 return registryFromSkillText(bytes.toString('utf8'));
}
function loadPinned(path){
 const b=fs.readFileSync(path);
 const blob=crypto.createHash('sha1').update('blob '+b.length+'\0')
  .update(b).digest('hex');
 if(blob!==BLOB)fail('historical-source-sha-drift');
 const doc=JSON.parse(b.toString('utf8'));
 if(doc.kind!=='support'||String(doc.id)!==CARD_ID)fail('old-card-mismatch');
 inspectOne(doc);
 return doc;
}
async function run(path){
 auditStage='pinned-input';
 const old=loadPinned(path);
 auditStage='pinned-registry';
 const skillRegistry=loadPinnedIndependentSkillRegistry();
 const eventOrdinal=EXPECTED[CARD_ID].expectedBranch.event;
 const event=Object.values(old.events_ja)[eventOrdinal-1];
 auditStage='robots-policy';
 const robotsResponse=await fetch('https://gametora.com/robots.txt',{
  headers:{'User-Agent':'UmaSupportLab-small-original-site-verification/1'},
  redirect:'error',signal:AbortSignal.timeout(20000)
 });
 if(robotsResponse.status!==200)fail('robots-unavailable');
 const robots=await robotsResponse.text();
 if(robots.length>200000||robotsDisallows(robots,new URL(PAGE_URL).pathname).length)
  fail('robots-block-or-oversize');
 auditStage='chrome-launch';
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({locale:'ja-JP'});
  let blocked=false;
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.protocol!=='https:'||u.hostname!=='gametora.com'||
    ['image','font','media'].includes(route.request().resourceType()))
    return route.abort();
   return route.continue();
  });
  page.on('response',response=>{
   if([403,429].includes(response.status()))blocked=true;
  });
  auditStage='navigation';
  const response=await page.goto(PAGE_URL,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()!==200||blocked)fail('unexpected-site-response');
  await page.waitForTimeout(3500);
  if(blocked)fail('site-blocked');
  auditStage='event-matching';
  const buttons=page.locator('section button[aria-expanded]');
  const names=await buttons.allInnerTexts();
  const target=key(event.name);
  if(!target)fail('missing-historical-event-name');
  const positions=names.map((name,i)=>({i,name:key(name)}))
   .filter(x=>x.name.includes(target)).map(x=>x.i);
  if(positions.length!==1)fail('event-title-not-uniquely-matched');
  const button=buttons.nth(positions[0]);
  if(await button.getAttribute('aria-expanded')!=='true')
   await button.click({timeout:6500});
  await page.waitForTimeout(750);
  auditStage='dom-extraction';
  const groups=await button.evaluate(button=>{
   const panel=[...button.parentElement.children].find(el=>el.tagName==='DIV');
   const section=panel?.firstElementChild?.firstElementChild?.firstElementChild?.firstElementChild;
   const body=section?.children?.[1];
   if(!body)return [];
   return [...body.children].slice(0,20).map(group=>{
    const inner=group.children.length===1?group.firstElementChild:group;
    const rows=[...inner.children];
    const elements=[group,...group.querySelectorAll('*')];
    const fragments=elements.map(el=>
     [...el.childNodes].filter(n=>n.nodeType===3)
      .map(n=>n.textContent||'').join('').trim()).filter(Boolean);
    const dividers=elements.filter(el=>{
     const own=[...el.childNodes].filter(n=>n.nodeType===3)
      .map(n=>n.textContent||'').join('').trim();
     return /^(?:OR|または|又は)$/i.test(own);
    });
    // A divider must have visible structure on both sides: do not turn
    // arbitrary text about "or" into an imaginary result route.
    const verifiedOr=dividers.filter(el=>{
     for(let p=el;p&&p!==group;p=p.parentElement){
      const siblings=[...(p.parentElement?.children||[])];
      const i=siblings.indexOf(p);
      if(i>0&&i<siblings.length-1)return true;
     }
     return false;
    }).length;
    const findSplit=el=>{
     for(let p=el;p&&p!==group;p=p.parentElement){
      const siblings=[...(p.parentElement?.children||[])];
      const i=siblings.indexOf(p);
      if(i>0&&i<siblings.length-1)
       return [siblings.slice(0,i),siblings.slice(i+1)];
     }
     return null;
    };
    const verifiedSplits=dividers.map(findSplit).filter(Boolean);
    const segmentRoots=verifiedSplits.length===1?verifiedSplits[0]:[[group]];
    const numericSegments=segmentRoots.map(roots=>{
     const effectTexts=[],effectContexts=[];
     for(const root of roots){
      for(const el of [root,...root.querySelectorAll('*')]){
       const own=[...el.childNodes].filter(n=>n.nodeType===3)
        .map(n=>n.textContent||'').join('').trim();
       if(!/[+＋\-－−]\s*\d/.test(own)||own.length>400)continue;
       const contexts=[];
       for(let p=el;p&&root.contains(p)&&contexts.length<6;p=p.parentElement){
        const text=(p.innerText||'').trim();
        if(text.length&&text.length<=300)contexts.push(text);
       }
       effectTexts.push(own);effectContexts.push(contexts);
      }
     }
     return {effectTexts:effectTexts.slice(0,80),
      effectContexts:effectContexts.slice(0,80)};
    });
    // These leaf fragments derive from the EXACT SAME result roots as
    // numericSegments. They cannot be reassigned by title, name, or old GT.
    const resultOwnSegments=segmentRoots.map(roots=>{
     const leaves=roots.flatMap(root=>[root,...root.querySelectorAll('*')]
      .map(el=>[...el.childNodes].filter(n=>n.nodeType===3)
       .map(n=>n.textContent||'').join('').trim())
      .filter(t=>t.length>0&&t.length<=300));
     return {
      directOwnTexts:leaves.filter(t=>/(?:獲得|習得|取得)/.test(t)).slice(0,80),
      flowOwnTexts:leaves.filter(t=>
       /(?:連続|イベントチェーン|お出かけ|おでかけ)/.test(t)&&
       /(?:打ち切り|終了|中断|発生しない|可能|解放|できるようになる)/.test(t)).slice(0,80),
      unresolvedOr:verifiedOr>0&&verifiedSplits.length!==1
     };
    });
    return {
     resultOwnSegments,
     visibleText:(group.innerText||'').slice(0,3000),
     ownTextFragments:fragments.slice(0,100).map(x=>x.slice(0,250)),
     numericSegments,
     routeCandidateCount:verifiedOr+1,
     orSeparatorCount:verifiedOr,
     // Structural-only diagnostics, never a copy of words or HTML.
     diagnostic:{directChildCount:group.children.length,
      innerChildCount:rows.length,elementCount:elements.length,
      explicitOrTextNodes:dividers.length,verifiedOrSeparators:verifiedOr,
      standaloneOutcomeLabels:fragments.filter(x=>
       /^(?:成功|失敗|大成功|成功時|失敗時|success|failure)$/i.test(x)).length,
      signedNumberFragments:fragments.filter(x=>/[+＋\-－−]\s*\d/.test(x)).length}
    };
   });
  });
  const siteDomDiagnostics=groups.map(g=>g.diagnostic);
  auditStage='numeric-parsing';
  const proof=inspectSiteTopology(event,groups);
  const numericProof=compareNumericRoutes(event,groups.map(g=>g.numericSegments));
  const independentDraft=siteOnlyNumericDraft({
   cardId:CARD_ID,siteEventOrdinal:positions[0]+1,groups
  });
  const draftSummary=summarizeNumericDraft(independentDraft);
  auditStage='route-hint-parsing';
  const siteHintDraft=hintOnlyDraft(independentDraft,groups,skillRegistry);
  const hintDraftSummary=summarizeHintDraft(siteHintDraft);
  auditStage='site-unified-route-join';
  const resultOwnRoutes=groups.flatMap((g,gi)=>g.resultOwnSegments.map((r,ri)=>({
   choiceGroupOrdinal:gi+1,resultOrdinal:ri+1,
   directOwnTexts:r.directOwnTexts,
   flowOwnTexts:r.flowOwnTexts,
   unresolvedOr:r.unresolvedOr
  })));
  const siteDirectDraft=siteDirectSkillDraft({
   cardId:CARD_ID,siteEventOrdinal:positions[0]+1,
   registry:skillRegistry,
   routes:resultOwnRoutes
  });
  const siteFlowDraft=routeFlowCandidates({
   cardId:CARD_ID,siteEventOrdinal:positions[0]+1,
   routes:resultOwnRoutes
  });
  const siteUnifiedDraft=buildUnifiedSiteDraft({
   numericDraft:independentDraft,hintDraft:siteHintDraft,
   directDraft:siteDirectDraft,flowDraft:siteFlowDraft
  });
  const unifiedSummary=summarizeUnifiedSiteDraft(siteUnifiedDraft);
  const directSummary=summarizeDirectSkillDraft(siteDirectDraft);
  const flowSummary=summarizeFlowDraft(siteFlowDraft);
  if(unifiedSummary.routes!==independentDraft.visibleRouteCount||
     unifiedSummary.numericEffects!==independentDraft.observedScalarEffectCount||
     unifiedSummary.skillHints!==siteHintDraft.uniquelyResolvedHintIdLevelPairs||
     unifiedSummary.directSkillCandidates!==siteDirectDraft.uniquelyMatchedDirectSkillCandidates||
     siteUnifiedDraft.appEventSchemaAdoptable!==false||
     siteUnifiedDraft.publicationApproved!==false)
   fail('site-unified-identity-or-count-drift');

  // Pinned ONE-EVENT QA sample, never a default for the generic converter.
  // A site update must be investigated rather than silently changing the ID.
  const pinnedHint=hintDraftSummary.hintCandidates;
  if(siteHintDraft.seenHintRows!==1||
     siteHintDraft.uniquelyResolvedHintIdLevelPairs!==1||
     siteHintDraft.unresolvedHintRows!==0||
     pinnedHint.length!==1||pinnedHint[0].numericId!=='202032'||
     pinnedHint[0].level!==1||pinnedHint[0].choiceGroupOrdinal!==3||
     pinnedHint[0].resultOrdinal!==1)
   fail('one-event-site-hint-id-level-or-route-drift');
  // Numeric/status-only profile of each independently visible hint leaf.
  // Never print its skill name, context, URL, article text or HTML.
  const hintContextProfiles=groups.flatMap((g,gi)=>g.numericSegments.flatMap((segment,ri)=>
   segment.effectTexts.flatMap((own,i)=>{
    const {scanOwnText}=require('../src/official_gametora_numeric_fact_parser.cjs');
    const {matchContextToId}=require('../src/official_gametora_skill_id_crosswalk.cjs');
    const fact=scanOwnText(own);
    if(fact?.kind!=='skill_hint')return [];
    return [{group:gi+1,result:ri+1,
     ownLength:own.length,contextLengths:segment.effectContexts[i].map(t=>t.length),
     contextMatches:segment.effectContexts[i].map(t=>{
      const x=matchContextToId(t,skillRegistry);
      return {status:x.status,possibleNames:x.possibleNames||0,
       possibleNumericIds:x.possibleNumericIds||0};
     })}];
   })
  ));
  const result={
   cardId:CARD_ID,sourceEventOrdinal:eventOrdinal,
   sourceEventsTotal:Object.values(old.events_ja).length,
   uniquelyMatchedEventTitles:positions.length,
   ...proof,numericRouteParity:numericProof,siteOnlyDraft:draftSummary,
   siteOnlyRouteHintDraft:hintDraftSummary,
   siteOnlyDirectGrantDraft:directSummary,siteOnlyFlowDraft:flowSummary,
   siteOnlyUnifiedDraft:unifiedSummary,
   hintContextProfiles,
   independentOriginalSiteRead:true,
   historicalReferenceBlobVerified:true,siteDomDiagnostics,
   publicationApproved:false
  };
  // The only output contains numbers, enums and booleans; no source text.
  console.log('ORIGINAL_GT_30080_BRANCH='+JSON.stringify(result));
  // An older source being different from the current live site is an audit
  // finding, NOT a reason to rewrite the site's observed values from old JSON.
  if(!numericProof.allObservedSignedScalarFactsParsed)
   fail('site-signed-scalar-extraction-incomplete');
  if(independentDraft.unparsedNumericCount||
    independentDraft.observedScalarEffectCount!==numericProof.siteScalarEffects||
    independentDraft.visibleRouteCount!==numericProof.observedResultRoutes||
    independentDraft.appEventSchemaAdoptable!==false)
   fail('site-only-draft-incomplete-or-incorrectly-promoted');
  if(siteHintDraft.seenHintRows!==independentDraft.excludedNonScalarNumericCount||
     siteHintDraft.visibleRouteCount!==independentDraft.visibleRouteCount||
     siteHintDraft.appEventSchemaAdoptable!==false)
   fail('site-skill-hint-source-isolation-or-count-drift');
  if(!result.exactChoiceAndVisibleRouteCardinality)
   fail('old-source-vs-live-site-choice-route-disagreement');
  return result;
 }finally{await browser.close();}
}
if(require.main===module){
 if(process.argv.length!==4||process.argv[2]!=='--live-30080')
  fail('explicit-original-site-run-with-pinned-json-required');
 run(process.argv[3]).catch(e=>{
  console.error(/^GameTora元サイトSSR30080限定分岐:/.test(e.message)?e.message:
   'GameTora元サイトSSR30080限定分岐: '+auditStage+'-'+
     (/^[A-Za-z]+Error$/.test(e.name||'')?e.name:'failure'));
  process.exitCode=1;
 });
}
module.exports={run,loadPinned};
