/* All application skills, independent of deck/provider membership. */
(function(g){
'use strict';
const fit=typeof module!=='undefined'&&module.exports?require('./skill_suitability.js'):g.UmaSkillSuitability;
const profiles=typeof module!=='undefined'&&module.exports?require('./skill_condition_profiles.js'):g.UmaSkillConditionProfiles;
const AXES={running_style:['逃げ','先行','差し','追込'],distance_type:['短距離','マイル','中距離','長距離'],ground_type:['芝','ダート'],ground_condition:['良','稍重','重','不良']};
const PANEL=[1,2,3,4].flatMap(running_style=>[1,2,3,4].flatMap(distance_type=>[1,2].map(ground_type=>({running_style,distance_type,ground_type}))));
const COURSE_DISTANCE={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
const SOURCE_HASH='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const BUNDLE_HASH='874e7cf802bcf1ed0cf314c60438ca0b2fcc27bfa76d20b583be48c78c8814e7';
const POLICY_HASH='eec33230ee629d91b1f6f41109d6691e16237b69e1f7e6ffcd0b7cf23e1061f7';
const APPROVED_BUNDLES=Object.freeze({
 [BUNDLE_HASH]:Object.freeze({decisionId:'D-052',policySHA256:POLICY_HASH,count:300}),
 'fc8ad2b54561e4107bf0bc7c3d8744b7230de03d1035eeae082b2478d1102bcc':Object.freeze({decisionId:'D-056',policySHA256:'eeab2d93df380d96d1eecf6fb3f2a3c11e971bfa4791795d463a60a7fa640c35',count:324})
});
const FIXED_SOURCE='https://raw.githubusercontent.com/mee1080/umasim/f6e4501ee6c6c2d4ac8698e7796e309d31575bde/data/skill_data.txt';
const norm=x=>String(x??'').normalize('NFKC').toLocaleLowerCase().trim();
const valid=(v,op,n)=>{switch(op){case '==':return v===n;case '!=':return v!==n;case '<':return v<n;case '<=':return v<=n;case '>':return v>n;case '>=':return v>=n;default:throw Error('Unknown predicate');}};
function masks(profile){
 if(profile?.status!=='source-structure'||!profile.invokes?.length)return null;
 return PANEL.map(ctx=>{
  let m=0;for(let condition=1;condition<=4;condition++){
   const c={...ctx,ground_condition:condition};
   const possible=profile.invokes.some(inv=>{
    const passes=terms=>terms.every(p=>!Object.hasOwn(AXES,p.type)||valid(c[p.type],p.operator,p.value));
    return inv.conditions.some(passes)&&(!inv.preConditions.length||inv.preConditions.some(passes));
   });
   if(possible)m|=1<<(condition-1);
  }return m;
 });
}
function signature(p){return JSON.stringify({sourceNumericId:p.sourceNumericId,invokes:p.invokes});}
function scopeSummary(m){return fit.explicitScope({explicitNecessaryMasks:m}).text;}
function contexts(label){
 if(label.state==='general')return label.scope.contexts;
 if(label.state!=='targeted')return [];
 const scope=label.scope;
 const courseIds=scope.kind==='rank-window-fixed-model'?scope.branches.flatMap(b=>b.courseIds):scope.contexts.map(c=>c.courseId);
 return [...new Set(courseIds.map(id=>COURSE_DISTANCE[id]).filter(Boolean))].map(distance_type=>({distance_type,ground_type:1,ground_condition:1}));
}
function evidence(row,ctx={}){
 const label=row?.label;
 if(!label||label.state==='undetermined')return {state:'undetermined',styles:[],text:'未判定'};
 const applicable=contexts(label).some(c=>['distance_type','ground_type','ground_condition'].every(k=>ctx[k]==null||ctx[k]===c[k]));
 if(!applicable)return {state:'undetermined',styles:[],text:'未判定'};
 // Browse known evidence without pretending the user's actual race matches a model roster.
 if(label.state==='general')return {state:'general',styles:[],text:'汎用'};
 const distances=[...new Set(contexts(label).map(c=>AXES.distance_type[c.distance_type-1]))].join('・');
 return {state:'targeted',styles:label.styles,text:fit.labelText(label)+'（限定）',note:distances+' / 芝・良 / 固定モデル条件内'};
}
function index(data,labels=new Map()){
 return data.skills.map(skill=>{
  const m=masks(skill.activationProfile);
  return {skill,explicitNecessaryMasks:m,scopeSummary:scopeSummary(m),label:labels.get(skill.id)?.label??null};
 });
}
function filter(rows,o={}){
 const q=norm(o.query),ctx=o.context||{},tier=o.tier||'all',scope=o.scope||'possible',suit=o.suitability||'all';
 return rows.filter(r=>{
  if(q&&!norm(r.skill.name).includes(q)&&!norm(r.skill.id).includes(q))return false;
  if(tier!=='all'&&tier!==(['gold','white','negative'].includes(r.skill.tier)?r.skill.tier:'unknown'))return false;
  const app=fit.applicability(r,ctx);
  if(scope==='possible'&&Object.keys(AXES).some(k=>ctx[k]!=null)&&app==='outside'||scope==='confirmed'&&app!=='possible'||scope==='unknown'&&app!=='unknown'||scope==='outside'&&app!=='outside')return false;
  const e=evidence(r,ctx);
  if(suit==='general'&&e.state!=='general'||suit==='targeted'&&(e.state!=='targeted'||ctx.running_style!=null&&!e.styles.includes(ctx.running_style))||suit==='undetermined'&&e.state!=='undetermined'||suit==='supported'&&!(e.state==='general'||e.state==='targeted'&&(ctx.running_style==null||e.styles.includes(ctx.running_style))))return false;
  return true;
 }).sort((a,b)=>a.skill.name.localeCompare(b.skill.name,'ja')||a.skill.id.localeCompare(b.skill.id));
}
async function sha(bytes){
 return Array.from(new Uint8Array(await g.crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
}
async function loadLabels(bytes,data,{fetcher=g.fetch}={}){
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength>1000000)throw Error('検証済みラベルファイルと一致しません。');
 const approved=APPROVED_BUNDLES[await sha(bytes)];if(!approved)throw Error('検証済みラベルファイルと一致しません。');
 const obj=JSON.parse(new TextDecoder().decode(bytes));
 if(obj.schemaVersion!==1||obj.decisionId!==approved.decisionId||obj.sourceRegistrySHA256!==SOURCE_HASH||obj.policySHA256!==approved.policySHA256||!Array.isArray(obj.rows)||obj.rows.length!==approved.count)throw Error('ラベルの版が一致しません。');
 const res=await fetcher(FIXED_SOURCE);if(!res.ok)throw Error('固定辞書の取得に失敗しました。');
 const raw=await res.arrayBuffer();if(await sha(raw)!==SOURCE_HASH)throw Error('固定辞書の検証に失敗しました。');
 const records=new Map(JSON.parse(new TextDecoder().decode(raw).replace(/^\uFEFF/,'')).map(r=>[r.id,r]));
 const out=new Map();let skipped=0;
 for(const r of obj.rows){
  const skill=data.skillById[r.appSkillId],p=skill?.activationProfile,source=records.get(r.sourceNumericId);
  if(!source||p?.status!=='source-structure'||p.sourceNumericId!==r.sourceNumericId||
     signature(p)!==signature(profiles.project(source,'fixed'))||
     JSON.stringify(masks(p))!==JSON.stringify(r.explicitNecessaryMasks)){skipped++;continue;}
  if(out.has(r.appSkillId))throw Error('ラベルのID重複');
  out.set(r.appSkillId,r);
 }
 return {labels:out,skipped,decisionId:approved.decisionId};
}
const api={AXES,masks,scopeSummary,evidence,index,filter,loadLabels,BUNDLE_HASH,SOURCE_HASH,POLICY_HASH,APPROVED_BUNDLES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
