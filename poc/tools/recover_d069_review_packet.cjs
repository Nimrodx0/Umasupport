#!/usr/bin/env node
'use strict';
// Read an already downloaded encrypted envelope and ledger; never network.
const fs=require('node:fs');
const {privatePath}=require('./run_direct_new_card_intake.cjs');
const {verify}=require('../src/d069_json_attempt_ledger.cjs');
const {open,keyFromEnv}=require('../src/d069_review_packet_archive.cjs');
function main(args){
 if(args.length!==4||!/^[1-9]\d{4}$/.test(args[2]))throw Error('usage: encrypted-packet.json attempt-ledger.json cardId /outside/repo/private-packet.json');
 const destination=privatePath(args[3]),ledger=verify(JSON.parse(fs.readFileSync(args[1],'utf8')));
 const row=ledger.rows.find(r=>r.cardId===args[2]);if(!row||!row.packetSha256)throw Error('receipt missing');
 const packet=open(JSON.parse(fs.readFileSync(args[0],'utf8')),row,keyFromEnv(process.env.D069_ARCHIVE_KEY));
 fs.writeFileSync(destination,JSON.stringify(packet,null,2)+'\n',{flag:'wx',mode:0o600});
 process.stdout.write('D069 private packet recovered; no publication approval\n');
}
if(require.main===module)try{main(process.argv.slice(2));}catch{process.stderr.write('D069 packet recovery failed; check key, receipt and local output scope\n');process.exitCode=1;}
module.exports={main};
