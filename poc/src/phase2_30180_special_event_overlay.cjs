'use strict';
/*
 * Exactly one independently adjudicated missing special event on SSR30180.
 * It has a skill hint, not a player selection; calendar occurrence is OUTSIDE
 * application scope. This is an ephemeral nonpublishing 2512-candidate model.
 */
const crypto=require('node:crypto');
const schema=require('./event_schema.js');
const core=require('./core.js');
const E=require('../data/curation/adjudicated/30180_missing_special_hint.v1.json');
const fail=s=>{throw Error('Phase2 SSR30180イベント1件補完: '+s);};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function apply({integrated,priorities},{strict=false}={}){
 if(E.schemaVersion!==1||
    E.dataKind!=='phase2-card-30180-checker-only-gamewith-numeric-adjudication'||
    E.cardId!=='30180'||E.cardDisplayName!=='刻み続ける者たち'||
    E.cardEdition!=='この先も！'||
    E.gameTora?.url!=='https://gametora.com/ja/umamusume/supports/30180-group'||
    E.gameTora.fixedRevision!=='6e38b54af4fad397ff4491e63007a90705a4fe67'||
    E.gameWith?.url!=='https://gamewith.jp/uma-musume/article/show/431692'||
    E.gameWith.reportingStatus!=='EXPLICIT'||
    E.gameWith.eventShortTitle!=='あなたを想って'||
    E.gameWith.playerSelectableChoices!==0||
    E.gameWith.reportedSkillNumericId!==200332||
    E.gameWith.reportedSkillName!=='コーナー巧者○'||
    E.gameWith.reportedHintLevel!==1||
    E.gameWith.externalTiming!=='クラシック級1月前半'||
    E.checker?.sourceEventOrdinal!==7||
    E.checker.expectedMatchedNumericSkillId!==200332||
    E.checker.expectedHintLevel!==1||
    E.editorialDecision!=='ADOPT_GAMEWITH_EXPLICIT_MISSING_GT_EVENT_HINT'||
    E.eventId!=='usl:30180:special:checker-007'||
    E.type!=='auto'||E.availabilityKind!=='special-trigger'||
    E.externalOccurrenceModeled!==false||E.publicationApproved!==false||
    E.noAutomaticRuntimeAdoption!==true||
    E.sourceNarrativeOrChoiceProseIncluded!==false)
  fail('カードID・個別GT/GW事実・イベント選択数・数値スキルID/Lvが変更されました');
 if(integrated?.dataKind!=='phase2-2511-nonpublishing-gt-and-curated-chain-runtime'||
    integrated.publicationApproved!==false||
    integrated.reviewedEventsPublished!==0||
    integrated.noAutomaticRuntimeAdoption!==true||
    integrated.summary?.catalogSha256!==hash(integrated.catalog)||
    priorities?.dataKind!=='phase2-16-remaining-checker-skill-priority'||
    priorities.publicationApproved!==false||
    priorities.checkerCandidatesNotForSkillGrant!==true||
    priorities.summary?.openCheckerPositions!==16||
    priorities.summary?.P0!==1||
    priorities.summary?.absentNumericSkillIdPositions!==1||
    !Array.isArray(priorities.rows))
  fail('元2,511件またはChecker未対16位置の固定監査が不正');
 if(priorities.sourcePins?.checkerIndex!==E.checker.fixedRevision||
    priorities.sourcePins?.gameToraDerived!==E.gameTora.fixedRevision)
  fail('元GT/Checker固定版が裁定台帳と一致しません');
 const candidate=priorities.rows.filter(x=>x.priority==='P0');
 if(candidate.length!==1||candidate[0].cardId!=='30180'||
    candidate[0].checkerOrdinal!==7||
    candidate[0].candidateSkillIdsAbsentFromGTEventCatalog.length!==1||
    candidate[0].candidateSkillIdsAbsentFromGTEventCatalog[0]!=='200332'||
    candidate[0].unresolvedNameOnlyHintMentions!==0||
    candidate[0].manualResultReviewChoices!==0||
    candidate[0].unparsedHintChoices!==0)
  fail('当該Checker数値ID/選択結果と編集済みGameWithに不一致');
 const catalog=structuredClone(integrated.catalog);
 const cards=catalog.cards.filter(c=>c.cardId==='30180');
 if(cards.length!==1||!Array.isArray(cards[0].events))fail('SSR30180サポカ本体が未収録');
 const card=cards[0];
 if(card.events.some(e=>e.id===E.eventId||
    JSON.stringify(e).includes('"skill:200332"')))
  fail('SSR30180の同じイベントまたは数値スキルを二重に加算');
 const beforeCount=catalog.cards.reduce((n,c)=>n+c.events.length,0);
 const event={id:E.eventId,name:E.gameWith.eventShortTitle,
  type:'auto',availabilityKind:'special-trigger',
  rewards:[{skillId:'skill:200332',level:1,
   verifiedSkillName:E.gameWith.reportedSkillName}]};
 card.events.push(event);
 const counts=core.directRoutes({id:'30180',hints:[],events:[event]},
  {stage:4,choices:{},outcomes:{}})
  .filter(r=>r.source==='event');
 if(counts.length!==1||
    counts[0].skillId!=='skill:200332'||counts[0].level!==1||
    counts[0].eventId!==event.id)
  fail('特別イベントのスキル経路に1件のヒントLv1が存在しません');
 const allSkillIds=new Set();
 for(const c of catalog.cards)for(const e of c.events){
  const walk=p=>{
   if(!p)return;
   for(const rew of p.rewards||[])allSkillIds.add(rew.skillId);
   for(const outcome of p.outcomes||[])walk(outcome);
  };
  if(e.type==='choice')for(const ch of e.choices)walk(ch);
  else walk(e);
 }
 const fake={cards:catalog.cards.map(c=>({id:c.cardId})),
  cardById:Object.fromEntries(catalog.cards.map(c=>[c.cardId,{id:c.cardId}])),
  skillById:Object.fromEntries([...allSkillIds].map(id=>[id,{id}]))};
 const validated=schema.validateCatalog(catalog,fake);
 if(validated.eventsWithRecords!==beforeCount+1)
  fail('本番イベント形式の原2511＋1件が一致しません');
 if(strict&&(beforeCount!==2511||validated.eventsWithRecords!==2512||
    catalog.cards.length!==563))
  fail('全563サポカ2,512イベントの実固定保存則に不一致');
 return {
  dataKind:'phase2-2512-private-30180-special-hint-runtime',
  publicationApproved:false,reviewedEventsPublished:0,
  noAutomaticRuntimeAdoption:true,sourceNarrativeOrChoiceProseIncluded:false,
  catalog,
  summary:{
   cards:catalog.cards.length,unchangedSourceEvents:beforeCount,
   totalCandidateEvents:validated.eventsWithRecords,appendedSpecialEvents:1,
   appendedSkillHints:1,appendedChoiceRows:0,gameSpawnProbabilityModeled:false,
   appendedEventId:E.eventId,appendSkillNumericId:200332,
   inputCatalogSha256:integrated.summary.catalogSha256,
   outputCatalogSha256:hash(catalog),approvedEvents:0
  }
 };
}
module.exports={apply};
