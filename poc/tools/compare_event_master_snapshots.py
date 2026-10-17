#!/usr/bin/env python3
"""Compare 2025/other SQLite masters by numeric card/story IDs, no text export.

The later snapshot is ONLY as trustworthy as its independently documented source
and revision; this tool does not download, decrypt or bypass any game data.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3
import sys

from audit_historical_event_master import positive_id, read_source_cards
from audit_story_residual_metadata import read_master_metadata

FOCUS_STORY_ID = "830241004"
FOCUS_CARD_ID = "30241"
PINNED_OLD_SHA = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"


def sha256_file(path):
    digest=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot(path):
    # Read-only SQLite; schema validation is strict, no assumptions about names.
    with sqlite3.connect(path.resolve().as_uri()+"?mode=ro",uri=True) as db:
        table=db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='support_card_data'").fetchone()
        if table is None:
            raise ValueError("Missing support_card_data")
        cols={c[1] for c in db.execute("PRAGMA table_info(support_card_data)")}
        if "id" not in cols:
            raise ValueError("Missing support_card_data.id")
        card_ids=set()
        for row in db.execute("SELECT id FROM support_card_data"):
            card=positive_id(row[0])
            if card in card_ids:
                raise ValueError("Duplicate support card numeric ID")
            card_ids.add(card)
        events=read_master_metadata(path)
        for card,stories in events.items():
            if card not in card_ids:
                raise ValueError("Story linked to support card missing in master card table")
        story_by_id={}
        for cid,stories in events.items():
            for story in stories:
                sid=story["storyId"]
                if sid in story_by_id:
                    raise ValueError("Duplicate master story_id after join")
                story_by_id[sid]={"cardId":cid,
                                  "fingerprint":story["fingerprint"],
                                  "meta":story["meta"]}
        return {"cards":card_ids,"byStory":story_by_id,
                "directCount":len(story_by_id),"cardWithDirectStories":len(events)}


def compare(source_cards,old,new,*,focus_story=FOCUS_STORY_ID,focus_card=FOCUS_CARD_ID):
    if not source_cards or focus_card not in source_cards:
        raise ValueError("Missing focused source card")
    source=set(source_cards)
    old_ids, new_ids=old["cards"]&source,new["cards"]&source
    focus_old=old["byStory"].get(focus_story)
    focus_new=new["byStory"].get(focus_story)
    focus_card_old=focus_card in old_ids
    focus_card_new=focus_card in new_ids
    preserved=old["byStory"].keys() & new["byStory"].keys()
    metadata_changed=sum(
        old["byStory"][sid]["meta"]!=new["byStory"][sid]["meta"]
        for sid in preserved
    )
    title_changed=sum(
        old["byStory"][sid]["fingerprint"]!=new["byStory"][sid]["fingerprint"]
        for sid in preserved
    )
    reassigned=sum(
        old["byStory"][sid]["cardId"]!=new["byStory"][sid]["cardId"]
        for sid in preserved
    )
    categories={}
    for rarity in ("SSR","SR","R"):
        ids={cid for cid,r in source_cards.items() if r==rarity}
        categories[rarity]={
            "sourceCards":len(ids),
            "oldOverlaps":len(ids & old_ids),
            "newOverlaps":len(ids & new_ids),
            "previouslyAbsentNowPresent":len(ids & (new_ids-old_ids)),
            "previouslyPresentNowAbsent":len(ids & (old_ids-new_ids))
        }
    return {
        "sourceCards":len(source),
        "oldMasterCardsIntersectSource":len(old_ids),
        "newMasterCardsIntersectSource":len(new_ids),
        "oldNotInSource":len(old["cards"]-source),
        "newNotInSource":len(new["cards"]-source),
        "oldMissingSourceCards":len(source-old_ids),
        "newMissingSourceCards":len(source-new_ids),
        "previouslyAbsentNowPresentSourceCardIds":sorted(new_ids-old_ids),
        "previouslyPresentNowAbsentSourceCardIds":sorted(old_ids-new_ids),
        "byRarity":categories,
        "oldDirectStoryRows":old["directCount"],
        "newDirectStoryRows":new["directCount"],
        "preservedDirectStoryIds":len(preserved),
        "historicalDirectStoryIdsNotInNew":len(old["byStory"].keys()-new["byStory"].keys()),
        "newDirectStoryIdsNotInOld":len(new["byStory"].keys()-old["byStory"].keys()),
        "preservedIdTypographicTitleChanged":title_changed,
        "preservedIdMetadataChanged":metadata_changed,
        "preservedIdReassignedSupportCard":reassigned,
        "focus":{
            "cardId":focus_card,"storyId":focus_story,
            "oldCardPresent":focus_card_old,
            "newCardPresent":focus_card_new,
            "oldStoryPresent":focus_old is not None,
            "newStoryPresent":focus_new is not None,
            "oldStoryOnFocusCard":focus_old is not None and focus_old["cardId"]==focus_card,
            "newStoryOnFocusCard":focus_new is not None and focus_new["cardId"]==focus_card,
            "titleSameAfterTypographyNormalization":(
                focus_old["fingerprint"]==focus_new["fingerprint"]
                if focus_old and focus_new else None),
            "numericMetadataIdentical":(
                focus_old["meta"]==focus_new["meta"]
                if focus_old and focus_new else None),
            "oldNumericMetadata": focus_old["meta"] if focus_old else None,
            "newNumericMetadata": focus_new["meta"] if focus_new else None,
        },
        "scope":"Source snapshot ID inventory and loose-title fingerprint comparison only. "
                "Older/newer does not prove 2026 production gameplay or event "
                "reachability. A story ID's absence from the second snapshot "
                "could reflect deletion, schema filtering or data provenance. "
                "No event dialogue, headline, effect, option, or fingerprint is published.",
    }


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--umasim",type=Path,required=True)
    p.add_argument("--old-master",type=Path,required=True)
    p.add_argument("--new-master",type=Path,required=True)
    p.add_argument("--new-revision",required=True,
                   help="Human-audited provenance/date of supplied later snapshot")
    p.add_argument("--expected-old-sha256",default=PINNED_OLD_SHA)
    p.add_argument("--focus-card",default=FOCUS_CARD_ID)
    p.add_argument("--focus-story",default=FOCUS_STORY_ID)
    args=p.parse_args(argv)
    if not args.new_revision.strip():
        raise ValueError("Missing provenance for newer master")
    if args.old_master.resolve()==args.new_master.resolve():
        raise ValueError("Two different snapshot files are required")
    oldsha=sha256_file(args.old_master)
    newsha=sha256_file(args.new_master)
    if oldsha==newsha:
        raise ValueError("No distinct master revision supplied")
    if args.expected_old_sha256 and oldsha!=args.expected_old_sha256:
        raise ValueError("Historical snapshot SHA mismatch")
    cards=read_source_cards(args.umasim.read_text(encoding="utf-8"))
    result=compare(cards,snapshot(args.old_master),snapshot(args.new_master),
                   focus_story=positive_id(args.focus_story),
                   focus_card=positive_id(args.focus_card))
    result.update({
        "oldSha256":oldsha,"newSha256":newsha,
        "newRevisionLabelProvidedByOperator":args.new_revision,
    })
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    try:
        sys.exit(main())
    except (ValueError,sqlite3.Error,OSError) as e:
        print("MASTER SNAPSHOT COMPARISON FAILED:",type(e).__name__,str(e),file=sys.stderr)
        sys.exit(1)
