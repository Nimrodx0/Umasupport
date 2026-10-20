import json
import sqlite3
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_direct_historical_chain import fingerprint, unique_join, stage_evidence, read_old_master, source_event_index


class DirectHistoricalChainTests(unittest.TestCase):
    def event(self, title, ordinal):
        return dict(ordinal=ordinal, kind="arrows",
                    exact=fingerprint(title), loose=fingerprint(title, True))

    def old(self, title, story_id, stage, maximum=3, flag=0):
        return dict(storyId=str(story_id), exact=fingerprint(title),
                    loose=fingerprint(title, True),
                    stage=stage, maximum=maximum, flag=flag)

    def test_name_is_japanese_and_explicitly_normalized(self):
        self.assertEqual(fingerprint("   全力！ "), fingerprint("全力!"))
        self.assertNotEqual(fingerprint("全力！"), fingerprint("全力"))
        self.assertEqual(fingerprint("全力！", True), fingerprint("全力", True))

    def test_match_requires_unique_card_local_names(self):
        old = [self.old("始まり", 1, 1), self.old("次へ", 2, 2),
               self.old("同名", 3, 3), self.old("同名", 4, 3)]
        res = unique_join([self.event("始まり", 1), self.event("次へ", 2),
                           self.event("同名", 3)], old)
        self.assertEqual(sorted(res), [1, 2])
        self.assertEqual(res[1]["method"], "title-exact")

    def test_typographic_is_weaker_but_separate(self):
        res = unique_join([self.event("始まり！", 1)], [self.old("始まり", 11, 1)])
        self.assertEqual(res[1]["method"], "title-typographic")

    def test_stage_order_and_metadata_conflicts(self):
        rows = [self.old("前", 10, 1), self.old("後", 11, 2)]
        self.assertEqual(stage_evidence(rows[0], rows[1], rows),
                         "2025-direct-exact-local-order")
        self.assertEqual(stage_evidence(rows[1], rows[0], rows),
                         "old-master-stage-order-conflicts")
        self.assertEqual(stage_evidence(rows[0], None, rows),
                         "old-master-next-end-unmatched")
        self.assertEqual(stage_evidence(None, None, rows),
                         "old-master-both-ends-unmatched")

    def test_reject_collisions_even_when_names_are_distinct(self):
        rows = [self.old("A", 10, 1), self.old("B", 11, 2), self.old("C", 12, 1)]
        self.assertEqual(stage_evidence(rows[0], rows[1], rows),
                         "old-master-stage-label-ambiguous")
        rows[1]["maximum"] = 4
        self.assertEqual(stage_evidence(rows[0], rows[1], rows),
                         "old-master-stage-group-differs")

    def test_sqlite_requires_story_id_and_category_181_not_internal_id(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "old.mdb"
            with sqlite3.connect(p) as con:
                con.executescript("""
                CREATE TABLE single_mode_story_data(id INTEGER, story_id INTEGER,
                    support_card_id INTEGER, gallery_flag INTEGER,
                    show_progress_1 INTEGER, show_progress_2 INTEGER, show_progress_3 INTEGER);
                CREATE TABLE text_data(category INTEGER, "index" INTEGER, text TEXT);
                INSERT INTO single_mode_story_data VALUES(123,830001001,30001,2,1,3,0);
                INSERT INTO text_data VALUES(181,830001001,'日本語イベント');
                INSERT INTO text_data VALUES(181,123,'間違った内部ID');
                """)
            rows = read_old_master(p, check_hash=False)
            self.assertEqual(rows["30001"][0]["storyId"], "830001001")
            self.assertEqual(rows["30001"][0]["exact"], fingerprint("日本語イベント"))
            self.assertNotEqual(rows["30001"][0]["exact"], fingerprint("間違った内部ID"))

    def test_source_prefer_japanese_events_and_preserve_positions(self):
        x = source_event_index({"events": {"a": {"name":"EN", "section":"arrows","choices":[{}]}},
           "events_ja":{"a":{"name":"日本語", "section":"random","choices":[]},
                        "b":{"name":"連続", "section":"arrows","choices":[]}}})
        self.assertEqual(len(x),2)
        self.assertEqual(x[1]["ordinal"],2)
        self.assertEqual(x[1]["exact"],fingerprint("連続"))


if __name__ == "__main__":
    unittest.main()
