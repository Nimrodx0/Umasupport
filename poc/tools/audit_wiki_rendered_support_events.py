#!/usr/bin/env python3
"""Compare one public Wiki support page's numeric Training Events links to
a pinned 2025 master, without emitting Wiki event titles, rewards or HTML.

WARNING: Parsed Wiki HTML is a page render, NOT a dated master.mdb snapshot.
"""
from __future__ import annotations

import argparse
import hashlib
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import unquote

PINNED_OLD_SHA256 = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"
FOCUS_CARD = 30241
FOCUS_STORY = "830241004"
PAGE_TITLE = "Game:SSR Speed Symboli (導きの光)"
NINE_DIGITS = re.compile(r"(?<![0-9])[0-9]{9}(?![0-9])")


def old_direct_ids(path):
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True) as db:
        names = {row[1] for row in db.execute("PRAGMA table_info(single_mode_story_data)")}
        if not {"id", "story_id", "support_card_id", "gallery_flag"}.issubset(names):
            raise ValueError("Historical master lacks canonical story_id and card-link fields")
        rows = db.execute(
            "SELECT story_id FROM single_mode_story_data WHERE support_card_id=? AND gallery_flag=2",
            (FOCUS_CARD,),
        ).fetchall()
    vals = [str(row[0]) for row in rows]
    if not vals or any(not NINE_DIGITS.fullmatch(v) for v in vals) or len(set(vals)) != len(vals):
        raise ValueError("Historical master has invalid or duplicate story IDs")
    return set(vals)


class TrainingLinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.started = False
        self.finished = False
        self.section = None
        self.headings = []
        self.links = {"chain": set(), "other": set()}
        self.link_occurrences = {"chain": 0, "other": 0}
        self.ambiguous_links = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h2":
            if attrs.get("id") == "Training_Events":
                if self.started:
                    raise ValueError("Multiple Training Events sections")
                self.started = True
                self.section = None
                return
            if self.started:
                self.finished = True
                self.section = None
                return
        if not self.started or self.finished:
            return
        if tag == "h3":
            section = {"Event_Chain": "chain", "Other_Events": "other"}.get(attrs.get("id"))
            if section:
                if section in self.headings:
                    raise ValueError("Duplicated event-section heading")
                self.section = section
                self.headings.append(section)
            else:
                self.section = None
        if tag == "a" and self.section:
            href = attrs.get("href")
            if not isinstance(href, str):
                return
            found = set(NINE_DIGITS.findall(unquote(unescape(href))))
            if len(found) > 1:
                self.ambiguous_links += 1
            if len(found) == 1:
                self.links[self.section].update(found)
                self.link_occurrences[self.section] += 1


def parse_wiki_page(response):
    if not isinstance(response, dict) or set(response) != {"parse"}:
        raise ValueError("Unexpected public MediaWiki Parse API shape")
    page = response["parse"]
    if not isinstance(page, dict) or page.get("title") != PAGE_TITLE:
        raise ValueError("Unexpected Wiki support-card article")
    if not isinstance(page.get("revid"), int) or page["revid"] <= 0:
        raise ValueError("Missing Wiki page revision")
    html = page.get("text")
    if not isinstance(html, str) or not html.strip():
        raise ValueError("Missing parsed Training Events HTML")
    parser = TrainingLinkParser()
    parser.feed(html)
    parser.close()
    if not parser.started or not parser.finished or parser.headings != ["chain", "other"]:
        raise ValueError("Missing/changed Training Events or subsection boundaries")
    if parser.ambiguous_links:
        raise ValueError("Wiki event links contain ambiguous 9-digit IDs")
    chain, other = parser.links["chain"], parser.links["other"]
    if chain & other:
        raise ValueError("Wiki event story ID appears in multiple groups")
    if not chain and not other:
        raise ValueError("No numeric event links in parsed Wiki page")
    return {"revision": page["revid"], "chain": chain, "other": other,
            "linkOccurrences": parser.link_occurrences}


def compare(old_ids, page):
    ids = page["chain"] | page["other"]
    source_only = old_ids - ids
    page_only = ids - old_ids
    return {
        "scope": "Public rendered Wiki support-card page vs pinned 2025 master numeric story IDs, NOT a current SQLite snapshot or complete event-reward validation",
        "pageTitle": PAGE_TITLE,
        "pageRevision": page["revision"],
        "historicalMasterDirectStoryIds": len(old_ids),
        "wikiRenderedNumericEventIds": len(ids),
        "wikiChainIdCount": len(page["chain"]),
        "wikiOtherIdCount": len(page["other"]),
        "overlappingStoryIds": len(old_ids & ids),
        "onlyInOldMasterCount": len(source_only),
        "onlyInWikiRenderedPageCount": len(page_only),
        "onlyInOldMasterIds": sorted(source_only),
        "onlyInWikiRenderedPageIds": sorted(page_only),
        "historicalFocusStoryIdPresent": FOCUS_STORY in old_ids,
        "wikiPageLinksFocusStoryId": FOCUS_STORY in ids,
        "distinctLinkTargetsPerSection": page["linkOccurrences"],
        "caveat": "Page revision dates and current HTML do not establish the SQLite masterdata revision or current-game availability. These numeric links contain no verified choice rewards.",
    }


def main(argv=None):
    arg = argparse.ArgumentParser(description=__doc__)
    arg.add_argument("--old-master", type=Path, required=True)
    arg.add_argument("--page-json", type=Path, required=True)
    arg.add_argument("--strict-equal", action="store_true", help="Fail on differences in numeric ID sets")
    opts = arg.parse_args(argv)
    raw = opts.old_master.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != PINNED_OLD_SHA256:
        raise ValueError("Historical master differs from pinned 2025 SHA-256")
    old_ids = old_direct_ids(opts.old_master)
    if len(old_ids) != 18 or FOCUS_STORY not in old_ids:
        raise ValueError("Pinned 2025 master reference assumptions changed")
    page = parse_wiki_page(json.loads(opts.page_json.read_text(encoding="utf-8")))
    result = compare(old_ids, page)
    result["oldMasterSha256"] = digest
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if opts.strict_equal and (result["onlyInOldMasterCount"] or result["onlyInWikiRenderedPageCount"]):
        raise ValueError("Wiki rendered story links differ from the pinned master")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.DatabaseError, json.JSONDecodeError) as e:
        print("Read-only Wiki rendered event audit failed: " + str(e), file=sys.stderr)
        sys.exit(1)
