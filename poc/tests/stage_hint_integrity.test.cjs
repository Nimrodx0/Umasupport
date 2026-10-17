'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compareStages,assertSnapshot,EFFORIA}=require('../tools/audit_stage_hint_integrity.cjs');
function fixture({hintSwitch=null,levelDrop=false,frequencyDrop=false}={}){
 const rows=[];
 for(let card=0;card<510;card++)for(let stage=0;stage<5;stage++){
  const f=Array(62).fill('0');
  f[0]=String(30000+card);f[1]='[架空試験用'+card+']競走馬'+card;f[3]='3';f[4]=String(stage);f[6]='スピード';
  f[23]=String(levelDrop&&card===0&&stage===4?0:1+stage);
  f[24]=String(frequencyDrop&&card===0&&stage===4?0:20+stage*10);
  f[49]='0';f[50]='0';f[59]=hintSwitch&&card===0&&stage===4?'直線巧者, イベントに無関係な追加ヒント':'直線巧者';
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
 assert.deepEqual(x.externalEfforia0to4,{id:'30000',present:true,levelPass:true,frequencyPass:true,
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
