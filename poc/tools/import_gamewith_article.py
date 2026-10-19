#!/usr/bin/env python3
"""Offline, fail-closed GameWith article importer. NEVER fetches any URL.

Consumes an operator-supplied local plain-text/Markdown/HTML excerpt and
produces original numeric event facts only. All results are proposals, not
approved game data. Raw article text is never included in JSON output.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from typing import Any

SKILL = re.compile(r"[『「](.+?)[』」]\s*のヒント\s*Lv\s*[+＋]\s*(\d+)")
HEADING = re.compile(r"^\s*(#{2,5})\s*(.*?)\s*$")
CHOICE = re.compile(r"^\s*(.*?)\s+\|\s+(.+?)\s*$")
EVENT_SECTION = "発生イベントと選択肢一覧"
EVENT_TYPES = {"通常イベント": "normal", "連続イベント": "chain"}
UNSAFE = re.compile(r"大成功|成功|失敗|ランダム|確率|打ち切り|進行しない|次に進|継続する|継続しない")
CARD_TITLE = re.compile(r"ウマ娘.*\((R|SR|SSR)[^)]*サポート\)")
MAX_BYTES = 450_000


class ArticleBlocks(HTMLParser):
    """Converts local h2/h3/h4 and table rows to bounded article text."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.blocks: list[str] = []
        self.capture = None
        self.chunks: list[str] = []
        self.cells: list[str] = []
        self.in_cell = False
        self.row = False
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg", "noscript"):
            self.ignored += 1
        if self.ignored:
            return
        if tag in ("h2", "h3", "h4"):
            self.capture = tag
            self.chunks = []
        elif tag == "tr":
            self.row = True
            self.cells = []
        elif tag in ("th", "td") and self.row:
            self.in_cell = True
            self.chunks = []

    def handle_data(self, data):
        if not self.ignored and (self.capture or self.in_cell):
            self.chunks.append(data)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "noscript") and self.ignored:
            self.ignored -= 1
            return
        if self.ignored:
            return
        if tag == self.capture:
            prefix = {"h2": "##", "h3": "###", "h4": "####"}[tag]
            self.blocks.append(f"{prefix} {''.join(self.chunks).strip()}")
            self.capture = None
        elif tag in ("th", "td") and self.in_cell:
            self.cells.append("".join(self.chunks).strip())
            self.in_cell = False
        elif tag == "tr" and self.row:
            if len(self.cells) == 2:
                self.blocks.append(" | ".join(self.cells))
            self.row = False

    def text(self):
        return "\n".join(self.blocks)


def normalize(name: str) -> str:
    import unicodedata
    return unicodedata.normalize("NFKC", name).replace("◯", "○").replace("〇", "○").strip()


def roster(support_text: str) -> dict[str, dict]:
    cards = {}
    for line in support_text.splitlines():
        fields = line.split("\t")
        if len(fields) < 60 or fields[4] != "0":
            continue
        card_id = fields[0]
        if not re.fullmatch(r"\d{5}", card_id) or card_id in cards:
            raise ValueError("invalid or duplicate pinned support card ID")
        rarity = {"1": "R", "2": "SR", "3": "SSR"}.get(fields[3])
        if not rarity:
            raise ValueError(f"invalid rarity: {card_id}")
        cards[card_id] = {"name": fields[2], "title": fields[1],
                          "rarity": rarity}
    if not cards:
        raise ValueError("no pinned support cards found")
    return cards


def registry(skill_text: str, supplemental: dict) -> dict[str, list[dict]]:
    records = json.loads(skill_text)
    if not isinstance(records, list) or len(records) < 100:
        raise ValueError("invalid full numeric skill dictionary")
    skills = {}
    ids = {}
    for rec in records:
        key = normalize(rec["name"])
        if rec["id"] in ids:
            raise ValueError("duplicated full-registry numeric ID")
        ids[rec["id"]] = rec
        if rec["rarity"] in ("normal", "rare"):
            skills.setdefault(key, []).append(rec)
    if supplemental.get("schemaVersion") != 1 or not isinstance(supplemental.get("skills"), list):
        raise ValueError("invalid supplemental version")
    for rec in supplemental["skills"]:
        if rec.get("scope") != "curation-only" or not re.fullmatch(r"[1-9]\d*", rec["id"]):
            raise ValueError("unapproved supplemental record")
        key = normalize(rec["name"])
        if rec["id"] in ids:
            original = ids[rec["id"]]
            if normalize(original["name"]) != key or original["rarity"] != rec["rarity"]:
                raise ValueError("conflicting supplemental ID")
            continue
        if skills.get(key):
            raise ValueError("conflicting supplemental name")
        skills[key] = [rec]
        ids[rec["id"]] = rec
    return skills


def reward(name: str, level: int, skills: dict) -> dict:
    if not name.strip() or level < 1 or level > 10:
        raise ValueError("invalid skill reward")
    matched = skills.get(normalize(name), [])
    if len(matched) == 1:
        rec = matched[0]
        return {"skillId": "skill:" + rec["id"],
                "verifiedSkillName": rec["name"], "level": level}
    return {"skillName": name, "level": level}


def article_to_facts(text: str, card_id: str, card: dict,
                     skills: dict) -> dict:
    if "<html" in text[:1000].lower() or "<h2" in text[:15000].lower():
        parser = ArticleBlocks()
        parser.feed(text)
        text = parser.text()
    lines = text.replace("\r\n", "\n").split("\n")
    intro = "\n".join(lines[:65])
    if card["name"] not in intro or not any(
        f"({r}サポート)" in intro or f"({r}サポート" in intro
        for r in (card["rarity"],)
    ):
        raise ValueError("GameWith article character/rarity does not match pinned support card")
    # For non-R, require support-card epithet. Character-only agreement is unsafe.
    if card["rarity"] != "R":
        epithet = card["title"].split("]")[0].lstrip("[")
        if epithet and epithet not in intro:
            raise ValueError("article does not identify SR/SSR support-card epithet")
    if not any(EVENT_SECTION in l for l in lines):
        raise ValueError("event-list section is missing; no silent zero-event import")

    entered = False
    mode = None
    events = []
    current = None
    row = None
    def finish():
        nonlocal current, row
        if current is None:
            return
        if row is not None:
            current["rows"].append(row)
            row = None
        events.append(current)
        current = None

    for line in lines:
        m = HEADING.match(line)
        if m:
            heading, title = len(m.group(1)), m.group(2)
            if not entered:
                if EVENT_SECTION in title:
                    entered = True
                continue
            if heading <= 2 and EVENT_SECTION not in title:
                finish()
                break
            if heading == 3:
                finish()
                mode = EVENT_TYPES.get(title)
                continue
            if heading == 4 and mode is not None:
                finish()
                current = {"mode": mode, "rows": [], "raw": []}
                continue
        if not entered or current is None:
            continue
        if line.strip() == "詳細を見る":
            continue
        current["raw"].append(line)
        c = CHOICE.match(line)
        if c and c.group(1).strip():
            if row is not None:
                current["rows"].append(row)
            row = [c.group(2)]
        elif row is not None:
            row.append(line)
    finish()

    result = {"schemaVersion": 1, "cards": [{"cardId": card_id,
               "coverageStatus": "partial", "events": []}]}
    reviews = []
    for ordinal, event in enumerate(events, start=1):
        if event["mode"] == "chain":
            reviews.append({"eventOrdinal": ordinal, "reason": "chain-needs-manual-requires-and-termination"})
            continue
        if UNSAFE.search("\n".join(event["raw"])):
            reviews.append({"eventOrdinal": ordinal, "reason": "conditional-outcomes-need-human-review"})
            continue
        if len(event["rows"]) < 2:
            reviews.append({"eventOrdinal": ordinal, "reason": "missing-or-ambiguous-choices"})
            continue
        choices = []
        for i, fragments in enumerate(event["rows"], start=1):
            content = "\n".join(fragments)
            hits = SKILL.findall(content)
            if "ヒント" in content and not hits:
                choices = []
                reviews.append({"eventOrdinal": ordinal, "reason": "unparsed-hint-reward"})
                break
            resolved, unresolved = [], []
            for name, level in hits:
                entry = reward(name, int(level), skills)
                if "skillId" in entry:
                    resolved.append(entry)
                else:
                    unresolved.append(entry)
            choices.append({"id": f"option{i}", "label": f"選択肢{i}",
                            **({"rewards": resolved} if resolved else {}),
                            **({"unresolvedRewards": unresolved} if unresolved else {})})
        if not choices:
            continue
        idx = 1 + sum(1 for e in result["cards"][0]["events"] if e["id"].startswith(f"draft_{card_id}_normal_"))
        result["cards"][0]["events"].append({
            "id": f"draft_{card_id}_normal_{idx:02d}", "name": f"通常{idx:02d}（仮）",
            "type": "choice", "choices": choices})
    if not events:
        reviews.append({"eventOrdinal": 0, "reason": "no-event-headings-recognized"})
    return {"proposal": result, "observedEventHeadings": len(events),
            "proposedEvents": len(result["cards"][0]["events"]),
            "reviewRequired": reviews}


def compare(existing: dict | None, proposed: dict) -> dict:
    if existing is None:
        return {"status": "new-proposal", "changedEventOrdinals": []}
    current = existing["cards"][0]["events"]
    fresh = proposed["cards"][0]["events"]
    def signature(e):
        return [[tuple(sorted((r.get("skillId", "UNRESOLVED:" + r.get("skillName", "")),
                               r["level"]) for r in c.get("rewards", []) +
                                 c.get("unresolvedRewards", []))) for c in e["choices"]]
               if e["type"] == "choice" else ["NONCHOICE"]][0]
    mismatch = [n + 1 for n, (a, b) in enumerate(zip(current, fresh))
                if signature(a) != signature(b)]
    if len(current) != len(fresh):
        mismatch.extend(range(min(len(current), len(fresh)) + 1,
                              max(len(current), len(fresh)) + 1))
    return {"status": "identical" if not mismatch else "needs-editor-review",
            "changedEventOrdinals": mismatch,
            "currentEventCount": len(current), "proposedEventCount": len(fresh)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--card-id", required=True)
    p.add_argument("--article-file", required=True, type=Path,
                   help="locally supplied licensed excerpt; script never contacts GameWith")
    p.add_argument("--support-card", required=True, type=Path)
    p.add_argument("--skill-data", required=True, type=Path)
    p.add_argument("--source-index", default="poc/data/curation/source_index.v1.json", type=Path)
    p.add_argument("--supplemental", default="poc/data/curation/supplemental_skills.v1.json", type=Path)
    p.add_argument("--existing-draft", type=Path)
    p.add_argument("--output", required=True, type=Path,
                   help="proposal report JSON; existing tracked draft is never modified")
    args = p.parse_args()
    if not re.fullmatch(r"\d{5}", args.card_id):
        p.error("bad card ID")
    index = json.loads(args.source_index.read_text("utf-8"))
    indexed = [x for x in index["cards"] if x["cardId"] == args.card_id]
    if len(indexed) != 1:
        p.error("card is not associated with exactly one checked GameWith source URL")
    row = indexed[0]
    if not re.fullmatch(r"https://gamewith\.jp/uma-musume/article/show/[1-9]\d+", row["primaryArticle"]):
        p.error("source URL is not an exact GameWith support article")
    cards = roster(args.support_card.read_text("utf-8"))
    if args.card_id not in cards:
        p.error("card is not in source UmaSim roster")
    numeric = registry(args.skill_data.read_text("utf-8"),
                       json.loads(args.supplemental.read_text("utf-8")))
    raw = args.article_file.read_bytes()
    if not raw or len(raw) > MAX_BYTES:
        p.error("invalid/oversized local excerpt")
    result = article_to_facts(raw.decode("utf-8-sig"), args.card_id,
                              cards[args.card_id], numeric)
    previous = json.loads(args.existing_draft.read_text("utf-8")) if args.existing_draft else None
    result["comparison"] = compare(previous, result["proposal"])
    result["evidence"] = {"sourceArticle": row["primaryArticle"],
                          "localInputSha256": hashlib.sha256(raw).hexdigest()}
    # Proposals must not overwrite committed editorial/released catalogs.
    tracked_data = Path(__file__).resolve().parents[1] / "data"
    if args.output.resolve() == tracked_data or tracked_data in args.output.resolve().parents:
        p.error("refusing to write proposal into tracked poc/data")
    if args.output.resolve() == args.article_file.resolve() or (
        args.existing_draft is not None and args.output.resolve() == args.existing_draft.resolve()
    ):
        p.error("refusing to overwrite source or reviewed/curated drafts")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(json.dumps({"cardId": args.card_id,
                      "proposedEvents": result["proposedEvents"],
                      "reviewCount": len(result["reviewRequired"]),
                      "diff": result["comparison"]["status"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
