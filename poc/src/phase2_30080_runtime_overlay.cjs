'use strict';
/*
 * APPLY ONE GameWith-adjudicated exception to a *private* GameTora runtime
 * projection. Never write this result into the reviewed public catalog.
 * SSR30080 source event #6 is a special trigger with three ACTUAL player
 * options, despite the pinned GT data flattening them into one auto row.
 */
const core=require('./core.js');
const schema=require('./event_schema.js');
const {digest}=require('./event_release_gate.cjs');
const {build:buildEditorial}=require('./phase2_30080_three_choice_repair.cjs');
const fail=s=>{throw Error('30080実行候補の3択統合: '+s);};
const EXPECTED={cardId:'30080',sourceOrdinal:6,localId:1392,
 eventId:'gt-30080-event-006',specialAvailability:'special-trigger',
 skillId:'skill:201591',hintLevel:3};
function apply({catalog,normalized,review}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    normalized?.dataKind!=='gametora-whole-event-numeric-candidate'||
    normalized.releaseApproved!==false||
    review?.dataKind!=='gametora-2488-unsigned-publication-review-queue'||
    review.automaticallyReleaseApproved!==false||
    !Array.isArray(review.rows)||
    review.sourcePins?.gameToraDerived!==normalized.sourcePins?.gameToraDerived)
  fail('固定元・未署名候補・投影データの契約違反');
 const editorial=buildEditorial();
 if(editorial.editorialDecision.publicationApproved!==false||
    editorial.summary.publicEvents!==0||
    editorial.summary.adoptedSelectableAlternatives!==3)
  fail('GameWith編集裁定が未署名の3択でありません');
 const source=normalized.cards.find(c=>c.cardId===EXPECTED.cardId);
 const card=catalog.cards.find(c=>c.cardId===EXPECTED.cardId);
 const record=source?.events?.find(e=>e.sourceOrdinal===EXPECTED.sourceOrdinal);
 const old=card?.events?.find(e=>e.id===EXPECTED.eventId);
 const approvalRow=review.rows.find(e=>
  e.cardId===EXPECTED.cardId&&e.sourceOrdinal===EXPECTED.sourceOrdinal);
 if(!record||!old||!card||!source||!approvalRow||
    normalized.cards.filter(c=>c.cardId===EXPECTED.cardId).length!==1||
    catalog.cards.filter(c=>c.cardId===EXPECTED.cardId).length!==1||
    source.events.filter(e=>e.sourceOrdinal===EXPECTED.sourceOrdinal).length!==1||
    card.events.filter(e=>e.id===EXPECTED.eventId).length!==1||
    record.sourceLocalEventId!==EXPECTED.localId||
    record.section!=='special'||record.choices.length!==1||
    record.choices[0].sourceLabelWasEmpty!==true||
    old.type!=='auto'||old.availabilityKind!==EXPECTED.specialAvailability||
    old.choices!==undefined||old.requires!==undefined||
    !Array.isArray(old.rewards)||old.rewards.length!==1||
    old.outcomes!==undefined||
    old.rewards[0].skillId!==EXPECTED.skillId||
    old.rewards[0].level!==EXPECTED.hintLevel||
    typeof old.rewards[0].verifiedSkillName!=='string'||
    !old.rewards[0].verifiedSkillName.trim()||
    approvalRow.eventId!==EXPECTED.eventId||
    approvalRow.eventSha256!==digest(old)||
    approvalRow.releaseApproved!==false||
    approvalRow.status!=='PENDING_HUMAN_PUBLICATION_REVIEW')
  fail('元GT特殊イベントの1行、スキルID、公開前SHAが厳密に一致しない');
 const sourceRoutes=record.choices[0].routes||[];
 if(sourceRoutes.length!==1||
    sourceRoutes[0].numericHintFacts?.length!==1||
    sourceRoutes[0].numericHintFacts[0]?.skillNumericId!=='201591'||
    sourceRoutes[0].numericHintFacts[0]?.level!==3)
  fail('元GTのスキル位置とヒントLvが既存裁定に一致しない');
 // Reuse the individually adjudicated 3 alternatives. The non-skill effect
 // ranges remain editorial evidence; they are NOT unconditional skill routes.
 // A corrected selection must retain the independently source-verified
 // numeric ID -> Japanese name identity from the ORIGINAL pinned GT row.
 // The editorial GameWith 3-choice draft intentionally contains only IDs.
 // Without this bridge the actual public loader cannot validate the patch.
 const choices=editorial.provisionalCatalog.cards[0].events[0].choices.map(c=>({
  ...c,rewards:c.rewards.map(r=>({
   ...r,verifiedSkillName:old.rewards[0].verifiedSkillName
  }))
 }));
 if(choices.length!==3||choices.some((c,i)=>
    c.id!=='option'+(i+1)||c.rewards.length!==1||
    c.rewards[0].skillId!==EXPECTED.skillId||
    c.rewards[0].level!==EXPECTED.hintLevel))
  fail('3つの独立操作位置とID/Lvが異なる');
 const next=structuredClone(catalog);
 const updated=next.cards.find(c=>c.cardId===EXPECTED.cardId);
 const index=updated.events.findIndex(e=>e.id===EXPECTED.eventId);
 const patched={id:old.id,name:old.name,type:'choice',
  availabilityKind:old.availabilityKind,
  choices:structuredClone(choices)};
 updated.events[index]=patched;
 schema.validateEvents([patched],{
  skillById:{[EXPECTED.skillId]:{id:EXPECTED.skillId}}
 },EXPECTED.cardId);
 const trial={id:EXPECTED.cardId,hints:[],events:[patched]};
 const observed=[];
 for(let pick=0;pick<=3;pick++){
  const options=pick===0?{}:{[patched.id]:'option'+pick};
  const routes=core.directRoutes(trial,{stage:4,choices:options,outcomes:{}})
   .filter(x=>x.source==='event'&&x.eventId===patched.id);
  if(routes.length!==(pick===0?0:1)||
     routes.some(x=>x.skillId!==EXPECTED.skillId||
       x.level!==EXPECTED.hintLevel||
       x.conditional!==true||
       !String(x.condition).includes('特殊イベントの発生時')))
   fail('選択なし、特殊発生、3択報酬が本番集計で誤っている');
  observed.push(routes.length);
 }
 if(next.cards.reduce((n,c)=>n+c.events.length,0)!==
    catalog.cards.reduce((n,c)=>n+c.events.length,0))
  fail('1イベントの選択肢補正でイベント件数が変化');
 return {catalog:next,reviewEvidence:{
  cardId:EXPECTED.cardId,sourceOrdinal:EXPECTED.sourceOrdinal,
  eventId:patched.id,beforeEventSha256:digest(old),
  afterEventSha256:digest(patched),editorialSource:'GameWith',
  sourceChoiceRows:1,adjudicatedPlayerChoices:3,
  runtimeSelectedHintRoutes:observed,conditionalSpecialTriggerPreserved:true,
  nonSkillRangesNotConvertedToGuaranteedHints:true,
  publicationApproved:false,automaticRuntimeRelease:false
 }};
}
module.exports={apply};
