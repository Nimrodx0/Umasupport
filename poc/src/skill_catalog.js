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
 'fc8ad2b54561e4107bf0bc7c3d8744b7230de03d1035eeae082b2478d1102bcc':Object.freeze({decisionId:'D-056',policySHA256:'eeab2d93df380d96d1eecf6fb3f2a3c11e971bfa4791795d463a60a7fa640c35',count:324}),
 '2f7efccbf6ced322e4902b8014ba580332dd84f613c996bc4e7daca7c9b6505a':Object.freeze({decisionId:'D-059',policySHA256:'f0c4d078973bd4cc2b16775b11fdd2da3dd72e4cd4e3a1010fd636ab5facb702',count:404})
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
 const applicable=contexts(label).some(c=>['distance_type','ground_type','ground_condition'].every(k=>ctx[k]==null||ctx[k]===c[k])&&(ctx.running_style==null||c.running_styles==null||c.running_styles.includes(ctx.running_style)));
 if(!applicable)return {state:'undetermined',styles:[],text:'未判定'};
 // Browse known evidence without pretending the user's actual race matches a model roster.
 if(label.state==='general')return {state:'general',styles:[],text:'汎用'};
 const distances=[...new Set(contexts(label).map(c=>AXES.distance_type[c.distance_type-1]))].join('・');
 return {state:'targeted',styles:label.styles,text:fit.labelText(label)+'（限定）',note:distances+' / 芝・良 / 固定モデル条件内'};
}
// A browse assessment is a hierarchy, not a new suitability score.
function assessment(row,ctx={}){
 const applicability=fit.applicability(row,ctx),e=evidence(row,ctx);
 const permittedStyles=[1,2,3,4].filter(s=>fit.applicability(row,{...ctx,running_style:s})==='possible');
 const style=ctx.running_style;
 const category=applicability==='outside'?'outside':applicability==='unknown'?'scopeUnknown':
  permittedStyles.length===1?'explicitOnly':
  e.state==='general'?'general':e.state==='targeted'?(style==null||e.styles.includes(style)?'targeted':'otherTargeted'):'undetermined';
 return {applicability,evidence:e,permittedStyles,category};
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
  if(suit!=='all'){
   const x=assessment(r,ctx).category;
   if(suit==='supported')return ['explicitOnly','general','targeted'].includes(x);
   if(suit==='apt-positive')return ['explicitOnly','targeted'].includes(x);
   return x===suit;
  }
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
// D060: compact, derived labels only. No source condition or source name is
// distributed. Resolve numeric identities uniquely and compare the live
// profile to the pinned upstream dictionary before admitting any label.
const PUBLIC_URL='./data/skill-suitability-d059.v1.txt';
const PUBLIC_SHA='61d5e202efbc401e188e3c54df5d0630b6971a516afb52fb9faa82a4d39bb34d';
const stylesFor=m=>[1,2,3,4].filter(s=>m&(1<<(s-1)));
function publicLabels(text){
 const out=new Map(),counts={general:0,targeted:0};
 const invalid=()=>{throw Error('公開適性データの形式が一致しません。');};
 for(const line of text.trim().split('\n')){
  const p=line.split(' '),kind=p[0],ids=p.at(-1).split(',');let label;
  if(kind==='g'&&p.length===3&&/^[0-9a-f]{32}$/.test(p[1])){
   const mask=[...p[1]].map(x=>parseInt(x,16)),contexts=[];
   for(let d=1;d<=4;d++)for(let g=1;g<=2;g++)for(let c=1;c<=4;c++){
    const running_styles=[1,2,3,4].filter(s=>mask[(s-1)*8+(d-1)*2+g-1]&(1<<(c-1)));
    if(running_styles.length)contexts.push({distance_type:d,ground_type:g,ground_condition:c,running_styles});
   }
   if(!contexts.length)invalid();
   label={state:'general',styles:[],scope:{kind:'source-logic',contexts}};
  }else if(['r','d'].includes(kind)&&p.length===4&&/^(?:[1-9]|1[0-4])$/.test(p[1])){
   const styles=stylesFor(Number(p[1]));let scope;
   if(kind==='r'){
    const courseIds=p[2].split(',').map(Number);if(courseIds.some(id=>!COURSE_DISTANCE[id])||new Set(courseIds).size!==courseIds.length)invalid();
    scope={kind:'rank-window-fixed-model',branches:[{distanceType:null,courseIds}],ground_type:1,ground_condition:1,fieldSizes:[9,12],scenarios:['balanced'],modelAbilityModes:['equal','jitter10']};
   }else{
    const contexts=p[2].split(',').map(x=>{const [courseId,fieldSize,scenario,...rest]=x.split(':');if(rest.length||!COURSE_DISTANCE[Number(courseId)]||![9,12].includes(Number(fieldSize))||!['balanced','backHeavy'].includes(scenario))invalid();return {courseId:Number(courseId),fieldSize:Number(fieldSize),scenario};});
    if(new Set(contexts.map(x=>JSON.stringify(x))).size!==contexts.length)invalid();
    scope={kind:'dynamic-fixed-model',contexts,ground_type:1,ground_condition:1,modelAbilityModes:['equal']};
   }
   label={state:'targeted',styles,scope};
  }else invalid();
  for(const id of ids){if(!/^\d+$/.test(id)||out.has(id))invalid();out.set(id,label);counts[label.state]++;}
 }
 if(counts.general!==304||counts.targeted!==100||out.size!==404)invalid();
 return out;
}
async function loadPublicLabels(data,{fetcher=g.fetch}={}){
 const get=async(url,digest)=>{const res=await fetcher(url);if(!res.ok)throw Error('適性データまたは固定辞書の取得に失敗しました。');const b=await res.arrayBuffer();if(await sha(b)!==digest)throw Error('適性データまたは固定辞書の検証に失敗しました。');return new TextDecoder().decode(b);};
 const [derived,raw]=await Promise.all([get(PUBLIC_URL,PUBLIC_SHA),get(FIXED_SOURCE,SOURCE_HASH)]);
 const approved=publicLabels(derived),records=new Map(JSON.parse(raw.replace(/^\uFEFF/,'')).map(r=>[r.id,r])),bySource=new Map();
 for(const skill of data.skills){const id=skill.activationProfile?.sourceNumericId;if(!id)continue;if(!bySource.has(id))bySource.set(id,[]);bySource.get(id).push(skill);}
 const labels=new Map();let skipped=0;
 for(const [id,label] of approved){
  const matches=bySource.get(id)||[],skill=matches[0],source=records.get(id),p=skill?.activationProfile;
  if(matches.length!==1||!source||p?.status!=='source-structure'||signature(p)!==signature(profiles.project(source,'fixed'))){skipped++;continue;}
  const m=masks(p);
  if(!m){skipped++;continue;}
  if(label.state==='general'&&label.scope.contexts.some(c=>c.running_styles.some(s=>!(m[(s-1)*8+(c.distance_type-1)*2+c.ground_type-1]&(1<<(c.ground_condition-1)))))){skipped++;continue;}
  labels.set(skill.id,{appSkillId:skill.id,sourceNumericId:id,explicitNecessaryMasks:m,label});
 }
 return {labels,skipped,decisionId:'D-059'};
}
const api={AXES,masks,scopeSummary,evidence,assessment,index,filter,loadLabels,loadPublicLabels,publicLabels,PUBLIC_URL,PUBLIC_SHA,BUNDLE_HASH,SOURCE_HASH,POLICY_HASH,APPROVED_BUNDLES};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaSkillCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
