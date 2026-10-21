#!/usr/bin/env node
'use strict';
/* Local-only normalization of the pinned GameTora snapshot; source prose omitted.
 * Result is an unapproved audit artifact, NOT the public event catalog.
 */
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('../src/gametora_whole_event_normalize.cjs');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const fail=m=>{throw Error('GameTora全件候補生成: '+m);};
function main(args){
 if(args.length!==3)fail('usage: <whole-index.json> <pinned-gametora-dir> <temporary-output.json>');
 const [indexPath,sourceDir,out]=args.map(x=>path.resolve(x));
 const publicFile=path.resolve(__dirname,'../data/reviewed_events.v1.json');
 const publicParent=path.resolve(__dirname,'../data');
 // Never write an unapproved candidate into the served/public app data tree.
 if(out===publicFile||out===indexPath||out.startsWith(publicParent+path.sep))
  fail('未承認の第三者データを公開DB・poc/dataへ書き込めません');
 const idx=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 const report=build({index:idx,documents:readDocuments(sourceDir)});
 console.log('GAMETORA_WHOLE_EVENT_PRECHECK_TOTALS='+JSON.stringify(report.totals));
 if(report.totals.rosterCards!==563||report.totals.baselineCards!==559||
    report.totals.missingBaselineCards!==4||report.totals.sourceEvents!==2488||
    report.totals.sourceChainEvents!==1069||
    report.totals.explicitChainTerminalRoutes!==91||report.totals.explicitNonchainTerminalRoutes!==18||
    report.totals.sourceChoices!==4129||report.totals.expandedRoutes!==4376||
    report.totals.numericHintMentions!==1681||report.totals.unresolvedHintMentions!==13||
    report.totals.directSkillGrantMentions!==7||report.totals.conditionalRoutes!==8)
  fail('固定母数に変更がありました。全件手動レビューのうえ別バージョンに更新してください');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('GAMETORA_WHOLE_EVENT_CANDIDATE_TOTALS='+JSON.stringify(report.totals));
 console.log('GAMETORA_WHOLE_EVENT_EFFECT_TYPES='+JSON.stringify(report.effectTypeCounts));
 console.log('No third-party event titles or option prose copied. Not approved for publication.');
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={main};
