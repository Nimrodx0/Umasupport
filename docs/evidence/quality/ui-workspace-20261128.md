# UIワークスペースの実装・公開受入（2026-11-28）

対象は[D-079](../../decisions/log.md#decision-d-079)で承認されたUIレビュー全改善。[PR #597](https://github.com/Nimrodx0/Umasupport/pull/597)をmain `7d8ecec5fa054b965f739b97a2058b1d35769b11` へ統合し、公開版 `20261128-ui-r2` を確認した。物理端末やゲーム全体のデータ網羅性の確認ではない。

## 実装と判断

- 編成・サポカ一覧・全スキル一覧・所持管理を主要ナビ、JSON入出力・初期化・収録状況を設定へ配置。主要一覧とイベント一括設定を独立ページ化した。
- PCは左編成固定／右分析、モバイルは下部ナビで編成と比較を分けた。各編成の6枠は全幅で3列×2行。育成条件は要約と展開編集、目標・集計は既存結果を共用する。
- 統合・左右比較を保持し、12枠提供マトリクスを追加。枠表示は既存集計の経路を投影し、同一カードIDの重複排除、金白、直接／間接、条件付き経路を変更しない。
- 全フィルターを残し頻用／詳細に整理、適用数を表示。候補追加と一覧閲覧の要約を分け、完全な内訳は詳細パネルで確認する。
- 追加・詳細はサイドパネル。背景操作を抑止し、Tab、Escape、閉じた後のフォーカス復帰へ対応。ハッシュ経路、戻る／進む、直接リンクを提供する。
- フラットな面と共通の配色・文字・余白、ライト／ダークを実装。静的JS構成を維持し、テーマはデッキJSON外の端末内設定。試用モードの保存キー分離も維持する。

最新mainのD-074配信分離とD-076〜D-078運用を取り込んだ。公開イベント・承認台帳・固定研究入力・計算エンジン・データ権利方針はUI改修によって変更していない。仕様正本は[要件§4](../../reference/requirements.md#4-画面構成d-079)、表示状態の責務は[アーキテクチャ](../../reference/architecture.md#uiのページ表示状態d-079)。

## A：機構・回帰

- 新規単体3件、設定23件、新規Chromium操作（1440／390／320px）成功。3×2、マトリクス、フィルター、独立ページ、ブラウザ履歴、直接リンク、フォーカス、所持・イベント・テーマ再読込、保存維持を確認。
- 既存ブラウザ回帰11本、固定D-059の881スキル／404ラベルの自動・手動読込、W5旧版復帰（1280／390px）が成功。旧テストの非表示フィルターへの直接操作を、実ナビ／summary操作へ移行した。集計や保存の期待値は維持。
- 統合前の全Node試験は1863件中1860成功・1スキップ・2失敗。固定Git履歴の未取得による文書試験は取得後8件再試験で成功。残る研究キャッシュのsymlink試験1件はWindows権限制限で完了できなかった。本PRで起動するCIの対象外であり、CI成功で代替したとは扱わない。
- 最終PR head `9d66c2404871c2c30a87d4d1f0d2fa15309b0782` の7ワークフローがすべて成功：[Core](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766946)、[文書](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766954)、[P3初期判定](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766939)、[P3実用判定](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766988)、[条件一覧](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766940)、[公開一覧](https://github.com/Nimrodx0/Umasupport/actions/runs/46127766984)、[旧版復帰](https://github.com/Nimrodx0/Umasupport/actions/runs/46127767002)。

## B：データとC：公開環境

[Pages配信](https://github.com/Nimrodx0/Umasupport/actions/runs/46150940860)、統合後[Core](https://github.com/Nimrodx0/Umasupport/actions/runs/46150941149)・[文書](https://github.com/Nimrodx0/Umasupport/actions/runs/46150941121)、[実公開受入](https://github.com/Nimrodx0/Umasupport/actions/runs/46150941133)、[公開適性受入](https://github.com/Nimrodx0/Umasupport/actions/runs/46150941145)はすべて成功。

通常入口 `https://nimrodx0.github.io/Umasupport/` からクエリを追加せず遷移し、全29実行資産の版・SHA-256一致を検査。Chromium 140で以下を確認した。

| 対象 | 確認範囲 |
| --- | --- |
| 公開適性・保存 | 1280／390px。568カード・885スキル、適性404件（未照合0）、全詳細フィルター、内訳、育成条件、並べ替え、再読込、取得異常時の表示 |
| 公開新UI | 1440／390px。3×2、12枠マトリクス、主要独立ページ、横はみ出しなし、ライトテーマ再読込、保存内容維持 |
| イベント・復旧 | 公開DB revision 1、snapshot `12618f01a2e317311f28e768d5fca7a0b757386f`、2521イベント。独立配信の照合、イベント選択、目標、0／4凸、通信遮断、キャッシュ復旧、不正更新・破損キャッシュ・IndexedDB拒否 |

ローカルでも同じ公開受入スクリプトを実公開先に対して実行して成功した。追加の公開新UI確認は一時スクリプト、再実行可能な主要受入はリポジトリの `browser_workspace_ui.cjs`、`browser_public_d060.cjs`、`pages_live_browser.cjs` にある。スクリーンショットと一時入力は無視対象のscratchに置き、外部原本をコミットしていない。

## 未検証

物理Windows／Android端末、Safari／Firefox、実ゲーム全体の正確性・網羅性は未確認。320pxはローカルChromiumで確認し、実公開先では390pxを確認した。上記Windowsのsymlink試験1件は未完。既存の実機受入保留・データ公開の境界を変更しない。
