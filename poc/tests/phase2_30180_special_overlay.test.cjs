'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {apply}=require('../src/phase2_30180_special_overlay.cjs');
const {accept}=require('../src/phase2_30180_loader.cjs');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture(){
 const catalog={schemaVersion:1,cards:[{cardId:'30180',coverageStatus:'partial',events:[
  {id:'gt-30180-event-001',name:'original',type:'auto',rewards:[]}
 ]}]};
 return {
  integrated:{dataKind:'phase2-2511-nonpublishing-gt-and-curated-chain-runtime',
   publicationApproved:false,reviewedEventsPublished:0,noAutomaticRuntimeAdoption:true,
   catalog,summary:{catalogSha256:hash(catalog),totalCandidateEvents:1}},
  priority:{dataKind:'phase2-16-remaining-checker-skill-priority',
   publicationApproved:false,summary:{P0:1},rows:[
    {cardId:'30180',checkerOrdinal:7,priority:'P0',
     candidateSkillIdsAbsentFromGTEventCatalog:['200332'],
     publicationApproved:false,missingActualEventVerified:false}
   ]}
 };
}
test('P0 numerical hint missing from GT events adds exactly one separately conditioned event',()=>{
 const f=fixture(),copy=structuredClone(f);
 const r=apply(f);
 assert.equal(r.summary.totalCandidateEvents,2);
 assert.equal(r.summary.appendedHintNumericId,'200332');
 assert.equal(r.summary.appendedHintLevel,1);
 assert.equal(r.summary.availabilityKind,'special-trigger');
 assert.equal(r.publicationApproved,false);
 assert.equal(r.catalog.cards[0].events.length,2);
 assert.deepEqual(r.catalog.cards[0].events[0],f.integrated.catalog.cards[0].events[0]);
 const e=r.catalog.cards[0].events[1];
 assert.equal(e.type,'auto');
 assert.equal(e.name,'あなたを想って');
 assert.equal(e.rewards[0].skillId,'skill:200332');
 assert.deepEqual(f,copy);
 assert.deepEqual(require('../data/reviewed_events.v1.json'),{schemaVersion:1,cards:[]});
});
test('production event loader attaches resolved skill names to disposable model',()=>{
 const f=fixture(),assembled=apply(f),card={id:'30180',hints:[],events:[]};
 const model={cards:[card],cardById:{'30180':card},skills:[],skillById:{},meta:{}};
 const skillText=JSON.stringify([{id:'200332',name:'コーナー巧者○',
  rarity:'normal',group:20033},...Array.from({length:110},(_,i)=>({
   id:String(990000+i),name:'test '+i,rarity:'normal',group:990000+i}))]);
 const r=accept({assembled,model,skillText});
 assert.equal(r.status,'PRIVATE_2512_FULL_LOADER_VERIFIED');
 assert.equal(r.events,2);assert.equal(r.cards,1);
 assert.equal(model.cardById['30180'].events.length,0);
});
test('altered source identity and unapproved publication fail closed',()=>{
 const changes=[
  f=>{f.integrated.publicationApproved=true},
  f=>{f.integrated.catalog.cards[0].events[0].name='changed'},
  f=>{f.priority.rows[0].checkerOrdinal=6},
  f=>{f.priority.rows[0].candidateSkillIdsAbsentFromGTEventCatalog=[]},
  f=>{f.priority.rows[0].publicationApproved=true},
  f=>{f.integrated.catalog.cards[0].events.push({
   id:'usl:30180:special:checker-007'})}
 ];
 for(const fn of changes){const f=fixture();fn(f);assert.throws(()=>apply(f),fn.toString())}
});
test('synthetic fixture cannot masquerade as fixed full 563 card 2512 event run',()=>{
 const f=fixture();
 assert.throws(()=>apply(f,{strict:true}),/固定563カード2512/);
 const a=apply(f),card={id:'30180',hints:[],events:[]};
 assert.throws(()=>accept({assembled:a,model:{cards:[card],cardById:{'30180':card},
  skillById:{},skills:[]},skillText:'x'.repeat(150)},{strict:true}));
});
