'use strict';
/*
 * Turn a memory-only 2488-event GameTora projection into a METADATA-ONLY
 * publication review queue. No game prose, choice labels or skill descriptions
 * are serialized. Every event is pending; this tool NEVER signs a release.
 */
const {digest}=require('./event_release_gate.cjs');
const fail=s=>{throw Error('GameTora公開候補の未署名審査台帳: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const pos=(cardId,ordinal)=>cardId+':'+ordinal;
const REVIEW_FIELDS=Object.freeze([
 'card','event','choices','outcomes','dependencies','publication'
]);
const COMMON=Object.freeze([
 'PUBLIC_DISPLAY_NEEDS_REVIEW',
 'PUBLICATION_BASIS_NEEDS_REVIEW',
 'HUMAN_SIX_CATEGORY_APPROVAL_MISSING'
]);
function build({normalized,enriched,baselineReport,completeReport},{strict=false}={}){
 if(normalized?.dataKind!=='gametora-whole-event-numeric-candidate'||
    normalized.releaseApproved!==false||
    normalized.noEventCanPublishFromThisCandidate!==true||
    !Array.isArray(normalized.cards)||
    enriched?.publicationApproved!==false||
    enriched.noAutomaticRuntimeAdoption!==true||
    enriched.sourceChoiceOrOutcomeProseIncluded!==false||
    !Array.isArray(enriched.manifest)||
    !Array.isArray(enriched.catalog?.cards)||
    baselineReport?.dataKind!=='gametora-app-schema-dry-run'||
    baselineReport.publicationApproved!==false||
    completeReport?.dataKind!=='gametora-app-schema-dry-run'||
    completeReport.publicationApproved!==false||
    !Array.isArray(baselineReport.excludedSourcePositions)||
    !Array.isArray(completeReport.excludedSourcePositions))
  fail('未承認・非公開の正規化、見出し結合、両版の投影監査が必要');
 if(!obj(normalized.sourcePins)||
    !/^[a-f0-9]{40}$/.test(normalized.sourcePins.gameToraDerived)||
    !/^[a-f0-9]{40}$/.test(normalized.sourcePins.checkerIndex))
  fail('固定GTとCheckerのソース版が不正');
 const source=new Map(),projected=new Map(),manifests=new Map(),
  baselineBlocked=new Map(),completeBlocked=new Map();
 let absentCards=0,sourceCards=0;
 for(const card of normalized.cards){
  if(!/^\d{5}$/.test(card.cardId)||!Array.isArray(card.events))
   fail('元カードID・イベント一覧が不正');
  if(card.sourceMissing===true){
   if(card.events.length)fail('ソース欠損カードにイベントを創作');
   absentCards++;continue;
  }
  sourceCards++;
  for(const e of card.events){
   const key=pos(card.cardId,e.sourceOrdinal);
   if(source.has(key)||!Number.isInteger(e.sourceOrdinal)||e.sourceOrdinal<1||
      e.eventId!=='gt-'+card.cardId+'-event-'+String(e.sourceOrdinal).padStart(3,'0')||
      !/^sha256:[0-9a-f]{64}$/.test(e.sourceTitleFingerprint||'')||
      !Array.isArray(e.choices)||!Array.isArray(e.reviewReasons))
    fail('元イベント位置・識別子・見出しSHA・構造が不正: '+key);
   source.set(key,{cardId:card.cardId,...e});
  }
 }
 for(const card of enriched.catalog.cards){
  if(!/^\d{5}$/.test(card.cardId)||!Array.isArray(card.events))
   fail('投影カードが不正');
  for(const e of card.events){
   const key=JSON.stringify([card.cardId,e.id]);
   if(projected.has(key))fail('投影イベントの重複');
   projected.set(key,e);
  }
 }
 for(const m of enriched.manifest){
  if(!obj(m)||!/^\d{5}$/.test(m.cardId)||
    !Number.isInteger(m.sourceOrdinal)||m.sourceOrdinal<1||
    !/^sha256:[0-9a-f]{64}$/.test(m.sourceHeadingSha256||'')||
    !/^[a-f0-9]{64}$/.test(m.eventSha256||'')||
    !['SHORT_HEADING_JOINED_NOT_APPROVED','HEADING_NEEDS_REVIEW'].includes(m.status))
   fail('元見出しの審査索引が不正');
  const key=pos(m.cardId,m.sourceOrdinal);
  if(manifests.has(key))fail('公開索引内のイベント位置重複');
  manifests.set(key,m);
 }
 const registerBlockers=(rows,map,label)=>{
  for(const entry of rows){
   if(!obj(entry)||!/^\d{5}$/.test(entry.cardId)||
      !Number.isInteger(entry.sourceOrdinal)||entry.sourceOrdinal<1||
      typeof entry.reason!=='string'||!entry.reason)
    fail(label+'の除外位置・原因が不正');
   const key=pos(entry.cardId,entry.sourceOrdinal);
   if(map.has(key)||!source.has(key)||entry.eventId!==source.get(key).eventId)
    fail(label+'の除外位置がソースと不一致');
   map.set(key,entry.reason);
  }
 };
 registerBlockers(baselineReport.excludedSourcePositions,baselineBlocked,'固定UmaSim');
 registerBlockers(completeReport.excludedSourcePositions,completeBlocked,'補完後');
 if(completeBlocked.size||completeReport.totals?.skippedEvents!==0)
  fail('補完後カタログに未投影のイベントが残る');
 if(baselineBlocked.size!==baselineReport.totals?.skippedEvents)
  fail('固定UmaSim時の除外件数不一致');
 if(source.size!==normalized.totals?.sourceEvents||
    sourceCards!==normalized.totals?.baselineCards||
    absentCards!==normalized.totals?.missingBaselineCards||
    source.size!==enriched.manifest.length||
    projected.size!==source.size||
    projected.size!==completeReport.totals?.candidateSchemaEvents)
  fail('元／補完後／見出しのイベント全件一致が成立しない');
 const rows=[];
 const categories={reviewMarkedEvents:0,baselineBlockedEvents:0,normalSourceEvents:0,
  headingsPending:0};
 for(const [key,e] of source){
  const m=manifests.get(key),event=projected.get(JSON.stringify([e.cardId,e.eventId]));
  if(!m||!event||m.eventId!==e.eventId||
     m.sourceHeadingSha256!==e.sourceTitleFingerprint||
     m.eventSha256!==digest(event)||
     m.status==='SHORT_HEADING_JOINED_NOT_APPROVED'&&
       (!event.name||/^イベント\d{3}（仮）$/.test(event.name)))
   fail('イベント位置・見出し・イベントSHAが一致しない: '+key);
  const codes=new Set();
  if(m.status==='HEADING_NEEDS_REVIEW'){
   codes.add('SOURCE_HEADING_NEEDS_REVIEW');categories.headingsPending++;
  }
  if(e.reviewReasons.length){
   codes.add('SOURCE_BRANCH_OR_EFFECT_NEEDS_REVIEW');categories.reviewMarkedEvents++;
  }
  const blocked=baselineBlocked.get(key);
  if(blocked){
   codes.add('BASELINE_SKILL_REGISTRY_GAP');categories.baselineBlockedEvents++;
  }
  if(!codes.size)categories.normalSourceEvents++;
  const sourceReasonCodes=[...new Set(e.reviewReasons)];
  if(sourceReasonCodes.some(x=>typeof x!=='string'||!x||
     !/^[A-Z][A-Z0-9_]*$/.test(x)))fail('元ソースのレビューマーカーが不正');
  rows.push({
   cardId:e.cardId,eventId:e.eventId,sourceOrdinal:e.sourceOrdinal,
   sourceSection:e.section,
   sourceHeadingSha256:e.sourceTitleFingerprint,
   eventSha256:m.eventSha256,
   status:'PENDING_HUMAN_PUBLICATION_REVIEW',
   sourceReasonCodes:sourceReasonCodes.sort(),
   baselineExclusionReason:blocked||null,
   blockers:[...codes].sort().concat(COMMON),
   // A source match is neither publication rights nor human judgment.
   releaseApproved:false
  });
 }
 if(rows.length!==manifests.size||
    categories.normalSourceEvents+categories.reviewMarkedEvents+
      categories.baselineBlockedEvents+categories.headingsPending<rows.length)
  // The four categories overlap; the inequality checks missing classification
  // but normal + flagged sets must still cover all positions.
  fail('イベントのレビュー分類不一致');
 if(strict&&(normalized.cards.length!==563||sourceCards!==559||
    absentCards!==4||rows.length!==2488||baselineBlocked.size!==110||
    enriched.summary?.shortTitlesJoined!==2488||
    enriched.summary?.shortTitlesNeedsReview!==0||
    completeReport.totals?.candidateChoiceEvents!==1595||
    completeReport.totals?.candidateAutoEvents!==893))
  fail('固定GT母集団、補完・保留件数の全件条件と不一致');
 return {
  schemaVersion:1,dataKind:'gametora-2488-unsigned-publication-review-queue',
  sourcePins:structuredClone(normalized.sourcePins),
  sourceNarrativeOrChoiceProseIncluded:false,
  publicCatalogWritten:false,automaticallyReleaseApproved:false,
  allHumanApprovalFieldsIntentionallyAbsent:true,
  humanReviewCategories:[...REVIEW_FIELDS],
  summary:{sourceCards,missingSourceCards:absentCards,events:rows.length,
   baselineMissingSkillProjection:baselineBlocked.size,...categories,
   awaitingHumanPublicationReview:rows.length,approvedEvents:0},
  rows
 };
}
module.exports={build,REVIEW_FIELDS,COMMON};
