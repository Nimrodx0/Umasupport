#!/usr/bin/env python3
"""Direct, provisional 2025 story-master title join for GameTora-derived chain stages.

Never copy original titles/choices/effects into an output or publication DB.
Unlike the Checker bridge, this probes the Japanese source names directly.
Story numbers and stage metadata remain 2025-specific, not 2026 route approval.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

OLD_SHA = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"
OLD_REV = "5a8ec1356859a35e245edef0d40da740e652df68"
GT_REV = "6e38b54af4fad397ff4491e63007a90705a4fe67"


def fingerprint(value: str, loose: bool = False) -> str | None:
    if not isinstance(value, str):
        raise ValueError("event title not text")
    normalized = unicodedata.normalize("NFKC", " ".join(value.split())).strip()
    if loose:
        normalized = "".join(c for c in normalized.lower() if c.isalnum())
    return hashlib.sha256(normalized.encode("utf8")).hexdigest() if normalized else None


def read_old_master(master: Path, check_hash: bool = True) -> dict[str, list[dict]]:
    if check_hash and hashlib.sha256(master.read_bytes()).hexdigest() != OLD_SHA:
        raise ValueError("historical pinned master SHA mismatch")
    result: dict[str, list[dict]] = defaultdict(list)
    uri = master.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as db:
        for table, cols in [
            ("single_mode_story_data", {"story_id", "support_card_id", "gallery_flag", "show_progress_1", "show_progress_2", "show_progress_3"}),
            ("text_data", {"category", "index", "text"}),
        ]:
            if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone():
                raise ValueError("old master required table missing: " + table)
            found = {r[1] for r in db.execute(f'PRAGMA table_info("{table}")')}
            if not cols <= found:
                raise ValueError("old master required metadata missing: " + table)
        sql = """SELECT s.support_card_id,s.story_id,s.show_progress_1,s.show_progress_2,
                        s.show_progress_3,t.text
                 FROM single_mode_story_data AS s
                 LEFT JOIN text_data AS t ON t.category=181 AND t."index"=s.story_id
                 WHERE s.gallery_flag=2 AND s.support_card_id>0 ORDER BY s.support_card_id,s.story_id"""
        seen = set()
        for cid, sid, stage, maximum, flag, title in db.execute(sql):
            if not isinstance(sid, int) or sid <= 0 or not isinstance(cid, int) or cid <= 0:
                raise ValueError("invalid numeric story/card ID")
            if (cid, sid) in seen:
                raise ValueError("duplicate 2025 story row or title")
            seen.add((cid, sid))
            if title is None:
                raise ValueError("2025 title lookup missing, category=181 story_id")
            result[str(cid)].append(dict(storyId=str(sid), stage=stage, maximum=maximum,
                                         flag=flag, exact=fingerprint(title),
                                         loose=fingerprint(title, True)))
    return result


def source_event_index(doc: dict) -> list[dict]:
    events = doc.get("events_ja") or doc.get("events")
    if not isinstance(events, dict) or not events:
        raise ValueError("missing source event map")
    result = []
    for ordinal, (key, event) in enumerate(events.items(), 1):
        if not isinstance(event, dict) or not isinstance(event.get("choices"), list):
            raise ValueError("malformed source event")
        name = event.get("name") or key
        result.append(dict(ordinal=ordinal, kind=event.get("section"),
                           exact=fingerprint(name), loose=fingerprint(name, True)))
    return result


def unique_join(events: list[dict], old: list[dict]) -> dict[int, dict]:
    pairs: dict[int, dict] = {}
    taken_old: set[int] = set()
    for label, method in [("exact", "title-exact"), ("loose", "title-typographic")]:
        left: dict[str, list[int]] = defaultdict(list)
        right: dict[str, list[int]] = defaultdict(list)
        for i, item in enumerate(events):
            if item["ordinal"] in pairs or item[label] is None:
                continue
            left[item[label]].append(i)
        for j, item in enumerate(old):
            if j in taken_old or item[label] is None:
                continue
            right[item[label]].append(j)
        for key, ii in left.items():
            jj = right.get(key, [])
            if len(ii) == 1 and len(jj) == 1:
                i, j = ii[0], jj[0]
                pairs[events[i]["ordinal"]] = {**old[j], "method": method}
                taken_old.add(j)
    return pairs


def stage_evidence(a: dict | None, b: dict | None, all_old: list[dict]) -> str:
    if not a and not b:
        return "old-master-both-ends-unmatched"
    if not a:
        return "old-master-first-end-unmatched"
    if not b:
        return "old-master-next-end-unmatched"
    n, m = a["stage"], b["stage"]
    mx, my = a["maximum"], b["maximum"]
    flag_a, flag_b = a["flag"], b["flag"]
    if not all(isinstance(v, int) for v in (n, m, mx, my, flag_a, flag_b)):
        return "old-master-stage-metadata-invalid"
    if not (1 <= n <= mx <= 12 and 1 <= m <= my <= 12 and flag_a in (0, 1) and flag_b in (0, 1)):
        return "old-master-stage-metadata-unsequenced"
    if mx != my or flag_a != flag_b:
        return "old-master-stage-group-differs"
    # Multiple historical chains of equal length/flag can share stage labels.
    # If any old row collides with an endpoint, the pairing cannot prove a
    # unique stage edge.
    def matches(stage: int) -> int:
        return sum(1 for x in all_old if
                   x["stage"] == stage and x["maximum"] == mx and x["flag"] == flag_a)
    if matches(n) != 1 or matches(m) != 1:
        return "old-master-stage-label-ambiguous"
    if m != n + 1:
        return "old-master-stage-order-conflicts"
    return ("2025-direct-exact-local-order" if
            a["method"] == b["method"] == "title-exact" else
            "2025-direct-typographic-local-order")


def build(old: dict[str, list[dict]], sources: dict[str, list[dict]], topology: dict) -> dict:
    if (topology.get("dataKind") != "umasupport-whole-chain-topology-review" or
        topology.get("chainEdgesVerified") is not False or
        topology.get("releaseApproved") is not False or
        topology.get("sourcePins", {}).get("gameToraDerived") != GT_REV):
        raise ValueError("wrong or published topology input")
    cards = topology.get("cards")
    if not isinstance(cards, list) or len(cards) != 563 or len(sources) != 559:
        raise ValueError("full source population required")
    kinds = Counter()
    additions = []
    rows = []
    c = dict(totalAdjacencyCandidates=0, directSourceStagesMatched=0,
             directExactTitleStages=0, directTypographyStages=0,
             historicalCheckerComplete=0, historicalCheckerPartial=0,
             previouslyNoHistoricalOrder=0, directLocalOrderForPreviouslyUnverified=0,
             directSourceMasterOrderSupported=0, directSourceMasterOrderConflicted=0,
             directGapsNoOldCardStories=0, directGapsWithOldCardStories=0)
    for card in cards:
        cardid = card["cardId"]
        stages = source_event_index_map = sources.get(cardid, [])
        matches = unique_join(stages, old.get(cardid, []))
        c["directSourceStagesMatched"] += sum(x["ordinal"] in matches for x in stages if x["kind"] == "arrows")
        c["directExactTitleStages"] += sum(x["ordinal"] in matches and matches[x["ordinal"]]["method"] == "title-exact" for x in stages if x["kind"] == "arrows")
        c["directTypographyStages"] += sum(x["ordinal"] in matches and matches[x["ordinal"]]["method"] != "title-exact" for x in stages if x["kind"] == "arrows")
        for st in card["stages"]:
            candidate = st["nextCandidate"]
            if candidate is None:
                continue
            c["totalAdjacencyCandidates"] += 1
            h = candidate["historical2025OrderEvidence"]
            if h == "2025-structural-stage-order-agrees":
                c["historicalCheckerComplete"] += 1
            elif h == "2025-partial-stage-order-agrees":
                c["historicalCheckerPartial"] += 1
            else:
                c["previouslyNoHistoricalOrder"] += 1
            first = matches.get(st["sourceOrdinal"])
            second = matches.get(candidate["sourceOrdinal"])
            status = stage_evidence(first, second, old.get(cardid, []))
            kinds[status] += 1
            evidence = status in ("2025-direct-exact-local-order", "2025-direct-typographic-local-order")
            if evidence:
                c["directSourceMasterOrderSupported"] += 1
            if status == "old-master-stage-order-conflicts":
                c["directSourceMasterOrderConflicted"] += 1
            if not evidence:
                c["directGapsWithOldCardStories" if old.get(cardid) else "directGapsNoOldCardStories"] += 1
            if h not in ("2025-structural-stage-order-agrees", "2025-partial-stage-order-agrees"):
                if evidence:
                    c["directLocalOrderForPreviouslyUnverified"] += 1
                    additions.append(dict(cardId=cardid, firstOrdinal=st["sourceOrdinal"],
                                          nextOrdinal=candidate["sourceOrdinal"],
                                          method=status,
                                          oldFirstStoryId=first["storyId"],
                                          oldNextStoryId=second["storyId"]))
                else:
                    rows.append(dict(cardId=cardid, firstOrdinal=st["sourceOrdinal"],
                                     nextOrdinal=candidate["sourceOrdinal"],
                                     oldCardHasDirectStories=bool(old.get(cardid)), reason=status))
    if c["totalAdjacencyCandidates"] != 675 or c["historicalCheckerComplete"] != 523 or c["historicalCheckerPartial"] != 15 or c["previouslyNoHistoricalOrder"] != 137 or sum(kinds.values()) != 675 or
        c["directGapsNoOldCardStories"] + c["directGapsWithOldCardStories"] +
        c["directSourceMasterOrderSupported"] + c["directSourceMasterOrderConflicted"] != 675:
        raise ValueError("prior topology populations drift")
    return dict(schemaVersion=1, dataKind="umasupport-direct-2025-master-chain-audit",
                sourcePins=dict(gameToraDerived=GT_REV, historicalMasterRevision=OLD_REV,
                                historicalMasterSha256=OLD_SHA),
                routeVerifiedIn2026=False, forSkillGrant=False, releaseApproved=False,
                titleJoinProvisionalOnly=True, sourceTextsIncluded=False,
                stats={**c, "directOrderStatuses":dict(sorted(kinds.items()))},
                provisionalAdditionalHistoricalLinks=additions,
                stillUnlinkedHistoricalOrders=rows)


def read_sources(folder: Path) -> dict[str, list[dict]]:
    result = {}
    for f in sorted(folder.glob("support_*.json")):
        doc = json.loads(f.read_text(encoding="utf-8"))
        if doc.get("kind") != "support" or not isinstance(doc.get("id"), int):
            raise ValueError("malformed support json")
        cardid = str(doc["id"])
        if cardid in result or f.stem != f"support_{cardid}":
            raise ValueError("duplicate/misnamed support source")
        result[cardid] = source_event_index(doc)
    return result


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--master", type=Path, required=True)
    p.add_argument("--source-dir", type=Path, required=True)
    p.add_argument("--topology", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    a = p.parse_args()
    old = read_old_master(a.master)
    source = read_sources(a.source_dir)
    topology = json.loads(a.topology.read_text(encoding="utf-8"))
    result = build(old, source, topology)
    a.output.parent.mkdir(parents=True, exist_ok=True)
    a.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("DIRECT_2025_CHAIN_STATS=" + json.dumps(result["stats"], ensure_ascii=False, sort_keys=True))
    print("DIRECT_2025_NEW_LINKS=" + json.dumps(result["provisionalAdditionalHistoricalLinks"][:30], ensure_ascii=False))


if __name__ == "__main__":
    main()
