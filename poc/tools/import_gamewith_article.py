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
# Internal sentinel; malformed source rows never reach any proposal JSON.
UNPARSED_HTML_ROW = "[unparsed-html-table-row]"


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
        # A result marker and its hint may occupy different lines within a
        # single HTML table cell. Flattening <br>/<div> would merge separate
        # outcomes and misattribute rewards, so retain semantic boundaries.
        if self.in_cell and tag in ("br", "p", "div", "li", "hr"):
            self.chunks.append("\n")
        if tag in ("h2", "h3", "h4"):
            self.capture = tag
            self.chunks = []
        elif tag == "tr":
            if self.row and self.cells:
                self.blocks.append(UNPARSED_HTML_ROW)
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
        if self.in_cell and tag in ("p", "div", "li"):
            self.chunks.append("\n")
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
            elif self.cells:
                # A 1-/3+-cell row can hide a choice. Never silently discard
                # it and then accept the remaining rows as a complete event.
                self.blocks.append(UNPARSED_HTML_ROW)
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



def validate_source_index(index: dict, cards: dict[str, dict]) -> dict[str, dict]:
    """Validate a complete card/article/draft index before any import writes.

    Both single-card and batch entry points use this. The same public source
    article or output draft must not silently become evidence for two cards.
    """
    if not isinstance(index, dict) or not isinstance(index.get("cards"), list):
        raise ValueError("invalid source index")
    by_card: dict[str, dict] = {}
    by_url: set[str] = set()
    by_draft: set[str] = set()
    for row in index["cards"]:
        if not isinstance(row, dict):
            raise ValueError("invalid source index row")
        cid = row.get("cardId")
        if not isinstance(cid, str) or not re.fullmatch(r"[1-9]\d{4}", cid):
            raise ValueError("invalid indexed card ID")
        if cid in by_card or cid not in cards:
            raise ValueError("duplicate or unrecognized indexed card: " + cid)
        url = row.get("primaryArticle")
        if not isinstance(url, str) or not re.fullmatch(
                r"https://gamewith\.jp/uma-musume/article/show/[1-9]\d+", url):
            raise ValueError("invalid GameWith source URL for " + cid)
        if url in by_url:
            raise ValueError("GameWith article assigned to multiple cards")
        draft = row.get("draftFile")
        if not isinstance(draft, str) or not re.fullmatch(
                r"poc/data/(?:curation/drafts|preview)/[a-zA-Z0-9_.-]+\.json", draft):
            raise ValueError("invalid indexed draft path for " + cid)
        if draft in by_draft:
            raise ValueError("one draft file assigned to multiple cards")
        filename = draft.rsplit("/", 1)[-1]
        if draft.startswith("poc/data/curation/drafts/") and filename != cid + ".v1.json":
            raise ValueError("draft card ID and filename disagree")
        if draft.startswith("poc/data/preview/") and cid not in filename:
            raise ValueError("preview filename does not identify indexed card")
        by_card[cid] = row
        by_url.add(url)
        by_draft.add(draft)
    return by_card



def reward(name: str, level: int, skills: dict) -> dict:
    if not name.strip() or level < 1 or level > 10:
        raise ValueError("invalid skill reward")
    matched = skills.get(normalize(name), [])
    if len(matched) == 1:
        rec = matched[0]
        return {"skillId": "skill:" + rec["id"],
                "verifiedSkillName": rec["name"], "level": level}
    return {"skillName": name, "level": level}


# Captures article-dependent outcomes as NON-PUBLISHABLE editorial candidates.
# A GameWith reward fact does not establish reachability, probability or a
# guaranteed acquisition route. Human review must bind chain prerequisites.
RESULT = re.compile(r"^\s*(大成功|成功|失敗)時?\s*[:：]\s*(.*)$")
EXTRA_CONDITIONS = re.compile(r"ランダム|確率|打ち切り|進行しない|次に進|継続する|継続しない")
HINT_MENTION = re.compile(r"ヒント")


def facts_from_text(content: str, skills: dict) -> dict:
    found = SKILL.findall(content)
    # Account for EVERY hint mention. A mixed valid/invalid cell must not
    # quietly keep the first skill while losing a later malformed hint.
    remainder = SKILL.sub("", content)
    if HINT_MENTION.search(remainder):
        raise ValueError("unparsed-hint-reward")
    resolved, unresolved = [], []
    for name, level in found:
        entry = reward(name, int(level), skills)
        if "skillId" in entry:
            resolved.append(entry)
        else:
            unresolved.append(entry)
    return {**({"rewards": resolved} if resolved else {}),
            **({"unresolvedRewards": unresolved} if unresolved else {})}


def candidate_choice(fragments: list[str], number: int, skills: dict) -> tuple[dict, bool]:
    lines = "\n".join(fragments).splitlines()
    outcome_lines: dict[str, list[str]] = {}
    unscoped_lines: list[str] = []
    current = None
    for line in lines:
        result = RESULT.match(line)
        if result:
            key = {"大成功": "great", "成功": "success", "失敗": "failure"}[result[1]]
            if key in outcome_lines:
                raise ValueError("repeated-result-label")
            outcome_lines[key] = []
            current = key
            if result[2]:
                outcome_lines[key].append(result[2])
        elif current is not None:
            outcome_lines[current].append(line)
        else:
            unscoped_lines.append(line)
    answer = {"id": f"option{number}", "label": f"選択肢{number}"}
    if outcome_lines:
        # Hints appearing before the first outcome marker have unknown
        # applicability. Do not discard them or attach them to all outcomes.
        if HINT_MENTION.search("\n".join(unscoped_lines)):
            raise ValueError("unscoped-outcome-hint")
        outcomes = set(outcome_lines)
        if outcomes not in ({"success", "great"}, {"success", "failure"}, {"success", "great", "failure"}):
            raise ValueError("incomplete-or-unsupported-results")
        ordered = [key for key in ("success", "great", "failure") if key in outcomes]
        answer["outcomes"] = [
            {"id": key, "label": {"success":"成功","great":"大成功","failure":"失敗"}[key],
             **facts_from_text("\n".join(outcome_lines[key]), skills),
             # The outcome tree requires rewards arrays even if none are seen.
             } for key in ordered
        ]
        for outcome in answer["outcomes"]:
            outcome.setdefault("rewards", [])
        return answer, True
    if re.search(r"成功|失敗", "\n".join(lines)):
        raise ValueError("unrecognized-result-condition")
    answer.update(facts_from_text("\n".join(lines), skills))
    return answer, False



# In actual GameWith support pages the article heading can say
# "(SSRスピード)" or "(イベント配布報酬)", while a separate
# performance heading and table identify the rarity and epithet.
PERFORMANCE_HEADING = re.compile(r"^\s*###\s*(.+?)\((R|SR|SSR)\)の性能\s*$")
ARTICLE_HEADING = re.compile(
    r"^\s*#{1,3}\s*(?:〖ウマ娘〗\s*)?(.+?)\((R|SR|SSR)(?:サポート|スピード|スタミナ|パワー|根性|賢さ|友人|グループ)\)")
RARITY_FIELD = re.compile(r"^\s*レア\s*\|\s*(R|SR|SSR)\s*$")
EPITHET_FIELD = re.compile(r"^\s*二つ名\s*\|\s*(.*?)\s*$")


def validate_article_identity(lines: list[str], card: dict) -> None:
    """Match the particular pinned support card, not just the character.

    No guessed card IDs from GameWith titles. When an explicit identity
    field exists, a conflicting value must reject the entire proposal.
    """
    end = next((i for i, line in enumerate(lines) if EVENT_SECTION in line), len(lines))
    header = lines[:end]
    requested = (normalize(card["name"]), card["rarity"])
    performance = [(normalize(m[1]), m[2]) for line in header
                   if (m := PERFORMANCE_HEADING.match(line))]
    article = [(normalize(m[1]), m[2]) for line in header
               if (m := ARTICLE_HEADING.match(line))]
    if performance:
        if len(performance) != 1 or performance[0] != requested:
            raise ValueError("GameWith performance identity disagrees with pinned support card")
    elif not article or any(identity != requested for identity in article):
        raise ValueError("GameWith article character/rarity does not match pinned support card")
    # If both ways of identifying the article are available, they must agree.
    if article and any(identity != requested for identity in article):
        raise ValueError("GameWith article heading conflicts with performance identity")

    rarity_fields = [m[1] for line in header if (m := RARITY_FIELD.match(line))]
    if rarity_fields and (len(rarity_fields) != 1 or rarity_fields[0] != card["rarity"]):
        raise ValueError("GameWith rarity field conflicts with pinned support card")
    if performance and not rarity_fields:
        raise ValueError("GameWith performance table lacks rarity field")

    if card["rarity"] != "R":
        epithet = card["title"].split("]")[0].lstrip("[")
        titles = [normalize(m[1]) for line in header if (m := EPITHET_FIELD.match(line))]
        if not epithet or len(titles) != 1 or titles[0] != normalize(epithet):
            raise ValueError("GameWith support-card epithet does not match pinned SR/SSR")



def article_to_facts(text: str, card_id: str, card: dict,
                     skills: dict) -> dict:
    if "<html" in text[:1000].lower() or "<h2" in text[:15000].lower():
        parser = ArticleBlocks()
        parser.feed(text)
        parser.close()
        if parser.row:
            parser.blocks.append(UNPARSED_HTML_ROW)
        text = parser.text()
    lines = text.replace("\r\n", "\n").split("\n")
    validate_article_identity(lines, card)
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
                current = {"mode": mode, "rows": [], "raw": [], "noChoice": False}
                continue
        if entered and line.strip() == UNPARSED_HTML_ROW:
            raise ValueError("unparsed HTML table row in event section")
        if not entered or current is None:
            continue
        if line.strip() == "詳細を見る":
            continue
        current["raw"].append(line)
        c = CHOICE.match(line)
        if c and c.group(1).strip():
            if row is not None:
                current["rows"].append(row)
            if c.group(1).strip() == "選択肢なし":
                current["noChoice"] = True
            row = [c.group(2)]
        elif row is not None:
            row.append(line)
    finish()

    result = {"schemaVersion": 1, "cards": [{"cardId": card_id,
               "coverageStatus": "partial", "events": []}]}
    reviews = []
    manual = []
    count_by_category = {"normal": 0, "chain": 0}
    for ordinal, event in enumerate(events, start=1):
        mode = event["mode"]
        count_by_category[mode] += 1
        category_index = count_by_category[mode]
        if len(event["rows"]) == 1 and event["noChoice"]:
            reason = "nonchoice-event-needs-manual-reachability"
            fact = {}
            try:
                # Preserve no-choice numeric rewards and success/failure trees.
                # A single row does NOT establish any automatic guarantee.
                entry, _ = candidate_choice(event["rows"][0], 1, skills)
                fact = {key:value for key,value in entry.items()
                        if key not in ("id", "label")}
            except ValueError:
                reason = "nonchoice-results-need-human-review"
            reviews.append({"eventOrdinal": ordinal, "reason": reason})
            manual.append({"eventOrdinal": ordinal, "category": mode,
                           "categoryOrdinal": category_index, "eventKind": "auto",
                           "facts": fact, "reason": reason})
            continue
        if len(event["rows"]) < 2 or event["noChoice"]:
            reviews.append({"eventOrdinal": ordinal, "reason": "missing-or-ambiguous-choices"})
            manual.append({"eventOrdinal": ordinal, "category": mode,
                           "categoryOrdinal": category_index, "choices": [],
                           "reason": "missing-or-ambiguous-choices"})
            continue

        parsed = []
        conditional = False
        invalid = None
        for i, fragments in enumerate(event["rows"], start=1):
            try:
                choice, has_result = candidate_choice(fragments, i, skills)
                conditional = conditional or has_result
                parsed.append(choice)
            except ValueError as error:
                invalid = str(error)
                break
        special = bool(EXTRA_CONDITIONS.search("\n".join(event["raw"])))
        if invalid:
            why = invalid if invalid.startswith("unparsed-hint") else (
                "conditional-outcomes-need-human-review")
        elif mode == "chain":
            why = "chain-needs-manual-requires-and-termination"
        elif conditional or special:
            why = "conditional-outcomes-need-human-review"
        else:
            why = None
        if why:
            reviews.append({"eventOrdinal": ordinal, "reason": why})
            manual.append({"eventOrdinal": ordinal, "category": mode,
                           "categoryOrdinal": category_index, "choices": parsed,
                           "reason": why})
            continue

        # The ordinal derives from *observed* headings, never from the number
        # of accepted events. If an earlier event is quarantined, no route is
        # silently renamed and a false equivalence with an old draft is avoided.
        result["cards"][0]["events"].append({
            "id": f"draft_{card_id}_normal_{category_index:02d}",
            "name": f"通常{category_index:02d}（仮）",
            "type": "choice", "choices": parsed})

    if not events:
        reviews.append({"eventOrdinal": 0, "reason": "no-event-headings-recognized"})
    return {"proposal": result, "observedEventHeadings": len(events),
            "proposedEvents": len(result["cards"][0]["events"]),
            "manualCandidates": manual,
            "reviewRequired": reviews}


def compare(existing: dict | None, proposed: dict) -> dict:
    if existing is None:
        return {"status": "new-proposal", "changedEventOrdinals": []}
    current = existing["cards"][0]["events"]
    fresh = proposed["cards"][0]["events"]
    def signature(e):
        if e["type"] != "choice":
            return (e["id"], e["type"], "NONCHOICE")
        return (e["id"], e["type"], tuple(
            (c["id"], bool(c.get("terminal")), tuple(sorted(
                (r.get("skillId", "UNRESOLVED:" + r.get("skillName", "")), r["level"])
                for r in c.get("rewards", []) + c.get("unresolvedRewards", [])
            )), tuple(
                (out["id"], tuple(sorted(
                    (r.get("skillId", "UNRESOLVED:" + r.get("skillName", "")), r["level"])
                    for r in out.get("rewards", []) + out.get("unresolvedRewards", [])
                ))) for out in c.get("outcomes", [])
            )) for c in e["choices"]
        ))
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
    cards = roster(args.support_card.read_text("utf-8"))
    try:
        by_card = validate_source_index(index, cards)
    except ValueError as exc:
        p.error(str(exc))
    if args.card_id not in by_card:
        p.error("card is not associated with exactly one checked GameWith source URL")
    row = by_card[args.card_id]
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
