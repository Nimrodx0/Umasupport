'use strict';
/*
 * P2 research triage: classifies source predicate TYPES, never skill suitability.
 * Explicit eligibility != style opportunity; skipped inference != universal.
 * The classifications are research priorities, not verified correlations.
 */
const BUCKETS=Object.freeze({
 'explicit-eligibility':[
  'running_style','distance_type','ground_type','ground_condition',
  'track_id','rotation','is_basis_distance','is_dirtgrade','is_abroad',
  'is_tight_track','course_distance','season','weather','time','grade',
  'motivation','post_number','popularity','base_speed','base_stamina',
  'base_power','base_guts','base_wiz','fan_count','succession_skill_count'],
 'timing-or-geometry-only':[
  'phase','phase_random','phase_firsthalf_random','phase_laterhalf_random',
  'phase_firstquarter_random','phase_firstquarter','phase_firsthalf',
  'phase_laterhalf','phase_corner_random','phase_straight_random',
  'phase_first_half_straight_random','phase_latter_half_straight_random',
  'distance_rate','distance_rate_after_random','remain_distance',
  'accumulatetime','furlong','corner','corner_random','all_corner_random',
  'corner_count','is_finalcorner','is_finalcorner_random',
  'is_finalcorner_laterhalf','is_last_straight','is_last_straight_onetime',
  'last_straight_random','straight_random','straight_front_type',
  'slope','up_slope_random','up_slope_random_later_half',
  'down_slope_random','down_slope_random_later_half','always'],
 'rank-opportunity-study':[
  'order_rate','order','order_rate_in10_continue','order_rate_in20_continue',
  'order_rate_in30_continue','order_rate_in40_continue',
  'order_rate_in50_continue','order_rate_in60_continue',
  'order_rate_in70_continue','order_rate_in80_continue',
  'order_rate_in90_continue','order_rate_out10_continue',
  'order_rate_out20_continue','order_rate_out30_continue',
  'order_rate_out40_continue','order_rate_out50_continue',
  'order_rate_out60_continue','order_rate_out70_continue',
  'order_rate_out80_continue','order_rate_out90_continue'],
 'interaction-or-spurt-pilot':[
  'is_overtake','change_order_onetime','change_order_up_middle',
  'change_order_up_end_after','change_order_up_finalcorner_after',
  'overtake_target_time','overtake_target_no_order_up_time',
  'blocked_front','blocked_front_continuetime','blocked_side_continuetime',
  'compete_fight_count','is_move_lane','is_lastspurt','lastspurt',
  'run_at_full_speed_random','is_goodstart','is_badstart'],
 'no-general-style-inference':[
  'distance_diff_top','distance_diff_top_float','distance_diff_rate',
  'bashin_diff_infront','bashin_diff_behind','infront_near_lane_time',
  'behind_near_lane_time','behind_near_lane_time_set1',
  'near_count','near_infront_count','is_surrounded','visiblehorse',
  'lane_type','is_behind_in'],
 'complex-or-external-hold':[
  'is_activate_other_skill_detail','is_used_skill_id',
  'is_used_skill_id_with_detail_one','is_exist_skill_id',
  'is_activate_any_skill','is_activate_heal_skill',
  'is_other_character_activate_advantage_skill',
  'is_popularity_top_character_activate_advantage_skill',
  'activate_count_all','activate_count_start','activate_count_middle',
  'activate_count_later_half','activate_count_end_after',
  'activate_count_heal','activate_count_param_skill',
  'activate_count_all_team','same_skill_horse_count',
  'running_style_count_same_rate','running_style_count_same',
  'running_style_equal_popularity_one','random_lot','random_lot_shared',
  'hp_per','temptation_count','temptation_opponent_count_behind']
});
const POLICY=Object.freeze({
 'explicit-eligibility':{
  treatment:'apply-exact-source-eligibility-only',
  canInferStyle:false,
  rationale:'Only the stated race/horse prerequisite; does not imply activation ease or style preference.'},
 'timing-or-geometry-only':{
  treatment:'apply-exact-geometry-or-timing-context-only',
  canInferStyle:false,
  rationale:'Timing/geometry frames other conditions; does not create style preference on its own.'},
 'rank-opportunity-study':{
  treatment:'candidate-for-condition-level-research',
  canInferStyle:false,
  rationale:'Four-style rank opportunities can be researched; only exact source signatures with validated evidence may later be used.'},
 'interaction-or-spurt-pilot':{
  treatment:'pilot-before-any-style-inference',
  canInferStyle:false,
  rationale:'Potential style signal, but must validate mechanic, real event prevalence and AND intersection; existing simulator may approximate.'},
 'no-general-style-inference':{
  treatment:'skip-style-inference-by-default',
  canInferStyle:false,
  rationale:'Relative distance, nearby position or other context-specific state is difficult to generalize; unknown is not style-neutral.'},
 'complex-or-external-hold':{
  treatment:'hold-until-independent-mechanics-evidence',
  canInferStyle:false,
  rationale:'Random/external/other skill/state prerequisites; cannot infer style ease from isolated predicate.'},
 'unreviewed':{
  treatment:'hold-unreviewed-code',
  canInferStyle:false,
  rationale:'Unknown source condition is never silently neutral or ignored.'}
});

/*
 * Small real-source path feasibility audit. One count per source skill ID,
 * never union conditions from different AND rows or Invoke definitions.
 * The result records candidate CO-OCCURRENCES, not simultaneous proc rates.
 */
const PILOT_TYPES=Object.freeze([
 'order','is_overtake','change_order_onetime','blocked_side_continuetime',
 'is_lastspurt','corner_random','all_corner_random','straight_random',
 'distance_diff_top'
]);
const RANK_TYPES=new Set(BUCKETS['rank-opportunity-study']);
const WINDOW_TYPES=new Set(BUCKETS['timing-or-geometry-only']);
function auditPilotPaths(records){
 if(!Array.isArray(records))throw Error('Matched source skill records required');
 const result=PILOT_TYPES.map(type=>{
  let appSkills=0,sameAndRank=0,sameAndWindow=0,
    sameAndRankWindow=0,withExtraDynamicAnd=0,
    withOr=0,withPreConditions=0,withMultiInvoke=0;
  const representativeSourceIds=[];
  for(const skill of records){
   const rows=(skill.invokes||[]).flatMap(inv=>
    ['preConditions','conditions'].flatMap(side=>
      (inv[side]||[]).map(row=>({side,row}))));
   const targets=rows.filter(({row})=>row.some(x=>x.type===type));
   if(!targets.length)continue;
   appSkills++;
   if(representativeSourceIds.length<5)
    representativeSourceIds.push(String(skill.id));
   const hasRank=({row})=>row.some(x=>x.type!==type&&RANK_TYPES.has(x.type));
   const hasWindow=({row})=>row.some(x=>x.type!==type&&WINDOW_TYPES.has(x.type));
   if(targets.some(hasRank))sameAndRank++;
   if(targets.some(hasWindow))sameAndWindow++;
   if(targets.some(x=>hasRank(x)&&hasWindow(x)))sameAndRankWindow++;
   if(targets.some(({row})=>row.some(x=>x.type!==type&&
    ['interaction-or-spurt-pilot','no-general-style-inference',
      'complex-or-external-hold','unreviewed'].includes(typeDecision(x.type).group))))
    withExtraDynamicAnd++;
   if((skill.invokes||[]).some(inv=>
    (inv.conditions||[]).length>1||(inv.preConditions||[]).length>1))
    withOr++;
   if(targets.some(x=>x.side==='preConditions'))withPreConditions++;
   if((skill.invokes||[]).length>1)withMultiInvoke++;
  }
  return {type,group:typeDecision(type).group,appSkills,
   sameAndRank,sameAndWindow,sameAndRankWindow,
   withExtraDynamicAnd,withOr,withPreConditions,withMultiInvoke,
   representativeSourceIds};
 });
 return result;
}

const catalogue=new Map();
for(const [group,types] of Object.entries(BUCKETS)){
 for(const type of types){
  if(catalogue.has(type))throw Error('Condition triage duplicate type: '+type);
  catalogue.set(type,group);
 }
}
const typeDecision=type=>{
 const group=catalogue.get(type)||'unreviewed';
 return {group,...POLICY[group]};
};
const count=(xs,fn)=>Object.fromEntries([...new Set(xs.map(fn))].sort()
 .map(k=>[k,xs.filter(x=>fn(x)===k).length]));
function examine(all,app,{matchedRecords=[]}={}){
 const full=all?.counts?.byType,actual=app?.counts?.byType;
 if(!full||!actual)throw Error('Validated P0 inventory required');
 const rows=Object.keys(full).sort().map(type=>{
  const decision=typeDecision(type);
  const y=actual[type];
  return {type,group:decision.group,treatment:decision.treatment,
   sourceRegistrySkills:full[type].skills,appMatchedSkills:y?.skills||0,
   sourceOccurrences:full[type].occurrences,appOccurrences:y?.occurrences||0};
 });
 if(rows.length!==all.counts.distinctConditionTypes||
    rows.filter(x=>x.appMatchedSkills>0).length!==app.counts.distinctConditionTypes)
  throw Error('P0 condition type coverage mismatch');
 const unreviewedApp=rows.filter(x=>
  x.appMatchedSkills>0&&x.group==='unreviewed').map(x=>x.type);
 const sourceIds=new Set(),skillStates=[];
 for(const record of matchedRecords){
  if(sourceIds.has(record.id))throw Error('Repeated matched source skill ID');
  sourceIds.add(record.id);
  const types=new Set(),conditionRows=[];
  for(const invoke of record.invokes||[])for(const side of ['preConditions','conditions']){
   for(const row of invoke[side]||[]){
    const groups=[...new Set(row.map(x=>typeDecision(x.type).group))].sort();
    conditionRows.push({side,groups});
    for(const x of row)types.add(x.type);
   }
  }
  const groups=[...new Set([...types].map(t=>typeDecision(t).group))].sort();
  const held=groups.some(g=>['no-general-style-inference',
   'complex-or-external-hold','unreviewed','interaction-or-spurt-pilot'].includes(g));
  const multi=record.invokes?.length>1;
  const pre=conditionRows.some(x=>x.side==='preConditions');
  const or=(record.invokes||[]).some(inv=>
   (inv.conditions||[]).length>1||(inv.preConditions||[]).length>1);
  skillStates.push({groups,held,multi,pre,or,
   hasRank:groups.includes('rank-opportunity-study'),
   hasPilot:groups.includes('interaction-or-spurt-pilot'),
   hasDeferred:groups.includes('no-general-style-inference')||
    groups.includes('complex-or-external-hold')||
    groups.includes('unreviewed')});
 }
 const summary={
  totalSourceTypes:rows.length,
  appMatchedTypes:rows.filter(x=>x.appMatchedSkills>0).length,
  appMatchedSkillRecords:matchedRecords.length,
  typesByPolicy:Object.fromEntries(Object.keys(POLICY).map(k=>
    [k,{allTypes:rows.filter(r=>r.group===k).length,
      appTypes:rows.filter(r=>r.group===k&&r.appMatchedSkills>0).length,
      appDistinctSkillCount:skillStates.filter(s=>s.groups.includes(k)).length}])),
  pilotPathAudit:auditPilotPaths(matchedRecords),
  matchedSkillStructure:{
   multiInvoke:skillStates.filter(x=>x.multi).length,
   withPreConditions:skillStates.filter(x=>x.pre).length,
   withOr:skillStates.filter(x=>x.or).length,
   includesRankType:skillStates.filter(x=>x.hasRank).length,
   includesPilotType:skillStates.filter(x=>x.hasPilot).length,
   includesDeferredType:skillStates.filter(x=>x.hasDeferred).length,
   candidateAndDeferredMixed:skillStates.filter(x=>x.hasRank&&x.hasDeferred).length,
   atLeastOneHeldOrPilot:skillStates.filter(x=>x.held).length
  },
  unreviewedAppTypes:unreviewedApp,
  noAutomaticStyleLabels:true,
  noAutomaticUniversalStyleInferences:true,
  skillEffectUtility:'future-extension-only',
  sourceCohort:'P0 fixed pinned UmaSim dictionary and strictly matched app skills'
 };
 return {schemaVersion:1,
  status:'P2-condition-type-research-triage-not-skill-or-card-suitability',
  summary,byType:rows.sort((a,b)=>b.appMatchedSkills-a.appMatchedSkills||
    a.type.localeCompare(b.type))};
}
module.exports={BUCKETS,POLICY,PILOT_TYPES,typeDecision,auditPilotPaths,examine};
