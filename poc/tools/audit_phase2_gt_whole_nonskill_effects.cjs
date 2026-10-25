'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {readDocuments}=require('./audit_gametora_branches.cjs');
const {analyze}=require('../src/phase2_gt_whole_nonskill_effect_inventory.cjs');
const fail=s=>{throw Error('全件非スキル出典監査CLI: '+s);};
function main(args){
 if(args.length!==3)fail('usage: <whole-provisional-index.json> <fixed-GT-dir> <private-CI-output.json>');
 const [indexPath,gtDir,outPath]=args;
 const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
 const docs=readDocuments(gtDir);
 const result=analyze({documents:docs,index},{strict:true});
 if(result.summary.rosterCards!==563||result.summary.sourceCards!==559||
    result.summary.sourceEvents!==2488||result.summary.sourceChoices!==4129||
    result.summary.expandedRoutes!==4376||
    result.summary.allEffectMentions!==13263||
    result.summary.allStatsMentions!==68||
    result.summary.allStatsValidMentions!==68||
    result.summary.allStatsExpandedEffectComponents!==340||
    result.summary.allStatsInvalidMentions!==0||
    result.summary.statusSourceMentions!==121||
    result.summary.statusValidMentions!==121||
    result.summary.statusInvalidMentions!==0||
    result.summary.isolatedPreviewStatusRecords!==88||
    result.summary.randomStatMentions!==18||
    result.summary.validRandomStatMentions!==18||
    result.summary.invalidRandomStatMentions!==0||
    result.summary.isolatedPreviewDynamicRecords!==18||
    result.summary.scenarioCurrencyMentions!==4||
    result.summary.fullEnergyMentions!==1||
    result.summary.isolatedPreviewEventRecords<2306||
    result.summary.blockedEvents>182||
    result.summary.unrecognizedEffectMentions!==90||
    result.publicationApproved!==false||
    result.automaticRuntimeAdoption!==false||
    result.chainTopologyVerified!==false||
    result.sourceProseIncluded!==false||
    result.summary.publishedEventRecords!==0)
  fail('固定全母数・無公開／無自動導入ゲートが不一致 '+
    JSON.stringify({summary:result.summary,blockers:result.blockedReasons}));
 fs.mkdirSync(path.dirname(outPath),{recursive:true});
 fs.writeFileSync(outPath,JSON.stringify(result,null,2)+'\n');
 console.log('GT_ALL_NONSKILL_EFFECT_AUDIT_SUMMARY='+JSON.stringify(result.summary));
 console.log('GT_ALL_NONSKILL_EFFECT_TYPES='+JSON.stringify(result.sourceEffectTypes));
 console.log('GT_ALL_NONSKILL_EFFECT_BLOCKERS='+JSON.stringify(result.blockedReasons));
 console.log('PRIVATE_EFFECT_CANDIDATES_CI_ONLY='+outPath);
}
if(require.main===module){
 try{main(process.argv.slice(2));}catch(e){console.error(e.stack||e.message);process.exitCode=1;}
}
module.exports={main};
