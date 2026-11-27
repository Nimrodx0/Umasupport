'use strict';
// Card-scoped Next.js event JSON -> PRIVATE, prose-free observations.
// No network, no runtime catalog, no implicit chain or publication approval.
const crypto=require('node:crypto');
const {canonicalSupportUrl}=require('./official_gametora_new_card_locator.cjs');
const fail=s=>{throw Error('GameTora card JSON: '+s);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.hasOwn(x,k);
const positive=x=>Number.isSafeInteger(x)&&x>0;
const ID=/^[1-9]\d{4}$/;
const BUILD=/^[A-Za-z0-9_-]{1,80}$/;
const CODE=/^[a-z0-9_]{1,20}$/;
const SHA=/^[a-f0-9]{64}$/;
const categories=new Set(['random','arrows','special','dates']);
const SCALARS=Object.freeze({sp:'speed',st:'stamina',gu:'guts',in:'wisdom',en:'energy',me:'max_energy',pt:'skill_points',mo:'mood',bo:'bond'});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const canonicalTitle=s=>{
 if(typeof s!=='string'||!s.trim()||s.length>300)fail('invalid title');
 const key=s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
 if(!key)fail('empty normalized title');
 return sha(key);
};
function pageScope(cardId,sourceUrl){
 const page=canonicalSupportUrl(sourceUrl);
 if(typeof cardId!=='string'||!ID.test(cardId)||!page||page.cardId!==cardId||page.url!==sourceUrl)
  fail('invalid canonical card scope');
 return page;
}
function cardJsonUrl({cardId,sourceUrl,buildId}={}){
 pageScope(cardId,sourceUrl);
 if(typeof buildId!=='string'||!BUILD.test(buildId))fail('invalid build ID');
 return 'https://gametora.com/_next/data/'+buildId+new URL(sourceUrl).pathname+'.json';
}
function extractBuildId({html,cardId,sourceUrl}={}){
 pageScope(cardId,sourceUrl);
 if(typeof html!=='string'||Buffer.byteLength(html)>512000)fail('bootstrap size/type');
 const hits=[...html.matchAll(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script\s*>/gi)];
 if(hits.length!==1)fail('ambiguous Next bootstrap');
 let root;try{root=JSON.parse(hits[0][1]);}catch{fail('invalid Next bootstrap');}
 if(root?.page!=='/ja/umamusume/supports/[id]'||
    String(root?.props?.pageProps?.sourceData?.support_id)!==cardId||
    typeof root.buildId!=='string'||!BUILD.test(root.buildId))fail('bootstrap scope or build mismatch');
 return root.buildId;
}
function signed(v){
 if(typeof v!=='string'||!/^[-+]\d{1,5}$/.test(v)||Number(v)===0)return null;
 return Number(v);
}
function range(v){
 if(typeof v!=='string')return null;
 const m=/^([-+]\d{1,5})\/([-+]\d{1,5})$/.exec(v);
 if(!m)return null;
 const a=signed(m[1]),b=signed(m[2]);
 return a!==null&&b!==null&&a!==b?[a,b]:null;
}
const only=(x,keys)=>Object.keys(x).every(k=>keys.includes(k));
function parseGroup(g,index){
 if(!obj(g)||typeof g.o!=='string'||g.o.length>500||!Array.isArray(g.r)||!g.r.length||g.r.length>120)
  fail('invalid result group');
 const group={ordinal:index+1,labelPresent:!!g.o.trim(),routes:[],blockers:[]};
 if(!only(g,['o','r']))group.blockers.push('unknown-group-fields');
 const fresh=()=>({effects:[],hints:[],directGrants:[],unresolved:[],markers:[],sourceOrdinals:[]});
 let r=fresh();
 const finish=()=>{
  if(!r.sourceOrdinals.length)fail('empty explicit result');
  group.routes.push({ordinal:group.routes.length+1,...r});r=fresh();
 };
 for(const [idx,x] of g.r.entries()){
  const at=idx+1;
  if(!obj(x)||typeof x.t!=='string'||!CODE.test(x.t))fail('invalid reward token');
  if(x.t==='di'){
   if(!only(x,['t']))fail('invalid result delimiter');
   finish();continue;
  }
  r.sourceOrdinals.push(at);
  const unresolved=reason=>r.unresolved.push({code:x.t,sourceOrdinal:at,reason});
  if(x.t==='ee'){
   if(!only(x,['t'])){unresolved('invalid-stop-marker');continue;}
   if(r.markers.some(m=>m.kind==='explicit-chain-stop'))fail('duplicate stop marker');
   r.markers.push({kind:'explicit-chain-stop',sourceOrdinal:at});continue;
  }
  if(x.t==='sk'){
   const level=signed(x.v);
   if(!only(x,['t','v','d'])||!positive(x.d)||level===null||level<1||level>10){unresolved('invalid-hint');continue;}
   r.hints.push({skillId:'skill:'+x.d,level,sourceOrdinal:at});continue;
  }
  if(x.t==='sg'){
   if(!only(x,['t','v','d'])||x.v!==null||!positive(x.d)){unresolved('invalid-direct-grant');continue;}
   // Numeric grant candidate only; independent rarity check still required.
   r.directGrants.push({skillId:'skill:'+x.d,sourceOrdinal:at});
   unresolved('direct-grant-kind-unverified');continue;
  }
  if(own(SCALARS,x.t)){
   if(!only(x,x.t==='bo'?['t','v','d']:['t','v'])||own(x,'d')&&!positive(x.d)){
    unresolved('unexpected-scalar-fields');continue;
   }
   const delta=signed(x.v),alternatives=range(x.v);
   if(delta===null&&!alternatives){unresolved('invalid-scalar-value');continue;}
   r.effects.push({kind:SCALARS[x.t],...(delta===null?{alternatives}:{delta}),
    ...(own(x,'d')?{recipientCharId:x.d}:{}),sourceOrdinal:at});
   if(alternatives)unresolved('range-result-semantics-unverified');
   continue;
  }
  // Do not log arbitrary values, labels or unknown payload fields.
  unresolved('unsupported-effect-code');
 }
 finish();
 // Conservation includes delimiter tokens; no reward can vanish silently.
 if(group.routes.reduce((n,x)=>n+x.sourceOrdinals.length,0)+group.routes.length-1!==g.r.length)
  fail('reward position conservation failed');
 return group;
}
function inspectCardJson({body,cardId,sourceUrl,buildId}={}){
 const url=cardJsonUrl({cardId,sourceUrl,buildId});
 if(typeof body!=='string'||Buffer.byteLength(body)>512000)fail('response size/type');
 let root,doc;
 try{root=JSON.parse(body);doc=JSON.parse(root.pageProps.eventData.ja);}catch{fail('invalid nested event JSON');}
 const p=root.pageProps;
 if(!obj(p)||!obj(p.eventData)||typeof p.eventData.ja!=='string'||
    String(p.sourceData?.support_id)!==cardId||
    own(p.itemData||{},'support_id')&&String(p.itemData.support_id)!==cardId||
    !obj(doc)||Object.keys(doc).some(k=>!categories.has(k)))fail('card identity or category drift');
 const events=[],seen=new Set(),titles=new Set();
 for(const [category,records] of Object.entries(doc)){
  if(!Array.isArray(records)||records.length>60)fail('invalid category');
  for(const [index,e] of records.entries()){
   if(!obj(e)||!positive(e.i)||seen.has(e.i)||!Array.isArray(e.c)||!e.c.length||e.c.length>20)
    fail('invalid or duplicate event ID');
   seen.add(e.i);
   const titleSha256=canonicalTitle(e.n);
   // A duplicate title is not a duplicate event, but cannot bind by name.
   const blockers=['selection-semantics-unverified','publication-not-reviewed'];
   if(titles.has(titleSha256))blockers.push('ambiguous-event-title');
   titles.add(titleSha256);
   if(category!=='random')blockers.push('internal-reachability-unverified');
   if(!only(e,['i','n','c','history','type','meaningless_choices']))blockers.push('unknown-event-fields');
   if(own(e,'type'))blockers.push('event-type-semantics-unverified');
   if(own(e,'meaningless_choices')&&typeof e.meaningless_choices!=='boolean')fail('invalid choice flag');
   if(e.meaningless_choices===true)blockers.push('meaningless-choices-unverified');
   if(own(e,'history')&&!Array.isArray(e.history))fail('invalid history container');
   const groups=e.c.map(parseGroup);
   events.push({sourceEventId:e.i,category,categoryOrdinal:index+1,titleSha256,
    historyCount:e.history?.length||0,groups,blockers});
  }
 }
 if(!events.length)fail('empty event collection is not verified no-events');
 if(events.length>100)fail('event cap');
 return {dataKind:'gametora-card-json-private-observation',schemaVersion:1,
  cardId,buildId,sourceUrl,jsonUrl:url,bodySha256:sha(body),bodyBytes:Buffer.byteLength(body),
  events,sourceSiteTextCopied:false,existingDatabaseUnchanged:true,
  publicationApproved:false,appEventSchemaAdoptable:false};
}
// A single explicit pair can be tried against an independently reviewed
// two-outcome reference, without declaring that the source proves causality.
// Multiple ranges or range + delimiter need a distinct reviewed rule.
function comparisonRoutes(group){
 const rangeRows=group.routes.flatMap(r=>r.effects.filter(e=>Array.isArray(e.alternatives)));
 if(!rangeRows.length)return {routes:group.routes,rangeHypothesis:false,rangeBlocked:false};
 if(group.routes.length!==1||rangeRows.length!==1)return {routes:[],rangeHypothesis:false,rangeBlocked:true};
 const source=group.routes[0];
 if(source.unresolved.some(x=>x.reason!=='range-result-semantics-unverified'))
  return {routes:[],rangeHypothesis:false,rangeBlocked:true};
 return {routes:[0,1].map(i=>({...source,effects:source.effects.map(e=>{
  if(!e.alternatives)return e;
  const {alternatives,...rest}=e;return {...rest,delta:alternatives[i]};
 })})),rangeHypothesis:true,rangeBlocked:false};
}
const bag=a=>a.slice().sort().join('|');
const effect=x=>x.kind+':'+x.delta+':'+(x.recipientCharId??'');
const hint=x=>x.skillId+':'+x.level;
const same=(a,b)=>bag(a)===bag(b);
function legacyCompare(observation,card){
 if(observation?.dataKind!=='gametora-card-json-private-observation'||
    observation.publicationApproved!==false||observation.appEventSchemaAdoptable!==false||
    !SHA.test(observation.bodySha256||'')||observation.cardId!==card?.cardId||!Array.isArray(card.events))
  fail('comparison scope mismatch');
 const refs=new Map();
 for(const e of card.events){
  const key=canonicalTitle(e.name);
  if(!refs.has(key))refs.set(key,[]);
  refs.get(key).push(e);
 }
 const used=new Set();
 const rows=observation.events.map(e=>{
  const matched=refs.get(e.titleSha256)||[];
  if(matched.length!==1||observation.events.filter(x=>x.titleSha256===e.titleSha256).length!==1)
   return {sourceEventId:e.sourceEventId,status:'unbound-title',oldMatches:matched.length};
  const old=matched[0];used.add(old.id);
  const parents=old.type==='auto'?[old]:old.type==='choice'?old.choices:null;
  if(!Array.isArray(parents))fail('invalid reference type');
  const groups=e.groups.map((g,i)=>{
   const trial=comparisonRoutes(g),p=parents[i],refs=p?(p.outcomes||[p]):[];
   const routeRows=trial.routes.map((r,j)=>{
    const leaf=refs[j];
    const oldHints=(leaf?.rewards||[]).filter(x=>!x.kind||x.kind==='hint');
    const oldDirect=(leaf?.rewards||[]).filter(x=>['negative','obtained'].includes(x.kind));
    const otherRewards=(leaf?.rewards||[]).filter(x=>x.kind&&!['hint','negative','obtained'].includes(x.kind));
    const unknown=r.unresolved.filter(x=>!(trial.rangeHypothesis&&x.reason==='range-result-semantics-unverified'));
    return {ordinal:j+1,hintCount:r.hints.length,scalarCount:r.effects.length,directGrantCount:r.directGrants.length,
     hintsMatch:!!leaf&&same(r.hints.map(hint),oldHints.map(hint)),
     effectsMatch:!!leaf&&same(r.effects.map(effect),(leaf.effects||[]).map(effect)),
     directGrantIdsMatch:!!leaf&&same(r.directGrants.map(x=>x.skillId),oldDirect.map(x=>x.skillId)),
     stopMarkerMatches:!!leaf&&r.markers.some(m=>m.kind==='explicit-chain-stop')===(leaf.terminal===true||p.terminal===true),
     unresolved:unknown,referenceNonScalarCount:(leaf?.statusEffects?.length||0)+(leaf?.dynamicEffects?.length||0)+otherRewards.length,
     referenceConditionalRewardCount:(leaf?.rewards||[]).filter(x=>x.condition!==undefined).length};
   });
   return {ordinal:i+1,routeCountMatches:!trial.rangeBlocked&&trial.routes.length===refs.length,
    rangeHypothesis:trial.rangeHypothesis,rangeBlocked:trial.rangeBlocked,groupBlockers:g.blockers,routeRows};
  });
  const groupsMatch=parents.length===e.groups.length;
  const matchedFacts=groupsMatch&&groups.every(g=>g.routeCountMatches&&g.routeRows.every(r=>
   r.hintsMatch&&r.effectsMatch&&r.directGrantIdsMatch&&r.stopMarkerMatches));
  const fullyCovered=matchedFacts&&groups.every(g=>!g.groupBlockers.length&&g.routeRows.every(r=>
   !r.unresolved.length&&!r.referenceNonScalarCount&&!r.referenceConditionalRewardCount));
  return {sourceEventId:e.sourceEventId,oldEventId:old.id,status:'compared',groupsMatch,
   knownFactsMatch:matchedFacts,allComparedRewardFactsMatch:fullyCovered,rangeHypothesis:groups.some(g=>g.rangeHypothesis),
   eventBlockers:e.blockers,groups};
 });
 return {cardId:card.cardId,sourceEventCount:observation.events.length,oldEventCount:card.events.length,
  rows,unmatchedOldEventIds:card.events.filter(e=>!used.has(e.id)).map(e=>e.id),
  publicationApproved:false,fullGameSemanticsVerified:false};
}
module.exports={cardJsonUrl,extractBuildId,inspectCardJson,comparisonRoutes,legacyCompare};
