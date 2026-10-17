"""Fail-closed tests for 2025 story title residual metadata classifier."""
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/"tools"))
from audit_story_residual_metadata import (
    read_master_metadata, compare_residuals,
)
from audit_story_title_links import title_digest

META = ("show_progress_1","show_progress_2","show_progress_3",
        "event_category","ending_type","gallery_main_scenario","gallery_condition")


class TestStoryResidualMetadata(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db=Path(self.tmp.name)/"source.sqlite"
        with sqlite3.connect(self.db) as db:
            db.execute("CREATE TABLE single_mode_story_data ("
                       "id INTEGER PRIMARY KEY,story_id INTEGER,support_card_id INTEGER,"
                       "gallery_flag INTEGER,"+
                       ",".join(m+" INTEGER" for m in META)+")")
            db.execute('CREATE TABLE text_data (category INTEGER,"index" INTEGER,text TEXT)')
            # Two historical rows share the same title, only one Checker candidate.
            # Their identities therefore remain AMBIGUOUS rather than asserting
            # which historical row is missing.
            rows=[
                (1,901,30241,2,1,4,1,2,0,0,0),
                (2,902,30241,2,2,4,1,2,0,0,0),
                (3,903,30241,2,0,0,0,7,0,0,0),
                (4,904,30241,2,0,0,0,8,0,0,0),
                (5,905,30001,2,0,0,0,6,0,0,0),
                (6,906,30241,1,0,0,0,9,0,0,0),
            ]
            db.executemany("INSERT INTO single_mode_story_data VALUES (?,?,?,?,?,?,?,?,?,?,?)",rows)
            db.executemany('INSERT INTO text_data VALUES (?,?,?)',
                           [(181,901,"同名！"),(181,902,"同名！"),
                            (181,903,"一致"),(181,904,"残差"),
                            (181,905,"他カード"),(181,906,"除外"),
                            (50,904,"対象外カテゴリー")])
        self.cards={"30241":"SSR","30001":"SSR"}
        self.candidates={"30241":[title_digest("同名!",normalization="typography"),
                                  title_digest("一致",normalization="typography")],
                         "30001":[title_digest("他カード",normalization="typography")]}

    def test_residual_is_not_false_story_identity(self):
        source=read_master_metadata(self.db)
        report=compare_residuals(self.cards,self.candidates,source)
        focus=report["focus"]
        self.assertEqual(focus["historicalStoryCount"],4)
        self.assertEqual(focus["candidateCount"],2)
        self.assertEqual(focus["provisionalTypographyMatches"],2)
        self.assertEqual(focus["unmatchedHistoricalTitleRows"],2)
        self.assertEqual(report["allSSR_SR"]["ambiguousResidualCount"],1)
        self.assertEqual(len(focus["residualGroups"]),2)
        dup=next(g for g in focus["residualGroups"] if g["ambiguousIdentity"])
        self.assertEqual(dup["possibleStoryIds"],["901","902"])
        self.assertEqual(dup["unmatchedCount"],1)
        self.assertEqual(dup["historicalTitleMultiplicity"],2)
        self.assertEqual(dup["candidateTitleMultiplicity"],1)
        single=next(g for g in focus["residualGroups"] if not g["ambiguousIdentity"])
        self.assertEqual(single["possibleStoryIds"],["904"])
        self.assertEqual(single["metadata"][0]["event_category"],8)
        self.assertNotIn("同名",json.dumps(report,ensure_ascii=False))
        self.assertNotIn("sha256:",json.dumps(report,ensure_ascii=False))

    def test_title_category_missing_fails_closed(self):
        with sqlite3.connect(self.db) as db:
            db.execute('DELETE FROM text_data WHERE category=181 AND "index"=904')
        with self.assertRaisesRegex(ValueError,"Missing historical story title"):
            read_master_metadata(self.db)

    def test_duplicate_text_mapping_fails_closed(self):
        with sqlite3.connect(self.db) as db:
            db.execute('INSERT INTO text_data VALUES (181,904,"異名")')
        with self.assertRaisesRegex(ValueError,"Duplicate historical"):
            read_master_metadata(self.db)

    def test_schema_regression_fails_closed(self):
        with sqlite3.connect(self.db) as db:
            db.execute('ALTER TABLE text_data RENAME TO old_text')
        with self.assertRaisesRegex(ValueError,"Missing historical table"):
            read_master_metadata(self.db)

    def test_unknown_source_card_and_focus_rejected(self):
        old=read_master_metadata(self.db)
        with self.assertRaisesRegex(ValueError,"non-source"):
            compare_residuals(self.cards,{"30241":[],"30001":[]}, {**old,"39999":[]})
        with self.assertRaisesRegex(ValueError,"Focus"):
            compare_residuals(self.cards,self.candidates,old,focus="99999")
        with self.assertRaisesRegex(ValueError,"Missing candidate"):
            compare_residuals(self.cards,{"30241":[]},old)


if __name__=="__main__":
    unittest.main()
