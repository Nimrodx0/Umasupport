/* Local-only D-052 label preview. No network or persistent storage. */
(function(g){
'use strict';
const SHA='4c036527bbe6b5aad34d7f12110a06094c9071514e37fdfc68ae195403333be5';
const HIST='b7ba1d6c5dd2af9ed1f4e649f16ec1d319198e2f1ac9db07c54e14d29f0b25ec';
const fail=(x,m)=>{if(!x)throw Error(m)};
const oneOf=(x,a)=>a.includes(x);
const integer=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
const courseMap={10501:1,10502:2,10304:2,10504:3,10604:3,10506:4};
function contextOK(c){
 return c&&integer(c.distance_type,1,4)&&integer(c.ground_type,1,2)&&integer(c.ground_condition,1,4);
}
function scopeOK(l){
 if(l.state==='undetermined')return l.styles.length===0;
 const s=l.scope;if(!s)return false;
 if(l.state==='general')return l.styles.length===0&&s.kind==='source-logic'&&Array.isArray(s.contexts)&&s.contexts.length>0&&s.contexts.length<=32&&s.contexts.every(contextOK);
 if(l.state!=='targeted'||!l.styles.length||l.styles.length>=4||new Set(l.styles).size!==l.styles.length||!l.styles.every(x=>integer(x,1,4)))return false;
 if(s.ground_type!==1||s.ground_condition!==1)return false;
 if(s.kind==='rank-window-fixed-model')return Array.isArray(s.branches)&&s.branches.length>0&&s.branches.length<=2&&s.branches.every(b=>
  b&&Array.isArray(b.courseIds)&&b.courseIds.length>0&&b.courseIds.every(c=>Object.hasOwn(courseMap,c))&&(b.distanceType===null||integer(b.distanceType,1,4)));
 return s.kind==='dynamic-fixed-model'&&Array.isArray(s.contexts)&&s.contexts.length>0&&s.contexts.length<=8&&s.contexts.every(c=>c&&Object.hasOwn(courseMap,c.courseId)&&oneOf(c.fieldSize,[9,12])&&oneOf(c.scenario,['balanced','backHeavy']));
}
async function sha(text){return Array.from(new Uint8Array(await g.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
async function validate(text,model,hashes){
 fail(typeof text==='string'&&text.length<=4_000_000,'ファイルが大きすぎます');
 const p=JSON.parse(text);
 fail(p.schemaVersion===1&&p.decisionId==='D-052'&&p.status==='local-only-derived-suitability-preview','適性試用ファイルではありません');
 fail(p.sourceSHA256===SHA&&p.historicalSHA256===HIST&&hashes?.source===SHA&&hashes?.historical===HIST,'スキル辞書の固定版が一致しません');
 fail(Array.isArray(p.rows)&&p.rows.length===881&&model.skills.length===881,'固定スキル集合が一致しません');
 fail(p.rowsSHA256===await sha(JSON.stringify(p.rows)),'適性ファイルの整合性が確認できません');
 const map=new Map(),counts={general:0,targeted:0,undetermined:0};let missing=0;
 for(const r of p.rows){
  fail(r&&typeof r.appSkillId==='string'&&!map.has(r.appSkillId),'スキルIDが重複しています');
  const sk=model.skillById[r.appSkillId];fail(sk,'現在の辞書にないスキルID');
  const id=sk.activationProfile?.status==='source-structure'?sk.activationProfile.sourceNumericId:null;
  fail(r.sourceNumericId===id,'元スキルIDが一致しません');
  fail(r.label&&Array.isArray(r.label.styles)&&scopeOK(r.label),'適性ラベル形式が不正です');
  if(id===null){missing++;fail(r.explicitNecessaryMasks===null&&r.label.state==='undetermined','未照合スキルのラベルが不正です');}
  else fail(Array.isArray(r.explicitNecessaryMasks)&&r.explicitNecessaryMasks.length===32&&r.explicitNecessaryMasks.every(x=>integer(x,0,15)),'適用範囲形式が不正です');
  counts[r.label.state]++;map.set(r.appSkillId,r);
 }
 fail(missing===63&&counts.general===257&&counts.targeted===43&&counts.undetermined===581,'固定判定件数が一致しません');
 return map;
}
const contexts=()=>Object.keys(courseMap).flatMap(c=>[9,12].flatMap(n=>['balanced','backHeavy'].map(s=>({courseId:Number(c),distance_type:courseMap[c],ground_type:1,ground_condition:1,fieldSize:n,scenario:s}))));
const api={validate,sha,contexts};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaLocalSuitability=api;
})(typeof globalThis!=='undefined'?globalThis:this);
