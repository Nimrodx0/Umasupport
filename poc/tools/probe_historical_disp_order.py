#!/usr/bin/env python3
"""Read-only legacy master skill disp_order audit. Do not infer 2026 in-game UI order."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sqlite3


def probe(master_path, raw_skills):
    records = json.loads(raw_skills.lstrip("\ufeff"))
    if not isinstance(records, list) or not records:
        raise ValueError("UmaSim skill data missing")
    current_ids = set()
    for item in records:
        sid = int(item["id"])
        if sid in current_ids:
            raise ValueError("Duplicate current skill ID")
        current_ids.add(sid)
    connection = sqlite3.connect(master_path.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        cols = {row[1] for row in connection.execute("PRAGMA table_info(skill_data)")}
        need = {"id", "disp_order", "rarity", "group_id"}
        if not need.issubset(cols):
            raise ValueError("Historical master lacks columns: " + ", ".join(sorted(need - cols)))
        old = {}
        for sid, order, rarity, group in connection.execute(
                "SELECT id, disp_order, rarity, group_id FROM skill_data"):
            sid = int(sid)
            if sid in old:
                raise ValueError("Duplicate historical skill ID")
            old[sid] = {"disp_order": order, "rarity": rarity, "group": group}
    finally:
        connection.close()
    shared = current_ids.intersection(old)
    positive = {sid: int(old[sid]["disp_order"]) for sid in shared
                if isinstance(old[sid]["disp_order"], int) and old[sid]["disp_order"] > 0}
    values = Counter(positive.values())
    no_order = sorted(sid for sid in shared if sid not in positive)
    tack = old.get(201012)
    return {
        "currentSkillRecords": len(current_ids),
        "historicalSkillRecords": len(old),
        "sharedIds": len(shared),
        "missingFromHistorical": len(current_ids - set(old)),
        "sharedPositiveDispOrder": len(positive),
        "sharedNoPositiveOrder": len(no_order),
        "positiveDistinctValues": len(values),
        "positiveOrderTieBuckets": sum(v > 1 for v in values.values()),
        "positiveOrderRowsInTies": sum(v for v in values.values() if v > 1),
        "largestTie": max(values.values(), default=0),
        "minPositive": min(positive.values()) if positive else None,
        "maxPositive": max(positive.values()) if positive else None,
        "historical201012": None if tack is None else {
            "present": True, "rarity": tack["rarity"],
            "group": tack["group"], "disp_order": tack["disp_order"]
        },
        "historicId201012AlsoInCurrent": 201012 in current_ids,
        "doesNotProveCurrentGameUIOrder": True,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", type=Path, required=True)
    parser.add_argument("--skills", type=Path, required=True)
    args = parser.parse_args()
    master_data = args.master.read_bytes()
    source_data = args.skills.read_text(encoding="utf-8")
    summary = probe(args.master, source_data)
    summary["sha256"] = {
        "historicalMaster": hashlib.sha256(master_data).hexdigest(),
        "umasimSkillData": hashlib.sha256(source_data.encode("utf-8")).hexdigest()
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
