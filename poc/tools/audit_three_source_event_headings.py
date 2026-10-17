#!/usr/bin/env python3
"""Read-only three-source check for a support card's event-title headings.

The HTML is fetched only by the separately scoped workflow. Output contains
counts, numeric 2025 story IDs and non-content classifications, not titles,
source hashes, effects, or third-party HTML. This is NOT publication approval.
"""
from __future__ import annotations

import argparse
from collections import Counter
from html.parser import HTMLParser
import json
from pathlib import Path
import sys

from audit_historical_event_master import read_source_cards
from audit_story_title_links import read_candidate_titles, title_digest
from audit_story_residual_metadata import read_master_metadata

SECTIONS = ("連続イベント", "ランダムイベント")
TERMINATOR = "エピソード"
CARD_TITLE = "伝説の体現者"


class PageHeadings(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.level = None
        self.depth = 0
        self.parts = []
        self.headings = []
        self.visible_text = []  # only header text, never serialized

    def handle_starttag(self, tag, attrs):
        if self.level:
            self.depth += 1
        elif tag in ("h1", "h2", "h3", "h4"):
            self.level = tag
            self.depth = 1
            self.parts = []

    def handle_endtag(self, tag):
        if self.level is None:
            return
        if tag == self.level:
            heading = "".join(self.parts).strip()
            self.headings.append((self.level, heading))
            self.visible_text.append(heading)
            self.level = None
            self.depth = 0
            self.parts = []
        elif self.depth > 1:
            self.depth -= 1

    def handle_data(self, data):
        if self.level is not None:
            self.parts.append(data)


def parse_page_headings(html, *, card_title=CARD_TITLE):
    if not isinstance(html, str) or not html.strip():
        raise ValueError("External HTML unavailable")
    parser = PageHeadings()
    parser.feed(html)
    headings = parser.headings
    if not any(card_title in name for _, name in headings):
        raise ValueError("Expected target card heading missing")
    started = False
    section = None
    event_names = {s: [] for s in SECTIONS}
    seen_sections = set()
    done = False
    for level, name in headings:
        normalized = "".join(name.split())
        if normalized in SECTIONS:
            if done or normalized in seen_sections:
                raise ValueError("Unexpected repeated/out-of-order event sections")
            section = normalized
            seen_sections.add(section)
            started = True
        elif started and normalized == TERMINATOR:
            done = True
            section = None
            break
        elif section and level in ("h2", "h3"):
            if not normalized:
                raise ValueError("Empty event heading")
            event_names[section].append(name)
    if set(SECTIONS) != seen_sections or not done:
        raise ValueError("Event section start/end markers changed")
    return event_names


def classify_three_sources(historical_rows, checker_fingerprints, headings, *, focus="30241"):
    if not isinstance(headings, dict) or set(headings) != set(SECTIONS):
        raise ValueError("Unsupported external section schema")
    if focus not in historical_rows or focus not in checker_fingerprints:
        raise ValueError("Focus source card missing")
    ext = []
    sections = {}
    for s in SECTIONS:
        names = headings[s]
        if not isinstance(names, list) or not names:
            raise ValueError("Empty external event section")
        section_fp = [title_digest(name, "typography") for name in names]
        if any(x is None for x in section_fp):
            raise ValueError("Invalid external event title")
        sections[s] = len(section_fp)
        ext.extend(section_fp)
    old = historical_rows[focus]
    checker = checker_fingerprints[focus]
    if any(x is None for x in checker):
        raise ValueError("Empty Checker event title fingerprint")
    if any(x.get("fingerprint") is None for x in old):
        raise ValueError("Historical story has no title")
    ext_counts = Counter(ext)
    old_counts = Counter(x["fingerprint"] for x in old)
    checker_counts = Counter(checker)
    old_only_checker = old_counts - checker_counts
    residual = [x for x in old if old_only_checker[x["fingerprint"]]]
    residual_groups = sorted(set(x["fingerprint"] for x in residual))
    items = []
    for fingerprint in residual_groups:
        possibilities = sorted((x["storyId"] for x in old if x["fingerprint"] == fingerprint), key=int)
        items.append({
            "possibleHistoricalStoryIds": possibilities,
            "historicalTitleMultiplicity": old_counts[fingerprint],
            "checkerTitleMultiplicity": checker_counts[fingerprint],
            "externalTitleMultiplicity": ext_counts[fingerprint],
            "remainingHistoricalCount": old_only_checker[fingerprint],
            "presentOnExternalPage": ext_counts[fingerprint] > 0,
            "unambiguousHistoricalId": len(possibilities) == 1,
        })
    return {
        "focusCardId":focus,
        "historicalDirectRows":len(old),
        "checkerCandidateRecords":len(checker),
        "externalSectionCounts":sections,
        "externalHeadingCount":len(ext),
        "oldVsCheckerTypographicOverlap":sum((old_counts & checker_counts).values()),
        "oldVsExternalTypographicOverlap":sum((old_counts & ext_counts).values()),
        "checkerVsExternalTypographicOverlap":sum((checker_counts & ext_counts).values()),
        "externalTitlesAbsentFromChecker":sum((ext_counts - checker_counts).values()),
        "externalTitlesAbsentFromHistorical":sum((ext_counts - old_counts).values()),
        "historicalResidualInChecker":items,
        "provenance": "2025 independent historical SQLite and 2026-10-17 Checker candidate snapshot vs U-tools public support-card webpage; retrieval is a single per-PR GET.",
        "scope": "Title similarity only; live page revision date and source independence unknown. "
                 "A third site agreeing on a title does not confirm current in-game "
                 "availability, event route, skill reward, or publication rights.",
    }


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--umasim",required=True,type=Path)
    p.add_argument("--master",required=True,type=Path)
    p.add_argument("--candidates",required=True,type=Path)
    p.add_argument("--external-html",required=True,type=Path)
    p.add_argument("--focus",default="30241")
    args=p.parse_args(argv)
    cards=read_source_cards(args.umasim.read_text(encoding="utf-8"))
    if cards.get(args.focus)!="SSR":
        raise ValueError("Expected known SSR group card")
    checker=read_candidate_titles(args.candidates.read_text(encoding="utf-8"),cards,
                                  normalization="typography")
    master=read_master_metadata(args.master)
    headings=parse_page_headings(args.external_html.read_text(encoding="utf-8"))
    report=classify_three_sources(master,checker,headings,focus=args.focus)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0


if __name__=="__main__":
    try:
        sys.exit(main())
    except (OSError,ValueError,UnicodeError,json.JSONDecodeError) as exc:
        print("EXTERNAL TITLE TRIANGULATION FAILED:",type(exc).__name__,str(exc),file=sys.stderr)
        sys.exit(1)
