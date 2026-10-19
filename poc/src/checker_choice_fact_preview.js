/*
 * Opt-in, source-fact candidate preview; no copied third-party event dialogue.
 * A reward always carries an explicit "unknown outcome" condition and is NEVER
 * described as unconditional/guaranteed. Not the reviewed production DB.
 */
(function(g){
'use strict';
const BRIDGE=typeof module!=='undefined'&&module.exports
 ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='./data/candidates/checker_choice_results.v1.json';
const CARD=/^\d{5}$/, SKILL=/^\d+$/;
const PIN='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const EXPLICIT_CONDITION='候補資料でヒント記載・獲得結果未区分';
function fail(s){throw Error('全カード候補の読み込み: '+s);}
function fromSource(source,model,skillText){
 if(!source||source.schemaVersion!==1||source.dataKind!=='umasupport-choice-result-facts'||
  source.reviewStatus!=='SOURCE_FACTS_WITH_UNSPECIFIED_OUTCOMES'||
  source.productionApproval!==false||source.sourcePins?.checkerRevision!==PIN||
  source.stats?.cards!==417||source.stats?.events!==2109||
  source.stats?.choicePositions!==3458||source.stats?.hintMentionsNumeric!==1406||
  source.stats?.hintMentionsUnresolved!==98||
  source.stats?.eventsReadyForChoiceCandidate!==879||
  !Array.isArray(source.cards)||source.cards.length!==417)
  fail('独自数値候補DBの版・全件数が一致しません');
 if(!model?.cardById||!model?.skillById)fail('カード辞書を取得していません');
 const skillRegistry=BRIDGE.parseSource(skillText), cards=[], seen=new Set();
 const omitted={noObservedHint:0,needsFurtherParsing:0,skillNotInCurrentRegistry:0};
 let included=0,choicePositions=0,matchedHints=0;
 for(const card of source.cards){
  if(!card||!CARD.test(card.cardId)||seen.has(card.cardId)||
     !Array.isArray(card.events)||!model.cardById[card.cardId])
   fail('カードのID・モデル照合に失敗しました');
  seen.add(card.cardId);
  const events=[];
  for(const event of card.events){
   if(!event||!Array.isArray(event.choices)||!event.choices.length||
     !/^checker:\d{5}:[0-9a-f]{20}$/.test(event.sourceKey)||!event.sourceKey.startsWith('checker:'+card.cardId+':')||
     !/^sha256:[0-9a-f]{64}$/.test(event.sourceDigest)||
     !Number.isSafeInteger(event.sourceEventOrdinal))
    fail('イベントの出典キーまたは候補位置が不正');
   if(event.candidateStatus==='no-observed-skill-hints'){omitted.noObservedHint++;continue;}
   if(event.candidateStatus==='needs-choice-or-result-review'){omitted.needsFurtherParsing++;continue;}
   if(event.candidateStatus!=='numeric-choice-candidate')fail('未定義の候補状態');
   let eventMissing=false,eventHints=0;
   const choices=event.choices.map((choice,i)=>{
    if(!choice||choice.ordinal!==i+1||choice.sourcePositionOnly!==true||
       !Array.isArray(choice.resultCandidates)||choice.resultCandidates.length!==1||
       choice.needsResultOrSyntaxReview!==false||choice.unparsedHintSyntax!==false)
      fail('未区分結果または選択肢が不正');
    const result=choice.resultCandidates[0];
    if(result.resultKind!=='unspecified'||result.outcomeCoverage!=='unknown'||
       !Array.isArray(result.skillHints)||!Array.isArray(result.unresolvedSkillHints)||
       result.unresolvedSkillHints.length)fail('承認されていない結果依存候補');
    const rewards=[];
    for(const hint of result.skillHints){
     if(!hint||!SKILL.test(hint.skillId)||!Number.isSafeInteger(hint.level)||
       hint.level<1||hint.level>10)fail('ヒント数値レコードが不正');
     const record=skillRegistry.byId.get(hint.skillId);
     if(!record||!['normal','rare'].includes(record.rarity)){eventMissing=true;continue;}
     rewards.push({skillId:'skill:'+hint.skillId,verifiedSkillName:record.name,
      level:hint.level,condition:EXPLICIT_CONDITION});
     eventHints++;
    }
    return {id:'option'+choice.ordinal,label:'候補位置 '+choice.ordinal,rewards};
   });
   if(eventMissing){omitted.skillNotInCurrentRegistry++;continue;}
   if(!eventHints)fail('候補なのに数値スキルがありません');
   matchedHints+=eventHints;included++;choicePositions+=choices.length;
   events.push({id:'fact:'+event.sourceKey,name:'イベント候補 '+event.sourceEventOrdinal,
    type:'choice',choices});
  }
  if(events.length)cards.push({cardId:card.cardId,coverageStatus:'partial',events});
 }
 if(included+omitted.noObservedHint+omitted.needsFurtherParsing+
    omitted.skillNotInCurrentRegistry!==2109)
  fail('全候補イベントを分類しきれません');
 if(included>879)fail('未承認イベント候補の範囲を超過');
 return {catalog:{schemaVersion:1,cards},summary:{cards:cards.length,
  events:included,choicePositions,matchedHints,omitted},
  condition:EXPLICIT_CONDITION};
}
async function load({fetchImpl=g.fetch?.bind(g)}={}){
 if(!fetchImpl)fail('候補DBの取得に必要なFetch APIがありません');
 const res=await fetchImpl(URL,{cache:'no-store'});
 if(!res.ok)fail('候補DBを取得できません HTTP '+res.status);
 return res.json();
}
const api={URL,PIN,EXPLICIT_CONDITION,fromSource,load};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCheckerChoiceFactPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
