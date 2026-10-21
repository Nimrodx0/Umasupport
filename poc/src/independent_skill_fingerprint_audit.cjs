'use strict';
/*
 * Compare numeric ID and the HASH of a historical Japanese skill name with a
 * second, newer metadata snapshot. No raw names are exported or auto-adopted.
 *
 * This is a cross-source METADATA comparison, not proof of a current game
 * effect, rarity meaning, copyright clearance, or user-visible release.
 */
const crypto=require('node:crypto');
const HISTORY_REV='5a8ec1356859a35e245edef0d40da740e652df68';
const GAME_TORA_REV='6e38b54af4fad397ff4491e63007a90705a4fe67';
const UMASIM_REV='cf9366f6a487bd8f197b53d8a11981207beb9f6c';
const INDEPENDENT_REV='0cacbb1aaf9dca10283d5b9ea20b205b9d204535';
const INDEPENDENT_SKILLS_BLOB='259601b5b0d3ef0be042164d5321fed72e821738';
const fail=s=>{throw Error('2026独立スキル名ハッシュ照合: '+s);};
const normalized=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
const fingerprint=s=>'sha256:'+crypto.createHash('sha256')
 .update(normalized(s),'utf8').digest('hex');
function gitBlobSha(bytes){
 const raw=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 const prefix=Buffer.from('blob '+raw.length+'\0','utf8');
 return crypto.createHash('sha1').update(prefix).update(raw).digest('hex');
}
function audit({historical,skills}){
 if(historical?.schemaVersion!==1||
    historical.dataKind!=='2025-historical-master-missing-2026-umasim-skill-ids'||
    historical.historicalMasterRevision!==HISTORY_REV||
    historical.sourceGameToraRevision!==GAME_TORA_REV||
    historical.sourceUmaSimSkillRevision!==UMASIM_REV||
    historical.game2026Verified!==false||
    historical.automaticAdoptionAllowed!==false||
    historical.rawTextIncluded!==false||
    !Array.isArray(historical.rows)||!Array.isArray(skills))
  fail('出典・承認状態の不一致');
 const source=new Map();
 for(const item of skills){
  if(!item||!Number.isSafeInteger(item.id)||item.id<=0||
     typeof item.name!=='string'||!normalized(item.name)||
     /[\u0000-\u001f]/.test(item.name)||
     !Number.isSafeInteger(item.rarity)||item.rarity<0||
     source.has(String(item.id)))
   fail('独立資料のID・名称・重複・分類値が不正');
  source.set(String(item.id),item);
 }
 const records=[],ids=new Set();
 let occurrenceSum=0;
 const totals={distinctIds:0,occurrences:0,presentIds:0,absentIds:0,
  nameFingerprintMatches:0,nameFingerprintMismatches:0,
  historicalNameUnavailable:0};
 for(const row of historical.rows){
  if(!row||typeof row.numericId!=='string'||
     !/^[1-9]\d*$/.test(row.numericId)||
     !Number.isSafeInteger(row.occurrences)||row.occurrences<1||
     ids.has(row.numericId))fail('2025年監査ID・出現件数が不正');
  ids.add(row.numericId);occurrenceSum+=row.occurrences;
  const recent=source.get(row.numericId);
  const isNamed=row.historicalStatus==='2025-ID-and-rarity-with-unique-JP-name';
  if(isNamed&&!/^sha256:[a-f0-9]{64}$/.test(row.historicalNameFingerprint||''))
   fail('2025年の日本語名ハッシュ欠損');
  const match=isNamed?(recent?fingerprint(recent.name)===row.historicalNameFingerprint:null):null;
  totals.distinctIds++;totals.occurrences+=row.occurrences;
  if(recent)totals.presentIds++;else totals.absentIds++;
  if(match===true)totals.nameFingerprintMatches++;
  else if(match===false)totals.nameFingerprintMismatches++;
  else if(!isNamed)totals.historicalNameUnavailable++;
  records.push({
   numericId:row.numericId,sourceMentions:row.occurrences,
   presentIn2026Metadata:!!recent,
   historicalNameFingerprintMatches:match,
   historicalStatus:row.historicalStatus,
   // Raw rarity codes are NOT normalized across datasets. In particular,
   // some minus skills use rarity=1 in this independent metadata snapshot.
   ...(recent?{independentRarityCodeUninterpreted:recent.rarity}:{}),
   game2026Verified:false,automaticAdoptionAllowed:false
  });
 }
 if(occurrenceSum!==historical.crosswalkMissingOccurrences||
    ids.size!==historical.crosswalkMissingDistinctIds)
  fail('旧マスター不足ID全件保存の検査に失敗');
 records.sort((a,b)=>Number(a.numericId)-Number(b.numericId));
 return {schemaVersion:1,dataKind:'independent-2026-metadata-skill-name-fingerprint-audit',
  sourcePins:{historicalMaster:HISTORY_REV,gameToraDerived:GAME_TORA_REV,
   umaSimSkills:UMASIM_REV,independentMetadata:INDEPENDENT_REV,
   independentSkillBlob:INDEPENDENT_SKILLS_BLOB},
  independentRecordCount:source.size,totals,records,
  rawSkillNamesIncluded:false,externalRaritySemanticsVerified:false,
  independentCurrentGameEvidence:false,game2026Verified:false,
  automaticAdoptionAllowed:false,publicationApproved:false};
}
module.exports={audit,gitBlobSha,fingerprint,
 INDEPENDENT_REV,INDEPENDENT_SKILLS_BLOB};
