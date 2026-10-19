#!/usr/bin/env python3
"""Classify ALL persisted Checker candidate events using one pinned historical master.

Only source keys, skill/event numeric IDs, reason codes and digests are emitted.
A historical title match is a provisional *identity hint*, never confirmation
of a game route, outcome, choice, skill award, or 2026 completeness.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sqlite3
import sys

from audit_story_title_links import title_digest
from audit_story_residual_metadata import read_master_metadata

STATUS = ("verified-route", "needs-review", "source-gap")
LINKS = ("strict-unique", "typography-suggestion", "ambiguous", "no-match", "not-in-2025-master")
EXPECTED_MASTER_SHA = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"
EXPECTED_MASTER_REV = "5a8ec1356859a35e245edef0d40da740e652df68"
MASTER_URL = ("https://raw.githubusercontent.com/SimpleSandman/"
              "UmaMusumeMetaMasterMDB/" + EXPECTED_MASTER_REV + "/master/master.mdb")


def fail(message):
    raise ValueError("Route classification: " + message)


def parse_unique_master(master_path):
    """Reuse audited metadata decoder; obtain category-181 exact title digests read-only."""
    metadata = read_master_metadata(master_path)
    raw = {}
    with sqlite3.connect(master_path.resolve().as_uri() + "?mode=ro", uri=True) as con:
        for cid, story_id, title in con.execute("""
            SELECT s.support_card_id, s.story_id, t.text
            FROM single_mode_story_data s
            JOIN text_data t ON t.category=181 AND t."index"=s.story_id
            WHERE s.gallery_flag=2 AND s.support_card_id>0
        """):
            k = (str(cid), str(story_id))
            if k in raw or title is None or title_digest(title) is None:
                fail("missing or duplicate historical category-181 title")
            raw[k] = title_digest(title)
    results = {}
    for cid, stories in metadata.items():
        out = []
        for record in stories:
            sid = record["storyId"]
            k = (cid, sid)
            if k not in raw:
                fail("missing historical title fingerprint for " + cid + ":" + sid)
            out.append({
                "storyId": sid,
                "strict": raw[k],
                "loose": record["fingerprint"],
                "numericMeta": {
                    x: record["meta"][x] for x in (
                        "show_progress_1", "show_progress_2", "show_progress_3",
                        "event_category", "ending_type"
                    )
                },
            })
        results[cid] = out
    return results


def classify(candidate_db, checker_index, historical, master_sha):
    if not isinstance(candidate_db, dict) or candidate_db.get("dataKind") != "support-event-hint-candidates" or candidate_db.get("approvalState") != "UNREVIEWED_NOT_FOR_PUBLICATION" or candidate_db.get("forSkillGrant") is not False:
        fail("not a quarantined Umasupport candidate DB")
    if not isinstance(checker_index, dict) or checker_index.get("source") != "UmaUmaChecker" or checker_index.get("format") != 1:
        fail("not a candidate-only title fingerprint inventory")
    cards = candidate_db.get("cards")
    index_cards = checker_index.get("cards")
    if not isinstance(cards, list) or not isinstance(index_cards, list):
        fail("missing source population")
    index_by_id = {}
    for item in index_cards:
        cid = item.get("cardId") if isinstance(item, dict) else None
        if not isinstance(cid, str) or cid in index_by_id or not isinstance(item.get("events"), list):
            fail("duplicate/malformed checker inventory card")
        index_by_id[cid] = item
    all_keys = set()
    seen_cards = set()
    summary = Counter()
    link_counts = Counter()
    flags = Counter()
    result_cards = []
    possible_gaps = []
    # Evidence from historical master is always *provisional* and cannot
    # attest to 2026 game event existence or any outcome/reward path.
    for card in cards:
        cid = card.get("cardId") if isinstance(card, dict) else None
        if not isinstance(cid, str) or not cid.isascii() or len(cid) != 5 or not cid.isdecimal() or cid in seen_cards:
            fail("duplicate/malformed card ID")
        seen_cards.add(cid)
        if cid not in index_by_id:
            fail("candidate card absent from exact source inventory")
        model_events = card["events"]
        source_events = index_by_id[cid]["events"]
        if len(model_events) != len(source_events):
            fail("event count mismatch for " + cid)
        old = historical.get(cid)
        by_strict = defaultdict(list)
        by_loose = defaultdict(list)
        if old is not None:
            for row in old:
                by_strict[row["strict"]].append(row)
                by_loose[row["loose"]].append(row)
        src_strict = Counter(e.get("titleFingerprint") for e in source_events)
        src_loose = Counter(e.get("typographicFingerprint") for e in source_events)
        matched_master_ids = set()
        events = []
        for e, source in zip(model_events, source_events):
            key, digest = e.get("sourceKey"), e.get("sourceDigest")
            if (not isinstance(key, str) or not key.startswith("checker:" + cid + ":") or
                key in all_keys or key != source.get("sourceKey") or digest != source.get("sourceDigest") or
                e.get("ordinal") != source.get("sourceIndex", -1) + 1 or
                len(e.get("choices", [])) != source.get("optionCount")):
                fail("event identity, order, or choice count drift: " + str(key))
            all_keys.add(key)
            fingerprint = source.get("titleFingerprint")
            loose = source.get("typographicFingerprint")
            if not isinstance(fingerprint, str) or not fingerprint.startswith("sha256:"):
                fail("source title fingerprint missing")
            strict_list = by_strict.get(fingerprint, [])
            loose_list = by_loose.get(loose, []) if loose else []
            if old is None:
                kind = "not-in-2025-master"
                detail = {}
            elif len(strict_list) == 1 and src_strict[fingerprint] == 1:
                kind = "strict-unique"
                hit = strict_list[0]
                detail = {"provisionalStoryId": hit["storyId"],
                          "historicalNumericMetadata": hit["numericMeta"]}
                matched_master_ids.add(hit["storyId"])
            elif strict_list:
                kind = "ambiguous"
                detail = {}
            elif len(loose_list) == 1 and src_loose[loose] == 1:
                kind = "typography-suggestion"
                hit = loose_list[0]
                detail = {"possibleStoryId": hit["storyId"]}
                # Only strict matches clear the historical title-gap tally.
            elif loose_list:
                kind = "ambiguous"
                detail = {}
            else:
                kind = "no-match"
                detail = {}
            link_counts[kind] += 1
            # Any of these means the event path STILL needs proof.
            reasons = ["event-route-not-reviewed", "outcome-branch-not-reviewed", "publication-not-reviewed"]
            if kind != "strict-unique":
                reasons.append("historical-story-id-not-strictly-linked")
            if not e["choices"]:
                reasons.append("no-observed-choices")
            for choice in e["choices"]:
                if choice.get("needsManualResultReview"):
                    flags["conditionalOrUnparsedChoiceRows"] += 1
                    if "conditional-result-needs-review" not in reasons:
                        reasons.append("conditional-result-needs-review")
                for hint in choice["observedHints"]:
                    if "resolution" in hint:
                        flags["unresolvedHintRows"] += 1
                        if "unresolved-skill-id" not in reasons:
                            reasons.append("unresolved-skill-id")
            summary["events"] += 1
            summary["needs-review"] += 1
            events.append({"sourceKey": key, "sourceDigest": digest, "ordinal": e["ordinal"],
                           "status": "needs-review",
                           "historicalLink": {"status": kind, **detail},
                           "reasons": reasons})
        if not model_events:
            card_status = "source-gap"  # No event records in this *source*, not no events in game.
            summary["cardsWithSourceEmptyEvents"] += 1
        else:
            card_status = "needs-review"
        result_cards.append({"cardId": cid, "rarity": card["rarity"],
                             "sourceRecordStatus": card_status, "events": events})
        # Preserve historical unmatched IDs as *possible* gaps, not actual
        # current-game missing events. They may be spelling variants.
        for row in old or []:
            if row["storyId"] not in matched_master_ids:
                possible_gaps.append({"cardId": cid, "historicalStoryId": row["storyId"],
                                      "reason": "historical-direct-title-not-strictly-matched",
                                      "confirmedMissingIn2026": False})
    if len(all_keys) != candidate_db.get("stats", {}).get("eventsObserved"):
        fail("candidate total does not match persisted database")
    if checker_index.get("stats", {}).get("eventCount") != len(all_keys):
        fail("checker inventory source event count drift")
    if len(cards) != candidate_db.get("stats", {}).get("cardsWithCandidates"):
        fail("card population count drift")
    return {
        "schemaVersion": 1,
        "dataKind": "support-event-route-classification",
        "routeApprovalState": "UNREVIEWED_NOT_FOR_PUBLICATION",
        "forSkillGrant": False,
        "candidateInputSha256": hashlib.sha256(json.dumps(candidate_db, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()).hexdigest(),
        "sourcePins": {
            "checkerRevision": candidate_db["sourcePins"]["checker"]["revision"],
            "historicalMaster": {"url": MASTER_URL, "revision": EXPECTED_MASTER_REV, "sha256": master_sha}
        },
        "totals": {
            "candidateCards": len(cards),
            "candidateEvents": len(all_keys),
            "verifiedRoutes": 0,
            "needsReview": summary["needs-review"],
            "sourceGapEventRecords": 0,
            "cardsWithEmptyCandidateSource": summary["cardsWithSourceEmptyEvents"],
            "historicalProvisionalLinks": dict(sorted(link_counts.items())),
            "historicalDirectRowsWithoutStrictTitleLink": len(possible_gaps),
            "choiceAndHintMarkers": dict(sorted(flags.items())),
        },
        "cards": result_cards,
        "historicalPossibleGaps": possible_gaps,
        "warning": (
            "Historical (2025) title matches are only provisional identity hints; "
            "never assert game event route, prerequisites, choices, outcomes, reward "
            "semantics, 2026 completeness, or republication permission. "
            "Source-gap means empty Checker candidate arrays, not absent game events."
        ),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    master_hash = hashlib.sha256(args.master.read_bytes()).hexdigest()
    if master_hash != EXPECTED_MASTER_SHA:
        fail("pinned 2025 master SHA256 mismatch")
    db = json.loads(args.db.read_text(encoding="utf-8"))
    source = json.loads(args.inventory.read_text(encoding="utf-8"))
    result = classify(db, source, parse_unique_master(args.master), master_hash)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["totals"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError, sqlite3.Error, json.JSONDecodeError) as error:
        print("ROUTE_CLASSIFICATION_FAILED:", str(error), file=sys.stderr)
        sys.exit(1)
