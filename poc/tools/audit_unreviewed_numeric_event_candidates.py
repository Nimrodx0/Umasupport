#!/usr/bin/env python3
"""Read-only, source-pinned structural audit of a third-party event-skill subset.

NO event title, choice text, reward text, image, or game master is published.
Passing this audit is NOT a review/redistribution approval for game content.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata

EXPECTED_REPO = "Tsuyuchan-jp/umamusume-data"
EXPECTED_REVISION = "0cacbb1aaf9dca10283d5b9ea20b205b9d204535"
EXPECTED_VERSION = "0.1.14"
UMA_SUPPORT_SHA = "153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424"
CARD_ID = re.compile(r"^[123][0-9]{4}$")
EVENT_ID = re.compile(r"^evt_([123][0-9]{4})_([0-9]{9})$")
NUMERIC_NONSTORY = {"evt_tazuna_oodate5", "evt_tazuna_newyear"}
SOURCE_FILE_KEYS = {"events": "data/events.json", "supports": "data/supports.json", "skills": "data/skills.json"}
# IDs and names in independent historical reference tables (pre-2026).
# This is DIAGNOSTIC evidence only, not approval of an event reward, skill
# availability in the current game, or an alternative runtime skill dictionary.
HISTORICAL_ID_NAMES = {"200831": "逃げけん制", "200851": "逃げためらい"}
# Human-reviewed 2026-10-18 comparison: Wiki event-link IDs and the
# GameWith SSR30311 choice table (updated 2026-10-08). Numbers only.
# These are expected choice *positions*, not complete result/reward evidence.
EFFORIA_REVIEWED_CHOICES = {
    "830311001": 2,  # chain 1
    "830311002": 2,  # chain 2
    "830311003": 3,  # chain 3: two outcome tiers per choice
    "801146001": 2,  # other 1
    "801146002": 2,  # other 2
}
# GameWith and Bilibili published the following GREAT-SUCCESS hint levels.
# Names and numbers are matched to the candidate and the pinned UmaSim
# dictionary. The ordinary-success tier remains absent from candidate JSON.
EFFORIA_GREAT_SUCCESS = [
    [("華麗な踏み込み", 204532, 5), ("素質の証明", 204701, 2), ("清麗高雅", 204531, 2)],
    [("素質の証明", 204701, 2), ("純真無垢", 204571, 2)],
    [("勇気の一歩", 203712, 5), ("素質の証明", 204701, 2), ("ショーダウン", 203711, 2)],
]
def norm(v):
    return " ".join(unicodedata.normalize("NFKC", v).split())

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def read_manifest(raw):
    doc = json.loads(raw)
    if not isinstance(doc, dict) or doc.get("datasetVersion") != EXPECTED_VERSION or doc.get("schemaVersion") != 1:
        raise ValueError("Expected pinned dataset schema 0.1.14")
    for name, path in SOURCE_FILE_KEYS.items():
        entry=doc.get("files",{}).get(name)
        if not isinstance(entry,dict) or entry.get("path") != path or not re.fullmatch(r"[0-9a-f]{64}",entry.get("sha256","")):
            raise ValueError("Unverifiable manifest file hash: "+name)
    if not isinstance(doc.get("source"),dict) or doc["source"].get("factory") != "umamusume-data-src":
        raise ValueError("Missing private extraction factory provenance")
    if not isinstance(doc.get("generatedAt"),str) or not isinstance(doc["source"].get("extractedAt"),str):
        raise ValueError("Missing generated/extracted timestamp provenance")
    return doc

def cards_from_umasim(raw):
    if sha(raw) != UMA_SUPPORT_SHA:
        raise ValueError("Pinned UmaSim source SHA mismatch")
    ids=set()
    stages={}
    for line in raw.decode("utf-8").splitlines():
        if not line.strip(): continue
        f=line.split("\t")
        if len(f)!=62 or not CARD_ID.fullmatch(f[0]) or f[4] not in "01234":
            raise ValueError("Unexpected source support-card row")
        stages.setdefault(f[0],set()).add(f[4])
        ids.add(f[0])
    if len(ids)!=563 or any(len(k)!=5 for k in stages.values()):
        raise ValueError("Pinned UmaSim population or five-stage completeness changed")
    return ids

def read_skill_dictionary(text):
    raw=json.loads(text)
    if not isinstance(raw,list) or len(raw)<100:
        raise ValueError("Missing numeric skill registry")
    result={}
    for row in raw:
        if not isinstance(row,dict) or not isinstance(row.get("id"),str) or not row["id"].isdigit() or not isinstance(row.get("name"),str):
            raise ValueError("Invalid UmaSim numeric skill ID record")
        if row["id"] in result: raise ValueError("Duplicate numeric skill ID")
        result[row["id"]]=norm(row["name"])
    return result

def audit(manifest, supports, events, umasim_ids, skill_registry, wiki_page=None):
    if not isinstance(supports,list) or len(supports)!=45:
        raise ValueError("Expected 45 snapshot support cards")
    cards={}
    for c in supports:
        if not isinstance(c,dict) or not isinstance(c.get("id"),int) or not CARD_ID.fullmatch(str(c["id"])):
            raise ValueError("Invalid support identity")
        i=str(c["id"])
        if i in cards: raise ValueError("Duplicate support card ID")
        if i not in umasim_ids: raise ValueError("Support absent from pinned UmaSim")
        cards[i]=c
    if not isinstance(events,dict) or not isinstance(events.get("events"),list) or len(events["events"])!=126:
        raise ValueError("Expected pinned curated 126 event records")
    if events.get("version")!=2 or not isinstance(events.get("prioritySupportIds"),list):
        raise ValueError("Unexpected candidate event schema")
    if {str(i) for i in events["prioritySupportIds"]}!=set(cards):
        raise ValueError("Event-source priority-card population disagrees with support records")
    numerics=set()
    noncanonical=set()
    event_ids=set()
    referenced_cards=set()
    skill_rows=0
    skill_ids=set()
    unknown=set()
    named_mismatch=set()
    historical_name_matches=set()
    historical_name_disagreements=set()
    selection={"auto":0,"single":0}
    total_choices=0
    for e in events["events"]:
        if not isinstance(e,dict) or not isinstance(e.get("id"),str) or e["id"] in event_ids:
            raise ValueError("Duplicate or malformed candidate event ID")
        event_ids.add(e["id"])
        match=EVENT_ID.fullmatch(e["id"])
        if match:
            card_id,story_id=match.groups()
            if card_id not in cards: raise ValueError("Event support ID absent from candidate card collection")
            referenced_cards.add(card_id)
            numerics.add((card_id,story_id))
        else:
            if e["id"] not in NUMERIC_NONSTORY:raise ValueError("Unexpected non-story candidate event identifier")
            noncanonical.add(e["id"])
        mode=e.get("selection")
        if mode not in selection:raise ValueError("Unknown candidate selection semantics")
        selection[mode]+=1
        choices=e.get("choices",[])
        if not isinstance(choices,list):raise ValueError("Invalid event choices array")
        if mode=="single" and not choices:raise ValueError("Selection-based event without options")
        if mode=="auto" and choices:raise ValueError("Auto-count candidate with choice branch")
        if mode=="single" and e.get("defaultChoiceId") not in [c.get("id") for c in choices]:
            raise ValueError("Default choice does not match a candidate branch")
        if not isinstance(e.get("skills",[]),list):raise ValueError("Invalid direct skill records")
        total_choices+=len(choices)
        for v in ([e]+choices):
            if not isinstance(v,dict) or not isinstance(v.get("skills",[]),list):raise ValueError("Malformed event skill group")
            for r in v.get("skills",[]):
                if not isinstance(r,dict) or not isinstance(r.get("skillId"),int) or isinstance(r["skillId"],bool) or r["skillId"]<=0:
                    raise ValueError("Invalid numeric event skill reference")
                if not isinstance(r.get("hintLevel"),int) or r["hintLevel"]<0 or r["hintLevel"]>7:
                    raise ValueError("Invalid candidate hint level")
                if not isinstance(r.get("skillName"),str) or not norm(r["skillName"]):
                    raise ValueError("Candidate skill reference lacks nonempty skill name")
                skill_rows+=1
                i=str(r["skillId"])
                skill_ids.add(i)
                if i not in skill_registry:
                    unknown.add(i)
                    if i in HISTORICAL_ID_NAMES:
                        if norm(r["skillName"])==HISTORICAL_ID_NAMES[i]:
                            historical_name_matches.add(i)
                        else:
                            historical_name_disagreements.add(i)
                elif norm(r["skillName"])!=skill_registry[i]:
                    named_mismatch.add(i)
    if len(referenced_cards)!=45 or len(numerics)!=124 or noncanonical!=NUMERIC_NONSTORY:
        raise ValueError("Pinned source's 45-card/124-numeric-event shape changed")
    # The human-reviewed evidence lists two outcome tiers per finale choice.
    # The candidate has one undifferentiated reward set per choice. Even
    # perfectly matching GREAT-SUCCESS hints cannot approve its event rewards.
    by_id={v["id"]:v for v in events["events"]}
    focus=by_id.get("evt_30311_830311003")
    if focus is None or len(focus.get("choices",[]))!=3:
        raise ValueError("30311 spotlight candidate event/choice records changed")
    for index,(choice,expected) in enumerate(zip(focus["choices"],EFFORIA_GREAT_SUCCESS)):
        observed=[(norm(r["skillName"]),r["skillId"],r["hintLevel"]) for r in choice.get("skills",[])]
        if observed!=expected:
            raise ValueError("30311 great-success-tier spot check values changed at choice "+str(index+1))
    present=[sid for sid in EFFORIA_REVIEWED_CHOICES if "evt_30311_"+sid in by_id]
    absent=[sid for sid in EFFORIA_REVIEWED_CHOICES if "evt_30311_"+sid not in by_id]
    missing_choices={
        sid:{"expected":expected,"candidate":len(by_id["evt_30311_"+sid].get("choices",[]))}
        for sid,expected in EFFORIA_REVIEWED_CHOICES.items()
        if sid in present and len(by_id["evt_30311_"+sid].get("choices",[]))<expected
    }
    choice_expected=sum(EFFORIA_REVIEWED_CHOICES.values())
    choice_observed=sum(min(expected,len(by_id["evt_30311_"+sid].get("choices",[])))
                        for sid,expected in EFFORIA_REVIEWED_CHOICES.items() if sid in present)
    result={
        "source":EXPECTED_REPO+"@"+EXPECTED_REVISION,
        "schemaVersion":events["version"],
        "datasetVersion":manifest["datasetVersion"],
        "manifestGeneratedAt":manifest["generatedAt"],
        "privateFactoryExtractedAt":manifest["source"]["extractedAt"],
        "sourceFactoryPubliclyAuditable":False,
        "curatedSupportCards":len(cards),
        "curatedEventRecords":len(event_ids),
        "numericCardAndStoryIdPairs":len(numerics),
        "nonCanonicalEventIdentifierCount":len(noncanonical),
        "candidateSelectionModes":selection,
        "candidateChoiceBranches":total_choices,
        "candidateSkillRewardRows":skill_rows,
        "uniqueReferencedNumericSkillIds":len(skill_ids),
        "referencedSkillIdsAbsentFromPinnedUmaSim":len(unknown),
        "skillNameDisagreementsVsPinnedUmaSim":len(named_mismatch),
        "unmatchedSkillIds":sorted(unknown),
        # Historical name checks do not resolve current-dictionary absence.
        # An ID appearing with both matched and mismatched names is a mismatch.
        "historicalNameMatchedAbsentSkillIds":sorted(historical_name_matches-historical_name_disagreements),
        "historicalNameDisagreedAbsentSkillIds":sorted(historical_name_disagreements),
        "absentSkillIdsWithoutHistoricalNameMatch":sorted(unknown-(historical_name_matches-historical_name_disagreements)),
        "historicalEvidenceApprovesEventReward":False,
        "skillNameMismatchIds":sorted(named_mismatch),
        "gameRewardClaimsApproved":0,
        "focus30311GameWithSpotCheck":{
            "greatSuccessChoiceGroupsMatching":3,
            "expectedGreatSuccessChoiceGroups":3,
            "greatSuccessHintRecordsMatching":sum(len(x) for x in EFFORIA_GREAT_SUCCESS),
            "ordinarySuccessChoiceGroupsMissing":3,
            "lowerSuccessTierRepresented":False,
            "gameRewardsApproved":False,
            "scope":"All three great-success skill hint sets by ID/name/level only; ordinary-success tiers and complete rewards not represented.",
        },
        "focus30311ChoiceCoverage":{
            "wikiListedEventIds":list(EFFORIA_REVIEWED_CHOICES),
            "candidatePresentEventIds":present,
            "candidateMissingEventIds":absent,
            "gameWithListedChoicePositions":choice_expected,
            "candidateRepresentedChoicePositions":choice_observed,
            "missingChoicePositions":choice_expected-choice_observed,
            "presentEventsWithoutRequiredChoices":missing_choices,
            "finaleOrdinarySuccessResultGroupsMissing":3,
            "candidateEventsEligibleForPublication":0,
            "source":"Wiki SSR30311 event-link order + GameWith SSR30311 choice table, reviewed 2026-10-18; fixed counts only.",
            "warning":"Choice positions and three great-success hint sets do not establish outcomes, probabilities, conditions, or rights.",
        },
        "caveat":"Private extractor cites U-tools+mdb, so source independence and reward effects are unverified. 'auto' denotes that producer's planning-mode automatic counting, NOT a confirmed guaranteed in-game event. No event is admitted to reviewed_events.v1.json.",
    }
    if wiki_page is not None:
        import importlib.util
        parser_path=Path(__file__).with_name("audit_wiki_rendered_support_events.py")
        spec=importlib.util.spec_from_file_location("wiki_rendered_event_parser",parser_path)
        if spec is None or spec.loader is None:
            raise ValueError("Missing existing strict Wiki support-page parser")
        parser=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(parser)
        page=parser.parse_wiki_page(wiki_page,parser.RECENT_PAGE_TITLE)
        wiki_ids=page["chain"]|page["other"]
        candidate_ids={sid for card,sid in numerics if card=="30311"}
        result["wiki30311"]={
            "articleRevision":page["revision"],
            "wikiRenderedEventIds":len(wiki_ids),
            "candidateCardStoryIds":len(candidate_ids),
            "commonNumericStoryIds":len(wiki_ids&candidate_ids),
            "matchingStoryIds":sorted(wiki_ids&candidate_ids),
            "onWikiButNotInCandidate":len(wiki_ids-candidate_ids),
            "wikiOnlyStoryIds":sorted(wiki_ids-candidate_ids),
            "inCandidateButNotOnWiki":len(candidate_ids-wiki_ids),
            "candidateOnlyStoryIds":sorted(candidate_ids-wiki_ids),
            "warning":"This checks story-ID presence only, not event choices, rewards or acquisition probability.",
        }
    return result

def main():
    ap=argparse.ArgumentParser()
    for opt in ["manifest","supports","events","umasim-supports","umasim-skills"]:
        ap.add_argument("--"+opt,required=True,type=Path)
    ap.add_argument("--wiki-30311",type=Path)
    a=ap.parse_args()
    manifest=read_manifest(a.manifest.read_bytes())
    for part,path in [("supports",a.supports),("events",a.events)]:
        if sha(path.read_bytes())!=manifest["files"][part]["sha256"]:
            raise ValueError("Pinned third-party "+part+" file SHA mismatch")
    cards=cards_from_umasim(a.umasim_supports.read_bytes())
    registry=read_skill_dictionary(a.umasim_skills.read_text(encoding="utf-8"))
    wiki=json.loads(a.wiki_30311.read_text(encoding="utf-8")) if a.wiki_30311 else None
    result=audit(manifest,json.loads(a.supports.read_text(encoding="utf-8")),
                 json.loads(a.events.read_text(encoding="utf-8")),cards,registry,wiki)
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=="__main__":
    try:main()
    except (OSError,ValueError,UnicodeError,json.JSONDecodeError) as exc:
        print("Unreviewed candidate source rejected: "+str(exc),file=sys.stderr)
        sys.exit(1)
