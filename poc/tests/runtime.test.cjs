const {test}=require('node:test');
const assert=require('node:assert/strict');
const loader=require('../src/live_loader.js');
function fixture(){
 const v=[];
 for(let i=1;i<=510;i++)for(let stage=0;stage<=4;stage++){
  const row=Array(62).fill('0');row[0]=String(10000+i);row[1]='[試験用カード'+i+']架空トレーナー'+i;
  row[3]='3';row[4]=String(stage);row[6]='スピード';row[59]='直線巧者, 尻尾上がり';row[60]='';row[61]='';v.push(row.join('\t'));
 }
 return v.join('\n');
}
const valid=fixture();
test('direct source can be parsed and model counts match',()=>{
 const m=loader.buildModel(valid);
 assert.equal(m.cards.length,510);assert.equal(m.meta.totalHints,1020);
 assert.equal(m.skills.length,2);assert.equal(m.cards[0].events.length,0);
 assert.equal(m.cards[0].hintsByStage[4].length,2);
});
test('network first, offline fallback, and malformed update does not overwrite cache',async()=>{
 let record=null;const store={get:async()=>record,put:async d=>{record=d}};
 let fetchImpl=async()=>({ok:true,text:async()=>valid});
 const got=await loader.load({fetchImpl,store,now:()=>"2026-10-16T05:00:00.000Z"});
 assert.equal(got.mode,'online');assert.ok(record?.text);
 fetchImpl=async()=>{throw new Error('offline')};
 const cached=await loader.load({fetchImpl,store});assert.equal(cached.mode,'cached');
 fetchImpl=async()=>({ok:true,text:async()=>valid.slice(0,3000)});
 const partial=await loader.load({fetchImpl,store});assert.equal(partial.mode,'cached');
 assert.equal(record.text,valid);
});
test('initial load without network or cache emits meaningful failure',async()=>{
 await assert.rejects(loader.load({fetchImpl:async()=>{throw new Error('offline')},store:{get:async()=>null,put:async()=>{}}}),/データ取得に失敗/);
});
test('rejects structurally complete but duplicate stage',()=>{
 const rows=valid.split('\n');rows[1]=rows[0];
 assert.throws(()=>loader.parseSupportCards(rows.join('\n')),/段階または属性/);
});
