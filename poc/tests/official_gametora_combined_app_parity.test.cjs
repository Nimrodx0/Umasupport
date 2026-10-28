'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPinnedCardDraft}=require('../src/official_gametora_app_schema_parity.cjs');
const {buildPinnedEffectDraft}=require('../src/official_gametora_app_effects_parity.cjs');
const {combineActualAppDrafts,compareCombinedToOriginalSite}=require('../src/official_gametora_combined_app_parity.cjs');
const {compareConvertedCardToSite}=require('../src/official_gametora_existing_normalized_parity.cjs');
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
 const d=source(),skillDraft=buildPinnedCardDraft(d,skills());
 const effectDraft=buildPinnedEffectDraft(d);
 const groups=groupsFromSource(d);
 const joined=Array.from({length:5},(_,i)=>({
  historicalEventOrdinal:i+1,renderedEventPosition:i+1,
  sourceCategory:i<=1?'random':'arrows'
 }));
 const parity=compareConvertedCardToSite(skillDraft.normalized,joined,groups);
 const semantics=Array.from({length:5},(_,i)=>({
  historicalEventOrdinal:i+1,choiceCardinalityAgrees:true,
  alternativeOutcomeStructureAgrees:true,
  siteTerminalGroupOrdinals:i===3?[2]:[],
  explicitTerminalRouteCheck:{
   explicitTerminalRouteLocationVerified:i===3,
   routeEvidencePairCount:i===3?1:0
  }
 }));
 return {skillDraft,effectDraft,siteParity:parity,siteEventGroups:groups,siteChoiceSemantics:semantics};
}

test('two existing app projectors merge via actual production merger, retaining 5 hints and 31 effects on nine branches',()=>{
 const q=fixture();
 const combined=combineActualAppDrafts(q);
 assert.equal(combined.mergedEvents,5);
 assert.equal(combined.mergedNumericEffects,31);
 assert.equal(combined.unpublished,true);
 const joined=combined.mergedCatalog.cards[0].events;
 assert.equal(joined.length,5);
 assert.equal(joined[4].outcomes.length,2);
 assert.equal(joined[3].choices[1].terminal,true);
 assert.equal(joined[4].outcomes[0].rewards.length,1);
 assert.ok(joined[4].outcomes[0].effects.length>0);
 assert.deepEqual(joined[3].requires,{all:[{eventId:joined[2].id}]});
 const result=compareCombinedToOriginalSite(q);
 assert.equal(result.events,5);
 assert.equal(result.routes,9);
 assert.equal(result.hints,5);
 assert.equal(result.numericEffects,31);
 assert.equal(result.bondNumericEffects,8);
 assert.equal(result.sourceConfirmedTerminalRoutes,1);
 assert.equal(result.existingRequiresUnchangedCount,2);
 assert.equal(result.sameRouteSkillAndEffectParity,true);
 assert.equal(result.siteHasProvenFullChainReachability,false);
 assert.equal(result.fullApplicationJSONEquivalent,false);
 assert.equal(result.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(result),/転載禁止|男性向け/);
});
test('production merger rejects cross-route effect swap even if card-level totals are unchanged',()=>{
 const q=fixture();
 const card=q.effectDraft.isolatedAppCard.events;
 const a=card[0].choices[0],b=card[0].choices[1];
 const tmp=a.effects; a.effects=b.effects;b.effects=tmp;
 const combined=combineActualAppDrafts(q);
 assert.equal(combined.mergedNumericEffects,31);
 assert.throws(()=>compareCombinedToOriginalSite(q),/独立一致した二系統の投影証拠が不完全/);
});
test('missing result and inconsistent source terminal cannot be accepted by merger',()=>{
 const q=fixture();
 q.effectDraft.isolatedAppCard.events[4].outcomes.pop();
 assert.throws(()=>combineActualAppDrafts(q),/実結合ができない/);
 const q2=fixture();
 q2.effectDraft.isolatedAppCard.events[3].choices[1].terminal=false;
 assert.throws(()=>combineActualAppDrafts(q2),/実結合ができない/);
});
test('missing an existing app event or altering the exact original site numeric facts blocks certification',()=>{
 const q=fixture();
 q.skillDraft.appCard.events.pop();
 assert.throws(()=>combineActualAppDrafts(q),/5イベント投影が揃わない/);
 const q2=fixture();
 q2.siteEventGroups[0][0].effectTexts[0]='スピード +99';
 assert.throws(()=>compareCombinedToOriginalSite(q2),/独立一致した二系統の投影証拠が不完全/);
 const q3=fixture();
 q3.siteParity.events[0].routeLinks[1].renderedGroupOrdinal=1;
 assert.throws(()=>compareCombinedToOriginalSite(q3),/欠損|重複|元サイトのスキル/);
});
