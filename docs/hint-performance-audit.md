# ヒントLv・ヒント発生率の0〜4凸別データ監査

更新：2026-10-17　対象：[F-07](requirements.md#f-07-ヒント関連性能)／[Phase 1](roadmap.md)／[PR #34](https://github.com/Nimrodx0/Umasupport/pull/34)

## 取得元と列定義

[UmaSim `support_card.txt` 固定版](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/support_card.txt) を一度だけGitHub Actionsのパイプ経由で読み取り、第三者データ本体は当リポジトリ・Actionsアーティファクト・Pagesへ書き出さない。SHA-256：`153213019b5232df6c211427b862978218b60df6baee03c2a5fee75e0966d424`。

列の意味は公開元の[SupportCardLoader.kt](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/core/src/commonMain/kotlin/io/github/mee1080/umasim/data/SupportCardLoader.kt)と[SupportCard.kt](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/core/src/commonMain/kotlin/io/github/mee1080/umasim/data/SupportCard.kt)で確認した。

| 0起点の列番号 | 元データの項目 | UIに用いる意味 |
|---|---|---|
| 23 | status.hintLevel | 基本パラメータのヒントLvアップ |
| 24 | status.hintFrequency | 基本パラメータのヒント発生率アップ |
| 49 | unique.hintLevel | 固有パラメータの固定ヒントLvアップ |
| 50 | unique.hintFrequency | 固有パラメータの固定ヒント発生率アップ |

`status` と `unique` は別の26項目群。カード1枚につき0〜4凸の5レコードをそれぞれ数値検査する。通常ヒントの**基礎獲得Lvは1 + 基本ヒントLv補正 + 固有ヒントLv補正**（UmaSimの通常ヒント付与式）。発生率アップは基本・固有の**数値を別々に表示**し、合算した確率を表示しない。特殊条件によって発生率、Lvやヒントの種類が変化する可能性は残る。

## 実ソース全件計測

実行証拠：[Actions #38952732567](https://github.com/Nimrodx0/Umasupport/actions/runs/38952732567)（成功）。
実行コード：[監査スクリプト](../poc/tools/audit_hint_performance.cjs)／[限定実行ワークフロー](../.github/workflows/hint-performance-audit.yml)。

| 項目 | 実測 |
|---|---:|
| サポカレコード | **563枚** |
| 段階別レコード合計 | **2,815行**（全カード5段階） |
| 内訳 | SSR 316 / SR 101 / R 146 |
| 0凸→4凸でヒントLv補正が変わるカード | **271枚** |
| 0凸→4凸でヒント発生率補正が変わるカード | **390枚** |
| ヒントLv基本補正値 | **0〜4** |
| ヒントLv固有補正値 | **全件0** |
| ヒント発生率基本補正値 | **0〜100** |
| ヒント発生率固有補正値 | **0〜20** |
| 通常ヒントの基礎獲得Lv（本資料に基づく） | **1〜5** |

無凸で非ゼロのヒントLv補正があるカード377枚、4凸では424枚。ヒント発生率補正が非ゼロなのは無凸387枚、4凸431枚。

## 検証条件・未解決

- **A 機構**：公開元の列位置をコードと突合。全2,815行をパースし、空・不正・安全でない整数を拒否。人工データの0凸と4凸差、ブラウザ上の段階切替、破損したオンライン更新拒否をCIで試験。
- **B データ**：この数値は「UmaSimが収録する563枚・5段階」についての全件ソース監査。カード自体の最新ゲーム網羅率、各カードのパラメータに対する**ゲーム内独立照合**、特殊固有条件・シナリオ補正は保証しない。
- **C 実ブラウザ**：実ソースCLI・人工データDOMに加え、[公開PagesをLinux Chromiumで開いた実データの0凸・4凸表示テスト](https://github.com/Nimrodx0/Umasupport/actions/runs/38953159885)にも合格。基礎Lv、基本/固有の発生率アップが画面の値と実取得データで一致した。**新UIの物理端末確認は未実施**。Phase 1の完全ゲートは未通過。
- 固有効果に数値がないから「固有性能がない」とは判断しない。条件付き`specialUnique`は今回の対象外。
- 最新ゲーム内の標準スキル順序とカードの完全収録については、独立資料の照合が別途必要。

実装位置：`poc/src/live_loader.js`（入力検証・段階別のヒント補正）、`poc/src/live_app.js`（カード詳細）。金白対応／提供枚数・間接カバー機構には影響を与えない。
