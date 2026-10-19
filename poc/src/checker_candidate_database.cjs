/*
 * Umasupport-owned, text-free database of UNREVIEWED support-event skill facts.
 * This is NOT the reviewed event catalog and MUST NOT be used to grant skills
 * or infer guaranteed in-game events. The source documents are not reproduced.
 */
'use strict';
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^\d{5}$/.test(x);
const sid=x=>typeof x==='string'&&/^\d+$/.test(x);
const digest=x=>typeof x==='string'&&/^sha256:[0-9a-f]{64}$/.test(x);
const key=x=>typeof x==='string'&&/^checker:\d{5}:[0-9a-f]{20}$/.test(x);
const int=x=>Number.isSafeInteger(x)&&x>=0;
const STAT_KEYS=['cardsWithCandidates','eventsObserved','choiceRowsObserved',
 'extractedHintRows','matchedNumericHints','unresolvedHints','ambiguousHints',
 'unparsedHintChoiceRows','conditionalChoiceRows'];
const emptyStats=()=>Object.fromEntries(STAT_KEYS.map(x=>[x,0]));
function fail(s){throw Error('候補DB: '+s);}
function pinsOk(p){
 if(!obj(p)||!['checker','cruise','umasimCards','umasimSkills'].every(x=>obj(p[x])))fail('出典のバージョン情報が欠けています');
 for(const x of Object.values(p)){
  if(typeof x.url!=='string'||!x.url.startsWith('https://raw.githubusercontent.com/')||
     typeof x.revision!=='string'||!/^[0-9a-f]{40}$/.test(x.revision)||
     typeof x.sha256!=='string'||!/^[0-9a-f]{64}$/.test(x.sha256))fail('出典のハッシュ情報が不正');
 }
}
function validate(db){
 if(!obj(db)||db.schemaVersion!==1||db.dataKind!=='support-event-hint-candidates'||
    db.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||db.forSkillGrant!==false||
    !Array.isArray(db.cards)||!Array.isArray(db.reviewQueue))fail('DBの型・公開区分が不正');
 pinsOk(db.sourcePins);
 const counters=emptyStats(),cards=new Set(),events=new Map(),positions=new Set();
 for(const card of db.cards){
  if(!obj(card)||!id(card.cardId)||cards.has(card.cardId)||!['SSR','SR'].includes(card.rarity)||
    !Array.isArray(card.events)||Object.keys(card).some(k=>!['cardId','rarity','events'].includes(k)))
   fail('カードIDまたはフィールドが不正');
  cards.add(card.cardId);counters.cardsWithCandidates++;
  for(let i=0;i<card.events.length;i++){
   const event=card.events[i];
   if(!obj(event)||!key(event.sourceKey)||!event.sourceKey.startsWith('checker:'+card.cardId+':')||
      !digest(event.sourceDigest)||events.has(event.sourceKey)||event.ordinal!==i+1||
      !Array.isArray(event.choices)||
      Object.keys(event).some(k=>!['sourceKey','sourceDigest','ordinal','choices'].includes(k)))
    fail('イベントキーと並び順が不正');
   events.set(event.sourceKey,{cardId:card.cardId,digest:event.sourceDigest,
    choices:event.choices.length});counters.eventsObserved++;
   for(let j=0;j<event.choices.length;j++){
    const c=event.choices[j];
    if(!obj(c)||c.ordinal!==j+1||!Array.isArray(c.observedHints)||
       typeof c.needsManualResultReview!=='boolean'||
       (c.unparsedHintSyntax!==undefined&&c.unparsedHintSyntax!==true)||
       Object.keys(c).some(k=>!['ordinal','observedHints','needsManualResultReview','unparsedHintSyntax'].includes(k)))
      fail('選択肢の順序・フィールドが不正');
    positions.add(event.sourceKey+':'+c.ordinal);
    counters.choiceRowsObserved++;
    if(c.needsManualResultReview)counters.conditionalChoiceRows++;
    if(c.unparsedHintSyntax)counters.unparsedHintChoiceRows++;
    for(const hint of c.observedHints){
     if(!obj(hint)||!int(hint.level)||hint.level<1||hint.level>10)fail('ヒントLvが不正');
     counters.extractedHintRows++;
     if(sid(hint.skillId)&&Object.keys(hint).length===2&&own(hint,'level'))
      counters.matchedNumericHints++;
     else if(typeof hint.skillName==='string'&&hint.skillName.length<120&&
       ['missing','ambiguous'].includes(hint.resolution)&&
       Object.keys(hint).sort().join(',')==='level,resolution,skillName'){
      counters[hint.resolution==='missing'?'unresolvedHints':'ambiguousHints']++;
     }else fail('ヒントのID・未解決理由・フィールドが不正');
    }
   }
  }
 }
 const rows=new Set();let p0=0,p1=0,p2=0,p3=0;
 const reasons=['unparsed-hint','ambiguous-skill-id','missing-skill-id','conditional-result','cruise-only-title','checker-empty'];
 for(const item of db.reviewQueue){
  if(!obj(item)||!id(item.cardId)||!cards.has(item.cardId)||
      !['P0','P1','P2','P3'].includes(item.priority)||
      !Array.isArray(item.reasons)||item.reasons.length===0||
      item.reasons.some(x=>!reasons.includes(x))||
      item.requiresIndependentReview!==true)
   fail('レビュー対象の参照先が不正');
  let ref;
  if(item.scope==='choice'){
   if(!key(item.sourceKey)||!int(item.eventOrdinal)||!int(item.choiceOrdinal)||
      item.eventOrdinal<1||item.choiceOrdinal<1||!digest(item.sourceDigest))fail('選択肢のレビュー参照が不正');
   const e=events.get(item.sourceKey);
   if(!e||e.cardId!==item.cardId||e.digest!==item.sourceDigest||
      item.choiceOrdinal>e.choices)fail('イベントのダイジェストまたは選択肢位置が不一致');
   ref=item.sourceKey+':'+item.choiceOrdinal;
   if(!positions.has(ref))fail('不存在の選択肢');
  }else if(item.scope==='card')ref=item.cardId+':'+item.reasons[0];
  else fail('レビュー対象種別が不正');
  if(rows.has(ref))fail('レビュー対象が重複');rows.add(ref);
  if(item.priority==='P0')p0++;if(item.priority==='P1')p1++;
  if(item.priority==='P2')p2++;if(item.priority==='P3')p3++;
  const allowed=item.scope==='choice'?
   ['scope','cardId','sourceKey','sourceDigest','eventOrdinal','choiceOrdinal','priority','score','reasons','observedHintCount','requiresIndependentReview']:
   ['scope','cardId','priority','score','reasons','cruiseOnlyTitles','comparisonJoin','requiresIndependentReview'];
  if(Object.keys(item).some(k=>!allowed.includes(k)))fail('原文か未承認のメタデータがレビューに混入');
 }
 if(!obj(db.stats))fail('件数メタデータ不正');
 for(const [k,v] of Object.entries(counters)){
  if(k==='conditionalChoiceRows')continue; // Includes unparsed-only marker; see source note.
  if(db.stats[k]!==v)fail('収録件数が本文と一致しない: '+k);
 }
 if(!obj(db.stats.priorityEntries)||db.stats.priorityEntries.P0!==p0||
    db.stats.priorityEntries.P1!==p1||db.stats.priorityEntries.P2!==p2||
    db.stats.priorityEntries.P3!==p3||db.stats.queueEntries!==db.reviewQueue.length)
  fail('レビューキュー件数が不正');
 return {cards:cards.size,events:counters.eventsObserved,choices:counters.choiceRowsObserved,
  numericHints:counters.matchedNumericHints,pendingHints:counters.unresolvedHints+counters.ambiguousHints,
  reviewEntries:db.reviewQueue.length,priorityEntries:db.stats.priorityEntries};
}
function compile({candidates,queue,sourcePins}){
 if(!obj(candidates)||candidates.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
   !Array.isArray(candidates.cards)||!obj(queue)||queue.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION')
  fail('未承認の一括候補とレビュー索引が必要です');
 pinsOk(sourcePins);
 const cards=candidates.cards.map(c=>({
  cardId:c.cardId,rarity:c.rarity,
  events:c.events.map(e=>({
   sourceKey:e.sourceKey,sourceDigest:e.sourceDigest,
   ordinal:e.sourceEventOrdinal,
   choices:e.choices.map(ch=>({
    ordinal:ch.ordinal,
    observedHints:ch.observedHints.map(h=>h.skillId?
     {skillId:h.skillId,level:h.level}:
     {skillName:h.skillName,resolution:h.resolution,level:h.level}),
    needsManualResultReview:ch.needsManualResultReview,
    ...(ch.unparsedHintSyntax?{unparsedHintSyntax:true}:{})
   }))
  }))
 }));
 const db={
  schemaVersion:1,dataKind:'support-event-hint-candidates',
  approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
  forSkillGrant:false,sourcePins,
  stats:{...candidates.stats,
   ...queue.totals,
   // Source extract counts conditional/unparsed overlap separately; preserve raw value.
   conditionalChoiceRows:candidates.stats.conditionalChoiceRows},
  cards,reviewQueue:queue.reviewQueue
 };
 validate(db);
 return db;
}
function card(db,cardId){validate(db);return db.cards.find(x=>x.cardId===cardId)||null;}
module.exports={compile,validate,card};
