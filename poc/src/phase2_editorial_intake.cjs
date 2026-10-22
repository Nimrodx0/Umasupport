'use strict';
/*
 * Editorial adoption is NOT publication approval. This module deliberately
 * projects ONLY standalone random events. Unverified upstream chain
 * termination/result dependencies make all three chain stages ineligible.
 * No third-party event or choice prose is stored or emitted.
 */
const {evaluateException}=require('./event_exception_adjudication.cjs');
const {REVIEW}=require('./phase2_four_ssr_editorial_review.cjs');
const schema=require('./event_schema.js');
const fail=s=>{throw Error('30321編集採用データ: '+s);};
const allowedEffects=new Set(['speed','stamina','power','guts','wisdom',
 'bond','energy','mood','skill_points']);
const expectedHints={1:[],2:[],3:[[201463,1]],4:[],5:[[202602,1]]};
const expectedChoiceCounts=[2,0,0,2,2];
const expectedEffects=[
 [[['power',15],['bond',5]],[['energy',15],['bond',5]]],
 [[['mood',1],['power',10],['bond',5]]],
 [[['power',15],['bond',5]]],
 [[['speed',10],['guts',10],['bond',5]],[['energy',25],['bond',5]]],
 [[['stamina',15],['bond',5]],[['bond',5]]]
];
const expectedSkillNames={201463:'月影円刃',202602:'イグニッション'};
const expectedSource='6e38b54af4fad397ff4491e63007a90705a4fe67';
const expectedAdjudicated=REVIEW.find(c=>c.cardId==='30321');
function build(input,{model=null}={}){
 if(!input||input.schemaVersion!==1||
    input.dataKind!=='gamewith-adjudicated-numeric-event-intake'||
    input.cardId!=='30321'||input.baseline!=='MISSING'||
    input.baselineRevision!==expectedSource||
    input.currentGameplayVerified!==false||input.publicationApproved!==false||
    input.noAutomaticRuntimeAdoption!==true||
    input.sourceProseIncluded!==false||
    !Array.isArray(input.events)||input.events.length!==5)
  fail('固定版・カード・非公開状態が不正');
 if(input.gameToraWebsite?.url!==expectedAdjudicated.references.gameTora||
    input.gameWith?.url!==expectedAdjudicated.references.gameWith)
  fail('監査済みの対象カード記事と一致しない');
 const policyDecisions=[],events=[],ids=new Set();
 let hintMentions=0;
 for(const [i,e] of input.events.entries()){
  const ordinal=i+1,section=ordinal<=3?'CHAIN':'RANDOM';
  if(e?.ordinal!==ordinal||e.section!==section||
     e.choiceCount!==expectedChoiceCounts[i]||
     (section==='CHAIN'?
      e.chainPrerequisitesVerified!==false:
      e.chainPrerequisitesVerified!==undefined)||
     !Array.isArray(e.alternatives)||
     e.alternatives.length!==(e.choiceCount||1))
   fail('イベント段階・選択肢・連続未確証の扱いが不正: '+ordinal);
  const allHints=[],allEffects=[];
  for(const [j,a] of e.alternatives.entries()){
   if(a?.ordinal!==j+1||!Array.isArray(a.effects)||
      !Array.isArray(a.skillHints))
    fail('報酬行の選択肢位置が不正: '+ordinal);
   for(const ef of a.effects){
    if(!allowedEffects.has(ef?.kind)||!Number.isInteger(ef.value)||
       Math.abs(ef.value)>1000)
     fail('掲載された数値効果が不正: '+ordinal);
    allEffects.push({kind:ef.kind,value:ef.value});
   }
   for(const h of a.skillHints){
    if(!Number.isSafeInteger(h?.skillNumericId)||h.skillNumericId<1||
       !Number.isInteger(h.hintLevel)||h.hintLevel<1||
       typeof h.verifiedSkillName!=='string'||!h.verifiedSkillName.trim())
     fail('数値スキルと確認名が不正: '+ordinal);
    if(expectedSkillNames[h.skillNumericId]!==h.verifiedSkillName)
     fail('数値IDとスキル名の照合済み組が変化: '+ordinal);
    allHints.push([h.skillNumericId,h.hintLevel]);
    hintMentions++;
   }
  }
  if(JSON.stringify(e.alternatives.map(a=>a.effects.map(x=>[x.kind,x.value])))!==
     JSON.stringify(expectedEffects[i]))
   fail('GameWith採用済みの能力・絆数値が変化: '+ordinal);
  if(JSON.stringify(allHints)!==JSON.stringify(expectedHints[ordinal]))
   fail('照合済みスキルのID・Lv・イベント位置が変化: '+ordinal);
  const decision=evaluateException({
   cardId:'30321',sourceEventOrdinal:ordinal,baseline:'MISSING',
   gtWebsite:input.gameToraWebsite,
   gameWith:{...input.gameWith,factStatus:'EXPLICIT',facts:{
    playerSelectableChoiceCount:e.choiceCount,
    reportedEffects:allEffects,
    reportedSkillHints:allHints.map(([skillNumericId,hintLevel])=>({
     skillNumericId,hintLevel}))
   }},
   proposedDecision:'ADOPT'
  });
  if(!decision.editorialDecisionComplete||decision.publicationApproved!==false||
     decision.noAutomaticRuntimeAdoption!==true)fail('出典契約の状態を不正に昇格');
  policyDecisions.push(decision);
  // The generic event graph has no representation for "missing prior
  // chain topology" which would remain fail-closed. Do not insert any
  // chained event as an auto-reachable event with guessed prerequisites.
  if(section==='CHAIN')continue;
  const id='editorial_candidate_30321_random_'+ordinal;
  if(ids.has(id))fail('イベントIDの重複');
  ids.add(id);
  events.push({id,name:'通常イベント候補'+ordinal,type:'choice',
   choices:e.alternatives.map(a=>({
    id:'option'+a.ordinal,label:'選択肢'+a.ordinal,
    rewards:a.skillHints.map(h=>({
     skillId:'skill:'+h.skillNumericId,
     verifiedSkillName:h.verifiedSkillName,
     level:h.hintLevel
    }))
   }))});
 }
 if(hintMentions!==2||events.length!==2||policyDecisions.length!==5)
  fail('5イベント・2ヒント・通常2件の採用母数に矛盾');
 for(const reference of expectedAdjudicated.gameWithAdjudications){
  const fromInput=input.events[reference.checkerOrdinal-1];
  if(fromInput.choiceCount!==reference.playerChoiceCountReported||
     JSON.stringify(fromInput.alternatives[0].effects.map(e=>[e.kind,e.value]))!==
       JSON.stringify(reference.reportedRewardFacts)||
     JSON.stringify(fromInput.alternatives[0].skillHints.map(h=>
       [h.skillNumericId,h.hintLevel]))!==
       JSON.stringify(reference.reportedHintFacts))
   fail('先行PR #164のGameWith採用値と相違');
 }
 const provisionalCatalog={schemaVersion:1,cards:[{
  cardId:'30321',coverageStatus:'partial',events
 }]};
 if(model)schema.validateCatalog(provisionalCatalog,model);
 return {
  // Draft-only: no call here can mutate poc/data/reviewed_events.v1.json.
  provisionalCatalog,
  summary:{sourceCards:1,editoriallyAdoptedEvents:5,
   provisionalStandaloneEvents:2,blockedChainEvents:3,
   numericSkillHintMentions:2,
   editorialAdjudicationComplete:true,game2026Verified:false,
   chainDependenciesVerified:false,publicationApproved:false,
   noAutomaticRuntimeAdoption:true,sourceProseIncluded:false},
  policyDecisions
 };
}
module.exports={build};
