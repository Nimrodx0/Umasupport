'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compareStages,assertSnapshot,EFFORIA,EXTERNAL_REFERENCES,EXPECTED_UMASIM_SHA256}=require('../tools/audit_stage_hint_integrity.cjs');
function fixture({hintSwitch=null,levelDrop=false,frequencyDrop=false,uniqueFrequency=0}={}){
 const rows=[];
 for(let card=0;card<510;card++)for(let stage=0;stage<5;stage++){
  const f=Array(62).fill('0');
  f[0]=String(30000+card);f[1]='[架空試験用'+card+']競走馬'+card;f[3]='3';f[4]=String(stage);f[6]='スピード';
  f[23]=String(levelDrop&&card===0&&stage===4?0:1+stage);
  f[24]=String(frequencyDrop&&card===0&&stage===4?0:20+stage*10);
  f[49]='0';f[50]=String(uniqueFrequency);f[59]=hintSwitch&&card===0&&stage===4?'直線巧者, イベントに無関係な追加ヒント':'直線巧者';
  rows.push(f.join('\t'));
 }
 return rows.join('\n');
}
test('identical normal hint lists across stages are counted independently',()=>{
 const x=compareStages(fixture());
 assert.deepEqual(x.hintsByStage,[510,510,510,510,510]);
 assert.deepEqual(x.cardsWithStageHintChanges,[0,0,0,0,0]);
 assert.equal(x.stageAddedHintLinks,0);
 assert.equal(x.cardsWithHintLevelDecreases,0);
});
test('new stage-only normal hint is reported, not silently merged',()=>{
 const x=compareStages(fixture({hintSwitch:true}));
 assert.equal(x.cardsWithStageHintChanges[4],1);
 assert.equal(x.stageAddedHintLinks,1);
 assert.throws(()=>assertSnapshot(x),/Publisher/);
});
test('stage performance decreases are separately reported for review',()=>{
 const x=compareStages(fixture({levelDrop:true,frequencyDrop:true}));
 assert.equal(x.cardsWithHintLevelDecreases,1);
 assert.equal(x.cardsWithFrequencyDecreases,1);
 assert.ok(x.issues.some(y=>y.type==='lower-hint-frequency'));
});
test('independent third-party performance reference compares all 0-4 limits exactly',()=>{
 const x=compareStages(fixture(),{reference:{id:'30000',
   hintLevels:[1,2,3,4,5],hintFrequencies:[20,30,40,50,60]}});
 assert.deepEqual(x.externalEfforia0to4,{id:'30000',basis:'total',present:true,namePass:true,levelPass:true,frequencyPass:true,rarityPass:true,
  levelMismatchStages:[],frequencyMismatchStages:[]});
 const y=compareStages(fixture(),{reference:{id:'30000',
   hintLevels:[1,2,3,4,9],hintFrequencies:[20,30,40,50,60]}});
 assert.equal(y.externalEfforia0to4.levelPass,false);
 assert.deepEqual(y.externalEfforia0to4.levelMismatchStages,[4]);
 assert.deepEqual(EFFORIA.hintLevels,[2,2,3,3,4]);
});
test('missing reference fails closed',()=>{
 const x=compareStages(fixture(),{reference:{id:'99999',hintLevels:[0,0,0,0,0],hintFrequencies:[0,0,0,0,0]}});
 assert.equal(x.externalEfforia0to4.present,false);
 assert.throws(()=>assertSnapshot(x),/population drift/);
});

test('twelve cited references include SSR, SR and R with distinct IDs and all 0..4 stage values',()=>{
 assert.equal(EXTERNAL_REFERENCES.length,12);
 assert.equal(new Set(EXTERNAL_REFERENCES.map(r=>r.id)).size,6);
 for(const r of EXTERNAL_REFERENCES){
  assert.match(r.name,/^\[.+\].+/);
  assert.match(r.url,/^https:\/\/gamewith\.jp\/uma-musume\/article\/show\/\d+$/);
  assert.ok(['SSR','SR','R'].includes(r.rarity));
  assert.equal(r.id[0],{R:'1',SR:'2',SSR:'3'}[r.rarity]);
  assert.equal(r.hintLevels.length,5);
  assert.equal(r.hintFrequencies.length,5);
 }
 assert.equal(EXTERNAL_REFERENCES.filter(r=>r.basis==='base').length,7);
 assert.deepEqual(Object.fromEntries(['SSR','SR','R'].map(x=>[x,EXTERNAL_REFERENCES.filter(r=>r.rarity===x).length])),{SSR:6,SR:5,R:1});
 assert.match(EXPECTED_UMASIM_SHA256,/^[0-9a-f]{64}$/);
 assert.equal(EXTERNAL_REFERENCES.length*2*5,120);
});
test('base-only GameWith support effect is not confused with the extra fixed unique bonus',()=>{
 const raw=fixture({uniqueFrequency:20});
 const base={id:'30000',name:'[架空試験用0]競走馬0',basis:'base',
   hintLevels:[1,2,3,4,5],hintFrequencies:[20,30,40,50,60]};
 const x=compareStages(raw,{references:[base]});
 assert.equal(x.externalReferences[0].namePass,true);
 assert.equal(x.externalReferences[0].frequencyPass,true);
 assert.equal(x.externalNumericValues,10);
 const total=compareStages(raw,{references:[{...base,basis:'total'}]});
 assert.equal(total.externalReferences[0].levelPass,true);
 assert.equal(total.externalReferences[0].frequencyPass,false);
 assert.deepEqual(total.externalReferences[0].frequencyMismatchStages,[0,1,2,3,4]);
});
test('reference identities and all selected levels must match rather than cherry-picked endpoints',()=>{
 const base={id:'30000',name:'[different-card]競走馬0',basis:'total',
  hintLevels:[1,2,3,4,5],hintFrequencies:[20,30,40,50,60]};
 const result=compareStages(fixture(),{references:[base]});
 assert.equal(result.externalReferences[0].namePass,false);
 assert.equal(result.externalReferences[0].levelPass,true);
 assert.equal(result.externalReferences[0].frequencyPass,true);
 const middle=compareStages(fixture(),{references:[{...base,name:'[架空試験用0]競走馬0',
  hintLevels:[1,2,99,4,5]}]});
 assert.deepEqual(middle.externalReferences[0].levelMismatchStages,[2]);
});
test('empty, duplicated and malformed reference sets fail closed',()=>{
 const ref={id:'30000',hintLevels:[1,2,3,4,5],hintFrequencies:[20,30,40,50,60]};
 assert.throws(()=>compareStages(fixture(),{references:[]}),/Independent reference/);
 assert.throws(()=>compareStages(fixture(),{references:[ref,ref]}),/duplicate/);
 assert.throws(()=>compareStages(fixture(),{references:[{...ref,hintLevels:[1,2,3]}]}),/Invalid independent/);
});

test('rarity mismatch fails the card identity gate even if every numerical cell matches',()=>{
 const ref={id:'30000',name:'[架空試験用0]競走馬0',rarity:'SR',basis:'total',
  hintLevels:[1,2,3,4,5],hintFrequencies:[20,30,40,50,60]};
 const r=compareStages(fixture(),{references:[ref]}).externalReferences[0];
 assert.equal(r.namePass,true);
 assert.equal(r.levelPass,true);
 assert.equal(r.frequencyPass,true);
 assert.equal(r.rarityPass,false);
 assert.throws(()=>compareStages(fixture(),{references:[{...ref,rarity:'X'}]}),/Invalid independent/);
});
test('numerical data in six new SR/R references is pinned at all five stages',()=>{
 const expected={
  '20097':[[2,2,2,2,2],[30,32,35,37,40]],
  '20098':[[2,2,2,2,2],[30,32,35,37,40]],
  '20081':[[1,1,1,2,2],[20,23,26,30,30]],
  '20020':[[2,2,2,2,3],[40,42,45,47,50]],
  '20048':[[2,2,2,2,2],[30,32,35,37,40]],
  '10025':[[2,2,2,2,2],[30,32,35,37,40]]
 };
 assert.deepEqual(EXTERNAL_REFERENCES.filter(r=>r.rarity!=='SSR').map(r=>r.id).sort(),
  Object.keys(expected).sort());
 for(const r of EXTERNAL_REFERENCES.filter(r=>r.rarity!=='SSR')){
  assert.deepEqual([r.hintLevels,r.hintFrequencies],expected[r.id],r.id);
  assert.equal(r.basis,'base',r.id);
 }
});
