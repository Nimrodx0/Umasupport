'use strict';
const crypto=require('node:crypto');
const {robotsDisallows}=require('../src/official_gametora_probe.cjs');
const {headingFingerprint}=require('../src/direct_event_fact_review.cjs');
const catalog=require('../data/reviewed_events.v1.json');
const origin='https://gametora.com';
const versions={'training_events/ssr':'fa74f9c4','training_events/shared':'b2a8aa8f','training_events/friend':'3e027684','dict/te_names_ja':'8e06334e','dict/evrew':'a687fca9'};
const hashes=['3c582bbac14c012bb9468d99c5cb54f3e288279cc0f7f744e7799891de3b7e6c','b721b7ff75a78adb219c6e321b7edc0de1175c1dc7e05700e2342361a271327d','c84eb586aecf42914e87f1c519d0527ad5a583faffc8242170c93f4ded8457d7','027a1da18ec05e24d279618a08277eae415dea8966ddf78c76d233532cb3bcb5','da663fff09d4530fcc6b9094504196ae34d4863e27c3e00fd09bd8f3897a5062'];
const domHints=[['201142:1'],['201342:2'],['200512:1','200511:3'],['200762:1'],[]];
const domScalar=[2,9,10,3,7];
const domIds=['003','004','005','001','002'];
const bag=a=>a.slice().sort().join('|');
const fact=(id,lv)=>String(id).replace(/^skill:/,'')+':'+Number(lv);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const leaves=e=>(e.type==='auto'?[e]:e.choices||[]).flatMap(g=>g.outcomes||[g]);
const oldHints=e=>leaves(e).flatMap(o=>(o.rewards||[]).filter(r=>r.kind==='hint'||r.kind===undefined&&Number.isInteger(r.level)).map(r=>fact(r.skillId,r.level)));
const rootShape=v=>Array.isArray(v)?{type:'array',length:v.length,first:v.length?Array.isArray(v[0])?{type:'array',length:v[0].length}:typeof v[0]:null}:v&&typeof v==='object'?{type:'object',count:Object.keys(v).length}:typeof v;
const nameHash=v=>typeof v==='string'&&v.trim()?headingFingerprint(v).sha256:null;
const rowEvent=x=>Array.isArray(x)&&x.length>=3&&Number.isSafeInteger(x[0])&&Array.isArray(x[1])&&Number.isSafeInteger(x[2]);
function findEvents(v,out=[]){if(rowEvent(v)){out.push(v);return out;}if(Array.isArray(v))for(const x of v)findEvents(x,out);return out;}
(async()=>{
 const rr=await fetch(origin+'/robots.txt',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(rr.status!==200)throw Error('robots unavailable');const robots=await rr.text(),docs={};
 for(const [key,version] of Object.entries(versions)){
  const path='/data/umamusume/'+key+'.'+version+'.json';
  if(robotsDisallows(robots,path).length)throw Error('robots denied');
  await new Promise(r=>setTimeout(r,6000));
  const res=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(res.status!==200||!String(res.headers.get('content-type')).includes('json'))throw Error('HTTP '+res.status+'; stop');
  const b=Buffer.from(await res.arrayBuffer());
  if(b.length>4*1024*1024||!digest(b).startsWith(version))throw Error('version/size mismatch');
  docs[key]=JSON.parse(b);
  console.log('DECODE_INPUT='+JSON.stringify({key,version,bytes:b.length,sha256:digest(b)}));
 }
 const names=docs['dict/te_names_ja'],dict=docs['dict/evrew'];
 const old=catalog.cards.find(c=>c.cardId==='30001');
 const oldParity=domIds.map((suffix,i)=>{
  const e=old.events.find(e=>e.id==='gt-30001-event-'+suffix);
  if(!e)throw Error('missing approved event');
  const h=oldHints(e),scalar=leaves(e).reduce((n,r)=>n+(r.effects||[]).length,0);
  return {ordinal:i+1,oldId:e.id,oldHints:h,htmlHints:domHints[i],hintMatch:bag(h)===bag(domHints[i]),oldScalarCount:scalar,htmlScalarCount:domScalar[i]};
 });
 console.log('DECODE_OLD_PARITY='+JSON.stringify(oldParity));
 const rows=Object.entries(names);
 const matches=hashes.map((h,i)=>({htmlOrdinal:i+1,matchingNameRefs:rows.filter(([,v])=>nameHash(v)===h).map(([k])=>k)}));
 const scopes=[
  ['ssr30001',docs['training_events/ssr'].filter(r=>String(r?.[0])==='30001')],
  ['shared1001',docs['training_events/shared'].filter(r=>String(r?.[0])==='1001')],
  ['friend9005',docs['training_events/friend'].filter(r=>String(r?.[0])==='9005')]
 ];
 console.log('DECODE_NAME_MAP='+JSON.stringify({root:rootShape(names),firstTypes:names.slice(0,6).map(rootShape),matches,scopes:scopes.map(([k,v])=>({key:k,rows:v.length,shape:rootShape(v[0])}))}));
 for(const [scope,records] of scopes){
  const events=findEvents(records);
  console.log('DECODE_EVENTS='+JSON.stringify({scope,events:events.map(e=>{
   const name=names[e[0]],hash=nameHash(name),m=hashes.indexOf(hash);
   const refs=e[1].flatMap(g=>Array.isArray(g?.[1])?g[1]:[]);
   const hints=refs.flatMap(k=>{const r=dict[k];return Array.isArray(r)&&r[0]==='sk'?[fact(r[2],r[1])]:[];});
   return {storyId:e[2],nameRef:e[0],nameType:rootShape(name),nameHash:hash,htmlOrdinal:m<0?null:m+1,groups:e[1].length,rewardRefCount:refs.length,hints,htmlHints:m<0?null:domHints[m],hintMatch:m<0?null:bag(hints)===bag(domHints[m])};
  })}));
 }
})().catch(e=>{console.error('DECODE_STOP='+String(e.message).slice(0,180));process.exitCode=1;});
