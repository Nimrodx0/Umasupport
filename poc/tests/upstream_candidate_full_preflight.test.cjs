'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {loadEvents,compareGt,inspectSource,rosterDiff,skillDiff,hintRegistryCoverage}=
 require('../src/upstream_candidate_full_preflight.cjs');
function event(id,term=false){
 return {id,section:'random',event_type:'pd',name:'SYNTHETIC',
  choices:[{label:'SYNTHETIC',random_either:false,
   effects:[{type:'speed',value:'+5'},...(term?[{type:'chain_end'}]:[])]}]};
}
const fixture=(id,extra=false)=>({
 id:Number(id),kind:'support',events_ja:{
  SYNTHETIC:event(1),...(extra?{SYNTHETIC2:event(2)}:{})
 }});
function withSource(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gt-preflight-synthetic-'));
 try{return fn(dir);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const source=(dir,docs)=>{
 for(const [id,doc] of docs)
  fs.writeFileSync(path.join(dir,'support_'+id+'.json'),JSON.stringify(doc));
 return loadEvents(dir);
};
test('normalizes every synthetic GT source card, route and effect without exposing event prose',()=>{
 withSource(dir=>{
  const src=source(dir,[['30001',fixture('30001')],['30002',fixture('30002',true)]]);
  const a=inspectSource(src);
  assert.equal(a.cards,2);
  assert.equal(a.cardsNormalized,2);
  assert.equal(a.events,3);
  assert.equal(a.choices,3);
  assert.equal(a.routes,3);
  assert.equal(a.shapeValidated,true);
  assert.deepEqual(a.rejectedCards,[]);
  assert.equal(JSON.stringify(a).includes('SYNTHETIC'),false);
 });
});
test('compares changed, added and removed full GT event blobs using source file bodies',()=>{
 withSource(dir=>{
  const base=source(dir,[['30001',fixture('30001')],['30002',fixture('30002')]]);
  fs.rmSync(path.join(dir,'support_30001.json'));
  const next=source(dir,[['30002',fixture('30002',true)],['30003',fixture('30003')]]);
  const diff=compareGt(base,next);
  assert.deepEqual(diff.added,['30003']);
  assert.deepEqual(diff.removed,['30001']);
  assert.deepEqual(diff.modified,['30002']);
  assert.deepEqual(diff.unchanged,[]);
 });
});
test('malformed event JSON or misleading support ID cannot silently enter candidate totals',()=>{
 withSource(dir=>{
  const d=source(dir,[['30001',fixture('30001')]]);
  d.docs.get('30001').events_ja.SYNTHETIC.choices=[];
  const report=inspectSource(d);
  assert.equal(report.shapeValidated,false);
  assert.deepEqual(report.rejectedCards,['30001']);
 });
 withSource(dir=>{
  fs.writeFileSync(path.join(dir,'support_30001.json'),JSON.stringify(fixture('30002')));
  assert.throws(()=>loadEvents(dir),/実イベントID/);
 });
});
const row=(id,stage,name='[合成]カード')=>{
 const fields=Array(62).fill('0');
 fields[0]=id;fields[1]=name;fields[2]='合成';fields[3]='3';
 fields[4]=String(stage);fields[6]='スピード';fields[59]='末脚';
 return fields.join('\t');
};
const cards=(ids)=>ids.flatMap(id=>
 Array.from({length:5},(_,stage)=>row(id,stage))).join('\n')+'\n';
const makeIds=n=>Array.from({length:n},(_,i)=>String(20000+i));
test('compares all 5 card stages, catches existing source edits and all skill IDs',()=>{
 const old=makeIds(500),current=[...old,'30322'];
 const change=rosterDiff(cards(old),cards(current));
 assert.equal(change.baselineCards,500);
 assert.equal(change.candidateCards,501);
 assert.deepEqual(change.added,['30322']);
 assert.deepEqual(change.removed,[]);
 assert.deepEqual(change.modified,[]);
 assert.equal(change.candidateStageRows,2505);
 const altered=cards(old).replaceAll('[合成]カード','[変更]カード');
 const revised=rosterDiff(cards(old),altered);
 assert.equal(revised.modified.length,500);
 const normal=ids=>JSON.stringify(ids.map((id,i)=>({
  id,name:'合成スキル'+i,rarity:'normal',group:i+1
 })));
 const skillids=makeIds(100);
 const sd=skillDiff(normal(skillids),normal([...skillids,'30999']));
 assert.equal(sd.baselineNumericIds,100);
 assert.equal(sd.candidateNumericIds,101);
 assert.deepEqual(sd.added,['30999']);
 assert.deepEqual(sd.removed,[]);
 assert.deepEqual(sd.modified,[]);
 const different=JSON.parse(normal(skillids));
 different[7].name='新しい名称';
 const revisedSkill=skillDiff(normal(skillids),JSON.stringify(different));
 assert.deepEqual(revisedSkill.modified,[skillids[7]]);
});

test('all five stage hints receive numeric crosswalk classification without guessing same-name IDs',()=>{
 const ids=makeIds(500);
 const cardText=cards(ids);
 const entries=Array.from({length:100},(_,i)=>({
  id:String(880000+i),name:'別スキル'+i,rarity:'normal',group:i+1
 }));
 entries[0].name='末脚';
 const coverage=hintRegistryCoverage(cardText,JSON.stringify(entries));
 assert.equal(coverage.hintStageOccurrences,2500);
 assert.equal(coverage.uniqueNormalSkillIds,2500);
 assert.equal(coverage.missingRegistryNames,0);
 assert.equal(coverage.ambiguousOrNonNormalIds,0);
 entries.push({id:'999999',name:'末脚',rarity:'normal',group:1000});
 const ambiguous=hintRegistryCoverage(cardText,JSON.stringify(entries));
 assert.equal(ambiguous.uniqueNormalSkillIds,0);
 assert.equal(ambiguous.ambiguousOrNonNormalIds,2500);
 assert.equal(ambiguous.cardsWithUnresolvedHints.length,500);
 entries.pop();entries[0].name='別の名前';
 const absent=hintRegistryCoverage(cardText,JSON.stringify(entries));
 assert.equal(absent.missingRegistryNames,2500);
});
