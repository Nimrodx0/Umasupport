#!/usr/bin/env python3
"""Validate public Umamusume Wiki's own masterdata-to-Cargo missing-page list.

This reads ONE public action=expandtemplates API response of the already public
Module:Game/Contribution.listMissing function. It only establishes whether
the Wiki's configured JP masterdata exposes cards missing from its Cargo page
index at request time. It does not export SQLite or establish a game-data version.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import re
import sys

SECTIONS = re.compile(r"^===\s+(Cards|Supports)\s+===$", re.M)
ID_IN_PARENS = re.compile(r"\(([0-9]{5,8})\)\s*$")
CARD_ID = re.compile(r"^[123][0-9]{4}$")


def parse_missing_list(document):
    if not isinstance(document, dict) or set(document) != {"expandtemplates"}:
        raise ValueError("MediaWiki template expansion did not return the expected object")
    result = document["expandtemplates"]
    if not isinstance(result, dict) or not isinstance(result.get("wikitext"), str):
        raise ValueError("Missing Wiki template expansion wikitext")
    raw = result["wikitext"]
    if len(raw) > 250_000 or "Lua error" in raw or "ExternalData query error" in raw:
        raise ValueError("Unsafe or failed backend template response")
    matches = list(SECTIONS.finditer(raw))
    if len(matches) != 2 or [m.group(1) for m in matches] != ["Cards", "Supports"]:
        raise ValueError("Expected both Cards and Supports section markers in order")
    if raw[:matches[0].start()].strip() or raw[matches[1].end():].strip().startswith("==="):
        raise ValueError("Unexpected wrapper or an extra data section")
    out = {}
    for i, match in enumerate(matches):
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[start:end].strip()
        if body == "Up to date!":
            out[match.group(1)] = {"missing": [], "status": "none_reported"}
            continue
        ids = []
        if not body:
            raise ValueError("Empty missing-card section without an explicit status")
        for line in body.splitlines():
            line = line.strip()
            if not line:
                continue
            # Wiki Module:Game/Contribution prints a content/template name and
            # a numeric id in parentheses at the end. Do NOT output the name.
            result = ID_IN_PARENS.search(line)
            if not result:
                raise ValueError("Unexpected or unparseable Wiki missing-card line")
            ids.append(result.group(1))
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate numeric IDs in missing-card output")
        if not ids:
            raise ValueError("No numeric missing IDs could be established")
        out[match.group(1)] = {"missing": sorted(ids), "status": "ids_reported"}
    for card_id in out["Supports"]["missing"]:
        if not CARD_ID.fullmatch(card_id):
            raise ValueError("Unexpected support ID width or rarity prefix")
    return {
        "scope": "Public Wiki JP masterdata missing-from-Cargo one-way check. Neither current game-master snapshot/version nor Wiki page-to-master reverse comparison.",
        "cards": {"status": out["Cards"]["status"], "missingCount": len(out["Cards"]["missing"])},
        "supports": {"status": out["Supports"]["status"], "missingCount": len(out["Supports"]["missing"]),
                     "numericMissingIds": out["Supports"]["missing"]},
        "interpretation": "If zero: all JP masterdata support IDs selected by Wiki's id<9000000 filter are present in its Cargo page index at query time. Not proof that Wiki and the game have every latest card."
    }


def main():
    arg = argparse.ArgumentParser()
    arg.add_argument("--response", type=Path, required=True)
    args = arg.parse_args()
    result = parse_missing_list(json.loads(args.response.read_text(encoding="utf-8")))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print("Cannot attest Wiki masterdata-to-Cargo coverage: "+str(exc), file=sys.stderr)
        sys.exit(1)
