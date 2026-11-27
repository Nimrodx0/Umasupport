'use strict';
const {cardJsonUrl,extractBuildId,inspectCardJson}=require('../src/official_gametora_card_json.cjs');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com';
const targets=[['30030','matikanetannhauser'],['30080','sasami-anshinzawa'],['10149','azuma'],['30323','azuma']];
const norm=s=>String(s||'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
let robots='';
async function read(url,type,max){
 const u=new URL(url);if(u.origin!==origin||u.search||u.hash)throw Error('scope');
 if(u.pathname!=='/robots.txt'){if(robotsDisallows(robots,u.pathname).length)throw Error('robots denied');await new Promise(r=>setTimeout(r,6000));}
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Umasupport-readonly-card-json-probe/0.1'}});
 if(r.status!==200||!String(r.headers.get('content-type')).includes(type))throw Error('HTTP/content '+r.status);
 const reader=r.body.getReader(),chunks=[];let n=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max)throw Error('response cap');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks).toString('utf8');
}
const safe=x=>x===null||typeof x==='boolean'||Number.isSafeInteger(x)||typeof x==='string'&&/^[+-]?\d{1,5}(?:\/[+-]?\d{1,5})?$/.test(x)?x:undefined;
const scalar=(r)=>({code:/^[a-z0-9_]{1,20}$/.test(r.t)?r.t:'unknown',value:safe(r.v),id:safe(r.d),flag:safe(r.r),keys:Object.keys(r).sort().filter(k=>/^[a-z_]{1,30}$/.test(k))});
const meta=(p)=>Object.fromEntries(Object.entries(p||{}).filter(([k,v])=>/^[a-zA-Z_][a-zA-Z0-9_]{0,45}$/.test(k)).map(([k,v])=>[k,Array.isArray(v)?{type:'array',length:v.length}:v&&typeof v==='object'?{type:'object',keys:Object.keys(v).filter(x=>/^[a-zA-Z_][a-zA-Z0-9_]{0,45}$/.test(x)).slice(0,40)}:typeof v]));
(async()=>{
 robots=await read(origin+'/robots.txt','text/plain',100000);
 const sourceUrl=origin+'/ja/umamusume/supports/30030-matikanetannhauser';
 const buildId=extractBuildId({html:await read(sourceUrl,'text/html',512000),cardId:'30030',sourceUrl});
 const pair=[];
 for(const [cardId,slug] of targets){
  const sourceUrl=origin+'/ja/umamusume/supports/'+cardId+'-'+slug;
  const body=await read(cardJsonUrl({cardId,sourceUrl,buildId}),'json',512000);
  const obs=inspectCardJson({body,cardId,sourceUrl,buildId});
  const p=JSON.parse(body).pageProps,doc=JSON.parse(p.eventData.ja),old=catalog.cards.find(c=>c.cardId===cardId);
  const rows=Object.entries(doc).flatMap(([cat,events])=>events.map(e=>{
   const ref=old?.events.filter(x=>norm(x.name)===norm(e.n))||[];
   const groups=e.c.map(c=>({labelPresent:!!c.o,rows:c.r.map(scalar)}));
   const oldGroups=ref.length===1?(ref[0].type==='auto'?[ref[0]]:ref[0].choices).map(g=>(g.outcomes||[g]).map(l=>({effects:l.effects,dynamic:l.dynamicEffects,status:l.statusEffects,rewards:l.rewards?.map(r=>({id:r.skillId,kind:r.kind||'hint',level:r.level})),terminal:l.terminal===true||g.terminal===true}))):null;
   return {category:cat,sourceEventId:e.i,type:/^[a-z0-9_]{1,15}$/.test(e.type||'')?e.type:null,meaninglessChoices:e.meaningless_choices===true,groups,oldGroups,oldId:ref.length===1?ref[0].id:null};
  }));
  console.log('SPECIAL_CARD='+JSON.stringify({cardId,buildId,sha:obs.bodySha256,rows,itemDataShape:meta(p.itemData),isLevelDependent:p.isLevelDependent===true,publicationApproved:false}));
  if(!old)pair.push({cardId,rows});
 }
 if(pair.length===2)console.log('AZUMA_FULL_NUMERIC_SHAPE='+JSON.stringify({ids:pair.map(x=>x.cardId),equal:JSON.stringify(pair[0].rows)===JSON.stringify(pair[1].rows),eventCounts:pair.map(x=>x.rows.length),publicationApproved:false}));
})().catch(e=>{console.error('SPECIAL_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
