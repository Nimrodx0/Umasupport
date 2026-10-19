/*
 * Prioritized review list of factual candidate anomalies.
 * Only derived identifiers, event/choice ordinals, and counts; never emit
 * GameWith-derived event/choice/effect prose or assert source independence.
 * This is NOT a publication catalog, and no item is auto-approved.
 */
'use strict';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const KEY=/^checker:\d{5}:[0-9a-f]{20}$/;
const DIGEST=/^sha256:[0-9a-f]{64}$/;
const CATEGORIES=['unparsed-hint','ambiguous-skill-id','missing-skill-id',
                  'conditional-result','cruise-only-title','checker-empty'];
const WEIGHTS={'unparsed-hint':100,'ambiguous-skill-id':90,
 'missing-skill-id':80,'conditional-result':60,
 'cruise-only-title':40,'checker-empty':35};
function fail(message){throw Error('Candidate review queue: '+message);}
function priority(score){return score>=80?'P0':score>=60?'P1':score>=35?'P2':'P3';}
function build({candidates,gaps=null}){
 if(!object(candidates)||candidates.approvalState!=='UNREVIEWED_NOT_FOR_PUBLICATION'||
    !Array.isArray(candidates.cards))fail('not a complete unreviewed candidate index');
 const seenCards=new Set(),seenEvents=new Set(),items=[],totals=Object.fromEntries(CATEGORIES.map(c=>[c,0]));
 let eventsInspected=0,branchesInspected=0;
 for(const card of candidates.cards){
  if(!object(card)||!/^\d{5}$/.test(card.cardId)||seenCards.has(card.cardId)||
     !['SSR','SR'].includes(card.rarity)||!Array.isArray(card.events))
    fail('invalid or repeated candidate card');
  seenCards.add(card.cardId);
  for(const event of card.events){
   if(!object(event)||!KEY.test(event.sourceKey)||!DIGEST.test(event.sourceDigest)||
      !event.sourceKey.startsWith('checker:'+card.cardId+':')||seenEvents.has(event.sourceKey)||
      !integer(event.sourceEventOrdinal)||event.sourceEventOrdinal<1||
      !Array.isArray(event.choices)||event.requiresFullReview!==true)
    fail('invalid or duplicated unreviewed event identity');
   seenEvents.add(event.sourceKey);eventsInspected++;
   for(let i=0;i<event.choices.length;i++){
    const c=event.choices[i];
    if(!object(c)||c.ordinal!==i+1||!Array.isArray(c.observedHints)||
       typeof c.needsManualResultReview!=='boolean')
      fail('invalid candidate choice ordinal');
    const reasons=new Set();
    if(c.unparsedHintSyntax===true)reasons.add('unparsed-hint');
    if(c.needsManualResultReview===true&&!c.unparsedHintSyntax)
      reasons.add('conditional-result');
    // An unparsed hint may coexist with a conditional outcome. We cannot
    // infer the condition just from the pre-existing boolean in that case.
    for(const h of c.observedHints){
     if(!object(h)||!integer(h.level)||h.level<1||h.level>10)fail('invalid observed hint level');
     if(h.resolution==='ambiguous')reasons.add('ambiguous-skill-id');
     else if(h.resolution==='missing')reasons.add('missing-skill-id');
     else if(typeof h.skillId!=='string'||!/^\d+$/.test(h.skillId))fail('unsafe skill identity');
    }
    branchesInspected++;
    if(!reasons.size)continue;
    const sorted=[...reasons].sort((a,b)=>WEIGHTS[b]-WEIGHTS[a]);
    for(const reason of sorted)totals[reason]++;
    const score=WEIGHTS[sorted[0]];
    items.push({scope:'choice',cardId:card.cardId,sourceKey:event.sourceKey,
      sourceDigest:event.sourceDigest,eventOrdinal:event.sourceEventOrdinal,
      choiceOrdinal:c.ordinal,priority:priority(score),score,reasons:sorted,
      observedHintCount:c.observedHints.length,
      requiresIndependentReview:true});
   }
  }
 }
 let gapCoverage='not-provided';
 if(gaps!==null){
  if(!object(gaps)||!object(gaps.summary)||!Array.isArray(gaps.possibleGaps)||
     !Array.isArray(gaps.zeroEventCardIds))fail('invalid cross-source gap audit');
  gapCoverage='present-provisional-name-matching';
  const seenGaps=new Set();
  for(const row of gaps.possibleGaps){
   if(!object(row)||typeof row.cardId!=='string'||!/^[0-9]{5}$/.test(row.cardId)||
      !integer(row.cruiseOnly)||row.cruiseOnly<1||seenGaps.has(row.cardId))
    fail('invalid cross-source gap row');
   seenGaps.add(row.cardId);
   if(!seenCards.has(row.cardId))continue; // mismatched card joins, do not invent links
   totals['cruise-only-title']++;
   items.push({scope:'card',cardId:row.cardId,priority:'P2',
      score:WEIGHTS['cruise-only-title'],reasons:['cruise-only-title'],
      cruiseOnlyTitles:row.cruiseOnly,
      comparisonJoin:row.cruiseJoin||null,
      requiresIndependentReview:true});
  }
  const empty=new Set();
  for(const id of gaps.zeroEventCardIds){
   if(typeof id!=='string'||!/^[0-9]{5}$/.test(id)||empty.has(id))
    fail('invalid empty source card');
   empty.add(id);
   if(!seenCards.has(id))continue;
   const source=candidates.cards.find(c=>c.cardId===id);
   if(source.events.length)fail('cross-source empty-card contradiction');
   totals['checker-empty']++;
   items.push({scope:'card',cardId:id,priority:'P2',
     score:WEIGHTS['checker-empty'],reasons:['checker-empty'],
     requiresIndependentReview:true});
  }
 }
 const level=p=>Number(p.slice(1));
 items.sort((a,b)=>level(a.priority)-level(b.priority)||
   b.score-a.score||a.cardId.localeCompare(b.cardId)||
   (a.eventOrdinal||0)-(b.eventOrdinal||0)||
   (a.choiceOrdinal||0)-(b.choiceOrdinal||0));
 const priorityTotals={P0:0,P1:0,P2:0,P3:0};
 for(const item of items)priorityTotals[item.priority]++;
 return {
  schemaVersion:1,approvalState:'UNREVIEWED_NOT_FOR_PUBLICATION',
  comparisonScope:gapCoverage,
  totals:{cardsInspected:seenCards.size,eventsInspected,branchesInspected,
   queueEntries:items.length,priorityEntries:priorityTotals,reasonEntries:totals},
  reviewQueue:items,
  warning:'Candidate source data and cross-source title differences are not independently verified game event facts, not evidence of rights to redistribute, and never auto-publish.'
 };
}
module.exports={build};
