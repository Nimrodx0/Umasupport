import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from probe_historical_disp_order import probe


class HistoricalOrderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / "sample.mdb"
        with sqlite3.connect(self.db) as db:
            db.execute("CREATE TABLE skill_data(id INTEGER PRIMARY KEY, disp_order INTEGER, rarity INTEGER, group_id INTEGER)")
            db.executemany("INSERT INTO skill_data VALUES (?,?,?,?)", [
                (201012, 50, 1, 20101), (200001, 50, 1, 20000),
                (200002, 150, 2, 20000), (200003, 0, 1, 20000)
            ])

    def tearDown(self):
        self.temp.cleanup()

    def test_ties_and_zero_orders_are_not_global_unique(self):
        r = probe(self.db, json.dumps([{"id": str(i)} for i in
            (201012, 200001, 200002, 200003, 299999)]))
        self.assertEqual(r["historicalSkillRecords"], 4)
        self.assertEqual(r["sharedIds"], 4)
        self.assertEqual(r["missingFromHistorical"], 1)
        self.assertEqual(r["sharedPositiveDispOrder"], 3)
        self.assertEqual(r["positiveDistinctValues"], 2)
        self.assertEqual(r["positiveOrderTieBuckets"], 1)
        self.assertEqual(r["positiveOrderRowsInTies"], 2)
        self.assertEqual(r["sharedNoPositiveOrder"], 1)
        self.assertFalse(r["historicId201012AlsoInCurrent"] is False)
        self.assertTrue(r["doesNotProveCurrentGameUIOrder"])

    def test_missing_master_order_column_is_rejected(self):
        with sqlite3.connect(self.db) as db:
            db.execute("DROP TABLE skill_data")
            db.execute("CREATE TABLE skill_data(id INTEGER PRIMARY KEY, rarity INTEGER, group_id INTEGER)")
        with self.assertRaisesRegex(ValueError, "disp_order"):
            probe(self.db, '[{"id":"201012"}]')

    def test_duplicate_current_id_not_accepted(self):
        with self.assertRaisesRegex(ValueError, "Duplicate current"):
            probe(self.db, '[{"id":"201012"},{"id":"201012"}]')


if __name__ == "__main__":
    unittest.main()
