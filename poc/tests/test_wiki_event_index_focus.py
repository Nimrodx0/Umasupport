import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

PATH = Path(__file__).resolve().parents[1] / "tools" / "audit_wiki_event_index_focus.py"
spec = importlib.util.spec_from_file_location("wiki_event_index_focus", PATH)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def doc(*values):
    return {"cargoquery": [{"title": {"story id": value}} for value in values]}


class WikiEventFocusTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp.name) / "historic.db"
        with sqlite3.connect(self.db_path) as db:
            db.execute("CREATE TABLE single_mode_story_data (story_id INT, support_card_id INT, gallery_flag INT)")
            db.executemany(
                "INSERT INTO single_mode_story_data VALUES (?,?,?)",
                [(830241001, 30241, 2), (830241004, 30241, 2),
                 (830241099, 30241, 1), (830021001, 30021, 2)]
            )

    def tearDown(self):
        self.temp.cleanup()

    def test_focus_old_ids_and_missing_wiki_page_are_different_from_game_absence(self):
        old = audit.read_old_direct_story_ids(self.db_path)
        self.assertEqual(old, {"830241001", "830241004"})
        focus = audit.read_index_ids(doc(), 100)
        control = audit.read_index_ids(doc("830021001"), 5)
        result = audit.compare(old, focus, control)
        self.assertEqual(result["oldDirectStoryCount"], 2)
        self.assertEqual(result["oldStoriesWithWikiEventPages"], 0)
        self.assertEqual(result["oldStoriesWithoutWikiEventPages"], 2)
        self.assertTrue(result["oldFocusStoryId830241004"])
        self.assertFalse(result["wikiDocumentsFocusStoryId830241004"])
        self.assertTrue(result["knownWikiPositiveControl830021001"])
        self.assertIn("NOT 2026 game event coverage", result["scope"])

    def test_partial_page_index_does_not_imply_current_game_completeness(self):
        old = audit.read_old_direct_story_ids(self.db_path)
        result = audit.compare(old, audit.read_index_ids(doc("830241001"), 100),
                               audit.read_index_ids(doc("830021001"), 5))
        self.assertEqual(result["oldStoriesWithWikiEventPages"], 1)
        self.assertEqual(result["oldStoriesWithoutWikiEventPages"], 1)

    def test_reject_wrong_30241_range_even_if_present_in_wiki(self):
        with self.assertRaisesRegex(ValueError, "outside"):
            audit.compare({"830241004"}, {"830021001"}, {"830021001"})

    def test_control_is_required_and_not_synthetic_game_evidence(self):
        with self.assertRaisesRegex(ValueError, "positive control"):
            audit.compare({"830241004"}, set(), set())
        with self.assertRaisesRegex(ValueError, "unexpected"):
            audit.compare({"830241004"}, set(), {"830241003"})

    def test_fail_closed_cargo_schema_truncation_and_duplicates(self):
        with self.assertRaisesRegex(ValueError, "truncated"):
            audit.read_index_ids(doc("830241001", "830241002"), 2)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            audit.read_index_ids(doc("830241004", "830241004"), 100)
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            audit.read_index_ids({"cargoquery":[{"title":{"story_id":"830241004"}}]}, 100)
        with self.assertRaisesRegex(ValueError, "Invalid"):
            audit.read_index_ids({"error":{"code":"badquery"}}, 100)
        with self.assertRaisesRegex(ValueError, "numeric"):
            audit.read_index_ids(doc("not-numeric"), 100)

    def test_old_snapshot_story_duplicates_and_shape_rejected(self):
        with sqlite3.connect(self.db_path) as db:
            db.execute("INSERT INTO single_mode_story_data VALUES (830241004,30241,2)")
        with self.assertRaisesRegex(ValueError, "duplicate"):
            audit.read_old_direct_story_ids(self.db_path)

    def test_focus_old_master_must_contain_the_known_story(self):
        with self.assertRaisesRegex(ValueError, "Focus story ID"):
            audit.compare({"830241001"}, set(), {"830021001"})


if __name__ == "__main__":
    unittest.main()
