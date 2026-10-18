#!/usr/bin/env python3
"""Read-only, bounded event title to numeric story_id binding check for SSR30311.

This verifies the RENDERED community Wiki page pairs the five Japanese
event titles (also observed in the GameWith page) with the five story IDs.
It does NOT check the current game's master revision or event outcomes.
Prints IDs/status only; never republishes Wiki HTML or event/choice prose.
"""
from __future__ import annotations
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys

import audit_wiki_rendered_support_events as wiki

# Five short event identifiers/titles, NOT training event dialogue/choice text.
# GameWith SSR30311 article as of 2026-10-08 lists these in the same groups.
EXPECTED_GROUPS = {
    "chain": [
        ("淑女、粛々と読書中", "830311001"),
        ("運命の暴走散歩道", "830311002"),
        ("『運命』のライバル", "830311003"),
    ],
    "other": [
        ("運命と共同体な淑女", "801146001"),
        ("運命共同体な僕ら", "801146002"),
    ],
}
NINE_DIGITS = re.compile(r"(?<!\d)\d{9}(?!\d)")

class PositionReader(wiki.TrainingLinkParser):
    """Retain visible-text-relative link positions in the existing scoped parser."""
    def __init__(self):
        super().__init__()
        self.visible = {"chain": "", "other": ""}
        self.positions = {"chain": [], "other": []}

    def handle_starttag(self, tag, attrs):
        super().handle_starttag(tag, attrs)
        if not self.started or self.finished or not self.section or tag != "a":
            return
        href = dict(attrs).get("href") or ""
        candidates = set(NINE_DIGITS.findall(href))
        if len(candidates) == 1:
            self.positions[self.section].append(
                (len(self.visible[self.section]), next(iter(candidates))))

    def handle_data(self, data):
        if self.started and not self.finished and self.section:
            self.visible[self.section] += data

def audit_title_links(payload):
    rendered = wiki.parse_wiki_page(payload, wiki.RECENT_PAGE_TITLE)
    reader = PositionReader()
    reader.feed(payload["parse"]["text"])
    reader.close()
    pairs = {}
    for section, expected in EXPECTED_GROUPS.items():
        visible = reader.visible[section]
        links = reader.positions[section]
        if len(links) != len(expected):
            raise ValueError(f"{section}: expected {len(expected)} links, found {len(links)}")
        for index, (title, story_id) in enumerate(expected):
            first = visible.find(title)
            if first < 0 or visible.find(title, first + 1) >= 0:
                raise ValueError(f"{section}: missing/duplicate expected title in rendered page at position {index+1}")
            last = first + len(title)
            if index+1 < len(expected):
                next_title = expected[index+1][0]
                next_first = visible.find(next_title)
                if next_first <= last:
                    raise ValueError(f"{section}: event heading ordering changed")
            else:
                next_first = len(visible)
            linked = [sid for pos, sid in links if last <= pos < next_first]
            if linked != [story_id]:
                raise ValueError(f"{section}: numeric story link does not belong to event title {index+1}")
            if story_id in pairs:
                raise ValueError(f"duplicate candidate story ID {story_id}")
            pairs[story_id] = {"section": section, "ordinal": index+1}
    all_ids = rendered["chain"] | rendered["other"]
    if set(pairs) != all_ids or len(pairs) != 5:
        raise ValueError("extra/missing story IDs compared to rendered Wiki section inventory")
    return {
        "pageTitle": wiki.RECENT_PAGE_TITLE,
        "pageRevision": rendered["revision"],
        "namedEventStoryIdPairs": len(pairs),
        "chain": len(rendered["chain"]),
        "other": len(rendered["other"]),
        "orderedStoryIds": [
            sid for section in ("chain","other") for _, sid in EXPECTED_GROUPS[section]
        ],
        "articleTitleToIdBinding": "matched rendered wiki order and links",
        "doesNotProve": ["official 2026 master revision", "in-game selection/termination",
                         "event rewards", "data republication rights"],
    }

def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--page-json", type=Path, required=True,
                   help="Previously fetched, bounded public MediaWiki Parse API response")
    args = p.parse_args(argv)
    result = audit_title_links(json.loads(args.page_json.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        print("SSR30311 Wiki title-link binding FAILED:",exc,file=sys.stderr)
        raise SystemExit(1)
