'use strict';
const a=require('node:assert/strict'),crypto=require('node:crypto');
const {observeHtml,compareDisplay,verifyDisplay}=require('../src/d072_display_corroboration.cjs');
async function main(){
 const skills=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(990001+i),name:'Synthetic '+i,rarity:'normal',group:i})));
 const html='<html><body><h2>育成イベント</h2><div><div>ランダムイベント</div><div><section><div><div><h3>Synthetic event</h3></div><div><div><div>体力 +10</div></div></div></div></section></div></div><script>throw new Error("must not execute")</script><img src="https://example.invalid/never-load"></body></html>';
 const actual=await observeHtml({html,cardId:'39999',skillText:skills});
 const title=crypto.createHash('sha256').update('Synthetic event').digest('hex');
 const packet={events:[{exactTitleSha256:title,category:'random',categoryOrdinal:1,groups:[{ordinal:1,labelPresent:false,routes:[{ordinal:1,hints:[],terminal:false,nonSkillCount:1}]}]}]};
 a.ok(actual.events,'offline parser did not read synthetic HTML');
 const report=verifyDisplay(compareDisplay(packet,actual));
 a.equal(report.status,'matched-visible-facts');
 a.equal(report.topologyVerified,false);a.equal(report.publicationApproved,false);
 const absent=await observeHtml({html:'<h2>育成イベント</h2>',cardId:'39999',skillText:skills});
 a.equal(verifyDisplay(compareDisplay(packet,absent)).status,'unavailable');
 console.log('D072_OFFLINE_DISPLAY_BROWSER='+JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
