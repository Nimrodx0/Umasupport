"""Synthetic SQLite tests for the independent master skill audit (no publisher data)."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

MODULE=Path(__file__).resolve().parents[1]/"tools"/"verify_skill_master.py"
spec=importlib.util.spec_from_file_location("verify_skill_master",MODULE)
verifier=importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


def fixture_source():
    data=[
        {"id":"700004","name":"架空金A","rarity":"rare","group":70000},
        {"id":"700002","name":"右回り◎","rarity":"normal","group":70000},
        {"id":"700001","name":"右回り○","rarity":"normal","group":70000},
        {"id":"700014","name":"架空金B","rarity":"rare","group":70001},
        {"id":"700012","name":"架空白B","rarity":"normal","group":70001},
        {"id":"700024","name":"架空金C","rarity":"rare","group":70002},
    ]
    data += [{"id":str(800000+i),"name":"ダミー"+str(i),"rarity":"normal",
              "group":(800000+i)//10} for i in range(110)]
    return data


def fixture_master(path):
    con=sqlite3.connect(path)
    con.execute("CREATE TABLE skill_data (id INTEGER PRIMARY KEY, group_id INTEGER, group_rate INTEGER, rarity INTEGER)")
    rows=[(700001,70000,1,1),(700002,70000,2,1),(700004,70000,3,2),
          (700012,70001,1,1),(700014,70001,2,2),(700024,70002,1,2)]
    con.executemany("INSERT INTO skill_data VALUES (?,?,?,?)",rows)
    con.commit()
    return con


class MasterAuditTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.master_path=Path(self.temp.name)/"master.mdb"
        self.con=fixture_master(self.master_path)
        self.addCleanup(self.con.close)
        self.source=verifier.read_umasim(json.dumps(fixture_source()))

    def audit(self):
        return verifier.audit(self.source,verifier.read_master(self.master_path))

    def test_full_chain_order_and_no_lower(self):
        r=self.audit()
        self.assertTrue(r["passed"])
        self.assertEqual((r["totalRareInUmaSim"],r["sourceStructuralCandidates"],
                          r["independentAgreedChains"],r["sourceWithoutLower"],
                          r["independentNoLowerSnapshot"]),(3,2,2,1,1))

    def test_missing_master_skill_does_not_count_as_verified(self):
        self.con.execute("DELETE FROM skill_data WHERE id=700004");self.con.commit()
        r=self.audit()
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["master_missing"],1)
        self.assertEqual(r["independentAgreedChains"],1)

    def test_wrong_order_is_rejected(self):
        self.con.execute("UPDATE skill_data SET group_rate=0 WHERE id=700004");self.con.commit()
        r=self.audit()
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["master_rank_order_conflict"],1)

    def test_extra_lower_in_master_invalidates_no_lower(self):
        self.con.execute("INSERT INTO skill_data VALUES (700023,70002,0,1)");self.con.commit()
        r=self.audit()
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["master_extra_group_members"],1)

    def test_group_identity_and_rarity_are_checked(self):
        self.con.execute("UPDATE skill_data SET group_id=70003 WHERE id=700012");self.con.commit()
        r=self.audit()
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["master_group_or_rarity_mismatch"],1)

    def test_source_three_way_collision_is_quarantined(self):
        data=fixture_source()
        data.append({"id":"700003","name":"右回り△","rarity":"normal","group":70000})
        source=verifier.read_umasim(json.dumps(data))
        r=verifier.audit(source,verifier.read_master(self.master_path))
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["source_ambiguous"],1)

    def test_name_collision_is_quarantined(self):
        data=fixture_source()
        data[-1]["name"]="架空金A"
        source=verifier.read_umasim(json.dumps(data))
        r=verifier.audit(source,verifier.read_master(self.master_path))
        self.assertFalse(r["passed"])
        self.assertEqual(r["statusCounts"]["source_ambiguous"],1)

    def test_duplicate_ids_are_rejected(self):
        data=fixture_source()
        data.append(dict(data[0]))
        with self.assertRaisesRegex(ValueError,"Duplicate"):
            verifier.read_umasim(json.dumps(data))

    def test_incomplete_master_schema_fails_closed(self):
        self.con.close()
        Path(self.master_path).unlink()
        with sqlite3.connect(self.master_path) as c:
            c.execute("CREATE TABLE skill_data (id INTEGER)")
        with self.assertRaisesRegex(ValueError,"lacks columns"):
            verifier.read_master(self.master_path)


if __name__ == "__main__":
    unittest.main()
