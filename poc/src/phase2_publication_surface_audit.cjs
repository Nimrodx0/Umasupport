'use strict';
/*
 * Private, in-memory publication-surface / usability audit for the FINAL
 * 563-card / 2512-event Phase2 catalog. Never publishes or logs source text.
 *
 * This is NOT a copyright determination. It measures what each hypothetical
 * exclusion removes from the user experience, before proposing release.
 */
const crypto=require('node:crypto');
const loader=require('./public_event_catalog.js');
const core=require('./core.js');
const fail=x=>{throw Error('Phase2フィールド別公開実用性監査: '+x);};
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const noRaw=x=>JSON.parse(JSON.stringify(x));
const autoEvent=/^イベント\d{1,3}（仮）$/u;
const autoChoice=/^(?:選択肢\d+（仮）|上の選択肢|下の選択肢|選択肢\d+)$/u;
const autoResult=/^結果\d+.*（仮）$/u;
const counters=()=>({
 cards:0,events:0,autoEvents:0,choiceEvents:0,
 eventsWithSourceStyleTitles:0,eventsWithGeneratedTitles:0,
 choices:0,choicesWithGeneratedLabels:0,choicesWithOtherLabels:0,
 outcomes:0,outcomesWithGeneratedLabels:0,outcomesWithOtherLabels:0,
 sourceStyleEventTitlesOnChoiceEvents:0,
 skillRewards:0,rewardWithNumericSkillId:0,rewardWithVerifiedName:0,
 rewardConditionsWithText:0,choicesWithRewardsOrOutcomes:0,
 eventsWithSkillRewards:0,eventsWithNonSkillEffect:0,
 nonSkillEffectRows:0,statusEffectRows:0,dynamicEffectRows:0,
 terminalBranches:0,eventsWithRequires:0,
 unsupportedAttributes:0,unclassifiedFieldNames:{},
 choiceEventsWithSourceStyleTitleAndGeneratedChoices:0
});
const allowedEvent=new Set(['id','name','type','choices','rewards','outcomes',
 'requires','availabilityKind','effects','statusEffects','dynamicEffects','terminal']);
const allowedChoice=new Set(['id','label','rewards','outcomes','requires',
 'terminal','effects','statusEffects','dynamicEffects']);
const allowedOutcome=new Set(['id','label','rewards','outcomes','effects','statusEffects',
 'dynamicEffects','terminal','requires']);
const allowedReward=new Set(['skillId','verifiedSkillName','kind','level','condition']);
function attributes(obj,allowed,total){
 const fields=Object.keys(obj).filter(k=>!allowed.has(k));
 for(const field of fields)
  total.unclassifiedFieldNames[field]=(total.unclassifiedFieldNames[field]||0)+1;
 return fields.length;
}
function collectPart(part,total){
 total.unsupportedAttributes+=attributes(part,
  part.id!==undefined&&part.label!==undefined?allowedOutcome:allowedEvent,total);
 let hasSkills=false,hasEffects=false;
 if(part.terminal===true)total.terminalBranches++;
 for(const reward of part.rewards||[]){
  total.unsupportedAttributes+=attributes(reward,allowedReward,total);
  total.skillRewards++;
  if(/^skill:\d+$/u.test(reward.skillId))total.rewardWithNumericSkillId++;
  if(typeof reward.verifiedSkillName==='string')total.rewardWithVerifiedName++;
  if(typeof reward.condition==='string')total.rewardConditionsWithText++;
  hasSkills=true;
 }
 const effects=(part.effects||[]).length;
 const status=(part.statusEffects||[]).length;
 const dynamic=(part.dynamicEffects||[]).length;
 total.nonSkillEffectRows+=effects;
 total.statusEffectRows+=status;
 total.dynamicEffectRows+=dynamic;
 if(effects||status||dynamic)hasEffects=true;
 for(const o of part.outcomes||[]){
  total.outcomes++;
  if(autoResult.test(o.label))total.outcomesWithGeneratedLabels++;
  else total.outcomesWithOtherLabels++;
  const nested=collectPart(o,total);
  hasSkills||=nested.skills;hasEffects||=nested.effects;
 }
 return {skills:hasSkills,effects:hasEffects};
}
function select(card){
 const choices={},outcomes={};
 for(const event of card.events||[]){
  if(event.type==='choice'){
   const ch=event.choices[0];
   choices[event.id]=ch.id;
   if(ch.outcomes?.length)outcomes[event.id]=ch.outcomes[0].id;
  }else if(event.outcomes?.length)outcomes[event.id]=event.outcomes[0].id;
 }
 return {stage:4,choices,outcomes};
}
function routeIdentity(card,config){
 return core.directRoutes(card,config).filter(x=>x.source==='event')
  .map(x=>({eventId:x.eventId,skillId:x.skillId,
   kind:x.kind||null,level:x.level??null,conditional:x.conditional}));
}
function independentlyLabelled(catalog,{retainTitles=false}={}){
 const safe=noRaw(catalog);
 for(const card of safe.cards)for(let i=0;i<card.events.length;i++){
  const e=card.events[i];
  if(!retainTitles)e.name='イベント '+String(i+1);
  if(e.type==='choice')for(let j=0;j<e.choices.length;j++){
   const ch=e.choices[j];
   ch.label='第'+(j+1)+'選択肢';
   for(let k=0;k<(ch.outcomes||[]).length;k++)
    ch.outcomes[k].label='結果'+(k+1);
  }else for(let k=0;k<(e.outcomes||[]).length;k++)
   e.outcomes[k].label='結果'+(k+1);
 }
 return safe;
}
function assess({catalog,model,skillText},{strict=true}={}){
 if(catalog?.schemaVersion!==1||!Array.isArray(catalog.cards)||
    !model?.cardById||typeof skillText!=='string')
  fail('入力・数値スキル辞書が不正');
 const original=sha(catalog),total=counters();
 const dataWithTitles=independentlyLabelled(catalog,{retainTitles:true});
 const onlyNumeric=independentlyLabelled(catalog);
 for(const c of catalog.cards){
  total.cards++;
  for(const e of c.events){
   total.events++;
   total.unsupportedAttributes+=attributes(e,allowedEvent,total);
   if(e.requires)total.eventsWithRequires++;
   const sourceTitle=!autoEvent.test(e.name);
   if(sourceTitle)total.eventsWithSourceStyleTitles++;
   else total.eventsWithGeneratedTitles++;
   if(e.type==='auto')total.autoEvents++;
   else if(e.type==='choice'){
    total.choiceEvents++;
    if(sourceTitle)total.sourceStyleEventTitlesOnChoiceEvents++;
   }else fail('イベント種類不正');
   let withSkills=false,withEffects=false,allChoiceLabelsGenerated=true;
   const parts=e.type==='choice'?e.choices:[e];
   for(const ch of parts){
    if(e.type==='choice'){
     total.choices++;
     const generated=autoChoice.test(ch.label);
     if(generated)total.choicesWithGeneratedLabels++;
     else{total.choicesWithOtherLabels++;allChoiceLabelsGenerated=false;}
     if(ch.rewards||ch.outcomes)total.choicesWithRewardsOrOutcomes++;
    }
    const r=collectPart(ch,total);
    withSkills||=r.skills;withEffects||=r.effects;
   }
   if(withSkills)total.eventsWithSkillRewards++;
   if(withEffects)total.eventsWithNonSkillEffect++;
   if(sourceTitle&&e.type==='choice'&&allChoiceLabelsGenerated)
    total.choiceEventsWithSourceStyleTitleAndGeneratedChoices++;
  }
 }
 if(total.events!==2512||total.cards!==563||
    total.autoEvents+total.choiceEvents!==total.events||
    total.choicesWithGeneratedLabels+total.choicesWithOtherLabels!==total.choices||
    total.outcomesWithGeneratedLabels+total.outcomesWithOtherLabels!==total.outcomes||
    total.choiceEventsWithSourceStyleTitleAndGeneratedChoices>total.choiceEvents)
  fail('固定563/2512件の分類前提が破綻');
 // All strings are replaced except the original event titles in the
 // title-retained scenario. This is a hypothetical technical projection,
 // NOT an authorization to publish either version.
 const scenarios=[
  {name:'numericOnly',catalog:onlyNumeric},
  {name:'shortTitleRetained',catalog:dataWithTitles}
 ];
 const simulated={};
 for(const scenario of scenarios){
  const modelBefore=sha(model);
  const projection=loader.preflight(model,scenario.catalog,{
   skillText,fullRegistry:false});
  if(projection.summary.eventsWithRecords!==2512)
   fail('非公開の表記置換で本番検証に失敗');
  const baselineModel=noRaw(model);baselineModel.cards=baselineModel.cards.map(c=>baselineModel.cardById[c.id]||c);
  const projectedModel=noRaw(model);projectedModel.cards=projectedModel.cards.map(c=>projectedModel.cardById[c.id]||c);
  loader.attach(baselineModel,catalog,{skillText,fullRegistry:false});
  loader.attach(projectedModel,scenario.catalog,{skillText,fullRegistry:false});
  let checkedCards=0,checkedEvents=0,checkedRouteStates=0;
  for(const c of baselineModel.cards){
   const replacement=projectedModel.cardById[c.id];
   if(!replacement||replacement.events.length!==c.events.length)
    fail('表記置換がイベント本体を欠落させた');
   checkedCards++;checkedEvents+=c.events.length;
   for(const cfg of [{stage:4,choices:{},outcomes:{}},select(c)]){
    if(sha(routeIdentity(c,cfg))!==sha(routeIdentity(replacement,cfg)))
     fail('出典の報酬・条件・選択経路を表記置換時に破損');
    checkedRouteStates++;
   }
  }
  if(sha(model)!==modelBefore||checkedCards!==563||checkedEvents!==2512)
   fail('元の監査モデルを変更した');
  simulated[scenario.name]={events:checkedEvents,cards:checkedCards,
   routeStatesChecked:checkedRouteStates,skillRoutesPreserved:true,
   userCanIdentifyEventsByName:scenario.name==='shortTitleRetained'?
     'source-title-available-but-reuse-not-cleared':'no',
   userCanMatchInGameChoiceWords:'no-source-dialogue-in-baseline'};
 }
 if(strict&&(!total.choiceEvents||!total.skillRewards||
   total.unsupportedAttributes>0))
  fail('未分類属性があります。属性名と件数='+JSON.stringify(total.unclassifiedFieldNames));
 // Never silently label unclassified content publishable.
 return {status:'PHASE2_2512_PUBLICATION_SURFACE_AUDITED',
  sourceCatalogSha256:original,total,simulated,
  contract:{sourceContentLogged:false,sourceDataPublished:false,
   copyrightDetermined:false,releaseApproved:false,
   labelReplacementIsOnlyTechnicalSimulation:true}};
}
module.exports={assess,independentlyLabelled};
