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
const TYPES=new Set(['speed','stamina','power','guts','wisdom',
 'energy','max_energy','mood','bond','skill_points','aptitude_points']);
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
  routesWithNonSkill=0,eligibleRoutes=0,blockedRoutes=0,
  noNonSkillRoutes=0,eligibleEvents=0,blockedEvents=0,
  noNonSkillEvents=0,isolatedPreviewEventRecords=0,
  isolatedPreviewEffectRecords=0,isolatedPreviewOutcomeRecords=0;
 const sourceTypeCounts=new Map(),issueCounts=new Map();
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
     let countsInRoute=0,numericRows=0,hasControl=false;
     const effects=[],duplicates=new Set(),markers=[];
     for(const [effectIndex,effect] of route.effects.entries()){
      allEffectMentions++;
      if(!obj(e)||typeof e.type!=='string')fail('効果レコード形状不正');
      const kind=e.type;
      count(sourceTypeCounts,kind);
      if(SKILL_TYPES.has(kind)){
       sourceSkillEffectMentions++;
       continue; // Separate skill engine handles hints and direct acquisition.
      }
      if(CONTROL_TYPES.has(kind)){
       sourceControlEffectMentions++;hasControl=true;markers.push(kind);
       continue; // Preserve markers for source audit, do not invent chain edges.
      }
      if(!TYPES.has(kind)){
       problems.add('UNSUPPORTED_EFFECT_TYPE');
       continue;
      }
      eventHasNonSkill=true;countsInRoute++;
      recognizedNonSkillMentions++;
      const delta=parseDelta(e.value);
      if(delta===null){
       problems.add('NONSCALAR_OR_INVALID_NUMERIC_VALUE');
       continue;
      }
      integerNonSkillMentions++;
      if(delta===0){zeroNonSkillMentions++;continue;}
      nonZeroNumericNonSkillMentions++;
      if(e.char_id!==undefined&&
         (!Number.isSafeInteger(e.char_id)||e.char_id<=0||kind!=='bond')){
        problems.add('INVALID_OR_NONBOND_RECIPIENT');
        continue;
      }
      const recipientCharId=e.char_id;
      const k=kind+'|'+(recipientCharId??'');
      if(duplicates.has(k))problems.add('DUPLICATE_EFFECT_COMPONENT_UNADJUDICATED');
      duplicates.add(k);
      effects.push({kind,delta,...(recipientCharId===undefined?{}:{recipientCharId})});
      numericRows++;
     }
     const eligible=problems.size===0;
     if(countsInRoute)routesWithNonSkill++;
     if(eligible){eligibleRoutes++;eligibleNumericEffectMentions+=numericRows;}
     else{blockedRoutes++;blockedNumericEffectMentions+=numericRows;
      eventHasBlock=true;countIssues(problems);}
     if(!countsInRoute)noNonSkillRoutes++;
     rows.push({cardId,sourceOrdinal:ordinal,choiceOrdinal,routeOrdinal,
      classifiedNonSkillMentions:countsInRoute,
      eligibleScalarEffects:eligible?effects:[],
      quarantinedScalarEffects:eligible?0:numericRows,
      skippedZeroEffects:route.effects.filter(x=>TYPES.has(x.type)&&parseDelta(x.value)===0).length,
      sourceControlMarkers:markers,
      supportedProjectionEligible:eligible,
      issueCodes:[...problems].sort()});
     projectedResults.push({eligible,effects,markers});
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
    const part=x=>{
     if(x.routeCount===1)return x.projectedResults[0].effects.length?
      {effects:x.projectedResults[0].effects}: {};
     return {outcomes:x.projectedResults.map((route,i)=>({
      id:'result-'+(i+1),label:'結果'+(i+1),
      ...(route.effects.length?{effects:route.effects}:{rewards:[]})}))};
    };
    const isAuto=projectionParts.length===1&&projectionParts[0].sourceLabelWasEmpty;
    const ev={id:eid,name,type:isAuto?'auto':'choice',
     ...(TRIGGERS[event.section]?{availabilityKind:TRIGGERS[event.section]}:{})};
    if(isAuto)Object.assign(ev,part(projectionParts[0]));
    else ev.choices=projectionParts.map(x=>({id:'choice-'+x.choiceOrdinal,
      label:'選択肢'+x.choiceOrdinal,...part(x)}));
    if(projectedResultsAreIncorrect(ev,projectionParts))fail('結果順序の保存に失敗');
    previewEvents.push(ev);isolatedPreviewEventRecords++;
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
    recognizedNonSkillMentions!==integerNonSkillMentions+
     (recognizedNonSkillMentions-integerNonSkillMentions)||
    nonZeroNumericNonSkillMentions+zeroNonSkillMentions!==integerNonSkillMentions||
    eligibleNumericEffectMentions+blockedNumericEffectMentions>
       nonZeroNumericNonSkillMentions)
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
   routesWithNonSkill,noNonSkillRoutes,eligibleRoutes,blockedRoutes,
   eligibleEvents,blockedEvents,noNonSkillEvents,
   affectedCards:affectedCards.size,
   eligibleNumericEffectMentions,blockedNumericEffectMentions,
   isolatedPreviewEventRecords,isolatedPreviewEffectRecords,
   isolatedPreviewOutcomeRecords,automaticRuntimeAdoptions:0,
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
   !(Array.isArray(p.effects)||p.effects===undefined));
 return parts.length!==1||
  (parts[0].routeCount>1?
   event.outcomes?.length!==parts[0].routeCount:
   !(Array.isArray(event.effects)||event.effects===undefined));
}
module.exports={analyze};
