'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {canonicalSupportUrl,selectIntakeTargets,resolveListedPages,LISTING}=
 require('../src/official_gametora_new_card_locator.cjs');
const plan=()=>({
 dataKind:'new-card-event-intake-plan',version:1,
 existingCatalogDigest:'a'.repeat(64),
 publicationApproved:false,sourceEventsPublishedAutomatically:false,
 existingDatabaseUnchanged:true,publishedEventsChanged:0,
 newlyObservedIds:['30322','30323'],alreadyImportedIds:[],
 carryForwardPendingIds:['30322','30323','30324']
});
test('select only two unimported new IDs and carry the rest to later visits',()=>{
 const q=selectIntakeTargets(plan());
 assert.deepEqual(q.targetCardIds,['30322','30323']);
 assert.deepEqual(q.unvisitedCardIds,['30324']);
 assert.equal(q.publicationApproved,false);
});
test('a future run with no new roster differences still revisits pending IDs',()=>{
 const p=plan();p.newlyObservedIds=[];
 p.alreadyImportedIds=['30322'];p.carryForwardPendingIds=['30323','30324'];
 assert.deepEqual(selectIntakeTargets(p,{limit:1}),
  {targetCardIds:['30323'],unvisitedCardIds:['30324'],
   sourceOnly:true,publicationApproved:false});
});
test('fail closed on malformed, mutated or already imported new-card plan',()=>{
 const p=plan();
 for(const patch of [
  {publicationApproved:true},{sourceEventsPublishedAutomatically:true},
  {existingDatabaseUnchanged:false},{publishedEventsChanged:1},
  {existingCatalogDigest:'bad'},
  {carryForwardPendingIds:['30322','30322']},
  {alreadyImportedIds:['30322']},
  {newlyObservedIds:['30001']}
 ])assert.throws(()=>selectIntakeTargets({...p,...patch}),/不正|一致|禁止/);
 assert.throws(()=>selectIntakeTargets(p,{limit:3}),/最大2枚/);
});
test('canonical URL is exact GameTora Japanese support-card route',()=>{
 assert.equal(LISTING,'https://gametora.com/ja/umamusume/supports');
 assert.deepEqual(canonicalSupportUrl('/ja/umamusume/supports/30323-azuma'),
  {cardId:'30323',url:'https://gametora.com/ja/umamusume/supports/30323-azuma'});
 assert.deepEqual(canonicalSupportUrl('https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun/'),
  {cardId:'30322',url:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun'});
 for(const href of [
  'https://gametora.com.evil.invalid/ja/umamusume/supports/30323-azuma',
  'https://evil.invalid/ja/umamusume/supports/30323-azuma',
  '//evil.invalid/ja/umamusume/supports/30323-azuma',
  'http://gametora.com/ja/umamusume/supports/30323-azuma',
  'https://gametora.com:444/ja/umamusume/supports/30323-azuma',
  '/en/umamusume/supports/30323-azuma',
  '/ja/umamusume/supports/30323-azuma?skip=1',
  '/ja/umamusume/supports/30323-azuma#e',
  '/ja/umamusume/supports/30323-azuma/other',
  '/ja/umamusume/supports/30323-',
  '/ja/umamusume/supports/3000-special',
  'javascript:alert(1)'
 ])assert.equal(canonicalSupportUrl(href),null,href);
});
test('resolve only requested IDs and leave absent cards pending without slug guesses',()=>{
 const links=[
  '/ja/umamusume/supports/30001-special-week',
  '/ja/umamusume/supports/30322-mayano-top-gun',
  'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun/',
  '/ja/umamusume/supports/99999-unrelated',
  'https://gametora.com.evil.invalid/ja/umamusume/supports/30323-azuma'
 ];
 const result=resolveListedPages({targetCardIds:['30322','30323'],hrefs:links});
 assert.deepEqual(result,[
  {cardId:'30322',status:'listed',
   url:'https://gametora.com/ja/umamusume/supports/30322-mayano-top-gun'},
  {cardId:'30323',status:'not-listed-yet',url:null}
 ]);
 assert.throws(()=>resolveListedPages({targetCardIds:['30322'],hrefs:[
  '/ja/umamusume/supports/30322-mayano-top-gun',
  '/ja/umamusume/supports/30322-incorrect-slug'
 ]}),/複数/);
 assert.throws(()=>resolveListedPages({targetCardIds:['30322','30323','30324'],hrefs:[]}),/一括/);
});
