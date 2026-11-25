'use strict';
// Final practical held review. D054 separates effect scaling from trigger
// aptitude; D059 compares exact supported measurements at provisional 10pt.
// Keep originals, fixed source identity and every existing label intact.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {supportedPredicate}=require('../src/p3_next_style_label_release.cjs');
const {classify:superiority,windowCells,STYLES}=require('../src/p3_combined_style_superiority.cjs');
const {classify:rankShape,shape}=require('./audit_p3_style_rank_paths.cjs');
const {measuredCourses}=require('./audit_p3_practical_label_candidates.cjs');
const {BANDS,allowed}=require('./skill_p3_remaining_absolute_rank_observer.cjs');
const {PIN}=require('./globalsim_phase_random_10m.cjs');
const {COURSES}=require('./globalsim_position_expanded.cjs');
const {DOMAINS}=require('../src/skill_full_condition_path_audit.cjs');
const SOURCE_SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const bump=(o,k)=>o[k]=(o[k]||0)+1;
const FALLBACK={'204322':'same_skill_horse_count:>=:2','204453':'order_rate_out40_continue:==:1'};
const CHAIN={'203171':['phase_laterhalf_random:0','phase_firsthalf_random:2'],'203172':['phase_laterhalf_random:0','phase_firsthalf_random:2'],'203801':['phase_random:1','phase_random:2'],'203802':['phase_random:1','phase_random:2']};
const sig=p=>[p.type,p.operator,p.value].join(':');
const types=r=>[...new Set(r.invokes.flatMap(i=>[...i.conditions,...(i.preConditions??[])].flat().map(p=>p.type)))].sort();
function phaseKey(terms){
 const time=terms.filter(p=>!Object.hasOwn(DOMAINS,p.type));
 return time.length===1&&time[0].operator==='=='&&supportedPredicate(time[0])&&time[0].type.startsWith('phase_')?time[0].type+':'+time[0].value:null;
}
function neutralLabel(record,inv,reason){
 const projected={...record,invokes:[inv]},r=evaluate(projected,'running_style');
 if(r.state!=='full-neutral-candidate'||!r.cells.every(c=>c.state==='outside'||c.state==='full-neutral-candidate'))return null;
 return {state:'general',styles:[],reason,scope:{kind:'source-logic',contexts:r.cells.filter(c=>c.eligible.length===4).map(c=>c.context)}};
}
function extraNeutral(record){
 if(!record||record.invokes?.length!==2)return null;
 const [first,second]=record.invokes;
 if(first.index!==1||second.index!==2||first.skillId!==record.id||second.skillId!==record.id)return null;
 if(Object.hasOwn(FALLBACK,record.id)){
  if(first.conditions.length!==1||second.conditions.length!==1||!equal(first.preConditions??[],second.preConditions??[])||first.duration!==second.duration)return null;
  const f=first.conditions[0],s=second.conditions[0],extra=f.filter(p=>sig(p)===FALLBACK[record.id]);
  if(extra.length!==1||!equal(f.filter(p=>sig(p)!==FALLBACK[record.id]),s)||!phaseKey(s))return null;
  if(!Array.isArray(first.effects)||!first.effects.length||!Array.isArray(second.effects))return null;
  const withoutValue=es=>es.map(({value,...e})=>e);
  if(!equal(withoutValue(first.effects),withoutValue(second.effects)))return null;
  if(![...s,...(second.preConditions??[]).flat()].every(supportedPredicate))return null;
  return neutralLabel(record,second,'D054-baseline-trigger-same-effect-amount-variant');
 }
 if(Object.hasOwn(CHAIN,record.id)){
  if((first.preConditions??[]).length||(second.preConditions??[]).length||second.conditions.length!==1)return null;
  if(!first.conditions.every(row=>row.every(supportedPredicate)&&phaseKey(row)===CHAIN[record.id][0]))return null;
  const dependent=second.conditions[0],history=dependent.filter(p=>sig(p)==='is_activate_other_skill_detail:==:1');
  if(history.length!==1||dependent.length!==2||phaseKey(dependent.filter(p=>p!==history[0]))!==CHAIN[record.id][1])return null;
  // Pinned UmaSim SkillChecker checks same skill ID in coolDownMap.
  // Both original phases are ordered and the later invoke has no other gate.
  // Keep the initial distance scope; the second invoke is not independent.
  return neutralLabel(record,first,'D054-own-skill-prior-activation-and-style-neutral-later-phase');
 }
 return null;
}
function verifyMask(row,label){
 const m=row.explicitNecessaryMasks;a(Array.isArray(m)&&m.length===32);
 for(const c of label.scope.contexts)for(const s of c.running_styles??[1,2,3,4])a(m[(s-1)*8+(c.distance_type-1)*2+c.ground_type-1]&(1<<(c.ground_condition-1)));
}
function absoluteBand(record,r){
 if(record?.invokes?.length!==1||record.invokes[0].conditions.length!==1||(record.invokes[0].preConditions??[]).length)return null;
 const terms=record.invokes[0].conditions[0],s=shape(terms);
 if(s.window!=='phase_random:1'||s.extraTypes.length||terms.filter(p=>p.type==='order').length!==1||terms.some(p=>p.type==='order_rate'))return null;
 const q=terms.find(p=>p.type==='order'),b=BANDS.find(b=>b.op===q.operator&&b.value===q.value);
 if(!b||!measuredCourses(r).length)return null;
 a.deepEqual(s.r9,[...allowed(b,9)]);a.deepEqual(s.r12,[...allowed(b,12)]);
 return b;
}
function absIndex(report){
 a.equal(report.status,'P3-absolute-rank-same-720-replay-not-game-rate');a.equal(report.sourceRevision,PIN);a.equal(report.baseRaces,720);a.equal(report.seedsPerHalf,15);a.equal(report.phase,1);a.deepEqual(report.bands,BANDS);
 a.equal(report.rows.length,192);
 const map=new Map();for(const r of report.rows){
  a(BANDS.some(b=>b.id===r.bandId)&&COURSES.some(c=>c.id===r.courseId)&&[9,12].includes(r.fieldSize)&&['equal','jitter10'].includes(r.mode)&&STYLES.includes(r.style));
  const b=BANDS.find(b=>b.id===r.bandId),u=100*allowed(b,r.fieldSize).size/r.fieldSize;
  for(const h of ['all','first15','last15']){
   const x=r[h];a(Number.isSafeInteger(x.runners)&&x.runners>=15);a(x.O>=0&&x.W>=x.O-1e-6&&x.W<=100);a(Math.abs(x.U-u)<=1e-6);a(Math.abs(x.D-(x.O-u))<=2e-6);
  }
  a.equal(r.all.runners,r.first15.runners+r.last15.runners);
  for(const k of ['W','O','D'])a(Math.abs(r.all[k]-(r.first15[k]*r.first15.runners+r.last15[k]*r.last15.runners)/r.all.runners)<2e-6);
  const k=[r.bandId,r.courseId,r.fieldSize,r.mode,r.style].join('|');a(!map.has(k));map.set(k,r);
 }
 return map;
}
function absoluteProposal(record,r,b,map){
 const ids=measuredCourses(r),byStyle=Object.fromEntries(STYLES.map(style=>[style,ids.flatMap(courseId=>[9,12].flatMap(fieldSize=>['equal','jitter10'].map(mode=>{const v=map.get([b.id,courseId,fieldSize,mode,style].join('|'));a(v);return v;})))]));
 const cells=windowCells(byStyle),s=superiority(cells,10);
 return {result:s,label:s.state==='targeted'?{state:'targeted',styles:s.styles,reason:'D059-exact-absolute-rank-same-fixed-replay',scope:{kind:'rank-window-fixed-model',branches:[{distanceType:null,courseIds:ids,windowKey:'phase_random:1',bandId:b.id}],ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']}}:null};
}
const RANK=new Set(['order','order_rate','order_rate_out40_continue']);
const DEP=new Set(['same_skill_horse_count','running_style_count_same','running_style_count_same_rate','popularity','running_style_equal_popularity_one','activate_count_start','activate_count_middle','activate_count_end_after','activate_count_all','activate_count_later_half','activate_count_heal','is_activate_any_skill','is_activate_other_skill_detail','is_exist_skill_id','is_other_character_activate_advantage_skill']);
function holdReason(record,r,comparison,dynamic){
 const cs=r.cells.filter(c=>c.eligible.length>1);
 if(cs.length&&cs.every(c=>c.context.ground_type===2))return 'dirt-only-no-matching-model';
 if(comparison){const q=comparison.sweeps.find(x=>x.margin===10);return q.state==='within-margin-only'?'model-within-margin-not-neutral-proof':'measured-no-consistent-10pt-advantage';}
 const ts=types(record);
 if(dynamic)return 'dynamic-scope-or-unknown-bounds';
 if(ts.some(t=>RANK.has(t)))return 'rank-window-or-compound-not-covered';
 if(ts.some(t=>DEP.has(t)))return 'opponent-or-equipped-skill-dependency';
 if(ts.some(t=>['is_lastspurt','lastspurt','run_at_full_speed_random','hp_per'].includes(t)))return 'stamina-spurt-or-speed-state';
 return 'other-dynamic-condition-unresolved';
}
function audit(raw,base,absolute,dynamic){
 a.equal(sha(raw),SOURCE_SHA);a.equal(base.status,'D058-D059-combined-label-verification');a.deepEqual(base.counts,{general:298,targeted:92,undetermined:491});a.equal(base.rows.length,881);
 const src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r])),cmp=new Map(base.comparisonRows.map(r=>[r.appSkillId,r])),dyn=new Map(dynamic.rows.map(r=>[r.sourceNumericId,r])),idx=absIndex(absolute);
 const initial={},held={},review=[],added=[],counts={general:0,targeted:0,undetermined:0};
 let absoluteChecked=0,neutrals=0;
 const rows=base.rows.map(row=>{
  if(row.label.state!=='undetermined'){counts[row.label.state]++;return row;}
  const record=src.get(row.sourceNumericId),r=evaluate(record,'running_style');
  const n=record?.name??row.appSkillId;
  let category,label=null,details=null;
  if(r.state==='source-unavailable')category='source-unavailable';
  else if(r.state==='scope-only')category='single-eligible-style';
  else{
   category='comparable-hold';
   label=extraNeutral(record);
   if(label){verifyMask(row,label);neutrals++;details={state:'source-neutral',reason:label.reason};}
   else {
    const b=absoluteBand(record,r);
    if(b){absoluteChecked++;const q=absoluteProposal(record,r,b,idx);label=q.label;details={band:b.id,...q.result};}
   }
  }
  bump(initial,category);
  const reason=label?'resolved-'+label.state:category==='comparable-hold'?holdReason(record,r,cmp.get(row.appSkillId),dyn.get(row.sourceNumericId)):category;
  if(!label)bump(held,reason);
  review.push({appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,name:n,category,reason,types:record?types(record):[],details});
  if(label)added.push({name:n,appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,label});
  const out=label?{...row,label}:row;counts[out.label.state]++;return out;
 });
 a.deepEqual(initial,{'comparable-hold':151,'single-eligible-style':277,'source-unavailable':63});
 a.equal(neutrals,6);a.equal(absoluteChecked,8);a.equal(counts.general,304);
 a.equal(Object.values(counts).reduce((s,n)=>s+n,0),881);a.equal(Object.values(held).reduce((s,n)=>s+n,0),counts.undetermined);
 const byId=new Map(rows.map(r=>[r.appSkillId,r])),cardSummary={cards:0,pairs:0,general:0,targeted:0,undetermined:0,cardsWithAnyTargeted:0};
 const cards=base.cards.map(c=>{cardSummary.cards++;const skills=c.skills.map(s=>{const label=byId.get(s.appSkillId).label;cardSummary.pairs++;cardSummary[label.state]++;return {...s,label};});if(skills.some(s=>s.label.state==='targeted'))cardSummary.cardsWithAnyTargeted++;return {...c,skills};});
 a.equal(cardSummary.cards,566);a.equal(cardSummary.pairs,5434);
 return {status:'P3-final-practical-held-review',counts,cardSummary,initial,held,review,added,rows,cards,absoluteChecked,neutrals,publicDeployment:false};
}
if(require.main===module){const [raw,base,abs,dyn,out]=process.argv.slice(2),read=x=>JSON.parse(fs.readFileSync(x,'utf8'));const r=audit(fs.readFileSync(raw),read(base),read(abs),read(dyn));fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');console.log('P3_FINAL_HELD='+JSON.stringify({counts:r.counts,cardSummary:r.cardSummary,initial:r.initial,held:r.held,absoluteChecked:r.absoluteChecked,neutrals:r.neutrals,added:r.added.map(({name,label})=>({name,state:label.state,styles:label.styles})),remaining:r.review.filter(x=>x.category==='comparable-hold'&&!x.reason.startsWith('resolved')).map(({name,reason,types})=>({name,reason,types}))}));}
module.exports={extraNeutral,absoluteBand,absIndex,absoluteProposal,holdReason,audit};
