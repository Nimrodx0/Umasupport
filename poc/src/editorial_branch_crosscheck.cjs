'use strict';
/*
 * Deliberately offline editorial corroboration. The source sites may share
 * underlying data; two publishers are corroboration, not proof of the live game.
 * No output may be sent to public_event_catalog without the separate release gate.
 */
const {validate:validateCandidates}=require('./checker_candidate_database.cjs');
const {verifyDerived}=require('./checker_explicit_result_extract.cjs');
const {validateEvents}=require('./event_schema.js');
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function fail(msg){throw Error('独立経路レビュー: '+msg);}
const routeKey=r=>[r.choiceOrdinal,r.resultKind].join(':');
function validate({candidate,facts,audit,p0Queue}){
 validateCandidates(candidate);
 verifyDerived(candidate,facts);
 if(!obj(audit)||audit.schemaVersion!==1||audit.dataKind!=='umasupport-editorial-branch-crosscheck'||
  audit.publicationApproval!==false||audit.actualGamePlayVerified!==false||
  audit.sourceStatus!=='TWO_PUBLISHER_WEB_CORROBORATION_NOT_AUTHORITATIVE_GAME_MASTER'||
  audit.pins?.checkerRevision!==facts.sourcePins.checkerRevision||
  audit.pins?.checkerSha256!==facts.sourcePins.checkerSha256||
  !Array.isArray(audit.cards)||p0Queue?.dataKind!=='umasupport-result-review-queue'||
  p0Queue.forSkillGrant!==false||!Array.isArray(p0Queue.rows))
   fail('未承認の独立照合データに限定します');
 const cards=new Map(facts.cards.map(c=>[c.cardId,c]));
 const p0=new Set(p0Queue.rows.filter(e=>e.priority==='P0').map(e=>e.sourceKey));
 const seenCards=new Set(),counters={cards:0,transitionEvents:0,transitionBranches:0,awardChecks:0,unresolvedDifferences:0};
 for(const c of audit.cards){
  if(!obj(c)||!/^\d{5}$/.test(c.cardId)||seenCards.has(c.cardId)||c.sourceCoverage!=='selected-chain-stages-only'||
   !Array.isArray(c.crossPublisherSources)||!Array.isArray(c.transitionStages)||
   !Array.isArray(c.awardChecks)||!Array.isArray(c.unresolvedDifferences))
   fail('カードの基本情報・レビュー対象が不正');
  seenCards.add(c.cardId);counters.cards++;
  const ref=cards.get(c.cardId);
  if(!ref)fail('元Checkerカードに存在しない');
  const distinct=new Set();
  for(const s of c.crossPublisherSources){
   if(!obj(s)||!['Game8','U-tools','GameWith'].includes(s.publisher)||
    typeof s.url!=='string'||!s.url.startsWith('https://')||
    s.url.includes('github.com')||distinct.has(s.publisher))fail('二次資料の出典が不正');
   distinct.add(s.publisher);
  }
  if(distinct.size<2)fail('複数出版社の照合が必要');
  const reviewed=new Set();
  for(const stage of c.transitionStages){
   if(!obj(stage)||!Number.isInteger(stage.eventOrdinal)||stage.eventOrdinal<1||
    reviewed.has(stage.eventOrdinal)||stage.branchCoverage!=='all-observed-option-result-positions'||
    !Array.isArray(stage.branches)||!stage.branches.length)fail('レビュー対象段階が不正');
   reviewed.add(stage.eventOrdinal);counters.transitionEvents++;
   const source=ref.events.find(e=>e.sourceEventOrdinal===stage.eventOrdinal);
   if(!source||source.sourceKey!==stage.sourceKey||source.sourceDigest!==stage.sourceDigest||
    !p0.has(source.sourceKey))fail('監査対象はP0の出典指紋固定イベントのみ');
   const combinations=new Set();
   for(const branch of stage.branches){
    if(!obj(branch)||!Number.isInteger(branch.choiceOrdinal)||
     !['success','failure','great','normal','unspecified'].includes(branch.resultKind)||
     typeof branch.terminal!=='boolean'||
     branch.terminal&&branch.nextEventOrdinal!==undefined||
     !branch.terminal&&branch.nextEventOrdinal!==stage.eventOrdinal+1)
      fail('到達・打ち切りの条件または遷移先が不正');
    const key=routeKey(branch);
    if(combinations.has(key))fail('結果条件を重複登録できません');
    combinations.add(key);counters.transitionBranches++;
    const sourceChoice=source.choices.find(x=>x.ordinal===branch.choiceOrdinal);
    if(!sourceChoice||!sourceChoice.results.some(x=>x.resultKind===branch.resultKind))
     fail('実在しない選択肢／結果に分岐を割り当てられません');
    if(!branch.terminal&&!ref.events.some(e=>e.sourceEventOrdinal===branch.nextEventOrdinal))
     fail('次段階の候補が存在しません');
   }
   const required=source.choices.flatMap(ch=>ch.results.map(r=>
    routeKey({choiceOrdinal:ch.ordinal,resultKind:r.resultKind})));
   if(required.length!==combinations.size||required.some(k=>!combinations.has(k)))
     fail('選択肢×結果の網羅なしに経路を確定できません');
  }
  const seenRewards=new Set();
  for(const reward of c.awardChecks){
   if(!obj(reward)||!Number.isInteger(reward.eventOrdinal)||!Number.isInteger(reward.choiceOrdinal)||
    !/^\d+$/.test(reward.skillId)||!Number.isInteger(reward.level)||reward.level<1||
    !['success','failure','great','normal','unspecified'].includes(reward.resultKind))
    fail('スキル照合ファクトの形式が不正');
   const id=[reward.eventOrdinal,reward.choiceOrdinal,reward.resultKind,reward.skillId].join(':');
   if(seenRewards.has(id))fail('スキル照合ファクト重複');
   seenRewards.add(id);counters.awardChecks++;
   const event=ref.events.find(e=>e.sourceEventOrdinal===reward.eventOrdinal);
   if(!event||event.sourceKey!==reward.sourceKey||event.sourceDigest!==reward.sourceDigest||
    !event.choices.find(ch=>ch.ordinal===reward.choiceOrdinal)?.results
     .find(r=>r.resultKind===reward.resultKind)?.skillHints
     .some(h=>h.skillId===reward.skillId&&h.level===reward.level))
     fail('数値IDまたはLvが固定Checkerの結果からずれています');
  }
  const seenIssues=new Set();
  for(const issue of c.unresolvedDifferences){
   const event=ref.events.find(x=>x.sourceEventOrdinal===issue.eventOrdinal);
   if(!event||!event.choices.some(x=>x.ordinal===issue.choiceOrdinal)||
    !['SOURCE_EFFECT_VARIANCE','HINT_LEVEL_CONFLICT'].includes(issue.kind)||
    typeof issue.note!=='string'||issue.note.length>240||
    seenIssues.has(issue.eventOrdinal+':'+issue.choiceOrdinal))
    fail('資料間の未解決差異が不正');
   seenIssues.add(issue.eventOrdinal+':'+issue.choiceOrdinal);counters.unresolvedDifferences++;
   if(c.awardChecks.some(a=>a.eventOrdinal===issue.eventOrdinal&&a.choiceOrdinal===issue.choiceOrdinal))
    fail('資料間で割れた選択肢のヒントを承認できません');
  }
 }
 for(const [name,val] of Object.entries(counters))if(audit.stats?.[name]!==val)fail('全件レビュー件数の一致に失敗: '+name);
 return counters;
}
function auditFixture({candidate,facts,audit,p0Queue},cardId){
 validate({candidate,facts,audit,p0Queue});
 const c=audit.cards.find(c=>c.cardId===cardId);
 if(!c)fail('対象カードが未監査');
 const f=facts.cards.find(x=>x.cardId===cardId);
 const included=new Set();
 for(const stage of c.transitionStages){
  included.add(stage.eventOrdinal);
  for(const branch of stage.branches)if(!branch.terminal)included.add(branch.nextEventOrdinal);
 }
 for(const award of c.awardChecks)included.add(award.eventOrdinal);
 const ordinals=[...included].sort((a,b)=>a-b);
 const byOrdinal=new Map();
 const allowedSkills=new Map();
 for(const aw of c.awardChecks){
  const key=[aw.eventOrdinal,aw.choiceOrdinal,aw.resultKind].join(':');
  const a=allowedSkills.get(key)||[];
  a.push({skillId:aw.skillId,level:aw.level});allowedSkills.set(key,a);
 }
 for(const ordinal of ordinals){
  const e=f.events.find(x=>x.sourceEventOrdinal===ordinal);
  if(!e)fail('監査段階の根拠データが欠落');
  const name='連続'+ordinal;
  const review=c.transitionStages.find(x=>x.eventOrdinal===ordinal);
  const opt=x=>{
   const branches=review?.branches.filter(b=>b.choiceOrdinal===x.ordinal)||[];
   const outcomes=x.results.length>1?x.results.map(r=>{
    const br=branches.find(b=>b.resultKind===r.resultKind);
    return {id:r.resultKind,label:r.resultKind,rewards:allowedSkills.get([ordinal,x.ordinal,r.resultKind].join(':'))||[],
     ...(br?.terminal?{terminal:true}:{})};
   }):null;
   const only=branches[0];
   return {id:'c'+x.ordinal,label:'候補位置'+x.ordinal,
    ...(outcomes?{outcomes}:{rewards:allowedSkills.get([ordinal,x.ordinal,'unspecified'].join(':'))||[]}),
    ...(!outcomes&&only?.terminal?{terminal:true}:{})};
  };
  const row={id:e.sourceKey,name,
   ...(e.choices.length===1?{type:'auto'}:{type:'choice'})};
  if(row.type==='choice')row.choices=e.choices.map(opt);
  else{
   const auto=opt(e.choices[0]);
   if(auto.outcomes)row.outcomes=auto.outcomes;
   else row.rewards=auto.rewards;
  }
  const before=c.transitionStages.find(s=>s.eventOrdinal===ordinal-1);
  if(before){
   const next=before.branches.filter(b=>!b.terminal&&b.nextEventOrdinal===ordinal);
   if(next.length!==1)fail('複数代替経路の監査fixture自動AND化を禁止');
   const b=next[0],parent=f.events.find(x=>x.sourceEventOrdinal===ordinal-1);
   row.requires={all:[{eventId:parent.sourceKey,
    ...(parent.choices.length>1?{choiceId:'c'+b.choiceOrdinal}:{}),
    ...(b.resultKind!=='unspecified'?{outcomeId:b.resultKind}:{})}]};
  }
  byOrdinal.set(ordinal,row);
 }
 const events=[...byOrdinal.values()];
 const bySkill={};
 for(const aw of c.awardChecks)bySkill[aw.skillId]={id:aw.skillId,name:'numeric '+aw.skillId};
 const model={cards:[{id:cardId}],cardById:{[cardId]:{id:cardId}},skillById:bySkill};
 validateEvents(events,model,cardId);
 return {card:{id:cardId,events,hints:[]},events,model,
   meta:{auditOnly:true,publicationApproval:false,actualGamePlayVerified:false}};
}
module.exports={validate,auditFixture};
