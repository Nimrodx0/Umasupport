'use strict';
/*
 * Three-stage cumulative success/failure evidence for SSR30103.
 * Records numeric event facts only, never uploads publishers' article prose.
 * Cross-publisher corroboration ≠ verified live game or production approval.
 */
const {verifyDerived}=require('./checker_explicit_result_extract.cjs');
const {validateEvents}=require('./event_schema.js');
const fail=s=>{throw Error('30103累積結果監査: '+s);};
const key=(a,b)=>a+':'+b;
function validate({candidate,facts,p0Queue,audit}){
 verifyDerived(candidate,facts);
 if(audit?.schemaVersion!==1||audit.dataKind!=='umasupport-cumulative-result-editorial-audit'||
    audit.cardId!=='30103'||audit.sourceCoverage!=='three-observed-chain-stages-only'||
    audit.actualGamePlayVerified!==false||audit.publicationApproval!==false||
    audit.forSkillGrant!==false||!Array.isArray(audit.sources)||audit.sources.length<2||
    !Array.isArray(audit.stages)||audit.stages.length!==3||
    !Array.isArray(audit.numericAwardChecks)||!Array.isArray(audit.unresolvedSkillFacts)||
    p0Queue?.dataKind!=='umasupport-result-review-queue'||p0Queue.forSkillGrant!==false)
  fail('非公開の資料照合だけを扱います');
 const providers=new Set();
 for(const s of audit.sources){
  if(!s||!['Famitsu','Dengeki Online','U-tools'].includes(s.publisher)||
    typeof s.url!=='string'||!s.url.startsWith('https://')||
    providers.has(s.publisher))fail('出版社URL・発行元が不正');
  providers.add(s.publisher);
 }
 const original=facts.cards.find(c=>c.cardId==='30103');
 if(!original)fail('元データにカードがありません');
 const eventIds=new Map(),tested=new Set();
 for(let i=0;i<3;i++){
  const st=audit.stages[i],src=original.events.find(e=>e.sourceEventOrdinal===i+1);
  if(!st||!src||st.eventOrdinal!==i+1||st.sourceKey!==src.sourceKey||
     st.sourceDigest!==src.sourceDigest||src.choices.length!==1||
     !p0Queue.rows.some(r=>r.sourceKey===st.sourceKey&&r.priority==='P0')||
     !Array.isArray(st.resultKinds)||new Set(st.resultKinds).size!==st.resultKinds.length||
     st.resultKinds.length!==src.choices[0].results.length||
     st.resultKinds.some((k,j)=>k!==src.choices[0].results[j].resultKind)||
     st.continuation!==(i===2?'final-stage':'both-results-advance')||
     src.choices[0].results.some(x=>x.terminalObserved))
    fail('P0出典指紋・イベント序数・結果ラベルが不一致');
  if(i!==2&&st.resultConditions!==undefined)fail('1-2段階の結果条件は不要');
  eventIds.set(i+1,st.sourceKey);
 }
 const last=audit.stages[2],expected={
  'success:success':'great','success:failure':'success',
  'failure:success':'success','failure:failure':'failure'
 },observed={};
 if(!Array.isArray(last.resultConditions)||last.resultConditions.length!==3)
  fail('最終段階の3結果条件がありません');
 const expectedKinds=new Set(last.resultKinds);
 for(const r of last.resultConditions){
  if(!r||!expectedKinds.has(r.resultKind)||tested.has(r.resultKind)||
     !Array.isArray(r.any)||r.any.length===0)fail('最終結果のOR条件が不正');
  tested.add(r.resultKind);
  for(const clause of r.any){
   if(!Array.isArray(clause)||clause.length!==2)fail('結果条件のANDが不正');
   const vals={};
   for(const x of clause){
    if(!x||![1,2].includes(x.eventOrdinal)||!['success','failure'].includes(x.resultKind)||
       Object.hasOwn(vals,x.eventOrdinal))fail('前段1-2の成功／失敗が不正');
    vals[x.eventOrdinal]=x.resultKind;
   }
   if(Object.keys(vals).length!==2)fail('前段2結果の片方が欠落');
   const k=key(vals[1],vals[2]);
   if(Object.hasOwn(observed,k))fail('排他的な結果条件が重複');
   observed[k]=r.resultKind;
  }
 }
 if(tested.size!==3||Object.keys(observed).length!==4||
    Object.keys(expected).some(k=>observed[k]!==expected[k]))
  fail('前2段の結果と最終報酬が一致しません');
 const available=new Map();
 for(const e of original.events.filter(x=>x.sourceEventOrdinal<=3))
  for(const result of e.choices[0].results)
   for(const h of result.skillHints){
    const k=key(e.sourceEventOrdinal,result.resultKind);
    const a=available.get(k)||[];a.push(h);available.set(k,a);
   }
 const numericExpected=[...available].flatMap(([k,v])=>v.filter(h=>h.skillId).map(h=>k+':'+h.skillId+':'+h.level)).sort();
 const numericFound=audit.numericAwardChecks.map(x=>{
  if(!x||![1,2,3].includes(x.eventOrdinal)||typeof x.skillId!=='string'||
    !Number.isInteger(x.level)||x.level<1)return fail('数値ヒント監査レコードの形式が不正');
  return key(x.eventOrdinal,x.resultKind)+':'+x.skillId+':'+x.level;
 }).sort();
 if(JSON.stringify(numericExpected)!==JSON.stringify(numericFound))
  fail('結果別の数値ヒントID・Lvが元候補と一致しません');
 const missing=[...available].flatMap(([k,v])=>v.filter(h=>!h.skillId)
  .map(h=>k+':'+h.unresolvedSkillName+':'+h.level)).sort();
 const missingFound=audit.unresolvedSkillFacts.map(x=>
  key(x.eventOrdinal,x.resultKind)+':'+x.skillName+':'+x.level).sort();
 if(JSON.stringify(missing)!==JSON.stringify(missingFound)||
    audit.unresolvedSkillFacts.some(x=>x.resolution!=='missing-from-pinned-umasim-skill-dictionary'))
  fail('未解決スキルを数値IDと取り違えてはいけません');
 return {cards:1,transitionEvents:3,branchCombinations:4,sourceOutcomeStates:7,
  numericAwardChecks:numericFound.length,unresolvedSkillFacts:missingFound.length};
}
function auditFixture(args){
 validate(args);
 const audit=args.audit,all=audit.stages,checks=audit.numericAwardChecks;
 const allow=new Map();
 for(const r of checks){
  const k=key(r.eventOrdinal,r.resultKind),a=allow.get(k)||[];
  a.push({skillId:r.skillId,level:r.level});allow.set(k,a);
 }
 const events=all.map(st=>({
  id:st.sourceKey,name:'連続'+st.eventOrdinal,type:'auto',
  ...(st.eventOrdinal>1?{requires:{all:[{eventId:all[st.eventOrdinal-2].sourceKey}]}}:{}),
  outcomes:st.resultKinds.map(resultKind=>({
   id:resultKind,label:resultKind,
   rewards:allow.get(key(st.eventOrdinal,resultKind))||[],
   ...(st.resultConditions?{requires:{any:
    st.resultConditions.find(c=>c.resultKind===resultKind).any.map(clause=>({
     all:clause.map(x=>({eventId:all[x.eventOrdinal-1].sourceKey,outcomeId:x.resultKind}))
    }))}}:{})
  }))
 }));
 const skills={};
 for(const reward of checks)skills[reward.skillId]={id:reward.skillId,name:'numeric '+reward.skillId};
 const model={cards:[{id:audit.cardId}],cardById:{[audit.cardId]:{id:audit.cardId}},skillById:skills};
 validateEvents(events,model,audit.cardId);
 const card={id:audit.cardId,hints:[],events};
 return {events,model,card,meta:{auditOnly:true,publicationApproval:false,actualGamePlayVerified:false}};
}
module.exports={validate,auditFixture};
