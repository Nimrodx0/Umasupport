'use strict';
/*
 * The first eight GameWith-adjudicated standalone events, as an OFFLINE
 * release-review candidate. This is not a signature or a publication action.
 * The public catalog and approval ledger MUST remain unchanged.
 */
const {buildView}=require('./phase2_eight_event_review_view.cjs');
const schema=require('./event_schema.js');
const {digest,verifyRelease}=require('./event_release_gate.cjs');
const publicCatalog=require('./public_event_catalog.js');
const currentPublished=require('../data/reviewed_events.v1.json');
const currentApprovals=require('../config/event-release-approvals.v1.json');

const fail=message=>{throw Error('Phase2通常8件公開候補: '+message);};
const CHECKS=['card','event','choices','outcomes','dependencies','publication'];
const EXPECTED=[
 ['30318',4],['30318',5],['30319',4],['30319',5],
 ['30320',4],['30320',5],['30321',4],['30321',5]
];
function candidateId(cardId,ordinal){
 if(!/^303(18|19|20|21)$/.test(cardId)||![4,5].includes(ordinal))
  fail('対象外のサポカまたはイベント位置');
 return 'usl:'+cardId+':random:'+ordinal;
}
function build(){
 // The source review pack checks fixed GameWith facts, headers, ordinals,
 // source SHA and the fact that all eight are still outside publication.
 const view=buildView();
 if(verifyRelease(currentPublished,currentApprovals).publicEvents!==0)
  fail('既存公開データが変わっています。新規追加方式を再審査してください');
 const cards=[],reviews=[],checked=[];
 let totalChoices=0,totalHints=0;
 for(const card of view.cards){
  const events=[];
  for(const event of card.events){
   const id=candidateId(card.cardId,event.editorialOrdinal);
   checked.push([card.cardId,event.editorialOrdinal]);
   if(event.displayKind!=='GAMEWITH_ADJUDICATED_EVENT_TITLE'||
      !event.sourceEventPositionAdjudicated||
      !event.sourceChoiceCountAdopted||
      !event.unreportedOutcomeBranchesNotInvented||
      event.choices.length!==2||event.blockers.length!==3||
      !event.blockers.includes('DISPLAY_LABELS_NOT_APPROVED')||
      !event.blockers.includes('PUBLICATION_BASIS_NOT_APPROVED')||
      !event.blockers.includes('EVENT_RELEASE_EVIDENCE_NOT_APPROVED'))
    fail('出典の採用と未承認の境界が変化');
   const choices=event.choices.map((choice,i)=>{
    if(choice.ordinal!==i+1||choice.id!=='option'+(i+1)||
       choice.publicationApproved!==false||
       !choice.sourceChoiceFactsAdopted||
       !choice.unreportedVariantsNotInferred)
     fail('選択肢の位置または未公開状態が不正');
    const rewards=choice.hints.map(h=>{
     if(!/^skill:\d+$/.test(h.skillId)||
        !Number.isInteger(h.level)||h.level<1||
        typeof h.displayName!=='string'||!h.displayName)
      fail('スキル数値IDと照合名が不正');
     totalHints++;
     return {skillId:h.skillId,verifiedSkillName:h.displayName,level:h.level};
    });
    totalChoices++;
    // Ordinal labels are *new* navigational descriptions, not copied game
    // dialogue or a claim that GameWith choice prose was licensed.
    return {id:choice.id,label:i===0?'上の選択肢':'下の選択肢',rewards};
   });
   const target={id,name:event.eventTitle,type:'choice',choices};
   const urls=[event.sourceUrl,...(event.supplementaryEventUrl?
    [event.supplementaryEventUrl]:[])];
   if(urls.some(u=>typeof u!=='string'||!u.startsWith('https://gamewith.jp/')))
    fail('指定裁定元の記事URLが不正');
   reviews.push({
    cardId:card.cardId,sourceOrdinal:event.editorialOrdinal,eventId:id,
    eventSha256:digest(target),status:'PENDING_HUMAN_RELEASE_REVIEW',
    // Deliberately INELIGIBLE for the release gate: no reviewer, date,
    // license declaration or six signed checks are manufactured here.
    reviewer:null,reviewedAt:null,
    checks:Object.fromEntries(CHECKS.map(key=>[key,false])),
    evidence:{card:[event.sourceUrl],event:[event.sourceUrl],
     choices:[...urls],outcomes:[...urls],dependencies:[...urls],
     publication:[]},
    publicationBasis:null,
    requiredReview:[
     '上/下の選択肢ラベルで利用者が正確に選択できるか',
     'GameWith掲載範囲を超える結果・後続条件を推測していないか',
     'イベント名と短い独自ラベルの公開利用範囲・出典表示',
     '選択肢ごとのヒントID・Lvと採用した元データの対応'
    ]
   });
   events.push(target);
  }
  cards.push({cardId:card.cardId,coverageStatus:'partial',events});
 }
 if(JSON.stringify(checked)!==JSON.stringify(EXPECTED)||
    reviews.length!==8||totalChoices!==16||totalHints!==4)
  fail('4カード/8イベント/16選択/4ヒントの母数が変化');
 const catalog={schemaVersion:1,cards};
 const skillIds=[...new Set(cards.flatMap(c=>c.events.flatMap(e=>
  e.choices.flatMap(x=>x.rewards.map(y=>y.skillId)))))];
 const model={cards:cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries(skillIds.map(id=>[id,{id}]))};
 const validated=schema.validateCatalog(catalog,model);
 if(validated.eventsWithRecords!==8||validated.cardsWithRecords!==4)
  fail('本番イベントスキーマに不適合');
 // Even if passed as a complete ledger, this packet MUST fail the exact
 // production release gate, which needs user-signed approvals.
 let rejected=false;
 try{verifyRelease(catalog,{schemaVersion:1,entries:reviews});}
 catch(_){rejected=true;}
 if(!rejected)fail('未承認データが公開ゲートを通過しました');
 return {dataKind:'phase2-eight-standalone-release-review-PENDING',
  status:'NOT_APPROVED_FOR_PUBLICATION',
  sourceNarrativeOrChoiceProseIncluded:false,
  generatedFromReviewedFacts:true,
  catalog,approvalWorksheet:{schemaVersion:1,entries:reviews},
  summary:{cards:4,events:8,choices:16,hints:4,approvedEvents:0}};
}
function dryRunWithSkillText(skillText){
 const packet=build();
 const model={cards:packet.catalog.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(packet.catalog.cards.map(c=>
   [c.cardId,{id:c.cardId,hints:[],events:[]}])),
  skills:[],skillById:{},meta:{}};
 const result=publicCatalog.preflight(model,packet.catalog,{skillText});
 if(result.summary.eventsWithRecords!==8)
  fail('本番イベントDB読込形式が不正');
 return {matchedEvents:result.summary.eventsWithRecords,
  uniqueCards:result.summary.cardsWithRecords,
  resolvedSkills:result.prepared.skills.length};
}
module.exports={build,dryRunWithSkillText,candidateId};
