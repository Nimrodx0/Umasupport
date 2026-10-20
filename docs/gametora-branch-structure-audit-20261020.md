# GameTora由来イベント分岐の構造監査（2026-10-20）

## 目的とソース

既存の固定Checker417枚・2,109イベント候補／全563枚カード索引と、GameTora由来の別系統JSONに含まれる「連続イベント内の結果・打ち切り・前段結果依存」を比較するための**読み取り専用**監査。

- 参照先: [systemless10/UmamusumePS](https://github.com/systemless10/UmamusumePS/tree/6e38b54af4fad397ff4491e63007a90705a4fe67/server/data/events/gametora)
- 固定コミット: `6e38b54af4fad397ff4491e63007a90705a4fe67`（2026-10-19）
- 参照コードの確認箇所: `server/app/gametora.py`、`server/app/event_engine.py`
- 入力: `server/data/events/gametora/support_XXXXX.json`。可能なら `events_ja` を採用し、なければ `events` を使用。英日を重複合算しない。
- 原文のイベント名・説明文・選択肢文章・ソースのJSON全体を当レポジトリへ同梱しない。GitHub Actionsは外部公開リポジトリを一時checkoutし、**独自に集計した数値事実だけ**をartifactへ保存。

監査ツール: `poc/tools/audit_gametora_branches.cjs`。テスト: `poc/tests/gametora_branch_audit.test.cjs`。
ワークフロー: [Audit pinned GameTora-derived event branches](../.github/workflows/gametora-branch-structure-audit.yml)。PRおよび手動起動に対応。

## 測定の定義

- **カードID対応**：全563枚索引との正確なID集合差（R・SR・SSR含む）。GameTora側の公開JSONファイル数と、照合成功数は異なる。
- **連続イベント**：GameTora形式で `section:"arrows"` のもの。記載順は参考にできるが、後続への到達を保証しない。
- **結果経路**：`outcomes` 内の各効果群（`segments` があれば条件ごとの群）を1経路として数える。**前段成功条件が1つの効果配列に複数並んでいても、これを複数の検証済み経路へ自動展開しない**。
- **打ち切り**：当該選択または結果の効果群に `chain_end` が存在するときだけ計上。`chain_end` がなければ「継続確定」ではない。
- **前段条件**：`both_previous_chain_good`、`one_previous_chain_good`、`both_previous_chain_bad`、`success`、`fail` 等を検出するが、実ゲームの正確な条件グラフと同一視しない。
- **優先キューへの対応**：P0の199イベントのうち**該当カードIDのファイルが存在する数**を数える。Checkerの`sourceKey`とGameToraイベント個別ID／旧`story_id`の同一性は未確認なので、**P0イベントの直接照合率とは呼ばない**。

## 検証対象の既知4カード

1. SSR30001: 連続2の下選択に `chain_end`。
2. SSR30007: 連続2の下選択に `chain_end`。
3. SSR30026: 連続1・2の上選択は結果によって `chain_end` の有無が異なり、下選択は終了する。
4. SSR30103: 連続3の報酬に `both_previous_chain_good`／`one_previous_chain_good`／`both_previous_chain_bad` の3種の条件マーカーがある。

既存の複数資料監査JSONと意味の整合を確認するための代表例。GameTora由来資料はゲームの一次マスターでも、Checkerと完全に独立した実測でもない。

## 本番導入と追加調査

本レポートの `releaseApproved:false`、`gameVerified:false`、`eventToCheckerCrosswalkVerified:false` は固定。通常公開イベント0件の状態を変更しない。

次の工程は、カードIDでカバーできたP0対象に対して、**各イベント名を一時処理で照合し、旧story IDを利用したイベント単位の一意な仮リンクを作る**こと。衝突、同名、日英差、分岐チェーンの番号ずれは未確認として残す。後続グラフは番号から確定しない。元の文章、画像、第三者のデータベース丸ごとの再配布と、GameToraサイトへの大規模自動リクエストは行わない。

外部リポジトリのコードライセンス（AGPL-3.0）とGameToraデータ自体の利用条件を混同しない。今回のコードは独自実装であり、外部コードや原文を取り込んでいない。今後、本番用の数値事実DBに大規模に採録する前に、出典・取得方法・利用条件を別途評価する。
