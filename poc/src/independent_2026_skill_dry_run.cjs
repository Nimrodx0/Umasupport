'use strict';
/*
 * NONPUBLIC 2026-name alternative for the schema dry-run.
 *
 * Two sources are indispensable: the pinned 2026 metadata provides the
 * Japanese display name; a numeric-only 2025 corroboration report provides
 * the name's hash, original hint rarity, and source-occurrence coverage.
 * NO full 2025 MDB / raw Japanese name is needed at runtime. This is not
 * proof of in-game 2026 existence, attribution or re-publication rights.
 */
const bridge=require('./skill_bridge.js');
const {audit,INDEPENDENT_REV}=require('./independent_skill_fingerprint_audit.cjs');
const {CANONICAL_SOURCE_REV}=require('./gametora_event_skill_crosswalk.cjs');
const fail=s=>{throw Error('2026年独立名による非公開技術変換: '+s);};
function buildIndependentPreview({mergedSkillText,historicalReport,independentSkills,crosswalk}){
 if(!historicalReport||!Array.isArray(independentSkills)||
    crosswalk?.dataKind!=='gametora-event-skill-crosswalk-draft'||
    crosswalk.releaseApproved!==false||
    crosswalk.sourcePins?.umaSimSkills!==CANONICAL_SOURCE_REV||
    crosswalk.stats?.missingPinnedSkillIds!==historicalReport.crosswalkMissingOccurrences)
  fail('出典と固定母集団が不正');
 const result=audit({historical:historicalReport,skills:independentSkills});
 if(result.sourcePins.independentMetadata!==INDEPENDENT_REV||
    result.totals.distinctIds!==28||
    result.totals.occurrences!==79||
    result.totals.presentIds!==28||
    result.totals.nameFingerprintMatches!==28||
    result.totals.nameFingerprintMismatches!==0||
    result.totals.absentIds!==0||
    result.totals.historicalNameUnavailable!==0)
  fail('2026年独立名と旧名ハッシュの全件一致が必要');
 const expected=new Map();
 for(const r of crosswalk.unresolved||[]){
  if(r.reason!=='not-in-pinned-umasim-registry')continue;
  const id=r.numericId;
  expected.set(id,(expected.get(id)||0)+1);
 }
 const old=new Map(historicalReport.rows.map(r=>[r.numericId,r]));
 if(expected.size!==28||old.size!==28||
    [...expected].some(([id,count])=>old.get(id)?.occurrences!==count))
  fail('GameTora元イベントの数値ID出現数と監査が一致しない');
 const base=bridge.parseSource(mergedSkillText),lookup=new Map(independentSkills.map(s=>[String(s.id),s]));
 const previewIds=new Set(),records=[];
 for(const row of historicalReport.rows){
  const raw=lookup.get(row.numericId);
  if(!raw||typeof raw.name!=='string'||base.byId.has(row.numericId)||
     row.historicalStatus!=='2025-ID-and-rarity-with-unique-JP-name'||
     ![1,2].includes(row.historicalRarity))
   fail('一部のスキルに複数の証拠がない');
  // SHA matching was checked in audit above. Rarity is from the 2025
  // numeric-only evidence, NOT from 2026 metadata's different enum.
  previewIds.add(row.numericId);
  records.push({
   id:row.numericId,
   name:raw.name.normalize('NFKC').replace(/\s+/g,' ').trim(),
   rarity:row.historicalRarity===1?'normal':'rare',
   group:-Number(row.numericId)
  });
 }
 if(previewIds.size!==28||records.length!==28)fail('独立名の二重・欠損');
 return {mergedSkillText:JSON.stringify([...base.byId.values(),...records]),
  previewIds,sourceNameRevision:INDEPENDENT_REV,
  historicalNumericClassificationOnly:true,independent2026MetadataIsNotGameVerification:true};
}
module.exports={buildIndependentPreview};
