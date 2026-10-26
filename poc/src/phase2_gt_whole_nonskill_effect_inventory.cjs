'use strict';
/*
 * Whole PINNED GameTora non-skill scalar inventory; NEVER a public catalog.
 * Measure EVERY source route, retaining numeric location and character
 * recipient. Run an isolated production-SCHEMA projection only when every
 * choice/result is structurally unambiguous. No guessed chain predecessors,
 * event triggers, named outcomes, probability or proprietary story prose.
 */
const {flattenRoutes}=require('../tools/audit_gametora_branches.cjs');
const schema=require('./event_schema.js');
const core=require('./core.js');
const POLICY=require('../config/event-source-priority.v1.json');
const fail=s=>{throw Error('GT非スキル全件監査: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const STAT_KINDS=['speed','stamina','power','guts','wisdom'];
const TYPES=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points']);
const STATUS_TYPES=new Set(['condition','heal_status']);
// A single schema contract handles distinct scenario resource families.
// These are never base stats and their effective game-scene award is not
// demonstrated by an unapproved GT snapshot alone.
const SCENARIO_RESOURCES=Object.freeze({
 veggies:{kind:'great-food-festival-all-vegetables',
  scenario:'great-food-festival',targetSelection:'all-five-vegetables'},
 ken_ing:{kind:'scenario14-secret-ingredients',
  scenario:'scenario-14',targetSelection:'secret-ingredient-count'},
 // Three distinct Legends guide gauges. The fixed effect has no explicit
 // character/legend ID for a selected gauge; the chosen source branch owns
 // that identity. Never make one selected gain look like all-three gains.
 ttl_gauge_all:{kind:'legends-all-guide-gauges',
  scenario:'legends',targetSelection:'all-three-legend-guides'},
 ttl_gauge:{kind:'legends-choice-guide-gauge',
  scenario:'legends',targetSelection:'chosen-legend-from-event-choice'}
});
// Separate temporal and scenario-effect statuses from scalar stats.
// yhs_sr is a no-value flag, so never synthesize a numeric gain.
const CONTEXT_OPERATIONS=Object.freeze({
 ntsr:{kind:'next-turn-other-support-specialty-rate',
  targetSelection:'other-supports-next-turn',duration:'next-turn'},
 yhs_tix:{kind:'onsen-bathing-tickets',
  scenario:'yukoma-onsen',targetSelection:'bath-ticket-count'},
 yhs_sr:{kind:'onsen-next-bath-super-recovery',
  scenario:'yukoma-onsen',targetSelection:'next-bath-super-recovery',
  activation:'next-bath',flag:true}
});
const parseChance=value=>{
 if(value===undefined)return undefined;
 const s=typeof value==='number'||typeof value==='string'?String(value):'';
 if(!/^(?:0?\.\d+|1(?:\.0+)?)$/.test(s))return null;
 const n=Number(s);
 return n>0&&n<=1?n:null;
};
const SKILL_TYPES=new Set(['skill_hint','skill_hint_or','obtain_skill']);
const CONTROL_TYPES=new Set(['chain_end','branch_flag',
 'both_previous_chain_good','one_previous_chain_good',
 'both_previous_chain_bad','one_previous_chain_bad',
 'result_good','result_bad','result_average','success','fail']);
const SECTIONS=new Set(['random','arrows','special','dates','dates_random']);
const TRIGGERS={special:'special-trigger',dates:'outing-sequence',
 dates_random:'outing-random'};
const sorted=m=>Object.fromEntries([...m].sort(([a],[b])=>a.localeCompare(b)));
const count=(m,k)=>m.set(k,(m.get(k)||0)+1);
const parseDelta=v=>{
 if(typeof v!=='string'&&typeof v!=='number')return null;
 const s=String(v);
 return /^[+-]?\d+$/.test(s)&&Number.isSafeInteger(Number(s))?Number(s):null;
};
function analyze({documents,index},{strict=false}={}){
 if(POLICY.baselineSource!=='GameTora-derived'||
    POLICY.automaticPublicationAllowed!==false||
    !Array.isArray(documents)||!Array.isArray(index?.cards)||
    index.dataKind!=='umasupport-whole-event-provisional-index'||
    index.publicationApproval!==false||
    index.sourcePins?.gameToraDerived!==POLICY.baselineRevision)
  fail('固定元・全母数の承認／ピン検証が不正');
 const roster=new Map();
 for(const row of index.cards){
  if(!/^\d{5}$/.test(row.cardId)||roster.has(row.cardId))
   fail('母集団のIDが不正／重複');
  roster.set(row.cardId,row);
 }
 const docs=new Map();
 for(const d of documents){
  const id=String(d?.id);
  if(d?.kind!=='support'||!roster.has(id)||docs.has(id)||
     !obj(d.events_ja)&&!obj(d.events))
   fail('固定GTカードID・種別・イベント辞書が不正: '+id);
  docs.set(id,d);
 }
 let sourceEvents=0,sourceChoices=0,expandedRoutes=0,allEffectMentions=0,
  recognizedNonSkillMentions=0,integerNonSkillMentions=0,
  nonZeroNumericNonSkillMentions=0,zeroNonSkillMentions=0,
  blockedNumericEffectMentions=0,eligibleNumericEffectMentions=0,
  sourceSkillEffectMentions=0,sourceControlEffectMentions=0,
  chainEndMentions=0,chainEndAcceptedSourceMentions=0,
  chainEndRejectedSourceMentions=0,isolatedTerminalOutcomeRecords=0,
  unrecognizedEffectMentions=0,invalidRecipientNumericMentions=0,
  allStatsMentions=0,allStatsValidMentions=0,
  allStatsInvalidMentions=0,allStatsZeroMentions=0,
  allStatsExpandedEffectComponents=0,
  statusSourceMentions=0,statusValidMentions=0,statusInvalidMentions=0,
  isolatedPreviewStatusRecords=0,
  repeatedStatusSourceMentions=0,eligibleRepeatedStatusSourceMentions=0,
  isolatedOrderedRepeatedStatusMentions=0,
  randomStatMentions=0,validRandomStatMentions=0,
  invalidRandomStatMentions=0,zeroRandomStatMentions=0,
  isolatedPreviewDynamicRecords=0,
  contextOperationMentions=0,validContextOperationMentions=0,
  invalidContextOperationMentions=0,zeroContextOperationMentions=0,
  scenarioResourceMentions=0,validScenarioResourceMentions=0,
  invalidScenarioResourceMentions=0,zeroScenarioResourceMentions=0,
  uafAllDiscMentions=0,validUafAllDiscMentions=0,
  invalidUafAllDiscMentions=0,zeroUafAllDiscMentions=0,
  scenarioCurrencyMentions=0,validScenarioCurrencyMentions=0,
  invalidScenarioCurrencyMentions=0,zeroScenarioCurrencyMentions=0,
  fullEnergyMentions=0,validFullEnergyMentions=0,
  invalidFullEnergyMentions=0,
  routesWithNonSkill=0,eligibleRoutes=0,blockedRoutes=0,
  noNonSkillRoutes=0,eligibleEvents=0,blockedEvents=0,
  noNonSkillEvents=0,isolatedPreviewEventRecords=0,
  isolatedPreviewEffectRecords=0,isolatedPreviewOutcomeRecords=0,
  repeatedNumericSourceMentions=0,eligibleRepeatedNumericSourceMentions=0,
  isolatedOrderedRepeatedNumericMentions=0;
 const sourceTypeCounts=new Map(),issueCounts=new Map(),scenarioResourceTypes=new Map(),contextOperationTypes=new Map();
 const rows=[],projectedCards=[],affectedCards=new Set();
 const countIssues=issues=>{for(const code of issues)count(issueCounts,code);};
 for(const [cardId,rosterRow] of roster){
  const doc=docs.get(cardId);
  if(!doc){
   if(rosterRow.sourceMissing!==true||rosterRow.gameToraObservedCount!==0)
    fail('欠損4カードと元索引が不一致: '+cardId);
   continue;
  }
  const source=obj(doc.events_ja)&&Object.keys(doc.events_ja).length?
   doc.events_ja:doc.events;
  if(!obj(source)||!Object.keys(source).length||
     rosterRow.sourceMissing!==false||
     rosterRow.gameToraObservedCount!==Object.keys(source).length)
   fail('元カードのイベント配列・件数が元索引と不一致: '+cardId);
  const previewEvents=[];
  for(const [sourceIndex,event] of Object.values(source).entries()){
   const ordinal=sourceIndex+1;
   if(!obj(event)||!Array.isArray(event.choices)||event.choices.length===0||
      typeof event.name!=='string'||!SECTIONS.has(event.section))
    fail('元イベント形状・section未対応: '+cardId+'/'+ordinal);
   sourceEvents++;
   let eventHasNonSkill=false,eventHasBlock=false;
   const projectionParts=[];
   for(const [choiceIndex,choice] of event.choices.entries()){
    const choiceOrdinal=choiceIndex+1;
    if(!obj(choice)||typeof choice.label!=='string')fail('選択行が不正');
    sourceChoices++;
    const routes=flattenRoutes(choice);
    const ambiguous=Array.isArray(choice.segments)&&choice.segments.length>0;
    const randomAlternative=choice.random_either===true;
    const choiceIssues=new Set();
    if(ambiguous)choiceIssues.add('CONDITIONAL_SEGMENTS_NOT_MODELED');
    if(routes.length>1&&!randomAlternative)
     choiceIssues.add('UNFLAGGED_MULTIPLE_RESULT_ROUTES');
    if(randomAlternative&&routes.length<2)
     choiceIssues.add('RANDOM_RESULT_WITHOUT_ALTERNATIVE');
    const projectedResults=[];
    for(const [routeIndex,route] of routes.entries()){
     expandedRoutes++;
     const routeOrdinal=routeIndex+1;
     const problems=new Set(choiceIssues);
     if(route.when.length>0)problems.add('SOURCE_ROUTE_GUARD_UNMODELED');
     let countsInRoute=0,numericRows=0,hasControl=false,explicitTerminal=false;
     const effects=[],statusEffects=[],dynamicEffects=[],
      seenNumeric=new Map(),seenStatus=new Map(),markers=[];
     let repeatedStatusInRoute=0;
     let repeatedNumericInRoute=0;
     const addOrderedNumeric=(record,sourceOrdinal)=>{
       const key=record.kind+'|'+(record.recipientCharId??'');
       const earlier=seenNumeric.get(key);
       if(earlier){
         // Exact original GT result-effect position (1-based). Do not sum.
         effects[earlier.effectIndex].sourceEffectOrdinal=earlier.sourceOrdinal;
         record.sourceEffectOrdinal=sourceOrdinal;
         repeatedNumericInRoute++;
         repeatedNumericSourceMentions++;
       }
       seenNumeric.set(key,{effectIndex:effects.length,sourceOrdinal});
       effects.push(record);
     };
     for(const [effectIndex,effect] of route.effects.entries()){
      allEffectMentions++;
      if(!obj(effect)||typeof effect.type!=='string')fail('効果レコード形状不正');
      const kind=effect.type;
      count(sourceTypeCounts,kind);
      if(SKILL_TYPES.has(kind)){
       sourceSkillEffectMentions++;
       continue; // Separate skill engine handles hints and direct acquisition.
      }
      if(CONTROL_TYPES.has(kind)){
       sourceControlEffectMentions++;markers.push(kind);
       if(kind==='chain_end'){
        chainEndMentions++;
        // Pinned GT ee is a branch-specific stop; only arrows with exactly
        // one parameterless terminal marker get lifted. The skill projection
        // independently checks its terminal flag on that same result.
        if(event.section==='arrows'&&Object.keys(effect).length===1&&!explicitTerminal){
         explicitTerminal=true;chainEndAcceptedSourceMentions++;
        }else{
         hasControl=true;chainEndRejectedSourceMentions++;
         problems.add('CHAIN_END_SOURCE_CONTEXT_UNSUPPORTED');
        }
       }else hasControl=true;
       continue;
      }
      if(Object.prototype.hasOwnProperty.call(CONTEXT_OPERATIONS,kind)){
       contextOperationMentions++;eventHasNonSkill=true;countsInRoute++;
       count(contextOperationTypes,kind);
       const spec=CONTEXT_OPERATIONS[kind],isFlag=spec.flag===true;
       const delta=isFlag?undefined:parseDelta(effect.value);
       const requiredKeys=isFlag?['type']:['type','value'];
       if(!Object.keys(effect).every(x=>requiredKeys.includes(x))||
          Object.keys(effect).length!==requiredKeys.length||
          !isFlag&&delta===null){
        invalidContextOperationMentions++;
        problems.add('CONTEXT_OPERATION_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(!isFlag&&delta===0){zeroContextOperationMentions++;continue;}
       if(dynamicEffects.some(x=>x.kind===spec.kind))
        problems.add('DUPLICATE_CONTEXT_OPERATION_UNADJUDICATED');
       const {flag:discardFlag,...normalized}=spec;
       dynamicEffects.push({...normalized,
        ...(isFlag?{}:{delta}),possible:true});
       validContextOperationMentions++;
       continue;
      }
      if(Object.prototype.hasOwnProperty.call(SCENARIO_RESOURCES,kind)){
       scenarioResourceMentions++;eventHasNonSkill=true;countsInRoute++;
       count(scenarioResourceTypes,kind);
       const spec=SCENARIO_RESOURCES[kind],delta=parseDelta(effect.value);
       // Unlike numeric stats, these are scenario-only resources. Do not
       // accept unknown properties or infer an unconditional in-game payout.
       if(delta===null||
          Object.keys(effect).some(k=>!['type','value'].includes(k))){
        invalidScenarioResourceMentions++;
        problems.add('SCENARIO_RESOURCE_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(delta===0){zeroScenarioResourceMentions++;continue;}
       if(dynamicEffects.some(x=>x.kind===spec.kind))
        problems.add('DUPLICATE_SCENARIO_RESOURCE_UNADJUDICATED');
       dynamicEffects.push({...spec,delta,possible:true});
       validScenarioResourceMentions++;
       continue;
      }
      if(kind==='all_disc'){
       uafAllDiscMentions++;eventHasNonSkill=true;countsInRoute++;
       // Fixed GT U.A.F. scenario-linked Ryoka outings: all fifteen SPORTS
       // discipline levels, not the five base stats and not an unconditional
       // gain outside U.A.F. Check the complete value/field shape.
       const delta=parseDelta(effect.value);
       if(delta===null||
          Object.keys(effect).some(k=>!['type','value'].includes(k))){
        invalidUafAllDiscMentions++;
        problems.add('UAF_ALL_DISC_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(delta===0){zeroUafAllDiscMentions++;continue;}
       if(dynamicEffects.some(x=>x.kind==='uaf-all-disciplines'))
        problems.add('DUPLICATE_UAF_ALL_DISC_UNADJUDICATED');
       dynamicEffects.push({kind:'uaf-all-disciplines',delta,
        scenario:'uaf',possible:true,
        targetSelection:'all-15-sports-disciplines'});
       validUafAllDiscMentions++;
       continue;
      }
      if(kind==='mt'){
       scenarioCurrencyMentions++;eventHasNonSkill=true;countsInRoute++;
       // Fixed event_engine.py delegates raw GT mt to Grand Live's lowest
       // performance category. Other scenarios supply a neutral no-op.
       const delta=parseDelta(effect.value);
       if(delta===null||Object.keys(effect).some(k=>!['type','value'].includes(k))){
        invalidScenarioCurrencyMentions++;
        problems.add('LOWEST_PERFORMANCE_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(delta===0){zeroScenarioCurrencyMentions++;continue;}
       if(dynamicEffects.some(x=>x.kind==='grand-live-lowest-performance'))
        problems.add('DUPLICATE_SCENARIO_CURRENCY_UNADJUDICATED');
       dynamicEffects.push({kind:'grand-live-lowest-performance',delta,
        scenario:'grand-live',possible:true,targetSelection:'lowest-performance-at-runtime'});
       validScenarioCurrencyMentions++;
       continue;
      }
      if(kind==='full_energy'){
       fullEnergyMentions++;eventHasNonSkill=true;countsInRoute++;
       if(Object.keys(effect).some(k=>k!=='type')){
        invalidFullEnergyMentions++;
        problems.add('FULL_ENERGY_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(dynamicEffects.some(x=>x.kind==='restore-current-max-energy'))
        problems.add('DUPLICATE_FULL_ENERGY_UNADJUDICATED');
       dynamicEffects.push({kind:'restore-current-max-energy',possible:true,
        targetSelection:'current-max-energy'});
       validFullEnergyMentions++;
       continue;
      }
      if(kind==='random_stats'){
       randomStatMentions++;eventHasNonSkill=true;countsInRoute++;
       // Pinned event_engine.py applies one signed scalar to min(max(1,N),5)
       // unique stats sampled without replacement. Never choose a stat here.
       const delta=parseDelta(effect.value);
       const rawCount=effect.stat_count;
       if(delta===null||
          rawCount!==undefined&&rawCount!==null&&!Number.isSafeInteger(rawCount)||
          Object.keys(effect).some(k=>!['type','value','stat_count'].includes(k))){
        invalidRandomStatMentions++;
        problems.add('RANDOM_STATS_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(delta===0){zeroRandomStatMentions++;continue;}
       const statCount=Math.min(5,Math.max(1,rawCount??1));
       if(dynamicEffects.length)problems.add('DUPLICATE_RANDOM_STATS_UNADJUDICATED');
       dynamicEffects.push({kind:'random-stats',delta,statCount,
        targetSelection:'random-distinct'});
       validRandomStatMentions++;
       continue;
      }
      if(STATUS_TYPES.has(kind)){
       statusSourceMentions++;eventHasNonSkill=true;countsInRoute++;
       const propKeys=Object.keys(effect);
       const validKeys=kind==='condition'?
        ['type','condition_id','chance']:['type','chance'];
       const chance=parseChance(effect.chance);
       const status=kind==='condition'?
        {kind:'add-condition',conditionId:effect.condition_id,possible:true}:
        {kind:'cure-one-bad',possible:true};
       if(propKeys.some(k=>!validKeys.includes(k))||
          chance===null||
          kind==='condition'&&(!Number.isSafeInteger(effect.condition_id)||
           effect.condition_id<=0)){
        statusInvalidMentions++;
        problems.add('STATUS_OPERATION_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(chance!==undefined)status.chance=chance;
       const key=status.kind+'|'+(status.conditionId??'');
       const previous=seenStatus.get(key);
       if(previous){
        statusEffects[previous.effectIndex].sourceEffectOrdinal=previous.sourceOrdinal;
        status.sourceEffectOrdinal=effectIndex+1;
        repeatedStatusInRoute++;
        repeatedStatusSourceMentions++;
       }
       seenStatus.set(key,{effectIndex:statusEffects.length,sourceOrdinal:effectIndex+1});
       statusEffects.push(status);
       statusValidMentions++;
       continue;
      }
      if(kind==='all_stats'){
       allStatsMentions++;eventHasNonSkill=true;countsInRoute++;
       const value=parseDelta(effect.value);
       if(value===null||Object.keys(effect).some(k=>!['type','value'].includes(k))){
        allStatsInvalidMentions++;
        problems.add('ALL_STATS_SOURCE_SHAPE_UNSUPPORTED');
        continue;
       }
       if(value===0){allStatsZeroMentions++;continue;}
       allStatsValidMentions++;
       for(const statKind of STAT_KINDS){
        addOrderedNumeric({kind:statKind,delta:value,sourceBundle:'all_stats'},
         effectIndex+1);
        numericRows++;
        allStatsExpandedEffectComponents++;
       }
       continue;
      }
      if(!TYPES.has(kind)){
       unrecognizedEffectMentions++;
       problems.add('UNSUPPORTED_EFFECT_TYPE');
       continue;
      }
      eventHasNonSkill=true;countsInRoute++;
      recognizedNonSkillMentions++;
      const delta=parseDelta(effect.value);
      if(delta===null){
       problems.add('NONSCALAR_OR_INVALID_NUMERIC_VALUE');
       continue;
      }
      integerNonSkillMentions++;
      if(delta===0){zeroNonSkillMentions++;continue;}
      nonZeroNumericNonSkillMentions++;
      if(effect.char_id!==undefined&&
         (!Number.isSafeInteger(effect.char_id)||effect.char_id<=0||kind!=='bond')){
        problems.add('INVALID_OR_NONBOND_RECIPIENT');
        invalidRecipientNumericMentions++;
        continue;
      }
      const recipientCharId=effect.char_id;
      addOrderedNumeric({kind,delta,
       ...(recipientCharId===undefined?{}:{recipientCharId})},effectIndex+1);
      numericRows++;
     }
     if(hasControl)problems.add('CONTROL_MARKERS_REQUIRE_BRANCH_ADJUDICATION');
     const eligible=problems.size===0;
     if(countsInRoute)routesWithNonSkill++;
     if(eligible){eligibleRoutes++;eligibleNumericEffectMentions+=numericRows;
      eligibleRepeatedNumericSourceMentions+=repeatedNumericInRoute;
      eligibleRepeatedStatusSourceMentions+=repeatedStatusInRoute;}
     else{blockedRoutes++;blockedNumericEffectMentions+=numericRows;
      eventHasBlock=true;countIssues(problems);}
     if(!countsInRoute)noNonSkillRoutes++;
     rows.push({cardId,sourceOrdinal:ordinal,choiceOrdinal,routeOrdinal,
      classifiedNonSkillMentions:countsInRoute,
      eligibleScalarEffects:eligible?effects:[],
      eligibleStatusEffects:eligible?statusEffects:[],
      eligibleDynamicEffects:eligible?dynamicEffects:[],
      quarantinedDynamicEffects:eligible?0:dynamicEffects.length,
      quarantinedStatusEffects:eligible?0:statusEffects.length,
      quarantinedScalarEffects:eligible?0:numericRows,
      skippedZeroEffects:route.effects.filter(x=>TYPES.has(x.type)&&parseDelta(x.value)===0).length,
      sourceControlMarkers:markers,
      orderedRepeatedNumericMentions:eligible?repeatedNumericInRoute:0,
      orderedRepeatedStatusMentions:eligible?repeatedStatusInRoute:0,
      explicitTerminal:eligible?explicitTerminal:null,
      supportedProjectionEligible:eligible,
      issueCodes:[...problems].sort()});
     projectedResults.push({eligible,effects,statusEffects,dynamicEffects,markers,
      repeatedNumericInRoute,repeatedStatusInRoute,
      terminal:explicitTerminal});
    }
    projectionParts.push({sourceLabelWasEmpty:!choice.label.trim(),randomAlternative,
     choiceOrdinal,projectedResults,routeCount:routes.length});
   }
   if(eventHasNonSkill)affectedCards.add(cardId);
   const eventEligible=!eventHasBlock;
   if(eventEligible)eligibleEvents++;else blockedEvents++;
   if(!eventHasNonSkill)noNonSkillEvents++;
   // Projection is ISOLATED. The source's arrows/outing predecessors and
   // event availability remain UNVERIFIED, and this must never be published.
   // All source outcomes must be projectable to preserve per-result structure.
   if(eventEligible&&eventHasNonSkill){
    const name='非公開元イベント'+String(ordinal).padStart(3,'0');
    const eid='gt:'+cardId+':'+String(ordinal).padStart(3,'0')+':effect-only';
    const outputParts=route=>({
     ...(route.terminal?{terminal:true}:{}),
     ...(route.effects.length?{effects:route.effects}:{}),
     ...(route.statusEffects.length?{statusEffects:route.statusEffects}:{}),
     ...(route.dynamicEffects.length?{dynamicEffects:route.dynamicEffects}:{})
    });
    const part=x=>{
     if(x.routeCount===1)return outputParts(x.projectedResults[0]);
     return {outcomes:x.projectedResults.map((route,i)=>({
      id:'result-'+(i+1),label:'結果'+(i+1),
      ...outputParts(route),
      ...(!route.effects.length&&!route.statusEffects.length&&
       !route.dynamicEffects.length?{rewards:[]}:{})}))};
    };
    const isAuto=projectionParts.length===1&&projectionParts[0].sourceLabelWasEmpty;
    const ev={id:eid,name,type:isAuto?'auto':'choice',
     ...(TRIGGERS[event.section]?{availabilityKind:TRIGGERS[event.section]}:{})};
    if(isAuto)Object.assign(ev,part(projectionParts[0]));
    else ev.choices=projectionParts.map(x=>({id:'choice-'+x.choiceOrdinal,
      label:'選択肢'+x.choiceOrdinal,...part(x)}));
    if(projectedResultsAreIncorrect(ev,projectionParts))fail('結果順序の保存に失敗');
    previewEvents.push(ev);isolatedPreviewEventRecords++;
    isolatedOrderedRepeatedStatusMentions+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.reduce((n,r)=>n+r.repeatedStatusInRoute,0),0);
    isolatedOrderedRepeatedNumericMentions+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.reduce((n,r)=>n+r.repeatedNumericInRoute,0),0);
    isolatedTerminalOutcomeRecords+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.filter(r=>r.terminal).length,0);
    isolatedPreviewDynamicRecords+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.reduce((n,r)=>n+r.dynamicEffects.length,0),0);
    isolatedPreviewStatusRecords+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.reduce((n,r)=>n+r.statusEffects.length,0),0);
    isolatedPreviewEffectRecords+=projectionParts.reduce((sum,x)=>sum+
     x.projectedResults.reduce((n,r)=>n+r.effects.length,0),0);
    isolatedPreviewOutcomeRecords+=projectionParts.reduce((sum,x)=>sum+
     (x.routeCount>1?x.routeCount:0),0);
   }
  }
  if(previewEvents.length)projectedCards.push({cardId,coverageStatus:'partial',events:previewEvents});
 }
 if(sourceEvents!==index.stats.gameToraEventRecords||
    expandedRoutes!==eligibleRoutes+blockedRoutes||
    expandedRoutes!==routesWithNonSkill+noNonSkillRoutes||
    eligibleEvents+blockedEvents!==sourceEvents||
    allEffectMentions!==recognizedNonSkillMentions+allStatsMentions+statusSourceMentions+randomStatMentions+
      contextOperationMentions+scenarioResourceMentions+uafAllDiscMentions+scenarioCurrencyMentions+fullEnergyMentions+
      sourceSkillEffectMentions+sourceControlEffectMentions+
      unrecognizedEffectMentions||
    allStatsMentions!==allStatsValidMentions+allStatsInvalidMentions+allStatsZeroMentions||
    chainEndMentions!==chainEndAcceptedSourceMentions+chainEndRejectedSourceMentions||
    allStatsExpandedEffectComponents!==5*allStatsValidMentions||
    statusSourceMentions!==statusValidMentions+statusInvalidMentions||
    randomStatMentions!==validRandomStatMentions+
      invalidRandomStatMentions+zeroRandomStatMentions||
    contextOperationMentions!==validContextOperationMentions+
      invalidContextOperationMentions+zeroContextOperationMentions||
    scenarioResourceMentions!==validScenarioResourceMentions+
      invalidScenarioResourceMentions+zeroScenarioResourceMentions||
    uafAllDiscMentions!==validUafAllDiscMentions+
      invalidUafAllDiscMentions+zeroUafAllDiscMentions||
    scenarioCurrencyMentions!==validScenarioCurrencyMentions+
      invalidScenarioCurrencyMentions+zeroScenarioCurrencyMentions||
    fullEnergyMentions!==validFullEnergyMentions+invalidFullEnergyMentions||
    nonZeroNumericNonSkillMentions+zeroNonSkillMentions!==integerNonSkillMentions||
    nonZeroNumericNonSkillMentions+allStatsExpandedEffectComponents!==
      eligibleNumericEffectMentions+blockedNumericEffectMentions+
      invalidRecipientNumericMentions)
  fail('全件母数・効果数の保存則不一致');
 const catalog={schemaVersion:1,cards:projectedCards};
 const model={cards:[...roster.keys()].map(id=>({id})),
  cardById:Object.fromEntries([...roster.keys()].map(id=>[id,{id}])),
  skillById:{}};
 const checked=schema.validateCatalog(catalog,model);
 if(checked.eventsWithRecords!==isolatedPreviewEventRecords||
    isolatedPreviewEventRecords>eligibleEvents)fail('スキーマのイベント母数が不一致');
 let replayed=0;
 for(const entry of projectedCards){
  const routes=core.directEffectRoutes({id:entry.cardId,hints:[],events:entry.events},{
   choices:{},outcomes:{}});
  const statuses=core.directStatusRoutes({id:entry.cardId,hints:[],events:entry.events},{choices:{},outcomes:{}});
  const dynamic=core.directDynamicEffectRoutes({id:entry.cardId,hints:[],events:entry.events},{choices:{},outcomes:{}});
  if(dynamic.some(r=>r.source!=='event-dynamic-effect'||
     !r.unresolvedTargets||!['random-distinct','lowest-performance-at-runtime',
       'current-max-energy','all-15-sports-disciplines',
       'all-five-vegetables','secret-ingredient-count',
       'other-supports-next-turn','bath-ticket-count',
       'next-bath-super-recovery','all-three-legend-guides',
       'chosen-legend-from-event-choice'].includes(r.targetSelection)||
     r.dynamicKind==='grand-live-lowest-performance'&&
       (r.scenario!=='grand-live'||r.possible!==true)||
     r.dynamicKind==='restore-current-max-energy'&&r.possible!==true||
     r.dynamicKind==='uaf-all-disciplines'&&
       (r.scenario!=='uaf'||r.possible!==true)||
     r.dynamicKind==='great-food-festival-all-vegetables'&&
       (r.scenario!=='great-food-festival'||r.possible!==true)||
     r.dynamicKind==='scenario14-secret-ingredients'&&
       (r.scenario!=='scenario-14'||r.possible!==true)||
     r.dynamicKind==='next-turn-other-support-specialty-rate'&&
       (r.duration!=='next-turn'||r.possible!==true)||
     r.dynamicKind==='onsen-bathing-tickets'&&
       (r.scenario!=='yukoma-onsen'||r.possible!==true)||
     r.dynamicKind==='onsen-next-bath-super-recovery'&&
       (r.scenario!=='yukoma-onsen'||r.activation!=='next-bath'||
        r.possible!==true)))
   fail('ランダム能力の対象を確定能力へ偽装しました');
  if(statuses.some(r=>r.source!=='event-status-effect'||r.possible!==true))
   fail('固定出典の状態候補を誤って確定状態に変換');
  if(routes.some(r=>r.source!=='event-effect'||!Number.isSafeInteger(r.delta)))
   fail('元数値を正規化形式に投影できない');
  replayed+=routes.length;
 }
 // No choice gets implicitly selected; only auto outcomes can contribute.
 if(replayed>isolatedPreviewEffectRecords)
  fail('未選択分岐を無条件の取得効果として混入');
 if(strict&&(roster.size!==563||docs.size!==559||sourceEvents!==2488||
    sourceChoices!==4129||expandedRoutes!==4376))
  fail('固定563/559カード・2488イベント・4129選択肢・4376経路の全件ゲート不一致');
 return {dataKind:'phase2-gt-whole-nonskill-effect-inventory',
  sourcePins:{gameToraDerived:POLICY.baselineRevision,
   checkerIndex:index.sourcePins.checker},
  publicationApproved:false,automaticRuntimeAdoption:false,
  gameVerified:false,sourceProseIncluded:false,chainTopologyVerified:false,
  onlyIsolatedEffectShapePreview:true,
  summary:{rosterCards:roster.size,sourceCards:docs.size,sourceEvents,
   sourceChoices,expandedRoutes,allEffectMentions,
   recognizedNonSkillMentions,integerNonSkillMentions,
   nonZeroNumericNonSkillMentions,zeroNonSkillMentions,
   sourceSkillEffectMentions,sourceControlEffectMentions,
   chainEndMentions,chainEndAcceptedSourceMentions,chainEndRejectedSourceMentions,
   isolatedTerminalOutcomeRecords,
   unrecognizedEffectMentions,invalidRecipientNumericMentions,
   allStatsMentions,allStatsValidMentions,allStatsInvalidMentions,
   allStatsZeroMentions,allStatsExpandedEffectComponents,
   statusSourceMentions,statusValidMentions,statusInvalidMentions,
   isolatedPreviewStatusRecords,
   repeatedStatusSourceMentions,eligibleRepeatedStatusSourceMentions,
   isolatedOrderedRepeatedStatusMentions,
   randomStatMentions,validRandomStatMentions,invalidRandomStatMentions,
   zeroRandomStatMentions,isolatedPreviewDynamicRecords,
   contextOperationMentions,validContextOperationMentions,
   invalidContextOperationMentions,zeroContextOperationMentions,
   contextOperationTypes:sorted(contextOperationTypes),
   scenarioResourceMentions,validScenarioResourceMentions,
   invalidScenarioResourceMentions,zeroScenarioResourceMentions,
   scenarioResourceTypes:sorted(scenarioResourceTypes),
   uafAllDiscMentions,validUafAllDiscMentions,
   invalidUafAllDiscMentions,zeroUafAllDiscMentions,
   scenarioCurrencyMentions,validScenarioCurrencyMentions,
   invalidScenarioCurrencyMentions,zeroScenarioCurrencyMentions,
   fullEnergyMentions,validFullEnergyMentions,invalidFullEnergyMentions,
   routesWithNonSkill,noNonSkillRoutes,eligibleRoutes,blockedRoutes,
   eligibleEvents,blockedEvents,noNonSkillEvents,
   affectedCards:affectedCards.size,
   eligibleNumericEffectMentions,blockedNumericEffectMentions,
   isolatedPreviewEventRecords,isolatedPreviewEffectRecords,
   isolatedPreviewOutcomeRecords,
   repeatedNumericSourceMentions,eligibleRepeatedNumericSourceMentions,
   isolatedOrderedRepeatedNumericMentions,automaticRuntimeAdoptions:0,
   publishedEventRecords:0},
  sourceEffectTypes:sorted(sourceTypeCounts),
  blockedReasons:sorted(issueCounts),rows,
  // Never write this privately-derived material to public files.
  isolatedPreview:catalog};
}
function projectedResultsAreIncorrect(event,parts){
 if(event.type==='choice')return event.choices.length!==parts.length||
  event.choices.some((p,i)=>parts[i].routeCount>1?
   p.outcomes?.length!==parts[i].routeCount:
   !(Array.isArray(p.effects)||Array.isArray(p.statusEffects)||Array.isArray(p.dynamicEffects)||
     p.effects===undefined));
 return parts.length!==1||
  (parts[0].routeCount>1?
   event.outcomes?.length!==parts[0].routeCount:
   !(Array.isArray(event.effects)||Array.isArray(event.statusEffects)||Array.isArray(event.dynamicEffects)||
     event.effects===undefined));
}
module.exports={analyze};
