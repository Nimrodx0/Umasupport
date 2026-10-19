'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const inv=require('../src/curated_event_inventory.cjs');
const base=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const index=read('poc/data/curation/source_index.v1.json');
const SKILLS=require('../src/efforia30311_review_preview.cjs').SKILLS;
function env(){
 const other=Array.from({length:561},(_,i)=>({
  id:String(20001+i),name:'架空'+i,rarity:'SR',events:[],hints:[]
 }));
 const cards=[
  {id:'10016',name:'[トレセン学園]ウイニングチケット',rarity:'R',events:[],hints:[]},
  {id:'30311',name:'[As if Guided]エフフォーリア',rarity:'SSR',events:[],hints:[]},
  ...other
 ];
 const skills=[
  {id:'hint:差しコーナー○',name:'差しコーナー○',tier:'white'}
 ];
 const model={cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),
  skills,skillById:Object.fromEntries(skills.map(s=>[s.id,s])),meta:{}};
 const dictionary=JSON.stringify([
  ...Object.entries(SKILLS).map(([id,name],i)=>({
   id,name,rarity:'normal',group:50000+i
  })),
  ...Array.from({length:110},(_,i)=>({
   id:String(700000+i),name:'人工無関係'+i,rarity:'normal',group:70000+i
  }))
 ]);
 const drafts=Object.fromEntries(index.cards.map(c=>[c.draftFile,read(c.draftFile)]));
 const released=read('poc/data/reviewed_events.v1.json');
 return {model,drafts,publicCatalog:released,skillText:dictionary,
  index:JSON.parse(JSON.stringify(index))};
}
test('2 GameWith-first draft cards / 7 candidate events among 563 roster; zero publication',()=>{
 const input=env();
 const prev=JSON.stringify(input.model);
 const got=inv.audit(input);
 assert.equal(got.rosterCards,563);
 assert.equal(got.sourceIndexedCards,2);
 assert.equal(got.draftCards,2);
 assert.equal(got.draftEventRecords,7);
 assert.equal(got.untrackedCards,561);
 assert.equal(got.releasedCards,0);
 assert.equal(got.releasedEventRecords,0);
 assert.deepEqual(got.indexedByRarity,{R:1,SR:0,SSR:1});
 assert.equal(JSON.stringify(input.model),prev,'auditing must not mutate live model or mark drafts published');
});
test('editorial source index rejects duplicate IDs, wrong URL, invalid date, complete or published claims, traversal',()=>{
 for(const change of [
  v=>v.cards.push({...v.cards[0]}),
  v=>v.cards[0].primaryArticle='https://evil.example/article/show/257587',
  v=>v.cards[0].primaryArticle='https://gamewith.jp/uma-musume/article/show/257587?src=copy',
  v=>v.cards[0].articleCheckedAt='2026-02-30',
  v=>v.cards[0].recordStatus='reviewed',
  v=>v.cards[0].coverageStatus='complete',
  v=>v.cards[0].draftFile='../../other.json',
  v=>v.cards[0].cardId='123',
  v=>v.cards[0].draftFile=v.cards[1].draftFile
 ]){
  const altered=JSON.parse(JSON.stringify(index));change(altered);
  assert.throws(()=>inv.validateIndex(altered));
 }
});
test('rejects draft without matching card, unrelated event ID, missing skill and made-up branches',()=>{
 for(const change of [
  v=>v.drafts[index.cards[0].draftFile].cards[0].cardId='90001',
  v=>v.drafts[index.cards[0].draftFile].cards[0].coverageStatus='complete',
  v=>v.drafts[index.cards[0].draftFile].cards[0].events[0].id='draft_30001_wrong',
  v=>v.drafts[index.cards[0].draftFile].cards[0].events[0].choices[0].rewards[0].skillId='hint:未確認のスキル',
  v=>v.drafts[index.cards[1].draftFile].cards[0].events[0].choices.push({id:'option1',label:'重複'}),
  v=>v.index.cards[0].cardId='99999',
  v=>v.drafts[index.cards[0].draftFile]={schemaVersion:1,cards:[]},
  v=>v.skillText='[]'
 ]){
  const input=env();change(input);
  assert.throws(()=>inv.audit(input));
 }
});
test('released entries cannot bypass curation index even when structurally legal',()=>{
 const input=env();
 input.publicCatalog.cards=[{cardId:'20001',coverageStatus:'partial',events:[]}];
 assert.throws(()=>inv.audit(input.publicCatalog?input:null),/公開DBのカードが独自出典索引/);
});
