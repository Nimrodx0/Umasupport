'use strict';
/*
 * Phase 2②: compare numeric skill-hint statements of two editorial data families.
 * The report is not a game-skill grant table or proof of outcome identity.
 * Do not export raw event titles, effect prose, source JSON or choice labels.
 */
const fs=require('node:fs');
const path=require('node:path');
const {flattenRoutes,readDocuments}=require('./audit_gametora_branches.cjs');
const {sourceInventory}=require('./build_whole_event_index.cjs');
const {verifyDerived}=require('../src/checker_explicit_result_extract.cjs');

function fail(s){throw Error('Phase2 reward comparison: '+s);}
function numericHint(h){
 if(h.skillId===undefined||h.skillId===null)return {unresolved:true};
 const id=String(h.skillId),level=h.level;
 if(!/^\d+$/.test(id))fail('invalid Checker skill ID');
 if(h.levelMin!==undefined||h.levelMax!==undefined)return {ranged:true};
 if(!Number.isInteger(level)||level<1||level>10)fail('invalid Checker level');
 return {token:id+':'+level};
}
function sourceHint(e){
 if(e.type!=='skill_hint')return {unsupported:e.type==='skill_hint_or'||e.type==='obtain_skill'};
 const id=String(e.skill_id??''),value=String(e.value??'');
 if(!/^\d+$/.test(id)||!/^\+?[1-9]\d?$/.test(value))return {unresolved:true};
 return {token:id+':'+Number(value)};
}
function bag(tokens){return tokens.slice().sort().join('|');}
function compareChoiceLabel(a,b){
 const norm=x=>String(x??'').normalize('NFKC').replace(/\s+/g,' ').trim();
 const loose=x=>norm(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
 const l=norm(a),r=norm(b);
 if(!l||!r)return 'label-not-comparable';
 if(l===r)return 'label-exact-provisional';
 if(loose(l)===loose(r))return 'label-typographic-provisional';
 return 'label-disagreement';
}
function buildCheckerLabelIndex({checkerRaw,rosterText,aliases}){
 const {inventory,model,activeAliases}=sourceInventory({checker:checkerRaw,rosterText,aliases});
 const byCard=new Map();
 for(const card of inventory.cards){
  const modelCard=model.cardById?.[card.cardId]||model.cards.find(x=>x.id===card.cardId);
  if(!modelCard)fail('no canonical card '+card.cardId);
  const target=card.join==='reviewed-name-alias'?activeAliases[card.cardId]:modelCard.name;
  const normalized=s=>String(s).normalize('NFKC').replace(/\s+/g,' ').trim();
  const hits=Object.entries(checkerRaw.Skills[card.rarity]).filter(([name])=>normalized(name)===normalized(target));
  if(hits.length!==1||hits[0][1].Events.length!==card.events.length)
   fail('Checker identity mismatch '+card.cardId);
  byCard.set(card.cardId,hits[0][1].Events.map((ev,i)=>{
   const choices=Object.values(ev)[0];
   if(!Array.isArray(choices)||choices.length!==card.events[i].optionCount)
    fail('Checker choice count mismatch '+card.cardId+':'+i);
   return choices.map(x=>x.Title);
  }));
 }
 return byCard;
}
const PRIOR=new Set(['both_previous_chain_good','one_previous_chain_good','both_previous_chain_bad','result_good','result_bad','result_average','success','fail']);
function analyzeChoice(checker,source){
 if(!checker||!Array.isArray(checker.results)||!source||typeof source!=='object')
  fail('malformed choice');
 const checkerBranches=checker.results.map(result=>{
  if(!Array.isArray(result.skillHints))fail('malformed Checker outcome');
  return result.skillHints.map(numericHint);
 });
 const groups=flattenRoutes(source);
 const sourceBranches=groups.map(group=>group.effects.map(sourceHint));
 const checkerTokens=checkerBranches.flat().filter(x=>x.token).map(x=>x.token);
 const sourceTokens=sourceBranches.flat().filter(x=>x.token).map(x=>x.token);
 const checkerUnresolved=checkerBranches.flat().filter(x=>x.unresolved).length;
 const checkerRanged=checkerBranches.flat().filter(x=>x.ranged).length;
 const sourceUnresolved=sourceBranches.flat().filter(x=>x.unresolved).length;
 const sourceUnsupported=sourceBranches.flat().filter(x=>x.unsupported).length;
 const conditionalSource=groups.some(x=>x.when?.length||
  x.effects.some(e=>PRIOR.has(e.type)));
 const checkerConditional=checker.diagnostics?.includes('RESULT_REQUIRES_PRIOR_CONTEXT')||false;
 // Presence of skill hints in one record is not proof of absence in the other.
 const bothHaveHints=checkerTokens.length>0&&sourceTokens.length>0;
 let status;
 if(checkerRanged||checkerUnresolved||sourceUnresolved||sourceUnsupported)
  status='unresolved-hint-representation';
 else if(conditionalSource||checkerConditional)
  status='prior-conditional-needs-review';
 else if(!checkerTokens.length&&!sourceTokens.length)
  status='no-numeric-hints-observed';
 else if(!checkerTokens.length)
  status='source-only-numeric-hints';
 else if(!sourceTokens.length)
  status='checker-only-numeric-hints';
 else if(bag(checkerTokens)===bag(sourceTokens))
  status='numeric-multiset-agreement';
 else status='numeric-multiset-disagreement';
 const explicit=checker.structure==='explicit-result-headings';
 const sameBranches=checkerBranches.length===sourceBranches.length;
 // Even equal unordered outcome signatures never prove success/failure labels map.
 const sortedSignature=(results)=>results.map(part=>
  bag(part.filter(x=>x.token).map(x=>x.token))).sort().join('||');
 const outcomeEvidence=explicit&&sourceBranches.length>1&&sameBranches&&
  !checkerUnresolved&&!checkerRanged&&!sourceUnresolved&&!sourceUnsupported&&
  !conditionalSource&&!checkerConditional?
  (sortedSignature(checkerBranches)===sortedSignature(sourceBranches)?
   'unlabeled-outcome-signature-agreement':'unlabeled-outcome-signature-disagreement'):
  'not-comparable';
 return {status,outcomeEvidence,checkerOutcomeCount:checkerBranches.length,
  sourceOutcomeCount:sourceBranches.length,checkerExplicit:explicit,
  sourceMultipleOutcomes:sourceBranches.length>1,
  checkerNumericHints:checkerTokens.length,sourceNumericHints:sourceTokens.length,
  checkerUnresolved,checkerRanged,sourceUnresolved,sourceUnsupported,
  conditionalSource,checkerConditional,
  // Numerical mismatch identities stay as a pair of multisets for targeted review.
  hintDifference:status==='numeric-multiset-disagreement'||
    status==='checker-only-numeric-hints'||status==='source-only-numeric-hints'?
    {checker:checkerTokens.slice().sort(),gameTora:sourceTokens.slice().sort()}:null};
}
function audit({index,checkerFacts,gameToraDocuments,checkerCandidates,checkerRaw,rosterText,aliases}){
 if(index?.dataKind!=='umasupport-whole-event-provisional-index'||
   index.publicationApproval!==false||index.gameVerified!==false||
   index.eventMatchesProvisionalOnly!==true||
   checkerFacts?.dataKind!=='umasupport-explicit-result-facts'||
   checkerFacts.forSkillGrant!==false||
   !Array.isArray(index.cards)||!Array.isArray(checkerFacts.cards)||
   !Array.isArray(gameToraDocuments)||
   index.sourcePins?.checker!==checkerFacts.sourcePins?.checkerRevision)
  fail('provenance/approval invariant');
 verifyDerived(checkerCandidates,checkerFacts);
 if(index.sourcePins.checker!==checkerCandidates.sourcePins.checker.revision)
  fail('candidate version mismatch');
 const source=new Map();
 for(const doc of gameToraDocuments){
  if(doc?.kind!=='support'||!Number.isSafeInteger(doc.id)||source.has(String(doc.id)))
   fail('duplicate source card');
  source.set(String(doc.id),doc.events_ja&&Object.keys(doc.events_ja).length?
    Object.values(doc.events_ja):Object.values(doc.events||{}));
 }
 const rawLabels=buildCheckerLabelIndex({checkerRaw,rosterText,aliases});
 const facts=new Map(checkerFacts.cards.map(x=>[x.cardId,x]));
 if(facts.size!==checkerFacts.cards.length)fail('Checker cards duplicate');
 const counts={cards:563,matchedEvents:0,eventsWithChoiceCountMismatch:0,
  choicesCompared:0,checkerChoicesWithExplicitResults:0,sourceChoicesWithMultipleOutcomes:0,
  comparedNumericMentionsChecker:0,comparedNumericMentionsGameTora:0,
  matchedP0Events:0,unpairedP0Events:0,
  resultSignatureAgree:0,resultSignatureDisagree:0,
  choiceLabelStatuses:{},numericAgreementsWithLabelSupport:0,
  categoryCounts:{}};
 const cases=[],nonComparable=[],sourcesReviewed=new Set();
 for(const card of index.cards){
  const src=source.get(card.cardId),record=facts.get(card.cardId),ref=(record?.events||[]);
  if(card.sourceMissing!==(src===undefined))fail('source card missing drift '+card.cardId);
  if(card.checkerObservedCount!==ref.length)fail('Checker count mismatch '+card.cardId);
  if(src&&card.gameToraObservedCount!==src.length)fail('source event count mismatch '+card.cardId);
  for(const pair of card.pairs){
   counts.matchedEvents++;
   const ev=ref[pair.checkerOrdinal-1],sourceEvent=src?.[pair.sourceOrdinal-1];
   if(!ev||!sourceEvent||ev.sourceKey!==pair.sourceKey||
      !Array.isArray(sourceEvent.choices)||ev.choices.length!==pair.checkerChoiceCount||
      sourceEvent.choices.length!==pair.sourceChoiceCount)
    fail('crosswalk event ordinal/sourceKey drift '+card.cardId);
   if(pair.matchMethod!=='exact-name-provisional'&&pair.matchMethod!=='typography-provisional')
    fail('not a provisional title match');
   const key=card.cardId+':'+pair.sourceOrdinal;
   if(sourcesReviewed.has(key))fail('source event reused by multiple checker events');
   sourcesReviewed.add(key);
   if(!pair.choiceCountAgreement){
    counts.eventsWithChoiceCountMismatch++;
    nonComparable.push({cardId:card.cardId,sourceKey:pair.sourceKey,
      checkerOrdinal:pair.checkerOrdinal,sourceOrdinal:pair.sourceOrdinal,
      reason:'choice-count-conflict'});
    continue;
   }
   for(let i=0;i<ev.choices.length;i++){
    const labels=rawLabels.get(card.cardId)?.[pair.checkerOrdinal-1];
    if(!labels||labels.length!==ev.choices.length)fail('Checker label index mismatch');
    const choiceLabelStatus=compareChoiceLabel(labels[i],sourceEvent.choices[i].label);
    const result=analyzeChoice(ev.choices[i],sourceEvent.choices[i]);
    counts.choicesCompared++;
    counts.choiceLabelStatuses[choiceLabelStatus]=(counts.choiceLabelStatuses[choiceLabelStatus]||0)+1;
    if(result.status==='numeric-multiset-agreement'&&choiceLabelStatus!=='label-disagreement'&&
       choiceLabelStatus!=='label-not-comparable')counts.numericAgreementsWithLabelSupport++;
    if(result.checkerExplicit)counts.checkerChoicesWithExplicitResults++;
    if(result.sourceMultipleOutcomes)counts.sourceChoicesWithMultipleOutcomes++;
    counts.comparedNumericMentionsChecker+=result.checkerNumericHints;
    counts.comparedNumericMentionsGameTora+=result.sourceNumericHints;
    if(result.outcomeEvidence==='unlabeled-outcome-signature-agreement')counts.resultSignatureAgree++;
    if(result.outcomeEvidence==='unlabeled-outcome-signature-disagreement')counts.resultSignatureDisagree++;
    counts.categoryCounts[result.status]=(counts.categoryCounts[result.status]||0)+1;
    cases.push({cardId:card.cardId,sourceKey:pair.sourceKey,
      checkerOrdinal:pair.checkerOrdinal,sourceOrdinal:pair.sourceOrdinal,
      sourceSection:pair.sourceSection,choiceOrdinal:i+1,
      matchMethod:pair.matchMethod,choiceLabelStatus,...result});
   }
  }
  counts.matchedP0Events+=card.p0PairedCount;
  counts.unpairedP0Events+=card.p0CandidateCount-card.p0PairedCount;
 }
 if(counts.matchedEvents!==index.stats.pairedExact+index.stats.pairedTypographic||
   counts.matchedEvents+index.stats.checkerUnmatchedEvents!==2109||
   counts.eventsWithChoiceCountMismatch!==index.stats.pairedChoiceCountConflict||
   counts.choicesCompared!==cases.length||counts.matchedP0Events!==197||
   counts.unpairedP0Events!==2||counts.cards!==index.stats.rosterCards)
  fail('full-population conservation mismatch');
 return {schemaVersion:1,dataKind:'umasupport-two-source-numeric-reward-audit',
  sourcePins:{...index.sourcePins,checkerSha256:checkerFacts.sourcePins.checkerSha256},
  forSkillGrant:false,releaseApproved:false,routeVerified:false,
  gameVerified:false,eventTitleMatchesProvisional:true,
  originalSourceProseIncluded:false,
  semantics:{equalNumericHints:'Published source hint multiset equals at the same choice ordinal only; neither completeness nor result labels verified',
    emptyHintSets:'No observed numeric hints, not proof of no skill reward',
    outcomeSignatures:'Unordered branches; never proves success/failure ordering or probability'},
  counts,nonComparable,cases};
}
function main(args){
 if(args.length!==5)fail('usage: node poc/tools/audit_whole_event_rewards.cjs <whole-index.json> <snapshot-dir> <checker-Events.json> <support-card.txt> <numeric-audit-output.json>');
 const [indexPath,gtDir,checkerPath,rosterPath,out]=args;
 const result=audit({
  index:JSON.parse(fs.readFileSync(indexPath,'utf8')),
  checkerFacts:require('../data/candidates/checker_explicit_result_facts.v1.json'),
  checkerCandidates:require('../data/candidates/checker_event_hints.v1.json'),
  checkerRaw:JSON.parse(fs.readFileSync(checkerPath,'utf8').replace(/^\uFEFF/,'')),
  rosterText:fs.readFileSync(rosterPath,'utf8'),
  aliases:require('../config/checker-name-aliases.json'),
  gameToraDocuments:readDocuments(gtDir)});
 fs.mkdirSync(path.dirname(out),{recursive:true});
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log('WHOLE_REWARD_AUDIT_COUNTS='+JSON.stringify(result.counts));
 const focus=Object.entries(result.counts.categoryCounts).sort((a,b)=>b[1]-a[1]);
 console.log('WHOLE_REWARD_STATUS_RANKS='+JSON.stringify(focus));
 console.log('WHOLE_REWARD_EXCEPTION_CASES='+JSON.stringify(result.cases.filter(x=>
  ['numeric-multiset-disagreement','source-only-numeric-hints',
   'checker-only-numeric-hints','prior-conditional-needs-review'].includes(x.status)||
   x.outcomeEvidence==='unlabeled-outcome-signature-disagreement'
 ).map(x=>({cardId:x.cardId,checkerOrdinal:x.checkerOrdinal,
   choiceOrdinal:x.choiceOrdinal,status:x.status,outcomeEvidence:x.outcomeEvidence,
   checkerNumericHints:x.checkerNumericHints,sourceNumericHints:x.sourceNumericHints}))));
 console.log('WHOLE_REWARD_MISMATCH_CARDS='+JSON.stringify(
  [...new Set(result.cases.filter(x=>x.status==='numeric-multiset-disagreement')
    .map(x=>x.cardId))].sort().slice(0,30)));
}
if(require.main===module)main(process.argv.slice(2));
module.exports={numericHint,sourceHint,compareChoiceLabel,buildCheckerLabelIndex,analyzeChoice,audit};
