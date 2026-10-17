"""Synthetic regression: candidate/master event title fingerprints without title disclosure."""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_story_title_links import (
    title_digest, read_historical_titles, read_candidate_titles, compare_titles,
)

def candidate_json(events):
    records = [{"cardId": "30001", "events": [
        {"sourceDigest": "sha256:" + "a"*64, "titleFingerprint": title_digest(title)}
        for title in events]}]
    return json.dumps({"source": "UmaUmaChecker", "format": 1, "cards": records,
                       "stats": {"matchedCards": 1, "eventCount": len(events)}})

class TitleLinkTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "m.db"
        self.cards = {"30001": "SSR", "20001": "SR", "10001": "R"}
        with sqlite3.connect(self.path) as db:
            db.execute("CREATE TABLE single_mode_story_data "
                       "(id INTEGER PRIMARY KEY, support_card_id INTEGER, gallery_flag INTEGER, short_story_id INTEGER)")
            db.execute('CREATE TABLE text_data (category INTEGER, "index" INTEGER, text TEXT)')
            db.executemany("INSERT INTO single_mode_story_data VALUES (?,?,?,?)",
                           [(901,30001,2,701),(902,30001,2,702),(903,30001,2,703),
                            (904,20001,2,704),(905,30001,1,705)])
            db.executemany('INSERT INTO text_data VALUES (?,?,?)',
                           [(181,901,"Ａ  タイトル"),(181,902,"イベント乙"),
                            (181,903,"イベント乙"),(181,904,"SRイベント"),
                            (181,905,"対象外イベント"),(47,901,"スキル名"),
                            (181,701,"別インデックス名")])

    def test_exact_unicode_normalization_and_duplicate_multiset(self):
        historical = read_historical_titles(self.path)
        checker = read_candidate_titles(candidate_json(["A タイトル", "イベント乙"]), self.cards)
        report = compare_titles(self.cards,checker,historical)
        s=report["focus30241"]
        self.assertIsNone(s)
        r=next(x for x in report["cardsWithHistoricalTitlesNotExactInChecker"] if x["cardId"]=="30001")
        self.assertEqual(r["provisionalExactTitleOverlap"],2)
        self.assertEqual(r["historicalTitlesNotExactInChecker"],1)
        self.assertEqual(r["checkerTitlesNotExactInMaster"],0)
        self.assertEqual(r["duplicateHistoricalTitleRows"],2)
        self.assertEqual(report["byRarity"]["SSR"]["historicalTitlesResolved"],3)
        self.assertNotIn("イベント",json.dumps(report,ensure_ascii=False))

    def test_text_index_is_explicit_not_auto_guessed(self):
        # Switching the key is a recorded alternative hypothesis, not automatic best-match selection.
        hist=read_historical_titles(self.path,title_index="short_story_id")
        self.assertEqual(hist["30001"],[title_digest("別インデックス名"),None,None])
        report=compare_titles(self.cards,read_candidate_titles(candidate_json(["A タイトル"]),self.cards),hist)
        self.assertEqual(report["byRarity"]["SSR"]["historicalTitlesMissing"],2)

    def test_missing_text_is_unknown_not_definitely_absent(self):
        with sqlite3.connect(self.path) as db:
            db.execute('DELETE FROM text_data WHERE category=181 AND "index"=901')
        r=compare_titles(self.cards, read_candidate_titles(candidate_json(["A タイトル"]), self.cards),
                         read_historical_titles(self.path))
        item=next(x for x in r["cardsWithHistoricalTitlesNotExactInChecker"] if x["cardId"]=="30001")
        self.assertEqual(item["historicalTitleRowsWithoutText"],1)
        self.assertEqual(item["provisionalExactTitleOverlap"],0)

    def test_reject_duplicated_text_mapping_or_malformed_fingerprints(self):
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO text_data VALUES (181,901,"別データ")')
        with self.assertRaisesRegex(ValueError,"duplicate category-181"):
            read_historical_titles(self.path)
        invalid=json.loads(candidate_json(["A タイトル"]))
        invalid["cards"][0]["events"][0]["titleFingerprint"]="sha256:bad"
        with self.assertRaisesRegex(ValueError,"fingerprint"):
            read_candidate_titles(json.dumps(invalid),self.cards)
        with self.assertRaisesRegex(ValueError,"not.*candidate|Duplicate|invalid"):
            read_candidate_titles(candidate_json(["A タイトル"]),{"10001":"R"})

    def test_schema_guard_and_no_implicit_character_events(self):
        with self.assertRaisesRegex(ValueError,"title index"):
            read_historical_titles(self.path,title_index="title")
        with sqlite3.connect(self.path) as db:
            db.execute("ALTER TABLE text_data RENAME TO missing_text_data")
        with self.assertRaisesRegex(ValueError,"required table"):
            read_historical_titles(self.path)

if __name__=="__main__":
    unittest.main()
