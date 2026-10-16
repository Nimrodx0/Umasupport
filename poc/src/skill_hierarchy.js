/* Publisher-derived skill group hierarchy with a fail-closed structural audit.
 * Source skill records are fetched at runtime, never bundled in this repository.
 * PAIRS are externally reviewed examples, not a manual limit on total coverage.
 */
(function(g){
'use strict';
const PAIRS=Object.freeze([
  {goldId:'200591',goldName:'迅速果断',whiteId:'200592',whiteName:'位置取り押し上げ',group:20059,
   evidence:['https://gamewith.jp/uma-musume/article/show/257945','https://game8.jp/umamusume/372729']},
  {goldId:'203561',goldName:'一所懸命',whiteId:'203562',whiteName:'奮闘',group:20356,
   evidence:['https://gamewith.jp/uma-musume/article/show/561923','https://game8.jp/umamusume/785661']},
  {goldId:'203801',goldName:'解き放つ情念',whiteId:'203802',whiteName:'想い焦がれて',group:20380,
   evidence:['https://gamewith.jp/uma-musume/article/show/514488','https://gamewith.jp/uma-musume/article/show/514492']}
]);
const norm=x=>String(x).normalize('NFKC').replace(/\s+/g,' ').trim();
const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
function derive(source){
 if(!(source?.byId instanceof Map)||!(source?.byName instanceof Map))throw Error('スキルソースの形式が不正');
 const groups=new Map();
 for(const s of source.byId.values()){
   const group=groups.get(s.group)||{rare:[],normal:[]};
   if(s.rarity==='rare')group.rare.push(s);
   if(s.rarity==='normal')group.normal.push(s);
   groups.set(s.group,group);
 }
 const chains=[],unresolved=[],withoutLower=[];
 const unique=x=>source.byName.get(x.name)?.length===1;
 for(const [groupId,group] of groups){
   const rare=group.rare,normal=group.normal;
   if(!rare.length)continue;
   if(!normal.length){withoutLower.push(...rare.map(r=>r.id));continue;}
   // Master-ID family and rank are supported by the recorded rarity/group fields.
   const safeIds=[...rare,...normal].every(s=>Number.isSafeInteger(Number(s.id))&&
     Math.floor(Number(s.id)/10)===groupId&&unique(s));
   const circles=normal.length===2 &&
     normal.filter(s=>s.name.endsWith('○')).length===1 &&
     normal.filter(s=>s.name.endsWith('◎')).length===1;
   if(rare.length!==1||!safeIds||!(normal.length===1||circles)){
     unresolved.push({group:groupId,rareIds:rare.map(s=>s.id),normalIds:normal.map(s=>s.id)});
     continue;
   }
   const lower=circles?normal.find(s=>s.name.endsWith('◎')):normal[0];
   const lesser=circles?normal.find(s=>s.name.endsWith('○')):null;
   chains.push({gold:rare[0],white:lower,base:lesser,group:groupId});
 }
 return {chains,unresolved,withoutLower,totalRare:[...source.byId.values()].filter(s=>s.rarity==='rare').length};
}
function stage({model,source,skills=[],pairs=PAIRS,fullRegistry=false}){
 if(!model||!model.skillById||!Array.isArray(skills)||!Array.isArray(pairs))
   throw Error('上下関係の照合に必要なデータが不正');
 const report=derive(source),added=new Map(skills.map(s=>[s.id,s])),patchMap=new Map();
 const idFor=record=>{
   const hintId='hint:'+record.name,key='skill:'+record.id;
   if(source.byName.get(record.name)?.length===1&&own(model.skillById,hintId))return hintId;
   return key;
 };
 function ensure(record){
   const id=idFor(record),current=added.get(id)||model.skillById[id];
   const tier=record.rarity==='rare'?'gold':'white';
   if(current){
     if(norm(current.name)!==record.name||current.tier&&!['unknown',tier].includes(current.tier))
       throw Error('スキル辞書と分類の矛盾: '+id);
     if(current.tier!==tier)patch(id,{tier});
   } else added.set(id,{id,name:record.name,tier,lowerId:null,
     sourceNumericId:record.id,sourceStatus:'umasim-source-group'});
   return id;
 }
 function patch(id,change){
   const prev=patchMap.get(id)||{id};
   if(prev.lowerId&&change.lowerId&&prev.lowerId!==change.lowerId)
     throw Error('複数の下位スキルが衝突: '+id);
   patchMap.set(id,{...prev,...change});
 }
 function link(upper,lower){
   const higherId=ensure(upper),lowerId=ensure(lower);
   const current=added.get(higherId)||model.skillById[higherId];
   if(current.lowerId!=null&&current.lowerId!==lowerId)
     throw Error('既存の上下関係と矛盾: '+higherId);
   patch(higherId,{lowerId});
 }
 // One-to-one or ○->◎->rare only. No guess for complex/unknown families.
 for(const {gold,white,base} of report.chains){
   const goldKey=idFor(gold);
   if(!fullRegistry&&!added.has(goldKey)&&!own(model.skillById,goldKey))continue;
   link(gold,white);
   if(base)link(white,base);
 }
 // The three independently reviewed examples serve as regression anchors.
 for(const pair of pairs){
   if(!source.byId.has(pair.goldId)&&!source.byId.has(pair.whiteId))continue;
   const match=report.chains.find(c=>c.gold.id===pair.goldId&&c.white.id===pair.whiteId&&
     c.gold.name===pair.goldName&&c.white.name===pair.whiteName&&c.group===pair.group);
   if(!match)throw Error('上下関係の独立レビュー済みスキル組とソースが矛盾: '+pair.goldId);
 }
 // Expose ALL rare/normal records for goal selection, not only those from events.
 // Unpaired ones remain as individual entries with no speculative lowerId.
 if(fullRegistry)for(const record of source.byId.values()){
   if(record.rarity==='rare'||record.rarity==='normal')ensure(record);
 }
 return {skills:[...added.values()],patches:[...patchMap.values()],
   linkedPairs:[...patchMap.values()].filter(p=>p.id.startsWith('skill:')&&p.lowerId).length,structuralPairs:report.chains.length,
   unresolvedGroups:report.unresolved.length,withoutLower:report.withoutLower.length,
   totalRare:report.totalRare};
}
const api={PAIRS,derive,stage};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillHierarchy=api;
})(typeof globalThis!=='undefined'?globalThis:this);
