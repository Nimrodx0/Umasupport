'use strict';
/*
 * Resolve the active public event approval ledger from the ACTUAL catalog
 * population. Do not confuse the legacy empty V1 ledger with the approved
 * GT-derived factual cohort. Never auto-grant a review to arbitrary records:
 * verifyRelease still checks exact set membership and content hashes.
 */
const empty=require('../config/event-release-approvals.v1.json');
const gt2487=require('../config/event-release-approvals.gt2487.v2.json');
function forCatalog(catalog){
 if(!catalog||catalog.schemaVersion!==1||!Array.isArray(catalog.cards))
  throw Error('公開承認台帳: 対象カタログが不正');
 const hasEvents=catalog.cards.some(c=>Array.isArray(c.events)&&c.events.length);
 return hasEvents?gt2487:empty;
}
module.exports={forCatalog};
