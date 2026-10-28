'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPinnedCardDraft,comparePinnedAppDraftToOriginalSite}=
 require('../src/official_gametora_app_schema_parity.cjs');
const {compareConvertedCardToSite}=require('../src/official_gametora_existing_normalized_parity.cjs');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const defs={speed:'スピード',stamina:'スタミナ',power:'パワー',guts:'根性',
 wisdom:'賢さ',energy:'体力',mood:'やる気',bond:'友情ゲージ',
 skill_points:'スキルPt',skill_hint:'ヒントLv'};
function source(){
 const e=(name,section,choices)=>({name,section,choices});
 const fx=(type,value,skill_id)=>({type,value,...skill_id?{skill_id}:{}});
 return {kind:'support',id:30001,events_ja:{
  one:e('転載禁止A','random',[
   {label:'男性向けA',effects:[fx('skill_hint','+1',200762),fx('bond','+5')]},
   {label:'男性向けB',effects:[fx('guts','+10'),fx('bond','+5')]}]),
  two:e('転載禁止B','random',[
   {label:'男性向けC',effects:[fx('energy','+5'),fx('mood','+1'),fx('bond','+5')]},
   {label:'男性向けD',effects:[fx('energy','-5'),fx('stamina','+10'),
    fx('skill_points','+10'),fx('bond','+5')]}]),
  three:e('転載禁止C','arrows',[
   {label:'',effects:[fx('speed','+5'),fx('stamina','+5'),
    fx('skill_hint','+1',201142)]}]),
  four:e('転載禁止D','arrows',[
   {label:'男性向けE',effects:[fx('energy','+5'),fx('speed','+5'),
    fx('stamina','+5'),fx('guts','+5'),fx('mood','+1'),
    fx('skill_hint','+2',201342),fx('bond','+5')]},
   {label:'男性向けF',effects:[fx('energy','+5'),fx('wisdom','+5'),
    fx('bond','+5'),{type:'chain_end'}]}]),
  five:e('転載禁止E','arrows',[
   {label:'',random_either:true,outcomes:[
    [fx('energy','+10'),fx('speed','+5'),fx('stamina','+5'),
     fx('guts','+5'),fx('skill_hint','+1',200512),fx('bond','+5')],
    [fx('energy','+5'),fx('speed','+10'),fx('stamina','+10'),
     fx('guts','+10'),fx('skill_hint','+3',200511),fx('bond','+5')]
   ]}])
 }};
}
function skills(){
 const ids=['200762','201142','201342','200512','200511'];
 return JSON.stringify([
  ...ids.map((id,i)=>({id,name:'合成スキル'+i,rarity:'normal',group:20000+i})),
  ...Array.from({length:120},(_,i)=>({id:String(450000+i),
   name:'Other '+i,rarity:'normal',group:45000+i}))
 ]);
}
function groupsFromSource(d){
 const events=Object.values(d.events_ja);
 return events.map(ev=>ev.choices.flatMap(choice=>
  (choice.outcomes||[choice.effects]).map(effectList=>{
   const list=effectList.filter(x=>x.type!=='chain_end');
   return {
    effectTexts:list.map(x=>(defs[x.type]||'不明')+' '+x.value),
    hintLinks:list.filter(x=>x.type==='skill_hint').map(x=>({
     status:'unique-verified-name',numericId:String(x.skill_id),
     level:Number(x.value)
    }))
   };
  })
 ));
}
function fixture(){
 const d=source(),draft=buildPinnedCardDraft(d,skills());
 const groups=groupsFromSource(d);
 const joined=Array.from({length:5},(_,i)=>({
  historicalEventOrdinal:i+1,renderedEventPosition:i+1,
  sourceCategory:i<=1?'random':'arrows'
 }));
 const parity=compareConvertedCardToSite(draft.normalized,joined,groups);
 const semantics=Array.from({length:5},(_,i)=>({
  historicalEventOrdinal:i+1,choiceCardinalityAgrees:true,
  alternativeOutcomeStructureAgrees:true,
  siteTerminalGroupOrdinals:i===3?[2]:[],
  explicitTerminalRouteCheck:{
   explicitTerminalRouteLocationVerified:i===3,
   routeEvidencePairCount:i===3?1:0
  }
 }));
 return {draft,groups,parity,semantics};
}
test('existing real project() builds five runtime events and verifies 9 original-site skill route signatures',()=>{
 const {draft,groups,parity,semantics}=fixture();
 assert.equal(draft.projectedEventCount,5);
 assert.equal(draft.runtimeEventCount,5);
 assert.equal(parity.allFiveEventNumericProjectionsMatch,true);
 const r=comparePinnedAppDraftToOriginalSite({draft,siteParity:parity,
  siteEventGroups:groups,siteChoiceSemantics:semantics});
 assert.equal(r.eventsCompared,5);
 assert.equal(r.appEventsPresent,5);
 assert.equal(r.matchedSkillRoutes,9);
 assert.equal(r.siteHintRewards,5);
 assert.equal(r.matchedHintRewards,5);
 assert.equal(r.appSkillRouteParity,true);
 assert.equal(r.siteChoiceCardinalityConfirmed,true);
 assert.equal(r.websiteParsedBondDeltas,8);
 assert.equal(r.appTerminalRoutes,1);
 assert.equal(r.terminalRouteEvidenceEvents,1);
 assert.equal(r.draftEventsWithRequires,2);
 assert.equal(r.nonSkillAppEffectsParityVerified,false);
 assert.equal(r.fullAppJsonParityVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.equal(JSON.stringify(r).includes('男性向け'),false);
 assert.equal(JSON.stringify(r).includes('転載禁止'),false);
});
test('runtime skill reward ID and hint-level drift is blocked',()=>{
 const q=fixture();
 q.draft.appCard.events[0].choices[0].rewards[0].level=3;
 const r=comparePinnedAppDraftToOriginalSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups,siteChoiceSemantics:q.semantics});
 assert.equal(r.appSkillRouteParity,false);
 assert.equal(r.matchedSkillRoutes,8);
 const q2=fixture();
 q2.draft.appCard.events[0].choices[0].rewards[0].skillId='skill:200763';
 const mismatch=comparePinnedAppDraftToOriginalSite({draft:q2.draft,siteParity:q2.parity,
  siteEventGroups:q2.groups,siteChoiceSemantics:q2.semantics});
 assert.equal(mismatch.appSkillRouteParity,false);
});
test('app choice grouping, auto/OR outcomes and rejected source event cannot fake complete app parity',()=>{
 const q=fixture();
 q.draft.appCard.events[4].outcomes=[q.draft.appCard.events[4].outcomes[0]];
 const r=comparePinnedAppDraftToOriginalSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups,siteChoiceSemantics:q.semantics});
 assert.equal(r.appSkillRouteParity,false);
 assert.equal(r.matchedSkillRoutes,7);
 const q2=fixture();q2.draft.appCard.events.pop();
 const p=comparePinnedAppDraftToOriginalSite({draft:q2.draft,siteParity:q2.parity,
  siteEventGroups:q2.groups,siteChoiceSemantics:q2.semantics});
 assert.equal(p.appSkillRouteParity,false);
 assert.equal(p.appEventsPresent,4);
});
test('site-proven terminal position must match the runtime choice, not merely the event',()=>{
 const q=fixture();
 const wrong=q.draft.appCard.events[3].choices;
 delete wrong[1].terminal;
 wrong[0].terminal=true;
 const r=comparePinnedAppDraftToOriginalSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups,siteChoiceSemantics:q.semantics});
 assert.equal(r.appTerminalRoutes,1);
 assert.equal(r.terminalRouteEvidenceEvents,0);
 assert.equal(r.appTerminalFlagsFullyConfirmedBySite,false);
});
test('source site unobserved, ambiguous or partial route fact cannot pass',()=>{
 const q=fixture();
 q.parity.allFiveEventNumericProjectionsMatch=false;
 assert.throws(()=>comparePinnedAppDraftToOriginalSite({
  draft:q.draft,siteParity:q.parity,siteEventGroups:q.groups,
  siteChoiceSemantics:q.semantics}),/不足/);
 const q2=fixture();q2.parity.events[0].routeLinks[1].renderedGroupOrdinal=1;
 assert.throws(()=>comparePinnedAppDraftToOriginalSite({
  draft:q2.draft,siteParity:q2.parity,siteEventGroups:q2.groups,
  siteChoiceSemantics:q2.semantics}),/不正・重複/);
});
