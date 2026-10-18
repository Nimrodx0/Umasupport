/* Explicitly opt-in, unapproved event candidate preview on top of the live app.
 * It must never be mistaken for reviewed production event data. */
(function(g){
'use strict';
const PUBLIC=typeof module!=='undefined'&&module.exports
 ?require('./public_event_catalog.js'):g.UmaPublicEventCatalog;
const PREVIEWS=Object.freeze({'30311':'./data/preview/efforia30311.v1.json'});
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
 const response=await fetchImpl(url,{cache:'no-store'});
 if(!response.ok)throw Error('試用イベントの取得に失敗 HTTP '+response.status);
 const catalog=await response.json();
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||catalog.cards.length!==1||
   catalog.cards[0]?.cardId!==cardId||catalog.cards[0]?.coverageStatus!=='partial'||
   !Array.isArray(catalog.cards[0].events)||catalog.cards[0].events.length!==5)
  throw Error('試用イベントのカード範囲・収録形式が不正');
 // Atomic validation through the production loader (skill ID names, paths,
 // results and cycles are validated before the model is modified).
 const summary=PUBLIC.attach(model,catalog,{skillText,fullRegistry:false});
 // PUBLIC.attach is designed for reviewed release content: mask its
 // "reviewed" metadata and label this source unambiguously as UNAPPROVED.
 model.meta.reviewedEventRecords=0;
 model.meta.reviewedEventCards=0;
 model.meta.eventStatus='preview-only';
 model.meta.previewEvents={cardId,records:summary.eventsWithRecords,
   source:'GameWith-first + Wiki ID, candidate, non-reviewed'};
 model.meta.runtimeSources.events={...model.meta.runtimeSources.events,
   mode:'preview',previewUrl:url};
 return {cardId,url,records:summary.eventsWithRecords,reviewedRecords:0};
}
const api={PREVIEWS,requested,previewURL,activate};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaDevEventPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
