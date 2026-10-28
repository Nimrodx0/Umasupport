'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildPinnedEffectDraft,comparePinnedEffectsToSite}=
 require('../src/official_gametora_app_effects_parity.cjs');
const labels={speed:'スピード',guts:'根性',energy:'体力',stamina:'スタミナ',
 power:'パワー',wisdom:'賢さ',bond:'友情ゲージ'};
const effect=(type,value,char_id)=>({type,value,...char_id?{char_id}:{}});
function original(){
 return {kind:'support',id:30001,events_ja:{
  first:{name:'非公開一',section:'random',choices:[
   {label:'一',effects:[effect('speed','+10'),effect('bond','+5',1001)]},
   {label:'二',effects:[effect('guts','+10'),effect('bond','+5',1001)]}]},
  second:{name:'非公開二',section:'random',choices:[
   {label:'三',effects:[effect('energy','+5')]},
   {label:'四',effects:[effect('stamina','-10')]}]},
  third:{name:'非公開三',section:'arrows',choices:[
   {label:'',effects:[effect('speed','+5')]}]},
  fourth:{name:'非公開四',section:'arrows',choices:[
   {label:'五',effects:[effect('energy','+10')]},
   {label:'六',effects:[effect('guts','+3'),{type:'chain_end'}]}]},
  last:{name:'非公開五',section:'arrows',choices:[
   {label:'',random_either:true,outcomes:[
    [effect('bond','+5',1001)],
    [effect('energy','+5')]
   ]}]}
 }};
}
function site(d){
 return Object.values(d.events_ja).map(e=>
  e.choices.flatMap(c=>(c.outcomes||[c.effects]).map(effects=>({
   effectTexts:effects.filter(x=>x.type!=='chain_end')
    .map(e=>(labels[e.type]||'不明')+' '+e.value),
   hintLinks:[]
  }))));
}
const links=e=>e.choices.flatMap((c,i)=>
 (c.outcomes||[c.effects]).map((_,j)=>({sourceChoiceOrdinal:i+1,
 sourceOutcomeOrdinal:j+1,renderedGroupOrdinal:0})))
 .map((r,i)=>({...r,renderedGroupOrdinal:i+1}));
function fixture(){
 const document=original(),draft=buildPinnedEffectDraft(document);
 const groups=site(document);
 const parity={cardId:'30001',allFiveEventNumericProjectionsMatch:true,
  sourceRouteCount:9,siteRouteCount:9,events:
  Object.values(document.events_ja).map((e,i)=>({
   sourceOrdinal:i+1,displayedEventOrdinal:i+1,renderedRouteCount:links(e).length,
   routeLinks:links(e)
  }))};
 return {draft,groups,parity};
}
test('existing real isolated app effects model preserves five old events and all nine numeric routes',()=>{
 const {draft,groups,parity}=fixture();
 assert.equal(draft.sourceRouteCount,9);
 assert.equal(draft.eligibleEffectEventCount,5);
 assert.equal(draft.blockedSourceEvents,0);
 const r=comparePinnedEffectsToSite({draft,siteParity:parity,siteEventGroups:groups});
 assert.equal(r.appEffectEvents,5);
 assert.equal(r.matchedEvents,5);
 assert.equal(r.matchedEffectRoutes,9);
 assert.equal(r.appEffectCount,r.siteEffectCount);
 assert.equal(r.siteBondEffectCount,3);
 assert.equal(r.appBondEffectCount,3);
 assert.equal(r.numberOfAppRecipientIdsNotVerifiedBySite,3);
 assert.equal(r.allRenderedNonSkillNumericEffectsMatch,true);
 assert.equal(r.recipientCharIdSourceSiteVerified,false);
 assert.equal(r.fullCombinedAppEventJsonVerified,false);
 assert.equal(r.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(r),/非公開一|非公開五/);
});
test('site bond value cannot be silently borrowed from old DB or overwritten by app payload',()=>{
 const q=fixture();
 q.groups[0][0].effectTexts[1]='友情ゲージ +4';
 const r=comparePinnedEffectsToSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups});
 assert.equal(r.allRenderedNonSkillNumericEffectsMatch,false);
 assert.equal(r.matchedEffectRoutes,8);
});
test('one missing random OR result or one excluded source event never passes',()=>{
 const q=fixture();
 q.draft.isolatedAppCard.events[4].outcomes.pop();
 const r=comparePinnedEffectsToSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups});
 assert.equal(r.allRenderedNonSkillNumericEffectsMatch,false);
 assert.equal(r.matchedEffectRoutes,8);
 const q2=fixture();
 q2.draft.isolatedAppCard.events.splice(3,1);
 const r2=comparePinnedEffectsToSite({draft:q2.draft,siteParity:q2.parity,
  siteEventGroups:q2.groups});
 assert.equal(r2.missingEventProjections,1);
 assert.equal(r2.allRenderedNonSkillNumericEffectsMatch,false);
});
test('site proof missing, mismatched card or out-of-range route location is rejected',()=>{
 const q=fixture();q.parity.allFiveEventNumericProjectionsMatch=false;
 assert.throws(()=>comparePinnedEffectsToSite({draft:q.draft,siteParity:q.parity,
  siteEventGroups:q.groups}),/不足/);
 const q2=fixture();q2.parity.events[0].routeLinks[0].renderedGroupOrdinal=100;
 assert.throws(()=>comparePinnedEffectsToSite({draft:q2.draft,siteParity:q2.parity,
  siteEventGroups:q2.groups}),/不正/);
});
