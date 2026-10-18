import importlib.util
from pathlib import Path
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/"tools"/"audit_wiki_masterdata_cargo.py"
spec=importlib.util.spec_from_file_location("wiki_masterdata_cargo",SCRIPT)
audit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

def resp(a):
    return {"expandtemplates":{"wikitext":a}}

class WikiMasterdataCargoTests(unittest.TestCase):
    def test_successful_both_sections_up_to_date_is_one_way_only(self):
        x=audit.parse_missing_list(resp("=== Cards ===\nUp to date!\n\n=== Supports ===\nUp to date!\n"))
        self.assertEqual(x["supports"]["missingCount"],0)
        self.assertEqual(x["cards"]["missingCount"],0)
        self.assertIn("one-way check",x["scope"])
        self.assertIn("Not proof",x["interpretation"])
    def test_valid_numeric_support_missing_is_reported_without_names(self):
        x=audit.parse_missing_list(resp("=== Cards ===\nSome wiki character (101234)\n\n=== Supports ===\n[Card] Something (30312)\nA second (20048)\n"))
        self.assertEqual(x["supports"]["missingCount"],2)
        self.assertEqual(x["supports"]["numericMissingIds"],["20048","30312"])
        self.assertEqual(x["cards"]["missingCount"],1)
        self.assertNotIn("Something",str(x))
    def test_bad_or_incomplete_wiki_api_cannot_claim_zero(self):
        for x in [{}, {"expandtemplates":{}}, {"error":{"code":"bad"}}, resp(""),resp("Lua error: attempt to index nil"),resp("=== Supports ===\nUp to date!"),resp("=== Cards ===\n\n=== Supports ===\nUp to date!")]:
            with self.subTest(x=x),self.assertRaises(ValueError):
                audit.parse_missing_list(x)
    def test_duplicate_or_unexpected_ids_fail(self):
        for body in ["thing (30001)\nthing (30001)", "thing (90001)", "thing (309000)", "an unparseable name"]:
            with self.subTest(body=body),self.assertRaises(ValueError):
                audit.parse_missing_list(resp("=== Cards ===\nUp to date!\n=== Supports ===\n"+body))
    def test_no_reverse_comparison_in_result(self):
        x=audit.parse_missing_list(resp("=== Cards ===\nUp to date!\n=== Supports ===\nUp to date!"))
        self.assertNotIn("masterdataCardCount",x)
        self.assertNotIn("sourceVersion",x)
        self.assertNotIn("gameMasterFreshness",x)

if __name__=="__main__":
    unittest.main()
