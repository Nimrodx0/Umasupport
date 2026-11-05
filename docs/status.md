# 開発状況（現行スナップショット）

**測定日：2026-11-06。** 対象：公開アプリの現行mainと、GlobalSim v77固定版によるP2順位条件分析（[PR #335～#348](https://github.com/Nimrodx0/Umasupport/pull/348)）。数値は固定条件のモデル上の測定であり、現行ゲーム全体の発動率ではありません。

> **読む順番**：現在の到達点はこのページ、これからの仕事は [roadmap.md](roadmap.md)、過去のPR別報告・旧スナップショットは [移行前の全文](archive/status-through-20261105.md) と [開発履歴](development-history.md) を参照してください。過去の「次工程」を今の指示として扱わないでください。

## ひと目で分かる現在の状態

| 領域 | 確認済み | 残る作業 |
| --- | --- | --- |
| アプリ本体 | GitHub Pagesでデッキ、スキル比較、イベント設定、所持・検索、保存・復元を提供 | 公開版のWindows・Android物理端末受け入れ、更新・異常系の運用確認 |
| 公開イベント | GT由来の独立した事実データを承認済みJSONとして公開 | 出典が異なる25件は保留。現ゲームとの差異・出典利用条件は継続管理 |
| 既存イベント変換 | 固定563カード・2,512イベントの技術変換基盤 | 技術変換は現ゲームの再現・権利・公開を保証しない |
| 新サポカ | UmaSimの追加ID検出、派生GitHub JSON監視、未入手の持越台帳 | 10149、30322、30323の元JSONが未掲載（[Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283)） |
| スキル説明 | 固定881スキル中818件をUmaSim辞書で照合 | 63件は効果・発動条件が未照合、一覧への掲載は維持 |
| 脚質発動条件適合性 | **v1.1**：馬場種別・馬場状態を脚質適合性と独立した発動条件へ分離。既存53件×4脚質を固定データで再判定 | **31スキルで高／低の方向性、22スキル保留**。ダートでの方向性は暫定共通適用であり、実ゲーム発動率の測定・P3/P4は未承認 |

## 公開イベントの検証対象（本番JSON）

- 公開イベント（公開JSON実測）：**2,487件**／**559カード**。測定対象：[poc/data/reviewed_events.v1.json](../poc/data/reviewed_events.v1.json)。公開承認と初回投入は [PR #309](https://github.com/Nimrodx0/Umasupport/pull/309)（2026-11-02）。CIの機械検査でJSONのイベント数とこの記載を突き合わせます。
- 固定技術変換2,512件のうち **25件** は公開保留（GameWith補正が入ったGT由来1件、別出典から編集追加した24件）。保留は公開データから分離したままで、ゲーム中に存在しない意味ではありません。根拠は [公開承認の監査](phase2-no-inquiry-publication-assessment-20261102.md) と [出典例外分類](phase2-source-lineage-exception-map-20261102.md)。
- 公開JSONは、未承認の試用モードや非公開候補とは別。通常の起動時にロードできることは [PR #312・#313](https://github.com/Nimrodx0/Umasupport/pull/313) とPages実ブラウザで確認。元のイベント本文・画像を無断再配布しない。

## 実装と検証の境界

- **A 機構**：Nodeのユニットテスト、実Chromiumのデスクトップ／スマホ幅で主要操作を検証。継続実行は [PoC Core Tests](../.github/workflows/ci.yml) を参照。
- **B データ**：固定出典での技術変換・JSON公開ゲート・元スキルIDの照合は確認済みの範囲がある。ただし **旧マスター**・出典間の差分と全件の実ゲーム照合は別の未完工程。
- **C 実環境**：GitHub Pages実ブラウザの表示・公開データ読込は検証済み。Windows／Androidの物理端末を網羅した最終受け入れとは区別する。受け入れゲートは [verification-plan.md](verification-plan.md)。

## 最新の進行中作業

- **脚質分析 P2**：固定GlobalSim研究[6コースの共通傾向 #343](skill-position-six-course-generality-20261105.md)、[全4局面・7順位帯 #344](skill-position-rank-phase-foundations-20261105.md)、[固定編成 #345](skill-position-fixed-roster-paired-control-20261105.md)、[対戦相手の脚質構成変更 #346](skill-position-focal-opponent-roster-study-20261105.md)に基づく[**発動条件適合性v1.1 #348**](skill-activation-condition-fit-v1-20261106.md)を研究専用に更新。**ダート・馬場状態は独立した絶対発動条件**として演算子・値を保持し、芝で確認した脚質の定性的方向性をダートに**暫定適用**（ダートでの順位分布は未検証と明示）。固定UmaSim53スキル×4脚質＝212件の新結果は**高適合62・低適合62・保留88、他3区分0**。**31スキル判定、22スキル保留**。ダート限定9件中5件の保留解除、残り4件は序盤・中盤部分区間の未検証が理由。**実ゲームのスキル発動確率、効果の有用性は未評価**。旧53ラベル・サポカ集約・UI・公開イベントは変更なし。
- **公開保留・継続更新**：25件の出典別判断は [Issue #302](https://github.com/Nimrodx0/Umasupport/issues/302)、新カードは [Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283) で追跡。公開済み2,487件を再び0件と書く旧Issueや旧文書は [履歴](archive/status-through-20261105.md) として扱います。

## 更新ルール

1. 公開件数や機能の状態が変わったPRは、このスナップショットの該当行を**上書き**し、根拠PR・出典版・測定日とA/B/Cを記す。日付別の報告をこのページへ累積しない。
2. 新しい優先順位は [roadmap.md](roadmap.md) の一つの作業順だけを修正。履歴の保存先は個別監査とPR、必要時のみ [development-history.md](development-history.md)。
3. Open Issueには「現在の状態」を先頭に置き、過去の未完チェックや旧0件の記述は**履歴**と明示する。更新漏れを週次チェックで検出する。
4. 上記の公開イベント数とロードマップの旧前提は `poc/tools/check_project_tracking.cjs` がCIで照合する。数字の自動検証は権利承認・実機試験を代替しない。
