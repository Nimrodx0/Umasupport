'use strict';
/* TEMPORARY historical ID/name corroboration for offline schema dry runs.
 *
 * The 2025 master is one year older than the GameTora event source and cannot
 * certify 2026 names, effects, or public rights. This code may only augment a
 * memory-only, never-released skill registry after a pinned-master proof.
 */
const crypto=require('node:crypto');
const bridge=require('./skill_bridge.js');
const {CANONICAL_SOURCE_REV}=require('./gametora_event_skill_crosswalk.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const MASTER_SHA='46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb';
const MASTER_REV='5a8ec1356859a35e245edef0d40da740e652df68';
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=x=>{throw Error('2025年スキル暫定照合: '+x);};
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const digest=x=>'sha256:'+crypto.createHash('sha256').update(x).digest('hex');
function buildHistoricalPreview({mergedSkillText,report,privateRecords,crosswalk}){
 if(!obj(report)||report.schemaVersion!==1||
    report.dataKind!=='2025-historical-master-missing-2026-umasim-skill-ids'||
    report.historicalMasterRevision!==MASTER_REV||
    report.sourceGameToraRevision!==POLICY.baselineRevision||
    report.sourceUmaSimSkillRevision!==CANONICAL_SOURCE_REV||
    report.game2026Verified!==false||report.automaticAdoptionAllowed!==false||
    !Array.isArray(report.rows)||
    !obj(privateRecords)||privateRecords.schemaVersion!==1||
    privateRecords.dataKind!=='historical-2025-skill-preview-private-runner-only'||
    privateRecords.historicalMasterSha256!==MASTER_SHA||
    privateRecords.historicalMasterRevision!==MASTER_REV||
    privateRecords.game2026Verified!==false||privateRecords.publicationAllowed!==false||
    !Array.isArray(privateRecords.skills)||
    crosswalk?.dataKind!=='gametora-event-skill-crosswalk-draft'||
    crosswalk.sourcePins?.gameToraDerived!==POLICY.baselineRevision||
    crosswalk.stats?.missingPinnedSkillIds!==report.crosswalkMissingOccurrences)
  fail('出典・年代・非公開の審査情報が不正');
 const ids=new Map();
 for(const row of report.rows){
  if(!obj(row)||typeof row.numericId!=='string'||ids.has(row.numericId)||
     !/^[1-9]\d*$/.test(row.numericId)||!Number.isSafeInteger(row.occurrences)||
     row.occurrences<1)fail('監査レコードの数値IDが不正または重複');
  ids.set(row.numericId,row);
 }
 const idsExpected=new Map();
 for(const unresolved of crosswalk.unresolved||[]){
  if(unresolved.reason!=='not-in-pinned-umasim-registry')continue;
  const v=idsExpected.get(unresolved.numericId)||0;
  idsExpected.set(unresolved.numericId,v+1);
 }
 if(idsExpected.size!==ids.size)fail('元クロスウォークのID母集団が監査と一致しません');
 for(const [id,row] of ids){
  if(idsExpected.get(id)!==row.occurrences)
   fail('元数値ヒント記載の件数が変化しました');
 }
 const base=bridge.parseSource(mergedSkillText),records=[],historicalIds=new Set();
 const seen=new Set();
 for(const row of privateRecords.skills){
  if(!obj(row)||typeof row.id!=='string'||seen.has(row.id)||
     !ids.has(row.id))fail('旧マスターの一時記録が監査IDに対応していません');
  seen.add(row.id);
  const source=ids.get(row.id);
  if(source.historicalStatus!=='2025-ID-and-rarity-with-unique-JP-name'||
     !['normal','rare'].includes(row.rarity)||
     row.rarity!==(source.historicalRarity===1?'normal':'rare')||
     !/^[\s\S]{1,200}$/.test(row.name||'')||
     typeof row.name!=='string'||!norm(row.name)||
     /[\u0000-\u001f]/.test(row.name)||base.byId.has(row.id)||
     row.historicalNameFingerprint!==source.historicalNameFingerprint||
     digest(norm(row.name))!==source.historicalNameFingerprint)
   fail('旧マスターのID・名称・レアリティ・ハッシュが一致しません');
  historicalIds.add(row.id);
  records.push({id:row.id,name:norm(row.name),rarity:row.rarity,
   // Separate from REAL UmaSim group_id; prevents fabricated upgrade links.
   group:-Number(row.id)});
 }
 const shouldInclude=[...ids.values()].filter(x=>
  x.historicalStatus==='2025-ID-and-rarity-with-unique-JP-name');
 if(records.length!==shouldInclude.length)
  fail('全ての歴史的名前付きID候補が存在しません');
 return {mergedSkillText:JSON.stringify([...base.byId.values(),...records]),
  historicalIds,sourceHistoricalYear:2025,
  historicallyCorroboratedIds:historicalIds.size};
}
module.exports={buildHistoricalPreview};
