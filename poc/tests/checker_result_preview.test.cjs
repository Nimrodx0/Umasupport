'use strict';
const {test}=require('node:test');
const a=require('node:assert/strict');
const SOURCE=require('../data/candidates/checker_explicit_result_facts.v1.json');
const ADAPTER=require('../src/checker_result_preview.js');
const LOADER=require('../src/event_preview_loader.js');
const PUBLIC=require('../src/public_event_catalog.js');
const CORE=require('../src/core.js');
function dictionary(){
 const ids=[...new Set(SOURCE.cards.flatMap(c=>c.events.flatMap(e=>
  e.choices.flatMap(ch=>ch.results.flatMap(r=>r.skillHints
   .filter(h=>h.skillId).map(h=>h.skillId))))))];
 const rows=ids.map((id,i)=>({id,name:'テスト数値技能'+id,rarity:'normal',group:300000+i}));
 for(const p of require('../src/skill_hierarchy.js').PAIRS){
  if(!ids.includes(p.goldId)&&!ids.includes(p.whiteId))continue;
  for(const [id,name,rarity] of [[p.goldId,p.goldName,'rare'],[p.whiteId,p.whiteName,'normal']]){
   let row=rows.find(x=>x.id===id);
   if(!row){row={id};rows.push(row);}
   Object.assign(row,{name,rarity,group:p.group});
  }
 }
 while(rows.length<120)rows.push({id:String(990000+rows.length),
  name:'テスト技能'+rows.length,rarity:'normal',group:990000+rows.length});
 return JSON.stringify(rows);
}
function model(){
 const cards=SOURCE.cards.map(c=>({id:c.cardId,events:[],hints:[]}));
 return {cards,cardById:Object.fromEntries(cards.map(c=>[c.id,c])),skills:[],
  skillById:{},meta:{reviewedEventRecords:0,reviewedEventCards:0,
   runtimeSources:{events:{mode:'reviewed'}}}};
}
const dict=dictionary();
test('all 2109 source events are validated; only safe explicit-result records appear',()=>{
 const p=ADAPTER.fromSource(SOURCE,model(),dict);
 a.ok(p.summary.events>0);
 a.ok(p.summary.events<=179);
 a.ok(p.summary.outcomeVariants>=2);
 a.ok(p.summary.matchedHints>0);
 a.equal(p.summary.events+Object.values(p.summary.omitted).reduce((n,v)=>n+v,0),2109);
 const keyed=new Map(SOURCE.cards.flatMap(c=>c.events.map(e=>[e.sourceKey,e])));
 for(const card of p.catalog.cards)for(const event of card.events){
  const raw=keyed.get(event.id.slice('resultfact:'.length));
  a.ok(raw);
  a.ok(raw.choices.some(c=>c.structure==='explicit-result-headings'));
  a.ok(raw.choices.every(c=>!c.diagnostics.length&&c.results.every(r=>!r.terminalObserved)));
  a.ok(event.choices.some(c=>c.outcomes));
  for(const choice of event.choices){
   const parts=choice.outcomes||[{rewards:choice.rewards}];
   for(const part of parts)for(const reward of part.rewards){
    a.match(reward.condition,/未確認|未区分/);
    a.ok(reward.verifiedSkillName);
   }
  }
 }
 a.equal(p.catalog.schemaVersion,1);
 a.equal(JSON.stringify(p.catalog).includes('"terminal":true'),false);
 a.equal(JSON.stringify(p.catalog).includes('"requires"'),false);
});
test('selected result routes remain conditional and are never auto granted',()=>{
 const m=model(),p=ADAPTER.fromSource(SOURCE,m,dict);
 const summary=PUBLIC.attach(m,p.catalog,{skillText:dict});
 a.equal(summary.eventsWithRecords,p.summary.events);
 const found=p.catalog.cards.flatMap(c=>c.events.map(e=>({card:c.cardId,event:e})))
  .find(x=>x.event.choices.some(c=>c.outcomes?.some(o=>o.rewards.length)));
 a.ok(found,'at least one labeled result must contain a numeric skill hint');
 const card=m.cardById[found.card];
 a.equal(CORE.directRoutes(card,{stage:4,choices:{},outcomes:{}}).filter(r=>r.source==='event').length,0);
 const choice=found.event.choices.find(c=>c.outcomes?.some(o=>o.rewards.length));
 const config={stage:4,choices:{[found.event.id]:choice.id},outcomes:{}};
 const candidate=CORE.directRoutes(card,config).filter(r=>r.eventId===found.event.id);
 a.ok(candidate.length);
 a.ok(candidate.every(r=>r.conditional&&r.condition.includes('未確認')));
 const target=choice.outcomes.find(o=>o.rewards.length);
 config.outcomes[found.event.id]=target.id;
 const narrowed=CORE.directRoutes(card,config).filter(r=>r.eventId===found.event.id);
 a.equal(narrowed.length,target.rewards.length);
 a.ok(narrowed.every(r=>r.conditional&&r.condition.includes('未確認')));
});
test('source integrity, result schema and missing registry entries fail closed or exclude complete event',()=>{
 const broken=structuredClone(SOURCE);
 broken.forSkillGrant=true;
 a.throws(()=>ADAPTER.fromSource(broken,model(),dict),/版・件数・未承認/);
 const shifted=structuredClone(SOURCE);
 shifted.stats.events--;
 a.throws(()=>ADAPTER.fromSource(shifted,model(),dict),/版・件数・未承認/);
 const changed=structuredClone(SOURCE);
 changed.cards[0].events[0].chainRouteVerified=true;
 a.throws(()=>ADAPTER.fromSource(changed,model(),dict),/未検証状態/);
 const registry=JSON.parse(dict);
 const original=ADAPTER.fromSource(SOURCE,model(),dict);
 const firstSkill=original.catalog.cards.flatMap(c=>c.events.flatMap(e=>e.choices.flatMap(ch=>
  (ch.outcomes||[{rewards:ch.rewards}]).flatMap(o=>o.rewards))))[0].skillId.slice(6);
 const reduced=ADAPTER.fromSource(SOURCE,model(),JSON.stringify(registry.filter(r=>r.id!==firstSkill)));
 a.ok(reduced.summary.events<original.summary.events);
 a.ok(reduced.summary.omitted.unresolvedSkill>original.summary.omitted.unresolvedSkill);
});
test('new preview mode is explicitly opt-in, atomic, and never promotes public approval',async()=>{
 const m=model(),before=JSON.stringify(m);
 const fetchImpl=async url=>{
  a.equal(url,ADAPTER.URL);
  return {ok:true,json:async()=>SOURCE};
 };
 const out=await LOADER.activate(m,{cardId:'results',skillText:dict,fetchImpl});
 a.equal(out.records,m.meta.previewEvents.records);
 a.ok(out.records>0);
 a.equal(m.meta.reviewedEventRecords,0);
 a.equal(m.meta.reviewedEventCards,0);
 a.equal(m.meta.runtimeSources.events.mode,'preview');
 a.match(m.meta.previewEvents.source,/unreviewed/);
 const invalid=model(),old=JSON.stringify(invalid);
 await a.rejects(()=>LOADER.activate(invalid,{cardId:'results',skillText:dict,
  fetchImpl:async()=>({ok:true,json:async()=>({...SOURCE,forSkillGrant:true})})}),/未承認状態/);
 a.equal(JSON.stringify(invalid),old);
 a.notEqual(JSON.stringify(m),before);
});
