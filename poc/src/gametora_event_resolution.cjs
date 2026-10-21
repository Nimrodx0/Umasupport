'use strict';
/* GameTora-derived events are the base, not a GameWith re-import.
 * Only genuinely flagged branch routes ask GameWith to adjudicate.
 * No third-party event/choice prose is emitted, no game/publication claims.
 */
const POLICY=require('../config/event-source-priority.v1.json');
const {flattenRoutes}=require('../tools/audit_gametora_branches.cjs');
const {validSourceUrl}=require('./event_source_precedence.cjs');
const fail=x=>{throw Error('GameTora基準経路: '+x);};
const valid=x=>Number.isSafeInteger(x)&&x>0;
const TYPES=new Set(['both_previous_chain_good','one_previous_chain_good',
 'both_previous_chain_bad','result_good','result_bad','result_average',
 'success','fail','branch_flag']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const key=(e,c,r)=>[e,c,r].join(':');
function inventory({document,revision=POLICY.baselineRevision,flaggedRoutes=[],gameWithDecisions=[]}){
 if(POLICY.schemaVersion!==2||POLICY.baselineSource!=='GameTora-derived'||
    POLICY.canonicalExceptionSource!=='GameWith'||POLICY.automaticPublicationAllowed!==false)
  fail('基準ソース設定が不一致');
 if(revision!==POLICY.baselineRevision||document?.kind!=='support'||!valid(document.id)||
    !Array.isArray(flaggedRoutes)||!Array.isArray(gameWithDecisions))
  fail('基準スナップショットか入力形式が不正');
 const events=document.events_ja&&Object.keys(document.events_ja).length?
   document.events_ja:document.events;
 if(!obj(events)||!Object.keys(events).length)fail('イベント一覧がありません');
 const source=Object.values(events);
 const chains=source.map((e,i)=>({e,sourceOrdinal:i+1})).filter(x=>x.e?.section==='arrows');
 const flagged=new Map(),reviewed=new Map();
 for(const f of flaggedRoutes){
  if(!obj(f)||!valid(f.sourceOrdinal)||!valid(f.choiceOrdinal)||!valid(f.routeOrdinal)||
     !['MISMATCH','AMBIGUOUS_BRANCH','SOURCE_INCOMPLETE','VERSION_CONFLICT'].includes(f.reason))
   fail('疑義位置が不正');
  const k=key(f.sourceOrdinal,f.choiceOrdinal,f.routeOrdinal);
  if(flagged.has(k))fail('疑義位置が重複');
  flagged.set(k,f.reason);
 }
 for(const d of gameWithDecisions){
  if(!obj(d)||!valid(d.sourceOrdinal)||!valid(d.choiceOrdinal)||!valid(d.routeOrdinal)||
     typeof d.terminal!=='boolean'||!validSourceUrl(d.url,'GameWith')||
     !/^sha256:[a-f0-9]{64}$/.test(d.articleSha256||'')||
     typeof d.reviewer!=='string'||!d.reviewer.trim()||
     !/^\d{4}-\d{2}-\d{2}$/.test(d.reviewedAt||'')||
     !Number.isFinite(Date.parse(d.reviewedAt+'T00:00:00Z')))
   fail('GameWith裁定の参照・選択位置が不正');
  const k=key(d.sourceOrdinal,d.choiceOrdinal,d.routeOrdinal);
  if(reviewed.has(k)||!flagged.has(k))fail('疑義のない経路をGameWithで置換できません');
  reviewed.set(k,d);
 }
 let normal=0,terminal=0,pending=0,adjudicated=0,tail=0,routeCount=0;
 const included=new Set(),stages=[];
 for(let i=0;i<chains.length;i++){
  const {e,sourceOrdinal}=chains[i],next=chains[i+1]?.sourceOrdinal||null;
  if(!Array.isArray(e.choices)||!e.choices.length)fail('連続イベントの選択肢が欠落');
  const routes=[];
  for(let ci=0;ci<e.choices.length;ci++){
   for(const [ri,route] of flattenRoutes(e.choices[ci]).entries()){
    const loc=key(sourceOrdinal,ci+1,ri+1);
    included.add(loc);
    const markers=[...route.effects.map(x=>x?.type),...route.when.map(x=>x?.kind)];
    if(markers.some(x=>typeof x!=='string'))fail('結果・条件構造が不正');
    const baseStop=markers.includes('chain_end');
    const baseProgression=baseStop?'terminal':next?'ordinary-continuation':'chain-final-stage';
    const issue=flagged.get(loc)||null,decision=reviewed.get(loc);
    let status=baseStop?'baseline-explicit-terminal':next?'baseline-ordinary-continuation':'baseline-final-stage';
    let selectedTerminal=baseStop;
    if(issue&&!decision){status='pending-gamewith-adjudication';selectedTerminal=null;pending++;}
    else if(decision){
     if(!next&&decision.terminal===false)fail('最終段階に後続候補なしで継続の裁定');
     selectedTerminal=decision.terminal;
     status='gamewith-adjudicated';adjudicated++;
    }else if(baseStop)terminal++;
    else if(next)normal++;
    else tail++;
    routeCount++;
    routes.push({sourceOrdinal,chainOrdinal:i+1,choiceOrdinal:ci+1,routeOrdinal:ri+1,
      baselineProgression:baseProgression,selectedTerminal,
      nextSourceOrdinalCandidate:selectedTerminal===true?null:next,
      adjacencyStatus:next?'SOURCE_ORDER_ONLY_NOT_GAME_VERIFIED':'NO_SOURCE_NEXT_STAGE',
      conditionMarkers:markers.filter(x=>TYPES.has(x)),
      conditionalSegment:route.when.length>0,
      issue,decisionStatus:status,
      ...(decision?{adjudication:{source:'GameWith',url:decision.url,
        articleSha256:decision.articleSha256,reviewedAt:decision.reviewedAt}}:{})});
   }
  }
  stages.push({sourceOrdinal,chainOrdinal:i+1,routeCount:routes.length,routes});
 }
 for(const k of [...flagged.keys(),...reviewed.keys()])if(!included.has(k))
  fail('疑義の位置が固定GameTora連続イベントに存在しません');
 return {schemaVersion:1,dataKind:'gametora-baseline-branch-decisions',
  cardId:String(document.id),sourceRevision:revision,source:'GameTora-derived',
  gameWithUsage:'flagged-issues-only',publicationApproved:false,gameVerified:false,
  sourceProseIncluded:false,sourceOrderAdjacencyVerified:false,
  stats:{stages:stages.length,routes:routeCount,baselineOrdinary:normal,
    baselineExplicitTerminal:terminal,baselineFinalStage:tail,
    pendingGameWith:pending,gameWithAdjudicated:adjudicated},
  stages};
}
module.exports={inventory};
