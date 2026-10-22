'use strict';
/* Fifteen card-scoped GameWith editorial numerical facts. Never auto-release.
 * Fixed GT snapshot has no source JSON for these three SSR cards.
 * FROZEN is an independent, code-reviewed numeric expectation: mutations
 * to the JSON intake are rejected even if the central ledger follows them.
 */
const {REVIEW}=require('./phase2_four_ssr_editorial_review.cjs');
const {evaluateException}=require('./event_exception_adjudication.cjs');
const FROZEN=[["30318",[[[[["mood",1],["guts",10],["bond",5]],[]],[[["energy",10],["guts",5],["bond",5]],[]]],[[[["guts",15],["bond",5]],[]],[[["skill_points",15],["bond",5]],[]]],[[[["guts",15],["bond",5]],[[201323,1]]]],[[[["mood",2],["bond",5]],[]],[[["stamina",10],["bond",5]],[]]],[[[["speed",5],["guts",5],["bond",5]],[]],[[["bond",5]],[[200152,1]]]]]],["30319",[[[[["energy",10],["mood",1],["speed",5],["wisdom",5],["bond",10]],[]],[[["energy",5],["skill_points",20],["bond",10]],[]]],[[[["mood",1],["speed",5],["wisdom",5],["bond",5]],[[204412,1]]],[[["mood",1],["skill_points",25],["bond",5]],[]]],[[[["speed",10],["wisdom",15],["bond",5]],[[202371,1],[204151,2]]]],[[[["mood",1],["speed",5],["bond",5]],[]],[[["max_energy",4],["bond",5]],[]]],[[[["speed",3],["stamina",3],["power",3],["bond",5]],[]],[[["bond",5]],[[201641,1]]]]]],["30320",[[[[["energy",15],["wisdom",10],["bond",10]],[]],[[["energy",10],["mood",1],["skill_points",10],["bond",10]],[]]],[[[["wisdom",15],["bond",5]],[[201651,1]]],[[["stamina",10],["wisdom",20],["bond",5]],[]]],[[[["mood",1],["wisdom",20],["bond",5]],[[203801,2],[204721,1]]]],[[[["mood",1],["wisdom",25],["bond",5]],[]],[[["power",15],["guts",15],["bond",5]],[]]],[[[["bond",5]],[[202082,1]]],[[["energy",10],["skill_points",20],["bond",5]],[]]]]]];
const fail=s=>{throw Error('残り3SSR数値編集採用: '+s);};
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exact=(o,k,s)=>{if(!o||typeof o!=='object'||Array.isArray(o)||
 !eq(Object.keys(o).sort(),[...k].sort()))fail(s+': フィールド過不足');};
const baseline='6e38b54af4fad397ff4491e63007a90705a4fe67';
function build(doc){
 exact(doc,['schemaVersion','dataKind','baseline','baselineRevision',
  'checkedAt','sourceProseIncluded','currentGameplayVerified',
  'publicationApproved','noAutomaticRuntimeAdoption','cards'],'root');
 if(doc.schemaVersion!==1||doc.dataKind!=='gamewith-adjudicated-numeric-event-intake'||
  doc.baseline!=='MISSING'||doc.baselineRevision!==baseline||
  doc.checkedAt!=='2026-10-22'||doc.sourceProseIncluded!==false||
  doc.currentGameplayVerified!==false||doc.publicationApproved!==false||
  doc.noAutomaticRuntimeAdoption!==true||!Array.isArray(doc.cards)||
  doc.cards.length!==3)fail('未承認固定ソースの境界が変化');
 const ledgerCards=[],draftCards=[],policyDecisions=[];
 let hints=0,effects=0,alternatives=0;
 for(let i=0;i<3;i++){
  const [cardId,expectedEvents]=FROZEN[i],card=doc.cards[i];
  const ref=REVIEW.find(r=>r.cardId===cardId);
  exact(card,['cardId','gameToraWebsite','gameWith','events',
   ...(cardId==='30319'?['choicePresentationClarification']:[])],cardId);
  exact(card.gameToraWebsite,['url','checkedAt','status'],cardId+'/GT');
  exact(card.gameWith,['url','checkedAt'],cardId+'/GW');
  if(card.cardId!==cardId||!ref||
   card.gameToraWebsite.url!==ref.references.gameTora||
   card.gameToraWebsite.checkedAt!=='2026-10-22'||
   card.gameToraWebsite.status!==(cardId==='30320'?'CARD_ONLY':'EVENT_LIST')||
   card.gameWith.url!==ref.references.gameWith||
   card.gameWith.checkedAt!=='2026-10-22'||
   !Array.isArray(card.events)||card.events.length!==5)
   fail(cardId+': カード・記事または固定元範囲が不正');
  if(cardId==='30319'&&!eq(card.choicePresentationClarification,{
   sourceOrdinal:5,cardPageLabelsFirstRowNoChoice:true,
   eventSpecificArticleConfirmsTwoPlayerChoices:true,
   eventSpecificGameWithArticle:'https://gamewith.jp/uma-musume/article/show/289111'
  }))fail('30319/5: 単独GameWithイベント記事による表示矛盾の解消記録が不正');
  const eventLedger=[],draftEvents=[],allHints=[];
  for(let j=0;j<5;j++){
   const source=card.events[j],expected=expectedEvents[j],ord=j+1;
   const chain=j<3,choiceCount=expected.length===1?0:2;
   exact(source,['ordinal','section','choiceCount','alternatives',
    ...(chain?['chainPrerequisitesVerified']:[])],cardId+'/'+ord);
   if(source.ordinal!==ord||source.section!==(chain?'CHAIN':'RANDOM')||
    source.choiceCount!==choiceCount||
    (chain&&source.chainPrerequisitesVerified!==false)||
    !Array.isArray(source.alternatives)||source.alternatives.length!==expected.length)
    fail(cardId+'/'+ord+': 選択肢数と未確認の連続関係が不正');
   for(let k=0;k<expected.length;k++){
    const alt=source.alternatives[k],[xEffects,xHints]=expected[k];
    exact(alt,['ordinal','effects','skillHints'],cardId+'/'+ord+'/'+(k+1));
    if(alt.ordinal!==k+1||
     !eq(alt.effects,xEffects.map(([kind,value])=>({kind,value})))||
     !eq(alt.skillHints,xHints.map(([skillNumericId,hintLevel])=>({skillNumericId,hintLevel}))))
     fail(cardId+'/'+ord+'/'+(k+1)+': GameWith固定報酬・技能ヒント不一致');
    for(const [id,lv] of xHints)allHints.push([ord,k+1,id,lv]);
    hints+=xHints.length;effects+=xEffects.length;
   }
   const allEffects=source.alternatives.flatMap(a=>a.effects);
   const allSkillHints=source.alternatives.flatMap(a=>a.skillHints);
   const decision=evaluateException({cardId,sourceEventOrdinal:ord,
    baseline:'MISSING',gtWebsite:card.gameToraWebsite,
    gameWith:{...card.gameWith,factStatus:'EXPLICIT',facts:{
     playerSelectableChoiceCount:choiceCount,
     reportedEffects:allEffects,reportedSkillHints:allSkillHints
    }},proposedDecision:'ADOPT'});
   if(!decision.editorialDecisionComplete||decision.publicationApproved!==false||
      decision.noAutomaticRuntimeAdoption!==true)fail('公開へ不正昇格');
   policyDecisions.push(decision);
   const common={sourceOrdinal:ord,gameToraLivePage:card.gameToraWebsite.url,
    gameWithArticle:card.gameWith.url,checkedAt:'2026-10-22',
    priorStageDependenceVerified:false,game2026Verified:false,publicationApproved:false};
   eventLedger.push(choiceCount?{
    sourceOrdinal:ord,decision:'GAMEWITH_CHOICE_FACTS_ADOPTED',
    playerSelectableChoiceCount:choiceCount,reportedSingleResultPerChoice:true,
    alternatives:source.alternatives,...Object.fromEntries(
     Object.entries(common).filter(([key])=>key!=='sourceOrdinal'))
   }:{
    sourceOrdinal:ord,decision:'GAMEWITH_NUMERIC_FACTS_ADOPTED',
    playerSelectableChoiceCount:0,reportedSingleResult:true,
    numericEffects:source.alternatives[0].effects,
    skillHints:source.alternatives[0].skillHints,
    ...Object.fromEntries(Object.entries(common).filter(([key])=>key!=='sourceOrdinal'))
   });
   alternatives+=source.alternatives.length;
   // Draft projection is never used by public loader and never infers chain reachability.
   if(!chain)draftEvents.push({id:'editorial_candidate_'+cardId+'_random_'+ord,
    name:'通常イベント候補'+ord,type:'choice',
    choices:source.alternatives.map(a=>({id:'option'+a.ordinal,
     label:'選択肢'+a.ordinal,rewards:a.skillHints.map(h=>({
      skillId:'skill:'+h.skillNumericId,level:h.hintLevel
     }))}))});
  }
  if(!eq(allHints,ref.hints))fail(cardId+': Checker元位置と数値ヒントID/Lvが不一致');
  ledgerCards.push({cardId,events:eventLedger});
  draftCards.push({cardId,coverageStatus:'partial',events:draftEvents});
 }
 if(hints!==10||alternatives!==27||policyDecisions.length!==15||
  draftCards.some(c=>c.events.length!==2))fail('母集団15／ヒント10／行27が不一致');
 return {ledgerCards,provisionalCatalog:{schemaVersion:1,cards:draftCards},
  summary:{sourceCards:3,editoriallyAdoptedEvents:15,
   adoptedNumericEffectFacts:effects,numericSkillHintMentions:hints,
   adoptedEffectAlternatives:alternatives,provisionalStandaloneEvents:6,
   blockedChainEvents:9,chainDependenciesVerified:false,
   game2026Verified:false,publicationApproved:false,
   noAutomaticRuntimeAdoption:true,sourceProseIncluded:false},
  policyDecisions};
}
module.exports={build};
