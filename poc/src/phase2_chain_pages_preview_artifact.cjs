'use strict';
/*
 * Explicit stage-by-stage review of the twelve editorially adopted chain
 * STAGES. This is NOT an inferred chain graph or a publication decision.
 * A consumer must require independent user assertion of each stage reached.
 */
const {audit}=require('./phase2_chain_manual_replay.cjs');
const {buildView}=require('./phase2_eight_event_review_view.cjs');
const NAMES=require('../data/curation/phase2_chain_skill_display_names.v1.json');
const HEADINGS=require('../data/curation/phase2_chain_event_headings.v1.json');
const SATONO=require('../data/curation/adjudicated/30221_chain.v1.json');
const {audit:audit30221}=require('./phase2_30221_missing_chain_intake.cjs');
const fail=s=>{throw Error('Phase2連続12段階のPages試用: '+s);};
function build(){
 const source=audit(), regular=buildView();
 const satono=audit30221(SATONO);
 if(satono.summary.editoriallyAdoptedChainStages!==3||
    satono.summary.numericSkillHintFacts!==1||
    satono.summary.verifiedContinuationEdges!==0||
    satono.summary.publicEvents!==0||
    SATONO.cardId!=='30221'||SATONO.skillIdentityEvidence.skillName!=='食いしん坊'||
    SATONO.skillIdentityEvidence.skillNumericId!==201351||
    SATONO.chainRouteVerified!==false||
    SATONO.gameWith.url!=='https://gamewith.jp/uma-musume/article/show/461418')
  fail('KFCサトノダイヤモンドの独立数値採用と非公開ゲートが不一致');
 if(NAMES.schemaVersion!==1||
    NAMES.dataKind!=='phase2-chain-preview-verified-skill-names'||
    NAMES.source?.repository!=='mee1080/umasim'||
    NAMES.source?.revision!=='cf9366f6a487bd8f197b53d8a11981207beb9f6c'||
    NAMES.source?.path!=='data/skill_data.txt'||
    NAMES.publicCatalogApproved!==false||
    !Array.isArray(NAMES.records)||NAMES.records.length!==8)
  fail('数値スキルID→日本語スキル名の固定照合根拠が不正');
 const verifiedNames=new Map();
 for(const item of NAMES.records){
  if(!/^\d{6}$/.test(item.numericId)||typeof item.name!=='string'||
     !item.name.trim()||item.name.includes('スキルID')||
     verifiedNames.has(item.numericId))
   fail('内部スキルIDに対する一意の日本語名がありません');
  verifiedNames.set(item.numericId,item.name);
 }
 const referencedNames=new Set();
 if(HEADINGS.schemaVersion!==1||
    HEADINGS.dataKind!=='phase2-chain-stage-headings-from-card-scoped-GameWith'||
    HEADINGS.sourceNarrativeOrChoiceProseIncluded!==false||
    HEADINGS.publicationApproved!==false||
    !Array.isArray(HEADINGS.cards)||HEADINGS.cards.length!==5)
  fail('連続イベントの正式短見出し出典が不正');
 const headings=new Map();
 for(const row of HEADINGS.cards){
  if(headings.has(row.cardId)||!['30318','30319','30320','30321','30221'].includes(row.cardId)||
     !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(row.gameWithArticle)||
     !Array.isArray(row.titles)||row.titles.length!==3||
     row.titles.some(x=>typeof x!=='string'||!x.trim()||x.length>80))
   fail('連続イベントの出典URLと12正式見出しが不正');
  headings.set(row.cardId,row);
 }
 if(source.summary.sourceCards!==4||source.summary.chainStages!==12||
    source.summary.reportedChainAlternatives!==19||
    source.summary.unresolvedPossibleTransitions!==15||
    source.summary.establishedTransitions!==0||
    source.summary.numericChainSkillHintFacts!==8||
    source.summary.publicEvents!==0||
    source.summary.chainDependenciesVerified!==false||
    source.summary.publicationApproved!==false||
    regular.summary.events!==8||regular.summary.hintMentions!==4||
    regular.summary.approvedEvents!==0)
  fail('固定4SSR連続段階・通常デモの数値母集団が変更されました');
 let stages=0,alternatives=0,hints=0,pendingEdges=0;
 const cards=regular.cards.map(meta=>{
  const card=source.cards.get(meta.cardId);
  const titles=headings.get(meta.cardId);
  if(!card||card.events.length!==5||!titles||
     titles.gameWithArticle!==card.gameWith.url||
     !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(card.gameWith.url))
   fail('出典記事または4SSRのイベント対応が不正');
  const events=card.events.slice(0,3).map((e,i)=>{
   if(e.ordinal!==i+1||e.section!=='CHAIN'||
      e.chainPrerequisitesVerified!==false||
      ![0,2].includes(e.choiceCount)||e.alternatives.length!==(e.choiceCount||1))
    fail('前段の関係とゲーム側の選択肢数が確認されていない');
   stages++;
   if(i<2){
    const edges=source.transitions.filter(x=>x.cardId===meta.cardId&&
     x.stageOrdinal===e.ordinal);
    if(edges.length!==e.alternatives.length||
       edges.some(x=>x.continuationStatus!=='NOT_ESTABLISHED_BY_SOURCE'||
        x.terminationStatus!=='NOT_ESTABLISHED_BY_SOURCE'||
        x.nextStageOrdinal!==i+2))
     fail('不明な連続イベント遷移を自動確定できません');
    pendingEdges+=edges.length;
   }
   return {
    id:'usl:'+meta.cardId+':chain:'+e.ordinal,
    title:titles.titles[i],
    ordinal:e.ordinal,choiceCount:e.choiceCount,
    manualReachedRequired:true,priorStageDependenceVerified:false,
    nextStageTransitionStatus:i<2?'UNKNOWN':'NOT_MODELED',
    sourceUrl:card.gameWith.url,
    alternatives:e.alternatives.map((alt,j)=>{
     if(alt.ordinal!==j+1||!Array.isArray(alt.effects)||
        !Array.isArray(alt.skillHints))fail('固定結果行の構造が不正');
     alternatives++;hints+=alt.skillHints.length;
     return {
      id:'option'+(j+1),
      effects:alt.effects.map(effect=>{
       if(typeof effect.kind!=='string'||!Number.isSafeInteger(effect.value))
        fail('数値効果の不一致');
       return [effect.kind,effect.value];
      }),
      hints:alt.skillHints.map(h=>{
       if(!Number.isSafeInteger(h.skillNumericId)||h.skillNumericId<=0||
          !Number.isSafeInteger(h.hintLevel)||h.hintLevel<1||
          h.verifiedSkillName!==undefined&&
          (typeof h.verifiedSkillName!=='string'||!h.verifiedSkillName))
        fail('採用済み数値ヒントのID/Lv/名称が不正');
       // The identifier is an internal join key, NOT a user-facing label.
       // Every display name was checked against an exact pinned registry.
       const numericId=String(h.skillNumericId),name=verifiedNames.get(numericId);
       if(!name||h.verifiedSkillName!==undefined&&h.verifiedSkillName!==name)
        fail('内部IDと日本語スキル名の対応不一致: '+numericId);
       referencedNames.add(numericId);
       return ['skill:'+numericId,h.hintLevel,name];
      })
     };
    })
   };
  });
  return {cardId:meta.cardId,name:meta.displayName,events};
 });
 // A fifth card is an independently adjudicated GT-missing CHAIN,
 // not a claimed continuation from its fixed GT random events.
 const satonoTitles=headings.get('30221');
 if(!satonoTitles||satonoTitles.gameWithArticle!==SATONO.gameWith.url||
    !Array.isArray(SATONO.events)||SATONO.events.length!==3)
  fail('30221個別記事・連続3段階の対応が不正');
 const satonoEvents=SATONO.events.map((e,i)=>{
  if(e.checkerOrdinal!==i+1||e.chainStageOrdinal!==i+1||
     e.playerSelectableChoices!==0||
     !Array.isArray(e.numericEffects)||!Array.isArray(e.skillHints)||
     e.continuationDecision!==(i<2?'NOT_ESTABLISHED_BY_SOURCE':
      'FINAL_REPORTED_STAGE_NO_NEXT_STAGE'))
   fail('30221の先行・後続条件と数値が出典と不一致');
  stages++;alternatives++;
  if(i<2)pendingEdges++;
  hints+=e.skillHints.length;
  return {
   id:'usl:30221:chain:'+(i+1),title:satonoTitles.titles[i],
   ordinal:i+1,choiceCount:0,
   manualReachedRequired:true,priorStageDependenceVerified:false,
   nextStageTransitionStatus:i<2?'UNKNOWN':'NOT_MODELED',
   sourceUrl:SATONO.gameWith.url,
   alternatives:[{
    id:'option1',
    effects:e.numericEffects.map(effect=>{
     if(typeof effect.kind!=='string'||!Number.isSafeInteger(effect.value))
      fail('30221ステータス数値の不一致');
     return [effect.kind,effect.value];
    }),
    hints:e.skillHints.map(h=>{
     if(h.skillNumericId!==201351||h.hintLevel!==1||
        SATONO.skillIdentityEvidence.skillName!=='食いしん坊')
      fail('30221の食いしん坊ID/ヒントLvの不一致');
     return ['skill:201351',1,'食いしん坊'];
    })
   }]
  };
 });
 cards.push({cardId:'30221',name:'サトノダイヤモンド',events:satonoEvents});
 if(headings.size!==cards.length||
    [...headings.keys()].some(id=>!cards.some(c=>c.cardId===id)))
  fail('短い正式見出しのカードと出典位置が全件一致しない');
 if(referencedNames.size!==verifiedNames.size||
    [...verifiedNames.keys()].some(id=>!referencedNames.has(id)))
  fail('8種類の出典照合済みスキル名に欠損または余剰があります');
 if(stages!==15||alternatives!==22||hints!==9||pendingEdges!==17)
  fail('12段階・19報酬行・8スキルヒント・15未確証遷移が不一致');
 return {
  schemaVersion:1,dataKind:'phase2-twelve-manual-chain-stage-browser-review',
  previewOnly:true,formallyApproved:false,gameplayReproductionClaimed:false,
  sourceNarrativeOrChoiceProseIncluded:false,
  inferredChainTransitions:0,unresolvedPossibleTransitions:17,
  explicitStageAssertionRequired:true,
  cards
 };
}
module.exports={build};
