"""Offline regression of importer. Synthetic examples, no GameWith article content."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from import_gamewith_article import article_to_facts, compare, normalize, registry, roster

CARD = {"name": "架空ウマ", "title": "[トレセン学園]架空ウマ", "rarity": "R"}
SR = {"name": "架空ウマ", "title": "[架空の思い出]架空ウマ", "rarity": "SR"}
SOURCE = """# 〖ウマ娘〗架空ウマ(Rサポート)の評価とイベント
サポカ架空ウマのR情報
レア | R
## 発生イベントと選択肢一覧
### 通常イベント
#### 架空の対話
詳細を見る
あちらを選ぶ | やる気アップ
絆+5
こちらを選ぶ | 『特別スキル◯』のヒントLv+2
絆+5
#### もう一つ
先へ進む | スピード+5
考え直す | 『別の技』のヒントLv+1
絆+5
## 育成方法のリンク
こちらもどうぞ
"""
REGISTRY = [{"id": str(700001 + i), "name": "無関係" + str(i),
             "rarity": "normal", "group": 800000 + i} for i in range(110)]
REGISTRY += [{"id": "202992", "name": "特別スキル○", "rarity": "normal", "group": 2}]
SUPP = {"schemaVersion": 1, "skills": [{
    "id": "201012", "name": "別の技", "rarity": "normal",
    "scope": "curation-only"
}]}


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.skills = registry(json.dumps(REGISTRY), SUPP)

    def test_normal_event_and_numeric_registry_with_circle_variants(self):
        result = article_to_facts(SOURCE, "10099", CARD, self.skills)
        self.assertEqual(result["observedEventHeadings"], 2)
        self.assertEqual(result["proposedEvents"], 2)
        self.assertEqual(result["reviewRequired"], [])
        events = result["proposal"]["cards"][0]["events"]
        self.assertEqual([e["id"] for e in events],
                         ["draft_10099_normal_01", "draft_10099_normal_02"])
        self.assertEqual(events[0]["choices"][1]["rewards"], [{
            "skillId": "skill:202992", "verifiedSkillName": "特別スキル○", "level": 2
        }])
        self.assertEqual(events[1]["choices"][1]["rewards"], [{
            "skillId": "skill:201012", "verifiedSkillName": "別の技", "level": 1
        }])
        self.assertNotIn("あちらを選ぶ", json.dumps(result, ensure_ascii=False))
        self.assertNotIn("架空の対話", json.dumps(result, ensure_ascii=False))

    def test_unknown_skill_is_kept_by_name_and_level_not_fake_id(self):
        src = SOURCE.replace("『別の技』", "『謎の技』")
        result = article_to_facts(src, "10099", CARD, self.skills)
        got = result["proposal"]["cards"][0]["events"][1]["choices"][1]
        self.assertEqual(got["unresolvedRewards"], [{"skillName": "謎の技", "level": 1}])

    def test_conditional_success_chain_and_unrecognized_hints_are_quarantined(self):
        src = SOURCE.replace("## 育成方法のリンク", """### 連続イベント
#### 第1話
進む | 『別の技』のヒントLv+1
戻る | スタミナ+5
### 通常イベント
#### 賭け
挑戦 | 成功時:『別の技』のヒントLv+2
諦める | やる気アップ
#### 判別不能
挑戦 | ヒントを得る
諦める | 根性+5
## 育成方法のリンク""")
        result = article_to_facts(src, "10099", CARD, self.skills)
        self.assertEqual(result["proposedEvents"], 2)
        self.assertEqual([r["reason"] for r in result["reviewRequired"]], [
            "chain-needs-manual-requires-and-termination",
            "conditional-outcomes-need-human-review", "unparsed-hint-reward"
        ])
        self.assertEqual(result["observedEventHeadings"], 5)

    def test_wrong_character_and_wrong_card_rarity_rejected(self):
        for src, card in [
            (SOURCE.replace("架空ウマ", "別のウマ"), CARD),
            (SOURCE.replace("Rサポート", "SSRサポート"), CARD),
            (SOURCE, SR)
        ]:
            with self.assertRaises(ValueError):
                article_to_facts(src, "10099", card, self.skills)
        # Same character and same rarity is still insufficient when title differs.
        sr_src = SOURCE.replace("Rサポート", "SRサポート")
        with self.assertRaises(ValueError):
            article_to_facts(sr_src, "20099", SR, self.skills)
        good_sr = sr_src.replace("レア | R", "レア | SR\n二つ名 | 架空の思い出")
        self.assertEqual(article_to_facts(good_sr, "20099", SR, self.skills)["proposedEvents"], 2)

    def test_missing_event_section_and_no_choices_not_silent_completed(self):
        with self.assertRaises(ValueError):
            article_to_facts(SOURCE.replace("発生イベントと選択肢一覧", "サポート効果"), "10099",
                             CARD, self.skills)
        src = SOURCE.replace("あちらを選ぶ | やる気アップ", "あちらを選ぶ")
        result = article_to_facts(src, "10099", CARD, self.skills)
        self.assertGreater(len(result["reviewRequired"]), 0)

    def test_html_table_mode_offline(self):
        html = """<html><h2>架空ウマ(Rサポート)の評価</h2>
<h2>発生イベントと選択肢一覧</h2>
<h3>通常イベント</h3><h4>架空のイベント</h4>
<table><tr><td>選択肢甲</td><td>『特別スキル◯』のヒントLv+3</td></tr>
<tr><td>選択肢乙</td><td>根性+5</td></tr></table>
<h2>まとめ</h2></html>"""
        result = article_to_facts(html, "10099", CARD, self.skills)
        self.assertEqual(result["proposedEvents"], 1)
        self.assertEqual(result["proposal"]["cards"][0]["events"][0]["choices"][0]["rewards"][0]["level"], 3)

    def test_compare_detects_wrong_option_or_reward_change(self):
        r = article_to_facts(SOURCE, "10099", CARD, self.skills)["proposal"]
        self.assertEqual(compare(r, r)["status"], "identical")
        other = json.loads(json.dumps(r))
        other["cards"][0]["events"][0]["choices"][0]["rewards"] = [
            {"skillId": "skill:202992", "level": 4}]
        self.assertEqual(compare(r, other)["changedEventOrdinals"], [1])
        other["cards"][0]["events"].pop()
        self.assertEqual(compare(r, other)["changedEventOrdinals"], [2])

    def test_duplicates_and_collisions_not_silently_accepted(self):
        bad = json.loads(json.dumps(REGISTRY))
        bad.append({"id": "202992", "name": "別名", "rarity": "normal", "group": 1})
        with self.assertRaises(ValueError):
            registry(json.dumps(bad), SUPP)
        bad_supp = {"schemaVersion": 1, "skills": [{"id": "800001",
                    "name": "特別スキル○", "rarity": "normal",
                    "scope": "curation-only"}]}
        with self.assertRaises(ValueError):
            registry(json.dumps(REGISTRY), bad_supp)

    def test_full_roster_columns_and_card_id_integrity(self):
        def line(cid, flag):
            fields = [cid, "[トレセン学園]架空ウマ", "架空ウマ", "1", flag] + [""] * 55
            return "\t".join(fields)
        cards = roster(line("10099", "0") + "\n" + line("10100", "1"))
        self.assertEqual(list(cards), ["10099"])
        with self.assertRaises(ValueError):
            roster(line("10099", "0") + "\n" + line("10099", "0"))


if __name__ == "__main__":
    unittest.main()
