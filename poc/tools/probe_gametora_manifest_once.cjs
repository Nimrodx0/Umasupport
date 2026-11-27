'use strict';
// Explicit one-time D069 research; no persistence of upstream JSON or prose.
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const origin='https://gametora.com', targets=['10149','30323'];
const ua='Umasupport-readonly-new-card-probe/0.1';
let robots='';
async function read(path,max,type){
 if(!/^\/(?:robots\.txt|data\/[a-zA-Z0-9_./-]+\.json)$/.test(path))throw Error('Invalid path');
 if(path!=='/robots.txt'&&robotsDisallows(robots,path).length)throw Error('robots disallows '+path);
 const r=await fetch(origin+path,{headers:{'User-Agent':ua},redirect:'manual',signal:AbortSignal.timeout(30000)});
 console.log('GT_RESPONSE='+JSON.stringify({path,status:r.status,contentType:r.headers.get('content-type'),contentLength:r.headers.get('content-length'),encoding:r.headers.get('content-encoding')}));
 if(r.status!==200)throw Error('HTTP '+r.status+'; stop');
 if(!String(r.headers.get('content-type')).includes(type))throw Error('Unexpected content type');
 const reader=r.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('Response exceeds cap');chunks.push(Buffer.from(value));}}finally{await reader.cancel();}
 const bytes=Buffer.concat(chunks);
 console.log('GT_BYTES='+JSON.stringify({path,bytes:size,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
 return bytes.toString('utf8');
}
const kind=x=>x===null?'null':Array.isArray(x)?'array':typeof x;
function shape(x,depth=0){
 const t=kind(x);
 if(t==='array')return {type:t,length:x.length,first:depth<3&&x.length?shape(x[0],depth+1):undefined};
 if(t==='object')return {type:t,keyCount:Object.keys(x).length,fields:depth<3?Object.entries(x).slice(0,20).map(([k,v])=>({key:/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'<nonfield>',shape:shape(v,depth+1)})):undefined};
 return {type:t};
}
// Match only the two explicit pending cards, never report other IDs or values.
function locate(x){
 const matches=[];let visited=0;
 const walk=(v,path,d)=>{
  if(!v||typeof v!=='object'||d>12)return;
  if(++visited>250000)throw Error('Structure inspection cap');
  if(Array.isArray(v)){for(let i=0;i<v.length;i++)walk(v[i],path.concat('[]'),d+1);return;}
  for(const [k,val] of Object.entries(v)){
   if(targets.includes(k)&&val&&typeof val==='object')matches.push({target:k,via:'key',path:path.concat('<target>'),shape:shape(val)});
   if(/^(id|card_?id|support_?id|support_?card_?id)$/i.test(k)&&targets.includes(String(val)))matches.push({target:String(val),via:k,path,shape:shape(v)});
   if(val&&typeof val==='object')walk(val,path.concat(/^[a-zA-Z_][a-zA-Z0-9_-]{0,35}$/.test(k)?k:'<key>'),d+1);
  }
 };
 walk(x,[],0);
 return {matches:matches.slice(0,12),matchCount:matches.length};
}
// Compare only the three already independently reviewed SSR 30322 chain
// events and the pending friend card identities. No catalog mutation.
const assert=require('node:assert/strict');
const {canonical,digest}=require('../src/event_release_gate.cjs');
const approved=require('../data/reviewed_events.v1.json');
const count=x=>Array.isArray(x)?x.length:null;
function publishedRewards(event){
 const groups=event.type==='auto'?[event]:event.choices||[];
 return groups.map(g=>(g.outcomes||[g]).map(o=>(o.rewards||[]).map(r=>({id:Number(r.skillId?.replace(/^skill:/,'')),kind:r.kind,level:r.level??null})).sort((a,b)=>a.id-b.id||String(a.kind).localeCompare(String(b.kind))||a.level-b.level)));
}
function parseGroup(g,dict){
 assert(Array.isArray(g)&&g.length===2&&Number.isSafeInteger(g[0])&&Array.isArray(g[1]),'Unexpected choice encoding');
 const refs=g[1].map(id=>{
  assert(Number.isSafeInteger(id)&&id>0&&Array.isArray(dict[id]),'Unresolved reward ref');
  return dict[id];
 });
 const hints=refs.filter(r=>r[0]==='sk').map(r=>({id:r[2],kind:'hint',level:Number(r[1])})).sort((a,b)=>a.id-b.id||a.level-b.level);
 const types=[...new Set(refs.map(r=>r[0]))].sort();
 return {hints,types};
}
(async()=>{
 robots=await read('/robots.txt',100000,'text/plain');
 const fetchPinned=async(key,version)=>{
  await new Promise(r=>setTimeout(r,6000));
  const body=await read('/data/umamusume/'+key+'.'+version+'.json',4*1024*1024,'json');
  if(!crypto.createHash('sha256').update(body).digest('hex').startsWith(version))throw Error('Version digest mismatch');
  return JSON.parse(body);
 };
 const ssr=await fetchPinned('training_events/ssr','fa74f9c4');
 const dict=await fetchPinned('dict/evrew','a687fca9');
 const supports=await fetchPinned('support-cards','6ea0c160');
 const compare=ssr.filter(row=>Array.isArray(row)&&row[0]===30322);
 const pub=approved.cards.filter(c=>c.cardId==='30322');
 assert(compare.length===1&&pub.length===1,'Missing comparator');
 const chain=pub[0].events.filter(e=>e.id.startsWith('gt-site:30322:')).slice(0,3);
 const pairs=compare[0][1].map((r,i)=>{
  const actual=r[1].map(g=>parseGroup(g,dict));
  const expected=publishedRewards(chain[i]);
  // The source's flat group references may contain unresolved OR markers;
  // do not presume equivalence to a player choice or separate result.
  const actualHints=actual.flatMap(g=>g.hints).sort((a,b)=>a.id-b.id||a.level-b.level);
  const expectedHints=expected.flat(2).sort((a,b)=>a.id-b.id||a.level-b.level);
  return {ordinal:i+1,storyId:r[2],publishedEventId:chain[i]?.id,
   sourceGroups:actual.length,publishedGroups:expected.length,
   publishedOutcomeCounts:expected.map(g=>g.length),
   sourceHints:actualHints,publishedHints:expectedHints,
   hintMultisetMatches:canonical(actualHints)===canonical(expectedHints),
   sourceRewardTypes:[...new Set(actual.flatMap(g=>g.types))].sort()};
 });
 const friendCards=supports.filter(x=>targets.includes(String(x.support_id))).map(x=>({cardId:x.support_id,charId:x.char_id,rarity:x.rarity,eventSkillIds:x.event_skills}));
 console.log('GT_APPROVED_PARITY='+JSON.stringify({cardId:30322,sourceChainCount:compare[0][1].length,publishedCount:pub[0].events.length,pairs,friendCards,publicationApproved:false}));
})().catch(e=>{console.error('GT_PROBE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
