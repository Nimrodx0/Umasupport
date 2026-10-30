'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {fixture}=require('./private_local_2512_fixture.cjs');
const {makeBundle,accept}=require('../src/phase2_private_local_real_acceptance.cjs');
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('the same local export bundle serves the actual full-catalog acceptance and the file parser',async()=>{
 const f=fixture(),before=JSON.stringify(f.model);
 const bundle=makeBundle(f.bundle.catalog);
 assert.equal(bundle.dataKind,f.bundle.dataKind);
 assert.equal(bundle.catalogSha256,f.bundle.catalogSha256);
 assert.equal(bundle.sourceRevision,f.bundle.sourceRevision);
 const actual=await accept({catalog:f.bundle.catalog,model:f.model,
  skillText:f.skillText},{strict:true});
 assert.equal(actual.status,'REAL_2512_PRIVATE_LOCAL_IMPORT_PASS');
 assert.equal(actual.cards,563);
 assert.equal(actual.events,2512);
 assert.equal(actual.autoEvents,2511);
 assert.equal(actual.choiceEvents,1);
 assert.equal(actual.selectedEventRoutes,1);
 assert.equal(actual.initialEventRoutes,0);
 assert.equal(actual.catalogSha256,bundle.catalogSha256);
 assert.equal(actual.corruptRealBundleRejected,true);
 assert.equal(actual.publicEventsPublished,0);
 assert.equal(actual.privateEventCatalogSerializedToDisk,false);
 assert.equal(JSON.stringify(f.model),before);
});
test('the real acceptance rejects a missing source card or incorrect source pin before serializing',async()=>{
 const f=fixture();
 f.bundle.catalog.cards.pop();
 assert.throws(()=>makeBundle(f.bundle.catalog),/固定母数/);
 f.bundle.catalog.cards.push({cardId:'30001',coverageStatus:'partial',events:[]});
 assert.throws(()=>makeBundle(f.bundle.catalog),/固定母数/);
});
