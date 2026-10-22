'use strict';
/*
 * Eight standalone, position-keyed GameWith-adjudicated SSR event facts.
 * This constructs a PRIVATE REVIEW PACK; it never writes public files,
 * never produces release approvals, and never asserts in-game event IDs.
 * Japanese display strings are review-only neutral placeholders, not source
 * event/choice prose nor approved user-facing labels.
 */
const {build:review3}=require('./phase2_remaining_ssr_intake.cjs');
const {build:review1}=require('./phase2_editorial_intake.cjs');
const {build:readiness}=require('./phase2_publication_readiness.cjs');
const schema=require('./event_schema.js');
const core=require('./core.js');
const {verifyRelease}=require('./event_release_gate.cjs');
const SRC3=require('../data/curation/adjudicated/30318-30320.v1.json');
const SRC1=require('../data/curation/adjudicated/30321.v1.json');
const LEDGER=require('../data/curation/adjudicated_event_facts.v1.json');
const PUBLISHED=require('../data/reviewed_events.v1.json');
const APPROVALS=require('../config/event-release-approvals.v1.json');
const fail=s=>{throw Error('4SSR・通常8件の非公開表示レビュー: '+s);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const SOURCE_HINTS=[
 ['30318',5,2,200152,1],
 ['30319',5,2,201641,1],
 ['30320',5,1,202082,1],
 ['30321',5,2,202602,1]
];
const PRIVATE_BLOCKERS=[
 'REAL_EVENT_IDENTITY_NOT_VERIFIED',
 'CHOICE_RESULT_TOPOLOGY_NOT_GAME_VERIFIED',
 'DISPLAY_LABELS_NOT_APPROVED',
 'CURRENT_GAME_FACTS_NOT_CONFIRMED',
 'PUBLICATION_BASIS_NOT_APPROVED',
 'EVENT_RELEASE_EVIDENCE_NOT_APPROVED'
];
function build({remaining=SRC3,duramente=SRC1,ledger=LEDGER,
 published=PUBLISHED,approvals=APPROVALS}={}){
 const p=readiness({four:remaining,ssr30321:duramente,
  centralLedger:ledger,published,releaseApprovals:approvals});
 if(p.summary.trackedPriorityEventPositions!==28||
  p.summary.publicEventsAlreadyApproved!==0||
  p.summary.releaseReadyPositions!==0)
  fail('重点28件の公開不許可ゲートと整合しない');
 if(verifyRelease(published,approvals).publicEvents!==0)
  fail('公開イベントの現行状態を未反映');
 const source3=review3(remaining),source1=review1(duramente);
 if(source3.summary.provisionalStandaloneEvents!==6||
    source1.summary.provisionalStandaloneEvents!==2||
    source3.summary.blockedChainEvents!==9||
    source1.summary.blockedChainEvents!==3)
  fail('既存の非公開4SSR編集台帳と合わない');
 const sources=[...remaining.cards,duramente];
 const draftCards=[...source3.provisionalCatalog.cards,
  ...source1.provisionalCatalog.cards];
 const cards=[],records=[],seen=new Set();
 let alternativeRows=0,hintMentions=0,effectFacts=0;
 for(let i=0;i<4;i++){
  const card=sources[i],draft=draftCards[i];
  if(!card||!draft||card.cardId!==draft.cardId||
    !['30318','30319','30320','30321'].includes(card.cardId)||
    !Array.isArray(card.events)||card.events.length!==5||
    !Array.isArray(draft.events)||draft.events.length!==2)
   fail('カードIDまたは通常2イベントの対応関係不正');
  const generated=[];
  for(let k=0;k<2;k++){
   const source=card.events[k+3],rendered=draft.events[k],ordinal=k+4;
   const identity=card.cardId+'/'+ordinal;
   if(seen.has(identity))fail('仮イベント位置が重複');
   seen.add(identity);
   const known=p.rows.find(r=>r.cardId===card.cardId&&
    r.sourceOrdinal===ordinal&&r.kind==='RANDOM');
   if(!known||known.sourceStatus!=='GAMEWITH_EDITORIAL_NUMERIC_ADOPTED'||
    known.releaseReady!==false||
    source?.ordinal!==ordinal||source.section!=='RANDOM'||
    source.choiceCount!==2||source.alternatives?.length!==2||
    rendered?.id!=='editorial_candidate_'+card.cardId+'_random_'+ordinal||
    rendered.type!=='choice'||rendered.name!=='通常イベント候補'+ordinal||
    rendered.choices?.length!==2||rendered.requires!==undefined)
    fail(identity+': 位置・2択・非連続の限定草稿不一致');
   const row={cardId:card.cardId,sourceOrdinal:ordinal,
    proposedReviewKey:'editorial_candidate_'+card.cardId+'_random_'+ordinal,
    identityKind:'CARD_AND_EDITORIAL_ORDINAL_NOT_GAME_EVENT_ID',
    gameEventIdVerified:false,
    sourceGameToraUrl:card.gameToraWebsite.url,
    adjudicatingGameWithUrl:card.gameWith.url,
    supplementaryEventUrl:card.cardId==='30319'&&ordinal===5?
     card.choicePresentationClarification.eventSpecificGameWithArticle:null,
    neutralDisplayDraft:{name:rendered.name,
     choices:rendered.choices.map(x=>x.label)},
    sourceTextOrImagesRedistributed:false,
    editorialChoiceCountAdopted:2,
    gameChoiceAndAllResultSemanticsVerified:false,
    resultBranchesExplicitlyVerified:false,
    sourceNumericEffectsNotUsedBySkillPlanner:true,
    choiceFacts:[],blockers:[...PRIVATE_BLOCKERS],
    editablePublicCopyApproved:false,publicationApproved:false,
    noAutomaticRuntimeAdoption:true};
   for(let c=0;c<2;c++){
    const sourceChoice=source.alternatives[c],choice=rendered.choices[c];
    if(sourceChoice?.ordinal!==c+1||choice?.id!=='option'+(c+1)||
       choice?.label!=='選択肢'+(c+1)||
       choice.outcomes!==undefined||choice.terminal!==undefined||
       choice.requires!==undefined||
       !Array.isArray(choice.rewards)||
       !Array.isArray(sourceChoice.effects)||!Array.isArray(sourceChoice.skillHints))
     fail(identity+'/'+(c+1)+': 選択位置・数値の形式不正');
    const numericSkills=sourceChoice.skillHints.map(h=>({
     skillNumericId:h.skillNumericId,hintLevel:h.hintLevel
    }));
    if(!equal(choice.rewards.map(v=>({
      skillNumericId:Number(v.skillId.slice('skill:'.length)),hintLevel:v.level
    })),numericSkills))
     fail(identity+'/'+(c+1)+': 非公開実行草稿とGameWith数値ヒント位置が相違');
    const effects=sourceChoice.effects.map(e=>({kind:e.kind,value:e.value}));
    const effectNames=new Set(effects.map(e=>e.kind));
    if(effects.some(e=>!Number.isInteger(e.value)||typeof e.kind!=='string')||
       effectNames.size!==effects.length)
     fail(identity+'/'+(c+1)+': 数値効果に不正または重複');
    row.choiceFacts.push({choiceOrdinal:c+1,displayPlaceholder:choice.label,
      numericEffects:effects,skillHints:numericSkills,
      publishedChoiceLabelApproved:false,
      completeOutcomeListVerified:false,
      actualGameChoiceVerified:false});
    alternativeRows++;hintMentions+=numericSkills.length;
    effectFacts+=effects.length;
   }
   records.push(row);generated.push(structuredClone(rendered));
  }
  cards.push({cardId:card.cardId,coverageStatus:'partial',events:generated});
 }
 const actualHints=records.flatMap(r=>r.choiceFacts.flatMap(c=>
  c.skillHints.map(h=>[r.cardId,r.sourceOrdinal,c.choiceOrdinal,
   h.skillNumericId,h.hintLevel])));
 if(!equal(actualHints,SOURCE_HINTS)||
    records.length!==8||alternativeRows!==16||hintMentions!==4||
    cards.length!==4||cards.some(c=>c.events.length!==2))
  fail('4SSR×2通常・16選択肢・4スキルの保護された数値が変化');
 const previewCatalog={schemaVersion:1,cards};
 if(!equal(previewCatalog,{schemaVersion:1,cards:draftCards}))
  fail('既存4SSRの入力済み非公開草稿と相違');
 const skillIds=new Set(actualHints.map(h=>'skill:'+h[3]));
 const model={cards:cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries([...skillIds].map(id=>[id,{id}]))};
 const schemaCheck=schema.validateCatalog(previewCatalog,model);
 if(schemaCheck.eventsWithRecords!==8||schemaCheck.cardsWithRecords!==4)
  fail('本番イベント・選択肢スキーマ照合失敗');
 return {schemaVersion:1,
  dataKind:'phase2-8-standalone-nonpublic-review-pack',
  gameDataIdentityOrPublicationApproved:false,
  sourceProseIncluded:false,
  noAutomaticRuntimeAdoption:true,
  previewCatalog,records,
  summary:{cards:4,standaloneEvents:8,choices:alternativeRows,
   numericEffectFacts:effectFacts,skillHintFacts:hintMentions,
   unpublishedSourceChainStages:12,
   gameEventIdsVerified:0,publicDisplayLabelsApproved:0,
   verifiedCompleteOutcomeTopologies:0,
   currentlyPublishedEvents:0,approvedForPublication:0},
  model};
}
function replay({cardId,sourceOrdinal,choiceOrdinal=null}={},options={}){
 const pack=build(options);
 const card=pack.previewCatalog.cards.find(c=>c.cardId===cardId);
 const event=card?.events.find(e=>e.id==='editorial_candidate_'+cardId+
  '_random_'+sourceOrdinal);
 if(!event||!(sourceOrdinal===4||sourceOrdinal===5)||
  choiceOrdinal!==null&&(!Number.isInteger(choiceOrdinal)||
   choiceOrdinal<1||choiceOrdinal>2))fail('対象外カード・位置・選択');
 const state=choiceOrdinal===null?{}:{[event.id]:'option'+choiceOrdinal};
 const routes=core.directRoutes({id:cardId,hints:[],events:[event]},
  {stage:4,choices:state,outcomes:{}})
  .filter(x=>x.source==='event').map(x=>({...x,
   editorialPreviewOnly:true,publicationApproved:false}));
 return {cardId,sourceOrdinal,selectedChoice:choiceOrdinal,
  routes,unpublished:true};
}
module.exports={build,replay,SOURCE_HINTS,PRIVATE_BLOCKERS};
