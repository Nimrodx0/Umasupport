'use strict';
// D-054 review candidate only. No published or approved label changes.
// Compare each axis with the other explicit axes fixed; retain OR/Invoke identity
// and precondition history. Effect objects are deliberately not read.
const a=require('node:assert/strict');
const {DOMAINS,check}=require('./skill_full_condition_path_audit.cjs');
const scope=require('../data/p2_approved_research_scope_d051.v1.json');
const AXES=['running_style','distance_type','ground_type'];
const KEYS=Object.keys(DOMAINS);
// Reviewable conditional neutrality, not game probability equality.
// Position/phase conditions standalone: style-neutral under D051; geometry
// beyond race-relative phase needs review across distance and surfaces.
const PHASE=['phase','phase_random','phase_firsthalf_random','phase_laterhalf_random','phase_firstquarter_random','distance_rate','distance_rate_after_random'];
const FIXED_CONTEXT=['motivation','weather','season','rotation','track_id','random_lot','random_lot_shared'];
const ABILITY=['base_speed','base_stamina','base_power','base_guts','base_wiz'];
const neutral={
 running_style:new Set([...scope.geometry,...FIXED_CONTEXT,...ABILITY,'course_distance','is_basis_distance','is_dirtgrade','is_tight_track','corner_count','time']),
 distance_type:new Set([...PHASE,...FIXED_CONTEXT.filter(t=>t!=='track_id')]),
 ground_type:new Set([...PHASE,...FIXED_CONTEXT.filter(t=>t!=='track_id'),...ABILITY])
};
// Distribution-dependent conditions (post number, skill count etc.) are not
// automatically neutral solely because detailed research was excluded.
const contexts=KEYS.reduce((xs,k)=>xs.flatMap(x=>DOMAINS[k].map(v=>({...x,[k]:v}))),[{}]);
const validMatrix=m=>Array.isArray(m)&&m.every(r=>Array.isArray(r)&&r.every(p=>p&&typeof p.type==='string'&&['==','!=','<','<=','>','>='].includes(p.operator)&&Number.isSafeInteger(p.value)));
function sourceValid(record){return !!(record&&Array.isArray(record.invokes)&&record.invokes.length&&record.invokes.every(i=>i&&validMatrix(i.conditions)&&i.conditions.length&&validMatrix(i.preConditions??[])));}
function surviving(record,ctx,axis){
 const sig=[],holds=new Set();
 const matrix=(m)=>m.map((terms,index)=>{
  const residual=[];let eligible=true;
  for(const p of terms){
   if(Object.hasOwn(DOMAINS,p.type)){if(!check(ctx[p.type],p.operator,p.value))eligible=false;}
   else if(p.type==='always'&&p.operator==='=='&&p.value===1){}
   else residual.push([p.type,p.operator,p.value]);
  }
  return eligible?{index,residual}:null;
 }).filter(Boolean);
 for(const [index,i] of record.invokes.entries()){
  const conditions=matrix(i.conditions),pre=matrix(i.preConditions?.length?i.preConditions:[[]]);
  if(!conditions.length||!pre.length)continue;
  for(const row of [...conditions,...pre])for(const [t] of row.residual)if(!neutral[axis].has(t))holds.add(t);
  sig.push({index,conditions,pre});
 }
 return {sig,holds:[...holds].sort()};
}
function evaluate(record,axis){
 if(!AXES.includes(axis))throw Error('unsupported axis');
 if(!sourceValid(record))return {state:'source-unavailable',cells:[],counts:{},holdTypes:[]};
 const fixedKeys=KEYS.filter(k=>k!==axis);
 const bases=contexts.filter(c=>c[axis]===DOMAINS[axis][0]);
 const counts={},cells=[],holdTypes=new Set();
 for(const base of bases){
  const context=Object.fromEntries(fixedKeys.map(k=>[k,base[k]]));
  const alternatives=DOMAINS[axis].map(value=>({value,...surviving(record,{...context,[axis]:value},axis)})).filter(r=>r.sig.length);
  const eligible=alternatives.map(r=>r.value);
  const blockers=[...new Set(alternatives.flatMap(x=>x.holds))].sort();
  let state;
  if(!eligible.length)state='outside';
  else if(eligible.length===1)state='single-eligible';
  else if(blockers.length)state='axis-dependent-or-unknown';
  else if(!alternatives.every(x=>JSON.stringify(x.sig)===JSON.stringify(alternatives[0].sig)))state='different-paths';
  else state=eligible.length===DOMAINS[axis].length?'full-neutral-candidate':'restricted-neutral-candidate';
  if(state==='axis-dependent-or-unknown')for(const t of blockers)holdTypes.add(t);
  counts[state]=(counts[state]||0)+1;cells.push({context,eligible,state,blockers});
 }
 const comparable=cells.filter(x=>x.eligible.length>1),good=comparable.filter(x=>x.state.endsWith('neutral-candidate'));
 let state;
 if(!comparable.length)state=cells.some(x=>x.eligible.length)?'scope-only':'outside';
 else if(good.length===comparable.length)state=cells.filter(x=>x.eligible.length).every(x=>x.state==='full-neutral-candidate')?'full-neutral-candidate':'restricted-neutral-candidate';
 else if(good.length)state='context-dependent-candidate';
 else state='held';
 return {state,cells,counts,holdTypes:[...holdTypes].sort()};
}
function review(record){return Object.fromEntries(AXES.map(axis=>[axis,evaluate(record,axis)]));}
module.exports={AXES,review,evaluate,sourceValid};
