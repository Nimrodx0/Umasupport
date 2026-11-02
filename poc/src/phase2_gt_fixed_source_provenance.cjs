'use strict';
/*
 * RAM-only factual source-dependency audit. Examine the fixed GitHub-derived
 * GameTora support files versus the already redacted private UI projection.
 * Report only aggregate numbers and fixed decision tokens. No event names,
 * original dialogue, per-event IDs, source page URLs or game text are emitted.
 *
 * Technical source matching is NOT a copyright or terms-of-service clearance.
 */
const {normalize}=require('./gametora_short_event_title_intake.cjs');
const fail=m=>{throw Error('GT固定出典と独自表記の依存監査: '+m);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const eventKey=(cardId,ordinal)=>'gt-'+cardId+'-event-'+String(ordinal).padStart(3,'0');
function audit({documents,projectedCatalog},{strict=false}={}){
 if(!Array.isArray(documents)||!obj(projectedCatalog)||
    !Array.isArray(projectedCatalog.cards))fail('固定出典と公開想定の非公開候補が必要');
 const cards=new Map();
 for(const card of projectedCatalog.cards){
  if(!obj(card)||typeof card.cardId!=='string'||!Array.isArray(card.events)||
     cards.has(card.cardId))fail('対象サポカの形式・重複が不正');
  cards.set(card.cardId,card);
 }
 const seen=new Set();
 const n={
  sourceFiles:0,sourceEvents:0,matchedProjectedGtEvents:0,
  sourcePageUrls:0,malformedOrMissingPageUrls:0,
  sourceJapaneseEventCollections:0,sourceFallbackEventCollections:0,
  sourceTitleFromName:0,sourceTitleFromKeyFallback:0,
  sourceTitleMismatch:0,sourceChoicePositions:0,
  sourceChoiceLabelEmpty:0,sourceChoiceLabelNonempty:0,
  sourceChoiceOutcomeNodes:0,sourceOutcomeLabelNonempty:0,
  sourceSectionClassifications:0,
  sourceOriginalOrdinalEmbeddedInEventId:0,
  sourceEventsWithEmptyChoiceLists:0
 };
 const sections=new Set();
 function nestedOutcomes(part,depth=0){
  if(depth>9)fail('元結果の入れ子が深すぎる');
  if(!obj(part))fail('結果項目の形式が不正');
  const children=part.outcomes;
  if(children===undefined)return;
  if(!Array.isArray(children))fail('元結果一覧の形式が不正');
  for(const item of children){
   n.sourceChoiceOutcomeNodes++;
   if(Array.isArray(item)){
    // The actual pinned GameTora derivative has arrays of effect objects
    // as exclusive outcome alternatives, not necessarily labelled objects.
    for(const effect of item){
     if(!obj(effect))fail('元結果内の効果が不正');
     nestedOutcomes(effect,depth+1);
    }
   }else if(obj(item)){
    if(typeof item.label==='string'&&item.label.trim())
     n.sourceOutcomeLabelNonempty++;
    nestedOutcomes(item,depth+1);
   }else fail('元結果項目が不正');
  }
 }
 for(const doc of documents){
  const cardId=String(doc?.id);
  if(doc?.kind!=='support'||!/^[0-9]{5}$/.test(cardId)||seen.has(cardId)||
     !cards.has(cardId))fail('対象GT資料のカード同定が不正');
  seen.add(cardId);n.sourceFiles++;
  if(typeof doc.url==='string'&&/^https:\/\/gametora\.com\/umamusume\/supports\//.test(doc.url))
   n.sourcePageUrls++;
  else n.malformedOrMissingPageUrls++;
  const hasJa=obj(doc.events_ja)&&Object.keys(doc.events_ja).length>0;
  const source=hasJa?doc.events_ja:doc.events;
  if(!obj(source)||!Object.keys(source).length)fail('元イベントが空');
  if(hasJa)n.sourceJapaneseEventCollections++;else n.sourceFallbackEventCollections++;
  const got=cards.get(cardId).events.filter(e=>e.id.startsWith('gt-'));
  const entries=Object.entries(source);
  if(got.length!==entries.length)fail('元GTカードの収録数と候補が異なる');
  const byId=new Map(got.map(e=>[e.id,e]));
  if(byId.size!==got.length)fail('元位置ベースのイベントIDが重複');
  for(let i=0;i<entries.length;i++){
   const [title,event]=entries[i],id=eventKey(cardId,i+1);
   if(!obj(event)||!Array.isArray(event.choices)||!byId.has(id))
    fail('元イベントの位置対応が不正');
   if(!event.choices.length){
    n.sourceEventsWithEmptyChoiceLists++;
    fail('元イベントに選択肢が存在しない');
   }
   n.sourceEvents++;n.sourceOriginalOrdinalEmbeddedInEventId++;
   const sourceTitle=event.name||title;
   if(typeof sourceTitle!=='string'||!normalize(sourceTitle))fail('元見出しが空');
   if(event.name)n.sourceTitleFromName++;else n.sourceTitleFromKeyFallback++;
   if(byId.get(id).name===normalize(sourceTitle))
    n.matchedProjectedGtEvents++;
   else n.sourceTitleMismatch++;
   if(typeof event.section==='string'){
    n.sourceSectionClassifications++;sections.add(event.section);
   }
   for(const choice of event.choices){
    if(!obj(choice)||typeof choice.label!=='string')
     fail('元選択肢のラベルが不正');
    n.sourceChoicePositions++;
    if(choice.label.trim())n.sourceChoiceLabelNonempty++;
    else n.sourceChoiceLabelEmpty++;
    nestedOutcomes(choice);
   }
  }
 }
 if(n.sourceChoiceLabelEmpty+n.sourceChoiceLabelNonempty!==n.sourceChoicePositions||
    n.matchedProjectedGtEvents+n.sourceTitleMismatch!==n.sourceEvents)
  fail('出典項目の件数が不整合');
 if(strict&&(n.sourceFiles!==559||n.sourceEvents!==2488||
    n.matchedProjectedGtEvents!==2488||n.sourceTitleMismatch!==0||
    n.sourceOriginalOrdinalEmbeddedInEventId!==2488||
    n.malformedOrMissingPageUrls!==0))
  fail('固定559/2488GTの出典対応に変化があった');
 return {
  status:'SOURCE_FACT_DEPENDENCE_INVENTORY_NOT_RIGHTS_CLEARANCE',
  counts:{...n,sourceSectionDistinctValues:sections.size},
  findings:{
   sourceAcquiredFrom:'fixed-public-GitHub-derived-JSON',
   pageUrlIsProvenanceNotProofOfDirectWebAccess:true,
   sourceEventOrdinalUsedForPrivateEventIdentity:true,
   sourceHeadingsReusedForEventRecognition:true,
   sourceEditorialSectionLabelsReproducedInPublicCandidate:false,
   originalSourceChoiceTextPresentOnlyInPrivateSource:true,
   potentialOriginalityNeedsManualAssessment:true,
   sourceAccessAndReuseRightsVerified:false,
   publicationApproved:false,
   publishedEvents:0
  }
 };
}
module.exports={audit};
