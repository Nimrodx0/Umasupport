'use strict';
// Export the verified final P3 label set; no raw source or research traces.
// This script does not grant permission to publish or admit a new hash.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const cat=require('../src/skill_catalog.js'),profiles=require('../src/skill_condition_profiles.js');
const policy=require('../data/p3_approved_suitability_policy_d059.v1.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const policySHA256=sha(JSON.stringify(policy));
function build(raw,report){
 a.equal(sha(raw),cat.SOURCE_HASH);a.equal(report.status,'P3-final-practical-held-review');
 a.deepEqual(report.counts,policy.expectedCounts);a.equal(report.rows.length,881);
 a.equal(report.cardSummary.cards,566);a.equal(report.cardSummary.pairs,5434);
 a.deepEqual(report.cardSummary,{cards:566,pairs:5434,general:1819,targeted:674,undetermined:2941,cardsWithAnyTargeted:352});
 a.equal(report.publicDeployment,false);a.equal(policy.cardScore,false);a.equal(policy.publicDeployment,false);
 const src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const rows=[],seen=new Set(),counts={general:0,targeted:0,undetermined:0};
 for(const r of report.rows){
  a(!seen.has(r.appSkillId));seen.add(r.appSkillId);counts[r.label.state]++;
  if(r.sourceNumericId===null){a.equal(r.label.state,'undetermined');continue;}
  const original=src.get(r.sourceNumericId);a(original);
  a.deepEqual(cat.masks(profiles.project(original,'fixed')),r.explicitNecessaryMasks);
  if(r.label.state==='undetermined')continue;
  a(['general','targeted'].includes(r.label.state));a(Array.isArray(r.label.styles));
  if(r.label.state==='general'){a.equal(r.label.styles.length,0);a.equal(r.label.scope.kind,'source-logic');a(r.label.scope.contexts.length);}
  else {a(r.label.styles.length>0&&r.label.styles.length<4);a(r.label.styles.every(s=>[1,2,3,4].includes(s)));a(['rank-window-fixed-model','dynamic-fixed-model'].includes(r.label.scope.kind));}
  rows.push({appSkillId:r.appSkillId,sourceNumericId:r.sourceNumericId,explicitNecessaryMasks:r.explicitNecessaryMasks,label:r.label});
 }
 a.deepEqual(counts,policy.expectedCounts);a.equal(rows.length,404);
 const byId=new Map(report.rows.map(r=>[r.appSkillId,r]));
 for(const c of report.cards){a.equal(c.cardScore,null);for(const s of c.skills)a.deepEqual(s.label,byId.get(s.appSkillId).label);}
 const bundle={schemaVersion:1,decisionId:policy.decisionId,sourceRegistrySHA256:cat.SOURCE_HASH,policySHA256,rows};
 const bytes=JSON.stringify(bundle)+'\n';a(Buffer.byteLength(bytes)<=1000000);
 return {bundle,bytes,bundleSHA256:sha(bytes)};
}
if(require.main===module){const [raw,report,out]=process.argv.slice(2);const b=build(fs.readFileSync(raw),JSON.parse(fs.readFileSync(report,'utf8')));fs.writeFileSync(out,b.bytes);console.log('D059_LOCAL_EXPORT='+JSON.stringify({decisionId:policy.decisionId,counts:policy.expectedCounts,policySHA256,bundleSHA256:b.bundleSHA256,bytes:Buffer.byteLength(b.bytes),publicDeployment:false}));}
module.exports={build,policySHA256};
