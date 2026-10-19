'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const inventory=require('../src/curated_event_inventory.cjs');
const root=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const index=read('poc/data/curation/source_index.v1.json');
const SKILLS=require('../src/efforia30311_review_preview.cjs').SKILLS;
const indexed={
 '10001':'R','10002':'R','10016':'R','10047':'R','10050':'R','10061':'R','10073':'R','10087':'R','10125':'R','10132':'R',
 '20023':'SR','20029':'SR','30311':'SSR'
};
const hintNames=['差しコーナー○','左回り○','直線巧者','後方釘付','前列狙い','ペースアップ',
 'ラッキーセブン','おひとり様○','冷静','一匹狼','ギアシフト','ウマ好み','別腹タンク','軽い足取り'];
function input(){
 const active=Object.entries(indexed).map(([id,rarity])=>({
  id,name:'カード'+id,rarity,hints:[],events:[]
 }));
 const rest=Array.from({length:563-active.length},(_,i)=>({
  id:String(60000+i),name:'架空'+i,rarity:'SR',hints:[],events:[]
 }));
 const cards=[...active,...rest];
 const skills=hintNames.map(name=>({id:'hint:'+name,name,tier:'white'}));
 const model={cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
  skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),meta:{}};
 const dictionary=JSON.stringify([
  ...Object.entries(SKILLS).map(([id,name],i)=>({
   id,name,rarity:'normal',group:50000+i
  })),
  ...hintNames.filter(name=>name!=='後方釘付').map((name,i)=>({id:String(900001+i),name,
    rarity:'normal',group:92000+i})),
  {id:'202992',name:'直線コース○',rarity:'normal',group:20299},
  ...Array.from({length:110},(_,i)=>({
   id:String(700000+i),name:'架空辞書'+i,rarity:'normal',group:70000+i
  }))
 ]);
 return {model,index:JSON.parse(JSON.stringify(index)),skillText:dictionary,
  draftCatalogs:Object.fromEntries(index.cards.map(c=>[c.draftFile,read(c.draftFile)])),
  publicCatalog:read('poc/data/reviewed_events.v1.json'),
  supplementalSkills:read('poc/data/curation/supplemental_skills.v1.json')};
}
test('13 direct GameWith article-linked card drafts, 33 events / 563 full-card test roster, 0 released',()=>{
 const arg=input(),before=JSON.stringify(arg.model);
 const report=inventory.audit(arg);
 assert.equal(report.rosterCards,563);
 assert.equal(report.sourceIndexedCards,13);
 assert.equal(report.draftCards,13);
 assert.equal(report.draftEventRecords,33);
 assert.equal(report.draftNamedUnresolvedRows,1);
 assert.equal(report.namedRewardsMatchedFromFullRegistry,0);
 assert.equal(report.namedRewardsMatchedFromSupplement,1);
 assert.equal(report.supplementalSkillIdsAdded,1);
 assert.equal(report.stillPendingSkillRows,0);
 assert.equal(report.stillPendingSkillEvents,0);
 assert.ok(report.normalHintRewardIdsMatched>=12);
 assert.equal(report.untrackedCards,550);
 assert.equal(report.releasedEventRecords,0);
 assert.deepEqual(report.indexedByRarity,{R:10,SR:2,SSR:1});
 assert.equal(JSON.stringify(arg.model),before,'an audit cannot mutate the live model');
});
test('SR Pearl restores event-only skill with actual resolved numeric ID',()=>{
 const args=input(),p=args.draftCatalogs['poc/data/curation/drafts/20029.v1.json'].cards[0];
 assert.equal(p.events.length,4);
 const first=p.events.find(e=>e.id==='draft_20029_chain_01');
 const second=p.events.find(e=>e.id==='draft_20029_chain_02');
 assert.equal(first.choices.length,3);
 assert.equal(first.choices[2].terminal,true);
 assert.deepEqual(second.requires,{all:[{eventId:first.id}]});
 assert.equal(second.type,'auto');
 assert.deepEqual(second.rewards,[{skillId:'hint:ギアシフト',level:1}]);
 const recovered=p.events.find(e=>e.id==='draft_20029_normal_01');
 assert.deepEqual(recovered.choices[1].rewards,[{skillId:'skill:202992',verifiedSkillName:'直線コース○',level:1}]);
});
test('SR Sweep follow-up requires prior chain, status effects never treated as skill hints',()=>{
 const args=input(),events=args.draftCatalogs['poc/data/curation/drafts/20023.v1.json'].cards[0].events;
 assert.equal(events.length,4);
 assert.deepEqual(events[1].requires,{all:[{eventId:events[0].id}]});
 assert.equal(events[3].choices.every(c=>c.rewards===undefined),true);
});
test('bad source index, forged complete status and mismatched source URL rejected',()=>{
 const original=index;
 for(const mutate of [
  obj=>obj.cards.push({...obj.cards[0]}),
  obj=>obj.cards[0].primaryArticle='https://attacker.invalid/uma-musume/article/show/257601',
  obj=>obj.cards[0].primaryArticle+='?x=1',
  obj=>obj.cards[0].articleCheckedAt='2026-02-30',
  obj=>obj.cards[0].coverageStatus='complete',
  obj=>obj.cards[0].recordStatus='released',
  obj=>obj.cards[0].draftFile='../../exfiltrate.json'
 ]){
  const bad=JSON.parse(JSON.stringify(original));mutate(bad);
  assert.throws(()=>inventory.validateIndex(bad));
 }
});
test('bad card IDs, missing reward dictionary IDs, illegal auto/choice shapes and dupes reject entire draft batch',()=>{
 const winning='poc/data/curation/drafts/10016.v1.json';
 for(const mutate of [
  a=>a.draftCatalogs[winning].cards[0].cardId='20000',
  a=>a.draftCatalogs[winning].cards[0].coverageStatus='complete',
  a=>a.draftCatalogs[winning].cards[0].events[0].id='draft_20000_other',
  a=>a.draftCatalogs[winning].cards[0].events[0].choices.push({id:'option1',label:'重複'}),
  a=>a.index.cards[0].cardId='99999',
  a=>a.skillText='[]'
 ]){
  const arg=input();mutate(arg);
  assert.throws(()=>inventory.audit(arg));
 }
});
test('non-indexed cards are not allowed in production catalog',()=>{
 const arg=input();arg.publicCatalog.cards=[{cardId:'60000',coverageStatus:'partial',events:[]}];
 assert.throws(()=>inventory.audit(arg),/公開DBのカードが独自出典索引/);
});

test('R card article-derived event choices retain skill, choice ordinal, hint levels',()=>{
 const arg=input();
 const expected={
  '10001':[[0,0,'別腹タンク',1]],
  '10002':[[1,1,'左回り○',1]],
  '10016':[[0,0,'差しコーナー○',1]],
  '10047':[[1,0,'ペースアップ',1]],
  '10050':[],
  '10061':[[0,1,'skill:202992',1],[1,1,'ウマ好み',3]],
  '10073':[[1,1,'後方釘付',1]],
  '10087':[[1,1,'軽い足取り',2]],
  '10125':[[0,1,'前列狙い',1]],
  '10132':[[0,0,'直線巧者',1]]
 };
 for(const [cardId,positions] of Object.entries(expected)){
  const events=arg.draftCatalogs['poc/data/curation/drafts/'+cardId+'.v1.json'].cards[0].events;
  assert.equal(events.length,2,cardId);
  assert.ok(events.every(e=>e.type==='choice'&&e.choices.length===2),cardId);
  const facts=events.flatMap((e,i)=>e.choices.flatMap((c,j)=>[
    ...(c.rewards||[]).map(x=>[i,j,x.skillId.startsWith('hint:')?x.skillId.slice(5):x.skillId,x.level]),
    ...(c.unresolvedRewards||[]).map(x=>[i,j,x.skillName,x.level])
   ]));
  assert.deepEqual(facts,positions,cardId);
 }
});
test('two SR event branches preserve nontrivial multi-step rules and distinct hint levels',()=>{
 const arg=input(),sweep=arg.draftCatalogs['poc/data/curation/drafts/20023.v1.json'].cards[0].events;
 assert.deepEqual(sweep[0].choices.map(c=>(c.rewards||[]).map(x=>[x.skillId,x.level])),[
  [['hint:ラッキーセブン',1]],[['hint:おひとり様○',5]]
 ]);
 assert.deepEqual(sweep[1].choices.map(c=>(c.rewards||[]).map(x=>[x.skillId,x.level])),[
  [['hint:冷静',1]],[['hint:一匹狼',1]]
 ]);
 const pearl=arg.draftCatalogs['poc/data/curation/drafts/20029.v1.json'].cards[0].events;
 assert.deepEqual(pearl[3].choices[1].rewards,[{skillId:'hint:ウマ好み',level:3}]);
});

test('one unresolved reward survives an absent full numeric registry without inventing an ID',()=>{
 const inputData=input();
 const p=inputData.draftCatalogs['poc/data/curation/drafts/10073.v1.json'].cards[0];
 const pre=JSON.stringify(p);
 inputData.supplementalSkills={schemaVersion:1,skills:[]};
 const report=inventory.audit(inputData);
 assert.equal(report.draftEventRecords,33);
 assert.equal(report.stillPendingSkillRows,1);
 assert.equal(report.stillPendingSkillEvents,1);
 assert.deepEqual(report.pendingSkillDetails.map(x=>[x.skillName,x.level,x.reason]),
  [['後方釘付',1,'missing']]);
 assert.equal(JSON.stringify(p),pre,'audit cannot destroy editorial pending reward or mutate source');
});
test('multiple same-name registry records quarantine the reward instead of choosing one',()=>{
 const inputData=input();
 inputData.supplementalSkills={schemaVersion:1,skills:[]};
 const dict=JSON.parse(inputData.skillText);
 dict.push({id:'201012',name:'後方釘付',rarity:'normal',group:99876});
 dict.push({id:'999999',name:'後方釘付',rarity:'normal',group:99876});
 inputData.skillText=JSON.stringify(dict);
 const report=inventory.audit(inputData);
 assert.equal(report.stillPendingSkillRows,1);
 assert.deepEqual(report.pendingSkillDetails[0].candidateIds,['201012','999999']);
 assert.equal(report.pendingSkillDetails[0].reason,'ambiguous');
});
test('invalid guessed hint name and malformed unresolved reward refuse all drafts',()=>{
 for(const modify of [
  x=>x.draftCatalogs['poc/data/curation/drafts/10073.v1.json'].cards[0].events[1].choices[1].unresolvedRewards[0].level=0,
  x=>x.draftCatalogs['poc/data/curation/drafts/10073.v1.json'].cards[0].events[1].choices[1].unresolvedRewards[0].skillId='skill:000000',
  x=>x.draftCatalogs['poc/data/curation/drafts/10073.v1.json'].cards[0].events[1].choices[1].unresolvedRewards=[]
 ]){
  const x=input();modify(x);
  assert.throws(()=>inventory.audit(x));
 }
});
test('resolved draft validation has exact full numeric ID and does not publish it',()=>{
 const x=input();
 const names=require('../src/curated_skill_resolution.cjs');
 const raw=x.draftCatalogs['poc/data/curation/drafts/10073.v1.json'];
 const output=names.prepareDraft(raw,x.skillText,{supplemental:x.supplementalSkills});
 const provisional=output.catalog.cards[0].events[1].choices[1];
 assert.equal(provisional.unresolvedRewards,undefined);
 assert.deepEqual(provisional.rewards,[{
  skillId:'skill:201012',verifiedSkillName:'後方釘付',level:1
 }]);
 assert.equal(output.releaseEligible,false);
 assert.equal(output.supplementalAdded,1);
 assert.equal(output.resolvedNames[0].source,'supplemental');
 assert.ok(output.matchedHintRewards===0);
 assert.deepEqual(raw.cards[0].events[1].choices[1].unresolvedRewards,
  [{skillName:'後方釘付',level:1}]);
});

test('legacy unverified hint-name reward is preserved in source but quarantined for validation',()=>{
 const x=input();
 const row=x.draftCatalogs['poc/data/curation/drafts/20029.v1.json'].cards[0]
  .events[3].choices[1].rewards[0];
 row.skillId='hint:不存在の通常ヒント';
 const report=inventory.audit(x);
 assert.equal(report.stillPendingSkillRows,1);
 assert.equal(report.stillPendingSkillEvents,1);
 assert.equal(report.pendingSkillDetails[0].inputKind,'legacy-hint-name');
 assert.equal(report.pendingSkillDetails[0].skillName,'不存在の通常ヒント');
 assert.equal(row.skillId,'hint:不存在の通常ヒント');
});

test('curation supplemental IDs cannot overwrite changed UmaSim identity or collide by name',()=>{
 const seed=input();
 const bad=JSON.parse(seed.skillText);
 for(const mutation of [
  x=>x.push({id:'201012',name:'違うスキル',rarity:'normal',group:99}),
  x=>x.push({id:'999001',name:'後方釘付',rarity:'normal',group:99})
 ]){
  const x=input(),source=JSON.parse(x.skillText);mutation(source);
  x.skillText=JSON.stringify(source);
  assert.throws(()=>inventory.audit(x),/補完/);
 }
});
test('external supplemental ID requires scoped exact source URLs and rejects bad claims',()=>{
 for(const mutation of [
  x=>x.skills[0].id='0',
  x=>x.skills[0].name='',
  x=>x.skills[0].scope='released',
  x=>x.skills[0].evidence.numericId='https://evil.example/201012',
  x=>x.skills[0].evidence.nameAndEffect='http://gamewith.jp/uma-musume/article/show/258049',
  x=>x.skills.push({...x.skills[0]})
 ]){
  const x=input();mutation(x.supplementalSkills);
  assert.throws(()=>inventory.audit(x),/補完/);
 }
});
test('unreviewed wiki-only supplemental data never edits original skill registry or draft',()=>{
 const arg=input(),before=JSON.stringify(arg);
 const report=inventory.audit(arg);
 assert.equal(report.namedRewardsMatchedFromSupplement,1);
 assert.equal(report.stillPendingSkillRows,0);
 assert.equal(report.releasedEventRecords,0);
 assert.equal(JSON.stringify(arg),before);
});
