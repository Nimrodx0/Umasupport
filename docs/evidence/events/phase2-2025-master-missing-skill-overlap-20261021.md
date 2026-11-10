# Phase 2：UmaSim辞書にない全79スキルヒントを2025年マスターで独立照合（2026-10-21）

## 結果

[固定GameTora全件と2025年ゲームマスターのCI](https://github.com/Nimrodx0/Umasupport/actions/runs/39565716336)において、GameTora固定版のヒント数字が2026-10-13のUmaSim固定スキル辞書で見つからないケースを、**別系統・2025-10-10のゲームマスターSQLite**とIDで全件突合した。

| 検査対象 | 実測 |
| --- | ---: |
| UmaSim固定辞書に未収録のGameTora数値ヒント記載 | **79件** |
| 異なる数値ID | **28種類** |
| 2025年マスターに同じIDが存在し、通常/レア区分・一意な日本語名まで存在 | **79件（28種類）** |
| 2025年マスターに不在 | 0 |
| 2025年のIDは存在するがレアリティが違う／名前が複数 | 0 |

前回のPR #127で試験変換へ追加した2種類11件は、こちらとは**別の、独立根拠付き補完辞書にのみ存在する項目**であり、79には含めない。

**解釈：** 固定UmaSim辞書にないことは、そのGameTora数値IDが間違いだという意味ではない。79件は古い独立ゲームマスターでも存在が裏付けられた。ただし、旧2025年マスターは2026年ゲームの現在名・現在効果を完全保証しないので、**79件を本番のスキル報酬として自動公開しない**。

## 出典

- GameTora派生基準：`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`
- UmaSim辞書：`mee1080/umasim@cf9366f6a487bd8f197b53d8a11981207beb9f6c`
- 歴史的独立マスター：`SimpleSandman/UmaMusumeMetaMasterMDB@5a8ec1356859a35e245edef0d40da740e652df68`（`master.mdb` SHA-256 `46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb`）
- `skill_data` のID・group_id・rarityと`text_data.category=47`の日本語名を突合。Wikiの[スキルマスターデータ実装](https://umamusu.wiki/Module:Game/Skills/Data)と同じ原理。記事のテキストはデータに保存しない。

## 実装

- `poc/tools/crosscheck_missing_event_skills_2025.py`：元ヒント位置を固定して照合、同じIDの重複計測防止、旧マスターとクロスウォークの出典検証。名前はHashのみ記録。
- `poc/tests/test_historical_missing_event_skills.py`：合成SQLiteでの一致・2025未収録・一意でない名前・非通常/レア・出典不正・重複をテスト。
- `.github/workflows/whole-event-inventory.yml`：すでに取得していた2025マスターを再利用し、79件/28種類の集計を一時的に生成。**旧マスター自体はGitHubへコミットせず、イベント文章も名前も転載しない**。

## 次

今回確認できたのは**旧マスターとのID一致**であり、実行時辞書への追加ではない。これを、利用者へ提供しない**メモリ内の試験スキル辞書**として明示的に`historical-2025-only`と区別して接続すれば、GameTora由来のイベントから残る71件のうち多くを技術的に変換できる可能性がある。変換後の保留理由も全件再計算する。

本番への正式採用については、GameTora側の収録時点と2026年の表記差、GameWithで疑義を解く必要がある部分、本文・権利、公開ゲートを別に確認すること。**本番承認イベントは現状0件**。
