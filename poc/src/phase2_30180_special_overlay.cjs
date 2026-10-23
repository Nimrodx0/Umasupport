'use strict';
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const core=require('./core.js');
const E=require('../data/curation/adjudicated/30180_special_cornering.v1.json');
const fail=s=>{throw Error('30180獲得可能コーナー巧者補修: '+s);};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function apply({integrated,priority},{strict=false}={}){
 if(integrated?.dataKind!=='phase2-2511-nonpublishing-gt-and-curated-chain-runtime'||
    integrated.publicationApproved!==false||
    integrated.noAutomaticRuntimeAdoption!==true||
    integrated.reviewedEventsPublished!==0||
    integrated.summary?.catalogSha256!==hash(integrated.catalog)||
    priority?.dataKind!=='phase2-16-remaining-checker-skill-priority'||
    priority.publicationApproved!==false||
    priority.summary?.P0!==1||
    !Array.isArray(priority.rows)||
    E.schemaVersion!==1||
    E.dataKind!=='phase2-30180-adjudicated-extra-special-event'||
    E.cardId!=='30180'||E.cardIdentity!=='刻み続ける者たち'||
    E.eventTitle!=='あなたを想って'||
    E.eventId!=='usl:30180:special:checker-007'||
    E.checkerOrdinal!==7||
    E.skillNumericId!=='200332'||E.hintLevel!==1||
    !['コーナー巧者○','コーナー巧者◯'].includes(E.skillDisplayName)||
    E.choiceCount!==0||E.availabilityKind!=='special-trigger'||
    E.scope!=='CLASSIC_EARLY_JANUARY'||
    E.gameWithUrl!=='https://gamewith.jp/uma-musume/article/show/431692'||
    E.gameToraUrl!=='https://gametora.com/ja/umamusume/supports/30180-group'||
    E.sourceNarrativeOrChoiceProseIncluded!==false||
    E.publicationApproved!==false||E.automaticPublicAdoption!==false)
  fail('固定の編集事実／公開ゲートが不一致');
 const p0=priority.rows.filter(x=>x.priority==='P0');
 if(p0.length!==1||p0[0].cardId!=='30180'||p0[0].checkerOrdinal!==7||
    !p0[0].candidateSkillIdsAbsentFromGTEventCatalog?.includes(E.skillNumericId)||
    p0[0].publicationApproved!==false||
    p0[0].missingActualEventVerified!==false)
  fail('Checkerの元P0スキル差異の同一性が不正');
 const catalog=structuredClone(integrated.catalog);
 const card=catalog.cards.find(c=>c.cardId===E.cardId);
 if(!card||!Array.isArray(card.events)||
    card.events.some(e=>e.id===E.eventId||e.name===E.eventTitle))
  fail('同カードに重複する補修イベント');
 const sourceHashes=new Map(integrated.catalog.cards.map(c=>[c.cardId,hash(c.events)]));
 const event={id:E.eventId,name:E.eventTitle,type:'auto',
  availabilityKind:E.availabilityKind,
  rewards:[{skillId:'skill:'+E.skillNumericId,level:E.hintLevel,
   verifiedSkillName:E.skillDisplayName}]};
 card.events.push(event);
 for(const c of catalog.cards){
  const before=integrated.catalog.cards.find(x=>x.cardId===c.cardId);
  if(!before||hash(c.events.slice(0,before.events.length))!==sourceHashes.get(c.cardId))
   fail('元2511イベントの順序・内容を改変');
 }
 const skills=new Set();
 for(const c of catalog.cards)for(const e of c.events)
  for(const part of e.type==='choice'?e.choices:[e])
   for(const result of part.outcomes||[part])
    for(const reward of result.rewards||[])skills.add(reward.skillId);
 const model={cards:catalog.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(catalog.cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries([...skills].map(id=>[id,{id}]))};
 const v=schema.validateCatalog(catalog,model);
 const actual=core.directRoutes({id:card.cardId,hints:[],events:card.events},
  {stage:4,choices:{},outcomes:{}}).filter(x=>x.eventId===event.id);
 if(actual.length!==1||actual[0].skillId!=='skill:200332'||
    actual[0].level!==1)
  fail('スキル獲得経路が本番コアと一致しない');
 if(v.eventsWithRecords!==integrated.summary.totalCandidateEvents+1)
  fail('イベントを1件だけ追加できません');
 if(strict&&(v.cardsWithRecords!==563||v.eventsWithRecords!==2512))
  fail('固定563カード2512件の全件保存則不一致');
 return {dataKind:'phase2-2512-nonpublishing-with-30180-special-hint',
  publicationApproved:false,noAutomaticRuntimeAdoption:true,
  reviewedEventsPublished:0,sourceNarrativeOrChoiceProseIncluded:false,
  catalog,summary:{rosterCards:v.cardsWithRecords,
   previousEvents:integrated.summary.totalCandidateEvents,
   totalCandidateEvents:v.eventsWithRecords,
   appendedEventId:E.eventId,appendedHintNumericId:E.skillNumericId,
   appendedHintLevel:1,availabilityKind:event.availabilityKind,
   originalCatalogSha256:integrated.summary.catalogSha256,
   catalogSha256:hash(catalog),publishedEvents:0}};
}
module.exports={apply};
