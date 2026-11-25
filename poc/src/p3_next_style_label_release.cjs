'use strict';
// Candidate successor to D056. No production allowlist change. Keep actual
// ability predicates separate from effect scaling; only explicitly supported
// logical equivalence and full-phase W/D results enter this review.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('./p3_axis_suitability_review.cjs');
const {derive}=require('./p3_d056_approved_natural_spurt.cjs');
const {restrictedEquivalent}=require('../tools/audit_p3_practical_label_candidates.cjs');
const {classify}=require('../tools/audit_p3_style_rank_paths.cjs');
const {measuredCourses}=require('../tools/audit_p3_practical_label_candidates.cjs');
const {choose}=require('./p3_rank_window_margin_screen.cjs');
const {STYLES}=require('../tools/globalsim_position_expanded.cjs');
const {DOMAINS}=require('./skill_full_condition_path_audit.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const FULL_SHA='f512e24b2987ccd642f17f21f92865e965a43b90985ef37d622f1ae2f2ec9e58';
const LOGIC=new Set(['weather','phase_random','phase_firsthalf_random','phase_laterhalf_random']);
const ABILITY=new Set(['base_speed','base_stamina','base_power','base_guts','base_wiz']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const conditions=r=>r.invokes.flatMap(i=>[...i.conditions,...(i.preConditions??[])].flat());
const types=r=>[...new Set(conditions(r).map(p=>p.type))].sort();
function supportedPredicate(p){
 if(Object.hasOwn(DOMAINS,p.type))return true;
 if(p.type==='always')return p.operator==='=='&&p.value===1;
 if(!LOGIC.has(p.type)||p.operator!=='==')return false;
 return p.type==='weather'?[1,2,3,4].includes(p.value):[0,1,2,3].includes(p.value);
}
function sourceLogic(record,r){
 if(!record||!['full-neutral-candidate','held'].includes(r.state))return null;
 if(!conditions(record).every(supportedPredicate))return null;
 if(r.state==='full-neutral-candidate'){
  const contexts=r.cells.filter(c=>c.eligible.length);
  if(!contexts.length||!contexts.every(c=>c.eligible.length===4&&c.state==='full-neutral-candidate'))return null;
  return {kind:'full-source-logic',label:{state:'general',styles:[],reason:'same-source-logic-under-D045-D049-D051-D054-D055',scope:{kind:'source-logic',contexts:contexts.map(c=>c.context)}}};
 }
 const q=restrictedEquivalent(record,r);
 if(!q)return null;
 const applicable=r.cells.filter(c=>c.eligible.length);
 if(!applicable.length||applicable.length!==q.contexts.length||!applicable.every(c=>c.eligible.length>1&&c.eligible.length<4))return null;
 return {kind:'restricted-source-logic',label:{state:'general',styles:[],reason:'same-residual-logic-within-explicit-eligible-styles',scope:{kind:'source-logic',contexts:q.contexts.map(({styles,...c})=>({...c,running_styles:styles}))}}};
}
function targeted(record,r,wd){
 const c=classify(record,r);
 a.equal(c.group,'existing-phase-rank-point-evidence-review');a.equal(record.invokes.length,1);a.equal(record.invokes[0].conditions.length,1);a.equal((record.invokes[0].preConditions??[]).length,0);
 a.equal(c.items[0].bands.length,1);a.equal(wd.band,c.items[0].bands[0]);a.equal(wd.phase,Number(c.items[0].window.split(':')[1]));
 a.deepEqual(wd.courseIds,measuredCourses(r));a(wd.courseIds.length);
 const result=choose(wd.pairs,10,true),w=choose(wd.pairs,10,false);
 a.equal(result.state,wd.state);a.deepEqual(result.styles.map(s=>STYLES.indexOf(s)+1),wd.styles);
 if(result.state!=='targeted-window-candidate')return null;
 a.deepEqual(result,w);a(wd.styles.length>0&&wd.styles.length<4);
 return {kind:'full-phase-WD',label:{state:'targeted',styles:wd.styles,reason:'fixed-full-phase-W-gap-and-D-support',scope:{kind:'rank-window-fixed-model',branches:[{distanceType:null,courseIds:wd.courseIds,windowKey:'phase_random:'+wd.phase,bandId:wd.band}],ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']}}};
}
function verifyMask(row,label){
 const m=row.explicitNecessaryMasks;a(Array.isArray(m)&&m.length===32);
 if(label.state==='general')for(const c of label.scope.contexts)for(const style of c.running_styles??[1,2,3,4]){
  a(m[(style-1)*8+(c.distance_type-1)*2+c.ground_type-1]&(1<<(c.ground_condition-1)));
 }
}
function derivePreview(raw,base,wd){
 a.equal(sha(raw),SOURCE_SHA);a.equal(wd.status,'P3-full-phase-WD-existing-rule-candidates');a.equal(wd.fullReportSHA256,FULL_SHA);a.equal(wd.rows.length,29);a.equal(wd.seedSplitRows,8448);
 const {result:prior}=derive(raw,base),bySource=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r])),byApp=new Map(wd.rows.map(x=>[x.appSkillId,x]));
 a.equal(byApp.size,29);
 const counts={general:0,targeted:0,undetermined:0},added=[],abilityHeld=[],rejectedWD=[],seenWD=new Set();
 const rows=prior.rows.map(row=>{
  let proposal=null;
  if(row.label.state==='undetermined'){
   const record=bySource.get(row.sourceNumericId),r=evaluate(record,'running_style'),w=byApp.get(row.appSkillId);
   if(record&&r.state==='full-neutral-candidate'&&types(record).some(t=>ABILITY.has(t)))abilityHeld.push({name:record.name,predicates:conditions(record).filter(p=>ABILITY.has(p.type))});
   proposal=sourceLogic(record,r);
   if(w){a.equal(w.sourceNumericId,row.sourceNumericId);a(!proposal);seenWD.add(row.appSkillId);proposal=targeted(record,r,w);if(!proposal)rejectedWD.push({name:record.name,state:w.state});}
   if(proposal){verifyMask(row,proposal.label);added.push({appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,name:record.name,...proposal});}
  }
  const out=proposal?{...row,label:proposal.label}:row;counts[out.label.state]++;return out;
 });
 a.equal(seenWD.size,29);a.equal(abilityHeld.length,3);a.equal(added.filter(x=>x.kind==='full-source-logic').length,10);a.equal(added.filter(x=>x.kind==='restricted-source-logic').length,4);
 const t=added.filter(x=>x.kind==='full-phase-WD').length;
 a.equal(t+rejectedWD.length,29);a.deepEqual(counts,{general:295,targeted:43+t,undetermined:543-t});
 const changed=new Set(added.map(x=>x.appSkillId));for(let i=0;i<rows.length;i++)if(!changed.has(rows[i].appSkillId))a.deepEqual(rows[i],prior.rows[i]);
 const index=new Map(rows.map(r=>[r.appSkillId,r])),cardSummary={cards:0,pairs:0,general:0,targeted:0,undetermined:0,cardsWithAnyTargeted:0};
 const cards=prior.cards.map(c=>{cardSummary.cards++;const skills=c.skills.map(s=>{const label=index.get(s.appSkillId).label;cardSummary.pairs++;cardSummary[label.state]++;return {...s,label};});if(skills.some(s=>s.label.state==='targeted'))cardSummary.cardsWithAnyTargeted++;return {...c,skills};});
 a.equal(cardSummary.cards,566);a.equal(cardSummary.pairs,5434);a(cards.every(c=>c.cardScore===null));
 return {status:'next-style-label-release-preview-not-approved',baseDecisionId:'D-056',counts,cardSummary,rows,cards,added,abilityHeld,rejectedWD,formalLabelsChanged:0,publicDeployment:false};
}
if(require.main===module){const [raw,b,w,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const r=derivePreview(fs.readFileSync(raw),read(b),read(w));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log('NEXT_STYLE_RELEASE='+JSON.stringify({counts:r.counts,cardSummary:r.cardSummary,added:r.added.map(({name,kind,label})=>({name,kind,styles:label.styles})),abilityHeld:r.abilityHeld,rejectedWD:r.rejectedWD,formalLabelsChanged:0}));}
module.exports={sourceLogic,targeted,derivePreview,supportedPredicate};
