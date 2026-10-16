#!/usr/bin/env python3
"""Read-only full-source cross-check against a separately supplied game master SQLite DB.

No third-party game data is copied into the repository or printed in the report.
The database must contain skill_data(id, group_id, group_rate, rarity).
Rarity 1 = normal, 2 = rare; lower ranks have smaller group_rate.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import unicodedata


def _id(value):
    s = str(value)
    if not s.isascii() or not s.isdecimal() or int(s) <= 0:
        raise ValueError("Invalid numeric skill ID")
    return s


def read_umasim(raw: str):
    data = json.loads(raw.lstrip("\ufeff"))
    if not isinstance(data, list) or len(data) < 100:
        raise ValueError("UmaSim skill source is missing or unexpectedly small")
    by_id, by_name, groups = {}, Counter(), defaultdict(lambda: {"rare": [], "normal": []})
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"Invalid UmaSim row {i}")
        sid = _id(item.get("id"))
        name = item.get("name")
        group = item.get("group")
        rarity = item.get("rarity")
        if (not isinstance(name, str) or not name.strip() or
                isinstance(group, bool) or not isinstance(group, int) or group < 0 or
                not isinstance(rarity, str)):
            raise ValueError(f"Invalid UmaSim row fields {i}")
        if sid in by_id:
            raise ValueError("Duplicate UmaSim skill ID " + sid)
        name = unicodedata.normalize("NFKC", " ".join(name.split()))
        record = {"id": sid, "name": name, "group": group, "rarity": rarity}
        by_id[sid] = record
        by_name[name] += 1
        if rarity in ("normal", "rare"):
            groups[group][rarity].append(record)
    return {"records": by_id, "groups": groups, "name_counts": by_name}


def read_master(path: Path):
    # Read-only URI prevents accidental creation or editing.
    connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
    try:
        cols = {row[1] for row in connection.execute("PRAGMA table_info(skill_data)")}
        need = {"id", "group_id", "group_rate", "rarity"}
        if not need.issubset(cols):
            raise ValueError("Independent master lacks columns: " + ", ".join(sorted(need - cols)))
        records, groups = {}, defaultdict(list)
        for sid, gid, rate, rarity in connection.execute(
                "SELECT id, group_id, group_rate, rarity FROM skill_data"):
            sid = _id(sid)
            if sid in records:
                raise ValueError("Duplicate master skill ID " + sid)
            if gid is None or rarity is None:
                raise ValueError("Null group or rarity in master for skill " + sid)
            try:
                rec = {"id": sid, "group": int(gid),
                       "rate": int(rate) if rate is not None else None,
                       "rarity": int(rarity)}
            except (ValueError, TypeError) as exc:
                raise ValueError("Invalid master rank for skill " + sid) from exc
            records[sid] = rec
            if rec["rarity"] in (1, 2):
                groups[rec["group"]].append(rec)
        return {"records": records, "groups": groups}
    finally:
        connection.close()


def audit(source, master):
    results = []
    for group_id, fam in sorted(source["groups"].items()):
        rare, normal = fam["rare"], fam["normal"]
        if not rare:
            continue
        gold_ids = [x["id"] for x in rare]
        member_ids = [x["id"] for x in normal + rare]
        normal_names = [x["name"] for x in normal]
        circle = (len(normal) == 2 and
                  sum(x.endswith("○") for x in normal_names) == 1 and
                  sum(x.endswith("◎") for x in normal_names) == 1)
        safe = all(int(x["id"]) // 10 == group_id and
                   source["name_counts"][x["name"]] == 1 for x in normal + rare)
        # Master groups may contain non-upgrade siblings with group_rate < 0.
        # They are excluded from the progression graph, not treated as conflicts.
        negative_extras = sorted(
            x["id"] for x in master["groups"].get(group_id, [])
            if x["id"] not in member_ids and x["rate"] is not None and x["rate"] < 0)
        base = {"group": group_id, "goldIds": gold_ids,
                "normalIds": [x["id"] for x in normal],
                "ignoredNegativeRateExtras": negative_extras}
        if len(rare) != 1 or (normal and (not safe or not (len(normal) == 1 or circle))):
            results.append({**base, "status": "source_ambiguous"})
            continue

        expected_rarities = {x["id"]: 2 for x in rare}
        expected_rarities.update({x["id"]: 1 for x in normal})
        rows = [master["records"].get(sid) for sid in member_ids]
        if any(x is None for x in rows):
            results.append({**base, "status": "master_missing", "missingIds": [
                sid for sid in member_ids if sid not in master["records"]]})
            continue
        if any(x["group"] != group_id or x["rarity"] != expected_rarities[x["id"]] for x in rows):
            results.append({**base, "status": "master_group_or_rarity_mismatch"})
            continue
        extras = sorted(
            x["id"] for x in master["groups"].get(group_id, [])
            if x["id"] not in member_ids and
            (x["rate"] is None or x["rate"] >= 0))
        if extras:
            results.append({**base, "status": "master_extra_group_members", "extraIds": extras})
            continue
        if not normal:
            results.append({**base, "status": "master_supports_no_lower_in_snapshot"})
            continue
        if circle:
            ordered = [next(x for x in normal if x["name"].endswith("○")),
                       next(x for x in normal if x["name"].endswith("◎")), rare[0]]
        else:
            ordered = [normal[0], rare[0]]
        ranks = [master["records"][x["id"]]["rate"] for x in ordered]
        if any(v is None or v < 0 for v in ranks):
            results.append({**base, "status": "master_rank_unknown_or_negative"})
        elif not all(a < b for a, b in zip(ranks, ranks[1:])):
            results.append({**base, "status": "master_rank_order_conflict"})
        else:
            results.append({**base, "status": "independent_master_order_agrees"})

    counts = Counter(x["status"] for x in results)
    total_rare = sum(len(g["rare"]) for g in source["groups"].values())
    # Source ambiguous can contain more than one rare skill, so track both group and skill units.
    unresolved_rare = sum(len(x["goldIds"]) for x in results if x["status"] == "source_ambiguous")
    candidates = sum(len(g["rare"]) == 1 and
                     (len(g["normal"]) == 1 or
                      (len(g["normal"]) == 2 and
                       sum(x["name"].endswith("○") for x in g["normal"]) == 1 and
                       sum(x["name"].endswith("◎") for x in g["normal"]) == 1))
                     and all(int(x["id"]) // 10 == gid and source["name_counts"][x["name"]] == 1
                             for x in g["rare"] + g["normal"])
                     for gid, g in source["groups"].items() if g["rare"] and g["normal"])
    no_lower = sum(len(g["rare"]) for g in source["groups"].values() if g["rare"] and not g["normal"])
    agreed = counts["independent_master_order_agrees"]
    no_lower_agreed = counts["master_supports_no_lower_in_snapshot"]
    passed = (unresolved_rare == 0 and agreed == candidates and
              no_lower_agreed == no_lower and agreed + no_lower_agreed == total_rare)
    return {"passed": passed, "totalRareInUmaSim": total_rare,
            "sourceStructuralCandidates": candidates, "sourceWithoutLower": no_lower,
            "independentAgreedChains": agreed, "independentNoLowerSnapshot": no_lower_agreed,
            "unresolvedRareInSource": unresolved_rare, "statusCounts": dict(sorted(counts.items())),
            "ignoredNegativeRateMasterExtras": sum(len(x["ignoredNegativeRateExtras"]) for x in results),
            "results": results}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Independent master skill group_rate verifier (read-only)")
    ap.add_argument("--umasim", type=Path, required=True, help="Locally obtained UmaSim skill_data.txt")
    ap.add_argument("--master", type=Path, required=True, help="Locally obtained master.mdb SQLite file")
    ap.add_argument("--source-revision", required=True, help="UmaSim commit or immutable data revision")
    ap.add_argument("--master-revision", required=True, help="Independent master revision/date/platform")
    ap.add_argument("--strict", action="store_true", help="Nonzero exit unless every source group passes")
    args = ap.parse_args(argv)
    text = args.umasim.read_text(encoding="utf-8")
    source = read_umasim(text)
    master = read_master(args.master)
    report = audit(source, master)
    compact = {k: v for k, v in report.items() if k != "results"}
    compact.update({"sourceRevision": args.source_revision, "masterRevision": args.master_revision,
                    "sourceSha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                    "masterSha256": hashlib.file_digest(args.master.open("rb"), "sha256").hexdigest(),
                    "rejectedOrUnconfirmed": [x for x in report["results"]
                                             if x["status"] not in ("independent_master_order_agrees",
                                                                    "master_supports_no_lower_in_snapshot")]})
    print(json.dumps(compact, ensure_ascii=False, indent=2))
    if args.strict and not report["passed"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, sqlite3.Error, ValueError, json.JSONDecodeError) as e:
        print("Audit failed: " + str(e), file=sys.stderr)
        sys.exit(1)
