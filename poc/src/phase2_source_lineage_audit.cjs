'use strict';
/*
 * RAM-only lineage of already built private event catalogs. Records factual
 * transforms to guide source-rights reviews, never grants publication rights.
 *
 * A stage only applies a known transform category; this is NOT evidence that
 * an upstream site allowed redistribution or that a GT record is GT-only.
 */
const {digest}=require('./event_release_gate.cjs');
const {inventory}=require('./event_release_cohorts.cjs');
const fail=m=>{throw Error('Phase2イベント出典変換系譜: '+m);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const TYPES=['cross-source-editorial','structured-source-enrichment','display-only'];
const k=(cardId,eventId)=>JSON.stringify([cardId,eventId]);
function index(catalog,where){
 if(!obj(catalog)||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  fail(where+': 形式が不正');
 const result=new Map();
 for(const c of catalog.cards){
  if(!obj(c)||!Array.isArray(c.events)||typeof c.cardId!=='string')
   fail(where+': カードが不正');
  for(const event of c.events){
   if(typeof event.id!=='string'||!event.id)fail(where+': イベントIDが不正');
   const key=k(c.cardId,event.id);
   if(result.has(key))fail(where+': 重複したイベントID');
   result.set(key,{cardId:c.cardId,eventId:event.id,sha256:digest(event)});
  }
 }
 return result;
}
function build({baseline,stages,finalCatalog},{strict=true}={}){
 if(!Array.isArray(stages)||!stages.length||!finalCatalog)
  fail('出典別の変換過程と最終カタログが必要');
 const first=index(baseline,'固定元');
 const baselineKeys=new Set(first.keys());
 for(const {cardId,eventId} of first.values())
  if(!eventId.startsWith('gt-'))fail('GT固定の技術母集団に異なるID系列');
 let previous=first;
 const history=new Map([...first.keys()].map(key=>[key,new Set(['pinned-gt-snapshot'])]));
 const addedByCategory={};
 const modifiedByCategory={};
 const reports=[],seenNames=new Set();
 for(const [i,step] of stages.entries()){
  if(!obj(step)||typeof step.name!=='string'||!step.name||
     seenNames.has(step.name)||!TYPES.includes(step.category))
   fail('変換段階名・出典種類が不正');
  seenNames.add(step.name);
  const next=index(step.catalog,'stage/'+step.name);
  for(const key of previous.keys())if(!next.has(key))
   fail(step.name+': 既存イベントが消えた');
  const added=[],modified=[],unchanged=[];
  for(const [key,after] of next){
   const before=previous.get(key);
   if(!before)added.push(key);
   else if(before.sha256!==after.sha256)modified.push(key);
   else unchanged.push(key);
   if(!before||before.sha256!==after.sha256){
    if(!history.has(key))history.set(key,new Set());
    history.get(key).add(step.name);
   }
  }
  if(step.category==='display-only'&&added.length)
   fail('表示変更時に新しいイベントが混入した');
  addedByCategory[step.category]=(addedByCategory[step.category]||0)+added.length;
  modifiedByCategory[step.category]=(modifiedByCategory[step.category]||0)+modified.length;
  const changed=[...added,...modified].sort();
  reports.push({stage:step.name,category:step.category,
   eventsBefore:previous.size,eventsAfter:next.size,
   added:added.length,modified:modified.length,unchanged:unchanged.length,
   // No headings, rewards, dialogue, file paths or private catalog objects.
   changedEventIds:step.category==='cross-source-editorial'?
    changed.map(key=>{const {cardId,eventId}=next.get(key);return {cardId,eventId};}):undefined});
  previous=next;
 }
 const final=index(finalCatalog,'最終');
 if(final.size!==previous.size||[...final].some(([key,row])=>
  previous.get(key)?.sha256!==row.sha256))
  fail('最終データと直前に追跡した変換結果が異なる');
 const crossSourceGt=[],curated=[],gtDirect=[];
 for(const [key,row] of final){
  if(baselineKeys.has(key)){
   if(row.eventId.startsWith('gt-')===false)fail('GT元IDが途中で変わった');
   const previousStages=history.get(key);
   if(reports.some(r=>r.category==='cross-source-editorial'&&
       previousStages.has(r.stage)))crossSourceGt.push(row);
   else gtDirect.push(row);
  }else{
   if(!row.eventId.startsWith('usl:'))fail('追加イベントの技術系列を特定できない');
   if(!reports.some(r=>r.category==='cross-source-editorial'&&
       history.get(key).has(r.stage)))fail('追加イベントの編集出典が未分類');
   curated.push(row);
  }
 }
 const sorted=x=>x.sort((a,b)=>a.cardId.localeCompare(b.cardId,'en')||
  a.eventId.localeCompare(b.eventId,'en'));
 sorted(crossSourceGt);sorted(curated);sorted(gtDirect);
 // The GT cohort without cross-source-touched events can be checked as an
 // explicit technical selection; the removed events still require separate
 // V1 exceptions or an independently supported source-specific cohort.
 const selector={
  eventIdPrefix:'gt-',
  ...(crossSourceGt.length?{excludedEventKeys:crossSourceGt.map(x=>({
   cardId:x.cardId,eventId:x.eventId
  }))}:{})
 };
 const partition=inventory(finalCatalog,[selector,{eventIdPrefix:'usl:'}]);
 if(partition.uncovered!==crossSourceGt.length||
    partition.groups[0].events!==gtDirect.length||
    partition.groups[1].events!==curated.length)
  fail('別出典の補正例外をGT一括審査から分離できない');
 const expected=strict?{sourceGt:2488,final:2512,curated:24,gtCrossSource:1}:null;
 if(expected&&(first.size!==expected.sourceGt||
   final.size!==expected.final||curated.length!==expected.curated||
   crossSourceGt.length!==expected.gtCrossSource))
  fail('固定GT/編集例外の収録数が変わりました: '+JSON.stringify({
   sourceGt:first.size,final:final.size,curated:curated.length,
   gtCrossSource:crossSourceGt.length}));
 return {
  status:'PHASE2_SOURCE_LINEAGE_PRIVATE_ANALYSIS',
  baselineGT: first.size,finalEvents:final.size,
  gtWithoutTrackedCrossSourceTouch:gtDirect.length,
  gtWithTrackedCrossSourceTouch:crossSourceGt.length,
  addedCuratedEvents:curated.length,
  // This must NOT be interpreted as proof of source or legal independence.
  categories:reports,
  crossSourceGtExceptionIds:crossSourceGt.map(x=>({cardId:x.cardId,eventId:x.eventId})),
  curatedOnlyEventIds:curated.map(x=>({cardId:x.cardId,eventId:x.eventId})),
  technicalGtSelector:selector,
  gtCohortFingerprint:partition.groups[0].eventsSha256,
  curatedCohortFingerprint:partition.groups[1].eventsSha256,
  rightsOrTermsApproved:false,publishedEvents:0,
  note:'Technical transform history only; rights, data originality and source lineage require independent review'
 };
}
module.exports={build,index};
