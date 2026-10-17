"""Synthetic regression for historical support-card story ID coverage."""
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_historical_event_master import (
    audit, read_candidates, read_master, read_source_cards,
)


def source_data(ids=("30001", "20001", "10001")):
    rows = []
    for cid in ids:
        for stage in range(5):
            f = ["0"] * 62
            f[0] = cid
            f[1] = "[FAKE TEST CARD]" + cid
            f[3] = {"3": "3", "2": "2", "1": "1"}[cid[0]]
            f[4] = str(stage)
            rows.append("\t".join(f))
    return "\n".join(rows)


def fake_master(path, missing_gallery=False):
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE support_card_data (id INTEGER PRIMARY KEY)")
        db.execute("CREATE TABLE single_mode_story_data (id INTEGER PRIMARY KEY, "
                   "support_card_id INTEGER, support_chara_id INTEGER" +
                   ("" if missing_gallery else ", gallery_flag INTEGER") + ")")
        db.executemany("INSERT INTO support_card_data(id) VALUES (?)",
                       [(30001,), (20001,), (10002,)])
        if not missing_gallery:
            db.executemany(
                "INSERT INTO single_mode_story_data VALUES (?,?,?,?)",
                [(901, 30001, 0, 2), (902, 30001, 0, 2),
                 (903, 30001, 0, 1), (904, 0, 5555, 2),
                 (905, 99999, 0, 2)]
            )


def candidates(cards, counts):
    rows = []
    for cid, count in counts.items():
        rows.append({"cardId": cid, "events": [
            {"sourceDigest": "sha256:" + str(i).zfill(64)} for i in range(count)]})
    return json.dumps({"source": "UmaUmaChecker", "format": 1, "cards": rows,
                       "stats": {"matchedCards": len(rows), "eventCount": sum(counts.values())}})


class HistoricalEventAudit(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "master.mdb"
        fake_master(self.path)
        self.cards = read_source_cards(source_data())
        self.master = read_master(self.path)

    def test_unique_all_five_stages(self):
        self.assertEqual(self.cards, {"30001": "SSR", "20001": "SR", "10001": "R"})
        raw = source_data().splitlines()
        with self.assertRaisesRegex(ValueError, "Inconsistent"):
            read_source_cards("\n".join(raw + [raw[0]]))
        with self.assertRaisesRegex(ValueError, "Missing"):
            read_source_cards("\n".join(raw[:-1]))

    def test_only_gallery_two_card_specific_stories_count(self):
        self.assertEqual(self.master["master_card_count"], 3)
        self.assertEqual(self.master["eligible_story_rows"], 3)
        self.assertEqual(self.master["direct_stories"]["30001"], { "901", "902" })
        self.assertEqual(self.master["orphan_direct_card_ids"], ["99999"])
        self.assertNotIn("904", self.master["direct_stories"].get("30001", set()))

    def test_version_gap_is_not_misreported_as_missing_event(self):
        checker = read_candidates(candidates(self.cards, {"30001": 1, "20001": 3}), self.cards)
        result = audit(self.cards, self.master, checker)
        self.assertEqual(result["sourceCardCount"], 3)
        self.assertEqual(result["sourceNotInOldMasterIds"], ["10001"])
        self.assertEqual(result["oldMasterWithoutCardDirectStoryIds"], ["20001"])
        self.assertEqual(result["lessCandidateThanHistoricalDirectStoryCount"], 1)
        self.assertEqual(result["possibleCardSpecificGaps"][0]["cardId"], "30001")
        self.assertEqual(result["possibleCardSpecificGaps"][0]["historicalDirectStories"], 2)
        self.assertEqual(result["possibleCardSpecificGaps"][0]["checkerCandidateEvents"], 1)
        self.assertEqual(result["byRarity"]["SSR"]["candidateLessThanDirectStory"], 1)
        self.assertEqual(result["candidateRecords"], 4)

    def test_unsupported_candidate_ids_and_bad_totals_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown"):
            read_candidates(candidates(self.cards, {"39999": 1}), self.cards)
        broken = json.loads(candidates(self.cards, {"30001": 2}))
        broken["stats"]["eventCount"] = 1
        with self.assertRaisesRegex(ValueError, "inconsistent"):
            read_candidates(json.dumps(broken), self.cards)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            read_candidates(json.dumps({
                "source": "UmaUmaChecker", "format": 1,
                "cards": [{"cardId": "30001", "events": []}, {"cardId": "30001", "events": []}],
                "stats": {"matchedCards": 2, "eventCount": 0}
            }), self.cards)

    def test_master_schema_missing_column_rejected(self):
        path = Path(self.temp.name) / "broken.mdb"
        fake_master(path, missing_gallery=True)
        with self.assertRaisesRegex(ValueError, "missing columns"):
            read_master(path)


if __name__ == "__main__":
    unittest.main()
