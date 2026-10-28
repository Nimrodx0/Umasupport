# 既存SSR30001：GameTora本体とアプリ用スキルイベント投影の差分照合（2026-10-28）

## 目的と基準

[前段の独自数値候補照合](official-gametora-existing-normalized-parity-20261028.md)では、既存GameTora由来の固定JSONを`gametora_whole_event_normalize.cjs`で正規化し、同じSSR30001のGameTora本体と5イベント・9経路・絆効果8件まで一致した。

今回は一段先の、**実際のアプリ用イベントスキーマへの投影**を使用する。固定資料は`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`の`support_30001.json`（Git blob `6aca60590854f402a67da82c2ffa7295e564b40f`）。独立スキル辞書は前段と同じ固定UmaSim（Git blob `0c6ea6d72b037b24ee40860f73b0e86db47aab1d`）。

**基準側**：既存`transformDocument` → `gametora_event_skill_crosswalk.crosswalk` → `gametora_app_schema_dry_run.project` → `event_schema.validateCatalog`（実装された投影器が実際に通す検証）。 この検証は単一カードの**隔離モデル**を入力としており、公開用563カード実モデルの通常ヒント名称ID（`hint:`）への統合まで同一ハッシュであることは証明しない。固定旧出典の元の本文や選択肢名、未承認アプリ用候補はCIの一時プロセス内だけで扱う。

**元サイト側**：[SSR30001 GameTora本体](https://gametora.com/ja/umamusume/supports/30001-special-week)をGitHub ActionsのChromeで閲覧。5イベントの見出し位置を既存の一意対応で固定し、結果ごとに効果の種類・符号付き数値、**ヒントLvと数値スキルID**を独立パース。旧固定元の選択肢・結果番号を突合の結び目にするが、**旧固定から元サイトにない報酬を補う実装はしない**。

[コード](../poc/src/official_gametora_app_schema_parity.cjs)／[元サイトChrome検証](../poc/tools/probe_official_gametora_browser.cjs)／[異常系テスト](../poc/tests/official_gametora_app_schema_parity.test.cjs)。

## 実測

[PR #249](https://github.com/Nimrodx0/Umasupport/pull/249) の[直接取得CI #40638432328](https://github.com/Nimrodx0/Umasupport/actions/runs/40638432328)で一度PASS。最後のソース修正後の実行もPR CIで確認する。

| 比較・検証対象 | 結果 | 範囲 |
| --- | ---: | --- |
| 元サイトとアプリ用投影のイベント数 | **5/5** | 固定1カードのイベント |
| 元サイトとアプリ用投影の分岐・報酬経路 | **9/9** | 実アプリ`auto/choice/outcomes`の件数と各結果別スキル報酬 |
| 結果内の数値ID＋ヒントLv | **5/5** | 実アプリ`rewards[]`と本体から独立に読んだ値 |
| 選択肢数・OR結果数と元サイト表示 | **5/5イベント** | 画面上の数と旧固定モデルの数が一致。ゲーム中の選択種別の独立証明ではない |
| 元サイトで明示された打ち切りと実アプリ位置 | **1経路** | 正の打ち切り事実だけ照合。他経路の非打ち切り全証明ではない |
| 非スキル数値効果の元サイト表示 | **31記載** | 内、絆8記載。スキル専用アプリ投影には含まない |
| 実アプリ投影が持つ前段`requires` | **2イベント** | **元サイトでの前段到達条件を独立確定した数ではない** |
| ゲーム内再現／公開承認 | **未検証** | 正式公開イベント0件 |

## 重要な限界：これは最終イベントJSONの全項目一致ではない

現在の`gametora_app_schema_dry_run.project`は、非公開の**スキル報酬用イベント形状**を作る。能力値・体力・やる気・絆ゲージなどの非スキル報酬は別の既存処理`phase2_gt_whole_nonskill_effect_inventory.cjs`と`phase2_2512_private_effect_join.cjs`で扱う。今回の元サイトと実アプリ用スキル投影の比較には、元サイトで31件確認した非スキル数値効果を**アプリの`effects[]`として照合・合格判定する処理はまだない**。また絆の受け手`recipientCharId`は画面の数値だけから特定できない。

同様に、旧GameTora由来の連続イベント順序から生成した`requires`は、元サイトのイベント見出しが同じ順に並んでいるだけでは実ゲームでの後続解放条件と断定できない。選択肢と成功／失敗の意味、未知の報酬、終了後続、公開本文の権利は別に確認する。

今回の出力では、`appSkillRouteParity=true`と`fullAppJsonParityVerified=false`を**同時に保持**する。両者を一括して「GameToraから全データ変換完了」と扱うことは禁止。

## A／B／C／公開の区別

- **A 機構**：元の変換器・スキル辞書クロスウォーク・実アプリ投影器を直接実行する合成5イベント9経路試験。結果数／報酬ID／Lvの改変、同一画面経路の重複、サイトの未照合、打ち切り位置の誤対応を拒否。
- **B データ**：旧SSR30001のGameTora由来固定データと独立固定UmaSimスキル辞書を比較基準として利用。あくまで1カードの実測であり、全件網羅ではない。
- **C 環境**：GitHub Actions上のChromeで元GameTora本体表示を検査。物理端末上のゲーム結果を再現していない。
- **公開**：原文・選択肢・原HTML・元サイト画像・未承認アプリJSONをコミットせず、正式イベントDB更新は0件。

## 次工程

1. 上記31件の非スキル数値効果を、すでに存在する**非スキル実行候補`effects[]`**と結果番号・値・種類について照合する。ただし絆の受け手等サイト側で確認できない項目は未検証とする。
2. 元サイトの直接取得で得た情報からアプリ用イベント形状を組み立てられる**一般的な変換器**を整備する。比較基準の旧固定データは検証・例外裁定専用とし、取得した情報への逆流・自動補完はしない。
3. 対象拡張の際は旧固定データに収録済みの構造の違う複数サポカを使い、結果分岐、連続打ち切りなどの回帰分類を測定してから新サポカに進む。
