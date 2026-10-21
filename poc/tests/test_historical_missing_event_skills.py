"""Synthetic isolation tests; no third-party raw master or game event text."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import unittest

MODULE = Path(__file__).resolve().parents[1] / "tools" / "crosscheck_missing_event_skills_2025.py"
spec = importlib.util.spec_from_file_location("event_gap_old_skill", MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def fake_db():
    db = sqlite3.connect(":memory:")
    db.executescript('''
        CREATE TABLE skill_data (id INTEGER, group_id INTEGER, group_rate INTEGER, rarity INTEGER);
        CREATE TABLE text_data(category INTEGER, "index" INTEGER, text TEXT);
        INSERT INTO skill_data VALUES (200831, 20083, 1, 1);
        INSERT INTO skill_data VALUES (200861, 20086, 3, 2);
        INSERT INTO skill_data VALUES (200941, 20094, -1, 3);
        INSERT INTO skill_data VALUES (200881, 20088, 2, 1);
        INSERT INTO text_data VALUES (47, 200831, '特定の第三者名を公開しない');
        INSERT INTO text_data VALUES (47, 200861, '熟練の技');
        INSERT INTO text_data VALUES (47, 200881, '名前A');
        INSERT INTO text_data VALUES (47, 200881, '名前B');
    ''')
    return db


def synthetic_crosswalk():
    def gap(sid, index):
        return {
            "reason": "not-in-pinned-umasim-registry", "kind": "hint",
            "numericId": str(sid), "cardId": "30026",
            "sourceOrdinal": 1, "choiceOrdinal": index,
            "routeOrdinal": 1, "hintOrdinal": 1,
        }
    return {
        "dataKind": "gametora-event-skill-crosswalk-draft",
        "releaseApproved": False,
        "sourcePins": {"gameToraDerived": mod.GT_REV,
                       "umaSimSkills": mod.SKILL_REV},
        "stats": {"missingPinnedSkillIds": 6},
        "unresolved": [gap(200831, 1), gap(200831, 2),
                       gap(200861, 3), gap(200941, 4),
                       gap(200881, 5), gap(999999, 6)],
    }


class HistoricCrosscheckTest(unittest.TestCase):
    def test_all_distinct_id_classes_and_duplicate_occurrences_counted(self):
        with fake_db() as db:
            old = mod.read_old_master(db)
        report = mod.review_gaps(synthetic_crosswalk(), old)
        self.assertEqual(report["crosswalkMissingOccurrences"], 6)
        self.assertEqual(report["crosswalkMissingDistinctIds"], 5)
        self.assertEqual(report["countsByHistoricalStatus"], {
            "2025-ID-and-rarity-with-unique-JP-name": 3,
            "2025-no-unique-JP-name": 1,
            "2025-non-normal-or-rare": 1,
            "absent-from-2025-master": 1,
        })
        rows = {x["numericId"]: x for x in report["rows"]}
        self.assertEqual(rows["200831"]["occurrences"], 2)
        self.assertEqual(rows["200861"]["historicalRarity"], 2)
        self.assertIsNone(rows["200831"].get("name"))
        self.assertTrue(rows["200831"]["historicalNameFingerprint"].startswith("sha256:"))
        self.assertNotIn("特定の第三者名を公開しない", json.dumps(report, ensure_ascii=False))
        self.assertFalse(report["game2026Verified"])
        self.assertFalse(report["automaticAdoptionAllowed"])
    def test_crosswalk_inconsistency_and_duplicate_route_are_rejected(self):
        with fake_db() as db:
            old = mod.read_old_master(db)
        report = synthetic_crosswalk()
        report["stats"]["missingPinnedSkillIds"] = 5
        with self.assertRaisesRegex(ValueError, "count changed"):
            mod.review_gaps(report, old)
        report = synthetic_crosswalk()
        report["unresolved"][1] = dict(report["unresolved"][0])
        with self.assertRaisesRegex(ValueError, "duplicate"):
            mod.review_gaps(report, old)
        report = synthetic_crosswalk()
        report["sourcePins"]["gameToraDerived"] = "fake"
        with self.assertRaisesRegex(ValueError, "untrusted"):
            mod.review_gaps(report, old)
    def test_private_runner_preview_contains_only_historically_proven_names(self):
        with fake_db() as db:
            old = mod.read_old_master(db)
        report = mod.review_gaps(synthetic_crosswalk(), old)
        private = mod.private_historical_preview(report, old)
        self.assertEqual(private["dataKind"],
                         "historical-2025-skill-preview-private-runner-only")
        self.assertFalse(private["publicationAllowed"])
        self.assertFalse(private["game2026Verified"])
        self.assertEqual(len(private["skills"]), 2)
        self.assertEqual({x["id"] for x in private["skills"]}, {"200831", "200861"})
        self.assertIn("特定の第三者名を公開しない",
                      json.dumps(private, ensure_ascii=False))
        # The publicly uploaded numeric report MUST remain a hash-only record.
        self.assertNotIn("特定の第三者名を公開しない",
                         json.dumps(report, ensure_ascii=False))
        broken = dict(report)
        broken["rows"] = [dict(x) for x in report["rows"]]
        broken["rows"][0]["historicalNameFingerprint"] = "sha256:" + "0" * 64
        with self.assertRaisesRegex(ValueError, "fingerprint"):
            mod.private_historical_preview(broken, old)

    def test_broken_historical_sqlite_schema_rejected(self):
        db = sqlite3.connect(":memory:")
        db.execute("CREATE TABLE skill_data(id INTEGER)")
        with self.assertRaisesRegex(ValueError, "missing skill_data"):
            mod.read_old_master(db)
        db.close()
    def test_no_numeric_outcome_is_published_as_game_fact(self):
        with fake_db() as db:
            report = mod.review_gaps(synthetic_crosswalk(), mod.read_old_master(db))
        for row in report["rows"]:
            self.assertEqual(set(row).difference({
                "numericId", "occurrences", "historicalStatus",
                "historicalRarity", "historicalGroup",
                "historicalNameFingerprint", "historicalNameCount",
            }), set())
            self.assertNotIn("gameVerified", row)


if __name__ == "__main__":
    unittest.main()
