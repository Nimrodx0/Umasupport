'use strict';
/*
 * Integrate 15 separately adjudicated missing chain stages into the existing
 * 2496-event, NONPUBLIC catalog. The 17 ordinary continuation edges are
 * actual flag-ON rules; appearance RNG is outside the app model.
 * No source prose, external mass crawl or human publication signature.
 */
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const core=require('./core.js');
const {build:buildChain}=require('./phase2_chain_plan_build.cjs');
const fail=s=>{throw Error('Phase2非公開2511連続イベント統合: '+s);};
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const FIVE=['30318','30319','30320','30321','30221'];
function assemble(assembled,{strict=false}={}){
 if(assembled?.dataKind!=='phase2-nonpublishing-2496-event-assembled-runtime'||
    assembled.publicationApproved!==false||
    assembled.reviewedEventsPublished!==0||
    assembled.noAutomaticRuntimeAdoption!==true||
    assembled.sourceNarrativeOrChoiceProseIncluded!==false||
    assembled.catalog?.schemaVersion!==1||
    !Array.isArray(assembled.catalog.cards)||
    assembled.summary?.catalogSha256!==hash(assembled.catalog))
  fail('公開未承認の出典・SHA付き2,496イベント候補が不正');
 const oldCount=assembled.catalog.cards.reduce((n,c)=>n+c.events.length,0);
 const sourceCardCount=assembled.catalog.cards.length;
 if(oldCount!==assembled.summary.totalCandidateEvents||
    sourceCardCount!==assembled.summary.rosterCards)
  fail('元イベント母集団の個数が不正');
 const plan=buildChain();
 if(plan.schemaVersion!==1||
    plan.dataKind!=='phase2-five-chain-ordinary-default-planning-preview'||
    plan.previewOnly!==true||plan.publicationApproved!==false||
    plan.flagSetUnlessTerminated!==true||
    plan.enabledContinuationFlags!==17||
    plan.explicitTerminalBranchesInSelectedEvidence!==0||
    plan.status!=='CHOICE_DEPENDENT_CHAIN_FLAGS'||
    !Array.isArray(plan.cards)||plan.cards.length!==5)
  fail('GameWith採用済み5枚のフラグ既定ルールが変化');
 const catalog=structuredClone(assembled.catalog);
 const cards=new Map(catalog.cards.map(c=>[c.cardId,c]));
 if(cards.size!==catalog.cards.length)fail('カードID重複');
 let stages=0,choiceStages=0,autoStages=0,selectionRows=0,skillHints=0,flags=0;
 const sourceHashes=new Map();
 for(const card of catalog.cards)for(const event of card.events){
  const key=JSON.stringify([card.cardId,event.id]);
  if(sourceHashes.has(key))fail('元イベントID重複');
  sourceHashes.set(key,hash(event));
 }
 for(const [idx,source] of plan.cards.entries()){
  const card=cards.get(source.cardId);
  if(source.cardId!==FIVE[idx]||!card||
     card.coverageStatus!=='partial'||!Array.isArray(card.events)||
     !Array.isArray(source.events)||source.events.length!==3)
   fail('追加対象のサポカと段階順が不正');
  if(source.cardId!=='30221'&&
     (card.events.length!==2||
      card.events.some(e=>!e.id.startsWith('usl:'+source.cardId+':random:'))))
   fail('固定GT欠損4SSRの通常8イベントの位置が不正');
  if(source.cardId==='30221'&&
     (card.events.length<2||card.events.some(e=>e.id.startsWith('usl:30221:chain:'))))
   fail('既存GT30221の固定イベント対応が不正');
  const incoming=[];
  for(const [i,e] of source.events.entries()){
   if(e.id!=='usl:'+source.cardId+':chain:'+(i+1)||
      e.ordinal!==i+1||typeof e.title!=='string'||!e.title||
      !/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/.test(e.sourceUrl)||
      e.choiceCount!==0&&e.choiceCount!==2||
      !Array.isArray(e.alternatives)||
      e.alternatives.length!==(e.choiceCount||1)||
      !Array.isArray(e.nextStageEdges)||
      e.nextStageEdges.length!==(i===2?0:e.alternatives.length))
    fail('連続3段階の元出典ID・見出し・選択肢対応が不正');
   const requires=i===0?{}:{requires:{all:[{eventId:source.events[i-1].id}]}};
   const reward=a=>a.hints.map(h=>{
    if(!Array.isArray(h)||h.length!==3||
       !/^skill:\d+$/.test(h[0])||!Number.isSafeInteger(h[1])||
       h[1]<1||typeof h[2]!=='string'||!h[2].trim()||
       h[2].startsWith('スキルID '))
     fail('数値ID・ヒントLv・照合済み日本語名が不正');
    skillHints++;
    return {skillId:h[0],level:h[1],verifiedSkillName:h[2]};
   });
   const event={id:e.id,name:e.title,...requires};
   if(e.choiceCount===0){
    autoStages++;
    event.type='auto';
    event.rewards=reward(e.alternatives[0]);
   }else{
    choiceStages++;
    event.type='choice';
    event.choices=e.alternatives.map((a,j)=>{
     if(a.id!=='option'+(j+1))fail('編集選択ID順の不整合');
     return {id:a.id,label:j===0?'上の選択肢':'下の選択肢',
      rewards:reward(a)};
    });
   }
   stages++;selectionRows+=e.alternatives.length;
   // The ID of each source route determines its unlocking flag.
   for(const [j,edge] of e.nextStageEdges.entries()){
    flags++;
    if(edge.choiceId!==e.alternatives[j].id||
       edge.nextStageId!==source.events[i+1].id||
       edge.continuation!=='ORDINARY_DEFAULT_NO_EXPLICIT_CUTOFF'||
       edge.setsNextStageFlag!==true||edge.terminal!==false||
       edge.rule!=='NO_EXPLICIT_CHAIN_END')
     fail('既知の打ち切りなしフラグON規則と不一致');
   }
   if(card.events.some(x=>x.id===e.id))fail('同じカードのイベントID重複');
   incoming.push(event);
  }
  card.events.push(...incoming);
  // Test the *production* reachability engine on each of the source edge
  // options, with actual explicit outcome flags rather than spawn RNG.
  for(let i=0;i<2;i++){
   const parent=incoming[i],next=incoming[i+1];
   for(const option of parent.type==='choice'?parent.choices:[{id:'option1'}]){
    const selected={};
    for(const prior of incoming.slice(0,i))if(prior.type==='choice')
     selected[prior.id]=prior.choices[0].id;
    if(parent.type==='choice')selected[parent.id]=option.id;
    const status=core.reachability(next,selected,incoming,{});
    if(status.status!=='reachable')
     fail('通常継続フラグが本番コアで立たない: '+source.cardId+'/'+parent.id);
   }
  }
  for(const [i,ev] of incoming.entries()){
   for(const a of source.events[i].alternatives){
    const selections={};
    for(const prev of incoming.slice(0,i))if(prev.type==='choice')
     selections[prev.id]=prev.choices[0].id;
    if(ev.type==='choice')selections[ev.id]=a.id;
    const routes=core.directRoutes({id:source.cardId,hints:[],events:incoming},
     {stage:4,choices:selections,outcomes:{}}).filter(r=>r.eventId===ev.id);
    if(routes.length!==a.hints.length||
       routes.some((r,j)=>r.skillId!==a.hints[j][0]||
        r.level!==a.hints[j][1]))
     fail('連続イベントの選択位置とヒントが実コアで一致しない');
   }
   if(i>0&&incoming[i-1].type==='choice'){
    const prior={};
    for(const p of incoming.slice(0,i-1))if(p.type==='choice')
     prior[p.id]=p.choices[0].id;
    if(ev.type==='choice')prior[ev.id]=ev.choices[0].id;
    const blocked=core.directRoutes({id:source.cardId,hints:[],events:incoming},
     {stage:4,choices:prior,outcomes:{}}).filter(r=>r.eventId===ev.id);
    if(blocked.length)fail('未選択の前段から後続スキルが混入');
   }
  }
  // Mutating a throwaway branch lets us verify explicit cutoffs. The
  // approved GameWith records themselves stay unchanged and non-terminal.
  for(const [i,ev] of incoming.entries()){
   if(i>=2||ev.type!=='choice')continue;
   const copied=structuredClone(incoming);
   copied[i].choices[0].terminal=true;
   const select={[copied[i].id]:copied[i].choices[0].id};
   for(const prev of copied.slice(0,i))if(prev.type==='choice')
    select[prev.id]=prev.choices[0].id;
   if(core.reachability(copied[i+1],select,copied,{}).status!=='blocked')
    fail('明示的な打ち切りで下流フラグが消えない');
  }
 }
 const found=new Set(),skills=new Set();
 for(const card of catalog.cards)for(const event of card.events){
  const key=JSON.stringify([card.cardId,event.id]);
  if(found.has(key))fail('統合後イベントIDの重複');
  found.add(key);
  if(sourceHashes.has(key)&&hash(event)!==sourceHashes.get(key))
   fail('2,496件の元イベント内容SHAが変化');
  for(const part of event.type==='choice'?event.choices:[event]){
   for(const candidate of part.outcomes||[part]){
    for(const reward of candidate.rewards||[])skills.add(reward.skillId);
   }
  }
 }
 const stub={cards:catalog.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(catalog.cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries([...skills].map(id=>[id,{id}]))};
 const checked=schema.validateCatalog(catalog,stub);
 if(checked.cardsWithRecords!==sourceCardCount||
    checked.eventsWithRecords!==oldCount+15)
  fail('本番イベントスキーマで全統合行が一致しない');
 if(stages!==15||choiceStages!==7||autoStages!==8||
    selectionRows!==22||skillHints!==9||flags!==17)
  fail('追加15段階の7択/8自動/22結果/9ヒント/17フラグが不一致');
 if(strict&&(oldCount!==2496||sourceCardCount!==563||
    checked.eventsWithRecords!==2511))
  fail('固定全件563カード・2,511イベントの保存則が不一致');
 return {
  dataKind:'phase2-2511-nonpublishing-gt-and-curated-chain-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,
  sourceNarrativeOrChoiceProseIncluded:false,
  catalog,
  summary:{rosterCards:sourceCardCount,unchangedSourceEvents:oldCount,
   totalCandidateEvents:checked.eventsWithRecords,
   appendedChainStages:stages,appendedChoiceStages:choiceStages,
   appendedAutoStages:autoStages,appendedAlternatives:selectionRows,
   appendedSkillHints:skillHints,enabledChainFlags:flags,
   catalogSha256:hash(catalog),approvedEvents:0}
 };
}
module.exports={assemble};
