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
 '10002':'R','10016':'R','10047':'R','10073':'R','10125':'R','10132':'R',
 '20023':'SR','20029':'SR','30311':'SSR'
};
const hintNames=['差しコーナー○','左回り○','直線巧者','後方釘付','前列狙い','ペースアップ',
 'ラッキーセブン','おひとり様○','冷静','一匹狼','ギアシフト','ウマ好み'];
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
  ...Array.from({length:110},(_,i)=>({
   id:String(700000+i),name:'架空辞書'+i,rarity:'normal',group:70000+i
  }))
 ]);
 return {model,index:JSON.parse(JSON.stringify(index)),skillText:dictionary,
  draftCatalogs:Object.fromEntries(index.cards.map(c=>[c.draftFile,read(c.draftFile)])),
  publicCatalog:read('poc/data/reviewed_events.v1.json')};
}
test('9 direct GameWith article-linked card drafts, 24 events / 563 full-card test roster, 0 released',()=>{
 const arg=input(),before=JSON.stringify(arg.model);
 const report=inventory.audit(arg);
 assert.equal(report.rosterCards,563);
 assert.equal(report.sourceIndexedCards,9);
 assert.equal(report.draftCards,9);
 assert.equal(report.draftEventRecords,24);
 assert.equal(report.untrackedCards,554);
 assert.equal(report.releasedEventRecords,0);
 assert.deepEqual(report.indexedByRarity,{R:6,SR:2,SSR:1});
 assert.equal(JSON.stringify(arg.model),before,'an audit cannot mutate the live model');
});
test('SR Pearl terminal choice blocks chained unconditional event and no unknown-skill event is silently included',()=>{
 const args=input(),p=args.draftCatalogs['poc/data/curation/drafts/20029.v1.json'].cards[0];
 assert.equal(p.events.length,3);
 const first=p.events.find(e=>e.id==='draft_20029_chain_01');
 const second=p.events.find(e=>e.id==='draft_20029_chain_02');
 assert.equal(first.choices.length,3);
 assert.equal(first.choices[2].terminal,true);
 assert.deepEqual(second.requires,{all:[{eventId:first.id}]});
 assert.equal(second.type,'auto');
 assert.deepEqual(second.rewards,[{skillId:'hint:ギアシフト',level:1}]);
 assert.equal(p.events.some(e=>e.id==='draft_20029_normal_01'),false);
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
  a=>a.draftCatalogs[winning].cards[0].events[0].choices[0].rewards[0].skillId='hint:でたらめ',
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

test('six R card article-derived event choices have fixed ordinal skill and hint level positions',()=>{
 const arg=input();
 const expected={
  '10002':[[1,1,'左回り○',1]],
  '10016':[[0,0,'差しコーナー○',1]],
  '10047':[[1,0,'ペースアップ',1]],
  '10073':[[1,1,'後方釘付',1]],
  '10125':[[0,1,'前列狙い',1]],
  '10132':[[0,0,'直線巧者',1]]
 };
 for(const [cardId,positions] of Object.entries(expected)){
  const events=arg.draftCatalogs['poc/data/curation/drafts/'+cardId+'.v1.json'].cards[0].events;
  assert.equal(events.length,2,cardId);
  assert.ok(events.every(e=>e.type==='choice'&&e.choices.length===2),cardId);
  const facts=events.flatMap((e,i)=>e.choices.flatMap((c,j)=>(c.rewards||[])
    .map(x=>[i,j,x.skillId.slice(5),x.level])));
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
 assert.deepEqual(pearl[2].choices[1].rewards,[{skillId:'hint:ウマ好み',level:3}]);
});
