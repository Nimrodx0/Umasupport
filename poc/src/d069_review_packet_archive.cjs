'use strict';
// Independent factual packet only: no raw JSON, source choice text or images.
const {canonical,digest}=require('./event_release_gate.cjs');
const SHA=/^[a-f0-9]{64}$/,ID=/^[1-9]\d{4}$/;
const fail=m=>{throw Error('D072 factual review archive: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.split(',').sort().join(',');
function scope(packet,row){
 if(!exact(packet,'dataKind,schemaVersion,cardId,sourceUrl,buildId,bodySha256,sourcePin,existingCatalogSha256,events,status,reasonCodes,sourceSiteTextCopied,publicationApproved')||
    packet.dataKind!=='d069-json-review-packet'||packet.schemaVersion!==1||packet.sourceSiteTextCopied!==false||packet.publicationApproved!==false||
    !SHA.test(packet.bodySha256||'')||!SHA.test(packet.existingCatalogSha256||'')||
    !Array.isArray(packet.events)||!packet.events.length||packet.events.length>100||
    !Array.isArray(packet.reasonCodes)||packet.reasonCodes.some(x=>typeof x!=='string'||!/^[a-z-]{1,80}$/.test(x))||
    !ID.test(row?.cardId||'')||packet.cardId!==row.cardId||!same(packet.sourcePin,row.sourcePin)||
    row.packetSha256!==digest(packet)||!['awaiting-fact-review','held'].includes(row.status)||
    packet.status!==(row.status==='held'?'held':'awaiting-independent-fact-review'))fail('packet receipt mismatch');
 require('./official_gametora_card_json.cjs').cardJsonUrl(packet);
 for(const e of packet.events){
  if(!exact(e,'sourceEventId,category,categoryOrdinal,titleSha256,exactTitleSha256,selection,groups')||
     !Number.isSafeInteger(e.sourceEventId)||e.sourceEventId<1||!Number.isSafeInteger(e.categoryOrdinal)||e.categoryOrdinal<1||
     !['random','arrows','special','dates'].includes(e.category)||!SHA.test(e.titleSha256||'')||!SHA.test(e.exactTitleSha256||'')||
     ![null,'auto','choice'].includes(e.selection)||!Array.isArray(e.groups)||!e.groups.length||e.groups.length>20)fail('event metadata');
  for(const g of e.groups){
   if(!exact(g,'ordinal,labelPresent,routes')||!Number.isSafeInteger(g.ordinal)||g.ordinal<1||typeof g.labelPresent!=='boolean'||!Array.isArray(g.routes)||!g.routes.length||g.routes.length>120)fail('group metadata');
   for(const r of g.routes){
    if(!exact(r,'ordinal,hints,terminal,nonSkillCount,unresolved')||!Number.isSafeInteger(r.ordinal)||r.ordinal<1||
       typeof r.terminal!=='boolean'||!Number.isSafeInteger(r.nonSkillCount)||r.nonSkillCount<0||
       !Array.isArray(r.hints)||r.hints.length>120||!Array.isArray(r.unresolved)||r.unresolved.length>120)fail('route metadata');
    for(const h of r.hints)if(!exact(h,'skillId,level,sourceOrdinal')||typeof h.skillId!=='string'||!/^skill:[1-9]\d{0,12}$/.test(h.skillId)||!Number.isSafeInteger(h.level)||h.level<1||h.level>10||!Number.isSafeInteger(h.sourceOrdinal)||h.sourceOrdinal<1)fail('hint metadata');
    for(const u of r.unresolved)if(!exact(u,'code,sourceOrdinal,reason')||typeof u.code!=='string'||!/^[a-z0-9_]{1,20}$/.test(u.code)||typeof u.reason!=='string'||!/^[a-z-]{1,80}$/.test(u.reason)||!Number.isSafeInteger(u.sourceOrdinal)||u.sourceOrdinal<1)fail('unresolved metadata');
   }
  }
 }
 return packet;
}
function pathFor(row){
 if(!ID.test(row?.cardId||'')||!SHA.test(row?.packetSha256||''))fail('receipt path');
 return '.d069/review-packets/'+row.cardId+'/'+row.packetSha256+'.json';
}

function record(packet,row){
 scope(packet,row);
 return {schemaVersion:1,dataKind:'d072-factual-review-packet',packet};
}
function open(value,row){
 if(!exact(value,'schemaVersion,dataKind,packet')||value.schemaVersion!==1||value.dataKind!=='d072-factual-review-packet')fail('archive shape');
 return scope(value.packet,row);
}
module.exports={scope,pathFor,record,open};
