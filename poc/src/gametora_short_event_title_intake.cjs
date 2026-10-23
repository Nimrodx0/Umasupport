'use strict';
/*
 * Bind GameTora's short event HEADINGS (not narratives/choice prose) to the
 * normalized 2488-event candidate by exact card + source ordinal + source
 * heading SHA. Only for LOCAL REVIEW / CI MEMORY. Never writes a public DB.
 */
const crypto=require('node:crypto');
const fail=s=>{throw Error('GameToraイベント名編集取込: '+s);};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const normalize=s=>String(s).normalize('NFKC').replace(/\s+/gu,' ').trim();
function bindNames({normalized,projectedCatalog,documents},{strict=false}={}){
 if(normalized?.dataKind!=='gametora-whole-event-numeric-candidate'||
    normalized.releaseApproved!==false||
    normalized.originalSourceTextIncluded!==false||
    normalized.noEventCanPublishFromThisCandidate!==true||
    !Array.isArray(normalized.cards)||!Array.isArray(projectedCatalog?.cards)||
    projectedCatalog.schemaVersion!==1||!Array.isArray(documents))
  fail('未承認GameTora候補と元資料が必要');
 const docs=new Map(),items=new Map(),projected=new Map(),manifest=[];
 let sourceEvents=0,accepted=0,needsReview=0;
 for(const doc of documents){
  const id=String(doc?.id);
  if(doc?.kind!=='support'||!/^[0-9]{5}$/.test(id)||docs.has(id))
   fail('GameTora元カードのID重複・形式違反');
  docs.set(id,doc);
 }
 for(const card of normalized.cards){
  if(items.has(card.cardId)||!docs.has(card.cardId)||!Array.isArray(card.events))
   fail('元候補とカードIDが一致しない');
  const doc=docs.get(card.cardId);
  const source=(doc.events_ja&&Object.keys(doc.events_ja).length)?
   doc.events_ja:doc.events;
  if(!source||typeof source!=='object'||Array.isArray(source))
   fail('元イベントの日本語/代替見出し一覧がありません');
  const sourceEntries=Object.entries(source);
  if(sourceEntries.length!==card.events.length)
   fail('元位置・元イベント件数が不一致: '+card.cardId);
  for(let i=0;i<card.events.length;i++){
   const record=card.events[i],item=sourceEntries[i][1];
   const key=card.cardId+'/'+(i+1);
   const originalName=item?.name||sourceEntries[i][0];
   if(record.sourceOrdinal!==i+1||
      record.eventId!=='gt-'+card.cardId+'-event-'+String(i+1).padStart(3,'0')||
      typeof originalName!=='string'||
      record.sourceTitleFingerprint!=='sha256:'+hash(normalize(originalName)))
    fail('カード・位置・イベント名の出典SHAが不一致: '+key);
  }
  items.set(card.cardId,{card,sourceEntries});
  sourceEvents+=card.events.length;
 }
 for(const card of projectedCatalog.cards){
  if(projected.has(card.cardId)||!items.has(card.cardId)||!Array.isArray(card.events))
   fail('投影対象カードが出典母集団と一致しない');
  projected.set(card.cardId,card);
  const sourceRecords=items.get(card.cardId);
  const known=new Map(sourceRecords.card.events.map((e,i)=>[e.eventId,{
   record:e,
   item:sourceRecords.sourceEntries[i][1],
   key:sourceRecords.sourceEntries[i][0]
  }]));
  for(const e of card.events){
   const row=known.get(e.id);
   if(!row||typeof e.name!=='string'||!/^イベント\d{3}（仮）$/.test(e.name))
    fail('GameTora出典位置にないイベントまたは二重変換名: '+card.cardId);
   const title=normalize(row.item.name||row.key);
   // A short source title is factual identity metadata. Longer or
   // line-broken text is never silently mistaken for a safe short heading.
   const canReview=title.length>0&&title.length<=90&&!/[\r\n<>]/u.test(title);
   if(canReview){e.name=title;accepted++;}
   else needsReview++;
   manifest.push({cardId:card.cardId,eventId:e.id,
    sourceOrdinal:row.record.sourceOrdinal,
    sourceHeadingSha256:row.record.sourceTitleFingerprint,
    eventSha256:null,
    status:canReview?'SHORT_HEADING_JOINED_NOT_APPROVED':'HEADING_NEEDS_REVIEW'});
  }
 }
 if(projected.size!==projectedCatalog.cards.length||
    accepted+needsReview!==manifest.length||
    manifest.length>sourceEvents)
  fail('出典・投影イベント件数を保全できない');
 if(strict&&(sourceEvents!==2488||docs.size!==559||
    manifest.length!==2488||projected.size!==559))
  fail('2,488イベント/559枚の固定GT全件ゲートが不一致');
 return {catalog:projectedCatalog,manifest,
  summary:{sourceCards:docs.size,sourceEvents,
   projectedCards:projected.size,projectedEvents:manifest.length,
   shortTitlesJoined:accepted,shortTitlesNeedsReview:needsReview,
   publishedEvents:0},
  sourceChoiceOrOutcomeProseIncluded:false,
  sourceShortEventHeadingsOnly:true,
  publicationApproved:false,noAutomaticRuntimeAdoption:true};
}
module.exports={bindNames,normalize};
