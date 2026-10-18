import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1] / "tools"
if str(ROOT) not in sys.path:
    sys.path.insert(0,str(ROOT))
import audit_efforia30311_wiki_title_links as audit

def fixture(modify=None):
    elements=[]
    for section, heading in [("chain","Event_Chain"),("other","Other_Events")]:
        elements.append(f'<h3 id="{heading}">events</h3>')
        for title, story in audit.EXPECTED_GROUPS[section]:
            elements.append(f'<section><div><span>{title}</span></div>'
              f'<a href="/Game:Training_Events/{story}?redlink=1">edit</a></section>')
    markup='<h2 id="Training_Events">Training Events</h2>'+''.join(elements)+'<h2 id="Episode">Episode</h2>'
    if modify:
        markup=modify(markup)
    return {"parse":{"title":audit.wiki.RECENT_PAGE_TITLE,"revid":74431,"text":markup}}

class BoundedTitleStoryBinding(unittest.TestCase):
    def test_all_five_title_to_id_pairs_are_checked(self):
        result=audit.audit_title_links(fixture())
        self.assertEqual(result["namedEventStoryIdPairs"],5)
        self.assertEqual(result["chain"],3)
        self.assertEqual(result["other"],2)
        self.assertEqual(result["orderedStoryIds"],[
            "830311001","830311002","830311003","801146001","801146002"])
        self.assertIn("official 2026 master revision",result["doesNotProve"])
    def test_wrong_id_swapped_between_neighbouring_title_fails(self):
        def switch(html):
            return html.replace("830311001","TEMP").replace("830311002","830311001").replace("TEMP","830311002")
        with self.assertRaisesRegex(ValueError,"does not belong"):
            audit.audit_title_links(fixture(switch))
    def test_wrong_title_order_fails(self):
        def switch(html):
            return html.replace("運命の暴走散歩道","TEMP").replace("淑女、粛々と読書中","運命の暴走散歩道").replace("TEMP","淑女、粛々と読書中")
        with self.assertRaisesRegex(ValueError,"does not belong|heading ordering"):
            audit.audit_title_links(fixture(switch))
    def test_missing_or_duplicate_title_fails(self):
        for corrupt in [
            lambda html:html.replace("運命共同体な僕ら","他の見出し"),
            lambda html:html.replace("運命共同体な僕ら","運命と共同体な淑女"),
        ]:
            with self.assertRaisesRegex(ValueError,"missing/duplicate"):
                audit.audit_title_links(fixture(corrupt))
    def test_extra_story_link_fails_closed(self):
        with self.assertRaises(ValueError):
            audit.audit_title_links(fixture(
              lambda html:html.replace('<h2 id="Episode">', '<a href="/Game:Training_Events/801146003">extra</a><h2 id="Episode">')))
    def test_title_must_precede_its_link(self):
        with self.assertRaisesRegex(ValueError,"does not belong"):
            audit.audit_title_links(fixture(
              lambda html:html.replace(
                '<div><span>運命共同体な僕ら</span></div><a href="/Game:Training_Events/801146002?redlink=1">edit</a>',
                '<a href="/Game:Training_Events/801146002?redlink=1">edit</a><div><span>運命共同体な僕ら</span></div>')))
    def test_wrong_wiki_page_and_missing_sections_fail(self):
        bad=fixture()
        bad["parse"]["title"]="another article"
        with self.assertRaisesRegex(ValueError,"Unexpected Wiki"):
            audit.audit_title_links(bad)
        with self.assertRaises(ValueError):
            audit.audit_title_links(fixture(lambda html:html.replace('id="Other_Events"','id="other"')))
if __name__=="__main__":
    unittest.main()
