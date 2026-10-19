/* Experimental multi-card preview. Fetches PINNED external numeric facts at runtime.
 * Source 'auto' means planning default, NOT a guaranteed gameplay event.
 * Never turn it into an unconditional game reward.
 * No third-party event titles, choice prose or images are republished. */
(function(g){
'use strict';
const BRIDGE=typeof module!=='undefined'&&module.exports
 ?require('./skill_bridge.js'):g.UmaSkillBridge;
const URL='https://raw.githubusercontent.com/Tsuyuchan-jp/umamusume-data/0cacbb1aaf9dca10283d5b9ea20b205b9d204535/data/events.json';
const SHA256='ac3febaad945b4046a137ff6d1d650b6b6def9ae02a891be936e30735956bfd4';
const STORY=/^evt_([0-9]{5})_([0-9]{9})$/;
const LIMIT_BYTES=256*1024;
const PREFERRED_CARD='30311'; // full five-event GameWith-first preview is kept separately
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function makeReward(x,registry){
 if(!x||!Number.isSafeInteger(x.skillId)||x.skillId<1||
    !Number.isSafeInteger(x.hintLevel)||x.hintLevel<1||x.hintLevel>7||
    typeof x.skillName!=='string')throw Error('候補報酬レコードが不正です');
 const id=String(x.skillId),r=registry.byId.get(id);
 if(!r)return null; // Skip entire event, NEVER silently remove an individual reward.
 if(!['normal','rare'].includes(r.rarity)||r.name!==x.skillName.normalize('NFKC').trim())
  throw Error('外部候補のスキルID名称不一致: '+id);
 return {skillId:'skill:'+id,verifiedSkillName:r.name,level:x.hintLevel};
}
function fromSource(source,model,skillText){
 if(!source||source.version!==2||!Array.isArray(source.events)||
    source.events.length!==126||!model?.cardById)throw Error('外部候補の版・件数が不正です');
 const registry=BRIDGE.parseSource(skillText);
 const byCard=new Map(),eventIds=new Set();
 const omitted={nonNumericStory:0,preferredCard:0,missingSkill:0};
 for(const event of source.events){
  if(!event||typeof event.id!=='string'||eventIds.has(event.id))throw Error('候補イベントIDが不正・重複');
  eventIds.add(event.id);
  const m=STORY.exec(event.id);
  if(!m){omitted.nonNumericStory++;continue;}
  const [,cardId,story]=m;
  if(cardId===PREFERRED_CARD){omitted.preferredCard++;continue;}
  if(!own(model.cardById,cardId))throw Error('収録されていないサポカID: '+cardId);
  let raws=[];
  if(event.selection==='auto'&&Array.isArray(event.skills)&&event.skills.length){
   raws=[event.skills]; // selectable hypothesis; NOT unconditional auto.
  }else if(event.selection==='single'&&Array.isArray(event.choices)&&event.choices.length>0){
   if(event.choices.some(c=>!c||!Array.isArray(c.skills)||!c.skills.length))
     throw Error('候補選択肢が不正: '+event.id);
   raws=event.choices.map(c=>c.skills);
  }else throw Error('候補選択モデルが不正: '+event.id);
  const mapped=raws.map(raw=>raw.map(x=>makeReward(x,registry)));
  if(mapped.flat().some(x=>!x)){omitted.missingSkill++;continue;}
  const item={id:event.id,name:'イベント '+story+'（試用）',type:'choice',
   choices:mapped.map((rewards,i)=>({
    id:'option'+(i+1),label:'候補'+(i+1),rewards
   }))};
  if(!byCard.has(cardId))byCard.set(cardId,[]);
  byCard.get(cardId).push(item);
 }
 const cards=[...byCard].map(([cardId,events])=>({cardId,coverageStatus:'partial',events}));
 const records=cards.reduce((n,c)=>n+c.events.length,0);
 // Exact pinned version counts. Any unexpected upstream semantic change is a hard stop.
 if(cards.length!==44||records!==119||
    omitted.nonNumericStory!==2||omitted.preferredCard!==3||omitted.missingSkill!==2)
  throw Error('外部候補の範囲・除外理由が想定と違います');
 return {catalog:{schemaVersion:1,cards},omitted,records,cards:cards.length};
}
async function load({fetchImpl=g.fetch?.bind(g),cryptoImpl=g.crypto}={}){
 if(!fetchImpl||!cryptoImpl?.subtle)throw Error('候補の原本照合に必要な取得・暗号APIがありません');
 const res=await fetchImpl(URL,{cache:'no-store'});
 if(!res.ok)throw Error('外部イベント候補を取得できません HTTP '+res.status);
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(!bytes.length||bytes.length>LIMIT_BYTES)throw Error('候補データの容量が想定外');
 const digest=new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes));
 const observed=[...digest].map(n=>n.toString(16).padStart(2,'0')).join('');
 if(observed!==SHA256)throw Error('固定版外部候補のSHA-256が一致しません');
 return JSON.parse(new TextDecoder().decode(bytes));
}
const api={URL,SHA256,fromSource,load};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
g.UmaCommunityCandidatePreview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
