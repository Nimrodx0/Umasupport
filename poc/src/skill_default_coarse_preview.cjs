'use strict';
/*
 * P2->P3 read-only DEFAULT-STYLE PROPOSAL, never an adopted production grade.
 * Four independent running styles; no race setup form, no synthetic "real"
 * frequencies. Counts are support-card SKILL GRANT CANDIDATES, not expected
 * activation, grant probabilities, skill utility or a total card score.
 */
const core=require('./core.js');
const base=require('./skill_balanced_four_style_fit.cjs');
const older=require('./skill_activation_fit_v1.cjs');
const STYLES=Object.freeze(['逃げ','先行','差し','追込']);
const VERSION='p3-coarse-default-preview-v0';
const MOODS=Object.freeze({
 favorable:'向きの傾向',unfavorable:'向きにくい傾向',
 mixed:'傾向が割れる',unresolved:'材料不足'
});
const mapStatus=x=>Object.freeze({status:x,modelOnly:true});
function branchFit(profile){
 const comparative=base.evaluate(profile);
 const qualitative=older.evaluate(profile);
 const byStyle={};
 for(const style of STYLES){
  const c=comparative.styles?.[style],q=qualitative.styles?.[style];
  if(c?.status==='ineligible' ||q?.status==='ineligible'){
   byStyle[style]={signal:'explicit-ineligible',basis:'explicit-source-condition',
    detail:'すべての発動経路で明示脚質条件が対象作戦を除外'};
   continue;
  }
  // Never upgrade a partial-rank snippet when any extra AND, OR path,
  // precondition, or unsupported timing was not validated.
  if(c?.status==='model-comparative-evidence'&&c.comparison){
   const p=c.comparison;
   const wins=p.higherThan?.length??0,losses=p.lowerThan?.length??0,
    holds=p.heldAgainst?.length??0;
   const signal=wins>=2&&losses===0?'relative-favorable':
    losses>=2&&wins===0?'relative-unfavorable':
    'relative-mixed';
   byStyle[style]={signal,basis:'pinned-balanced-four-style-partial-order',
    detail:signal==='relative-mixed'?
     '一部の他脚質より有利・不利、または比較を保留':
     '均衡編成の固定順位モデルにおける相対的傾向',
    comparisons:{wins,losses,holds},modelOnly:true};
   continue;
  }
  // Broader old two-group rule is a *secondary* contextual clue only.
  // It does not pretend to be an independent four-style model comparison.
  if(q?.status==='high'||q?.status==='low'){
   byStyle[style]={signal:q.status==='high'?
    'broad-favorable':'broad-unfavorable',
    basis:'v1.3-broad-front-rear-reference-only',
    detail:'4脚質の独立比較では未確認。前方／後方の参考傾向',
    modelOnly:true};
   continue;
  }
  if(q?.status==='neutral'){
   byStyle[style]={signal:'race-gate-only',
    basis:'race-conditions-only-not-skill-utility',
    detail:'把握済みの発動条件には脚質による明確な差を確認していない'};
   continue;
  }
  // Explicit permission for a subset is not proof of rate or value.
  const allPaths=profile.invokes.flatMap(x=>x.conditions||[]);
  const hasStyle=allPaths.some(r=>r.some(c=>c.type==='running_style'))||
   profile.invokes.some(i=>(i.preConditions||[]).some(r=>
    r.some(c=>c.type==='running_style')));
  byStyle[style]={signal:hasStyle?'explicit-eligible-unmeasured':'unresolved',
   basis:hasStyle?'explicit-allowed-but-opportunity-unmeasured':
    'no-full-condition-evidence',
   detail:hasStyle?'発動の可能性はあるが、明示許可だけで得意とは判定しない':
    '順位条件・時期・他のAND/OR等の評価に必要な根拠が不足'};
 }
 return byStyle;
}
function skillSummary(skill){
 if(!skill||typeof skill.id!=='string'||typeof skill.name!=='string')
  throw Error('Skill identity missing');
 const p=skill.activationProfile;
 const styles=!p||p.status!=='source-structure'?
  Object.fromEntries(STYLES.map(s=>[s,{signal:'unresolved',
   basis:'unmatched-skill-source-structure',
   detail:'辞書の数値ID・名称・発動条件が照合できない'}])):
  branchFit(p);
 // If all alternative activation paths exclude competing styles,
 // a permitted style is a genuine target of the source skill, but it is
 // still NOT proof that its effect is useful or always activates.
 const anyExcluded=STYLES.some(name=>
  styles[name].signal==='explicit-ineligible');
 if(anyExcluded)for(const style of STYLES){
  if(styles[style].signal==='explicit-eligible-unmeasured')
   styles[style]={signal:'explicit-targeted',
    basis:'source-explicit-running-style-permission',
    detail:'他脚質では明示条件により発動不可。対象脚質への提供候補であり、効果の有用性は未評価'};
 }
 return {skillId:skill.id,skillName:skill.name,
  sourceNumericId:p?.status==='source-structure'?
   p.sourceNumericId:null,
  researchOnly:true,styles};
}
function takeRoutes(card,model,config={}){
 if(!card||typeof card.id!=='string'||!model?.skillById||
  !model?.meta)throw Error('Cannot audit incomplete card/model');
 const knownHints=card.sourceStatus?.startsWith('verified_hints')===true;
 const reviewed=model.meta.reviewedEventRecords>0;
 const hintCard={...card,hints:knownHints?card.hints:[],
  hintsByStage:knownHints?card.hintsByStage:null,
  events:reviewed&&card.eventCoverage==='partial'?
   card.events:[]};
 const raw=core.directRoutes(hintCard,{stage:config.stage??4,
  choices:config.choices??{},outcomes:config.outcomes??{}});
 return {routes:raw,knownHints,
  approvedEventData:reviewed&&card.eventCoverage==='partial',
  eventScope:!reviewed?'unavailable':
   card.eventCoverage==='partial'?'reviewed-partial':'no-reviewed-card-records'};
}
function previewCard(card,model,config={}){
 const {routes,knownHints,approvedEventData,eventScope}=
  takeRoutes(card,model,config);
 const grouped=new Map();
 for(const route of routes){
  if(typeof route.skillId!=='string')throw Error('Invalid grant route skill ID');
  const prev=grouped.get(route.skillId)||[];
  prev.push(route);grouped.set(route.skillId,prev);
 }
 const skills=[...grouped].map(([id,skillRoutes])=>{
  const skill=model.skillById[id];
  const provisional=skill?skillSummary(skill):
   {skillId:id,skillName:'未照合 ('+id+')',
    sourceNumericId:null,researchOnly:true,
    styles:Object.fromEntries(STYLES.map(s=>[s,{signal:'unresolved',
     basis:'missing-app-skill-id'}]))};
  const sources=[...new Set(skillRoutes.map(x=>x.source))].sort();
  const unconditional=skillRoutes.some(x=>!x.conditional);
  return {...provisional,
   availability:unconditional?'route-eligible-unconditional':
    'route-conditional-only',
   sources,routeCount:skillRoutes.length,
   conditionalRouteCount:skillRoutes.filter(x=>x.conditional).length,
   routes:skillRoutes.map(x=>({source:x.source,eventId:x.eventId,
    conditional:x.conditional,condition:x.condition??null}))};
 });
 const counts=Object.fromEntries(STYLES.map(style=>{
  const a={relativeFavorable:0,relativeUnfavorable:0,
   broadFavorable:0,broadUnfavorable:0,explicitTargeted:0,
   mixed:0,ineligible:0,unknown:0,
   raceGateOnly:0,conditionalOnly:0,unconditional:0,
   headlineFavorable:0,headlineUnfavorable:0,
   conditionalFavorable:0};
  for(const skill of skills){
   const s=skill.styles[style].signal;
   if(s==='relative-favorable')a.relativeFavorable++;
   else if(s==='relative-unfavorable')a.relativeUnfavorable++;
   else if(s==='broad-favorable')a.broadFavorable++;
   else if(s==='broad-unfavorable')a.broadUnfavorable++;
   else if(s==='explicit-targeted')a.explicitTargeted++;
   else if(s==='relative-mixed')a.mixed++;
   else if(s==='explicit-ineligible')a.ineligible++;
   else if(s==='race-gate-only')a.raceGateOnly++;
   else a.unknown++;
   const positive=['relative-favorable','broad-favorable',
    'explicit-targeted'].includes(s);
   const negative=['relative-unfavorable',
    'broad-unfavorable','explicit-ineligible'].includes(s);
   if(skill.availability==='route-conditional-only'){
    a.conditionalOnly++;
    if(positive)a.conditionalFavorable++;
   }else{
    a.unconditional++;
    if(positive)a.headlineFavorable++;
    if(negative)a.headlineUnfavorable++;
   }
  }
  const pos=a.headlineFavorable,neg=a.headlineUnfavorable;
  // Not a numeric performance or rarity-weighted score. One unmeasured skill
  // cannot be counted against a style, and conditions on a route remain marked.
  const label=pos>0&&neg>0?'mixed':pos>0?'favorable':
   neg>0?'unfavorable':'unresolved';
  return [style,{...a,label,labelJa:MOODS[label],
   evidenceCount:pos+neg,
   strongFourStyleEvidence:a.relativeFavorable+a.relativeUnfavorable,
   onlyBroadReference:pos+neg>0&&
    a.relativeFavorable+a.relativeUnfavorable+a.explicitTargeted===0}];
 }));
 // Pareto comparison of skill evidence counts, NOT a weighted score or
 // headcount-specific performance prediction. This guards against all four
 // styles getting equal "favored" labels on a mixed-evidence card.
 const positiveKeys=['relativeFavorable','broadFavorable','explicitTargeted'];
 const negativeKeys=['relativeUnfavorable','broadUnfavorable','ineligible'];
 const uncondSourceSkills=skills.filter(x=>
  x.availability==='route-eligible-unconditional');
 const directionalSignals=uncondSourceSkills.some(x=>STYLES.some(name=>
  ['relative-favorable','broad-favorable','explicit-targeted']
   .includes(x.styles[name].signal)));
 function better(a,b){
  const aa=counts[a],bb=counts[b];
  const notWorse=positiveKeys.every(k=>aa[k]>=bb[k])&&
   negativeKeys.every(k=>aa[k]<=bb[k]);
  const strictlyBetter=positiveKeys.some(k=>aa[k]>bb[k])||
   negativeKeys.some(k=>aa[k]<bb[k]);
  return notWorse&&strictlyBetter;
 }
 const leaders=directionalSignals?STYLES.filter(style=>
  !STYLES.some(other=>other!==style&&better(other,style))):[];
 const coarseDirection=leaders.length===4||leaders.length===0?
  {status:'not-distinguishable-with-current-evidence',styles:[]}:
  {status:'non-dominated-evidence-candidates-not-card-score',
   styles:leaders};
 return {version:VERSION,status:'research-only-coarse-card-skill-candidate-preview',
  coarseDirection,
  cardId:card.id,cardName:card.name,
  stage:config.stage??4,
  scenario:'balanced-reference-no-user-race-configuration',
  coverage:{verifiedNormalHints:knownHints,reviewedEventData:approvedEventData,
   eventScope,uniqueSkillCandidates:skills.length,
   routes:routes.length,unmatchedSkills:skills.filter(s=>
    s.sourceNumericId===null).length},
  styles:counts,skills,restrictions:[
   'One per distinct skill ID: gold/white variants are not silently merged.',
   'The source route and skill eligibility are not guaranteed acquisition or trigger rates.',
   'Explicit style restrictions outrank model tendency; permissive restrictions alone do not prove favorable opportunity.',
   'V1.3 front/rear model-only broad fallback is separated from strict four-style evidence.',
   'Unknown conditions are not treated as low suitability, unknown events are not treated as zero routes.',
   'No weighting for rarity, hints vs events, card copies, probabilities, or effect usefulness is authorized.',
   'No high/middle/low numeric percentage thresholds or race-field inputs are required.',
   'This is not a production card score, recommendation ranking, nor current JP-game validation.'
  ]};
}
module.exports={VERSION,STYLES,MOODS,branchFit,skillSummary,takeRoutes,previewCard};
