/*
 * Candidate-only adapter for UmaUmaChecker's GameWith-derived support events.
 * NEVER publishes original event, choice, or effect text.
 * Events remain unusable until a separate review manifest confirms conditions,
 * skill IDs, publication eligibility, and an unchanged source digest.
 */
'use strict';
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const typographic=x=>norm(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=x=>{throw new Error('Checker取り込み: '+x);};
function inventory({source,model,aliases={}}){
 if(!object(source)||!object(source.Skills)||!Array.isArray(model?.cards)||!object(aliases))fail('ソースまたは照合モデルが不正');
 const cardIndex=new Map(),idIndex=new Map();
 for(const card of model.cards){
   if(card.rarity!=='SSR'&&card.rarity!=='SR')continue;
   if(typeof card.id!=='string'||typeof card.name!=='string'||idIndex.has(card.id))fail('カードモデルIDが不正');
   idIndex.set(card.id,card);
   const k=card.rarity+'|'+norm(card.name);
   const items=cardIndex.get(k)||[];items.push(card);cardIndex.set(k,items);
 }
 const sourceRows=[],sourceIndex=new Map();
 for(const rarity of ['SSR','SR']){
   if(!object(source.Skills[rarity]))fail('ソースの'+rarity+'セクションがありません');
   for(const [name,value] of Object.entries(source.Skills[rarity])){
     if(!object(value)||!Array.isArray(value.Events))fail(rarity+': Events配列が不正');
     const k=rarity+'|'+norm(name);
     const row={rarity,name,events:value.Events,key:k};
     sourceRows.push(row);
     const items=sourceIndex.get(k)||[];items.push(row);sourceIndex.set(k,items);
   }
 }
 const mapped=new Map(),used=new Set(),joinCounts={strict:0,alias:0};
 for(const row of sourceRows){
   const possible=cardIndex.get(row.key)||[];
   if(possible.length!==1||(sourceIndex.get(row.key)||[]).length!==1)continue;
   const card=possible[0];
   if(mapped.has(card.id))fail(card.id+': カード照合が重複');
   mapped.set(card.id,{card,row,join:'strict-name'});used.add(row);
   joinCounts.strict++;
 }
 for(const [id,sourceName] of Object.entries(aliases)){
   const card=idIndex.get(id);
   if(!card||mapped.has(id)||typeof sourceName!=='string'||!sourceName.trim())fail('エイリアス指定が不正: '+id);
   const matches=sourceIndex.get(card.rarity+'|'+norm(sourceName))||[];
   if(matches.length!==1||used.has(matches[0]))fail('エイリアス対象が不明または重複: '+id);
   const row=matches[0];used.add(row);mapped.set(id,{card,row,join:'reviewed-name-alias'});
   joinCounts.alias++;
 }
 const cards=[],sourceKeys=new Set();
 let eventCount=0,optionCount=0,emptyCards=0,duplicateTitleRecords=0;
 for(const {card,row,join} of mapped.values()){
   const events=[],titleCounts=new Map();
   for(const event of row.events){
     if(!object(event)||Object.keys(event).length!==1)fail(card.id+': イベント項目の形が不正');
     const [title,options]=Object.entries(event)[0];
     const normalizedTitle=norm(title);
     if(!normalizedTitle||!Array.isArray(options))fail(card.id+': イベント名または選択肢が不正');
     titleCounts.set(normalizedTitle,(titleCounts.get(normalizedTitle)||0)+1);
     const validated=options.map((v,i)=>{
       if(!object(v)||typeof v.Title!=='string'||typeof v.Effect!=='string'||Object.keys(v).some(k=>!['Title','Effect'].includes(k)))fail(card.id+': 選択肢が不正: '+i);
       return {Title:v.Title,Effect:v.Effect};
     });
     const sourceKey='checker:'+card.id+':'+sha(card.id+'\u0000'+normalizedTitle+'\u0000'+String(events.length)).slice(0,20);
     if(sourceKeys.has(sourceKey))fail('イベントキー重複: '+card.id);
     sourceKeys.add(sourceKey);
     const sourceDigest='sha256:'+sha(JSON.stringify({title:normalizedTitle,choices:validated}));
     events.push({sourceKey,sourceDigest,
      // SHA-256 of NFKC/whitespace-normalized title for read-only master comparison.
      // It is not a verified in-game story/event ID and is never published as one.
      titleFingerprint:'sha256:'+sha(normalizedTitle),
      // Diagnostic only: ignore punctuation/spacing but never promote to event identity.
      typographicFingerprint:typographic(normalizedTitle)?'sha256:'+sha(typographic(normalizedTitle)):null,
      sourceIndex:events.length,optionCount:validated.length});
     optionCount+=validated.length;
   }
   for(let i=0;i<events.length;i++){
     if(titleCounts.get(norm(Object.keys(row.events[i])[0]))>1){
       events[i].duplicateTitle=true;duplicateTitleRecords++;
     }
   }
   if(events.length===0)emptyCards++;
   eventCount+=events.length;
   cards.push({cardId:card.id,rarity:card.rarity,join,events});
 }
 cards.sort((a,b)=>a.cardId.localeCompare(b.cardId));
 const unmatchedModelIds=[...idIndex.keys()].filter(id=>!mapped.has(id));
 return {source:'UmaUmaChecker',format:1,
   stats:{modelCards:idIndex.size,sourceCards:sourceRows.length,
      matchedCards:cards.length,strictMatchedCards:joinCounts.strict,reviewedAliases:joinCounts.alias,
      unresolvedModelCards:unmatchedModelIds.length,unusedSourceCards:sourceRows.length-used.size,
      cardsWithEvents:cards.length-emptyCards,emptyCards,eventCount,optionCount,duplicateTitleRecords},
   unmatchedModelIds,cards,
   warning:'Card-name joins and event hashes are candidate identities, not confirmed game event IDs or proof of complete event coverage.'};
}
function publishReviewed({candidate,review,model}){
 if(!candidate||!Array.isArray(candidate.cards)||!object(review)||review.schemaVersion!==1||
   !Array.isArray(review.events)||!object(model?.cardById)||!object(model?.skillById))
   fail('公開用レビュー情報の形式が不正');
 const available=new Map(),eventIds=new Set();
 for(const card of candidate.cards){
   if(!own(model.cardById,card.cardId))fail('カードモデルが一致しない: '+card.cardId);
   for(const item of card.events){
     if(available.has(item.sourceKey))fail('候補イベントキーが重複');
     if(!Number.isSafeInteger(item.optionCount)||item.optionCount<0)
       fail('候補の選択肢件数が不正: '+item.sourceKey);
     available.set(item.sourceKey,{cardId:card.cardId,digest:item.sourceDigest,
       optionCount:item.optionCount,duplicateTitle:item.duplicateTitle===true});
   }
 }
 const seen=new Set(),byCard=new Map();
 for(const item of review.events){
   if(!object(item)||typeof item.sourceKey!=='string'||seen.has(item.sourceKey))fail('レビューが不正または重複');
   seen.add(item.sourceKey);
   const record=available.get(item.sourceKey);
   if(!record||record.cardId!==item.cardId||record.digest!==item.sourceDigest)fail('元ソースが未照合・更新済み: '+item.sourceKey);
   if(record.duplicateTitle&&item.duplicateTitleReviewed!==true)fail('同名イベントの個別確認が不足: '+item.sourceKey);
   if(item.chainVerified!==true||item.rewardSemanticsVerified!==true||
      item.selectionSemanticsVerified!==true||item.publicationReviewed!==true)
     fail('分岐・選択方式・報酬・公開可否の承認が不足: '+item.sourceKey);
   const e=item.event;
   if(!object(e)||e.id!==item.sourceKey||!['auto','choice'].includes(e.type))fail('公開イベントの識別子または種類が不正');
   // A source with multiple choice positions cannot be flattened to auto or
   // silently published with fewer choices. Outcome tiers are represented
   // *inside* each independently reviewed choice, not as extra positions.
   if(record.optionCount>1&&
      (e.type!=='choice'||!Array.isArray(e.choices)||e.choices.length!==record.optionCount))
     fail('元ソースの選択肢件数と公開分岐が一致しない: '+item.sourceKey);
   // event.name, choice labels and rewards must be independently reviewed content.
   if(eventIds.has(e.id))fail('公開イベントIDが重複');
   eventIds.add(e.id);
   const events=byCard.get(item.cardId)||[];
   events.push(JSON.parse(JSON.stringify(e)));byCard.set(item.cardId,events);
 }
 const catalog={schemaVersion:1,cards:[...byCard].sort(([a],[b])=>a.localeCompare(b))
   .map(([cardId,events])=>({cardId,coverageStatus:'partial',events}))};
 const summary=schema.validateCatalog(catalog,model);
 return {catalog,summary};
}
module.exports={inventory,publishReviewed};
