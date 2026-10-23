'use strict';
/* Local-only browser review view model for exactly 4 × 2 non-chained event
 * drafts. Sources have been editorially adjudicated, NOT release-approved.
 * Source headings are displayed exactly as listed by the designated GameWith
 * adjudicator. No separate gameplay reproduction is required for adoption.
 * Source event ordinals are NOT numeric in-game event IDs; the original
 * narrative or choice prose is not bundled. Public release still requires
 * rights/review approval.
 */
const crypto=require('node:crypto');
const {build:buildPack}=require('./phase2_eight_standalone_review_pack.cjs');
const fail=s=>{throw Error('Phase2ローカルイベント画面: '+s);};
const LABELS=Object.freeze({
 '30318':{name:'ライスシャワー',events:[
  {event:4,sourceTitle:'お花屋さんでの1ページ',headingHash:'08ff420534a9c00b877ae2a9a995f25e92d59b4b4fc0959105c42382732b20c6'},
  {event:5,sourceTitle:'曇りの日の1ページ',headingHash:'8d238e7297ff9fa60732a8b2dad2828e6d9092fc1f32a78467ece351eff4b8de'}]},
 '30319':{name:'ナリタブライアン',events:[
  {event:4,sourceTitle:'生徒会役員！',headingHash:'43a805307b71c8ec9aa03710fccff36e80bba7bf96c5a2d961b43e1432f4b896'},
  {event:5,sourceTitle:'孤狼',headingHash:'c7b1b3265646e6022a794f66cd200ca52bbd67780e86eba46e75ed3a47ac7aa4'}]},
 '30320':{name:'アドマイヤグルーヴ',events:[
  {event:4,sourceTitle:'窓側が好きなお客さん',headingHash:'f21dca6c604b21ce8a3f48479bf293c7137137be2de14406d9dcd1c21611e8b5'},
  {event:5,sourceTitle:'ひとりが好きなクラスメイトさん',headingHash:'0acac3ae928b208d7f45ab663f0cc7f3fe8edba5c4e38cb5f0052caeab06a5f7'}]},
 '30321':{name:'ドゥラメンテ',events:[
  {event:4,sourceTitle:'流すべきこの汗',headingHash:'5e183a7150af7980fd5f24fd3a130c08f4226459c23b478ca9fdc7b8fd949871'},
  {event:5,sourceTitle:'追うべき背中',headingHash:'6435c76e4fdc53bfb7be375522d3b443c8ca2c268cd1aa254b43ed59fcdafc78'}]}
});
const HINT_NAMES=Object.freeze({'200152':'良バ場○','201641':'一匹狼',
 '202082':'ワンチャンス','202602':'イグニッション'});
function buildView(options={}){
 const result=buildPack(options),cards=[];
 let listed=0,choiceCount=0,hintCount=0;
 for(const card of result.previewCatalog.cards){
  const meta=LABELS[card.cardId];
  if(!meta||card.events.length!==2)fail('想定外カード');
  const events=card.events.map((event,i)=>{
   const m=meta.events[i],row=result.records.find(r=>
    r.cardId===card.cardId&&r.sourceOrdinal===m.event);
   if(!row||!/^([a-f0-9]{64})$/.test(m.headingHash)||
    row.neutralDisplayDraft.name!==event.name||
    fingerprint(m.sourceTitle)!==m.headingHash||
    row.proposedReviewKey!==event.id||
    row.choiceFacts.length!==2||event.choices.length!==2)
    fail('仮表示と数値採用監査の結合位置が違う: '+card.cardId+'/'+m.event+
      ' row='+!!row+' fp='+/^([a-f0-9]{64})$/.test(m.headingHash)+
      ' title='+(row?.neutralDisplayDraft?.name===event.name)+
      ' key='+(row?.proposedReviewKey===event.id)+
      ' choices='+(row?.choiceFacts?.length)+'/'+event.choices.length);
   const choices=event.choices.map((c,j)=>{
    const facts=row.choiceFacts[j];
    if(c.id!=='option'+(j+1)||facts.choiceOrdinal!==j+1||
     c.rewards.length!==facts.skillHints.length)fail('異なる選択位置');
    const hints=facts.skillHints.map(h=>{
     if(typeof HINT_NAMES[h.skillNumericId]!=='string')
      fail('表示用のヒント名が未照合');
     return {skillId:'skill:'+h.skillNumericId,level:h.hintLevel,
      displayName:HINT_NAMES[h.skillNumericId]};
    });
    if(JSON.stringify(c.rewards.map(h=>[h.skillId,h.level]))!==
       JSON.stringify(hints.map(h=>[h.skillId,h.level])))
     fail('表示用ヒントの数値IDとレベルが異なる');
    choiceCount++;hintCount+=hints.length;
    return {id:c.id,ordinal:j+1,
     effects:facts.numericEffects.map(x=>({kind:x.kind,value:x.value})),hints,
     sourceChoiceFactsAdopted:true,
     unreportedVariantsNotInferred:true,publicationApproved:false};
   });
   listed++;
   return {id:event.id,editorialOrdinal:m.event,
    eventTitle:m.sourceTitle,
    displayKind:'GAMEWITH_ADJUDICATED_EVENT_TITLE',
    sourceHeadingSha256:m.headingHash,
    sourceEventPositionAdjudicated:true,
    sourceChoiceCountAdopted:true,
    gameplayVerificationRequiredForAdoption:false,
    unreportedOutcomeBranchesNotInvented:true,
    sourceUrl:row.adjudicatingGameWithUrl,
    supplementaryEventUrl:row.supplementaryEventUrl,
    blockers:[...row.blockers],choices};
  });
  cards.push({cardId:card.cardId,displayName:meta.name,events});
 }
 if(cards.length!==4||listed!==8||choiceCount!==16||hintCount!==4)
  fail('カード4・通常8・選択肢16・ヒント4の保存則');
 return {schemaVersion:1,dataKind:'local-only-unapproved-8-standalone-review',
  checkedAt:'2026-10-23',nonpublic:true,
  sourceEventTitlesIncluded:true,sourceNarrativeOrChoiceProseIncluded:false,
  gameplayVerificationRequiredForAdoption:false,headingsReleaseApproved:false,
  choicesReleaseApproved:false,publicCatalogAltered:false,
  note:'イベント名と数値・選択肢数は指定出典に従い編集採用済み。未掲載の結果・分岐は推測しません。公開審査は未完了。',
  summary:{cards:4,events:8,choiceRows:16,hintMentions:4,approvedEvents:0},
  cards};
}
function fingerprint(normalizedTitle){
 const text=String(normalizedTitle).normalize('NFKC').replace(/\s+/gu,' ').trim();
 return crypto.createHash('sha256').update(text).digest('hex');
}
module.exports={buildView,fingerprint,LABELS,HINT_NAMES};
