'use strict';
/*
 * GameTora-first COMPLETE numeric candidate normalization.
 *
 * Normalize every source event, choice, segment and outcome into a numbered
 * draft for later source-specific exception adjudication. Never copy event or
 * option prose. Never translate a GameTora numeric skill ID to a name-based
 * runtime hint ID without an independently verified mapping.
 *
 * Do not use these records as publication/reward facts.
 */
const crypto=require('node:crypto');
const POLICY=require('../config/event-source-priority.v1.json');
const {flattenRoutes}=require('../tools/audit_gametora_branches.cjs');
const fail=m=>{throw Error('GameTora全イベント正規化: '+m);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const positive=x=>Number.isSafeInteger(x)&&x>0;
const prior=new Set(['both_previous_chain_good','one_previous_chain_good',
 'both_previous_chain_bad','one_previous_chain_bad','result_good','result_bad',
 'result_average','success','fail','branch_flag']);
const numeric=x=>{
 if(typeof x!=='string'&&typeof x!=='number')return null;
 const s=String(x);
 return /^[+-]?\d+$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;
};
function transformDocument(document){
 if(!obj(document)||document.kind!=='support'||!positive(document.id))
  fail('GameToraサポカID/ドキュメント不正');
 const cardId=String(document.id);
 const usesJa=obj(document.events_ja)&&Object.keys(document.events_ja).length>0;
 const original=usesJa?document.events_ja:document.events;
 if(!obj(original)||!Object.keys(original).length)fail(cardId+': イベント一覧なし');
 const entries=Object.entries(original);
 const events=[],reviewQueue=[];
 let chainOrdinal=0,random=0,others=0,choiceCount=0,resultCount=0,
  hintCount=0,unsupportedHint=0,skillGrants=0,terminal=0,chainTerminal=0,conditional=0;
 const eventCounts=new Map(),allEffectTypes=new Map();
 const chainPositions=entries.map(([_,e],i)=>e?.section==='arrows'?i+1:null).filter(Boolean);
 const issues=(record,code,context={})=>{
  record.reviewReasons.add(code);
  reviewQueue.push({cardId,sourceOrdinal:record.sourceOrdinal,
   ...context,reason:code});
 };
 for(let ei=0;ei<entries.length;ei++){
  const [title,item]=entries[ei],sourceOrdinal=ei+1;
  if(!obj(item)||!Array.isArray(item.choices)||!item.choices.length)
   fail(cardId+': イベント選択肢が破損 '+sourceOrdinal);
  if(typeof title!=='string'||typeof item.name!=='string')fail('イベント名形態が不正');
  const section=item.section||'unspecified',isChain=section==='arrows';
  if(isChain)chainOrdinal++;else if(section==='random')random++;else others++;
  const chainIndex=isChain?chainPositions.indexOf(sourceOrdinal):-1;
  const nextOrdinal=chainIndex>=0?chainPositions[chainIndex+1]||null:null;
  const record={
   sourceOrdinal,sourceLocalEventId:Number.isSafeInteger(item.id)?item.id:null,
   eventId:'gt-'+cardId+'-event-'+String(sourceOrdinal).padStart(3,'0'),
   displayName:'イベント'+String(sourceOrdinal).padStart(3,'0')+'（仮）',
   section,sourceChainOrdinal:isChain?chainOrdinal:null,
   nextChainSourceOrdinalCandidate:nextOrdinal,
   nextStageMeaning:nextOrdinal?'SOURCE_PRESENTATION_ORDER_NOT_INDEPENDENTLY_VERIFIED':null,
   sourceTitleFingerprint:'sha256:'+hash((item.name||title).normalize('NFKC').replace(/\s+/g,' ').trim()),
   choices:[],reviewReasons:new Set()
  };
  for(let ci=0;ci<item.choices.length;ci++){
   const choice=item.choices[ci];
   if(!obj(choice)||typeof choice.label!=='string')
    fail(cardId+': 選択肢形式が不正 '+sourceOrdinal+'/'+(ci+1));
   const branches=flattenRoutes(choice);
   if(!branches.length)fail(cardId+': 結果経路なし');
   const normalizedChoice={
    choiceOrdinal:ci+1,choiceId:'choice-'+String(ci+1).padStart(2,'0'),
    displayLabel:'選択肢'+(ci+1)+'（仮）',
    reportedRandomAlternative:choice.random_either===true,
    // Raw probabilities may be unknown; NEVER assert a success rate.
    reportedProbabilityAvailable:Array.isArray(choice.probs)&&
      choice.probs.length===branches.length&&choice.probs.every(x=>typeof x==='number'&&Number.isFinite(x)),
    routes:[]
   };
   if(normalizedChoice.reportedRandomAlternative&&branches.length<2)
    issues(record,'RANDOM_ALTERNATIVE_WITHOUT_MULTIPLE_RESULTS',{choiceOrdinal:ci+1});
   for(let ri=0;ri<branches.length;ri++){
    const route=branches[ri],reasonCodes=new Set();
    if(!Array.isArray(route.effects)||!Array.isArray(route.when))fail('flatten結果が不正');
    const effects=[],hints=[],obtainedSkills=[],guards=[];
    for(const g of route.when){
     if(!obj(g)||typeof g.kind!=='string')fail('特殊結果ガード不正');
     guards.push(g.kind);
    }
    if(guards.length)reasonCodes.add('CONDITIONAL_SEGMENT_REQUIRES_REVIEW');
    for(const effect of route.effects){
     if(!obj(effect)||typeof effect.type!=='string'||!effect.type)
      fail('効果種類が不正');
     const type=effect.type;
     allEffectTypes.set(type,(allEffectTypes.get(type)||0)+1);
     const number=numeric(effect.value);
     effects.push({type,numericValue:number,
      skillNumericId:positive(effect.skill_id)?effect.skill_id:null});
     if(type==='skill_hint'||type==='skill_hint_or'){
      const skillId=positive(effect.skill_id)?String(effect.skill_id):null;
      const level=number!==null&&number>=1&&number<=20?number:null;
      const resolved=type==='skill_hint'&&skillId!==null&&level!==null;
      hints.push({skillNumericId:skillId,level,
       originType:type,numericFactParsed:resolved,
       appSkillIdVerified:false});
      if(resolved)hintCount++;
      else{unsupportedHint++;reasonCodes.add('SKILL_HINT_EFFECT_UNRESOLVED');}
     }
     if(type==='obtain_skill'){
      // A direct skill award is NOT a hint level. Never silently omit it.
      skillGrants++;
      obtainedSkills.push({skillNumericId:positive(effect.skill_id)?String(effect.skill_id):null,
       awardSemanticsReviewed:false});
      reasonCodes.add('DIRECT_SKILL_GRANT_REQUIRES_REVIEW');
     }
     if(prior.has(type))reasonCodes.add('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW');
    }
    for(const marker of guards)if(prior.has(marker))
     reasonCodes.add('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW');
    const terminalHere=effects.some(x=>x.type==='chain_end');
    if(terminalHere){terminal++;if(isChain)chainTerminal++;}
    if(reasonCodes.has('PRIOR_RESULT_OR_BRANCH_FLAG_REQUIRES_REVIEW')||
       reasonCodes.has('CONDITIONAL_SEGMENT_REQUIRES_REVIEW'))conditional++;
    if(terminalHere&&section!=='arrows')reasonCodes.add('TERMINATION_OUTSIDE_CHAIN');
    const routeResult={routeOrdinal:ri+1,routeId:'route-'+String(ri+1).padStart(2,'0'),
      explicitChainEnd:terminalHere,
      provisionalTransition:isChain
       ?(terminalHere?'TERMINAL':nextOrdinal?'DEFAULT_CONTINUE':'OBSERVED_CHAIN_TAIL')
       :'NOT_A_CHAIN',
      // A sequence gap is independently audited; never a verified game edge.
      nextSourceOrdinalCandidate:isChain&&!terminalHere?nextOrdinal:null,
      numericHintFacts:hints,directSkillGrantFacts:obtainedSkills,effects,guardKinds:guards,
      conditionsRequiringReview:[...reasonCodes].sort()};
    normalizedChoice.routes.push(routeResult);resultCount++;
    for(const reason of reasonCodes)issues(record,reason,{choiceOrdinal:ci+1,routeOrdinal:ri+1});
   }
   choiceCount++;
   record.choices.push(normalizedChoice);
  }
  events.push({...record,reviewReasons:[...record.reviewReasons].sort()});
  eventCounts.set(section,(eventCounts.get(section)||0)+1);
 }
 return {cardId,sourceLanguage:usesJa?'ja':'fallback',
  sourceEventCount:events.length,sourceChoiceCount:choiceCount,
  sourceExpandedRoutes:resultCount,sourceChainCount:chainOrdinal,
  sourceRandomCount:random,sourceOtherCount:others,numericParsedHintMentions:hintCount,
  unresolvedHintMentions:unsupportedHint,directSkillGrantMentions:skillGrants,
  explicitChainEndRoutes:terminal,
  explicitChainTerminalRoutes:chainTerminal,
  conditionalRoutes:conditional,events,reviewQueue,
  sectionCounts:Object.fromEntries([...eventCounts].sort()),
  effectTypeCounts:Object.fromEntries([...allEffectTypes].sort())};
}
function build({documents,index,revision=POLICY.baselineRevision}){
 if(POLICY.schemaVersion!==2||POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||POLICY.automaticPublicationAllowed!==false||
    revision!==POLICY.baselineRevision||
    index?.dataKind!=='umasupport-whole-event-provisional-index'||
    index.sourcePins?.gameToraDerived!==revision||index.publicationApproval!==false||
    !Array.isArray(index.cards)||!Array.isArray(documents))
  fail('データ出典・固定版・非公開状態の検証に失敗');
 const docs=new Map(),rosterIds=new Set(index.cards.map(c=>c.cardId));
 if(rosterIds.size!==index.cards.length)fail('カード一覧が重複');
 for(const d of documents){
  const id=String(d?.id);
  if(docs.has(id)||!rosterIds.has(id))fail('GameToraカードが重複／対象外 '+id);
  docs.set(id,d);
 }
 const totals={rosterCards:index.cards.length,baselineCards:docs.size,missingBaselineCards:0,
  sourceEvents:0,sourceChoices:0,expandedRoutes:0,sourceChainEvents:0,
  sourceRandomEvents:0,sourceOtherEvents:0,
  explicitTerminalRoutes:0,explicitChainTerminalRoutes:0,
  explicitNonchainTerminalRoutes:0,numericHintMentions:0,unresolvedHintMentions:0,
  directSkillGrantMentions:0,
  conditionalRoutes:0,reviewQueueEntries:0};
 const cards=[],reviewQueue=[],types={};
 for(const roster of index.cards){
  const id=roster.cardId,doc=docs.get(id);
  if(!doc){
   if(roster.sourceMissing!==true||roster.gameToraObservedCount!==0)
    fail('元カード欠損台帳と不一致 '+id);
   totals.missingBaselineCards++;
   cards.push({cardId:id,sourceMissing:true,sourceEventCount:0,events:[]});
   reviewQueue.push({cardId:id,reason:'CARD_MISSING_FROM_GAMETORA_BASELINE'});
   continue;
  }
  const row=transformDocument(doc);
  if(roster.sourceMissing!==false||roster.gameToraObservedCount!==row.sourceEventCount)
   fail('元カードのイベント件数が既存索引と異なる '+id);
  totals.sourceEvents+=row.sourceEventCount;
  totals.sourceChoices+=row.sourceChoiceCount;
  totals.expandedRoutes+=row.sourceExpandedRoutes;
  totals.sourceChainEvents+=row.sourceChainCount;
  totals.sourceRandomEvents+=row.sourceRandomCount;
  totals.sourceOtherEvents+=row.sourceOtherCount;
  totals.explicitTerminalRoutes+=row.explicitChainEndRoutes;
  totals.explicitChainTerminalRoutes+=row.explicitChainTerminalRoutes;
  totals.explicitNonchainTerminalRoutes+=row.explicitChainEndRoutes-row.explicitChainTerminalRoutes;
  totals.numericHintMentions+=row.numericParsedHintMentions;
  totals.unresolvedHintMentions+=row.unresolvedHintMentions;
  totals.directSkillGrantMentions+=row.directSkillGrantMentions;
  totals.conditionalRoutes+=row.conditionalRoutes;
  reviewQueue.push(...row.reviewQueue);
  for(const [kind,count] of Object.entries(row.effectTypeCounts))
   types[kind]=(types[kind]||0)+count;
  const {reviewQueue:drop,effectTypeCounts:drop2,...data}=row;
  cards.push(data);
 }
 if(totals.sourceEvents!==index.stats.gameToraEventRecords||
    totals.rosterCards!==totals.baselineCards+totals.missingBaselineCards||
    totals.sourceChainEvents+totals.sourceRandomEvents+totals.sourceOtherEvents!==totals.sourceEvents||
    totals.expandedRoutes<totals.sourceChoices||
    totals.explicitTerminalRoutes!==totals.explicitChainTerminalRoutes+totals.explicitNonchainTerminalRoutes)
  fail('全件変換の前後の件数が保存されていません');
 totals.reviewQueueEntries=reviewQueue.length;
 return {schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  sourcePins:{gameToraDerived:revision,checkerIndex:index.sourcePins.checker},
  originalSourceTextIncluded:false,sourceIdsAreNotGameStoryIds:true,
  numericSkillsNotMappedToRuntimeNames:true,
  noEventCanPublishFromThisCandidate:true,
  releaseApproved:false,gameVerified:false,sourceOrderAdjacencyVerified:false,
  totals,effectTypeCounts:Object.fromEntries(Object.entries(types).sort()),
  reviewQueue,cards};
}
module.exports={transformDocument,build};
