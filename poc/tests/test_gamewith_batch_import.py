"""Batch planning regression: no site access, never rewrite curated data."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from batch_gamewith_import import plan_and_import
from import_gamewith_article import registry

TEXT = """# 〖ウマ娘〗架空R(Rサポート)の評価とイベント
レア | R
## 発生イベントと選択肢一覧
### 通常イベント
#### 第一話
一番 | スピード+1
二番 | 『架空スキル○』のヒントLv+1
"""
REC = [{"id": str(51000+i), "name": "無関係" + str(i),
        "rarity": "normal", "group": 70000+i} for i in range(111)]
REC += [{"id": "202992", "name": "架空スキル○", "rarity": "normal", "group": 99}]


class BatchTests(unittest.TestCase):
    def test_one_verified_article_and_unmapped_roster_are_separate(self):
        with tempfile.TemporaryDirectory() as dirname:
            root = Path(dirname)
            input_dir = root / "input"
            output_dir = root / "out"
            input_dir.mkdir()
            (input_dir / "10001.md").write_text(TEXT, "utf-8")
            cards = {
                "10001": {"name": "架空R", "rarity": "R", "title": "[トレセン学園]架空R"},
                "10002": {"name": "別ウマ", "rarity": "R", "title": "[トレセン学園]別ウマ"},
                "30001": {"name": "SSRウマ", "rarity": "SSR", "title": "[お祝い]SSRウマ"}
            }
            index = {"cards": [
                {"cardId": "10001", "primaryArticle": "https://gamewith.jp/uma-musume/article/show/257602",
                 "draftFile": "poc/data/curation/drafts/10001.v1.json"},
                {"cardId": "10002", "primaryArticle": "https://gamewith.jp/uma-musume/article/show/257601",
                 "draftFile": "poc/data/curation/drafts/10002.v1.json"}
            ]}
            numeric = registry(json.dumps(REC), {"schemaVersion": 1, "skills": []})
            report = plan_and_import(cards, index, numeric, input_dir, output_dir, root)
            self.assertEqual(report["summary"]["rosterCards"], 3)
            self.assertEqual(report["summary"]["indexedCards"], 2)
            self.assertEqual(report["summary"]["withoutIndexedSource"], 1)
            self.assertEqual(report["summary"]["proposal-needs-review"], 1)
            self.assertEqual(report["summary"]["no-local-article"], 1)
            self.assertEqual(report["summary"]["no-source-link"], 1)
            self.assertEqual(report["releaseStatus"], "all proposals, no automatic promotion")
            proposal = json.loads((output_dir / "10001.proposal.json").read_text("utf-8"))
            self.assertEqual(proposal["proposedEvents"], 1)
            self.assertEqual(proposal["proposal"]["cards"][0]["events"][0]["choices"][1]["rewards"],
                             [{"skillId": "skill:202992", "verifiedSkillName": "架空スキル○", "level": 1}])
            self.assertFalse((root / "poc/data/reviewed_events.v1.json").exists())
            self.assertNotIn("第一話", json.dumps(report, ensure_ascii=False))

    def test_reject_wrong_article_and_duplicate_source_links(self):
        with tempfile.TemporaryDirectory() as dirname:
            root = Path(dirname)
            input_dir = root / "inputs"
            input_dir.mkdir()
            (input_dir / "10001.md").write_text(TEXT.replace("架空R", "別ウマ"), "utf-8")
            cards = {"10001": {"name": "架空R", "rarity": "R",
                               "title": "[トレセン学園]架空R"}}
            row = {"cardId": "10001",
                   "primaryArticle": "https://gamewith.jp/uma-musume/article/show/257602",
                   "draftFile": "poc/data/curation/drafts/10001.v1.json"}
            numeric = registry(json.dumps(REC), {"schemaVersion": 1, "skills": []})
            report = plan_and_import(cards, {"cards": [row]}, numeric, input_dir, root / "out", root)
            self.assertEqual(report["cards"][0]["status"], "rejected-input")
            self.assertFalse((root / "out/10001.proposal.json").exists())
            with self.assertRaises(ValueError):
                plan_and_import(cards, {"cards": [row, row]}, numeric, input_dir, root / "out", root)


if __name__ == "__main__":
    unittest.main()
