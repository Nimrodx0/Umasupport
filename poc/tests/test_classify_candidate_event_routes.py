"""Synthetic full-classification regressions: no title matches grant event routes."""
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from audit_story_title_links import title_digest
from classify_candidate_event_routes import classify, parse_unique_master


def ev(cid, n, title, opts=2):
    key = "checker:" + cid + ":" + ("%020x" % n)
    return {
        "db": {"sourceKey": key, "sourceDigest": "sha256:" + "a"*64, "ordinal": n,
               "choices": [{"ordinal":i+1,"observedHints":[],"needsManualResultReview":False}
                           for i in range(opts)]},
        "source": {"sourceKey": key,"sourceDigest":"sha256:"+"a"*64,
                   "sourceIndex":n-1,"optionCount":opts,
                   "titleFingerprint":title_digest(title),
                   "typographicFingerprint":title_digest(title, "typography")}
    }


def fixture():
    one=ev("30001",1,"Ａ  タイトル")
    two=ev("30001",2,"Ｂ・イベント")
    third=ev("30002",1,"後日追加")
    cards=[
        {"cardId":"30001","rarity":"SSR","events":[one["db"],two["db"]]},
        {"cardId":"20001","rarity":"SR","events":[]},
        {"cardId":"30002","rarity":"SSR","events":[third["db"]]}
    ]
    inv=[{"cardId":cid,"events":src} for cid,src in (
       ("30001",[one["source"],two["source"]]),("20001",[]),
       ("30002",[third["source"]]))]
    db={"dataKind":"support-event-hint-candidates",
        "approvalState":"UNREVIEWED_NOT_FOR_PUBLICATION","forSkillGrant":False,
        "sourcePins":{"checker":{"revision":"a"*40}},
        "stats":{"eventsObserved":3,"cardsWithCandidates":3},"cards":cards}
    checker={"source":"UmaUmaChecker","format":1,"stats":{"eventCount":3},
             "cards":inv}
    meta={k:None for k in ("show_progress_1","show_progress_2","show_progress_3",
                           "event_category","ending_type")}
    hist={"30001":[
        {"storyId":"830001001","strict":title_digest("A タイトル"),
         "loose":title_digest("A タイトル","typography"),"numericMeta":meta},
        {"storyId":"830001002","strict":title_digest("Bイベント"),
         "loose":title_digest("Bイベント","typography"),"numericMeta":meta}],
        "20001":[{"storyId":"820001001","strict":title_digest("旧ストーリー"),
        "loose":title_digest("旧ストーリー","typography"),"numericMeta":meta}]}
    return db,checker,hist


class ClassifierTests(unittest.TestCase):
    def test_all_candidates_classified_with_strict_and_provisional_identity_separate(self):
        db,source,hist=fixture()
        r=classify(db,source,hist,"b"*64)
        self.assertEqual(r["totals"]["candidateCards"],3)
        self.assertEqual(r["totals"]["candidateEvents"],3)
        self.assertEqual(r["totals"]["verifiedRoutes"],0)
        self.assertEqual(r["totals"]["needsReview"],3)
        self.assertEqual(r["totals"]["cardsWithEmptyCandidateSource"],1)
        self.assertEqual(r["cards"][0]["events"][0]["historicalLink"]["status"],"strict-unique")
        self.assertEqual(r["cards"][0]["events"][0]["historicalLink"]["provisionalStoryId"],"830001001")
        self.assertEqual(r["cards"][0]["events"][1]["historicalLink"]["status"],"typography-suggestion")
        self.assertEqual(r["cards"][0]["events"][1]["historicalLink"]["possibleStoryId"],"830001002")
        self.assertEqual(r["cards"][2]["events"][0]["historicalLink"]["status"],"no-2025-direct-story-rows")
        self.assertEqual(r["cards"][1]["sourceRecordStatus"],"source-gap")
        self.assertEqual(r["historicalPossibleGaps"][0]["cardId"],"30001")
        self.assertEqual(r["historicalPossibleGaps"][0]["diagnostic"],"typography-only-title-suggestion")
        self.assertEqual(r["totals"]["historicalDirectRowsWithTypographySuggestion"],1)
        self.assertEqual(r["totals"]["historicalDirectRowsWithNoTitleLink"],1)
        self.assertEqual(r["historicalPossibleGaps"][0]["confirmedMissingIn2026"],False)
        self.assertNotIn("タイトル",json.dumps(r,ensure_ascii=False))
        for card in r["cards"]:
            for event in card["events"]:
                self.assertEqual(event["status"],"needs-review")
                self.assertIn("outcome-branch-not-reviewed",event["reasons"])

    def test_duplicate_title_prevents_story_id_assignment(self):
        db,source,hist=fixture()
        db["cards"][0]["events"].append({
          **db["cards"][0]["events"][0],"sourceKey":"checker:30001:"+"c"*20,"ordinal":3})
        source["cards"][0]["events"].append({
          **source["cards"][0]["events"][0],"sourceKey":"checker:30001:"+"c"*20,"sourceIndex":2})
        db["stats"]["eventsObserved"]=4
        source["stats"]["eventCount"]=4
        r=classify(db,source,hist,"b"*64)
        self.assertEqual(r["cards"][0]["events"][0]["historicalLink"]["status"],"ambiguous")
        self.assertNotIn("provisionalStoryId",r["cards"][0]["events"][0]["historicalLink"])

    def test_event_source_key_and_digest_drift_fail_closed(self):
        db,source,hist=fixture()
        db["cards"][0]["events"][0]["sourceDigest"]="sha256:"+"0"*64
        with self.assertRaisesRegex(ValueError,"drift"):
            classify(db,source,hist,"b"*64)

    def test_unapproved_gate_and_event_count_enforced(self):
        db,source,hist=fixture()
        db["forSkillGrant"]=True
        with self.assertRaisesRegex(ValueError,"quarantined"):
            classify(db,source,hist,"b"*64)
        db,source,hist=fixture()
        db["stats"]["eventsObserved"]=1000
        with self.assertRaisesRegex(ValueError,"candidate total"):
            classify(db,source,hist,"b"*64)

    def test_exact_category_181_story_titles_loaded_read_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"master.db"
            with sqlite3.connect(path) as con:
                con.execute('CREATE TABLE single_mode_story_data (id INTEGER PRIMARY KEY, story_id INTEGER, support_card_id INTEGER, gallery_flag INTEGER, show_progress_1 INTEGER, show_progress_2 INTEGER, show_progress_3 INTEGER, event_category INTEGER, ending_type INTEGER, gallery_main_scenario INTEGER, gallery_condition INTEGER)')
                con.execute('CREATE TABLE text_data(category INTEGER,"index" INTEGER,text TEXT)')
                con.execute('INSERT INTO single_mode_story_data VALUES (1,830001001,30001,2,1,0,0,3,0,0,0)')
                con.execute('INSERT INTO text_data VALUES (181,830001001,"実イベント名")')
            r=parse_unique_master(path)
            self.assertEqual(r["30001"][0]["storyId"],"830001001")
            self.assertEqual(r["30001"][0]["numericMeta"]["show_progress_1"],1)
            self.assertEqual(r["30001"][0]["strict"],title_digest("実イベント名"))


if __name__=="__main__":
    unittest.main()
