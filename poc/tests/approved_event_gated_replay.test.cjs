'use strict';
// W1.2 real approved-catalog prerequisite replay. This is an in-memory
// test-only witness search; it neither changes user choices nor invents
// unreleased events. A witness means the published logical rules permit a
// state, NOT that the real game necessarily triggers the event.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../src/core.js');
const schema=require('../src/event_schema.js');

const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,
 '../data/reviewed_events.v1.json'),'utf8'));
const cases=catalog.cards;
const eligible=x=>(x||[]).filter(r=>r.kind!=='negative');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=state=>({choices:{...state.choices},outcomes:{...state.outcomes}});
const prereqs=o=>schema.prerequisites(o);
const positive=part=>eligible(part.rewards);
const project=routes=>routes.map(x=>({
 skillId:x.skillId,kind:x.kind==='obtained'?'obtained':'hint',
 level:x.kind==='obtained'?null:x.level??null
})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const empty=()=>({choices:{},outcomes:{}});
const first=iterator=>iterator.next().value||null;

// Discover at least one explicit, consistent selection of earlier choices,
// results, and prerequisites. Exhaustive only over the prerequisites of this
// targeted route, never all unrelated card choices.
function witness(card,target){
 const byId=new Map(card.events.map(e=>[e.id,e]));
 const node=byId.get(target.event.id);
 function* all(reqs,state,stack){
  if(!reqs.length){yield state;return;}
  for(const next of one(reqs[0],state,stack))
   yield* all(reqs.slice(1),next,stack);
 }
 function* any(guard,state,stack){
  if(!guard){yield state;return;}
  for(const clause of guard.any||[])
   yield* all(clause.all||[],state,stack);
 }
 function* event(event,state,stack){
  const key='event:'+event.id;
  if(stack.has(key))return;
  const next=new Set(stack);next.add(key);
  yield* all(prereqs(event),state,next);
 }
 function* one(req,state,stack){
  const parent=byId.get(req.eventId);
  if(!parent)return;
  for(const present of event(parent,state,stack)){
   const parts=parent.type==='choice'?parent.choices:[parent];
   for(const part of parts){
    if(parent.type==='choice'&&
       (part.terminal===true||
        req.choiceId!==undefined&&req.choiceId!==part.id||
        own(present.choices,parent.id)&&present.choices[parent.id]!==part.id))
     continue;
    if(parent.type==='auto'&&req.choiceId!==undefined)continue;
    const assigned=clone(present);
    if(parent.type==='choice')assigned.choices[parent.id]=part.id;
    for(const optionState of all(parent.type==='choice'?prereqs(part):[],assigned,stack)){
     const variants=part.outcomes||[];
     if(!variants.length){
      if(req.outcomeId===undefined)yield optionState;
      continue;
     }
     for(const outcome of variants){
      if(outcome.terminal===true||
         req.outcomeId!==undefined&&req.outcomeId!==outcome.id||
         own(optionState.outcomes,parent.id)&&optionState.outcomes[parent.id]!==outcome.id)
       continue;
      const selected=clone(optionState);
      selected.outcomes[parent.id]=outcome.id;
      yield* any(outcome.requires,selected,stack);
     }
    }
   }
  }
 }
 const start=empty();
 if(target.choice)start.choices[node.id]=target.choice.id;
 if(target.outcome)start.outcomes[node.id]=target.outcome.id;
 function* solve(){
  for(const s1 of event(node,start,new Set())){
   const choiceStates=target.choice?all(prereqs(target.choice),s1,new Set()):[s1];
   for(const s2 of choiceStates)
    for(const s3 of target.outcome?any(target.outcome.requires,s2,new Set()):[s2]){
     const observed=core.reachability(node,s3.choices,card.events,s3.outcomes);
     if(observed.status==='blocked')continue;
     if(target.choice&&core.choiceReachability(target.choice,node,s3.choices,
      card.events,s3.outcomes).status==='blocked')continue;
     if(target.outcome&&core.outcomeReachability(target.outcome,node,s3.choices,
      card.events,s3.outcomes).status==='blocked')continue;
     yield s3;
    }
  }
 }
 return first(solve());
}

function gatedTargets(card){
 const out=[];
 for(const event of card.events){
  const eventGate=!!event.requires;
  if(event.type==='auto'){
   if(event.outcomes?.length){
    for(const outcome of event.outcomes)
     if(eventGate||outcome.requires)out.push({event,outcome,gate:'auto-outcome'});
   }else if(eventGate)out.push({event,gate:'auto-event'});
  }else{
   for(const choice of event.choices){
    if(choice.outcomes?.length){
     for(const outcome of choice.outcomes)
      if(eventGate||choice.requires||outcome.requires)
       out.push({event,choice,outcome,gate:'choice-outcome'});
    }else if(eventGate||choice.requires)
     out.push({event,choice,gate:'choice'});
   }
  }
 }
 return out;
}
test('all approved prerequisites are classified and replayed using only published condition IDs',()=>{
 assert.equal(catalog.schemaVersion,1);
 assert.equal(cases.length,559);
 let events=0,targets=0,satisfied=0,unresolved=0,auto=0,choice=0,result=0,
  conditional=0,unblockedWithoutParents=0,negativeChecks=0;
 const failures=[],categories={eventRequires:0,optionRequires:0,outcomeRequires:0,
  outcomeAndEvent:0,outcomeAndOption:0,availability:0,
  eventPrerequisiteChoice:0,eventPrerequisiteAuto:0,
  eventPrerequisiteOutcome:0,optionPrerequisiteChoice:0,
  optionPrerequisiteAuto:0,outcomePrerequisiteChoice:0,
  outcomePrerequisiteAuto:0};
 const failureKinds={};
 for(const record of cases){
  const card={id:record.cardId,events:record.events,hints:[]};
  const byId=new Map(card.events.map(e=>[e.id,e]));
  events+=card.events.length;
  for(const event of card.events){
   if(event.requires){
    categories.eventRequires++;
    for(const r of prereqs(event)){
     categories[byId.get(r.eventId)?.type==='choice'?
      'eventPrerequisiteChoice':'eventPrerequisiteAuto']++;
     if(r.outcomeId!==undefined)categories.eventPrerequisiteOutcome++;
    }
   }
   if(event.availabilityKind)categories.availability++;
   for(const option of event.choices||[]){
    if(option.requires){
     categories.optionRequires++;
     for(const r of prereqs(option))
      categories[byId.get(r.eventId)?.type==='choice'?
       'optionPrerequisiteChoice':'optionPrerequisiteAuto']++;
    }
    for(const outcome of option.outcomes||[]){
     if(outcome.requires){
      categories.outcomeRequires++;
      if(event.requires)categories.outcomeAndEvent++;
      if(option.requires)categories.outcomeAndOption++;
      for(const clause of outcome.requires.any||[])
       for(const r of clause.all||[])
        categories[byId.get(r.eventId)?.type==='choice'?
         'outcomePrerequisiteChoice':'outcomePrerequisiteAuto']++;
     }
    }
   }
   if(event.type==='auto')for(const outcome of event.outcomes||[]){
    if(outcome.requires){
     categories.outcomeRequires++;
     if(event.requires)categories.outcomeAndEvent++;
     for(const clause of outcome.requires.any||[])
      for(const r of clause.all||[])
       categories[byId.get(r.eventId)?.type==='choice'?
        'outcomePrerequisiteChoice':'outcomePrerequisiteAuto']++;
    }
   }
  }
  for(const target of gatedTargets(card)){
   targets++;
   const state=witness(card,target);
   if(!state){
    unresolved++;
    const key=target.gate;
    failureKinds[key]=(failureKinds[key]||0)+1;
    failures.push({cardId:card.id,eventId:target.event.id,
     choiceId:target.choice?.id||null,outcomeId:target.outcome?.id||null,kind:key});
    continue;
   }
   satisfied++;
   if(target.event.type==='auto')auto++;else choice++;
   if(target.outcome)result++;
   const prior=core.reachability(target.event,{},card.events);
   if(prior.status!=='blocked')unblockedWithoutParents++;
   const cardRoutes=core.directRoutes(card,{stage:4,...state}).filter(r=>
    r.source==='event'&&r.eventId===target.event.id);
   const expected=project(positive(target.outcome||target.choice||target.event));
   const actual=project(cardRoutes);
   assert.deepEqual(actual,expected,
    'source-backed prerequisite reward mismatch card='+card.id+
    ' event='+target.event.id+' choice='+target.choice?.id+' outcome='+target.outcome?.id);
   conditional+=cardRoutes.filter(r=>r.conditional).length;
   // A selected child must not leak when its prerequisite selection is
   // removed. An automatic parent may remain reachable without selection,
   // so only assert this when the parent is of type choice.
   const deps=[...prereqs(target.event),
    ...(target.choice?prereqs(target.choice):[])];
   for(const dep of deps){
    if(byId.get(dep.eventId)?.type!=='choice'||!own(state.choices,dep.eventId))
     continue;
    const broken=clone(state);
    delete broken.choices[dep.eventId];
    const blocked=core.reachability(target.event,broken.choices,card.events,broken.outcomes);
    const selectedGate=target.choice?core.choiceReachability(target.choice,target.event,
     broken.choices,card.events,broken.outcomes):null;
    if(blocked.status==='blocked'||selectedGate?.status==='blocked'){
     const after=core.directRoutes(card,{stage:4,...broken})
      .filter(r=>r.source==='event'&&r.eventId===target.event.id);
     assert.deepEqual(after,[],'unmet parent must block child skill routes');
     negativeChecks++;
    }
   }
  }
 }
 const report={approvedEvents:events,approvedCards:cases.length,targets,
  satisfied,unresolved,auto,choice,result,conditional,
  unblockedWithoutParents,negativeChecks,categories,failureKinds,
  failures:failures.slice(0,30)};
 console.log('W1_REVIEWED_GATED_REPLAY_AUDIT='+JSON.stringify(report));
 assert.equal(events,2487);
 // Unresolvable branches are kept as visible audit exceptions rather than
 // reclassified as nonexistent or silently counted as verified.
 assert.ok(targets>0);
 assert.equal(unresolved,0,'Approved, schema-valid branch must have a witness: '+JSON.stringify(failures.slice(0,12)));
});
module.exports={witness,gatedTargets};
