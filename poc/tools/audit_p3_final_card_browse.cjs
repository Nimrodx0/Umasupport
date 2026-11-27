'use strict';
// No data or scores in repository. Rebuild model and compare card counts
// against independently interpreted verified route ledger and explicit masks.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const loader=require('../src/live_loader.js'),bridge=require('../src/skill_bridge.js'),profiles=require('../src/skill_condition_profiles.js'),events=require('../src/public_event_catalog.js');
const view=require('../src/card_suitability_view.js'),cat=require('../src/skill_catalog.js'),core=require('../src/core.js');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(60000)});a(r.ok);return r.text();};
const DIST={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
function compatible(m,ctx,style){
 if(!m)return null;
 for(let d=1;d<=4;d++)for(let g=1;g<=2;g++)for(let c=1;c<=4;c++){
  if(ctx.distance_type&&ctx.distance_type!==d||ctx.ground_type&&ctx.ground_type!==g||ctx.ground_condition&&ctx.ground_condition!==c)continue;
  if(m[(style-1)*8+(d-1)*2+g-1]&(1<<(c-1)))return true;
 }
 return false;
}
function expected(row,ctx){
 const m=row.explicitNecessaryMasks,s=ctx.running_style,ap=compatible(m,ctx,s);
 if(ap===null)return 'scopeUnknown';if(!ap)return 'outside';
 // Independent cell enumeration: a single disallowed completion is pending.
 for(let d=1;d<=4;d++)for(let g=1;g<=2;g++)for(let c=1;c<=4;c++){
  if(ctx.distance_type&&ctx.distance_type!==d||ctx.ground_type&&ctx.ground_type!==g||ctx.ground_condition&&ctx.ground_condition!==c)continue;
  if(!(m[(s-1)*8+(d-1)*2+g-1]&(1<<(c-1))))return 'scopePending';
 }
 if([1,2,3,4].filter(v=>compatible(m,ctx,v)).length===1)return 'explicitOnly';
 const l=row.label;if(l.state==='undetermined')return 'undetermined';
 if(l.state==='general')return l.scope.contexts.some(c=>['distance_type','ground_type','ground_condition'].every(k=>!ctx[k]||c[k]===ctx[k])&&(!c.running_styles||c.running_styles.includes(s)))?'general':'undetermined';
 const sc=l.scope,ids=sc.kind==='rank-window-fixed-model'?sc.branches.flatMap(b=>b.courseIds):sc.contexts.map(c=>c.courseId);
 if(ctx.ground_type===2||ctx.ground_condition&&ctx.ground_condition!==1||!ids.some(id=>!ctx.distance_type||DIST[id]===ctx.distance_type))return 'undetermined';
 return l.styles.includes(s)?'targeted':'otherTargeted';
}
async function main([reportPath,routePath]){
 const r=JSON.parse(fs.readFileSync(reportPath,'utf8')),routes=JSON.parse(fs.readFileSync(routePath,'utf8'));
 a.equal(r.status,'P3-final-practical-held-review');a.deepEqual(r.counts,{general:304,targeted:100,undetermined:477});
 const base='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/';
 const [supportText,skillText,pinnedSkillText]=await Promise.all([get(base+'support_card.txt'),get(base+'skill_data.txt'),get(bridge.PINNED_URL)]);
 const p=routes.provenance,eventText=await require('./fixed_research_event_catalog.cjs').loadFixedEventText();
 a.equal(hash(supportText),p.supportRegistrySHA256);a.equal(hash(skillText),p.skillRegistrySHA256);a.equal(hash(pinnedSkillText),p.historicalRegistrySHA256);a.equal(hash(eventText),p.approvedEventCatalogSHA256);
 const data=loader.buildModel(supportText,{mode:'online'});
 events.attach(data,JSON.parse(eventText),{skillText,pinnedSkillText,fullRegistry:true,allowReviewedLegacy:true});
 profiles.attach(data,{skillText,pinnedSkillText});a.equal(data.cards.length,566);a.equal(data.skills.length,881);
 const all=view.index(r.rows),labels=view.index(r.rows.filter(x=>x.label.state!=='undetermined')),byCard=new Map(r.cards.map(c=>[c.cardId,c]));
 for(const s of data.skills){const x=all.get(s.id);a(x);a.deepEqual(cat.masks(s.activationProfile),x.explicitNecessaryMasks??null);}
 let stageChecks=0,contextChecks=0,rowsChecked=0;
 for(const c of data.cards){
  const expectedCard=byCard.get(c.id);a(expectedCard);
  for(let stage=0;stage<=4;stage++){
   const ids=expectedCard.skills.filter(s=>s.directCandidates.some(p=>p.source==='approved-event'||p.stages?.includes(stage))).map(s=>s.appSkillId).sort();
   for(let style=1;style<=4;style++)for(const extra of [{},{distance_type:2,ground_type:1},{distance_type:3,ground_type:2}]){
    const ctx={running_style:style,...extra},v=view.browseCard(c,{stage,choices:{},outcomes:{}},data,labels,ctx);
    a.deepEqual(v.potential.rows.map(x=>x.appSkillId).sort(),ids);
    for(const row of v.potential.rows){a.equal(row.category,expected(all.get(row.appSkillId),ctx),row.appSkillId);rowsChecked++;}
    a.equal(v.potential.matching,v.potential.counts.explicitOnly+v.potential.counts.general+v.potential.counts.targeted);
    a.equal(Object.entries(v.potential.counts).filter(([k])=>k!=='total').reduce((n,[,v])=>n+v,0),ids.length);
    a.equal(v.cardScore,null);contextChecks++;
   }
   stageChecks++;
  }
 }
 a.equal(stageChecks,2830);a.equal(contextChecks,33960);
 console.log('D059_CARD_BROWSE='+JSON.stringify({cards:566,stageChecks,contextChecks,rowsChecked,cardScores:0}));
}
main(process.argv.slice(2)).catch(e=>{console.error(e.stack||e);process.exitCode=1;});
