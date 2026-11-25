'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const routes=require('../src/p3_card_acquisition_routes.cjs');
const p32=require('../src/p3_source_app_identity_audit.cjs');
const fixed=require('../tools/globalsim_roster32.cjs');
function fixture(){
 const skills=Array.from({length:9},(_,i)=>{
  const id=String(100+i),name='source-'+id;
  return {id:'skill:'+id,name,
   activationProfile:{status:'source-structure',sourceNumericId:id,invokes:[]}};
 });
 const card={
  id:'verified-card-1',name:'Test',
  sourceStatus:'verified_hints',hintsByStage:{
   '0':['skill:100'],'1':['skill:100'],'2':[],
   '3':['skill:101'],'4':['skill:101']},
  events:[
   {id:'auto-1',type:'auto',rewards:[
    {skillId:'skill:102',level:1}, // omitted kind is the documented hint default,
    {skillId:'skill:103',kind:'negative'}]},
   {id:'choice-1',type:'choice',choices:[
    {id:'a',rewards:[{skillId:'skill:100',kind:'hint',level:2}]},
    {id:'b',outcomes:[{id:'success',rewards:[
     {skillId:'skill:104',kind:'obtained'}]}]}]},
   {id:'auto-2',type:'auto',outcomes:[
    {id:'good',rewards:[{skillId:'skill:105',kind:'hint',level:2}]}]}
  ],
  referenceSkills:['skill:107'] // never a verified acquisition route
 };
 const identity={
  schemaVersion:1,status:p32.STATUS,
  provenance:{originalSkillRegistrySha256:fixed.SOURCE_SHA},
  summary:{originalSourceConditions:10,[p32.SOURCE_MATCH]:9,
   'not-in-app-catalog':1,confirmedSupportCardAcquisitionRoutes:0,
   productEligibleSkillRatings:0},
  rows:Array.from({length:10},(_,i)=>{
   const id=String(100+i),matched=i<9;
   return {originalSourceNumericId:id,
    result:matched?p32.SOURCE_MATCH:'not-in-app-catalog',
    appSkillId:matched?'skill:'+id:null,
    appSkillName:matched?'source-'+id:null,
    verifiedSupportCardAcquisition:'not-evaluated',
    eligibleForP3CardScoring:false,cardScore:null,suitabilityLabel:null};
  })
 };
 const model={cards:[card],cardById:{[card.id]:card},skills,
  skillById:Object.fromEntries(skills.map(x=>[x.id,x])),
  meta:{eventStatus:'reviewed-partial',reviewedEventRecords:3}};
 return {identity,model,card};
}
test('enumerate stage-specific exact-ID hints and disjoint approved event paths without scoring',()=>{
 const {identity,model}=fixture(),before=JSON.stringify({identity,model});
 const report=routes.audit({identity,appModel:model});
 assert.equal(JSON.stringify({identity,model}),before,'read-only');
 assert.equal(report.summary.sourceConditions,10);
 assert.equal(report.summary.exactAppIdentityMatches,9);
 assert.equal(report.summary.notInAppCatalog,1);
 assert.equal(report.summary.hintCandidateRecords,2);
 assert.equal(report.summary.approvedEventCandidateRecords,4);
 assert.equal(report.summary.directCandidateRecords,6);
 assert.equal(report.summary.skillsWithDirectCandidate,5);
 assert.equal(report.summary.cardsWithVerifiedCohortDirectCandidates,1);
 assert.equal(report.summary.distinctVerifiedCohortCardSkillPairs,5);
 assert.equal(report.cardCandidateGroups.length,1);
 assert.equal(report.cardCandidateGroups[0].cardId,'verified-card-1');
 assert.equal(report.cardCandidateGroups[0].cardScore,null);
 assert.equal(report.cardCandidateGroups[0].eligibleForP3CardScoring,false);
 assert.equal(report.cardCandidateGroups[0].skills.length,5);
 assert.deepEqual(
  report.cardCandidateGroups[0].skills.find(x=>x.appSkillId==='skill:100')
   .directCandidates.filter(x=>x.source==='normal-hint')[0].stages,[0,1]);
 assert.equal(report.cardCandidateGroups[0].skills.reduce((n,x)=>
  n+x.directCandidates.length,0),report.summary.directCandidateRecords);
 assert.deepEqual(report.rows[0].directCandidates[0].stages,[0,1]);
 assert.deepEqual(report.rows[1].directCandidates[0].stages,[3,4]);
 assert.equal(report.rows[3].directCandidates.length,0,'negative effect excluded');
 assert.equal(report.rows[7].directCandidates.length,0,'reference skill not a route');
 assert.equal(report.rows[8].status,'no-direct-candidate-in-fixed-approved-app');
 assert.equal(report.rows[9].status,'not-in-app-catalog');
 for(const row of report.rows){
  assert.equal(row.cardScore,null);
  assert.equal(row.suitabilityLabel,null);
  assert.equal(row.eligibleForP3CardScoring,false);
  assert.equal(row.indirectGrantRoutes,'not-assessed');
  assert(row.directCandidates.every(x=>x.conditional===true));
 }
});
test('selected branches use live core reachability: unselected alternatives are not guaranteed',()=>{
 const {identity,model}=fixture();
 const lookup=args=>routes.selectedDirectCandidates({
  identity,appModel:model,cardId:'verified-card-1',...args
 });
 let candidates=lookup({stage:0});
 assert(candidates.some(x=>x.appSkillId==='skill:100'&&x.source==='hint'));
 assert(candidates.some(x=>x.appSkillId==='skill:102'&&x.source==='event'));
 assert(!candidates.some(x=>x.appSkillId==='skill:104'),'unselected choice not reached');
 candidates=lookup({stage:2,choices:{'choice-1':'b'},outcomes:{'choice-1':'success'}});
 assert(candidates.some(x=>x.appSkillId==='skill:104'));
 assert(!candidates.some(x=>x.appSkillId==='skill:100'),'old choice and absent stage excluded');
 assert.throws(()=>lookup({stage:8}),/invalid selected/);
 assert.throws(()=>routes.selectedDirectCandidates({
  identity,appModel:model,cardId:'not-a-card'}),/unknown selected card/);
});
test('P3.2 ambiguous, spoofed or source-unverified identities must not become routes',()=>{
 const {identity,model}=fixture();
 const forged=structuredClone(identity);
 forged.rows[0].result='same-id-condition-mismatch';
 assert.throws(()=>routes.audit({identity:forged,appModel:model}),
  /nonmatched or ambiguous/);
 const wrong=structuredClone(identity);
 wrong.rows[0].appSkillId='skill:101';
 assert.throws(()=>routes.audit({identity:wrong,appModel:model}),
  /source\/app identity/);
 const cloned=structuredClone(model);
 cloned.cardById={'verified-card-1':cloned.cards[0]};
 cloned.meta.eventStatus='preview';
 assert.throws(()=>routes.audit({identity,appModel:cloned}),
  /approved published event model unavailable/);
 const scored=structuredClone(identity);
 scored.rows[0].cardScore=15;
 assert.throws(()=>routes.audit({identity:scored,appModel:model}),
  /unexpected scoring/);
 const missing=structuredClone(model);
 missing.cardById={'verified-card-1':missing.cards[0]};
 delete missing.cards[0].hintsByStage['3'];
 assert.throws(()=>routes.audit({identity,appModel:missing}),
  /missing pinned hint-stage/);
});

test('card-first grouping preserves two cards, alternative results and source IDs without inventing a score',()=>{
 const {identity,model}=fixture();
 const second={
  id:'verified-card-2',name:'Another',sourceStatus:'verified_hints',
  hintsByStage:{'0':[],'1':[],'2':[],'3':[],'4':['skill:100']},
  events:[{id:'second-event',type:'choice',choices:[
   {id:'a',outcomes:[{id:'good',rewards:[
    {kind:'hint',skillId:'skill:102'}]},
    {id:'bad',rewards:[{kind:'hint',skillId:'skill:102'}]}]},
   {id:'b',rewards:[{kind:'negative',skillId:'skill:103'}]}]}]
 };
 model.cards.push(second);
 model.cardById[second.id]=second;
 const original=JSON.stringify({identity,model});
 const report=routes.audit({identity,appModel:model});
 assert.equal(JSON.stringify({identity,model}),original,'audit is read-only');
 assert.equal(report.summary.cardsWithVerifiedCohortDirectCandidates,2);
 assert.equal(report.summary.distinctVerifiedCohortCardSkillPairs,7);
 assert.equal(report.summary.directCandidateRecords,9);
 assert.deepEqual(report.cardCandidateGroups.map(x=>x.cardId),
  ['verified-card-1','verified-card-2']);
 const secondGroup=report.cardCandidateGroups[1];
 assert.equal(secondGroup.cardScore,null);
 assert.equal(secondGroup.eligibleForP3CardScoring,false);
 assert.equal(secondGroup.skills.length,2);
 assert.deepEqual(secondGroup.skills.map(x=>x.appSkillId),
  ['skill:100','skill:102']);
 const paths=secondGroup.skills.find(x=>x.appSkillId==='skill:102').directCandidates;
 assert.equal(paths.length,2,'different outcome branches remain separate');
 assert.deepEqual(paths.map(x=>x.outcomeId),['good','bad']);
 assert(paths.every(x=>x.choiceId==='a'&&x.eventId==='second-event'));
 assert.equal(secondGroup.skills.find(x=>x.appSkillId==='skill:100')
  .directCandidates[0].stages[0],4,'hint limit-break stage not broadened');
 assert.equal(report.cardCandidateGroups.reduce((n,c)=>n+c.skills.reduce(
  (sum,sk)=>sum+sk.directCandidates.length,0),0),
  report.summary.directCandidateRecords);
});
