'use strict';
const crypto=require('node:crypto'),fs=require('node:fs');
function schema(v){
 if(v===null)return 'null';
 if(Array.isArray(v))return 'array('+v.length+')';
 if(typeof v==='object')return 'object('+Object.keys(v).length+')';
 return typeof v;
}
function probe(root){
 let groups=[];
 if(Array.isArray(root))groups.push({path:'$',entries:root});
 else if(root&&typeof root==='object'){
  for(const [name,value]of Object.entries(root)){
   if(Array.isArray(value))groups.push({path:'$.'+name,entries:value});
   else if(value&&typeof value==='object'){
    const arr=Object.values(value);
    if(arr.length>5&&arr.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))
      groups.push({path:'$.'+name,entries:arr});
   }
  }
  if(groups.length===0&&Object.keys(root).length>5){
   const arr=Object.values(root);
   if(arr.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))groups.push({path:'$',entries:arr});
  }
 }
 return {rootType:schema(root),rootKeys:Array.isArray(root)?[]:Object.keys(root||{}).slice(0,50),
  arrays:groups.map(g=>({path:g.path,records:g.entries.length,
   fieldTypes:Object.fromEntries(Object.keys(g.entries[0]||{}).map(k=>[k,schema(g.entries[0][k])])),
   firstTwoHintFields:g.entries.slice(0,2).map(row=>Object.fromEntries(
    Object.entries(row).filter(([k])=>/skill|hint|rarity|id|type|card|support/i.test(k)).map(([k,v])=>[k,schema(v)])
   ))}))};
}
function main(){
 const buf=fs.readFileSync(process.argv[2]);const result=probe(JSON.parse(buf.toString('utf8')));
 console.log(JSON.stringify({source:'dareuma/umamusume-deck-build-tool release cards.json',
  sha256:crypto.createHash('sha256').update(buf).digest('hex'),bytes:buf.length, ...result},null,2));
}
if(require.main===module)main();
module.exports={probe};
