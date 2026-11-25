'use strict';
// Join the existing verified application skill identities, never a new
// name-only join. Acquisition candidates are not acquired skills or scores.
const a=require('node:assert/strict'),crypto=require('node:crypto');
const routes=require('./p3_card_acquisition_routes.cjs'),core=require('./core.js');
const STATUS='P3.3b-all-fixed-card-direct-candidates-with-research-only-evidence';
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function audit(app,logic,supplement){
 a.equal(logic.status,'P3.4e-context-specific-source-logic-equivalence-candidate-only');
 a.equal(supplement.status,'P2.58-D051-interim-research-receipt-no-formal-label');
 a.equal(logic.sourceSupplementSHA256,digest(supplement));
 a.equal(app.meta.eventStatus,'reviewed-partial');a(app.meta.reviewedEventRecords>0);
 const bySkill=new Map(logic.rows.map(x=>[x.appSkillId,x]));
 const bySource=new Map(supplement.rows.map(x=>[x.appSkillId,x]));
 a.equal(bySkill.size,app.skills.length);a.equal(bySource.size,app.skills.length);
 a.equal(logic.rows.length,app.skills.length);a.equal(supplement.rows.length,app.skills.length);
 for(const sk of app.skills){
  a.equal(app.skillById[sk.id],sk);
  const l=bySkill.get(sk.id),s=bySource.get(sk.id);a(l&&s);a.equal(l.sourceNumericId,s.sourceNumericId);
  a.equal(l.formalLabel,null);a.equal(s.formalLabel,null);
  const p=sk.activationProfile;
  a.equal(p.status==='source-structure'?p.sourceNumericId:null,s.sourceNumericId,'source identity '+sk.id);
 }
 const counters={cards:0,skills:app.skills.length,pairs:0,normalHintRecords:0,approvedEventRecords:0,
  matchedPairs:0,missingSourcePairs:0,candidatePairs:0,cardCountsByDisposition:{},pairCountsByDisposition:{},
  cardsWithNoRecordedDirectCandidate:0,cardsWithLogicCandidate:0,distinctSkillsWithDirectCandidate:0};
 const cards=[],seen=new Set(),skillsWithRoute=new Set();
 for(const card of app.cards){
  a(!seen.has(card.id));seen.add(card.id);a.equal(app.cardById[card.id],card);
  a(card.sourceStatus?.startsWith('verified_hints'));a(Array.isArray(card.events));
  const cardRow={cardId:card.id,skills:[],stageSummaries:[],cardScore:null,eligibleForP3CardScoring:false};
  const routeKeys=new Set(),dispositions=new Set();
  const lookup=new Map();
  for(const sk of app.skills){
   const direct=routes.directCandidates(card,sk.id);if(!direct.length)continue;
   const l=bySkill.get(sk.id),s=bySource.get(sk.id);
   const disposition=l.disposition;
   for(const x of direct){
    const k=JSON.stringify([x.appSkillId,x.source,x.eventId??null,x.choiceId??null,x.outcomeId??null,x.rewardIndex??null]);
    a(!routeKeys.has(k),'duplicate direct candidate identity');routeKeys.add(k);
    if(x.source==='normal-hint')counters.normalHintRecords++;else if(x.source==='approved-event')counters.approvedEventRecords++;else throw Error('unknown acquisition route');
   }
   const item={appSkillId:sk.id,sourceNumericId:s.sourceNumericId,conditionResearchDisposition:disposition,
    scopeCandidate:s.sourceLogicCandidateForFurtherReview??null,directCandidates:direct,
    formalLabel:null,eligibleForP3CardScoring:false,cardScore:null};
   lookup.set(sk.id,item);cardRow.skills.push(item);skillsWithRoute.add(sk.id);
   counters.pairs++;dispositions.add(disposition);
   counters.pairCountsByDisposition[disposition]=(counters.pairCountsByDisposition[disposition]||0)+1;
   if(s.sourceNumericId===null)counters.missingSourcePairs++;else counters.matchedPairs++;
   if(item.scopeCandidate)counters.candidatePairs++;
  }
  // Check every recorded hint or positive event reward has a known app ID.
  // In addition, independently compare the live default-selection reachability
  // results at all five stages with the complete raw candidate inventory.
  for(const ev of card.events){
   const parts=ev.type==='choice'?(ev.choices??[]):[ev];
   for(const part of parts)for(const leaf of part.outcomes?.length?part.outcomes:[part])
    for(const reward of leaf.rewards??[])if(reward.kind!=='negative')a(lookup.has(reward.skillId),'missing event route '+card.id);
  }
  for(const stage of routes.STAGES){
   const hints=card.hintsByStage[String(stage)];a(Array.isArray(hints));
   const expected=[...new Set(hints)].sort();
   const directHints=cardRow.skills.filter(s=>s.directCandidates.some(r=>r.source==='normal-hint'&&r.stages.includes(stage))).map(s=>s.appSkillId).sort();
   a.deepEqual(directHints,expected);
   const def=core.directRoutes(card,{stage,choices:{},outcomes:{}});
   for(const p of def){
    const x=lookup.get(p.skillId);a(x,'unregistered live candidate');
    a(x.directCandidates.some(r=>p.source==='hint'?r.source==='normal-hint'&&r.stages.includes(stage):r.source==='approved-event'&&r.eventId===p.eventId));
   }
   a.deepEqual([...new Set(def.filter(r=>r.source==='hint').map(r=>r.skillId))].sort(),expected);
   cardRow.stageSummaries.push({stage,normalHintCandidates:expected.length,
    defaultSelectionDirectCandidateSkills:new Set(def.map(r=>r.skillId)).size,
    defaultSelectionIsNotAllChoiceAlternatives:true});
  }
  for(const d of dispositions)counters.cardCountsByDisposition[d]=(counters.cardCountsByDisposition[d]||0)+1;
  if(!cardRow.skills.length)counters.cardsWithNoRecordedDirectCandidate++;
  if(cardRow.skills.some(s=>s.scopeCandidate))counters.cardsWithLogicCandidate++;
  counters.cards++;cards.push(cardRow);
 }
 counters.distinctSkillsWithDirectCandidate=skillsWithRoute.size;
 a.equal(counters.matchedPairs+counters.missingSourcePairs,counters.pairs);
 a.equal(Object.values(counters.pairCountsByDisposition).reduce((x,y)=>x+y,0),counters.pairs);
 return {status:STATUS,logicSHA256:digest(logic),summary:counters,cards,
  boundary:{directRoutesOnly:true,unselectedAlternativesNotGuaranteed:true,noNameOnlyNewJoin:true,
   missingIsNotZero:true,indirectGoldWhiteNotEvaluated:true,formalLabels:0,cardScores:0}};
}
module.exports={STATUS,audit};
