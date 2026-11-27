'use strict';
// Research-only immutable input; do not use in the product or release gate.
// This is the project's already-published event catalog, not upstream source data.
const crypto=require('node:crypto');
const fs=require('node:fs');
const REVISION='441046b7e2d2247c1c8ea534e9bf0b1f3ef9edd0';
const GIT_BLOB='e7ded1b13acd8406f4efa9c651ab66f8c486b140';
const SHA256='c46dcd6eb2adb462c823d0fb4a36ec38e4eda3299759b51dcb5af9c391556f86';
const URL='https://raw.githubusercontent.com/Nimrodx0/Umasupport/'+REVISION+'/poc/data/reviewed_events.v1.json';
const PIN=Object.freeze({revision:REVISION,gitBlob:GIT_BLOB,sha256:SHA256,cards:559,events:2487});
function verifyFixedEventText(input){
 const bytes=Buffer.isBuffer(input)?input:Buffer.from(input,'utf8');
 const sha=crypto.createHash('sha256').update(bytes).digest('hex');
 const blob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(sha!==SHA256||blob!==GIT_BLOB)throw Error('Fixed research event catalog SHA mismatch');
 const text=bytes.toString('utf8'),data=JSON.parse(text);
 if(data.schemaVersion!==1||!Array.isArray(data.cards)||data.cards.length!==PIN.cards||
    data.cards.reduce((n,c)=>n+c.events.length,0)!==PIN.events)
  throw Error('Fixed research event catalog population mismatch');
 return text;
}
async function loadFixedEventText(fetcher=fetch){
 const response=await fetcher(URL,{signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Fixed research event catalog HTTP '+response.status);
 return verifyFixedEventText(Buffer.from(await response.arrayBuffer()));
}
async function main(args){
 if(args.length!==1)throw Error('usage: node poc/tools/fixed_research_event_catalog.cjs <temporary-output-path>');
 const path=require('node:path'),os=require('node:os');
 const dest=path.resolve(args[0]),root=path.resolve(os.tmpdir());
 if(!dest.startsWith(root+path.sep))throw Error('Fixed research catalog output must be temporary');
 fs.writeFileSync(dest,await loadFixedEventText(),{flag:'wx'});
 console.log('FIXED_RESEARCH_EVENT_CATALOG='+JSON.stringify(PIN));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={PIN,URL,verifyFixedEventText,loadFixedEventText};
