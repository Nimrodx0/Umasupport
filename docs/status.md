# 開発状況（現行スナップショット）

**測定日：2026-11-05。** 対象：main（公開イベント・既存機能）と [未マージPR #336](https://github.com/Nimrodx0/Umasupport/pull/336)（脚質分析の実験）。数値はこの時点の固定ソースに対する測定であり、現行ゲーム全体の網羅性を示しません。

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

- **脚質分析 P2**：2026-11-04～05に条件の構造化・順位条件の定性推定を監査。GlobalSimの9頭パイロットは [PR #335](https://github.com/Nimrodx0/Umasupport/pull/335)。拡張実験は [PR #336](https://github.com/Nimrodx0/Umasupport/pull/336)（本スナップショット時点でOpen、main未統合）。数値はモデルの条件成立率であり、実ゲームの発動確率ではありません。
- **公開保留・継続更新**：25件の出典別判断は [Issue #302](https://github.com/Nimrodx0/Umasupport/issues/302)、新カードは [Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283) で追跡。公開済み2,487件を再び0件と書く旧Issueや旧文書は [履歴](archive/status-through-20261105.md) として扱います。

## 更新ルール

1. 公開件数や機能の状態が変わったPRは、このスナップショットの該当行を**上書き**し、根拠PR・出典版・測定日とA/B/Cを記す。日付別の報告をこのページへ累積しない。
2. 新しい優先順位は [roadmap.md](roadmap.md) の一つの作業順だけを修正。履歴の保存先は個別監査とPR、必要時のみ [development-history.md](development-history.md)。
3. Open Issueには「現在の状態」を先頭に置き、過去の未完チェックや旧0件の記述は**履歴**と明示する。更新漏れを週次チェックで検出する。
4. 上記の公開イベント数とロードマップの旧前提は `poc/tools/check_project_tracking.cjs` がCIで照合する。数字の自動検証は権利承認・実機試験を代替しない。
