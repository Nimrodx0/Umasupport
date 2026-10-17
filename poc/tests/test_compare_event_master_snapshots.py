"""Compare two synthetic SQLite revisions, rejecting ambiguous master schema."""
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from compare_event_master_snapshots import snapshot, compare, main

SCHEMA="""CREATE TABLE support_card_data(id INTEGER);
CREATE TABLE single_mode_story_data (
 id INTEGER,story_id INTEGER,support_card_id INTEGER,gallery_flag INTEGER,
 show_progress_1 INTEGER,show_progress_2 INTEGER,show_progress_3 INTEGER,
 event_category INTEGER,ending_type INTEGER,gallery_main_scenario INTEGER,
 gallery_condition INTEGER);
CREATE TABLE text_data(category INTEGER,"index" INTEGER,text TEXT);
"""

def make_master(path,cards,events):
    with sqlite3.connect(path) as db:
        db.executescript(SCHEMA)
        db.executemany("INSERT INTO support_card_data VALUES (?)",[(int(x),) for x in cards])
        db.executemany("INSERT INTO single_mode_story_data VALUES (?,?,?,?,?,?,?,?,?,?,?)",[
            (i,int(sid),int(cid),2,*meta) for i,sid,cid,title,meta in events
        ])
        db.executemany("INSERT INTO text_data VALUES (181,?,?)",[
            (int(sid),title) for i,sid,cid,title,meta in events
        ])


class CompareMasterRevisionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        base=Path(self.tmp.name)
        self.old,self.new=base/"old.sqlite",base/"new.sqlite"
        first=[(1,"830241004","30241","一番！",(0,0,0,4,0,0,0)),
               (2,"830241005","30001","二番",(1,1,1,4,0,0,0))]
        second=[(1,"830241004","30241","一番!",(0,0,0,4,1,0,0)),
                (2,"830241006","30002","新しい",(0,0,0,4,0,0,0))]
        make_master(self.old,["30241","30001","20001"],first)
        make_master(self.new,["30241","30002","20001"],second)
        self.cards={"30241":"SSR","30001":"SSR","30002":"SSR","20001":"SR","10001":"R"}

    def test_version_gaps_and_focus_stable_story_id(self):
        r=compare(self.cards,snapshot(self.old),snapshot(self.new))
        self.assertEqual(r["newMasterCardsIntersectSource"],3)
        self.assertEqual(r["oldMasterCardsIntersectSource"],3)
        self.assertEqual(r["previouslyAbsentNowPresentSourceCardIds"],["30002"])
        self.assertEqual(r["previouslyPresentNowAbsentSourceCardIds"],["30001"])
        self.assertEqual(r["newMissingSourceCards"],2)
        self.assertEqual(r["preservedDirectStoryIds"],1)
        self.assertEqual(r["historicalDirectStoryIdsNotInNew"],1)
        self.assertEqual(r["newDirectStoryIdsNotInOld"],1)
        self.assertEqual(r["preservedIdTypographicTitleChanged"],0)
        self.assertEqual(r["preservedIdMetadataChanged"],1)
        self.assertTrue(r["focus"]["newStoryOnFocusCard"])
        self.assertTrue(r["focus"]["titleSameAfterTypographyNormalization"])
        self.assertFalse(r["focus"]["numericMetadataIdentical"])
        self.assertNotIn("一番",str(r))
        self.assertNotIn("sha256:",str(r))

    def test_removed_focus_id_is_not_misclassified_as_data_absence_gamewide(self):
        with sqlite3.connect(self.new) as db:
            db.execute("DELETE FROM single_mode_story_data WHERE story_id=830241004")
        r=compare(self.cards,snapshot(self.old),snapshot(self.new))
        self.assertFalse(r["focus"]["newStoryPresent"])
        self.assertTrue(r["focus"]["newCardPresent"])
        self.assertIsNone(r["focus"]["titleSameAfterTypographyNormalization"])

    def test_duplicate_cards_or_corrupt_text_rejected(self):
        with sqlite3.connect(self.new) as db:
            db.execute("INSERT INTO support_card_data VALUES (30241)")
        with self.assertRaisesRegex(ValueError,"Duplicate support card"):
            snapshot(self.new)
        with sqlite3.connect(self.new) as db:
            db.execute("DELETE FROM support_card_data WHERE rowid=(SELECT MAX(rowid) FROM support_card_data)")
            db.execute('DELETE FROM text_data WHERE category=181 AND "index"=830241006')
        with self.assertRaisesRegex(ValueError,"Missing historical story title"):
            snapshot(self.new)

    def test_orphan_card_and_schema_guard(self):
        with sqlite3.connect(self.new) as db:
            db.execute("DELETE FROM support_card_data WHERE id=30002")
        with self.assertRaisesRegex(ValueError,"linked to support card missing"):
            snapshot(self.new)
        with sqlite3.connect(self.new) as db:
            db.execute("ALTER TABLE text_data RENAME TO old_text")
        with self.assertRaisesRegex(ValueError,"Missing historical table"):
            snapshot(self.new)

    def test_master_provenance_and_old_sha_guard(self):
        # For synthetic input, explicitly disable the real historical SHA gate.
        # The two fixture files have different content.
        source=Path(self.tmp.name)/"support_card.txt"
        source.write_text("bad",encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"Historical snapshot SHA mismatch"):
            main(["--umasim",str(source),"--old-master",str(self.old),
                  "--new-master",str(self.new),"--new-revision","test"])
        with self.assertRaisesRegex(ValueError,"Two different"):
            main(["--umasim",str(source),"--old-master",str(self.old),
                  "--new-master",str(self.old),"--new-revision","test"])
        with self.assertRaisesRegex(ValueError,"Missing provenance"):
            main(["--umasim",str(source),"--old-master",str(self.old),
                  "--new-master",str(self.new),"--new-revision"," ",
                  "--expected-old-sha256",""])


if __name__=="__main__":
    unittest.main()
