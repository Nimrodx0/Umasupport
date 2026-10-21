'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildIndependentPreview}=require('../src/independent_2026_skill_dry_run.cjs');
const {fingerprint}=require('../src/independent_skill_fingerprint_audit.cjs');
const SKILL_REV='cf9366f6a487bd8f197b53d8a11981207beb9f6c';
const GT_REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
const OLD_REV='5a8ec1356859a35e245edef0d40da740e652df68';
function fixture(){
 const items=Array.from({length:28},(_,i)=>({
  id:String(200800+i),
  occurrences:i<23?3:2,
  name:'架空の匿名スキル'+i,
  rarity:i%2===0?1:2
 }));
 const crosswalk={dataKind:'gametora-event-skill-crosswalk-draft',
  releaseApproved:false,sourcePins:{gameToraDerived:GT_REV,umaSimSkills:SKILL_REV},
  stats:{missingPinnedSkillIds:79},
  unresolved:items.flatMap(x=>Array.from({length:x.occurrences},
   ()=>({reason:'not-in-pinned-umasim-registry',numericId:x.id})))};
 const historicalReport={schemaVersion:1,
  dataKind:'2025-historical-master-missing-2026-umasim-skill-ids',
  historicalMasterRevision:OLD_REV,sourceGameToraRevision:GT_REV,
  sourceUmaSimSkillRevision:SKILL_REV,crosswalkMissingOccurrences:79,
  crosswalkMissingDistinctIds:28,game2026Verified:false,
  automaticAdoptionAllowed:false,rawTextIncluded:false,
  rows:items.map(x=>({numericId:x.id,occurrences:x.occurrences,
   historicalStatus:'2025-ID-and-rarity-with-unique-JP-name',
   historicalRarity:x.rarity,
   historicalNameFingerprint:fingerprint(x.name)}))};
 const independentSkills=items.map(x=>({id:Number(x.id),name:x.name,rarity:1}));
 return {mergedSkillText:JSON.stringify([{id:'200532',name:'既存',rarity:'normal',group:20053}]),
  historicalReport,independentSkills,crosswalk};
}
test('private 2026 names independently fingerprint verified; 2025 numeric rarity stays explicit',()=>{
 const input=fixture();
 const x=buildIndependentPreview(input);
 const names=JSON.parse(x.mergedSkillText);
 assert.equal(x.previewIds.size,28);
 assert.equal(names.length,29);
 assert.equal(names.filter(x=>x.rarity==='normal').length,15);
 assert.equal(names.filter(x=>x.rarity==='rare').length,14);
 assert.equal(x.historicalNumericClassificationOnly,true);
 assert.equal(x.independent2026MetadataIsNotGameVerification,true);
 assert.equal(x.sourceNameRevision,'0cacbb1aaf9dca10283d5b9ea20b205b9d204535');
 assert.equal(JSON.stringify(input.historicalReport).includes('架空の匿名スキル'),false);
});
test('independent name, missing ID, incorrect old rarity, erroneous counts fail closed',()=>{
 const attacks=[
  x=>{x.independentSkills[0].name='異なる名称';},
  x=>{x.independentSkills.shift();},
  x=>{x.historicalReport.rows[0].historicalRarity=6;},
  x=>{x.historicalReport.rows[0].historicalNameFingerprint='sha256:abc';},
  x=>{x.crosswalk.unresolved.pop();},
  x=>{x.historicalReport.game2026Verified=true;},
  x=>{x.crosswalk.releaseApproved=true;},
  x=>{x.mergedSkillText=JSON.stringify([{id:'200800',name:'既存',rarity:'normal',group:20080}]);}
 ];
 for(const attack of attacks){
  const x=fixture();attack(x);
  assert.throws(()=>buildIndependentPreview(x));
 }
});
