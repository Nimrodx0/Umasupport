'use strict';
/* Static Pages preview export: a deliberately tiny, labelled subset of the
 * already adjudicated eight standalone event facts. Never an event release.
 * Does NOT copy GameWith event paragraphs, choice dialogue, imagery or the
 * full source editorial ledger. No external requests.
 */
const {buildView}=require('./phase2_eight_event_review_view.cjs');
const {candidateId}=require('./phase2_eight_release_candidate.cjs');
const fail=m=>{throw Error('Phase2 Pages試用データ: '+m);};
function build(){
 const reviewed=buildView();
 if(reviewed.summary.cards!==4||reviewed.summary.events!==8||
    reviewed.summary.choiceRows!==16||reviewed.summary.hintMentions!==4||
    reviewed.summary.approvedEvents!==0||reviewed.nonpublic!==true||
    reviewed.sourceNarrativeOrChoiceProseIncluded!==false)
  fail('限定編集資料の件数と公開境界に異常');
 let count=0,hints=0;
 const cards=reviewed.cards.map(card=>({
  cardId:card.cardId,name:card.displayName,
  events:card.events.map(e=>{
   if(e.displayKind!=='GAMEWITH_ADJUDICATED_EVENT_TITLE'||
      !e.sourceEventPositionAdjudicated||!e.unreportedOutcomeBranchesNotInvented||
      e.choices.length!==2||
      !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(e.sourceUrl))
    fail('GameWith編集採用済みの通常2択だけを試用できます');
   return {
    id:candidateId(card.cardId,e.editorialOrdinal),
    title:e.eventTitle,ordinal:e.editorialOrdinal,
    sourceUrl:e.sourceUrl,
    choices:e.choices.map((choice,i)=>{
     if(choice.id!=='option'+(i+1)||choice.ordinal!==i+1||
        !choice.sourceChoiceFactsAdopted||!choice.unreportedVariantsNotInferred||
        choice.publicationApproved!==false)
      fail('分岐の元位置が未検証');
     count++;hints+=choice.hints.length;
     return {
      id:choice.id,
      effects:choice.effects.map(x=>[x.kind,x.value]),
      hints:choice.hints.map(h=>[h.skillId,h.level,h.displayName])
     };
    })
   };
  })
 }));
 if(count!==16||hints!==4)fail('選択肢16とヒント4の保存則');
 return {schemaVersion:1,dataKind:'phase2-eight-standalone-browser-preview',
  previewOnly:true,formallyApproved:false,
  sourceNarrativeOrChoiceProseIncluded:false,cards};
}
module.exports={build};
