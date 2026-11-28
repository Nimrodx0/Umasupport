'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {checkRobots,listingLinks,createObserver}=require('../src/d069_card_json_transport.cjs');
const base='https://gametora.com',list=base+'/ja/umamusume/supports',url=id=>list+'/'+id+'-example';
const known=Array.from({length:120},(_,i)=>String(10000+i));
const listing=known.concat(['39999','39998']).map(id=>'<a href="'+url(id)+'">x</a>').join('');
const boot=id=>'<script id="__NEXT_DATA__">'+JSON.stringify({page:'/ja/umamusume/supports/[id]',buildId:'example',props:{pageProps:{sourceData:{support_id:Number(id)}}}})+'</script>';
const json=id=>JSON.stringify({pageProps:{sourceData:{support_id:Number(id)},eventData:{ja:JSON.stringify({random:[{i:1,n:'架空',c:[{o:'',r:[{t:'pt',v:'+5'}]}]}]})}}});
const jsonUrl=id=>base+'/_next/data/example/ja/umamusume/supports/'+id+'-example.json';
function fixture(overrides={}){
 const calls=[],delays=[];
 const rows={[base+'/robots.txt']:['text/plain','User-agent: *\nDisallow:'],[list]:['text/html',listing],[url('39999')]:['text/html',boot('39999')],[jsonUrl('39999')]:['application/json',json('39999')],[jsonUrl('39998')]:['application/json',json('39998')],...overrides};
 const observe=createObserver({manualAuthorized:true,knownIds:known,sleep:async ms=>delays.push(ms),fetchImpl:async(u,opt)=>{
  calls.push(u);a.equal(opt.redirect,'manual');a.equal(opt.credentials,'omit');a.equal(opt.method,'GET');
  const [type,body,status=200,actual=u]=rows[u]||['text/plain','bad',404];
  const r=new Response(body,{status,headers:{'content-type':type}});Object.defineProperty(r,'url',{value:actual});return r;
 }});
 return {observe,calls,delays};
}
test('bounded sequential reads use listing, one bootstrap, two JSONs and no guessed URL',async()=>{
 const f=fixture(),r=await f.observe(['39999','39998']);
 a.deepEqual(f.calls,[base+'/robots.txt',list,url('39999'),jsonUrl('39999'),jsonUrl('39998')]);
 a.deepEqual(f.delays,[6000,6000,6000,6000]);a.equal(r.length,2);a.ok(r.every(x=>x.status==='json'));
});
test('no targets means no site access; missing link remains not-listed',async()=>{
 const f=fixture();a.deepEqual(await f.observe([]),[]);a.deepEqual(f.calls,[]);
 const r=await f.observe(['39997']);a.deepEqual(r,[{cardId:'39997',status:'not-listed'}]);a.equal(f.calls.length,2);
});
test('fail closed on partial listing, robots wildcard, redirects, refusal and wrong card',async()=>{
 a.throws(()=>createObserver({knownIds:known}),/manual/);
 a.throws(()=>listingLinks('<script>'+listing+'</script>',known),/incomplete/);
 a.throws(()=>checkRobots('User-agent: *\nDisallow: /_next/*/supports/','/_next/data/x/supports/'),e=>require('../src/d069_card_json_transport.cjs').failureCode(e)==='source-refused');
 const tests=[
  {[list]:['text/html','<a href="'+url('39999')+'">x</a>']},
  {[base+'/robots.txt']:['text/plain','User-agent: *\nDisallow: /_next/']},
  {[jsonUrl('39999')]:['application/json','{}',429]},
  {[jsonUrl('39999')]:['application/json','{}',302]},
  {[jsonUrl('39999')]:['application/json',json('39998')]},
 ];
 for(const x of tests){const f=fixture(x);await a.rejects(f.observe(['39999','39998']));a.ok(!f.calls.includes(jsonUrl('39998')));}
});

test('transport records refusal separately from a network error without message leakage',async()=>{
 const {failureCode}=require('../src/d069_card_json_transport.cjs');
 const f=fixture({[jsonUrl('39999')]:['application/json','{}',429]});
 await a.rejects(f.observe(['39999']),e=>failureCode(e)==='rate-limited');
 const o=createObserver({manualAuthorized:true,knownIds:known,sleep:async()=>{},fetchImpl:async()=>{throw new TypeError('private network detail');}});
 await a.rejects(o(['39999']),e=>failureCode(e)==='network-transient'&&!e.message.includes('private'));
 a.equal(failureCode(Error('unclassified')),'unclassified');
});

test('robots only applies matching product group, longest rule and Allow tie',()=>{
 a.doesNotThrow(()=>checkRobots('User-agent: otherbot\nDisallow: /\nUser-agent: *\nDisallow: /private','/public'));
 a.doesNotThrow(()=>checkRobots('User-agent: *\nDisallow: /\nAllow: /public','/public/file'));
 a.doesNotThrow(()=>checkRobots('User-agent: *\nDisallow: /\nUser-agent: Umasupport-readonly-card-json-probe\nAllow: /','/public'));
 a.throws(()=>checkRobots('User-agent: *\nAllow: /\nUser-agent: Umasupport-readonly-card-json-probe\nDisallow: /public','/public'));
 a.doesNotThrow(()=>checkRobots('User-agent: *\nDisallow: /public\nAllow: /public','/public'));
 a.throws(()=>checkRobots('User-agent: *\nDisallow: /%7Euser','/~user'));
});
