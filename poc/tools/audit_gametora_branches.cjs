'use strict';
/*
 * Independent audit of the *structure* of a pinned third-party, GameTora-derived
 * snapshot. This is never an adapter for the published event catalog.
 * Event titles, choice prose and source effects are NOT exported.
 */
const fs = require('node:fs');
const path = require('node:path');
const PRIOR = new Set(['both_previous_chain_good','one_previous_chain_good',
  'both_previous_chain_bad','result_good','result_bad','result_average','success','fail']);
const SPECIAL = new Set(['branch_flag',...PRIOR]);
const fail = message => {throw Error('GameTora branch audit: '+message);};
const num = value => Number.isInteger(value)&&value>=0;
function flattenRoutes(choice){
  if(!choice||typeof choice!=='object') fail('invalid choice');
  const parts=Array.isArray(choice.segments)&&choice.segments.length
    ?choice.segments:[choice];
  const routes=[];
  for(const part of parts){
    const effects=Array.isArray(part.outcomes)?part.outcomes:[part.effects||[]];
    if(!effects.length) fail('empty outcome group');
    if(!Array.isArray(part.when||[])) fail('invalid condition guards');
    for(const effectList of effects){
      if(!Array.isArray(effectList)) fail('invalid effect group');
      routes.push({effects:effectList,when:part.when||[]});
    }
  }
  return routes;
}
function analyzeDocument(doc,expectedId){
  if(doc?.kind!=='support'||doc.id!==expectedId)fail('card document/id mismatch '+expectedId);
  const ja=doc.events_ja&&typeof doc.events_ja==='object'&&Object.keys(doc.events_ja).length;
  const events=ja?doc.events_ja:doc.events;
  if(!events||typeof events!=='object'||Array.isArray(events)) fail('missing event map '+expectedId);
  const result={cardId:String(expectedId),sourceLanguage:ja?'ja':'fallback',
    chainEvents:0,chainChoices:0,expandedOutcomeRoutes:0,terminalRoutes:0,
    eventsWithTerminal:0,choicesWithTerminal:0,eventsWithPriorDependence:0,
    previousConditionMarkers:0,conditionalSegments:0,skillHintMentions:0,
    eventsWithBranchFlag:0,chainEventsWithNoChoices:0};
  for(const ev of Object.values(events)){
    if(ev?.section!=='arrows')continue;
    result.chainEvents++;
    if(!Array.isArray(ev.choices))fail('chain event choices absent '+expectedId);
    if(!ev.choices.length)result.chainEventsWithNoChoices++;
    let eventEnds=false,eventPrior=false,eventFlag=false;
    for(const choice of ev.choices){
      result.chainChoices++;
      let choiceEnds=false;
      for(const group of flattenRoutes(choice)){
        result.expandedOutcomeRoutes++;
        if(group.when.length)result.conditionalSegments++;
        const guards=group.when.map(x=>x&&typeof x==='object'?x.kind:null);
        const types=group.effects.map(x=>x&&typeof x==='object'?x.type:null);
        if([...types,...guards].some(v=>v===null))fail('invalid effects/guards '+expectedId);
        if(types.includes('chain_end')){
          result.terminalRoutes++;eventEnds=true;choiceEnds=true;
        }
        if(types.includes('branch_flag'))eventFlag=true;
        const count=[...types,...guards].filter(x=>PRIOR.has(x)).length;
        result.previousConditionMarkers+=count;
        if(count)eventPrior=true;
        result.skillHintMentions+=group.effects.filter(x=>x.type==='skill_hint'||x.type==='skill_hint_or').length;
      }
      if(choiceEnds)result.choicesWithTerminal++;
    }
    if(eventEnds)result.eventsWithTerminal++;
    if(eventPrior)result.eventsWithPriorDependence++;
    if(eventFlag)result.eventsWithBranchFlag++;
  }
  return result;
}
function audit({index,queue,documents,sourceRevision}){
  if(index?.dataKind!=='umasupport-event-coverage-index'||
     index.productionApproval!==false||!Array.isArray(index.cards)||
     queue?.dataKind!=='umasupport-result-review-queue'||
     queue.productionApproval===true||queue.forSkillGrant!==false||
     !Array.isArray(queue.rows)||!Array.isArray(documents)||
     !/^[0-9a-f]{40}$/.test(sourceRevision))fail('invalid inputs/provenance');
  const roster=new Set(index.cards.map(x=>x.cardId));
  if(roster.size!==index.cards.length)fail('roster duplicates');
  const reviewedCards=new Set(), p0EventCards=new Map();
  for(const r of queue.rows){
    if(!roster.has(r.cardId)||!['P0','P1','P2'].includes(r.priority))fail('review queue mismatch');
    if(r.priority==='P0')p0EventCards.set(r.cardId,(p0EventCards.get(r.cardId)||0)+1);
  }
  const found=new Map();
  for(const doc of documents){
    if(!num(doc?.id)||doc.id<10000||doc.id>99999||found.has(String(doc.id)))fail('duplicate/invalid support ID');
    const entry=analyzeDocument(doc,doc.id);
    found.set(entry.cardId,entry);
  }
  const totals={sourceCardFiles:found.size,rosterCards:roster.size,reviewQueueEvents:queue.rows.length,
    presentRosterCards:0,missingRosterCards:0,extraneousSourceCards:0,
    cardsWithChain:0,cardsWithTerminations:0,cardsWithPriorDependence:0,
    p0EventsOnPresentCards:0,p0EventsOnMissingCards:0,p0CardsOnPresentSource:0};
  const metricKeys=['chainEvents','chainChoices','expandedOutcomeRoutes','terminalRoutes',
    'eventsWithTerminal','choicesWithTerminal','eventsWithPriorDependence',
    'previousConditionMarkers','conditionalSegments','skillHintMentions',
    'eventsWithBranchFlag','chainEventsWithNoChoices'];
  for(const key of metricKeys)totals[key]=0;
  const cardRows=[];
  for(const id of [...roster].sort()){
    const item=found.get(id),p0=p0EventCards.get(id)||0;
    if(item){
      totals.presentRosterCards++; if(p0)totals.p0CardsOnPresentSource++;
      totals.p0EventsOnPresentCards+=p0;
      if(item.chainEvents)totals.cardsWithChain++;
      if(item.terminalRoutes)totals.cardsWithTerminations++;
      if(item.eventsWithPriorDependence)totals.cardsWithPriorDependence++;
      for(const key of metricKeys)totals[key]+=item[key];
      cardRows.push({...item,p0CandidateEvents:p0});
    }else{totals.missingRosterCards++;totals.p0EventsOnMissingCards+=p0;
      cardRows.push({cardId:id,sourceMissing:true,p0CandidateEvents:p0});}
  }
  totals.extraneousSourceCards=[...found.keys()].filter(id=>!roster.has(id)).length;
  // These figures compare CARD identity only. Do NOT claim GameTora's events are
  // linked to Checker sourceKeys or have independently verified story IDs.
  return {schemaVersion:1,dataKind:'game-tora-structural-audit',
    sourceRepository:'systemless10/UmamusumePS',
    sourceRevision,sourceRelationship:'GameTora-derived normalized snapshot',
    releaseApproved:false,gameVerified:false,
    eventToCheckerCrosswalkVerified:false,
    rawThirdPartyContentIncluded:false,totals,
    missingCardIds:cardRows.filter(x=>x.sourceMissing).map(x=>x.cardId),
    extraCardIds:[...found.keys()].filter(id=>!roster.has(id)).sort(),
    cards:cardRows};
}
function readDocuments(folder){
  if(!fs.statSync(folder).isDirectory())fail('snapshot path is not a directory');
  return fs.readdirSync(folder).filter(n=>/^support_[0-9]{5}\.json$/.test(n))
    .sort().map(name=>JSON.parse(fs.readFileSync(path.join(folder,name),'utf8')));
}
function main(argv){
  if(argv.length!==3)fail('usage: node poc/tools/audit_gametora_branches.cjs <snapshot-dir> <sha40> <output.json>');
  const [folder,rev,out]=argv;
  const result=audit({
    index:require('../data/candidates/event_coverage_index.v1.json'),
    queue:require('../data/candidates/checker_explicit_result_review_queue.v1.json'),
    documents:readDocuments(folder),sourceRevision:rev
  });
  if(result.totals.rosterCards!==563||result.totals.reviewQueueEvents!==2109||
     result.totals.p0EventsOnPresentCards+result.totals.p0EventsOnMissingCards!==199)
    fail('unexpected first-party population; review snapshot before accepting audit');
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  console.log('GAMETORA_BRANCH_AUDIT_TOTALS='+JSON.stringify(result.totals));
  console.log('MISSING_CARD_IDS='+result.missingCardIds.join(','));
  console.log('EXTRA_CARD_IDS='+result.extraCardIds.join(','));
  console.log('No raw third-party event text, copyrighted choice prose or event DB has been committed.');
}
if(require.main===module)main(process.argv.slice(2));
module.exports={flattenRoutes,analyzeDocument,audit,readDocuments};
