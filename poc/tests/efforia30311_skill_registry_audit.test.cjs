const {test}=require('node:test');
const assert=require('node:assert/strict');
const preview=require('../src/efforia30311_review_preview.cjs');
const {auditSkillRegistry}=require('../src/efforia30311_skill_registry_audit.cjs');
function registry(){
 return [
  ...Object.entries(preview.SKILLS).map(([id,name],i)=>({
   id,name,rarity:i%2===0?'normal':'rare',group:20300+i
  })),
  ...Array.from({length:115},(_,i)=>({id:String(700000+i),name:'架空'+i,
   rarity:'normal',group:70000+i}))
 ];
}
const text=records=>JSON.stringify(records);
test('all eight preview numeric IDs and eighteen hint records match registry',()=>{
 const r=auditSkillRegistry(text(registry()));
 assert.deepEqual(r,{cardId:'30311',verifiedNumericSkillIds:8,previewSkillHintRows:18,
   sourceRegistryRecordCount:123,isCurrentGameRewardVerified:false,isPublicationApproved:false});
});
test('missing, changed, malformed and duplicate numeric skill registry fails closed',()=>{
 const full=registry();
 const missed=full.filter(r=>r.id!=='204532');
 assert.throws(()=>auditSkillRegistry(text(missed)),/absent or changed/);
 const mutated=registry();mutated[0].name='別名';
 assert.throws(()=>auditSkillRegistry(text(mutated)),/absent or changed/);
 const invalid=registry();invalid[0].rarity='unreviewed';
 assert.throws(()=>auditSkillRegistry(text(invalid)),/Unexpected skill rarity/);
 const duplicate=registry();duplicate[1].id=duplicate[0].id;
 assert.throws(()=>auditSkillRegistry(text(duplicate)),/数値ID重複/);
});
