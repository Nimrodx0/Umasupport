'use strict';
/**
 * User-facing selection-text policy for all support event intake.
 * Gender affects only the DISPLAY LABEL, never the effect/outcome routing.
 * This is not a licence to republish sourced wording.
 */
const MALE_CHOICE_GENDER='male';
function selectMaleChoiceLabel(input){
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw Error('選択肢の性別表示ソースが不正');
 const variants=input.genderVariants;
 if(!variants||typeof variants!=='object'||Array.isArray(variants))
  throw Error('性別による選択肢の表記が未指定');
 if(Object.keys(variants).some(x=>!['male','female'].includes(x)))
  throw Error('未定義の性別表記');
 const male=variants.male;
 const female=variants.female;
 if(typeof male!=='string'||male.trim().length===0||male.length>500)
  return {status:'male-label-missing',gender:MALE_CHOICE_GENDER,
   label:null,publicationApproved:false};
 if(female!=null&&(typeof female!=='string'||female.length>500))
  throw Error('女性側の表記が不正');
 return {status:'male-label-selected',gender:MALE_CHOICE_GENDER,
  label:male.trim(),publicationApproved:false};
}
function selectMaleChoices(event){
 if(!event||!Array.isArray(event.choices)||event.choices.length>30)
  throw Error('選択肢データが不正');
 const choices=event.choices.map((choice,i)=>{
  if(!choice||typeof choice!=='object'||Array.isArray(choice))
   throw Error('選択肢データが不正');
  const chosen=selectMaleChoiceLabel(choice);
  return {ordinal:i+1,label:chosen.label,status:chosen.status,
   gender:MALE_CHOICE_GENDER,publicationApproved:false};
 });
 return {
  cardId:event.cardId??null,eventId:event.eventId??null,
  selectedGender:MALE_CHOICE_GENDER,
  allMaleLabelsPresent:choices.every(x=>x.status==='male-label-selected'),
  choices,automaticPublicationAllowed:false
 };
}
module.exports={MALE_CHOICE_GENDER,selectMaleChoiceLabel,selectMaleChoices};
