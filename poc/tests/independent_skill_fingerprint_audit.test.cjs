'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {audit,gitBlobSha,fingerprint}=require('../src/independent_skill_fingerprint_audit.cjs');
const base=()=>({
 schemaVersion:1,dataKind:'2025-historical-master-missing-2026-umasim-skill-ids',
 historicalMasterRevision:'5a8ec1356859a35e245edef0d40da740e652df68',
 sourceGameToraRevision:'6e38b54af4fad397ff4491e63007a90705a4fe67',
 sourceUmaSimSkillRevision:'cf9366f6a487bd8f197b53d8a11981207beb9f6c',
 crosswalkMissingOccurrences:3,crosswalkMissingDistinctIds:2,
 game2026Verified:false,automaticAdoptionAllowed:false,rawTextIncluded:false,
 rows:[
  {numericId:'200831',occurrences:2,historicalStatus:'2025-ID-and-rarity-with-unique-JP-name',
   historicalNameFingerprint:fingerprint('   けん制\u3000A ')},
  {numericId:'201121',occurrences:1,historicalStatus:'2025-ID-and-rarity-with-unique-JP-name',
   historicalNameFingerprint:fingerprint('金ヒント')}
 ]
});
test('numeric ID and NFKC Japanese name fingerprint match without copying source names',()=>{
 const got=audit({historical:base(),skills:[
  {id:200831,name:'けん制 A',rarity:1},
  {id:201121,name:'金ヒント',rarity:2},
  {id:200283,name:'マイナススキル',rarity:1}
 ]});
 assert.deepEqual(got.totals,{distinctIds:2,occurrences:3,
  presentIds:2,absentIds:0,nameFingerprintMatches:2,
  nameFingerprintMismatches:0,historicalNameUnavailable:0});
 assert.equal(got.records[0].independentRarityCodeUninterpreted,1);
 assert.equal(got.rawSkillNamesIncluded,false);
 assert.equal(got.independentCurrentGameEvidence,false);
 assert.equal(got.automaticAdoptionAllowed,false);
 assert.equal(got.publicationApproved,false);
 assert.ok(!JSON.stringify(got).includes('けん制'));
 assert.ok(!JSON.stringify(got).includes('金ヒント'));
 assert.ok(!JSON.stringify(got).includes('マイナス'));
});
test('2026 independent name disagreements and absences are visible, never silently accepted',()=>{
 const x=audit({historical:base(),skills:[{id:200831,name:'違う',rarity:1}]});
 assert.equal(x.totals.presentIds,1);
 assert.equal(x.totals.absentIds,1);
 assert.equal(x.totals.nameFingerprintMismatches,1);
 assert.equal(x.records[1].historicalNameFingerprintMatches,null);
 assert.equal(x.records[0].historicalNameFingerprintMatches,false);
});
test('source tampering, duplicate IDs and inconsistent 2025 totals fail closed',()=>{
 const bad=[
  [h=>{h.game2026Verified=true},null],
  [h=>{h.crosswalkMissingOccurrences=2},null],
  [h=>{h.rows.push({...h.rows[0]})},null],
  [h=>{h.rows[0].historicalNameFingerprint='no hash'},null],
  [()=>{},[{id:200831,name:'OK',rarity:1},{id:200831,name:'duplicate',rarity:1}]],
  [()=>{},[{id:200831,name:'',rarity:1}]]
 ];
 for(const [change,skills]of bad){
  const h=base();change(h);
  assert.throws(()=>audit({historical:h,skills:skills||[]}),/照合/);
 }
});
test('rarity code 1 does not assert a positive skill or override minus classification',()=>{
 const h=base();
 const x=audit({historical:h,skills:[
  {id:200831,name:'けん制 A',rarity:1},
  {id:201121,name:'金ヒント',rarity:2},
  {id:200283,name:'minus',rarity:1}
 ]});
 assert.equal(x.externalRaritySemanticsVerified,false);
 assert.equal(x.records.some(r=>r.numericId==='200283'),false);
});
test('Git blob check uses byte size, not UTF-16 character length',()=>{
 const bytes=Buffer.from('日本語\n','utf8');
 const expected=require('node:crypto').createHash('sha1')
  .update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(gitBlobSha(bytes),expected);
});
