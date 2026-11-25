'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),crypto=require('node:crypto');
const {audit}=require('../src/p3_all_card_direct_research_routes.cjs');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function fixture(){
 const skills=[{id:'hint:a',activationProfile:{status:'source-structure',sourceNumericId:'100'}},
  {id:'skill:200',activationProfile:{status:'unavailable'}}];
 const card={id:'card:a',sourceStatus:'verified_hints',hintsByStage:{0:['hint:a'],1:[],2:[],3:[],4:['hint:a']},
  events:[{id:'event:a',type:'choice',choices:[{id:'choice:a',label:'a',rewards:[{skillId:'skill:200',kind:'obtained'}]},
   {id:'choice:b',label:'b',rewards:[{skillId:'hint:a',kind:'hint'},{skillId:'skill:200',kind:'negative'}]}]}]};
 const app={cards:[card],skills,cardById:{[card.id]:card},skillById:Object.fromEntries(skills.map(s=>[s.id,s])),
  meta:{eventStatus:'reviewed-partial',reviewedEventRecords:1}};
 const supplement={status:'P2.58-D051-interim-research-receipt-no-formal-label',rows:[
  {appSkillId:'hint:a',sourceNumericId:'100',sourceLogicCandidateForFurtherReview:true,formalLabel:null},
  {appSkillId:'skill:200',sourceNumericId:null,formalLabel:null}]};
 const logic={status:'P3.4e-context-specific-source-logic-equivalence-candidate-only',sourceSupplementSHA256:digest(supplement),
  rows:[{appSkillId:'hint:a',sourceNumericId:'100',disposition:'four-style-identical-logic-candidate',formalLabel:null},
   {appSkillId:'skill:200',sourceNumericId:null,disposition:'source-missing',formalLabel:null}]};
 return {app,logic,supplement};
}
test('stage-specific hints, exclusive event branches, missing identity and negative rewards remain distinct',()=>{
 const f=fixture(),before=JSON.stringify(f);
 const r=audit(f.app,f.logic,f.supplement);
 a.equal(JSON.stringify(f),before);a.equal(r.summary.pairs,2);a.equal(r.summary.normalHintRecords,1);
 a.equal(r.summary.approvedEventRecords,2);a.equal(r.summary.missingSourcePairs,1);a.equal(r.summary.candidatePairs,1);
 a.deepEqual(r.cards[0].stageSummaries.map(x=>x.normalHintCandidates),[1,0,0,0,1]);
 a.equal(r.cards[0].stageSummaries[0].defaultSelectionDirectCandidateSkills,1);
 a.equal(r.cards[0].skills[1].formalLabel,null);
});
test('no name alias or fabricated source identity',()=>{
 const f=fixture();f.app.skills[0].activationProfile.sourceNumericId='200';
 a.throws(()=>audit(f.app,f.logic,f.supplement));
});
