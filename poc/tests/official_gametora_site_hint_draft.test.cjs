'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {siteOnlyNumericDraft}=require('../src/official_gametora_site_numeric_draft.cjs');
const {hintOnlyDraft,summarizeHintDraft}=require('../src/official_gametora_site_hint_draft.cjs');
const {registryFromSkillText}=require('../src/official_gametora_skill_id_crosswalk.cjs');
const registry=()=>registryFromSkillText(JSON.stringify([
 ...Array.from({length:100},(_,i)=>({
  id:String(800000+i),name:'架空'+i,rarity:'normal',group:i
 })),
 {id:'200516',name:'登山家',rarity:'normal',group:600},
 {id:'200517',name:'光速',rarity:'rare',group:601},
 {id:'200518',name:'重複',rarity:'normal',group:602},
 {id:'200519',name:'重複',rarity:'rare',group:603}
]));
const seg=(effects,contexts=effects.map(()=>[]))=>({effectTexts:effects,effectContexts:contexts});
const group=(segments)=>({
 orSeparatorCount:segments.length-1,
 routeCandidateCount:segments.length,numericSegments:segments,
 ownTextFragments:['synthetic control'],
 visibleText:'synthetic control'
});
function observation(){
 return [
  group([seg(['体力 +16','「登山家」のヒントLv +2'],[
   [],['「登山家」のヒントLv +2']]),seg(['スタミナ +15'])]),
  group([seg(['友情ゲージ -10','「光速」のヒントLv +1'],
   [[],['「光速」のヒントLv +1']])])
 ];
}
function make(groups=observation()){
 return {groups,numeric:siteOnlyNumericDraft({cardId:'30080',siteEventOrdinal:6,groups})};
}
test('visible route-local independent name/ID and hint level are captured without old GT data',()=>{
 const {groups,numeric}=make(),r=hintOnlyDraft(numeric,groups,registry()),sum=summarizeHintDraft(r);
 assert.equal(r.seenHintRows,2);
 assert.equal(r.uniquelyResolvedHintIdLevelPairs,2);
 assert.equal(r.unresolvedHintRows,0);
 assert.deepEqual(r.routeCandidates[0][0].hints,[{
  source:'gametora-visible-hint',numericId:'200516',level:2,choiceGroupOrdinal:1,resultOrdinal:1
 }]);
 assert.equal(r.routeCandidates[0][1].hints.length,0);
 assert.equal(r.routeCandidates[1][0].hints[0].numericId,'200517');
 assert.equal(sum.routesWithResolvedHints,2);
 assert.equal(r.fullSkillRewardsVerified,false);
 assert.equal(r.appEventSchemaAdoptable,false);
 assert.equal(r.publicationApproved,false);
 assert.doesNotMatch(JSON.stringify(r),/登山家|光速|synthetic/);
});
test('hint in OR first segment cannot drift into second segment',()=>{
 const x=make();
 const r=hintOnlyDraft(x.numeric,x.groups,registry());
 assert.equal(r.routeCandidates[0][0].hints.length,1);
 assert.equal(r.routeCandidates[0][1].hints.length,0);
});
test('unknown names, duplicate IDs and hint levels are quarantined per route',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectTexts[1]='「未知名」のヒントLv +3';
 gs[0].numericSegments[0].effectContexts[1]=['「未知名」のヒントLv +3'];
 gs[1].numericSegments[0].effectTexts[1]='「重複」のヒントLv +1';
 gs[1].numericSegments[0].effectContexts[1]=['「重複」のヒントLv +1'];
 const {numeric}=make(gs),r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.seenHintRows,2);
 assert.equal(r.uniquelyResolvedHintIdLevelPairs,0);
 assert.equal(r.unresolvedHintRows,2);
 assert.equal(r.routeCandidates[0][0].hints.length,0);
 assert.equal(r.routeCandidates[1][0].hints.length,0);
});
test('negative or invalid hint levels cannot be turned into rewards',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectTexts[1]='「登山家」のヒントLv -1';
 const {numeric}=make(gs),r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.unresolvedHintRows,1);
 assert.equal(r.routeCandidates[0][0].hints.length,0);
});
test('two contradictory skill IDs in a single local ancestry must not select the first match',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectContexts[1]=[
  '「登山家」のヒントLv +2','「光速」のヒントLv +2'
 ];
 const {numeric}=make(gs),r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.routeCandidates[0][0].hints.length,0);
 assert.deepEqual(r.routeCandidates[0][0].unresolvedHintStatuses,['conflicting-skill-ids']);
});
test('unexpected branch, missing or unpinned registry, accidental promotion fail closed',()=>{
 const a=make(),reg=registry();
 assert.throws(()=>hintOnlyDraft({...a.numeric,publicationApproved:true},a.groups,reg),/required/);
 assert.throws(()=>hintOnlyDraft(a.numeric,a.groups,null),/required/);
 const bad=structuredClone(a.groups);
 bad[0].orSeparatorCount=2;
 assert.throws(()=>hintOnlyDraft(a.numeric,bad,reg),/branch-layout-drift/);
 const b=structuredClone(a.groups);
 b[0].numericSegments[0].effectContexts[1]=['X'.repeat(301)];
 assert.throws(()=>hintOnlyDraft(a.numeric,b,reg),/out-of-bounds/);
});

test('nearest unique hint row wins over unrelated reward names in broader DOM containers',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectContexts[1]=[
  '「登山家」のヒントLv +2',
  '「登山家」のヒントLv +2 と「光速」のヒントLv +3',
  '周辺のイベント表示「登山家」のヒントLv +2 と「光速」のヒントLv +3'
 ];
 const {numeric}=make(gs);
 const r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.seenHintRows,2);
 assert.equal(r.uniquelyResolvedHintIdLevelPairs,2);
 assert.equal(r.unresolvedHintRows,0);
 assert.deepEqual(r.routeCandidates[0][0].hints.map(h=>[h.numericId,h.level]),[['200516',2]]);
 assert.equal(r.routeCandidates[0][1].hints.length,0);
 assert.doesNotMatch(JSON.stringify(r),/登山家|光速|周辺のイベント表示/);
});
test('ambiguous local hint row cannot be rescued by a farther unique ancestor',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectContexts[1]=[
  '「登山家」のヒントLv +2 と「光速」のヒントLv +3',
  '「登山家」のヒントLv +2'
 ];
 const {numeric}=make(gs),r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.routeCandidates[0][0].hints.length,0);
 assert.deepEqual(r.routeCandidates[0][0].unresolvedHintStatuses,['ambiguous-name-or-id']);
 assert.equal(r.publicationApproved,false);
});
test('duplicate name with distinct IDs remains ambiguous even as nearest row',()=>{
 const gs=observation();
 gs[0].numericSegments[0].effectTexts[1]='「重複」のヒントLv +2';
 gs[0].numericSegments[0].effectContexts[1]=[
  '「重複」のヒントLv +2',
  '「重複」のヒントLv +2 ほかの報酬'
 ];
 const {numeric}=make(gs),r=hintOnlyDraft(numeric,gs,registry());
 assert.equal(r.routeCandidates[0][0].hints.length,0);
 assert.deepEqual(r.routeCandidates[0][0].unresolvedHintStatuses,['ambiguous-name-or-id']);
});
