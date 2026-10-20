#!/usr/bin/env python3
"""Locate why the four old-master title joins fail, without publishing event text.

No fuzzy match becomes an accepted ID. Operates only on three previously
isolated cards with a pinned old master and fixed source snapshot.
"""
from __future__ import annotations

import argparse
from collections import Counter
from difflib import SequenceMatcher
import json
from pathlib import Path
import sqlite3
import unicodedata

from audit_direct_historical_chain import (
    read_old_master, source_event_index, unique_join, OLD_SHA, OLD_REV, GT_REV
)

TARGETS = {"30043", "30096", "30108"}


def normalized(s):
    return unicodedata.normalize("NFKC", " ".join(s.split())).strip()


def old_titles(master: Path, ids: set[str]) -> dict[str, dict[str, dict]]:
    """Load original editorial titles transiently; caller must not serialize them."""
    found = {}
    with sqlite3.connect(master.resolve().as_uri() + "?mode=ro", uri=True) as db:
        rows = db.execute("""
            SELECT s.support_card_id,s.story_id,s.show_progress_1,
                   s.show_progress_2,s.show_progress_3,t.text
            FROM single_mode_story_data s
            LEFT JOIN text_data t ON t.category=181 AND t."index"=s.story_id
            WHERE s.gallery_flag=2 AND s.support_card_id IN (30043,30096,30108)
        """)
        for cid, sid, ordinal, maxnum, flag, title in rows:
            card, story = str(cid), str(sid)
            if card not in ids:
                continue
            if not isinstance(title, str) or not title.strip():
                raise ValueError("historical title absent")
            cardrows = found.setdefault(card, {})
            if story in cardrows:
                raise ValueError("duplicate story_id for target")
            cardrows[story] = dict(stage=ordinal, maximum=maxnum, flag=flag,
                                   title=normalized(title))
    return found


def inspect(direct: dict, old: dict, original: dict, source_docs: dict) -> dict:
    if (direct.get("dataKind") != "umasupport-direct-2025-master-chain-audit" or
        direct.get("routeVerifiedIn2026") is not False or
        direct.get("releaseApproved") is not False or
        direct.get("sourcePins", {}).get("historicalMasterSha256") != OLD_SHA or
        direct.get("sourcePins", {}).get("gameToraDerived") != GT_REV):
        raise ValueError("unapproved direct audit provenance mismatch")
    gaps = [g for g in direct.get("stillUnlinkedHistoricalOrders", [])
            if g.get("oldCardHasDirectStories")]
    if len(gaps) != 4 or {str(x["cardId"]) for x in gaps} != TARGETS:
        raise ValueError("four pinned residual gaps have drifted")
    report = []
    for card in sorted(TARGETS):
        doc = source_docs.get(card)
        if not isinstance(doc, dict):
            raise ValueError("target support card missing")
        source = source_event_index(doc)
        events_map = doc.get("events_ja") or doc.get("events")
        current_events = list(events_map.values())
        oldrows = old.get(card, [])
        matches = unique_join(source, oldrows)
        claimed = {e["storyId"] for e in matches.values()}
        old_unmatched = {k: v for k, v in original.get(card, {}).items() if k not in claimed}
        if {str(e["storyId"]) for e in oldrows} != set(original.get(card, {})):
            raise ValueError("historical titles and numerical master records drift")
        affected = set()
        for gap in gaps:
            if str(gap["cardId"]) != card:
                continue
            a, b = gap["firstOrdinal"], gap["nextOrdinal"]
            for ordinal in (a, b):
                if ordinal not in matches:
                    affected.add(ordinal)
        for ordinal in sorted(affected):
            if ordinal < 1 or ordinal > len(current_events):
                raise ValueError("source ordinal outside document")
            event = current_events[ordinal - 1]
            if event["section"] != "arrows":
                raise ValueError("not a chain source event")
            # Only an observed source order hint, never a certified master stage number.
            source_stage = sum(x["section"] == "arrows" for x in current_events[:ordinal])
            source_title = normalized(event.get("name") or list(events_map)[ordinal-1])
            stage_candidates = [v for v in original[card].values()
                if v["stage"] == source_stage and isinstance(v["maximum"], int) and
                   v["maximum"] >= source_stage]
            unused = [(id, r) for id, r in old_unmatched.items()]
            ranked = sorted(
                ((int(round(1000*SequenceMatcher(None, source_title, rec["title"]).ratio())),
                  sid, rec) for sid, rec in unused),
                key=lambda v: (-v[0], v[1])
            )
            best = ranked[0] if ranked else None
            report.append({
                "cardId": card, "sourceOrdinal": ordinal,
                "sourceChainOrdinal": source_stage,
                "historicalStageNumberSameAsSourceOrdinalPresent": bool(stage_candidates),
                "historicalMatchingStageRows": len(stage_candidates),
                "historicalUnmatchedStoryRows": len(unused),
                "bestUnmatchedHistoricalStoryId": best[1] if best else None,
                "titleSimilarityPermille": best[0] if best else None,
                "bestOldStage": best[2]["stage"] if best else None,
                "bestOldChainMax": best[2]["maximum"] if best else None,
                "diagnosis": ("no-corresponding-2025-stage-number" if not stage_candidates else
                              "old-stage-exists-title-identity-not-established"),
                "candidateAccepted": False
            })
    categories = dict(sorted(Counter(x["diagnosis"] for x in report).items()))
    if not report:
        raise ValueError("nothing diagnosed")
    return dict(schemaVersion=1, dataKind="umasupport-targeted-2025-title-gap-diagnosis",
                sourcePins=dict(gameToraDerived=GT_REV, historicalMasterRevision=OLD_REV,
                                historicalMasterSha256=OLD_SHA),
                originalSourceTextIncluded=False, gameVerified=False,
                releaseApproved=False, forSkillGrant=False,
                candidateLinksAccepted=0,
                stats=dict(failedAdjacentPairs=4, distinctUnpairedChainStages=len(report),
                           byDiagnosis=categories),
                cases=report)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--master", type=Path, required=True)
    p.add_argument("--source-dir", type=Path, required=True)
    p.add_argument("--direct-audit", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    # SHA gate before decoding any historical content.
    old = read_old_master(a.master)
    direct = json.loads(a.direct_audit.read_text(encoding="utf8"))
    original = old_titles(a.master, TARGETS)
    docs = {}
    for card in sorted(TARGETS):
        path = a.source_dir / ("support_" + card + ".json")
        docs[card] = json.loads(path.read_text(encoding="utf8"))
        if str(docs[card].get("id")) != card or docs[card].get("kind") != "support":
            raise ValueError("wrong source card ID")
    report = inspect(direct, old, original, docs)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n", encoding="utf8")
    print("TARGETED_2025_GAP_STATS=" + json.dumps(report["stats"], sort_keys=True))
    print("TARGETED_2025_GAP_CASES=" + json.dumps(report["cases"], sort_keys=True))


if __name__ == "__main__":
    main()
