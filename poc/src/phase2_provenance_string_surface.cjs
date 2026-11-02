'use strict';
/*
 * Exhaustively classify EVERY string leaf in the existing PRIVATE projected
 * event catalog. This reports where text, technical IDs and enum tokens survive
 * conversion, NOT whether any material is legally protectable or licensed.
 * No raw values, event IDs, SHA fingerprints or raw paths leave the report.
 */
const fail=message=>{throw Error('Phase2公開候補の文字列表面監査: '+message);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const technical=/^[a-z0-9][a-z0-9:_-]*$/i;
const enumToken=/^[a-z0-9][a-z0-9_-]*$/i;
const kindPattern=/^cards\.\[\]\.events\.\[\](?:\.(?:choices|outcomes)\.\[\])*(?:\.outcomes\.\[\])?$/;
const oneOf=(p,tail)=>p.endsWith('.'+tail);
const inspect=({catalog},{strict=false}={})=>{
 if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail('元データ形式が不正');
 const surface={
  titles:0,verifiedSkillNames:0,generatedChoiceLabels:0,
  generatedOutcomeLabels:0,sourceOrdinalEventIds:0,
  curatedEventIds:0,structuralIdTokens:0,referenceIdTokens:0,
  controlledVocabularyTokens:0,totalStringLeaves:0,
  titleLength:{upTo12:0,from13To40:0,from41To90:0,over90:0},
  titlesWithMarkupOrNewlines:0,titlesMaxCodePoints:0,
  unknownStringLeaves:0
 };
 const countTitle=s=>{
  const n=[...s].length;
  surface.titlesMaxCodePoints=Math.max(surface.titlesMaxCodePoints,n);
  if(n<=12)surface.titleLength.upTo12++;
  else if(n<=40)surface.titleLength.from13To40++;
  else if(n<=90)surface.titleLength.from41To90++;
  else surface.titleLength.over90++;
  if(/<[^>]*>|https?:\/\/|[\r\n]/i.test(s))surface.titlesWithMarkupOrNewlines++;
 };
 function classify(value,path){
  const p=path.join('.');
  surface.totalStringLeaves++;
  if(p==='cards.[].cardId'){
   if(!/^\d+$/.test(value))fail('カード識別子に文字列混入');
   surface.structuralIdTokens++;return;
  }
  if(p==='cards.[].coverageStatus'){
   if(value!=='partial')fail('収録状態に自由記述を検出');
   surface.controlledVocabularyTokens++;return;
  }
  if(p==='cards.[].events.[].name'){
   if(!value.trim())fail('イベント名が空');
   surface.titles++;countTitle(value);return;
  }
  if(p==='cards.[].events.[].id'){
   if(/^gt-\d+-event-\d{3,}$/.test(value))surface.sourceOrdinalEventIds++;
   else if(/^usl:[a-z0-9:_-]+$/i.test(value))surface.curatedEventIds++;
   else fail('未知のイベントID系列');
   surface.structuralIdTokens++;return;
  }
  if((p.startsWith('cards.[].events.[].')&&oneOf(p,'id')&&
      p!=='cards.[].events.[].id')||
     /\.rewards\.\[\]\.skillId$/.test(p)){
   if(!technical.test(value))fail('技術IDに文章形式の値を検出');
   surface.structuralIdTokens++;return;
  }
  if(/\.requires(?:\.(?:all|any)\.\[\])*\.(?:eventId|choiceId|outcomeId)$/.test(p)){
   if(!technical.test(value))fail('先行条件のIDに文章形式の値を検出');
   surface.referenceIdTokens++;return;
  }
  if(p.endsWith('.label')){
   if(/\.choices\.\[\]\.label$/.test(p)){
    if(!/^選択肢\d+（仮）$/u.test(value))
     fail('選択肢の元の文章が残っている');
    surface.generatedChoiceLabels++;return;
   }
   if(/\.outcomes\.\[\]\.label$/.test(p)){
    if(!/^結果\d+（仮）$/u.test(value))
     fail('結果の元の文章が残っている');
    surface.generatedOutcomeLabels++;return;
   }
   fail('未分類の表示ラベル');
  }
  if(/\.rewards\.\[\]\.verifiedSkillName$/.test(p)){
   if(!value.trim())fail('照合済みスキル表示名が空');
   surface.verifiedSkillNames++;return;
  }
  const enumField=/\.(?:type|availabilityKind|kind|sourceComponent|sourceBundle|targetSelection|scenario|duration|activation)$/.test(p);
  if(enumField&&enumToken.test(value)){
   surface.controlledVocabularyTokens++;return;
  }
  // For example, reward.condition may carry an unclassified prose note,
  // even if the schema originally permitted a nonempty string.
  surface.unknownStringLeaves++;
  fail('想定外の文字列フィールド（値や場所は非表示）');
 }
 function walk(x,path){
  if(typeof x==='string'){classify(x,path);return;}
  if(Array.isArray(x)){
   x.forEach(y=>walk(y,[...path,'[]']));return;
  }
  if(obj(x)){
   for(const [k,v] of Object.entries(x))walk(v,[...path,k]);
   return;
  }
  if(x!==null&&!['boolean','number','undefined'].includes(typeof x))
   fail('未分類のデータ型');
 }
 walk(catalog,[]);
 const titleCount=catalog.cards.reduce((n,c)=>n+(c.events?.length||0),0);
 if(surface.titles!==titleCount||
    surface.titleLength.upTo12+surface.titleLength.from13To40+
    surface.titleLength.from41To90+surface.titleLength.over90!==titleCount||
    surface.sourceOrdinalEventIds+surface.curatedEventIds!==titleCount)
  fail('文字列全件集計とイベント件数が不一致');
 if(strict&&(catalog.cards.length!==563||titleCount!==2512||
   surface.sourceOrdinalEventIds!==2488||
   surface.curatedEventIds!==24||
   surface.generatedChoiceLabels!==3269||
   surface.generatedOutcomeLabels!==512||
   surface.verifiedSkillNames!==1735||
   surface.unknownStringLeaves!==0))
  fail('固定2512件の公開候補表記契約が変わった');
 return {
  status:'PRIVATE_STRING_SURFACE_NOT_LEGAL_CLEARANCE',
  counts:surface,
  contract:{
   onlyRetainedFreeTextCategories:['event-title','verified-skill-name'],
   noSourceDialogueOrArticleProseFields:true,
   sourceEventOrderEncodedInIds:true,
   sourceSelectionAndRelationshipsNeedSeparateAssessment:true,
   stringAuditDoesNotProveOriginalityOrTruth:true,
   upstreamTermsOrRightsResolved:false,
   publicationApproved:false,
   publishedEventRecords:0,
   actualSourceContentReturned:false
  }
 };
};
module.exports={inspect};
