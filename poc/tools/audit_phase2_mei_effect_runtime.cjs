'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {TARGETS,compare}=require('../src/phase2_p1_source_title_join.cjs');
const {verify}=require('../src/phase2_p1_scenario_event_ledger.cjs');
const {preview}=require('../src/phase2_mei_overseas_nonskill_preview.cjs');
const core=require('../src/core.js');
const hash=require('node:crypto').createHash;
const fail=s=>{throw Error('Mei非スキル全件監査: '+s);};
function main(args){
 if(args.length!==2)fail('usage: audit_phase2_mei_effect_runtime.cjs <whole-index.json> <pinned GT dir>');
 const [indexPath,dir]=args;
 const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 const checker=require('../data/candidates/checker_event_hints.v1.json');
 const load=id=>JSON.parse(fs.readFileSync(path.join(dir,'support_'+id+'.json'),'utf8'));
 const p1=compare({index,checker,gtDocuments:TARGETS.map(t=>load(t.cardId))},{strict:true});
 const verified=verify({comparison:p1,gtDocuments:
  ['10094','30067','30081','30137','30160'].map(load)},{strict:true});
 if(verified.summary.stagedReviewOnlyEventCardScopes!==2||
    verified.summary.overseasDistinctEventFamilies!==1)
  fail('固定GTのシナリオ別出典裁定が実2カードではない');
 const built=preview();
 if(built.summary.previewOnlyEventRecords!==2||
    built.summary.effectComponentRoutes!==22||
    built.summary.skillRoutesAdded!==0||
    built.noAutomaticRuntimeAdoption!==true)
  fail('R/SSR合計4結果経路を安全に投影できない');
 const rows=built.catalog.cards.map(entry=>{
  const card={id:entry.cardId,hints:[],events:entry.events};
  const event=entry.events[0];
  const great=core.directEffectRoutes(card,{choices:{},
   outcomes:{[event.id]:'great-success'}});
  const success=core.directEffectRoutes(card,{choices:{},
   outcomes:{[event.id]:'success'}});
  return {cardId:entry.cardId,eventId:event.id,
   greatEffectComponents:great.length,successEffectComponents:success.length,
   greatBondComponents:great.filter(x=>x.effectKind==='bond').map(x=>x.delta),
   successBondComponents:success.filter(x=>x.effectKind==='bond').map(x=>x.delta),
   skillRoutes:core.directRoutes(card,{stage:4,choices:{},outcomes:{}}).length,
   alwaysAvailable:false};
 });
 if(rows.some(r=>r.greatEffectComponents!==6||r.successEffectComponents!==5||
    JSON.stringify(r.greatBondComponents)!=='[5,2]'||
    JSON.stringify(r.successBondComponents)!=='[5,2]'||r.skillRoutes!==0))
  fail('成否・絆の基礎とLArc追加成分が混ざりました');
 console.log('MEI_OVERSEAS_EFFECT_PREVIEW_SUMMARY='+JSON.stringify(built.summary));
 console.log('MEI_OVERSEAS_EFFECT_PREVIEW_CARD_CHECKS='+JSON.stringify(rows));
 console.log('MEI_OVERSEAS_EFFECT_PREVIEW_NONPUBLIC='+JSON.stringify({
  editorialVerifiedAgainstPinnedSources:true,publicEventsAdded:0,
  technical2512Unchanged:true,published:false}));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={main};
