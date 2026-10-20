/*
 * Phase 2 opt-in preview of explicitly labeled candidate outcomes.
 * Source-only evidence: no inferred chain continuation, game probabilities,
 * guaranteed skill grants or republished third-party event text.
 */
(function(g){
'use strict';
const BRIDGE=typeof module!=='undefined'&&module.exports
 ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='./data/candidates/checker_explicit_result_facts.v1.json';
const PIN='8cf9fcb3cc7239041161be75c84daf9f8f22d29f';
const CONDITION='資料の結果別ヒント候補・ゲーム内獲得未確認';
const UNKNOWN_CONDITION='資料のヒント候補・獲得結果未区分';
const LABELS=Object.freeze({great:'大成功',success:'成功',failure:'失敗',normal:'通常'});
const ID=/^\d{5}$/, NUM=/^\d+$/, KEY=/^checker:\d{5}:[0-9a-f]{20}$/, DIGEST=/^sha256:[0-9a-f]{64}$/;
const fail=s=>{throw Error('結果別候補の読込: '+s);};
function fromSource(source,model,skillText){
 if(source?.schemaVersion!==1||source.dataKind!=='umasupport-explicit-result-facts'||
   source.approval!=='UNREVIEWED_NOT_FOR_PUBLICATION'||source.forSkillGrant!==false||
   source.sourcePins?.checkerRevision!==PIN||!Array.isArray(source.cards)||
   source.cards.length!==417||source.stats?.cards!==417||
   source.stats?.events!==2109||source.stats?.choicePositions!==3458||
   source.stats?.explicitOutcomeChoices!==203||source.stats?.explicitOutcomeResults!==411||
   source.stats?.explicitOutcomeEvents!==179||source.stats?.numericHintMentions!==1406||
   source.stats?.unresolvedHintMentions!==98||source.stats?.observedTerminations!==89||
   !/^[0-9a-f]{64}$/.test(source.sourcePins?.checkerSha256||'')||
   !/^[0-9a-f]{64}$/.test(source.sourcePins?.candidateCardSha256||''))
  fail('固定ソースの版・件数・未承認状態が不正');
 if(!model?.cardById||!model?.skillById)fail('カード・スキル辞書がありません');
 const registry=BRIDGE.parseSource(skillText),cards=[],seenCards=new Set();
 const omitted={noExplicitOutcome:0,unsafeSemantics:0,unresolvedSkill:0,noNumericHint:0};
 const tally={events:0,choicePositions:0,explicitOutcomeChoices:0,
  explicitOutcomeResults:0,explicitOutcomeEvents:0,numericHintMentions:0,
  unresolvedHintMentions:0,observedTerminations:0};
 let included=0,matchedHints=0,visibleChoices=0,visibleOutcomes=0;
 for(const card of source.cards){
  if(!card||!ID.test(card.cardId)||seenCards.has(card.cardId)||
    !model.cardById[card.cardId]||!Array.isArray(card.events))fail('カードID/重複/イベント配列が不正');
  seenCards.add(card.cardId);
  const events=[],seenEvents=new Set();
  for(const event of card.events){
   tally.events++;
   if(!event||!KEY.test(event.sourceKey)||!event.sourceKey.startsWith('checker:'+card.cardId+':')||
     seenEvents.has(event.sourceKey)||!DIGEST.test(event.sourceDigest)||
     !Number.isSafeInteger(event.sourceEventOrdinal)||event.sourceEventOrdinal<1||
     event.gameEventIdVerified!==false||event.chainRouteVerified!==false||
     !Array.isArray(event.choices)||!event.choices.length)
    fail('イベントの識別・出典・未検証状態が不正');
   seenEvents.add(event.sourceKey);
   let explicit=0,totalNumeric=0,unsafe=false,unresolved=false;
   const choices=[];
   for(let i=0;i<event.choices.length;i++){
    const choice=event.choices[i];
    if(!choice||choice.ordinal!==i+1||choice.routeReviewRequired!==true||
      !['unspecified','explicit-result-headings'].includes(choice.structure)||
      !['unknown','source-labeled-only'].includes(choice.outcomeCoverage)||
      !Array.isArray(choice.results)||!choice.results.length||
      !Array.isArray(choice.diagnostics)||choice.diagnostics.some(x=>typeof x!=='string'))
     fail('選択肢の結果構造・検証フラグが不正');
    const segmented=choice.structure==='explicit-result-headings';
    if(segmented!==(choice.outcomeCoverage==='source-labeled-only')||
      segmented&&choice.results.length<2||
      !segmented&&(choice.results.length!==1||choice.results[0].resultKind!=='unspecified'))
     fail('見出しと結果範囲が矛盾');
    if(segmented){explicit++;tally.explicitOutcomeChoices++;
      tally.explicitOutcomeResults+=choice.results.length;}
    tally.choicePositions++;
    // Even exact source stop words are not game-verified chain topology.
    // Exclude these candidates rather than invent a terminal gate.
    if(choice.diagnostics.length||choice.results.some(r=>r.terminalObserved))unsafe=true;
    const seenResults=new Set(),results=[];
    for(const result of choice.results){
     if(!result||!Array.isArray(result.skillHints)||
        typeof result.terminalObserved!=='boolean'||
        !(segmented?Object.hasOwn(LABELS,result.resultKind):result.resultKind==='unspecified')||
        seenResults.has(result.resultKind))
      fail('結果ラベル・ヒント・打切りフラグが不正');
     seenResults.add(result.resultKind);
     if(result.terminalObserved)tally.observedTerminations++;
     const rewards=[];
     for(const hint of result.skillHints){
      if(!hint||typeof hint!=='object')fail('スキルレコードが不正');
      const ranged=hint.levelMin!==undefined||hint.levelMax!==undefined;
      if(ranged){
       if(!Number.isSafeInteger(hint.levelMin)||!Number.isSafeInteger(hint.levelMax)||
          hint.levelMin<1||hint.levelMax<=hint.levelMin)fail('ヒントLv範囲が不正');
       unsafe=true;
      }else if(!Number.isSafeInteger(hint.level)||hint.level<1||hint.level>10)
       fail('ヒントLvが不正');
      if(hint.skillId!==undefined){
       if(!NUM.test(hint.skillId)||hint.unresolvedSkillName!==undefined)fail('数値スキルIDが不正');
       tally.numericHintMentions++;totalNumeric++;
       const record=registry.byId.get(hint.skillId);
       if(!record||!['normal','rare'].includes(record.rarity)){unresolved=true;continue;}
       if(!ranged)rewards.push({skillId:'skill:'+hint.skillId,verifiedSkillName:record.name,
        level:hint.level,condition:segmented?CONDITION:UNKNOWN_CONDITION});
      }else{
       if(typeof hint.unresolvedSkillName!=='string'||!hint.unresolvedSkillName.trim())
        fail('未解決スキルの識別が不正');
       tally.unresolvedHintMentions++;unresolved=true;
      }
     }
     results.push({id:result.resultKind,label:LABELS[result.resultKind],rewards});
    }
    if(segmented){
     choices.push({id:'option'+choice.ordinal,label:'候補位置 '+choice.ordinal,outcomes:results});
    }else{
     choices.push({id:'option'+choice.ordinal,label:'候補位置 '+choice.ordinal,
      rewards:results[0].rewards});
    }
   }
   if(explicit)tally.explicitOutcomeEvents++;
   if(!explicit){omitted.noExplicitOutcome++;continue;}
   if(unsafe){omitted.unsafeSemantics++;continue;}
   if(unresolved){omitted.unresolvedSkill++;continue;}
   if(!totalNumeric){omitted.noNumericHint++;continue;}
   included++;matchedHints+=totalNumeric;visibleChoices+=choices.length;
   visibleOutcomes+=choices.reduce((n,c)=>n+(c.outcomes?.length||0),0);
   events.push({id:'resultfact:'+event.sourceKey,name:'結果別イベント候補 '+event.sourceEventOrdinal,
    type:'choice',choices});
  }
  if(events.length)cards.push({cardId:card.cardId,coverageStatus:'partial',events});
 }
 for(const field of Object.keys(tally)){
  if(tally[field]!==source.stats[field])fail('全件母数が元ファクトと一致しません: '+field);
 }
 if(included+Object.values(omitted).reduce((a,b)=>a+b,0)!==2109||
   included>179||visibleOutcomes<2||matchedHints<1)
  fail('結果別候補の全件分類が不正');
 return {catalog:{schemaVersion:1,cards},
  summary:{cards:cards.length,events:included,choicePositions:visibleChoices,
   outcomeVariants:visibleOutcomes,matchedHints,omitted},
  condition:CONDITION};
}
async function load({fetchImpl=g.fetch?.bind(g)}={}){
 if(!fetchImpl)fail('Fetch APIがありません');
 const response=await fetchImpl(URL,{cache:'no-store'});
 if(!response.ok)fail('取得に失敗 HTTP '+response.status);
 return response.json();
}
const api={URL,PIN,CONDITION,UNKNOWN_CONDITION,fromSource,load};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCheckerResultPreview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
