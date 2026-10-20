import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from inspect_direct_historical_gaps import inspect, TARGETS
from audit_direct_historical_chain import fingerprint, OLD_SHA, GT_REV


class GapDiagnosisTests(unittest.TestCase):
    def doc(self, names):
        return {"events_ja": {str(i): dict(name=name, section="arrows", choices=[{}])
                              for i, name in enumerate(names, 1)}}

    def master(self, cid, names, stages):
        rows, originals = [], {}
        for i, (name, stage) in enumerate(zip(names, stages), 1):
            sid = cid * 1000 + i
            row = {"storyId": str(sid), "stage": stage, "maximum": 3,
                   "flag": 0, "exact": fingerprint(name),
                   "loose": fingerprint(name, True)}
            rows.append(row)
            originals[str(sid)] = dict(stage=stage, maximum=3, flag=0, title=name)
        return rows, originals

    def inputs(self):
        source = {
            "30043": self.doc(["A1","A2","A3"]),
            "30096": self.doc(["B1","B2","B3"]),
            "30108": self.doc(["C1","C2","C3"]),
        }
        masters = {}
        originals = {}
        for cid, titles, stages in [
            ("30043", ["A1","A2","renamed A3"],[1,2,3]),
            ("30096", ["B1","old B2","B3"],[1,2,3]),
            ("30108", ["C1","C2"],[1,2]),
        ]:
            rows, raw = self.master(int(cid), titles, stages)
            masters[cid] = rows
            originals[cid] = raw
        direct = {"dataKind":"umasupport-direct-2025-master-chain-audit",
                  "routeVerifiedIn2026":False,"releaseApproved":False,
                  "sourcePins":{"historicalMasterSha256": OLD_SHA,
                                "gameToraDerived": GT_REV},
                  "stillUnlinkedHistoricalOrders":[
                      {"cardId":"30043","firstOrdinal":2,"nextOrdinal":3,
                       "oldCardHasDirectStories":True},
                      {"cardId":"30096","firstOrdinal":1,"nextOrdinal":2,
                       "oldCardHasDirectStories":True},
                      {"cardId":"30096","firstOrdinal":2,"nextOrdinal":3,
                       "oldCardHasDirectStories":True},
                      {"cardId":"30108","firstOrdinal":2,"nextOrdinal":3,
                       "oldCardHasDirectStories":True}
                  ]}
        return direct, masters, originals, source

    def test_four_edges_reduce_to_three_distinct_unpaired_stages(self):
        doc, old, raw, sources = self.inputs()
        result = inspect(doc, old, raw, sources)
        self.assertEqual(result["stats"]["distinctUnpairedChainStages"], 3)
        self.assertEqual(result["stats"]["failedAdjacentPairs"], 4)
        self.assertEqual(result["stats"]["byDiagnosis"],
                         {"no-corresponding-2025-stage-number":1,
                          "old-stage-exists-title-identity-not-established":2})
        self.assertEqual(result["candidateLinksAccepted"], 0)
        self.assertFalse(result["gameVerified"])
        self.assertEqual({x["cardId"] for x in result["cases"]}, TARGETS)

    def test_raw_source_titles_never_leave_diagnostic(self):
        doc, old, raw, sources = self.inputs()
        rendered = json.dumps(inspect(doc, old, raw, sources), ensure_ascii=False)
        self.assertNotIn("renamed A3",rendered)
        self.assertNotIn("old B2",rendered)
        self.assertNotIn('"name"',rendered)
        self.assertNotIn('"title"',rendered)

    def test_stale_status_must_fail_closed(self):
        doc, old, raw, sources = self.inputs()
        doc["releaseApproved"] = True
        with self.assertRaisesRegex(ValueError,"provenance"):
            inspect(doc, old, raw, sources)
        doc["releaseApproved"] = False
        doc["stillUnlinkedHistoricalOrders"] = doc["stillUnlinkedHistoricalOrders"][:-1]
        with self.assertRaisesRegex(ValueError,"drifted"):
            inspect(doc, old, raw, sources)

    def test_duplicate_old_titles_are_identified_without_accepting_story_id(self):
        direct, old, original, source = self.inputs()
        card = "30043"
        # Two 2025 story IDs have exactly the same Japanese event title and stage.
        # Neither is a defensible unique mapping to the current source.
        old[card] = old[card][:2]
        original[card] = {k:v for k,v in original[card].items()
                          if v["stage"] != 3}
        for i in (1,2):
            sid = "8300430"+str(10+i)
            original[card][sid] = dict(stage=3, maximum=3, flag=0, title="A3")
            old[card].append(dict(storyId=sid, stage=3, maximum=3, flag=0,
                                  exact=fingerprint("A3"),
                                  loose=fingerprint("A3", True)))
        result = inspect(direct, old, original, source)
        match = next(x for x in result["cases"] if x["cardId"] == card)
        self.assertEqual(match["diagnosis"],"historical-title-collision")
        self.assertEqual(match["historicalExactSameTitleAndStageRows"],2)
        self.assertEqual(match["historicalExactTitleStageRowsCompatibleWithNeighbor"],2)
        self.assertFalse(match["candidateAccepted"])


if __name__ == "__main__":
    unittest.main()
