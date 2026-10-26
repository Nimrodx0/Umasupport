'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,gitBlobSha,POLICY}=require('../src/current_umasim_roster_delta.cjs');
function row(id,stage,{name='[参照用]架空',hint='末脚'}={}){
 const fields=Array(62).fill('0');
 Object.assign(fields,{0:id,1:name,2:'架空',3:'2',4:String(stage),
  5:'40',6:'スピード',59:hint});
 return fields.join('\t');
}
const prior=Array.from({length:500},(_,i)=>
 String(10000+i)).flatMap(id=>
  Array.from({length:5},(_,stage)=>row(id,stage)));
const newer=prior.concat(Array.from({length:5},(_,stage)=>
 row('30001',stage,{name:'[追加]新カード',hint:'末脚, 一匹狼'})));
test('pin audit compares complete cards and uses the actual live-loader model',()=>{
 const r=audit({beforeText:prior.join('\n')+'\n',afterText:newer.join('\n')+'\n'});
 assert.equal(r.beforeCards,500);
 assert.equal(r.afterCards,501);
 assert.equal(r.oldCardStageRows,2500);
 assert.equal(r.newCardStageRows,2505);
 assert.deepEqual(r.added,[{id:'30001',name:'[追加]新カード',
  rarity:'SR',type:'スピード'}]);
 assert.equal(r.publicLiveLoaderCards,501);
 assert.equal(r.sourceDataRedistributed,false);
 assert.equal(r.newCardsHaveReviewedEvents,false);
 assert.equal(r.publicationApprovedEvents,0);
 const serialized=JSON.stringify(r);
 assert.equal(serialized.includes('架空'),false);
 assert.equal(serialized.includes('一匹狼'),false);
});
test('silent revisions to existing hints / card identity or deleted cards fail closed',()=>{
 const base=prior.join('\n')+'\n';
 for(const mutant of [
  newer.map((line,i)=>i===4?line.replace('末脚','末脚,逃げ直線○'):line),
  newer.map((line,i)=>i===5?line.replace('[参照用]架空','[差し替え]'):line),
  newer.filter(l=>!l.startsWith('10042\t'))
 ]){
  assert.throws(()=>audit({beforeText:base,afterText:mutant.join('\n')+'\n'}),
   /母集団の差分監査|性能解放データが不足/);
 }
});
test('invalid TSV release, missing stages, duplicate stage, wrong SHA or wrong pinned population are rejected',()=>{
 const old=prior.join('\n')+'\n',curr=newer.join('\n')+'\n';
 const broken=[
  newer.filter(l=>!l.startsWith('30001\t')||!l.split('\t')[4].includes('4')),
  newer.map((l,i)=>i===2501?newer[2500]:l),
  newer.map((l,i)=>i===2500?l.replace('\tスピード\t','\tunknown\t'):l)
 ];
 for(const rows of broken)
  assert.throws(()=>audit({beforeText:old,afterText:rows.join('\n')+'\n'}),
   /性能解放|段階|形式|カード|ヒント/);
 assert.throws(()=>audit({beforeText:old,afterText:curr},{strict:true}),
  /Git blob SHA-1/);
 assert.equal(typeof gitBlobSha(curr),'string');
 assert.equal(gitBlobSha(curr).length,40);
 assert.equal(POLICY.beforeCount,563);
 assert.equal(POLICY.afterCount,566);
 assert.deepEqual(POLICY.expectedNewIds,['10149','30322','30323']);
});
