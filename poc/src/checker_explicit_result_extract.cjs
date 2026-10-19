'use strict';
/*
 * Unreviewed numeric facts from ONE pinned Checker snapshot.
 * Original event/choice/effect prose must never enter output or Git.
 * Explicit headings do not prove exhaustive game outcomes or chain reachability.
 */
const crypto=require('node:crypto');
const {extract:extractBaseline}=require('./checker_hint_fact_extract.cjs');
const {validate:validateCandidates}=require('./checker_candidate_database.cjs');
const {buildModel}=require('./live_loader.js');
const HINT=/[『「]([^』」\n]+)[』」]\s*のヒント\s*Lv\s*[+＋]\s*([0-9]+)/gu;
const HEAD=/^[ \t]*(大成功|成功|失敗|通常)(?:時)?[ \t]*(?:[:：][ \t]*|(?=\r?$))/gm;
const OTHER_CONDITION=/成功|失敗|通常時|確率|ランダム|次回|次のイベント|打ち切り|継続/;
const TERMINAL=/^[ \t]*(?:※[ \t]*)?連続イベントが終了(?:する)?[ \t]*$/m;
const RANGE=/^[ \t]*(?:~|〜|～|-)[ \t]*(\d+)/;
const KIND={大成功:'great',成功:'success',失敗:'failure',通常:'normal'};
const norm=s=>String(s).normalize('NFKC').replace(/[◯〇]/g,'○').replace(/\s+/g,' ').trim();
function fail(s){throw Error('Checker結果構造抽出: '+s);}
function fingerprint(s){return crypto.createHash('sha256').update(s).digest('hex');}
function hintCandidates(effect,observedHints){
 const found=[...effect.matchAll(HINT)];
 if(found.length!==observedHints.length)fail('ヒント候補の出典位置が既存の全件数値DBと不一致');
 return found.map((m,i)=>{
  const original=observedHints[i],level=Number(m[2]);
  if(!original||original.level!==level)fail('出典のヒントLvまたは順序が候補DBと不一致');
  if(original.skillName&&norm(original.skillName)!==norm(m[1]))
   fail('未解決スキル名の一致に失敗');
  const suffix=effect.slice(m.index+m[0].length).match(RANGE);
  const range=suffix?Number(suffix[1]):null;
  if(range!==null&&(!Number.isSafeInteger(range)||range<=level))fail('ヒント範囲の終端が不正');
  const ref=original.skillId?{skillId:original.skillId}:{unresolvedSkillName:original.skillName,resolution:original.resolution};
  return {start:m.index,end:m.index+m[0].length,
   result:{...ref,...(range!==null?{levelMin:level,levelMax:range}:{level})},
   hasRange:range!==null};
 });
}
function parseEffect(effect,original){
 if(typeof effect!=='string'||!original||!Array.isArray(original.observedHints))
  fail('選択肢の元資料が不正');
 const hints=hintCandidates(effect,original.observedHints);
 const headings=[...effect.matchAll(HEAD)].map(m=>({kind:KIND[m[1]],start:m.index,end:m.index+m[0].length,label:m[1]}));
 const codes=[];
 if(hints.some(h=>h.hasRange))codes.push('HINT_LEVEL_RANGE');
 const leftoverCondition=effect.slice(0,headings[0]?.start??effect.length);
 const repeated=headings.some((h,i)=>headings.findIndex(x=>x.kind===h.kind)!==i);
 const good=headings.length>=2&&!repeated&&
  !hints.some(h=>h.start<headings[0].start)&&
  !OTHER_CONDITION.test(leftoverCondition)&&!TERMINAL.test(leftoverCondition);
 if(!good){
  if(headings.length||OTHER_CONDITION.test(effect))
   codes.push(headings.length===1?'SINGLE_RESULT_LABEL':'RESULT_LABELS_UNRESOLVED');
  if(repeated)codes.push('REPEATED_RESULT_LABEL');
  if(headings.length>1&&hints.some(h=>h.start<headings[0].start))
   codes.push('UNLABELED_HINT_BEFORE_RESULTS');
  if(headings.length>1&&OTHER_CONDITION.test(leftoverCondition))
   codes.push('UNLABELED_CONDITIONAL_PREAMBLE');
  const terminal=TERMINAL.test(effect);
  if(terminal)codes.push('CHOICE_TERMINAL_STATEMENT');
  return {structure:'unspecified',outcomeCoverage:'unknown',
   results:[{resultKind:'unspecified',skillHints:hints.map(x=>x.result),
     terminalObserved:terminal}],diagnostics:[...new Set(codes)]};
 }
 const results=headings.map((h,i)=>{
  const end=headings[i+1]?.start??effect.length;
  const content=effect.slice(h.end,end);
  const skillHints=hints.filter(x=>x.start>=h.end&&x.start<end).map(x=>x.result);
  const terminal=TERMINAL.test(content);
  if(terminal)codes.push('OUTCOME_TERMINAL_STATEMENT');
  // Some labels contain contextual qualifiers, e.g. "if stages 1 and 2 succeeded".
  if(/^[ \t]*[（(][^\n)]*(?:連続|選択|成功|失敗|回)[^\n)]*[）)]/m.test(content))
    codes.push('RESULT_REQUIRES_PRIOR_CONTEXT');
  return {resultKind:h.kind,skillHints,terminalObserved:terminal};
 });
 if(results.some(x=>x.skillHints.some(h=>h.levelMin!==undefined)))
  codes.push('HINT_LEVEL_RANGE');
 return {structure:'explicit-result-headings',outcomeCoverage:'source-labeled-only',
  results,diagnostics:[...new Set(codes)]};
}
function generate({checkerText,rosterText,skillText,candidates,aliases}){
 validateCandidates(candidates);
 const pins=candidates.sourcePins;
 for(const [key,text] of [['checker',checkerText],['umasimCards',rosterText],['umasimSkills',skillText]])
  if(fingerprint(text)!==pins[key].sha256)fail('固定版入力のSHA256相違: '+key);
 const checker=JSON.parse(checkerText),model=buildModel(rosterText);
 const base=extractBaseline({source:checker,model,skillText,aliases});
 if(base.cards.length!==candidates.cards.length||base.stats.eventsObserved!==2109||
    base.stats.choiceRowsObserved!==3458)fail('全件ソースの母数相違');
 const baseMap=new Map(base.cards.map(c=>[c.cardId,c]));
 const all={},count={cards:0,events:0,choicePositions:0,
  explicitOutcomeChoices:0,explicitOutcomeResults:0,
  explicitOutcomeEvents:0,observedTerminations:0,
  choiceTerminations:0,outcomeTerminations:0,
  unsegmentedChoices:0,rangedHintChoices:0,
  numericHintMentions:0,unresolvedHintMentions:0};
 const cards=candidates.cards.map(card=>{
  const b=baseMap.get(card.cardId);
  if(!b||b.events.length!==card.events.length)fail('カード単位で候補元の位置照合失敗: '+card.cardId);
  const originalName=Object.keys(checker.Skills[card.rarity]).filter(n=>
   norm(n)===norm(model.cardById[card.cardId].name)).at(0)||
   aliases[card.cardId];
  const raw=checker.Skills[card.rarity][originalName]?.Events;
  if(!Array.isArray(raw)||raw.length!==card.events.length)fail('元イベントリストの照合失敗: '+card.cardId);
  count.cards++;
  const events=card.events.map((e,i)=>{
   const src=b.events[i];
   if(e.sourceKey!==src.sourceKey||e.sourceDigest!==src.sourceDigest||
      e.ordinal!==src.sourceEventOrdinal||e.choices.length!==src.choices.length)
    fail('出典指紋または候補位置が一致しません');
   const rawChoices=Object.values(raw[i])[0];
   if(!Array.isArray(rawChoices)||rawChoices.length!==e.choices.length)fail('選択肢位置不一致');
   let explicit=0;
   const choices=e.choices.map((ch,j)=>{
    const previous=src.choices[j];
    if(ch.ordinal!==previous.ordinal||ch.observedHints.length!==previous.observedHints.length||
       ch.observedHints.some((h,k)=>JSON.stringify([h.skillId,h.skillName,h.resolution,h.level])!==
        JSON.stringify([previous.observedHints[k].skillId,previous.observedHints[k].skillName,previous.observedHints[k].resolution,previous.observedHints[k].level])))
     fail('元数値ヒントの再抽出結果が不一致');
    const res=parseEffect(rawChoices[j].Effect,ch);
    if(res.structure==='explicit-result-headings'){explicit++;count.explicitOutcomeChoices++;count.explicitOutcomeResults+=res.results.length;}
    else count.unsegmentedChoices++;
    if(res.diagnostics.includes('HINT_LEVEL_RANGE'))count.rangedHintChoices++;
    for(const result of res.results){
     if(result.terminalObserved){count.observedTerminations++;
       if(res.structure==='explicit-result-headings')count.outcomeTerminations++;
       else count.choiceTerminations++;}
     for(const hint of result.skillHints){
      if(hint.skillId)count.numericHintMentions++;
      else count.unresolvedHintMentions++;
     }
    }
    count.choicePositions++;
    return {ordinal:ch.ordinal,structure:res.structure,outcomeCoverage:res.outcomeCoverage,
     results:res.results,diagnostics:res.diagnostics,routeReviewRequired:true};
   });
   if(explicit)count.explicitOutcomeEvents++;
   count.events++;
   return {sourceKey:e.sourceKey,sourceDigest:e.sourceDigest,sourceEventOrdinal:e.ordinal,
    gameEventIdVerified:false,chainRouteVerified:false,choices};
  });
  return {cardId:card.cardId,rarity:card.rarity,events};
 });
 if(count.events!==2109||count.choicePositions!==3458||
    count.numericHintMentions!==1406||count.unresolvedHintMentions!==98||
    count.explicitOutcomeChoices+count.unsegmentedChoices!==3458)
  fail('全件報酬・選択位置の保存数が不一致');
 return {schemaVersion:1,dataKind:'umasupport-explicit-result-facts',
  approval:'UNREVIEWED_NOT_FOR_PUBLICATION',forSkillGrant:false,
  sourcePins:{checkerRevision:pins.checker.revision,checkerSha256:pins.checker.sha256,
   candidateCardSha256:pins.umasimCards.sha256},
  stats:count,cards,
  semantics:{resultCoverage:'Only explicit source labels; cannot assume full game branch enumeration',
   terminalObserved:'Only exact source termination phrase, not independently confirmed game behavior',
   routeReviewRequired:true,publicationReviewed:false}};
}
function verifyDerived(candidates,derived){
 validateCandidates(candidates);
 if(derived?.schemaVersion!==1||derived.dataKind!=='umasupport-explicit-result-facts'||
    derived.approval!=='UNREVIEWED_NOT_FOR_PUBLICATION'||derived.forSkillGrant!==false||
    !Array.isArray(derived.cards)||derived.cards.length!==candidates.cards.length||
    derived.sourcePins?.checkerSha256!==candidates.sourcePins.checker.sha256||
    derived.sourcePins?.candidateCardSha256!==candidates.sourcePins.umasimCards.sha256)
   fail('構造化候補の版・非公開状態・元データSHAが不正');
 const counters={cards:0,events:0,choicePositions:0,explicitOutcomeChoices:0,explicitOutcomeResults:0,
  explicitOutcomeEvents:0,observedTerminations:0,choiceTerminations:0,outcomeTerminations:0,
  unsegmentedChoices:0,rangedHintChoices:0,numericHintMentions:0,unresolvedHintMentions:0};
 for(let i=0;i<candidates.cards.length;i++){
  const original=candidates.cards[i],card=derived.cards[i];
  if(card.cardId!==original.cardId||card.rarity!==original.rarity||
     card.events.length!==original.events.length)fail('カードの対応が不正');
  counters.cards++;
  for(let j=0;j<original.events.length;j++){
   const e=original.events[j],d=card.events[j];
   if(d.sourceKey!==e.sourceKey||d.sourceDigest!==e.sourceDigest||
      d.sourceEventOrdinal!==e.ordinal||d.gameEventIdVerified!==false||
      d.chainRouteVerified!==false||d.choices.length!==e.choices.length)
    fail('イベントの位置・未承認状態が不一致');
   counters.events++;
   let explicit=0;
   for(let k=0;k<e.choices.length;k++){
    const c=e.choices[k],x=d.choices[k];
    if(x.ordinal!==c.ordinal||x.routeReviewRequired!==true||
       !Array.isArray(x.results)||!x.results.length||!Array.isArray(x.diagnostics)||
       !['unspecified','explicit-result-headings'].includes(x.structure)||
       x.outcomeCoverage!==(x.structure==='unspecified'?'unknown':'source-labeled-only'))
      fail('選択肢の結果構造が不正');
    counters.choicePositions++;
    if(x.structure==='explicit-result-headings'){
      if(x.results.length<2||new Set(x.results.map(r=>r.resultKind)).size!==x.results.length||
         x.results.some(r=>!['great','success','failure','normal'].includes(r.resultKind)))
       fail('明示結果ラベルが重複・不正');
      counters.explicitOutcomeChoices++;counters.explicitOutcomeResults+=x.results.length;explicit++;
    }else{
      if(x.results.length!==1||x.results[0].resultKind!=='unspecified')
       fail('結果不明の複数候補混在');
      counters.unsegmentedChoices++;
    }
    if(x.diagnostics.includes('HINT_LEVEL_RANGE'))counters.rangedHintChoices++;
    let num=0,unresolved=0,terminal=0;
    const observed=[];
    for(const part of x.results){
      if(!Array.isArray(part.skillHints)||typeof part.terminalObserved!=='boolean')
       fail('分岐の報酬形式が不正');
      if(part.terminalObserved){counters.observedTerminations++;terminal++;
       counters[x.structure==='unspecified'?'choiceTerminations':'outcomeTerminations']++;}
      for(const hint of part.skillHints){
       if(!hint||typeof hint!=='object')fail('ヒント形式が不正');
       if(hint.skillId){num++;counters.numericHintMentions++;}
       else {unresolved++;counters.unresolvedHintMentions++;}
       const lev=hint.level??hint.levelMin;
       if(!Number.isInteger(lev)||lev<1||lev>10||hint.levelMax!==undefined&&hint.levelMax<=lev)
        fail('ヒントレベル形式が不正');
       observed.push({id:hint.skillId??null,name:hint.unresolvedSkillName??null,level:lev});
      }
    }
    const prior=c.observedHints.map(h=>({id:h.skillId??null,name:h.skillName??null,level:h.level}));
    if(JSON.stringify(observed.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))!==
       JSON.stringify(prior.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))))
      fail('元候補のヒントID・Lv多重集合を保持していない');
   }
   if(explicit)counters.explicitOutcomeEvents++;
  }
 }
 for(const [key,val] of Object.entries(counters))if(derived.stats?.[key]!==val)fail('全件集計不一致: '+key);
 return counters;
}
module.exports={parseEffect,generate,verifyDerived};
