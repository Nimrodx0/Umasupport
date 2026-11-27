'use strict';
// Exact, card-scoped review of the listed skill routes under D070.
// Does not certify unmodeled non-skill rewards or issue release approvals.
const {canonical,digest,verifyRelease}=require('./event_release_gate.cjs');
const {validateEvents}=require('./event_schema.js');
const {project}=require('./phase2_title_choice_projection.cjs');
const spec=require('../config/d070-azuma-json-flow-review.v1.json');
const fail=s=>{throw Error('D070 Azuma JSON review: '+s);};
const same=(a,b)=>canonical(a)===canonical(b);
const sha=require('node:crypto');
const titleHash=s=>sha.createHash('sha256').update(s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'')).digest('hex');
function reviewAzuma({observation:o,registry,titles=null}={}){
 const pin=spec.cards.find(x=>x.cardId===o?.cardId);
 if(!pin||o.dataKind!=='gametora-card-json-private-observation'||o.publicationApproved!==false||
    o.appEventSchemaAdoptable!==false||o.buildId!==pin.buildId||o.bodySha256!==pin.bodySha256||
    o.sourceUrl!=='https://gametora.com/ja/umamusume/supports/'+pin.cardId+'-azuma'||
    o.numericValueBasis!=='source-json-unadjusted'||o.levelDependent!==true||
    !(registry?.byId instanceof Map)||!(registry?.byName instanceof Map)||
    !Array.isArray(o.events)||o.events.length!==pin.events.length)
  fail('identity, source revision or registry mismatch');
 if(titles!==null&&(!(titles instanceof Map)||titles.size!==pin.events.length))fail('title scope mismatch');
 const id=n=>'gt-json:'+pin.cardId+':'+n;
 const omissions=[];let hints=0,routes=0;
 const events=pin.events.map((e,i)=>{
  const x=o.events[i];
  if(x.sourceEventId!==e.sourceEventId||x.category!==e.category||x.categoryOrdinal!==e.categoryOrdinal||
     x.titleSha256!==e.titleSha256||x.historyCount!==0||x.eventType!==e.eventType||
     x.meaninglessChoices!==e.meaninglessChoices||x.groups.length!==e.groups.length||
     x.blockers.some(k=>!['selection-semantics-unverified','publication-not-reviewed','internal-reachability-unverified','event-type-semantics-unverified'].includes(k)))
   fail('event drift '+e.sourceEventId);
  const name=titles===null?(e.category==='dates'?'お出かけ'+e.categoryOrdinal+'回目':e.sourceEventId===1496?'お出かけ解放イベント':e.category==='special'?'特殊イベント'+e.categoryOrdinal:'通常イベント'+e.categoryOrdinal):titles.get(e.sourceEventId);
  if(typeof name!=='string'||!name.trim()||name.length>80||/[\r\n\u0000-\u001f]/.test(name)||titles!==null&&titleHash(name)!==e.titleSha256)fail('title mismatch');
  const groups=e.groups.map((g,j)=>{
   const y=x.groups[j];
   if(y.ordinal!==j+1||y.labelPresent!==g.labelPresent||y.blockers.length||y.routes.length!==1)fail('selection/result drift');
   const r=y.routes[0];
   if(r.ordinal!==1||!same(r.hints,g.hints)||r.directGrants.length||r.dynamicEffects.length||
      r.effects.some(z=>!Number.isSafeInteger(z.delta)||z.alternatives!==undefined)||
      !same(r.markers.map(z=>z.kind),g.unlock?['outing-unlock-candidate']:[])||
      !same(r.statusCandidates.map(z=>z.sourceOrdinal),g.conditionOrdinals)||
      !same(r.unresolved,r.statusCandidates.map(z=>({code:'se',sourceOrdinal:z.sourceOrdinal,reason:'condition-application-semantics-unverified'})).concat(g.unmodeledScenarioOrdinals.map(n=>({code:'shun_act_low',sourceOrdinal:n,reason:'unsupported-effect-code'}))).sort((a,b)=>a.sourceOrdinal-b.sourceOrdinal)))
    fail('reward/flow drift '+e.sourceEventId+':'+(j+1));
   if(r.effects.length||r.unresolved.length)omissions.push({sourceEventId:e.sourceEventId,choiceOrdinal:j+1,baseScalarCount:r.effects.length,unmodeledCodes:r.unresolved.map(z=>z.code)});
   const rewards=r.hints.map(h=>{
    const s=registry.byId.get(h.skillId.slice(6));
    if(!s||!['normal','rare'].includes(s.rarity)||registry.byName.get(s.name)?.length!==1)fail('unverified skill ID');
    hints++;return {skillId:h.skillId,kind:'hint',level:h.level,verifiedSkillName:s.name};
   });routes++;
   return {id:'c'+(j+1),label:'選択肢'+(j+1)+'（仮）',rewards};
  });
  const event={id:id(e.sourceEventId),name,type:e.selection};
  if(e.selection==='auto'){
   if(groups.length!==1||e.groups[0].labelPresent)fail('auto mismatch');
   event.rewards=groups[0].rewards;
  }else{
   if(groups.length<2||e.groups.some(g=>!g.labelPresent))fail('choice mismatch');
   event.choices=groups;
  }
  if(e.category==='special')event.availabilityKind='special-trigger';
  if(e.category==='dates'){
   event.availabilityKind='outing-sequence';
   // The verified listed outing sequence is a scoped review, not a global
   // inference from absence of a stop token. Never apply to other cards.
   const prev=e.categoryOrdinal===1?1496:pin.events.find(z=>z.category==='dates'&&z.categoryOrdinal===e.categoryOrdinal-1)?.sourceEventId;
   if(!prev)fail('sequence gap');event.requires={all:[{eventId:id(prev)}]};
  }
  return event;
 });
 if(hints!==4||routes!==14||events.filter(e=>e.requires).length!==5)fail('count drift');
 const card=project({schemaVersion:1,cards:[{cardId:pin.cardId,coverageStatus:'partial',events}]}).catalog.cards[0];
 validateEvents(card.events,{skillById:Object.fromEntries([...registry.byId].map(([key,v])=>['skill:'+key,v]))},pin.cardId);
 let blocked=false;try{verifyRelease({schemaVersion:1,cards:[card]},{schemaVersion:1,entries:[]});}catch(e){if(!String(e).includes('承認証跡'))throw e;blocked=true;}
 if(!blocked)fail('publication gate bypass');
 return {dataKind:'d070-azuma-private-skill-path-review',card,sourceBodySha256:o.bodySha256,
  summary:{cardId:pin.cardId,eventCount:events.length,resultCount:routes,hintCount:hints,outingEdges:5,
   eventDigests:card.events.map(e=>({eventId:e.id,sha256:digest(e)})),namesArePlaceholders:titles===null},
  omittedNonSkill:omissions,skillPathOnly:true,fullGameSemanticsVerified:false,publicationApproved:false};
}
module.exports={reviewAzuma};
