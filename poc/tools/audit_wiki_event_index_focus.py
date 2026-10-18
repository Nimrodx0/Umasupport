#!/usr/bin/env python3
"""Compare a pinned 2025 master's numeric support-linked story IDs against
the Wiki's documented Game_Training_Event page index.

NOT a current-game event coverage audit. Missing Wiki pages do not imply that
a story was deleted or missing from the game or a different candidate dataset.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

OLD_SHA256 = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"
STORY_ID = re.compile(r"^[0-9]{9}$")
TARGET_CARD = "30241"
FOCUS_ID = "830241004"
CONTROL_ID = "830021001"


def read_old_direct_story_ids(path: Path, card_id=TARGET_CARD) -> set[str]:
    if not card_id.isascii() or not card_id.isdecimal():
        raise ValueError("Invalid target support card ID")
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True) as db:
        required = {"id", "support_card_id", "gallery_flag"}
        columns = {r[1] for r in db.execute("PRAGMA table_info(single_mode_story_data)")}
        if not required.issubset(columns):
            raise ValueError("Old master lacks the required story-ID columns")
        entries = db.execute(
            "SELECT id FROM single_mode_story_data WHERE support_card_id=? AND gallery_flag=2",
            (int(card_id),),
        ).fetchall()
    ids = [str(row[0]) for row in entries]
    if len(set(ids)) != len(ids) or any(not STORY_ID.fullmatch(value) for value in ids):
        raise ValueError("Invalid or duplicate historic story ID")
    return set(ids)


def read_index_ids(document: dict, limit: int) -> set[str]:
    if not isinstance(document, dict) or set(document) != {"cargoquery"}:
        raise ValueError("Invalid public Wiki Cargo event response")
    rows = document["cargoquery"]
    if not isinstance(rows, list) or len(rows) >= limit:
        raise ValueError("Wiki event query truncated or malformed")
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("title"), dict):
            raise ValueError("Invalid event Cargo row")
        fields = row["title"]
        if set(fields) != {"story id"}:
            raise ValueError("Unexpected public Wiki Cargo story field")
        value = fields["story id"]
        if isinstance(value, int):
            value = str(value)
        if not isinstance(value, str) or not STORY_ID.fullmatch(value):
            raise ValueError("Invalid numeric event story ID")
        if value in ids:
            raise ValueError("Duplicate Wiki story ID")
        ids.add(value)
    return ids


def compare(old_ids: set[str], wiki_focus: set[str], wiki_control: set[str]):
    if not old_ids or FOCUS_ID not in old_ids:
        raise ValueError("Focus story ID missing from historic master; assumptions changed")
    if not all(830241000 <= int(sid) < 830242000 for sid in wiki_focus):
        raise ValueError("Wiki response contains a story ID outside requested 30241 range")
    if not wiki_control.issubset({CONTROL_ID, FOCUS_ID}):
        raise ValueError("Control response includes unexpected story ID")
    if CONTROL_ID not in wiki_control:
        raise ValueError("Known documented positive control missing from Wiki index")
    both = old_ids & wiki_focus
    return {
        "scope": "2025 master support-linked gallery stories vs selectively documented Wiki training-event pages; NOT 2026 game event coverage.",
        "focusSupportCardId": TARGET_CARD,
        "oldDirectStoryCount": len(old_ids),
        "oldStoriesWithWikiEventPages": len(both),
        "oldStoriesWithoutWikiEventPages": len(old_ids - wiki_focus),
        "wikiEventPagesInFocusNumericRange": len(wiki_focus),
        "wikiFocusPageIdsNotInOldDirectSet": len(wiki_focus - old_ids),
        "oldFocusStoryId830241004": FOCUS_ID in old_ids,
        "wikiDocumentsFocusStoryId830241004": FOCUS_ID in wiki_focus,
        "knownWikiPositiveControl830021001": CONTROL_ID in wiki_control,
        "interpretation": "The community Wiki's page index is not an exhaustive game-master story index. Do not infer deletion, gameplay reachability, choice effects, or candidate-source omissions.",
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--old-master", required=True, type=Path)
    p.add_argument("--wiki-focus", required=True, type=Path)
    p.add_argument("--wiki-control", required=True, type=Path)
    p.add_argument("--source-revision", required=True)
    args = p.parse_args(argv)
    if not args.source_revision.strip():
        p.error("Source revision is required")
    digest = hashlib.sha256(args.old_master.read_bytes()).hexdigest()
    if digest != OLD_SHA256:
        raise ValueError("Historical master is not the pinned 2025 snapshot")
    old_ids = read_old_direct_story_ids(args.old_master)
    focus = read_index_ids(json.loads(args.wiki_focus.read_text()), 100)
    control = read_index_ids(json.loads(args.wiki_control.read_text()), 5)
    result = compare(old_ids, focus, control)
    if result["oldDirectStoryCount"] != 18:
        raise ValueError("Unexpected focus card story count in pinned master")
    result["historicRevision"] = args.source_revision
    result["historicSha256"] = digest
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, sqlite3.DatabaseError, OSError, json.JSONDecodeError) as e:
        print(f"Rejected Wiki story-page index comparison: {e}", file=sys.stderr)
        raise SystemExit(1)
