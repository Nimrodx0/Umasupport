/* Checks independently transcribed, non-quotational Game8/Wiki fact candidates.
 * This document is not an event catalog and must never be attached to a deck.
 */
'use strict';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const fail=message=>{throw Error('SSRイベント候補検証: '+message);};
const keys=(o,allow,where)=>{for(const key of Object.keys(o))if(!allow.includes(key))fail(where+': 不許可フィールド '+key);};
function validate(doc,expectedIds){
 if(!obj(doc)||doc.schemaVersion!==1||doc.kind!=='review-candidates-only'||!Array.isArray(doc.cards))
  fail('公開用に未承認の形式でなければなりません');
 keys(doc,['schemaVersion','kind','reviewedAt','cards'],'root');
 if(!Array.isArray(expectedIds)||new Set(expectedIds).size!==expectedIds.length||expectedIds.some(s=>!/^\d{5}$/.test(s)))fail('対象IDが不正');
 const expected=new Set(expectedIds),seen=new Set(),stats={cards:0,events:0,choiceEvents:0,autoEvents:0,unknownEvents:0,skillHintRows:0,structuralOnly:0};
 for(const card of doc.cards){
  if(!obj(card)||!expected.has(card.cardId)||seen.has(card.cardId))fail('対象カードIDが未定義・重複');
  seen.add(card.cardId);stats.cards++;
  keys(card,['cardId','status','sourceUrls','chain','random','cardLevelSkillCandidates'],'card '+card.cardId);
  if(!['skill-hint-candidates','structure-only'].includes(card.status))fail('レビュー状態不正');
  if(card.status==='structure-only')stats.structuralOnly++;
  if(!Array.isArray(card.sourceUrls)||card.sourceUrls.length<1||card.sourceUrls.some(u=>typeof u!=='string'||!/^https:\/\/(?:game8\.jp\/umamusume\/\d+|gametora\.com\/ja\/umamusume\/supports\/\d{5}-[a-z-]+|umamusu\.wiki\/Game%3A[\w%()-]+|gamewith\.jp\/uma-musume\/article\/show\/\d+)$/.test(u)))
   fail('出典URL不正');
  if(card.cardLevelSkillCandidates!==undefined){
    if(card.status!=='structure-only'||!Array.isArray(card.cardLevelSkillCandidates)||card.cardLevelSkillCandidates.length===0||
       new Set(card.cardLevelSkillCandidates).size!==card.cardLevelSkillCandidates.length||
       card.cardLevelSkillCandidates.some(v=>typeof v!=='string'||!v.trim()||v.length>80||/[\r\n<>]/.test(v)))
      fail('カードレベルのヒント候補は配置未確認の構造のみカードに限る');
  }
  if(!Array.isArray(card.chain)||!Array.isArray(card.random)||card.chain.length!==3||card.random.length!==2)fail('5イベント構造の不足');
  for(const [category,collection] of [['chain',card.chain],['random',card.random]]){
   for(let i=0;i<collection.length;i++){
    const event=collection[i],indexKey=category==='chain'?'step':'ordinal';
    if(!obj(event)||event[indexKey]!==i+1||!['choice','auto','unknown'].includes(event.mode)||!Array.isArray(event.hints))
     fail('イベント順序・型の不整合');
    keys(event,[indexKey,'mode','choiceCount','hints'],'event');
    stats.events++;
    if(event.mode==='unknown'){
      if(card.status!=='structure-only'||event.choiceCount!==undefined||event.hints.length!==0)fail('未知イベントに確定報酬');
      stats.unknownEvents++;continue;
    }
    if(card.status==='structure-only')fail('構造だけ確認したカードに確定イベント');
    if(event.mode==='auto'){
      if(event.choiceCount!==undefined)fail('自動イベントの選択肢数');
      stats.autoEvents++;
    }else{
      if(!Number.isInteger(event.choiceCount)||event.choiceCount<2||event.choiceCount>5)fail('選択肢数');
      stats.choiceEvents++;
    }
    const skillKeys=new Set();
    for(const h of event.hints){
      if(!obj(h)||typeof h.skillName!=='string'||!h.skillName.trim()||h.skillName.length>80||/[\r\n<>]/.test(h.skillName)||
         !Number.isInteger(h.hintLevel)||h.hintLevel<1||h.hintLevel>5)fail('ヒント報酬が不正');
      keys(h,['skillName','hintLevel','choiceIndex'],'hint');
      if(event.mode==='choice'&&(!Number.isInteger(h.choiceIndex)||h.choiceIndex<1||h.choiceIndex>event.choiceCount))fail('選択位置が不正');
      if(event.mode==='auto'&&h.choiceIndex!==undefined)fail('自動報酬に選択位置がある');
      const k=(h.choiceIndex||0)+'|'+h.skillName;
      if(skillKeys.has(k))fail('重複スキル報酬');
      skillKeys.add(k);stats.skillHintRows++;
    }
   }
  }
 }
 if(seen.size!==expected.size)fail('対象カードの一部が未掲載');
 return stats;
}
module.exports={validate};
