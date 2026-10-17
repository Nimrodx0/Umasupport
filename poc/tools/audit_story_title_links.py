#!/usr/bin/env python3
"""Historical master story titles vs Checker candidate title *fingerprints*.

Only uses a fixed historical master and a locally prepared candidate-only JSON.
Matches are PROVISIONAL exact normalized title overlaps, NOT game ID mappings.
No title, choice/effect text, or third-party input data is printed or published.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
import unicodedata

from audit_historical_event_master import read_source_cards, positive_id

TITLE_CATEGORY = 181
HEX_SHA256 = re.compile(r"^sha256:[a-f0-9]{64}$")


def title_digest(raw, normalization="strict"):
    if not isinstance(raw, str):
        raise ValueError("Invalid historical event-title text")
    normalized = unicodedata.normalize("NFKC", " ".join(raw.split())).strip()
    if normalization == "typography":
        normalized = "".join(ch for ch in normalized.lower() if ch.isalnum())
    elif normalization != "strict":
        raise ValueError("Unsupported title normalization")
    return "sha256:" + hashlib.sha256(normalized.encode("utf-8")).hexdigest() if normalized else None


def read_candidate_titles(text, source_cards, *, normalization="strict"):
    if normalization not in ("strict", "typography"):
        raise ValueError("Unsupported candidate title normalization")
    root = json.loads(text.lstrip("\ufeff"))
    if not isinstance(root, dict) or root.get("source") != "UmaUmaChecker" or root.get("format") != 1:
        raise ValueError("Invalid candidate-only format")
    items = root.get("cards")
    if not isinstance(items, list):
        raise ValueError("Missing candidate cards")
    by_card = {}
    total = 0
    for entry in items:
        if not isinstance(entry, dict) or not isinstance(entry.get("events"), list):
            raise ValueError("Invalid candidate-only card")
        cid = positive_id(entry.get("cardId"))
        if cid in by_card or cid not in source_cards or source_cards[cid] not in ("SSR", "SR"):
            raise ValueError("Invalid candidate ID or duplicate card")
        hashes = []
        for item in entry["events"]:
            if not isinstance(item, dict) or not isinstance(item.get("sourceDigest"), str):
                raise ValueError("Invalid candidate event")
            fingerprint = item.get("titleFingerprint" if normalization == "strict" else "typographicFingerprint")
            if fingerprint is not None and (not isinstance(fingerprint, str) or HEX_SHA256.fullmatch(fingerprint) is None):
                raise ValueError("Malformed candidate title fingerprint")
            if fingerprint is None and normalization == "strict":
                raise ValueError("Missing or malformed candidate title fingerprint")
            if "typographicFingerprint" not in item and normalization == "typography":
                raise ValueError("Missing secondary candidate title fingerprint")
            hashes.append(fingerprint)
            total += 1
        by_card[cid] = hashes
    stats = root.get("stats")
    if not isinstance(stats, dict) or stats.get("matchedCards") != len(by_card) or stats.get("eventCount") != total:
        raise ValueError("Candidate-only statistics inconsistent")
    return by_card


def read_historical_titles(master: Path, *, title_index="story_id", normalization="strict"):
    # Explicitly supported schema keys, not guesses based on higher match rate.
    if title_index not in ("story_id", "id", "short_story_id"):
        raise ValueError("Unsupported title index column")
    with sqlite3.connect(master.resolve().as_uri() + "?mode=ro", uri=True) as db:
        for table, columns in (
            ("single_mode_story_data", {"id", "support_card_id", "gallery_flag", title_index}),
            ("text_data", {"category", "index", "text"}),
        ):
            present = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
            if not present:
                raise ValueError("Historical master lacks required table: " + table)
            available = {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}
            if not columns.issubset(available):
                raise ValueError("Historical master lacks required title metadata: " + table)
        seen_ids = set()
        rows = defaultdict(list)
        # Do not concatenate event original text into output; digest in memory.
        query = f'''SELECT s.id, s.support_card_id, t.text
                    FROM single_mode_story_data s
                    LEFT JOIN text_data t ON t.category=? AND t."index"=s."{title_index}"
                    WHERE s.gallery_flag=2 AND s.support_card_id>0
                    ORDER BY s.id'''
        for sid, cid, title in db.execute(query, (TITLE_CATEGORY,)):
            story_id, card_id = positive_id(sid), positive_id(cid)
            if story_id in seen_ids:
                raise ValueError("Ambiguous story ID or duplicate category-181 text")
            seen_ids.add(story_id)
            rows[card_id].append(title_digest(title, normalization) if title is not None else None)
    return rows


def compare_titles(source_cards, candidate_titles, historical, *, normalization="strict"):
    if normalization not in ("strict", "typography"):
        raise ValueError("Unsupported title comparison mode")
    matched_key = "exactNormalizedTitleOverlaps" if normalization == "strict" else "typographicTitleOverlaps"
    master_unmatched_key = ("historicalTitlesWithoutExactCandidate" if normalization == "strict"
                            else "historicalTitlesWithoutTypographicCandidate")
    candidate_unmatched_key = ("checkerTitlesWithoutExactMasterTitle" if normalization == "strict"
                              else "checkerTitlesWithoutTypographicMasterTitle")
    focus_matched_key = "provisionalExactTitleOverlap" if normalization == "strict" else "provisionalTypographicOverlap"
    focus_old_key = "historicalTitlesNotExactInChecker" if normalization == "strict" else "historicalTitlesNotTypographicInChecker"
    focus_checker_key = "checkerTitlesNotExactInMaster" if normalization == "strict" else "checkerTitlesNotTypographicInMaster"
    rows = []
    by_rarity = {rarity: Counter() for rarity in ("SSR", "SR", "R")}
    for cid, rarity in sorted(source_cards.items()):
        master_hashes = historical.get(cid, [])
        checker = candidate_titles.get(cid) if rarity in ("SSR", "SR") else None
        missing_titles = sum(x is None for x in master_hashes)
        master_counts = Counter(x for x in master_hashes if x is not None)
        checker_counts = Counter(x for x in checker if x is not None) if checker is not None else Counter()
        common = sum((master_counts & checker_counts).values()) if checker is not None else None
        master_only = sum((master_counts - checker_counts).values()) if checker is not None else None
        checker_only = sum((checker_counts - master_counts).values()) if checker is not None else None
        duplicate_master = sum(v for v in master_counts.values() if v > 1)
        duplicate_checker = sum(v for v in checker_counts.values() if v > 1)
        tally = by_rarity[rarity]
        if master_hashes:
            tally["cardsWithHistoricalDirectStories"] += 1
        tally["historicalDirectStories"] += len(master_hashes)
        tally["historicalTitlesResolved"] += len(master_hashes) - missing_titles
        tally["historicalTitlesMissing"] += missing_titles
        if checker is not None:
            tally["checkerCards"] += 1
            tally["checkerEvents"] += len(checker)
            tally[matched_key] += common
            tally[master_unmatched_key] += master_only
            tally[candidate_unmatched_key] += checker_only
            if missing_titles:
                tally["cardsWithUnknownMasterTitles"] += 1
        if duplicate_master:
            tally["duplicateHistoricalTitleRows"] += duplicate_master
        if duplicate_checker:
            tally["duplicateCheckerTitleRows"] += duplicate_checker
        # Stable aggregate counts only. No source titles or hashes in the report.
        rows.append({
            "cardId": cid, "rarity": rarity,
            "historicalDirectStoryRows": len(master_hashes),
            "historicalTitleRowsWithText": len(master_hashes) - missing_titles,
            "historicalTitleRowsWithoutText": missing_titles,
            "checkerCandidateRecords": len(checker) if checker is not None else None,
            focus_matched_key: common,
            focus_old_key: master_only,
            focus_checker_key: checker_only,
            "duplicateHistoricalTitleRows": duplicate_master,
            "duplicateCheckerTitleRows": duplicate_checker,
        })
    return {
        "sourceCards": len(source_cards),
        "candidateCards": len(candidate_titles),
        "byRarity": {r: dict(sorted(v.items())) for r,v in by_rarity.items()},
        "focus30241": next((r for r in rows if r["cardId"] == "30241"), None),
        ("cardsWithHistoricalTitlesNotExactInChecker" if normalization == "strict"
         else "cardsWithHistoricalTitlesNotTypographicInChecker"): [
            r for r in rows if r[focus_old_key]
        ],
        "normalization": normalization,
        "cardNameMatchesAreNotEventIds": True,
        "scope": "Historical category=181 text; provisional NFKC/whitespace-normalized title "
                 "multiset intersections, not confirmed game story IDs, event routing, "
                 "complete event coverage or publication permission. "
                 "Unmatched titles can be spelling, event granularity, chronology or missing content."
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--umasim", type=Path, required=True)
    ap.add_argument("--master", type=Path, required=True)
    ap.add_argument("--candidates", type=Path, required=True)
    ap.add_argument("--title-index", choices=("story_id", "id", "short_story_id"), default="story_id")
    ap.add_argument("--focus-only", action="store_true", help="Print only aggregate totals and focus ID")
    ap.add_argument("--normalization", choices=("strict", "typography"), default="strict")
    args = ap.parse_args(argv)
    cards = read_source_cards(args.umasim.read_text(encoding="utf-8"))
    candidates = read_candidate_titles(args.candidates.read_text(encoding="utf-8"), cards,
                                       normalization=args.normalization)
    historic = read_historical_titles(args.master, title_index=args.title_index,
                                     normalization=args.normalization)
    report = compare_titles(cards, candidates, historic, normalization=args.normalization)
    report["titleLookupColumn"] = args.title_index
    report["sourceSha256"] = hashlib.sha256(args.umasim.read_bytes()).hexdigest()
    report["masterSha256"] = hashlib.sha256(args.master.read_bytes()).hexdigest()
    if args.focus_only:
        report.pop("cardsWithHistoricalTitlesNotExactInChecker" if args.normalization=="strict"
                   else "cardsWithHistoricalTitlesNotTypographicInChecker")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
        print("TITLE LINK AUDIT FAILED:", type(exc).__name__, str(exc), file=sys.stderr)
        sys.exit(1)
