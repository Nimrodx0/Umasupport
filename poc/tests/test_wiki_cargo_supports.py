import importlib.util
from pathlib import Path
import unittest

module_path = Path(__file__).resolve().parents[1] / "tools" / "audit_wiki_cargo_supports.py"
spec = importlib.util.spec_from_file_location("wiki_audit", module_path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def uma_rows(ids):
    lines = []
    for cid in ids:
        for stage in range(5):
            fields = ["0"] * 60
            fields[0], fields[1], fields[3], fields[4] = cid, "[Test]Horse" + cid, cid[0], str(stage)
            lines.append("\t".join(fields))
    return "\n".join(lines)


def wiki_page(ids):
    return {"cargoquery": [{"title": {"support id": cid}} for cid in ids]}


class WikiAuditTests(unittest.TestCase):
    def test_valid_numeric_overlaps_and_by_rarity(self):
        source = audit.read_umasim(uma_rows(["10001", "20002", "30003", "30004"]))
        ids, meta = audit.read_wiki_pages([wiki_page(["10001", "20002"]), wiki_page(["30003", "30005"]), wiki_page([])], 2)
        result = audit.compare(source, ids, meta)
        self.assertEqual(result["sourceCards"], 4)
        self.assertEqual(result["overlap"], 3)
        self.assertEqual(result["sourceOnlyIds"], ["30004"])
        self.assertEqual(result["wikiOnlyIds"], ["30005"])
        self.assertEqual(result["byRarity"]["SSR"]["sourceOnly"], 1)

    def test_full_page_at_end_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "truncated"):
            audit.read_wiki_pages([wiki_page(["10001", "10002"])], 2)

    def test_duplicate_id_across_pages_rejected(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            audit.read_wiki_pages([wiki_page(["10001", "10002"]), wiki_page(["10002"])], 2)

    def test_invalid_sql_key_and_bad_api_error_rejected(self):
        with self.assertRaisesRegex(ValueError, "field"):
            audit.read_wiki_pages([{"cargoquery": [{"title": {"support_id": "10001"}}]}])
        with self.assertRaisesRegex(ValueError, "Unexpected Cargo"):
            audit.read_wiki_pages([{"error": {"info": "denied"}}])

    def test_pagination_gaps_and_missing_pages_rejected(self):
        with self.assertRaisesRegex(ValueError, "pagination"):
            audit.read_wiki_pages([wiki_page(["10001"]), wiki_page(["10002"])], 2)
        with self.assertRaisesRegex(ValueError, "required"):
            audit.read_wiki_pages([])

    def test_schema_rejects_missing_stages_duplicate_stage_or_bad_rarity(self):
        text = uma_rows(["10001"])
        self.assertEqual(len(audit.read_umasim(text)), 1)
        with self.assertRaisesRegex(ValueError, "all five"):
            audit.read_umasim("\n".join(text.splitlines()[:-1]))
        with self.assertRaisesRegex(ValueError, "repeated"):
            audit.read_umasim(text + "\n" + text.splitlines()[0])
        bad = text.replace("\t1\t0\t", "\t3\t0\t", 1)
        with self.assertRaisesRegex(ValueError, "rarity"):
            audit.read_umasim(bad)

    def test_numeric_but_outside_expected_card_id_space_is_reported_separately(self):
        source = audit.read_umasim(uma_rows(["10001"]))
        ids, meta = audit.read_wiki_pages([wiki_page(["10001", "9999999"])])
        result = audit.compare(source, ids, meta)
        self.assertEqual(result["overlap"], 1)
        self.assertEqual(result["wikiOnlyCount"], 0)
        self.assertEqual(result["wikiCargo"]["nonStandardIdCount"], 1)


if __name__ == "__main__":
    unittest.main()
