#!/usr/bin/env python3
"""Read-only support story-ID overlap audit against a separately dated SQLite master.

Source card IDs are from UmaSim. The old master provides card-specific story IDs
with gallery_flag=2, as used by Umamusume Wiki. UmaUmaChecker *candidate* event
record counts may be compared, but they are not assumed to share event identity
or a 1:1 relationship with story records. This additionally counts character-shared story IDs through support_card_data.chara_id,
but cannot verify group-card multi-character membership, branching, choice rewards,
or current-game completeness.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sqlite3
import sys


def positive_id(value):
    value = str(value)
    if not value.isascii() or not value.isdecimal() or int(value) <= 0:
        raise ValueError("Invalid source or master ID")
    return value


def read_source_cards(raw):
    cards = {}
    for row, line in enumerate(raw.lstrip("\ufeff").splitlines(), start=1):
        if not line.strip():
            continue
        fields = line.split("\t")
        if (len(fields) != 62 or len(fields[0]) != 5 or
                fields[3] not in ("1", "2", "3") or fields[4] not in ("0", "1", "2", "3", "4")):
            raise ValueError(f"Invalid UmaSim card row {row}")
        sid = positive_id(fields[0])
        rarity = {"1": "R", "2": "SR", "3": "SSR"}[fields[3]]
        stage = int(fields[4])
        if sid not in cards:
            cards[sid] = {"rarity": rarity, "name": fields[1], "stages": set()}
        card = cards[sid]
        if card["rarity"] != rarity or card["name"] != fields[1] or stage in card["stages"]:
            raise ValueError(f"Inconsistent source card/stage {sid}")
        card["stages"].add(stage)
    for sid, card in cards.items():
        if card["stages"] != set(range(5)):
            raise ValueError(f"Missing source limit-break stage {sid}")
    return {sid: card["rarity"] for sid, card in cards.items()}


def read_master(path):
    # No file creation or writes are possible through this connection.
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True) as db:
        schema = {}
        for table, required in (
            ("support_card_data", {"id", "chara_id"}),
            ("single_mode_story_data", {"id", "support_card_id", "support_chara_id", "gallery_flag"}),
        ):
            if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is None:
                raise ValueError("Historical master missing table: " + table)
            columns = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
            if not required.issubset(columns):
                raise ValueError("Historical master missing columns in " + table + ": " +
                                 ", ".join(sorted(required - columns)))
            schema[table] = sorted(columns)
        all_card_ids = set()
        card_chara_ids = {}
        for value, chara in db.execute("SELECT id, chara_id FROM support_card_data"):
            sid = positive_id(value)
            if sid in all_card_ids:
                raise ValueError("Duplicate historical support card ID " + sid)
            all_card_ids.add(sid)
            # Some group cards may need additional multi-character relationship
            # tables; do not invent such memberships from the character field.
            card_chara_ids[sid] = positive_id(chara) if chara is not None and int(chara) > 0 else None

        by_card = defaultdict(set)
        seen_story_ids = set()
        eligible_rows = 0
        for story_id, card_id in db.execute(
                "SELECT id, support_card_id FROM single_mode_story_data "
                "WHERE gallery_flag = 2 AND support_card_id > 0"):
            sid, cid = positive_id(story_id), positive_id(card_id)
            if sid in seen_story_ids:
                raise ValueError("Duplicate master story ID " + sid)
            seen_story_ids.add(sid)
            by_card[cid].add(sid)
            eligible_rows += 1
        by_character = defaultdict(set)
        eligible_shared_rows = 0
        for story_id, chara_id in db.execute(
                "SELECT id, support_chara_id FROM single_mode_story_data "
                "WHERE gallery_flag = 2 AND support_chara_id > 0"):
            by_character[positive_id(chara_id)].add(positive_id(story_id))
            eligible_shared_rows += 1
        known_charas = set(x for x in card_chara_ids.values() if x)
        return {"card_ids": all_card_ids, "card_chara_ids": card_chara_ids,
                "direct_stories": by_card, "shared_stories": by_character,
                "master_card_count": len(all_card_ids), "eligible_story_rows": eligible_rows,
                "eligible_shared_rows": eligible_shared_rows,
                "orphan_direct_card_ids": sorted(set(by_card) - all_card_ids),
                "unused_shared_chara_count": len(set(by_character) - known_charas)}


def read_candidates(raw, source_cards):
    value = json.loads(raw.lstrip("\ufeff"))
    if (not isinstance(value, dict) or value.get("source") != "UmaUmaChecker" or
            value.get("format") != 1 or not isinstance(value.get("cards"), list)):
        raise ValueError("Invalid candidate-only inventory")
    counts = {}
    for card in value["cards"]:
        if not isinstance(card, dict) or not isinstance(card.get("events"), list):
            raise ValueError("Invalid candidate card")
        cid = positive_id(card.get("cardId"))
        if cid in counts or cid not in source_cards or source_cards[cid] not in ("SSR", "SR"):
            raise ValueError("Duplicate or unknown candidate card ID " + cid)
        for event in card["events"]:
            if not isinstance(event, dict) or not isinstance(event.get("sourceDigest"), str) or \
                    not event["sourceDigest"].startswith("sha256:"):
                raise ValueError("Invalid candidate-only event evidence")
        counts[cid] = len(card["events"])
    stats = value.get("stats")
    if not isinstance(stats, dict) or stats.get("matchedCards") != len(counts) or \
            stats.get("eventCount") != sum(counts.values()):
        raise ValueError("Candidate inventory totals are inconsistent")
    return counts


def audit(source_cards, master, candidate_counts=None):
    if not source_cards:
        raise ValueError("Empty UmaSim population")
    historic = master["card_ids"]
    stories = master["direct_stories"]
    shared_stories = master["shared_stories"]
    card_charas = master["card_chara_ids"]
    candidate_counts = candidate_counts if candidate_counts is not None else {}
    if not set(candidate_counts).issubset(source_cards):
        raise ValueError("Candidate references an unknown source card")

    rows = []
    by_rarity = {r: Counter() for r in ("SSR", "SR", "R")}
    for cid, rarity in sorted(source_cards.items()):
        present = cid in historic
        direct_set = stories.get(cid, set()) if present else set()
        chara_id = card_charas.get(cid) if present else None
        shared_set = shared_stories.get(chara_id, set()) if chara_id else set()
        direct = len(direct_set) if present else None
        shared = len(shared_set) if present else None
        combined = len(direct_set | shared_set) if present else None
        candidate = candidate_counts.get(cid) if rarity != "R" else None
        s = by_rarity[rarity]
        s["sourceCards"] += 1
        if present:
            s["historicalMasterCards"] += 1
            s["withDirectStories" if direct else "withoutDirectStories"] += 1
            s["directStoryIds"] += direct
            s["sharedStoryIdsAttributed"] += shared
            s["uniqueDirectOrSharedStoryIdsAttributed"] += combined
            s["withSharedStories" if shared else "withoutSharedStories"] += 1
            s["withAnyDirectOrSharedStories" if combined else "withoutAnyDirectOrSharedStories"] += 1
            if not chara_id:
                s["withoutCharacterIdJoin"] += 1
        else:
            s["notInHistoricalMaster"] += 1
        if candidate is not None:
            s["withCheckerCandidate"] += 1
            s["checkerCandidateRecords"] += candidate
            if present and direct > candidate:
                s["candidateLessThanDirectStory"] += 1
        rows.append({"cardId": cid, "rarity": rarity, "inHistoricalMaster": present,
                     "historicalDirectStories": direct,
                     "historicalSharedCharacterStories": shared,
                     "historicalDirectOrSharedStories": combined,
                     "checkerCandidateEvents": candidate})

    # This is a triage signal only. A master story ID is not guaranteed to
    # correspond to exactly one checker title; neither is a complete denominator.
    less = [r for r in rows if r["historicalDirectStories"] is not None
            and r["checkerCandidateEvents"] is not None
            and r["checkerCandidateEvents"] < r["historicalDirectStories"]]
    unknown = [r["cardId"] for r in rows if not r["inHistoricalMaster"]]
    no_stories = [r["cardId"] for r in rows if r["inHistoricalMaster"] and r["historicalDirectStories"] == 0]
    no_any = [r["cardId"] for r in rows if r["inHistoricalMaster"] and r["historicalDirectOrSharedStories"] == 0]
    return {
        "sourceCardCount": len(source_cards),
        "historicalMasterCardCount": master["master_card_count"],
        "historicalDirectStoryRows": master["eligible_story_rows"],
        "historicalSharedCharacterStoryRows": master["eligible_shared_rows"],
        "unusedSharedCharaCount": master["unused_shared_chara_count"],
        "orphansInHistoricalMaster": master["orphan_direct_card_ids"],
        "sourceNotInOldMasterCount": len(unknown),
        "sourceNotInOldMasterIds": unknown,
        "oldMasterWithoutCardDirectStoryCount": len(no_stories),
        "oldMasterWithoutCardDirectStoryIds": no_stories,
        "oldMasterWithoutDirectOrSharedStoryCount": len(no_any),
        "oldMasterWithoutDirectOrSharedStoryIds": no_any,
        "candidateSourceCards": len(candidate_counts),
        "candidateRecords": sum(candidate_counts.values()),
        "lessCandidateThanHistoricalDirectStoryCount": len(less),
        "possibleCardSpecificGaps": less,
        "byRarity": {rarity: dict(sorted(stats.items())) for rarity, stats in by_rarity.items()},
        "scope": "Historic gallery_flag=2 records split into support_card_id direct "
                 "and support_chara_id character-shared links (via support_card_data.chara_id). "
                 "Does not infer group multi-character links. Aggregated shared attribution "
                 "may count one event under multiple cards; per-card union deduplicates IDs. "
                 "Direct-only count deficits are triage cues, NOT complete-game event totals "
                 "or verified branch/choice/reward semantics."
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--umasim", type=Path, required=True)
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, help="Optional candidate-only JSON; never raw event text")
    parser.add_argument("--expect-source-count", type=int, default=0)
    parser.add_argument("--source-revision", required=True)
    parser.add_argument("--master-revision", required=True)
    parser.add_argument("--candidate-revision")
    args = parser.parse_args(argv)

    raw = args.umasim.read_text(encoding="utf-8")
    cards = read_source_cards(raw)
    if args.expect_source_count and len(cards) != args.expect_source_count:
        raise ValueError("UmaSim source card population drift")
    historical = read_master(args.master)
    candidate = read_candidates(args.candidate.read_text(encoding="utf-8"), cards) if args.candidate else None
    result = audit(cards, historical, candidate)
    result.update({
        "sourceRevision": args.source_revision, "masterRevision": args.master_revision,
        "candidateRevision": args.candidate_revision if args.candidate else None,
        "sourceSha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
        "masterSha256": hashlib.file_digest(args.master.open("rb"), "sha256").hexdigest()
    })
    # No card names, event names, option texts, effects, or source records.
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, sqlite3.Error, ValueError, json.JSONDecodeError) as e:
        print("EVENT MASTER AUDIT FAILED: " + str(e), file=sys.stderr)
        sys.exit(1)
