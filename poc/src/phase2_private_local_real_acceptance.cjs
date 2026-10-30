'use strict';
/*
 * Exercise the REAL, existing final 2,512-event catalog through the EXACT
 * local-file preview verification and attachment code, on disposable models.
 * Only aggregate counts and cryptographic digests may leave this function.
 * Never persist the input catalog, copy it into a public checkout, or upload it.
 */
const crypto=require('node:crypto');
const live=require('./live_loader.js');
const publicCatalog=require('./public_event_catalog.js');
const preview=require('./private_local_event_preview.js');
const core=require('./core.js');
const sourcePolicy=require('../config/event-source-priority.v1.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('Phase2非公開2512件実データローカル読込監査: '+s);};
const EXPECTED={cards:563,events:2512};
function makeBundle(catalog){
 if(!catalog||catalog.schemaVersion!==1||
    !Array.isArray(catalog.cards)||catalog.cards.length!==EXPECTED.cards||
    catalog.cards.reduce((n,c)=>n+(Array.isArray(c.events)?c.events.length:NaN),0)!==
      EXPECTED.events||
    sourcePolicy.baselineRevision!==preview.PIN)
  fail('固定母数・出典コミットの一括生成条件が不正');
 return {schemaVersion:1,dataKind:preview.KIND,
  sourceRevision:sourcePolicy.baselineRevision,
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,sourceNarrativeOrChoiceProseIncluded:false,
  fullEventRewardOrChainCoverageVerified:false,sourceDatasetPublished:false,
  catalogSha256:hash(JSON.stringify(catalog)),
  summary:{...EXPECTED},catalog};
}
function selectedConfig(card){
 const choices={},outcomes={};
 for(const event of card.events){
  if(event.type==='choice'){
   const first=event.choices[0];
   choices[event.id]=first.id;
   if(Array.isArray(first.outcomes)&&first.outcomes.length)
    outcomes[event.id]=first.outcomes[0].id;
  }else if(Array.isArray(event.outcomes)&&event.outcomes.length)
   outcomes[event.id]=event.outcomes[0].id;
 }
 return {stage:4,choices,outcomes};
}
async function accept({catalog,model,skillText},{strict=true}={}){
 if(!model||!Array.isArray(model.cards)||model.cards.length!==EXPECTED.cards||
    typeof skillText!=='string'||!skillText.trim())
  fail('実UmaSimカードモデルまたは固定スキル辞書が不足');
 const bundle=makeBundle(catalog);
 const raw=JSON.stringify(bundle); // same bytes the local exporter saves
 const sourceBefore=hash(JSON.stringify(model));
 const fresh=JSON.parse(JSON.stringify(model));
 fresh.cards=fresh.cards.map(c=>fresh.cardById[c.id]||c);
 // Simulate the exact successful, EMPTY public JSON bootstrap of live.html.
 const empty=publicCatalog.attach(fresh,{schemaVersion:1,cards:[]},{
  skillText,fullRegistry:false});
 if(empty.eventsWithRecords!==0||fresh.meta.reviewedEventRecords!==0)
  fail('ローカル試用開始前に公開イベントが混入');
 fresh.meta.runtimeSources={events:{mode:'reviewed'}};
 const original=hash(JSON.stringify(fresh));
 const checked=await preview.verifyBundle(raw,fresh,skillText);
 if(checked.cards!==EXPECTED.cards||checked.events!==EXPECTED.events||
    checked.catalogSha256!==bundle.catalogSha256||
    hash(JSON.stringify(fresh))!==original)
  fail('実出典全件の読込前検証が原子性を満たさない');
 // Important: this IS the real browser local-file parser and attach logic,
 // not a second reimplementation of the event schema.
 const attached=await preview.activate(fresh,{text:raw,skillText});
 if(attached.records!==EXPECTED.events||attached.cards!==EXPECTED.cards||
    attached.publicationApproved!==false||
    fresh.meta.eventStatus!=='preview-only'||
    fresh.meta.reviewedEventRecords!==0||
    fresh.meta.runtimeSources.events.localOnly!==true)
  fail('実出典の未承認ローカル試用契約が破綻');
 const reference=JSON.parse(JSON.stringify(model));
 reference.cards=reference.cards.map(c=>reference.cardById[c.id]||c);
 const regular=publicCatalog.attach(reference,catalog,{skillText,fullRegistry:false});
 if(regular.eventsWithRecords!==EXPECTED.events)
  fail('基準ローダーで実出典全件を読み込めない');
 let compared=0,comparedEvents=0,selectedRoutes=0,baselineRoutes=0,
  testedSelectedHints=0,autoEvents=0,choiceEvents=0;
 for(const card of fresh.cards){
  const source=reference.cardById[card.id];
  if(!source||hash(JSON.stringify(card.events))!==hash(JSON.stringify(source.events)))
   fail('本番ローダーとローカル読込器のイベントが不一致（ID '+card.id+'）');
  compared++;comparedEvents+=card.events.length;
  for(const event of card.events){
   if(event.type==='auto')autoEvents++;
   else if(event.type==='choice')choiceEvents++;
  }
  const configs=[{stage:4,choices:{},outcomes:{}},selectedConfig(card)];
  for(const [index,config] of configs.entries()){
   const actual=core.directRoutes(card,config)
    .filter(x=>x.source==='event');
   const expected=core.directRoutes(source,config)
    .filter(x=>x.source==='event');
   if(hash(JSON.stringify(actual))!==hash(JSON.stringify(expected)))
    fail('実イベントの選択ルートが本番集計器と不一致（ID '+card.id+'）');
   if(index===0)baselineRoutes+=actual.length;
   else{
    selectedRoutes+=actual.length;
    testedSelectedHints+=actual.filter(x=>x.skillId).length;
   }
  }
 }
 if(compared!==EXPECTED.cards||comparedEvents!==EXPECTED.events||
    hash(JSON.stringify(model))!==sourceBefore||
    (strict&&(autoEvents<=0||choiceEvents<=0||
      selectedRoutes<=0||baselineRoutes<0||testedSelectedHints<=0)))
  fail('固定全件の件数・スキル経路・元モデル保存則が不正');
 // Check rejection against the REAL input content and preserve the good model.
 const corrupted={...bundle,catalogSha256:'0'.repeat(64)};
 const originalAfter=hash(JSON.stringify(fresh));
 let rejected=false;
 try{await preview.verifyBundle(JSON.stringify(corrupted),fresh,skillText);}
 catch(e){if(!/SHA-256/.test(String(e)))throw e;rejected=true;}
 if(!rejected||hash(JSON.stringify(fresh))!==originalAfter)
  fail('改ざんした実データSHAを拒否できない');
 return {status:'REAL_2512_PRIVATE_LOCAL_IMPORT_PASS',
  cards:compared,events:comparedEvents,autoEvents,choiceEvents,
  initialEventRoutes:baselineRoutes,selectedEventRoutes:selectedRoutes,
  selectedHintRoutes:testedSelectedHints,
  catalogSha256:bundle.catalogSha256,sourceRevision:bundle.sourceRevision,
  actualLocalFileParserUsed:true,allProductionRoutesEqual:true,
  corruptRealBundleRejected:true,inputUnchanged:true,
  publicationApproved:false,publicEventsPublished:0,
  privateEventCatalogSerializedToDisk:false};
}
module.exports={makeBundle,accept};
