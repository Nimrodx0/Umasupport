'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {crosswalk}=require('../src/gametora_event_skill_crosswalk.cjs');
const {transformDocument}=require('../src/gametora_whole_event_normalize.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const extras=require('../data/curation/supplemental_skills.v1.json');
function skills(){
 const rows=[
  {id:'200532',name:'速度維持',rarity:'normal',group:20053},
  {id:'201272',name:'架空の金スキル',rarity:'rare',group:20127},
  {id:'201111',name:'重複名称',rarity:'normal',group:20111},
  {id:'201112',name:'重複名称',rarity:'normal',group:20112},
  ...Array.from({length:120},(_,i)=>({
   id:String(400000+i),name:'他のスキル'+i,rarity:'normal',group:40000+i}))
 ];
 return JSON.stringify(rows);
}
function src(){
 return {kind:'support',id:30026,events_ja:{
  '原文禁止':{name:'引用しないイベント',id:1,section:'arrows',choices:[
   {label:'引用しない選択肢',effects:[{type:'skill_hint',skill_id:200532,value:'+1'},
    {type:'skill_hint',skill_id:201272,value:'+3'},
    {type:'skill_hint',skill_id:201111,value:'+2'}]},
   {label:'未収録など',effects:[{type:'skill_hint',skill_id:999999,value:'+1'},
    {type:'skill_hint',skill_id:200801,value:'+1'},
    {type:'skill_hint_or',skill_id:200532,value:'+1'},
    {type:'obtain_skill',skill_id:201272}]}]}
 }};
}
function candidate(){
 const t=transformDocument(src());
 const {reviewQueue,effectTypeCounts,...card}=t;
 return {schemaVersion:1,dataKind:'gametora-whole-event-numeric-candidate',
  noEventCanPublishFromThisCandidate:true,releaseApproved:false,
  sourcePins:{gameToraDerived:POLICY.baselineRevision},
  totals:{rosterCards:1,sourceEvents:t.sourceEventCount,
   sourceChoices:t.sourceChoiceCount,expandedRoutes:t.sourceExpandedRoutes,
   numericHintMentions:t.numericParsedHintMentions,
   unresolvedHintMentions:t.unresolvedHintMentions,
   directSkillGrantMentions:t.directSkillGrantMentions},
  cards:[card]};
}
function model(){
 return {cards:[{id:'30026'}],
  skillById:{'hint:速度維持':{name:'速度維持',id:'hint:速度維持'},
   'hint:重複名称':{name:'重複名称',id:'hint:重複名称'}}};
}
test('all numeric hints crosswalk pinned registry; known existing ordinary hints merge only on unique names',()=>{
 const original=candidate(),out=crosswalk({candidate:original,skillText:skills(),model:model(),supplemental:extras});
 const t=out.stats;
 assert.equal(t.numericHintMentions,5);
 assert.equal(t.matchedPinnedSkillIds,3);
 assert.equal(t.matchedAppNormalHintIds,1);
 assert.equal(t.matchedAppRegisteredNumericIds,2);
 assert.equal(t.ambiguousSkillNamesSafelyKeptNumeric,1);
 assert.equal(t.missingPinnedSkillIds,1);
 assert.equal(t.curationOnlySkillIds,1);
 assert.equal(t.unresolvedInputHints,1);
 assert.equal(t.directSkillGrantMentions,1);
 assert.equal(t.directSkillIdsInPinnedRegistry,1);
 assert.equal(t.sourceEvents,1);
 const h=out.locations.filter(x=>x.kind==='hint');
 assert.deepEqual(h.map(x=>x.status),[
  'mapped-existing-normal-hint','mapped-numeric-event-skill',
  'mapped-numeric-event-skill','not-in-pinned-umasim-registry',
  'curation-only-not-in-runtime-registry']);
 assert.equal(h[0].runtimeSkillId,'hint:速度維持');
 assert.equal(h[1].runtimeSkillId,'skill:201272');
 assert.equal(h[2].runtimeSkillId,'skill:201111');
 assert.equal(h[2].nameAmbiguous,true);
 assert.equal(h[3].runtimeSkillId,null);
 assert.equal(h[4].runtimeSkillId,null);
 assert.equal(out.locations.at(-1).awardSemanticsReviewed,false);
 assert.equal(out.releaseApproved,false);
 assert.equal(out.gameVerified,false);
 assert.equal(out.crosswalkDoesNotVerifyRouteConditions,true);
 assert.equal(JSON.stringify(original).includes('原文禁止'),false);
 assert.equal(JSON.stringify(out).includes('引用しない'),false);
});
test('registry tampering, snapshot drift or truncated candidate fails without inferred rewards',()=>{
 const args={candidate:candidate(),skillText:skills(),model:model()};
 const wrong=JSON.parse(JSON.stringify(args.candidate));
 wrong.totals.numericHintMentions++;
 assert.throws(()=>crosswalk({...args,candidate:wrong}),/全件保存検証不一致/);
 const unverified=JSON.parse(JSON.stringify(args.candidate));
 unverified.releaseApproved=true;
 assert.throws(()=>crosswalk({...args,candidate:unverified}),/未承認中間DB/);
 const bad=JSON.parse(JSON.stringify(args.candidate));
 bad.sourcePins.gameToraDerived='0'.repeat(40);
 assert.throws(()=>crosswalk({...args,candidate:bad}),/未承認中間DB/);
 assert.throws(()=>crosswalk({...args,skillText:'{}'}),/JSON形式|収録件数/);
 const changed=JSON.parse(args.skillText);
 changed[1].id=changed[0].id;
 assert.throws(()=>crosswalk({...args,skillText:JSON.stringify(changed)}),/重複/);
});
test('duplicate name should NOT merge with current hint and invalid rarity rejects',()=>{
 const altered=JSON.parse(skills());
 altered.find(x=>x.id==='201272').rarity='unique';
 const out=crosswalk({candidate:candidate(),skillText:JSON.stringify(altered),model:model()});
 const rare=out.locations.find(x=>x.numericId==='201272'&&x.kind==='hint');
 assert.equal(rare.status,'unsupported-rarity');
 assert.equal(rare.runtimeSkillId,null);
 assert.equal(out.stats.unsupportedSkillRarities,1);
 assert.equal(out.stats.directSkillIdsMissingFromPinnedRegistry,1);
});
