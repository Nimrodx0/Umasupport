#!/usr/bin/env python3
"""Identify unresolved historical story IDs by *title* fingerprints and read their metadata.

Read-only, pinned 2025 game master vs pinned 2026 Checker candidate inventory.
No raw story titles or their hashes are ever emitted. A title mismatch is NOT
proof that the story was absent from the game or has no Checker counterpart.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import json
from pathlib import Path
import sqlite3
import sys

from audit_historical_event_master import positive_id, read_source_cards
from audit_story_title_links import read_candidate_titles, title_digest

META_COLUMNS = ("show_progress_1", "show_progress_2", "show_progress_3",
                "event_category", "ending_type", "gallery_main_scenario", "gallery_condition")
TITLE_CATEGORY = 181


def _numeric(value, field):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Invalid historical numeric metadata: " + field)
    try:
        parsed = int(value)
    except (ValueError, TypeError) as exc:
        raise ValueError("Invalid historical numeric metadata: " + field) from exc
    if str(value).strip() != str(parsed):
        raise ValueError("Inexact historical numeric metadata: " + field)
    return parsed


def read_master_metadata(path):
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True) as db:
        for table, needed in (
            ("single_mode_story_data", set(META_COLUMNS) | {
                "id", "story_id", "support_card_id", "gallery_flag"}),
            ("text_data", {"category", "index", "text"}),
        ):
            present = db.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not present:
                raise ValueError("Missing historical table: " + table)
            have = {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}
            if not needed.issubset(have):
                raise ValueError("Missing historical columns in " + table + ": " +
                                 ", ".join(sorted(needed-have)))
        select_cols = ", ".join("s." + col for col in META_COLUMNS)
        sql = f"""SELECT s.id, s.story_id, s.support_card_id, {select_cols}, t.text
                 FROM single_mode_story_data s
                 LEFT JOIN text_data t ON t.category=? AND t."index"=s.story_id
                 WHERE s.gallery_flag=2 AND s.support_card_id>0
                 ORDER BY s.support_card_id, s.story_id"""
        seen_row_ids, seen_story_ids = set(), set()
        rows = defaultdict(list)
        for record in db.execute(sql, (TITLE_CATEGORY,)):
            internal_id, story_id, card_id, *rest = record
            text = rest.pop()
            internal_id, story_id, card_id = map(positive_id,
                                                 (internal_id, story_id, card_id))
            if internal_id in seen_row_ids or story_id in seen_story_ids:
                raise ValueError("Duplicate historical row ID / story ID or text join")
            seen_row_ids.add(internal_id)
            seen_story_ids.add(story_id)
            if text is None or title_digest(text, "typography") is None:
                raise ValueError("Missing historical story title (cannot classify)")
            metadata = {k: _numeric(v, k) for k, v in zip(META_COLUMNS, rest)}
            rows[card_id].append({
                "storyId": story_id, "rowId": internal_id,
                "fingerprint": title_digest(text, "typography"),
                "meta": metadata,
            })
        return rows


def compare_residuals(source_cards, candidates, historical, *, focus="30241"):
    if focus not in source_cards or source_cards[focus] not in ("SSR", "SR"):
        raise ValueError("Focus card not in supported rarity population")
    if not set(candidates).issubset(source_cards):
        raise ValueError("Candidates reference non-source cards")
    if not set(historical).issubset(source_cards):
        raise ValueError("Historical story references non-source cards")
    stat = Counter()
    by_category = defaultdict(Counter)
    focus_groups = []
    outlying_cards = []
    for cid, rarity in sorted(source_cards.items()):
        if rarity not in ("SSR", "SR"):
            continue
        if cid not in candidates:
            raise ValueError("Missing candidate card in SSR/SR population " + cid)
        cand_counts = Counter(x for x in candidates[cid] if x is not None)
        master_groups = defaultdict(list)
        for row in historical.get(cid, []):
            master_groups[row["fingerprint"]].append(row)
        matched = 0
        residual = 0
        ambiguous = 0
        card_categories = Counter()
        for digest, stories in master_groups.items():
            stories.sort(key=lambda x: int(x["storyId"]))
            overlaps = min(len(stories), cand_counts[digest])
            matched += overlaps
            left = len(stories) - overlaps
            if left == 0:
                continue
            residual += left
            ambiguous += left if overlaps else 0
            cats = sorted({r["meta"]["event_category"] for r in stories},
                          key=lambda x: (-1 if x is None else x))
            for c in cats:
                card_categories[str(c)] += left if len(cats)==1 else 0
            # Do not emit hashes or story titles. If there were multiple old
            # stories with the same title, any one might be the unmatched one.
            if cid == focus:
                focus_groups.append({
                    "unmatchedCount": left,
                    "possibleStoryIds": [s["storyId"] for s in stories],
                    "ambiguousIdentity": overlaps > 0,
                    "historicalTitleMultiplicity": len(stories),
                    "candidateTitleMultiplicity": cand_counts[digest],
                    "metadata": [
                        {"storyId": s["storyId"], **s["meta"]} for s in stories
                    ],
                })
            for story in stories:
                # Unambiguous title absent from candidate -> known residue.
                # Ambiguous duplicate groups are counted separately.
                if overlaps == 0:
                    by_category[str(story["meta"]["event_category"])]["unmatchedTitleRows"] += 1
                else:
                    by_category[str(story["meta"]["event_category"])]["ambiguousGroupRows"] += 1
        stat["historicalStoryRowsSSR_SR"] += sum(map(len, master_groups.values()))
        stat["candidateEventsSSR_SR"] += len(candidates[cid])
        stat["provisionalTypographyMatches"] += matched
        stat["unmatchedHistoricalTitleRows"] += residual
        stat["ambiguousResidualCount"] += ambiguous
        if residual:
            stat["cardsWithUnmatchedHistoricalTitles"] += 1
            outlying_cards.append({"cardId":cid,"rarity":rarity,
                                  "unmatchedHistoricalTitleRows":residual,
                                  "provisionalTypographyMatches":matched,
                                  "candidateEvents":len(candidates[cid])})
        if cid == focus:
            focus_result = {
                "cardId":cid, "rarity":rarity,
                "historicalStoryCount":sum(map(len,master_groups.values())),
                "candidateCount":len(candidates[cid]),
                "provisionalTypographyMatches":matched,
                "unmatchedHistoricalTitleRows":residual,
                "residualGroups":sorted(focus_groups,
                      key=lambda group:int(group["possibleStoryIds"][0])),
            }
    return {
        "focus":focus_result,
        "allSSR_SR":dict(sorted(stat.items())),
        "residualMetadataByEventCategory": {
            k:dict(sorted(v.items())) for k,v in sorted(by_category.items())
        },
        "outlyingCardIds":outlying_cards,
        "explanation":"Every residual group is a typographic title-multiset difference, "
            "NOT verified event omission. Story IDs are from historical 2025 master. "
            "Metadata fields are numeric, not interpreted as gameplay conditions; "
            "shared character events, new cards, branch/reward semantics and "
            "publication permission are excluded.",
    }


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--umasim",required=True,type=Path)
    ap.add_argument("--master",required=True,type=Path)
    ap.add_argument("--candidates",required=True,type=Path)
    ap.add_argument("--focus",default="30241")
    ap.add_argument("--focus-only",action="store_true")
    args=ap.parse_args(argv)
    cards=read_source_cards(args.umasim.read_text(encoding="utf-8"))
    candidates=read_candidate_titles(args.candidates.read_text(encoding="utf-8"),
                                     cards,normalization="typography")
    old=read_master_metadata(args.master)
    result=compare_residuals(cards,candidates,old,focus=args.focus)
    if args.focus_only:
        result.pop("outlyingCardIds")
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    try:
        sys.exit(main())
    except (OSError,ValueError,sqlite3.Error,json.JSONDecodeError) as e:
        print("STORY RESIDUAL AUDIT ERROR:",type(e).__name__,str(e),file=sys.stderr)
        sys.exit(1)
