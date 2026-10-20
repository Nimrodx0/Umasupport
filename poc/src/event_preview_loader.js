/* Explicitly opt-in, unapproved event candidate preview on top of the live app.
 * It must never be mistaken for reviewed production event data. */
(function(g){
'use strict';
const PUBLIC=typeof module!=='undefined'&&module.exports
 ?require('./public_event_catalog.js'):g.UmaPublicEventCatalog;
const COMMUNITY=typeof module!=='undefined'&&module.exports
 ?require('./community_candidate_preview.js'):g.UmaCommunityCandidatePreview;
const FACTS=typeof module!=='undefined'&&module.exports
 ?require('./checker_choice_fact_preview.js'):g.UmaCheckerChoiceFactPreview;
const RESULTS=typeof module!=='undefined'&&module.exports
 ?require('./checker_result_preview.js'):g.UmaCheckerResultPreview;
const PREVIEWS=Object.freeze({'30311':'./data/preview/efforia30311.v1.json',
 'expanded':COMMUNITY.URL,'facts':FACTS.URL,'results':RESULTS.URL});
function requested(search){
 const params=new URLSearchParams(String(search||''));
 return params.get('eventPreview')||null;
}
function previewURL(cardId){return Object.prototype.hasOwnProperty.call(PREVIEWS,cardId)?PREVIEWS[cardId]:null;}
async function activate(model,{cardId,skillText,fetchImpl=g.fetch?.bind(g)}={}){
 const url=previewURL(cardId);
 if(!url)throw Error('試用データの対象外カードIDです');
 if(!model?.meta||model.meta.runtimeSources?.events?.mode!=='reviewed'||
    model.meta.reviewedEventRecords!==0)
  throw Error('通常イベント公開JSONが正常かつ空でないと試用モードを使えません');
 if(typeof skillText!=='string'||!skillText.trim())
  throw Error('数値スキル辞書の検証済みデータが必要です');
 if(!fetchImpl)throw Error('試用データの取得機能がありません');
 let catalog,communityResult=null,factResult=null,resultResult=null;
 if(cardId==='results'){
   const raw=await RESULTS.load({fetchImpl});
   resultResult=RESULTS.fromSource(raw,model,skillText);
   catalog=resultResult.catalog;
 }else if(cardId==='facts'){
   // This locally versioned, 417-card numeric FACT DB is the only source here.
   // The adapter skips result-ambiguous or missing-skill events. Every included
   // route still carries an explicit unknown-result condition.
   const raw=await FACTS.load({fetchImpl});
   factResult=FACTS.fromSource(raw,model,skillText);
   catalog=factResult.catalog;
 }else if(cardId==='expanded'){
   // One pinned external read; 30311 comes from the more complete local review
   // preview, NOT the source's flattened planning entries.
   const raw=await COMMUNITY.load({fetchImpl});
   communityResult=COMMUNITY.fromSource(raw,model,skillText);
   const localURL=PREVIEWS['30311'];
   const local=await fetchImpl(localURL,{cache:'no-store'});
   if(!local.ok)throw Error('SSR30311候補が取得できません HTTP '+local.status);
   const localCatalog=await local.json();
   if(localCatalog?.schemaVersion!==1||localCatalog.cards?.length!==1||
      localCatalog.cards[0]?.cardId!=='30311'||localCatalog.cards[0]?.events?.length!==5)
     throw Error('SSR30311プレビューの版が不正');
   catalog={schemaVersion:1,cards:[...communityResult.catalog.cards,...localCatalog.cards]};
 }else{
   const response=await fetchImpl(url,{cache:'no-store'});
   if(!response.ok)throw Error('試用イベントの取得に失敗 HTTP '+response.status);
   catalog=await response.json();
   if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||catalog.cards.length!==1||
     catalog.cards[0]?.cardId!==cardId||catalog.cards[0]?.coverageStatus!=='partial'||
     !Array.isArray(catalog.cards[0].events)||catalog.cards[0].events.length!==5)
    throw Error('試用イベントのカード範囲・収録形式が不正');
 }
 // Atomic validation through the production loader (skill ID names, paths,
 // results and cycles are validated before the model is modified).
 const summary=PUBLIC.attach(model,catalog,{skillText,fullRegistry:false});
 // PUBLIC.attach is designed for reviewed release content: mask its
 // "reviewed" metadata and label this source unambiguously as UNAPPROVED.
 model.meta.reviewedEventRecords=0;
 model.meta.reviewedEventCards=0;
 model.meta.eventStatus='preview-only';
 model.meta.previewEvents={cardId,records:summary.eventsWithRecords,
   cards:summary.cardsWithRecords,
   source:resultResult?'Umasupport explicit outcome source facts; unreviewed and no verified chain topology':
    factResult?'Umasupport numeric source-position facts; all displayed routes have unknown outcome':
    communityResult?'Pinned external numeric planning candidates + SSR30311 GameWith-first':'GameWith-first + Wiki ID',
   excluded:resultResult?.summary.omitted||factResult?.summary.omitted||communityResult?.omitted||null,
   numericSourceFacts:resultResult?.summary||factResult?.summary||null};
 model.meta.runtimeSources.events={...model.meta.runtimeSources.events,
   mode:'preview',previewUrl:url};
 return {cardId,url,records:summary.eventsWithRecords,
   cards:summary.cardsWithRecords,reviewedRecords:0};
}
const api={PREVIEWS,requested,previewURL,activate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaDevEventPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
