#!/usr/bin/env python3
"""Read-only coverage audit: pinned UmaSim card IDs vs Wiki Cargo Game_Supports.

This does NOT compare current game masters or event availability. Only integer
card-ID presence in two different publisher/community maintained indexes.
No source text, support titles or event text are emitted.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys

PINNED_UMASIM_SHA256 = "153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424"
CARD_ID = re.compile(r"^[123][0-9]{4}$")
STAGES = {0, 1, 2, 3, 4}
RARITY = {"1": "R", "2": "SR", "3": "SSR"}


def read_umasim(text):
    result = {}
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        fields = line.split("\t")
        if len(fields) < 60:
            raise ValueError(f"Malformed source row {lineno}")
        card, name, rarity, stage = fields[0], fields[1], fields[3], fields[4]
        if not CARD_ID.fullmatch(card) or not name or rarity not in RARITY:
            raise ValueError(f"Malformed card identity at source row {lineno}")
        if not stage.isdigit() or int(stage) not in STAGES:
            raise ValueError(f"Invalid stage at source row {lineno}")
        if card[0] != rarity:
            raise ValueError(f"Card ID/rarity mismatch at source row {lineno}")
        if card not in result:
            result[card] = {"rarity": RARITY[rarity], "name": name, "stages": set()}
        row = result[card]
        if row["rarity"] != RARITY[rarity] or row["name"] != name or int(stage) in row["stages"]:
            raise ValueError(f"Inconsistent or repeated stage for card ID {card}")
        row["stages"].add(int(stage))
    if not result or any(row["stages"] != STAGES for row in result.values()):
        raise ValueError("Every source card must have all five stages")
    return result


def read_wiki_pages(pages, page_size=500):
    if not pages or not isinstance(pages, list):
        raise ValueError("At least one Wiki page is required")
    ids = set()
    raw = 0
    invalid = []
    for offset, payload in enumerate(pages):
        if not isinstance(payload, dict) or set(payload) != {"cargoquery"} or not isinstance(payload["cargoquery"], list):
            raise ValueError(f"Unexpected Cargo API shape on page {offset}")
        records = payload["cargoquery"]
        if len(records) > page_size or (offset != len(pages) - 1 and len(records) != page_size):
            raise ValueError(f"Unexpected pagination on Wiki page {offset}")
        raw += len(records)
        for item in records:
            if not isinstance(item, dict) or not isinstance(item.get("title"), dict):
                raise ValueError("Malformed Cargo row")
            title = item["title"]
            # MediaWiki Cargo's API uses display names, not the SQL column keys.
            if set(title) != {"support id"}:
                raise ValueError("Unexpected Cargo support ID field")
            value = title["support id"]
            value = str(value) if isinstance(value, int) else value
            if not isinstance(value, str) or not value.isdigit():
                raise ValueError("Invalid numeric Wiki support ID")
            if value in ids:
                raise ValueError(f"Duplicate Wiki support ID {value}; possibly changing pagination")
            ids.add(value)
            if not CARD_ID.fullmatch(value):
                invalid.append(value)
    if len(pages[-1]["cargoquery"]) == page_size:
        raise ValueError("Last Wiki page is full: audit could be truncated")
    return ids, {"rows": raw, "nonStandardIdCount": len(invalid), "nonStandardNumericIds": sorted(invalid)[:20]}


def compare(source, wiki_ids, wiki_details):
    source_ids = set(source)
    recognized_wiki = {x for x in wiki_ids if CARD_ID.fullmatch(x)}
    overlap = source_ids & recognized_wiki
    source_only = source_ids - recognized_wiki
    wiki_only = recognized_wiki - source_ids
    by_rarity = {}
    for prefix, label in RARITY.items():
        s = {x for x in source_ids if x[0] == prefix}
        w = {x for x in recognized_wiki if x[0] == prefix}
        by_rarity[label] = {
            "sourceCards": len(s), "wikiPages": len(w),
            "sameNumericIds": len(s & w),
            "sourceOnly": len(s - w), "wikiOnly": len(w - s)
        }
    return {
        "scope": "Indexed numeric support IDs only; Wiki page presence is not 2026 game-master coverage, a reward validation, or permission to redistribute images/text.",
        "sourceCards": len(source_ids),
        "wikiCargo": wiki_details,
        "wikiStandardFiveDigitIds": len(recognized_wiki),
        "overlap": len(overlap),
        "sourceOnlyCount": len(source_only),
        "wikiOnlyCount": len(wiki_only),
        "sourceOnlyIds": sorted(source_only),
        "wikiOnlyIds": sorted(wiki_only),
        "byRarity": by_rarity,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--umasim", type=Path, required=True)
    parser.add_argument("--pages", type=Path, nargs="+", required=True)
    parser.add_argument("--expected-page-size", type=int, default=500)
    parser.add_argument("--source-revision", required=True)
    args = parser.parse_args(argv)
    if args.expected_page_size < 1 or args.expected_page_size > 500 or not args.source_revision.strip():
        parser.error("Expected a valid page size and nonempty revision")
    raw = args.umasim.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != PINNED_UMASIM_SHA256:
        raise ValueError("UmaSim input does not match the pinned source SHA-256")
    cards = read_umasim(raw.decode("utf-8"))
    wiki_pages = [json.loads(f.read_text(encoding="utf-8")) for f in args.pages]
    wiki_ids, details = read_wiki_pages(wiki_pages, args.expected_page_size)
    result = compare(cards, wiki_ids, details)
    if len(cards) != 563:
        raise ValueError("Pinned source expected exactly 563 support cards")
    result["sourceRevision"] = args.source_revision
    result["sourceSha256"] = digest
    result["wikiSnapshot"] = "Live Wiki Cargo Game_Supports; request time is NOT a pinned master revision."
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as e:
        print(f"Wiki ID audit rejected input: {e}", file=sys.stderr)
        raise SystemExit(1)
