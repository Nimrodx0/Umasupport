"""Synthetic HTML and title-multiset regression, no external network."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from audit_three_source_event_headings import parse_page_headings, classify_three_sources
from audit_story_title_links import title_digest


def mock_html():
    return """<!doctype html><html><head><title>test</title></head><body>
      <h1><span>［導きの光］</span>伝説の体現者</h1>
      <h1>連続イベント</h1>
      <h2>AAA！</h2>
      <h2><span>BBB</span>？</h2>
      <h1>ランダムイベント</h1>
      <h2><strong>CCC</strong></h2><h2>DDD</h2>
      <h2>エピソード</h2><h2>NOT EVENT</h2>
    </body></html>"""


class ExternalTitleTests(unittest.TestCase):
    def setUp(self):
        self.names=parse_page_headings(mock_html())
        self.master={"30241":[
            {"storyId":"830241001","fingerprint":title_digest("AAA!", "typography"),"meta":{}},
            {"storyId":"830241002","fingerprint":title_digest("BBB?","typography"),"meta":{}},
            {"storyId":"830241003","fingerprint":title_digest("CCC","typography"),"meta":{}},
            {"storyId":"830241004","fingerprint":title_digest("DDD","typography"),"meta":{}},
        ]}
        self.checker={"30241":[title_digest(x,"typography") for x in ("AAA!","BBB?","CCC")]}

    def test_extract_section_headings_only(self):
        self.assertEqual(self.names,{"連続イベント":["AAA！","BBB？"],
                                      "ランダムイベント":["CCC","DDD"]})

    def test_focus_residual_found_in_external_source(self):
        r=classify_three_sources(self.master,self.checker,self.names)
        self.assertEqual(r["externalHeadingCount"],4)
        self.assertEqual(r["oldVsCheckerTypographicOverlap"],3)
        self.assertEqual(r["oldVsExternalTypographicOverlap"],4)
        self.assertEqual(r["checkerVsExternalTypographicOverlap"],3)
        self.assertEqual(r["externalTitlesAbsentFromChecker"],1)
        self.assertEqual(r["historicalResidualInChecker"][0]["possibleHistoricalStoryIds"],["830241004"])
        self.assertTrue(r["historicalResidualInChecker"][0]["presentOnExternalPage"])
        self.assertNotIn("DDD",str(r))
        self.assertNotIn("sha256:",str(r))

    def test_existing_external_missing_old_residual_is_not_falsely_correlated(self):
        altered={"連続イベント":["AAA!","BBB?"],"ランダムイベント":["CCC","New Name"]}
        r=classify_three_sources(self.master,self.checker,altered)
        self.assertFalse(r["historicalResidualInChecker"][0]["presentOnExternalPage"])
        self.assertEqual(r["externalTitlesAbsentFromHistorical"],1)

    def test_duplicate_old_stories_do_not_yield_fake_unique_id(self):
        dup={"30241":self.master["30241"]+[
            {"storyId":"830241005","fingerprint":title_digest("DDD","typography"),"meta":{}}
        ]}
        r=classify_three_sources(dup,self.checker,self.names)
        residual=r["historicalResidualInChecker"][0]
        self.assertEqual(residual["remainingHistoricalCount"],2)
        self.assertFalse(residual["unambiguousHistoricalId"])
        self.assertEqual(residual["possibleHistoricalStoryIds"],["830241004","830241005"])

    def test_changed_html_sections_fail_closed(self):
        for html in ("", "<h2>AAA！</h2>", mock_html().replace("エピソード","<span>other</span>"),
                     mock_html().replace("ランダムイベント","その他")):
            with self.assertRaises(ValueError):
                parse_page_headings(html)
        with self.assertRaises(ValueError):
            classify_three_sources(self.master,self.checker,{"連続イベント":[],"ランダムイベント":["x"]})


if __name__=="__main__":
    unittest.main()
