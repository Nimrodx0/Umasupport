#!/usr/bin/env python3
"""Cross-check the complete UmaSim rare/normal hierarchy against a separate skill JSON.

The comparison only reports structural skill IDs and summary counts; no third-party
data is bundled or republished. A dated export does not prove live-game completeness.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import sys

from verify_skill_master import read_umasim


def normalize_id(value):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("A skill ID must not be boolean")
    value = str(value)
    if not value.isascii() or not value.isdecimal() or int(value) <= 0:
        raise ValueError("Invalid skill ID")
    return value


def read_independent(text):
    raw = json.loads(text.lstrip("\ufeff"))
    if not isinstance(raw, list) or len(raw) < 100:
        raise ValueError("Independent skill source is empty or malformed")
    by_id = {}
    by_group = defaultdict(list)
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ValueError(f"Invalid independent record {i}")
        required = ("id", "rarity", "groupId", "groupRate",
                    "lowerSkillId", "upperSkillId")
        if not all(k in item for k in required):
            raise ValueError(f"Missing independent fields at row {i}")
        sid = normalize_id(item["id"])
        if sid in by_id:
            raise ValueError("Duplicate independent skill ID " + sid)
        nums = ("rarity", "groupId", "groupRate")
        if any(type(item[k]) is not int for k in nums):
            raise ValueError("Invalid independent numeric fields")
        record = {
            "id": sid, "rarity": item["rarity"],
            "group": item["groupId"], "rate": item["groupRate"],
            "lower": normalize_id(item["lowerSkillId"]),
            "upper": normalize_id(item["upperSkillId"]),
        }
        by_id[sid] = record
        if record["rarity"] in (1, 2) and record["rate"] >= 0:
            by_group[record["group"]].append(record)
    return {"by_id": by_id, "by_group": by_group, "records": len(raw)}


def compare(umasim, independent):
    status = Counter()
    checks = Counter()
    results = []
    for group_id, group in sorted(umasim["groups"].items()):
        if not group["rare"]:
            continue
        rares, normals = group["rare"], group["normal"]
        ids = [r["id"] for r in rares + normals]
        result = {"group": group_id, "goldIds": [r["id"] for r in rares]}
        if len(rares) != 1:
            result["status"] = "source_ambiguous"
        elif not normals:
            gold = independent["by_id"].get(rares[0]["id"])
            if gold is None:
                result["status"] = "missing_ids"
                result["missingIds"] = [rares[0]["id"]]
            elif gold["group"] != group_id or gold["rarity"] != 2:
                result["status"] = "metadata_mismatch"
            elif any(x["rarity"] == 1 for x in independent["by_group"].get(group_id, [])):
                result["status"] = "no_lower_has_independent_white"
            else:
                result["status"] = "no_lower_agrees_with_snapshot"
        else:
            names = [r["name"] for r in normals]
            circles = (len(normals) == 2
                       and sum(x.endswith("○") for x in names) == 1
                       and sum(x.endswith("◎") for x in names) == 1)
            safe_ids = all(int(x["id"]) // 10 == group_id
                           and umasim["name_counts"][x["name"]] == 1
                           for x in rares + normals)
            if len(normals) not in (1, 2) or (len(normals) == 2 and not circles) or not safe_ids:
                result["status"] = "source_ambiguous"
            else:
                rows = [independent["by_id"].get(sid) for sid in ids]
                missing = [sid for sid in ids if independent["by_id"].get(sid) is None]
                if missing:
                    result["status"] = "missing_ids"
                    result["missingIds"] = missing
                elif any(r["group"] != group_id or
                         r["rarity"] != (2 if sid == rares[0]["id"] else 1)
                         for sid, r in zip(ids, rows)):
                    result["status"] = "metadata_mismatch"
                else:
                    extras = [r["id"] for r in independent["by_group"].get(group_id, [])
                              if r["id"] not in ids]
                    if extras:
                        result["status"] = "extra_group_members"
                        result["extraIds"] = sorted(extras)
                    else:
                        if circles:
                            ordered = [
                                next(x for x in normals if x["name"].endswith("○"))["id"],
                                next(x for x in normals if x["name"].endswith("◎"))["id"],
                                rares[0]["id"],
                            ]
                        else:
                            ordered = [normals[0]["id"], rares[0]["id"]]
                        ranks = [independent["by_id"][sid]["rate"] for sid in ordered]
                        if not all(x >= 0 for x in ranks) or not all(
                                left < right for left, right in zip(ranks, ranks[1:])):
                            result["status"] = "rank_mismatch"
                            result["ranks"] = ranks
                        else:
                            conflicts = []
                            nonnull = 0
                            for index, sid in enumerate(ordered):
                                info = independent["by_id"][sid]
                                expected_lower = ordered[index - 1] if index else None
                                expected_upper = ordered[index + 1] if index < len(ordered)-1 else None
                                # Only non-null pointers supply extra corroboration.
                                for field, target in (("lower", expected_lower), ("upper", expected_upper)):
                                    if info[field] is not None:
                                        nonnull += 1
                                        if info[field] != target:
                                            conflicts.append({"id": sid, "field": field, "actualId": info[field],
                                                              "expectedId": target})
                            if conflicts:
                                result["status"] = "explicit_link_conflict"
                                result["conflicts"] = conflicts
                            else:
                                result["status"] = "rank_and_group_agree"
                                if nonnull:
                                    checks["chainsWithConsistentPointers"] += 1
                                    checks["nonNullPointersConsistent"] += nonnull
                                else:
                                    checks["chainsWithoutExplicitPointers"] += 1
                                if circles:
                                    checks["threeStepChainsAgreed"] += 1
                                else:
                                    checks["twoStepChainsAgreed"] += 1
        status[result["status"]] += 1
        results.append(result)
    total_rare = sum(len(g["rare"]) for g in umasim["groups"].values())
    good_chains = status["rank_and_group_agree"]
    no_lower = status["no_lower_agrees_with_snapshot"]
    covered_rare = good_chains + no_lower
    return {
        "allConfirmedInIndependentSnapshot": covered_rare == total_rare and
        len(results) == total_rare,
        "sourceRare": total_rare, "sourceGroupCount": len(results),
        "sourceStructuralChains": sum(
            1 for g in umasim["groups"].values() if g["rare"] and g["normal"] and len(g["rare"]) == 1),
        "matchingChains": good_chains, "matchingNoLowerSnapshot": no_lower,
        "statusCounts": dict(sorted(status.items())),
        "pointerEvidence": dict(checks),
        "unconfirmed": [x for x in results if x["status"] not in
                        ("rank_and_group_agree", "no_lower_agrees_with_snapshot")],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--umasim", required=True, type=Path)
    parser.add_argument("--independent", required=True, type=Path)
    parser.add_argument("--umasim-revision", required=True)
    parser.add_argument("--independent-revision", required=True)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args(argv)
    src_text = args.umasim.read_text(encoding="utf-8")
    other_text = args.independent.read_text(encoding="utf-8")
    result = compare(read_umasim(src_text), read_independent(other_text))
    result.update({
        "umasimRevision": args.umasim_revision,
        "independentRevision": args.independent_revision,
        "umasimSha256": hashlib.sha256(src_text.encode("utf-8")).hexdigest(),
        "independentSha256": hashlib.sha256(other_text.encode("utf-8")).hexdigest(),
    })
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if args.strict and not result["allConfirmedInIndependentSnapshot"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, json.JSONDecodeError) as e:
        print("Audit failed: " + str(e), file=sys.stderr)
        sys.exit(1)
