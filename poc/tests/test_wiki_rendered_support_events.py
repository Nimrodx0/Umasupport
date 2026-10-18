import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

TARGET = Path(__file__).resolve().parents[1] / "tools" / "audit_wiki_rendered_support_events.py"
spec = importlib.util.spec_from_file_location("wiki_rendered_support_events", TARGET)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def page(chain=("830241004", "830241001"), other=("809046001",)):
    links = lambda ids: "".join(f'<p><a href="/Game:Training_Event_{v}?redlink=1">edit</a></p>'
                               for v in ids)
    return {
        "parse": {
            "title": audit.PAGE_TITLE,
            "revid": 36004,
            "text": ('<h2 id="Training_Events">Events</h2>'
                     '<h3 id="Event_Chain">Chain</h3>' + links(chain) +
                     '<h3 id="Other_Events">Other</h3>' + links(other) +
                     '<h2 id="Episode">Episode</h2>'
                     '<a href="/Game:Training_Event_830241099">Outside scope</a>'),
        }
    }


class WikiRenderedEventAuditTest(unittest.TestCase):
    def test_section_counts_and_focus_id(self):
        p = audit.parse_wiki_page(page())
        self.assertEqual(p["chain"], {"830241004", "830241001"})
        self.assertEqual(p["other"], {"809046001"})
        self.assertNotIn("830241099", p["chain"] | p["other"])
        r = audit.compare({"830241004", "830241001", "809046001"}, p)
        self.assertEqual(r["overlappingStoryIds"], 3)
        self.assertEqual(r["onlyInOldMasterCount"], 0)
        self.assertEqual(r["onlyInWikiRenderedPageCount"], 0)
        self.assertTrue(r["wikiPageLinksFocusStoryId"])
        self.assertEqual(r["pageRevision"], 36004)

    def test_diff_does_not_claim_game_deletion(self):
        p = audit.parse_wiki_page(page(chain=("830241001",), other=("809046001",)))
        r = audit.compare({"830241004", "830241001"}, p)
        self.assertEqual(r["onlyInOldMasterIds"], ["830241004"])
        self.assertEqual(r["onlyInWikiRenderedPageIds"], ["809046001"])
        self.assertFalse(r["wikiPageLinksFocusStoryId"])
        self.assertIn("NOT a current SQLite snapshot", r["scope"])

    def test_duplicate_links_to_same_id_do_not_inflate_event_count(self):
        p = audit.parse_wiki_page(page(chain=("830241004", "830241004")))
        self.assertEqual(p["chain"], {"830241004"})
        self.assertEqual(p["linkOccurrences"]["chain"], 2)

    def test_reject_same_id_in_two_sections(self):
        with self.assertRaisesRegex(ValueError, "multiple groups"):
            audit.parse_wiki_page(page(chain=("830241004",), other=("830241004",)))

    def test_reject_unbounded_or_wrong_sections(self):
        for payload in [
            {"parse": {"title": "Other Page", "revid": 36004, "text": page()["parse"]["text"]}},
            {"error": {"code": "permissiondenied"}},
            {"parse": {"title": audit.PAGE_TITLE, "revid": 36004, "text": '<p>no events</p>'}},
            {"parse": {"title": audit.PAGE_TITLE, "revid": 36004, "text": '<h2 id="Training_Events">Events</h2><h3 id="Other_Events">Other</h3>'}},
        ]:
            with self.assertRaises(ValueError):
                audit.parse_wiki_page(payload)

    def test_reject_ambiguous_and_non_numeric_links(self):
        html = page()["parse"]["text"].replace("830241004?redlink", "830241004_830241005?redlink", 1)
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            audit.parse_wiki_page({"parse": {"title": audit.PAGE_TITLE, "revid": 36004, "text": html}})
        html = page()["parse"]["text"].replace("830241004", "notanid", 1)
        p = audit.parse_wiki_page({"parse": {"title": audit.PAGE_TITLE, "revid": 36004, "text": html}})
        self.assertNotIn("830241004", p["chain"])

    def test_sqlite_story_id_not_internal_row_id(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "fake.db"
            with sqlite3.connect(path) as db:
                db.execute("CREATE TABLE single_mode_story_data (id INT, story_id INT, support_card_id INT, gallery_flag INT)")
                db.executemany("INSERT INTO single_mode_story_data VALUES (?,?,?,?)", [
                    (111, 830241004, 30241, 2),
                    (222, 830241001, 30241, 2),
                    (333, 830241099, 30241, 1),
                    (444, 830021001, 30021, 2),
                ])
            self.assertEqual(audit.old_direct_ids(path), {"830241004", "830241001"})
            with sqlite3.connect(path) as db:
                db.execute("INSERT INTO single_mode_story_data VALUES (555,830241004,30241,2)")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                audit.old_direct_ids(path)


if __name__ == "__main__":
    unittest.main()
