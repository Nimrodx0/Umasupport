'use strict';
/*
 * Phase 2 focused release-readiness worklist. Editorial fact adoption is NOT
 * route verification, permission, or publication approval. This deliberately
 * inventories 28 PRIORITY EVENT POSITIONS, not the 563-card denominator.
 *
 * No event titles/choice texts, no output public JSON, no approval booleans
 * set to true. Fail closed if any of the pinned editorial inputs drift.
 */
const {audit:auditFour}=require('./phase2_chain_manual_replay.cjs');
const {audit:auditSatono}=require('./phase2_30221_missing_chain_intake.cjs');
const {audit:auditTap}=require('./phase2_20075_first_stage_intake.cjs');
const {audit:auditJungle}=require('./phase2_30240_pending_chain_replay.cjs');
const {validate:reviewAnshin}=require('./phase2_30080_three_choice_repair.cjs');
const fourPart=require('../data/curation/adjudicated/30318-30320.v1.json');
const duramente=require('../data/curation/adjudicated/30321.v1.json');
const ledger=require('../data/curation/adjudicated_event_facts.v1.json');
const satono=require('../data/curation/adjudicated/30221_chain.v1.json');
const tap=require('../data/curation/adjudicated/20075_stage1.v1.json');
const jungle=require('../data/curation/adjudicated/30240_gamewith_gap.v1.json');
const anshin=require('../data/curation/adjudicated/30080_choice_repair.v1.json');
const {verifyRelease}=require('./event_release_gate.cjs');
const publicCatalog=require('../data/reviewed_events.v1.json');
const approvals=require('../config/event-release-approvals.v1.json');
const fail=m=>{throw Error('Phase2イベント公開受け入れ一覧: '+m);};
const COMMON=Object.freeze([
 'CURRENT_GAME_FACTS_NOT_CONFIRMED',
 'INDEPENDENT_PUBLIC_DISPLAY_NOT_REVIEWED',
 'PUBLICATION_BASIS_NOT_APPROVED',
 'EVENT_RELEASE_EVIDENCE_NOT_APPROVED'
]);
const ORDER=[
 'GAMEWITH_STAGE_NUMERIC_FACTS_MISSING',
 'CHAIN_CONTINUATION_AND_TERMINATION_UNVERIFIED',
 'CHOICE_RESULT_SEMANTICS_UNVERIFIED',
 'RANGE_REWARD_RESULT_SEMANTICS_UNVERIFIED',
 ...COMMON
];
const unique=a=>[...new Set(a)].sort((x,y)=>ORDER.indexOf(x)-ORDER.indexOf(y));
const freezeRow=(cardId,sourceOrdinal,kind,sourceStatus,urls,extra=[])=>{
 if(!/^[0-9]+$/.test(cardId)||!Number.isInteger(sourceOrdinal)||sourceOrdinal<1||
  !['CHAIN','RANDOM','SPECIAL'].includes(kind)||
  !['GAMEWITH_EDITORIAL_NUMERIC_ADOPTED','GAMEWITH_NUMERIC_FACTS_MISSING'].includes(sourceStatus)||
  !Array.isArray(urls)||urls.length===0||urls.some(x=>typeof x!=='string'||!x.startsWith('https://')))
  fail('位置・種類・根拠URL不正');
 const blockers=unique([...extra,...(kind==='CHAIN'?[
  'CHAIN_CONTINUATION_AND_TERMINATION_UNVERIFIED']:[]),...COMMON]);
 return {cardId,sourceOrdinal,kind,sourceStatus,evidenceUrls:[...new Set(urls)],
  blockers,releaseReady:false,publicationApproved:false};
};
function build(inputs={}){
 const {
  four=fourPart,ssr30321=duramente,centralLedger=ledger,
  ssr30221=satono,sr20075=tap,ssr30240=jungle,ssr30080=anshin,
  published=publicCatalog,releaseApprovals=approvals
 }=inputs;
 const existing=verifyRelease(published,releaseApprovals);
 const checked4=auditFour({remaining:four,duramente:ssr30321,ledger:centralLedger});
 const checkedSatono=auditSatono(ssr30221);
 const checkedTap=auditTap(sr20075);
 const checkedJungle=auditJungle(ssr30240);
 const checkedAnshin=reviewAnshin(ssr30080);
 if(checked4.evidence.length!==12||checked4.summary.unresolvedPossibleTransitions!==15||
  checkedSatono.summary.editoriallyAdoptedChainStages!==3||
  checkedTap.summary.gameWithAdoptedNumericEffectFacts!==2||
  checkedJungle.summary.gameWithAdoptedNumericStageFacts!==0||
  checkedAnshin.decision.editorialDecisionComplete!==true)
  fail('過去の個別監査結果と固定重点母数が一致しない');
 const rows=[];
 const ssrs=[...four.cards,ssr30321];
 for(const card of ssrs){
  if(!Array.isArray(card.events)||card.events.length!==5)fail('GT欠損4SSRのイベント数');
  for(const e of card.events){
   if(!['CHAIN','RANDOM'].includes(e.section)||e.ordinal<1)fail('SSR分類不正');
   rows.push(freezeRow(card.cardId,e.ordinal,e.section,
    'GAMEWITH_EDITORIAL_NUMERIC_ADOPTED',
    [card.gameToraWebsite.url,card.gameWith.url]));
  }
 }
 for(const e of ssr30221.events){
  rows.push(freezeRow('30221',e.chainStageOrdinal,'CHAIN',
   'GAMEWITH_EDITORIAL_NUMERIC_ADOPTED',
   [ssr30221.gameToraWebsite.url,ssr30221.gameWith.url]));
 }
 rows.push(freezeRow('20075',1,'CHAIN','GAMEWITH_EDITORIAL_NUMERIC_ADOPTED',
  [sr20075.gameToraWebsite.url,sr20075.gameWith.url,
   sr20075.otherOutcomeEvidence.sourceUrl],
  ['CHOICE_RESULT_SEMANTICS_UNVERIFIED']));
 for(const e of ssr30240.corroboration.reportedStages){
  rows.push(freezeRow('30240',e.ordinal,'CHAIN',
   'GAMEWITH_NUMERIC_FACTS_MISSING',
   [ssr30240.gameToraWebsite.url,ssr30240.gameWith.url,
    ssr30240.corroboration.url],
   ['GAMEWITH_STAGE_NUMERIC_FACTS_MISSING','CHOICE_RESULT_SEMANTICS_UNVERIFIED']));
 }
 rows.push(freezeRow('30080',6,'SPECIAL','GAMEWITH_EDITORIAL_NUMERIC_ADOPTED',
  [ssr30080.gameToraWebsite.url,ssr30080.gameWith.url,
   ssr30080.corroboratingArticle],
  ['RANGE_REWARD_RESULT_SEMANTICS_UNVERIFIED']));
 rows.sort((a,b)=>Number(a.cardId)-Number(b.cardId)||a.sourceOrdinal-b.sourceOrdinal);
 const seen=new Set();
 for(const row of rows){
  const key=row.cardId+':'+row.sourceOrdinal;
  if(seen.has(key))fail('イベント位置重複: '+key);
  seen.add(key);
 }
 const summary={
  trackedPriorityEventPositions:rows.length,
  trackedCards:new Set(rows.map(r=>r.cardId)).size,
  standaloneOrSpecialPositions:rows.filter(x=>x.kind!=='CHAIN').length,
  chainStagePositions:rows.filter(x=>x.kind==='CHAIN').length,
  gameWithNumericAdopted:rows.filter(x=>
   x.sourceStatus==='GAMEWITH_EDITORIAL_NUMERIC_ADOPTED').length,
  gameWithNumericUnresolved:rows.filter(x=>
   x.sourceStatus==='GAMEWITH_NUMERIC_FACTS_MISSING').length,
  releaseReadyPositions:rows.filter(x=>x.releaseReady).length,
  publicEventsAlreadyApproved:existing.publicEvents,
  userFacingEventScopeFullyVerified:false,
  all563CardsCoveredByThisWorklist:false
 };
 if(summary.trackedPriorityEventPositions!==28||summary.trackedCards!==8||
  summary.chainStagePositions!==19||summary.standaloneOrSpecialPositions!==9||
  summary.gameWithNumericAdopted!==25||summary.gameWithNumericUnresolved!==3||
  summary.releaseReadyPositions!==0)fail('28重点イベントの保存則が崩れました');
 return {schemaVersion:1,dataKind:'phase2-priority-release-readiness-not-approval',
  sourceRecordsNotRedistributed:true,noAutomaticRuntimeAdoption:true,
  approvalActionsPerformed:false,summary,rows};
}
module.exports={build,COMMON};
