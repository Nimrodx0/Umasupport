#!/usr/bin/env python3
"""Batch planned/offline editorial import for every pinned UmaSim support card.

Never performs HTTP requests. Local source excerpts must be supplied by an
authorized process. Produces reports/proposals, NEVER modifies reviewed DB.
"""
import argparse
import hashlib
import json
from pathlib import Path

from import_gamewith_article import article_to_facts, compare, registry, roster, MAX_BYTES


def plan_and_import(cards, index, skills, input_dir: Path, output_dir: Path,
                    draft_root: Path):
    entries = index.get("cards", [])
    by_card = {}
    for row in entries:
        cid = row.get("cardId")
        if cid in by_card or cid not in cards:
            raise ValueError("duplicate or unrecognized indexed card: " + str(cid))
        url = row.get("primaryArticle", "")
        import re
        if not re.fullmatch(r"https://gamewith\.jp/uma-musume/article/show/[1-9]\d+", url):
            raise ValueError("invalid GameWith source URL: " + str(cid))
        by_card[cid] = row
    summaries = []
    for cid in sorted(cards, key=int):
        card = cards[cid]
        info = {"cardId": cid, "rarity": card["rarity"],
                "sourceIndexed": cid in by_card, "status": "no-source-link"}
        if cid not in by_card:
            summaries.append(info)
            continue
        matches = [input_dir / (cid + suffix) for suffix in (".md", ".txt", ".html", ".htm")
                   if (input_dir / (cid + suffix)).is_file()]
        if not matches:
            info["status"] = "no-local-article"
            summaries.append(info)
            continue
        if len(matches) != 1:
            info["status"] = "ambiguous-local-source"
            summaries.append(info)
            continue
        path = matches[0]
        raw = path.read_bytes()
        if not raw or len(raw) > MAX_BYTES:
            info["status"] = "invalid-source-size"
            summaries.append(info)
            continue
        try:
            decoded = raw.decode("utf-8-sig")
            result = article_to_facts(decoded, cid, card, skills)
            rel = by_card[cid]["draftFile"]
            if not re.fullmatch(r"poc/data/(?:curation/drafts|preview)/[a-zA-Z0-9_.-]+\.json", rel):
                raise ValueError("invalid indexed draft path")
            old = draft_root / rel
            existing = json.loads(old.read_text("utf-8")) if old.is_file() else None
            result["comparison"] = compare(existing, result["proposal"])
            result["evidence"] = {
                "sourceArticle": by_card[cid]["primaryArticle"],
                "localInputSha256": hashlib.sha256(raw).hexdigest()
            }
            output_dir.mkdir(parents=True, exist_ok=True)
            (output_dir / (cid + ".proposal.json")).write_text(
                json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
            info.update(status="proposal-needs-review",
                        proposalEvents=result["proposedEvents"],
                        reviewRequired=len(result["reviewRequired"]),
                        diff=result["comparison"]["status"])
        except (ValueError, KeyError, TypeError, UnicodeError, IndexError) as exc:
            info.update(status="rejected-input", reason=type(exc).__name__)
        summaries.append(info)

    totals = {"rosterCards": len(cards), "indexedCards": len(by_card),
              "withoutIndexedSource": len(cards) - len(by_card)}
    for item in summaries:
        name = item["status"]
        totals[name] = totals.get(name, 0) + 1
    return {"schemaVersion": 1, "summary": totals, "cards": summaries,
            "releaseStatus": "all proposals, no automatic promotion"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--support-card", type=Path, required=True)
    parser.add_argument("--skill-data", type=Path, required=True)
    parser.add_argument("--index", type=Path, default=Path("poc/data/curation/source_index.v1.json"))
    parser.add_argument("--supplemental", type=Path, default=Path("poc/data/curation/supplemental_skills.v1.json"))
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--repository-root", type=Path, default=Path("."))
    args = parser.parse_args()
    if args.out_dir.resolve() == args.input_dir.resolve():
        parser.error("cannot overwrite local article source directory")
    cards = roster(args.support_card.read_text("utf-8"))
    skills = registry(args.skill_data.read_text("utf-8"),
                      json.loads(args.supplemental.read_text("utf-8")))
    result = plan_and_import(cards, json.loads(args.index.read_text("utf-8")),
                             skills, args.input_dir, args.out_dir, args.repository_root)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "batch-report.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
