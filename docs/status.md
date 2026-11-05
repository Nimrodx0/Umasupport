# 開発状況（現行スナップショット）

**測定日：2026-11-05。** 対象：main（公開イベント・既存機能、[PR #336](https://github.com/Nimrodx0/Umasupport/pull/336)の拡張実験まで統合）と、本版で追加するP2研究用区間集計。数値は固定ソースに対する測定であり、現行ゲーム全体の網羅性を示しません。

> **読む順番**：現在の到達点はこのページ、これからの仕事は [roadmap.md](roadmap.md)、過去のPR別報告・旧スナップショットは [移行前の全文](archive/status-through-20261105.md) と [開発履歴](development-history.md) を参照してください。過去の「次工程」を今の指示として扱わないでください。

## ひと目で分かる現在の状態

| 領域 | 確認済み | 残る作業 |
| --- | --- | --- |
| アプリ本体 | GitHub Pagesでデッキ、スキル比較、イベント設定、所持・検索、保存・復元を提供 | 公開版のWindows・Android物理端末受け入れ、更新・異常系の運用確認 |
| 公開イベント | GT由来の独立した事実データを承認済みJSONとして公開 | 出典が異なる25件は保留。現ゲームとの差異・出典利用条件は継続管理 |
| 既存イベント変換 | 固定563カード・2,512イベントの技術変換基盤 | 技術変換は現ゲームの再現・権利・公開を保証しない |
| 新サポカ | UmaSimの追加ID検出、派生GitHub JSON監視、未入手の持越台帳 | 10149、30322、30323の元JSONが未掲載（[Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283)） |
| スキル説明 | 固定881スキル中818件をUmaSim辞書で照合 | 63件は効果・発動条件が未照合、一覧への掲載は維持 |
| 脚質傾向分析 | P0構造監査、P1条件モデル、P2定性的な53スキル分類の初版 | P2のモデル根拠検証、P3カード集約、P4検索UI、P5統合受け入れ |

## 公開イベントの検証対象（本番JSON）

- 公開イベント（公開JSON実測）：**2,487件**／**559カード**。測定対象：[poc/data/reviewed_events.v1.json](../poc/data/reviewed_events.v1.json)。公開承認と初回投入は [PR #309](https://github.com/Nimrodx0/Umasupport/pull/309)（2026-11-02）。CIの機械検査でJSONのイベント数とこの記載を突き合わせます。
- 固定技術変換2,512件のうち **25件** は公開保留（GameWith補正が入ったGT由来1件、別出典から編集追加した24件）。保留は公開データから分離したままで、ゲーム中に存在しない意味ではありません。根拠は [公開承認の監査](phase2-no-inquiry-publication-assessment-20261102.md) と [出典例外分類](phase2-source-lineage-exception-map-20261102.md)。
- 公開JSONは、未承認の試用モードや非公開候補とは別。通常の起動時にロードできることは [PR #312・#313](https://github.com/Nimrodx0/Umasupport/pull/313) とPages実ブラウザで確認。元のイベント本文・画像を無断再配布しない。

## 実装と検証の境界

- **A 機構**：Nodeのユニットテスト、実Chromiumのデスクトップ／スマホ幅で主要操作を検証。継続実行は [PoC Core Tests](../.github/workflows/ci.yml) を参照。
- **B データ**：固定出典での技術変換・JSON公開ゲート・元スキルIDの照合は確認済みの範囲がある。ただし **旧マスター**・出典間の差分と全件の実ゲーム照合は別の未完工程。
- **C 実環境**：GitHub Pages実ブラウザの表示・公開データ読込は検証済み。Windows／Androidの物理端末を網羅した最終受け入れとは区別する。受け入れゲートは [verification-plan.md](verification-plan.md)。

## 最新の進行中作業

- **脚質分析 P2**：構造化条件と53スキルの定性的初版、[9頭パイロット #335](https://github.com/Nimrodx0/Umasupport/pull/335)、[9/12頭・6コース拡張 #336](https://github.com/Nimrodx0/Umasupport/pull/336)、[区間平均近似 #338](https://github.com/Nimrodx0/Umasupport/pull/338)をmainへ統合。固定GlobalSim v77の実行成果物（[Actions #41962505576](https://github.com/Nimrodx0/Umasupport/actions/runs/41962505576)）で**2,160レース、上位／後方順位の位置観測204,120、区間別モデル推計2,208件**を解析（順位不明6観測）。区間延長、脚質構成、距離・頭数・人工能力差の感度を[実測レポート](skill-position-window-sensitivity-audit-20261105.md)に整理し、再現可能な自動比較器を追加する。**実スキル発動率ではなく、P2適性閾値は未採用。53スキルとUIは不変**。[密フレームの追い抜き交点を用いた再検証](skill-position-dense-frame-validation-20261105.md)では固定GlobalSim v77の72レース・384比較セルで9地点の疎な近似との差を計測（絶対差平均0.61、最大7.49ポイント）。**精密な閾値には密フレーム方式を優先**するが、実ゲーム発動率は検証していない。
- **公開保留・継続更新**：25件の出典別判断は [Issue #302](https://github.com/Nimrodx0/Umasupport/issues/302)、新カードは [Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283) で追跡。公開済み2,487件を再び0件と書く旧Issueや旧文書は [履歴](archive/status-through-20261105.md) として扱います。

## 更新ルール

1. 公開件数や機能の状態が変わったPRは、このスナップショットの該当行を**上書き**し、根拠PR・出典版・測定日とA/B/Cを記す。日付別の報告をこのページへ累積しない。
2. 新しい優先順位は [roadmap.md](roadmap.md) の一つの作業順だけを修正。履歴の保存先は個別監査とPR、必要時のみ [development-history.md](development-history.md)。
3. Open Issueには「現在の状態」を先頭に置き、過去の未完チェックや旧0件の記述は**履歴**と明示する。更新漏れを週次チェックで検出する。
4. 上記の公開イベント数とロードマップの旧前提は `poc/tools/check_project_tracking.cjs` がCIで照合する。数字の自動検証は権利承認・実機試験を代替しない。
