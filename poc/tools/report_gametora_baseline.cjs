'use strict';
/* Baseline-only aggregate of the version-pinned GameTora-derived event set.
 * GameWith adjudication is an optional LOCAL problem-specific input and never
 * a source to regenerate the catalog. Outputs numeric facts, not source prose.
 */
const fs=require('node:fs');
const path=require('node:path');
const {inventory}=require('../src/gametora_event_resolution.cjs');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=x=>{throw Error('GameTora基準全件監査: '+x);};
function run(folder,overridePath){
 const docs=readDocuments(folder);
 const overrides=overridePath?JSON.parse(fs.readFileSync(overridePath,'utf8')):null;
 if(overrides&&(overrides.schemaVersion!==1||!Array.isArray(overrides.cases)))
  fail('手動裁定ファイルが不正');
 const cases=new Map();
 for(const x of overrides?.cases||[]){
  const cid=String(x.cardId);
  if(cases.has(cid))fail('重複したカードレビュー');
  cases.set(cid,{flaggedRoutes:x.flaggedRoutes,gameWithDecisions:x.gameWithDecisions});
 }
 const cards=[],total={baselineCards:docs.length,chainStages:0,chainRoutes:0,
  defaultOrdinaryRoutes:0,baselineExplicitTerminalRoutes:0,finalStageRoutes:0,
  pendingAdjudicationRoutes:0,gameWithAdjudicatedRoutes:0};
 const seen=new Set();
 for(const doc of docs){
  const id=String(doc.id);
  if(seen.has(id))fail('重複ソースカード');seen.add(id);
  const x=inventory({document:doc,revision:POLICY.baselineRevision,...(cases.get(id)||{})});
  const t=x.stats;
  total.chainStages+=t.stages;
  total.chainRoutes+=t.routes;
  total.defaultOrdinaryRoutes+=t.baselineOrdinary;
  total.baselineExplicitTerminalRoutes+=t.baselineExplicitTerminal;
  total.finalStageRoutes+=t.baselineFinalStage;
  total.pendingAdjudicationRoutes+=t.pendingGameWith;
  total.gameWithAdjudicatedRoutes+=t.gameWithAdjudicated;
  cards.push({cardId:id,...t});
 }
 for(const id of cases.keys())if(!seen.has(id))fail('元GameToraにない裁定対象');
 if(!overrides&&(total.baselineCards!==559||total.chainStages!==1069||
    total.chainRoutes!==1713||total.baselineExplicitTerminalRoutes!==91))
  fail('固定全件の収録範囲が変化: 手動検証が必要');
 const classified=total.defaultOrdinaryRoutes+total.baselineExplicitTerminalRoutes+
   total.finalStageRoutes+total.pendingAdjudicationRoutes+total.gameWithAdjudicatedRoutes;
 if(classified!==total.chainRoutes)fail('連続イベントの経路未分類');
 return {schemaVersion:1,dataKind:'gametora-baseline-chain-whole-inventory',
  policy:{baseline:'GameTora-derived',adjudicator:'GameWith',sourceRevision:POLICY.baselineRevision},
  baselineEditorialDefaultNotGameVerification:true,
  sourceOrderAdjacencyGameVerified:false,releaseApproved:false,
  originalProseIncluded:false,stats:total,cards};
}
function main(args){
 if(![2,3].includes(args.length))fail('usage: <snapshot-dir> <numeric-out.json> [local-review.json]');
 const [dir,out,reviews]=args;
 const result=run(dir,reviews);
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('GAMETORA_CANONICAL_BASELINE_STATS='+JSON.stringify(result.stats));
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={run};
