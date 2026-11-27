'use strict';
// Encrypted observations, not a publication catalog. A 32-byte key is
// supplied outside Git; never store the raw JSON, titles or private key.
const crypto=require('node:crypto');
const {canonical,digest}=require('./event_release_gate.cjs');
const SHA=/^[a-f0-9]{64}$/,ID=/^[1-9]\d{4}$/;
const fail=m=>{throw Error('D069 encrypted review archive: '+m);};
const same=(a,b)=>canonical(a)===canonical(b);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===keys.split(',').sort().join(',');
function keyFromEnv(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))fail('missing or invalid 32-byte archive key');
 const k=Buffer.from(value,'base64');
 if(k.length!==32||k.toString('base64')!==value)fail('invalid key encoding');
 return k;
}
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
function aad(row){return Buffer.from('d069-review-packet-v1:'+row.cardId+':'+row.packetSha256,'utf8');}
function seal(packet,row,key){
 scope(packet,row);
 if(!Buffer.isBuffer(key)||key.length!==32)fail('missing archive key');
 const raw=Buffer.from(JSON.stringify(packet),'utf8');
 if(raw.length>512000)fail('packet size');
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(aad(row));
 const encrypted=Buffer.concat([cipher.update(raw),cipher.final()]);
 return {schemaVersion:1,dataKind:'d069-encrypted-review-packet',cardId:row.cardId,packetSha256:row.packetSha256,
  iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')};
}
function open(envelope,row,key){
 if(!exact(envelope,'schemaVersion,dataKind,cardId,packetSha256,iv,tag,ciphertext')||envelope.schemaVersion!==1||
    envelope.dataKind!=='d069-encrypted-review-packet'||envelope.cardId!==row.cardId||envelope.packetSha256!==row.packetSha256||
    !Buffer.isBuffer(key)||key.length!==32||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>683000)fail('archive scope');
 let packet;
 try{
  const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');
  if(iv.length!==12||tag.length!==16)fail('archive nonce/tag');
  const d=crypto.createDecipheriv('aes-256-gcm',key,iv);d.setAAD(aad(row));d.setAuthTag(tag);
  packet=JSON.parse(Buffer.concat([d.update(Buffer.from(envelope.ciphertext,'base64')),d.final()]).toString('utf8'));
 }catch{fail('decryption/authentication failed');}
 return scope(packet,row);
}
module.exports={keyFromEnv,scope,pathFor,seal,open};
