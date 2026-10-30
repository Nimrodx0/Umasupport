'use strict';
/**
 * Convert the already accepted, PRIVATE final Phase2 catalog into the
 * user-chosen title-preserving, provisional-choice-label product SHAPE.
 *
 * NEVER emits a release file. Title reuse, source DB terms and publication
 * eligibility are NOT decided by this structural transformation.
 * Every source field is allowlisted; an unfamiliar field fails closed.
 */
const loader=require('./public_event_catalog.js');
const core=require('./core.js');
const {verifyRelease,canonical}=require('./event_release_gate.cjs');
const crypto=require('node:crypto');
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=m=>{throw Error('Phase2見出し保持・仮称選択肢の試用投影: '+m);};
const keys=(x,allowed,where)=>{
 if(!obj(x))fail(where+': オブジェクトでない');
 const extra=Object.keys(x).filter(k=>!allowed.includes(k));
 if(extra.length)fail(where+': 未分類のフィールド '+extra.join(','));
};
const CATALOG=['schemaVersion','cards'];
const CARD=['cardId','coverageStatus','events'];
const EVENT=['id','name','type','rewards','outcomes','choices','requires',
 'availabilityKind','effects','statusEffects','dynamicEffects','terminal'];
const PART=['id','label','rewards','outcomes','requires','terminal',
 'effects','statusEffects','dynamicEffects'];
const REWARD=['skillId','verifiedSkillName','kind','level','condition'];
const EFFECT=['kind','delta','sourceComponent','recipientCharId','sourceBundle','sourceEffectOrdinal'];
const STATUS=['kind','conditionId','possible','chance','sourceEffectOrdinal'];
const DYNAMIC=['kind','delta','statCount','targetSelection','scenario','possible',
 'duration','activation'];
const CONDITION=['all','eventId','choiceId','outcomeId','any'];
function copyFields(x,allowed,where){
 keys(x,allowed,where);
 return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,structuredClone(v)]));
}
function constraints(raw,where){
 if(raw===undefined)return undefined;
 if(!obj(raw))fail(where+': 条件不正');
 keys(raw,CONDITION,where);
 if(raw.all!==undefined){
  if(!Array.isArray(raw.all))fail(where+': AND条件不正');
  raw.all.forEach((r,i)=>constraints(r,where+'/all/'+i));
 }
 if(raw.any!==undefined){
  if(!Array.isArray(raw.any))fail(where+': OR条件不正');
  raw.any.forEach((r,i)=>constraints(r,where+'/any/'+i));
 }
 return structuredClone(raw);
}
function copySequence(raw,allowed,where){
 if(raw===undefined)return undefined;
 if(!Array.isArray(raw))fail(where+': 配列不正');
 return raw.map((x,i)=>copyFields(x,allowed,where+'/'+i));
}
function rewards(raw,where){
 if(raw===undefined)return undefined;
 if(!Array.isArray(raw))fail(where+': rewards配列不正');
 return raw.map((r,i)=>{
  const path=where+'/reward/'+i;
  const copy=copyFields(r,REWARD,path);
  // Free-form prose in reward.condition is NOT part of the reviewed numeric
  // condition model. The fixed 2512 catalog has zero such strings.
  if(copy.condition!==undefined)fail(path+': 未分類の自由記述条件を転載しません');
  return copy;
 });
}
const counters=()=>({events:0,choices:0,outcomes:0,titlesPreserved:0,
 choiceLabelsStandardized:0,outcomeLabelsStandardized:0});
function part(raw,where,kind,index,counts){
 const allowed=kind==='event'?EVENT:PART;
 keys(raw,allowed,where);
 const out={};
 if(kind==='event'){
  if(typeof raw.name!=='string'||!raw.name.trim()||
     typeof raw.id!=='string'||!['auto','choice'].includes(raw.type))
   fail(where+': イベント名／識別が不正');
  out.id=raw.id;out.name=raw.name;out.type=raw.type;
  counts.events++;counts.titlesPreserved++;
 }else{
  if(typeof raw.id!=='string'||!raw.id||
     typeof raw.label!=='string'||!raw.label)
   fail(where+': 分岐ID／ラベルが不正');
  out.id=raw.id;
  // Explicitly do NOT copy source option or outcome wording, even when some
  // events currently have a non-placeholder label (3 options / 11 outcomes).
  out.label=kind==='choice'?'選択肢'+(index+1)+'（仮）':
   '結果'+(index+1)+'（仮）';
  if(kind==='choice'){
   counts.choices++;counts.choiceLabelsStandardized++;
  }else{
   counts.outcomes++;counts.outcomeLabelsStandardized++;
  }
 }
 for(const k of ['availabilityKind','terminal'])
  if(raw[k]!==undefined)out[k]=raw[k];
 if(raw.requires!==undefined)out.requires=constraints(raw.requires,where+'/requires');
 if(raw.rewards!==undefined)out.rewards=rewards(raw.rewards,where);
 for(const [field,allowed] of [
  ['effects',EFFECT],['statusEffects',STATUS],['dynamicEffects',DYNAMIC]
 ])if(raw[field]!==undefined)
  out[field]=copySequence(raw[field],allowed,where+'/'+field);
 if(raw.choices!==undefined){
  if(kind!=='event'||!Array.isArray(raw.choices))
   fail(where+': 選択肢の入れ子不正');
  out.choices=raw.choices.map((ch,i)=>part(ch,where+'/choice/'+i,'choice',i,counts));
 }
 if(raw.outcomes!==undefined){
  if(!Array.isArray(raw.outcomes))fail(where+': 結果の入れ子不正');
  out.outcomes=raw.outcomes.map((result,i)=>
   part(result,where+'/outcome/'+i,'outcome',i,counts));
 }
 return out;
}
function project(catalog){
 keys(catalog,CATALOG,'catalog');
 if(catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail('既存カタログ形式が違います');
 const total=counters(),seen=new Set();
 const cards=catalog.cards.map((card,i)=>{
  keys(card,CARD,'card/'+i);
  if(typeof card.cardId!=='string'||seen.has(card.cardId)||
     card.coverageStatus!=='partial'||!Array.isArray(card.events))
   fail('対象カードID重複・収録状態不正');
  seen.add(card.cardId);
  return {cardId:card.cardId,coverageStatus:'partial',
   events:card.events.map((event,j)=>
    part(event,'card/'+i+'/event/'+j,'event',j,total))};
 });
 const normalized={schemaVersion:1,cards};
 if(total.events!==catalog.cards.reduce((n,c)=>n+c.events.length,0))
  fail('投影時にイベントが欠落');
 return {catalog:normalized,counts:total,privateOnly:true,
  publicationApproved:false,userChosenTitleAndPlaceholderFormat:true};
}
function selected(card){
 const choices={},outcomes={};
 for(const e of card.events||[]){
  if(e.type==='choice'){
   choices[e.id]=e.choices[0].id;
   if(e.choices[0].outcomes?.length)outcomes[e.id]=e.choices[0].outcomes[0].id;
  }else if(e.outcomes?.length)outcomes[e.id]=e.outcomes[0].id;
 }
 return {stage:4,choices,outcomes};
}
function identity(card,config){
 return core.directRoutes(card,config).filter(r=>r.source==='event')
  .map(r=>({skillId:r.skillId,eventId:r.eventId,kind:r.kind,
   level:r.level,conditional:r.conditional}));
}
function normalizedLogic(catalog){
 // Compare all branches, not only routes exercised by a particular selection.
 // Titles are retained, so strip only user-facing option / outcome labels.
 const data=structuredClone(catalog);
 const clean=e=>{
  if(e.choices)for(const ch of e.choices)clean(ch);
  if(e.outcomes)for(const out of e.outcomes)clean(out);
  if(Object.hasOwn(e,'label'))delete e.label;
 };
 for(const card of data.cards)for(const e of card.events)clean(e);
 return crypto.createHash('sha256').update(canonical(data)).digest('hex');
}
function verifyPrivate({catalog,model,skillText},{strict=true}={}){
 if(!Array.isArray(model?.cards)||typeof skillText!=='string'||!skillText)
  fail('実カード名簿・数値スキル辞書が必要');
 const src=sha(catalog),before=sha(model);
 const result=project(catalog);
 if(strict&&(result.counts.events!==2512||result.catalog.cards.length!==563||
   result.counts.titlesPreserved!==2512||
   result.counts.choices!==3269||result.counts.outcomes!==512))
  fail('固定全件の母数が変わった');
 if(normalizedLogic(result.catalog)!==normalizedLogic(catalog))
  fail('イベント名・識別子・報酬・到達条件が変化');
 const preflight=loader.preflight(model,result.catalog,{skillText,fullRegistry:false});
 if(preflight.summary.eventsWithRecords!==result.counts.events)
  fail('既存の本番読込器で構造検証失敗');
 const input=structuredClone(model),output=structuredClone(model);
 input.cards=input.cards.map(c=>input.cardById[c.id]||c);
 output.cards=output.cards.map(c=>output.cardById[c.id]||c);
 loader.attach(input,catalog,{skillText,fullRegistry:false});
 loader.attach(output,result.catalog,{skillText,fullRegistry:false});
 let cardStates=0;
 for(const card of input.cards){
  const projected=output.cardById[card.id];
  if(!projected||sha(card.events.map(e=>[e.id,e.name]))!==
      sha(projected.events.map(e=>[e.id,e.name])))
   fail('イベント名・IDが変わった');
  for(const config of [{stage:4,choices:{},outcomes:{}},selected(card)]){
   if(sha(identity(card,config))!==sha(identity(projected,config)))
    fail('代表状態の獲得経路が変わった');
   cardStates++;
  }
 }
 if(sha(catalog)!==src||sha(model)!==before)
  fail('非公開の元データが書き換えられた');
 if(strict&&cardStates!==1126)fail('代表カード状態が不足');
 // This is only a private candidate. It MUST fail the existing human review
 // release gate with empty approvals; never generate or forge approvals.
 let releaseBlocked=false;
 try{verifyRelease(result.catalog,{schemaVersion:1,entries:[]});}
 catch(e){if(!/承認証跡|レビュー/.test(String(e)))throw e;releaseBlocked=true;}
 if(result.counts.events&&!releaseBlocked)
  fail('既存の公開ゲートが未承認データを許した');
 return {status:'PHASE2_TITLES_RETAINED_PLACEHOLDERS_VERIFIED',
  sourceCatalogSha256:src,projectedSha256:sha(result.catalog),
  cards:result.catalog.cards.length,events:result.counts.events,
  titlesPreserved:result.counts.titlesPreserved,
  choicesNowProvisional:result.counts.choices,
  outcomesNowProvisional:result.counts.outcomes,
  productionSchemaAccepted:true,allLogicStructurallyIdentical:true,
  productionRoutesVerifiedCardStates:cardStates,
  existingReleaseGateBlocked:true,publicEventsAdded:0,
  userFacingCopyReleased:false,
  copyrightOrDataReuseDetermined:false};
}
module.exports={project,verifyPrivate};
