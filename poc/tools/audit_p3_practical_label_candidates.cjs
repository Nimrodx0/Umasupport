'use strict';
// Batch candidate derivation. No change to approved D052/D056 labels.
// Point occupancy is qualitative direction evidence, not W or game proc.
const a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {evaluate}=require('../src/p3_axis_suitability_review.cjs');
const {classify}=require('./audit_p3_style_rank_paths.cjs');
const {derive}=require('../src/p3_d056_approved_natural_spurt.cjs');
const bandEvidence=require('./verify_rank_band_model_evidence.cjs');
const {pairEnvelopes,choose}=require('../src/p3_rank_window_margin_screen.cjs');
const {COURSES,STYLES}=require('./globalsim_position_expanded.cjs');
const {DOMAINS,check}=require('../src/skill_full_condition_path_audit.cjs');
const SOURCE='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const DIST={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
const MARGINS=[0,5,10,20],bump=(o,k)=>o[k]=(o[k]||0)+1;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function simple(record){return record?.invokes?.length===1&&record.invokes[0].conditions.length===1&&!(record.invokes[0].preConditions??[]).length;}
function measuredCourses(r){
 // Measured turf-good contexts only; never turn explicit eligibility into
 // evidence for unmeasured surfaces or omitted styles.
 return COURSES.filter(x=>r.cells.some(c=>c.context.ground_type===1&&c.context.ground_condition===1&&c.context.distance_type===DIST[x.id]&&c.eligible.length===4)).map(c=>c.id);
}
function phaseCandidate(record,r,c,e=bandEvidence.EVIDENCE){
 if(!simple(record)||c.group!=='existing-phase-rank-point-evidence-review')return {state:'held-source-path'};
 const x=c.items[0];if(x.bands.length!==1)return {state:'held-ambiguous-band'};
 const phase=Number(x.window.split(':')[1]),band=x.bands[0];
 const measured=measuredCourses(r);
 if(!measured.length)return {state:'held-no-four-style-measured-context'};
 a(bandEvidence.validate(e));
 const row=e.rows.find(v=>v.phase===phase&&v.bandId===band);
 if(!row||!bandEvidence.supported(row))return {state:'held-direction-mixed',phase,band};
 return {state:'phase-direction-candidate',styles:row.front===72?[1,2]:[3,4],phase,band,courseIds:measured,
  scope:{ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced','jan2026','noFront'],abilityModes:['equal','jitter10']},
  minimumPointOccupancyGap:row.minStrictMarginPoints,marginSensitivity:Object.fromEntries(MARGINS.map(m=>[m,row.minStrictMarginPoints>m])),
  evidence:{contexts:72,splitDirection:72,reportSha256:e.reportSha256,sourceAction:e.sourceAction},
  withinPreferredGroupEquivalence:false,notWindowW:true};
}
function shortCandidate(record,r,c,direct){
 if(!simple(record)||c.group!=='existing-short-band-window-review')return {state:'held-source-path'};
 const x=c.items[0],ids=measuredCourses(r);if(!ids.length||x.bands.length!==1)return {state:'held-no-four-style-measured-context'};
 // Find a donor only if identical rank integer band/window and all exact
 // course/field/mode/seed-half contexts are present; no data averaging.
 const donors=direct.items.filter(v=>v.status==='model-two-axis-partial-original-condition-only'&&v.windowKey===x.window&&v.bandId===x.bands[0]&&ids.every(id=>v.modelCourses.includes(id))&&STYLES.every(s=>v.styles?.[s]?.status==='model-contexts-only'));
 if(!donors.length)return {state:'held-no-exact-short-window-donor'};
 const signatures=donors.map(d=>pairEnvelopes(Object.fromEntries(STYLES.map(s=>[s,d.styles[s].detail.filter(q=>ids.includes(q.courseId))]))));
 for(const d of donors)for(const s of STYLES){const rows=d.styles[s].detail.filter(q=>ids.includes(q.courseId));a.equal(rows.length,ids.length*4);a.equal(new Set(rows.map(q=>[q.courseId,q.fieldSize,q.mode].join('|'))).size,rows.length);}
 a(signatures.every(v=>JSON.stringify(v)===JSON.stringify(signatures[0])),'same exact mechanism donor disagreement');
 const result=choose(signatures[0],10,true),sensitivity=Object.fromEntries(MARGINS.map(m=>[m,choose(signatures[0],m,true)]));
 return {state:result.state,styles:result.styles.map(s=>STYLES.indexOf(s)+1),courseIds:ids,window:x.window,band:x.bands[0],
  donorCount:donors.length,sensitivity,scope:{ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],abilityModes:['equal','jitter10']}};
}
// Prove only the restricted, same residual logic of a single invoke. Each
// original OR and precondition matrix remains separate. No effect analysis.
function restrictedEquivalent(record,r){
 if(record?.invokes?.length!==1||r.state!=='held'||r.holdTypes.length)return null;
 const inv=record.invokes[0],comparable=r.cells.filter(c=>c.eligible.length>1);
 if(!comparable.length)return null;
 const residual=(matrix,ctx)=>matrix.filter(row=>row.every(p=>!Object.hasOwn(DOMAINS,p.type)||check(ctx[p.type],p.operator,p.value))).map(row=>JSON.stringify(row.filter(p=>!Object.hasOwn(DOMAINS,p.type)))).sort();
 const contexts=[];
 for(const c of comparable){
  const sigs=c.eligible.map(s=>{const ctx={...c.context,running_style:s};return JSON.stringify([residual(inv.conditions,ctx),residual(inv.preConditions?.length?inv.preConditions:[[]],ctx)]);});
  if(new Set(sigs).size!==1||c.eligible.length===4)return null;
  contexts.push({...c.context,styles:c.eligible});
 }
 return {state:'restricted-same-logic-candidate',contexts,notGeneralAcrossAllStyles:true};
}
function audit(raw,base,win,dyn,direct){
 a.equal(hash(raw),SOURCE);a.equal(base.status,'P3.4j-D052-initial-scoped-skill-labels');a.deepEqual(base.counts,{general:257,targeted:43,undetermined:581});
 a.equal(win.status,'P3.4h-paired-rank-window-margins-and-source-branch-consistency-only');a.equal(dyn.status,'P3.4i-scope-local-dynamic-top-group-screen-not-general-label');
 a.equal(direct.status,'P2.28-balanced-two-axis-source-short-window-model-not-game-proc');a.equal(direct.source.sourceUmaSimSHA256,SOURCE);a.equal(direct.source.originalModelRaces,720);a.equal(direct.items.length,75);
 const {result:approved}=derive(raw,base),src=new Map(JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const ws=new Set(win.rows.map(r=>r.appSkillId)),ds=new Map(dyn.rows.map(r=>[r.sourceNumericId,r]));
 const summary={},phaseStates={},shortStates={},neutral=[],phaseRows=[],shortRows=[],restricted=[],dynamicWithin=[],remainingTypes={},rows=[];
 for(const row of approved.rows){
  const record=src.get(row.sourceNumericId),r=evaluate(record,'running_style');
  let state,proposal=null;
  if(row.label.state!=='undetermined')state='approved-'+row.label.state;
  else if(r.state==='source-unavailable')state='source-unavailable';
  else if(r.state==='scope-only')state='explicit-single-style-no-comparison';
  else if(r.state==='full-neutral-candidate'){
   state='new-general-candidate';proposal={state:'general',contexts:r.cells.filter(c=>c.state==='full-neutral-candidate').map(c=>c.context),conditionTypes:[...new Set(record.invokes.flatMap(i=>[...i.conditions,...(i.preConditions??[])].flat().map(p=>p.type)))].sort()};
   neutral.push({name:record.name,types:proposal.conditionTypes});
  }else if((proposal=restrictedEquivalent(record,r))){
   state=proposal.state;restricted.push({name:record.name,styles:[...new Set(proposal.contexts.flatMap(c=>c.styles))]});
  }else if(!ws.has(row.appSkillId)&&!ds.has(row.sourceNumericId)&&r.holdTypes.some(t=>t==='order'||t==='order_rate')){
   const c=classify(record,r);
   if(c.group==='existing-phase-rank-point-evidence-review'){proposal=phaseCandidate(record,r,c);state=proposal.state;bump(phaseStates,state);phaseRows.push({name:record.name,...proposal});}
   else if(c.group==='existing-short-band-window-review'){proposal=shortCandidate(record,r,c,direct);state=proposal.state;bump(shortStates,state);shortRows.push({name:record.name,...proposal});}
   else state='held-rank-other';
  }else if(ds.has(row.sourceNumericId)&&ds.get(row.sourceNumericId).sweeps.find(x=>x.margin===10)?.state==='within-margin-in-eligible-fixed-contexts'){
   state='dynamic-within-margin-only';dynamicWithin.push(record.name);
  }else state='held-other';
  bump(summary,state);
  if(state.startsWith('held'))for(const t of r.holdTypes)bump(remainingTypes,t);
  rows.push({appSkillId:row.appSkillId,sourceNumericId:row.sourceNumericId,state,proposal,approvedLabel:row.label});
 }
 a.equal(rows.length,881);a.equal(summary['approved-general'],281);a.equal(summary['approved-targeted'],43);
 a.equal(summary['source-unavailable'],63);a.equal(summary['explicit-single-style-no-comparison'],277);
 a.equal(neutral.length,13);a.equal(restricted.length,4);a.equal(phaseRows.length,40);a.equal(shortRows.length,2);a.equal(dynamicWithin.length,2);
 a.equal(Object.values(summary).reduce((x,y)=>x+y,0),881);
 return {status:'D055-D056-batch-candidate-review-not-approved',summary,phaseStates,shortStates,neutral,restricted,phaseRows,shortRows,dynamicWithin,remainingTypes,formalLabelsChanged:0,rows};
}
if(require.main===module){const [raw,b,w,d,s,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8'));const r=audit(fs.readFileSync(raw),read(b),read(w),read(d),read(s));if(out)fs.writeFileSync(out,JSON.stringify(r,null,2)+'\n');const {rows,...summary}=r;console.log('P3_BATCH_CANDIDATES='+JSON.stringify(summary));}
module.exports={phaseCandidate,shortCandidate,restrictedEquivalent,audit,measuredCourses};
