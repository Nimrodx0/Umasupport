#!/usr/bin/env python3
"""Cross-check GameTora skill ID gaps against a pinned 2025 game master snapshot.

Source of truth for events REMAINS GameTora. This independent historical master
can corroborate old ID/rarity/name presence but NEVER authorizes modern 2026
gameplay facts, public names, or inclusion in a user-visible release.
Raw historical text is read only in memory; exported report is numeric-only.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import unicodedata

MASTER_SHA = "46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb"
MASTER_REV = "5a8ec1356859a35e245edef0d40da740e652df68"
GT_REV = "6e38b54af4fad397ff4491e63007a90705a4fe67"
SKILL_REV = "cf9366f6a487bd8f197b53d8a11981207beb9f6c"


def checked_int(value: object, label: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"invalid {label}")
    text = str(value)
    if not re.fullmatch(r"[0-9]+", text):
        raise ValueError(f"invalid {label}")
    number = int(text)
    if number < 0 or number > 999999999:
        raise ValueError(f"out of range {label}")
    return number


def _columns(db: sqlite3.Connection, table: str, required: set[str]) -> set[str]:
    cols = {str(row[1]) for row in db.execute(f"PRAGMA table_info({table})")}
    if not required.issubset(cols):
        raise ValueError(f"missing {table} columns: {sorted(required-cols)}")
    return cols


def read_old_master(db: sqlite3.Connection) -> dict[str, dict]:
    _columns(db, "skill_data", {"id", "group_id", "group_rate", "rarity"})
    fields = _columns(db, "text_data", {"category", "text"})
    index_field = "index" if "index" in fields else "id" if "id" in fields else None
    if index_field is None:
        raise ValueError("text_data has no index or id field")
    names = defaultdict(set)
    for sid, name in db.execute(
        f'SELECT "{index_field}", text FROM text_data WHERE category = 47'
    ):
        if name is None or not str(name).strip():
            continue
        normalized = unicodedata.normalize("NFKC", " ".join(str(name).split()))
        names[str(checked_int(sid, "skill-name ID"))].add(normalized)
    result = {}
    for sid, group, rate, rarity in db.execute(
        "SELECT id, group_id, group_rate, rarity FROM skill_data"
    ):
        sid = str(checked_int(sid, "skill ID"))
        if sid in result:
            raise ValueError("old master duplicate skill ID")
        if rarity is None or group is None:
            raise ValueError("old master incomplete skill row")
        result[sid] = {
            "rarity": checked_int(rarity, "rarity"),
            "group": checked_int(group, "group_id"),
            "rate": int(rate) if rate is not None else None,
            "nameCandidates": sorted(names.get(sid, set())),
        }
    return result


def review_gaps(crosswalk: dict, old: dict[str, dict]) -> dict:
    if (crosswalk.get("dataKind") != "gametora-event-skill-crosswalk-draft"
            or crosswalk.get("releaseApproved") is not False
            or crosswalk.get("sourcePins", {}).get("gameToraDerived") != GT_REV
            or crosswalk.get("sourcePins", {}).get("umaSimSkills") != SKILL_REV
            or not isinstance(crosswalk.get("unresolved"), list)):
        raise ValueError("untrusted crosswalk input")
    gaps = {}
    total = 0
    for row in crosswalk["unresolved"]:
        if row.get("reason") != "not-in-pinned-umasim-registry":
            continue
        if row.get("kind") != "hint":
            raise ValueError("non-hint unexpectedly counted as missing skill")
        sid = str(checked_int(row.get("numericId"), "crosswalk skill ID"))
        if sid == "0":
            raise ValueError("zero skill ID")
        key = (
            row.get("cardId"), row.get("sourceOrdinal"),
            row.get("choiceOrdinal"), row.get("routeOrdinal"), row.get("hintOrdinal")
        )
        if not isinstance(key[0], str) or any(
            type(x) is not int or x < 1 for x in key[1:]
        ):
            raise ValueError("invalid original event route position")
        if sid not in gaps:
            gaps[sid] = {"id": sid, "seenPositions": set()}
        if key in gaps[sid]["seenPositions"]:
            raise ValueError("duplicate unresolved hint position")
        gaps[sid]["seenPositions"].add(key)
        total += 1
    counted = crosswalk.get("stats", {}).get("missingPinnedSkillIds")
    if counted != total:
        raise ValueError("crosswalk missing skill position count changed")
    rows = []
    by_status = Counter()
    for sid in sorted(gaps, key=int):
        master = old.get(sid)
        if master is None:
            status = "absent-from-2025-master"
            extra = {}
        elif master["rarity"] not in (1, 2):
            status = "2025-non-normal-or-rare"
            extra = {"historicalRarity": master["rarity"]}
        elif len(master["nameCandidates"]) != 1:
            status = "2025-no-unique-JP-name"
            extra = {"historicalRarity": master["rarity"],
                     "historicalNameCount": len(master["nameCandidates"])}
        else:
            status = "2025-ID-and-rarity-with-unique-JP-name"
            name = master["nameCandidates"][0]
            extra = {
                "historicalRarity": master["rarity"],
                "historicalGroup": master["group"],
                "historicalNameFingerprint":
                    "sha256:" + hashlib.sha256(name.encode("utf-8")).hexdigest(),
            }
        by_status[status] += len(gaps[sid]["seenPositions"])
        rows.append({"numericId": sid,
                     "occurrences": len(gaps[sid]["seenPositions"]),
                     "historicalStatus": status, **extra})
    if sum(by_status.values()) != total:
        raise ValueError("historical skill classification lost positions")
    return {
        "schemaVersion": 1,
        "dataKind": "2025-historical-master-missing-2026-umasim-skill-ids",
        "historicalMasterRevision": MASTER_REV,
        "sourceGameToraRevision": GT_REV,
        "sourceUmaSimSkillRevision": SKILL_REV,
        "crosswalkMissingOccurrences": total,
        "crosswalkMissingDistinctIds": len(gaps),
        "countsByHistoricalStatus": dict(sorted(by_status.items())),
        "game2026Verified": False,
        "releasedSkillNamesIncluded": False,
        "automaticAdoptionAllowed": False,
        "rawTextIncluded": False,
        "rows": rows,
    }



def private_historical_preview(report: dict, old: dict[str, dict]) -> dict:
    """A short-lived runner-only aid, never an uploaded artifact.

    Japanese names are permitted in this ephemeral runner memory/file ONLY.
    Historical review status and fingerprints remain available as nonpublic
    metadata and are rechecked by the JS schema dry-run.
    """
    if report.get("game2026Verified") is not False or (
            report.get("dataKind") != "2025-historical-master-missing-2026-umasim-skill-ids"):
        raise ValueError("historical-only evidence required")
    skills = []
    for row in report["rows"]:
        if row["historicalStatus"] != "2025-ID-and-rarity-with-unique-JP-name":
            continue
        src = old.get(row["numericId"])
        if src is None or len(src["nameCandidates"]) != 1:
            raise ValueError("missing historical source skill name")
        name = src["nameCandidates"][0]
        fingerprint = "sha256:" + hashlib.sha256(name.encode("utf-8")).hexdigest()
        if fingerprint != row["historicalNameFingerprint"]:
            raise ValueError("historical name fingerprint changed")
        skills.append({"id": row["numericId"], "name": name,
                       "rarity": "normal" if row["historicalRarity"] == 1 else "rare",
                       "historicalNameFingerprint": fingerprint})
    return {
        "schemaVersion": 1,
        "dataKind": "historical-2025-skill-preview-private-runner-only",
        "historicalMasterSha256": MASTER_SHA,
        "historicalMasterRevision": MASTER_REV,
        "game2026Verified": False,
        "publicationAllowed": False,
        "skills": skills,
    }


def run(args: list[str] | None = None) -> dict:
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--crosswalk", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--private-preview-output", type=Path)
    opts = parser.parse_args(args)
    if opts.output.resolve() == opts.crosswalk.resolve() or (
            "poc" in opts.output.parts and "data" in opts.output.parts):
        raise ValueError("cannot write unapproved data into public catalog")
    if hashlib.sha256(opts.master.read_bytes()).hexdigest() != MASTER_SHA:
        raise ValueError("2025 master SHA mismatch")
    with sqlite3.connect(opts.master.resolve().as_uri() + "?mode=ro", uri=True) as db:
        old = read_old_master(db)
    report = review_gaps(json.loads(opts.crosswalk.read_text(encoding="utf-8")), old)
    opts.output.parent.mkdir(parents=True, exist_ok=True)
    opts.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n",
                           encoding="utf-8")
    if opts.private_preview_output is not None:
        scratch = os.environ.get("RUNNER_TEMP")
        if not scratch:
            raise ValueError("private historical names require GitHub runner temporary directory")
        resolved = opts.private_preview_output.resolve()
        parent = (Path(scratch).resolve() / "historical-master").resolve()
        if not resolved.is_relative_to(parent) or resolved == opts.output.resolve():
            raise ValueError("historical raw names must never enter uploaded/public paths")
        payload = private_historical_preview(report, old)
        resolved.parent.mkdir(parents=True, exist_ok=True)
        resolved.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        # Only the independent numeric record COUNT may be printed.
        print("HISTORICAL_2025_PRIVATE_PREVIEW_RECORD_COUNT=" +
              str(len(payload["skills"])))

    print("HISTORICAL_2025_MISSING_SKILL_CROSSCHECK=" +
          json.dumps({"missingOccurrences": report["crosswalkMissingOccurrences"],
                      "missingUniqueIds": report["crosswalkMissingDistinctIds"],
                      "historicalStatuses": report["countsByHistoricalStatus"]},
                     ensure_ascii=False, sort_keys=True))
    return report


if __name__ == "__main__":
    run()
