'use strict';
// Shared expected public release totals. Event count is derived from the
// independently reviewed ledger, never from the runtime under test. Verify
// the exact cohort and individual content hashes before using this fixture.
// Historical cohort and release-specific tests must keep their fixed pins.
const assert=require('node:assert/strict');
const catalog=require('../data/reviewed_events.v1.json');
const {forCatalog}=require('../src/current_public_event_approvals.cjs');
const {verifyRelease}=require('../src/event_release_gate.cjs');
const ledger=forCatalog(catalog);
const individualEntries=ledger.entries.length;
const events=(ledger.cohorts||[]).reduce((n,c)=>n+c.expectedEvents,individualEntries);
const verified=verifyRelease(catalog,ledger);
assert.equal(verified.publicEvents,events);
assert.equal(verified.reviewedEvents,events);
assert.equal(verified.publicCards,catalog.cards.length);
module.exports=Object.freeze({events,cards:catalog.cards.length,individualEntries});
