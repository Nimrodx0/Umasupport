# Phase 2：GameToraの条件付きセグメントを元位置で追跡し、無条件報酬への誤変換を防ぐ（2026-10-26）

## 目的と元ソースの挙動

[前工程の重複状態効果の整備](phase2-gt-ordered-repeated-status-effects-20261026.md)時点で、固定GameTora元2,488イベントのうち非スキル報酬を安全に構造化したものは2,404イベント、保留84イベントだった。残る保留理由の一つ`CONDITIONAL_SEGMENTS_NOT_MODELED`は、`choice.segments[]`の中に**ゲーム内部の状態に応じて選択される別々の報酬**があることを示す。

固定元`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`の[イベント実行器`resolve_segments`](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L815-L865)と[セグメント選択`_segment_index`](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L1068-L1085)により、報酬セグメントは実行時に条件に合う**1つ**を選ぶ。通常のユーザー選択肢や`random_either`とは別の機構。

固定GTのサポカイベント中には、`when:[{kind:'scripted',value:['class',1]}]`、`class=2`、`class=3`の3区間を持つ例がある。元実装`_guard_holds`は`scripted`を`chara_info`から判定する実装を持たず、既定セグメントへフォールバックする場合がある。**したがって`class=1/2/3`をユーザーの3択、成功／失敗、等確率のランダム結果、条件付きスキルの確定取得に読み替える根拠はない**。

## 今回の実装

- `poc/src/phase2_gt_conditional_segment_review.cjs`を追加。全固定GTカードの`choice.segments[]`を走査し、**GT数値カードID・元イベント順位・元選択肢順位・元segment順位・元結果順位**を保持する。コードで解釈できるものは`opaque-scripted-class`（技術的な`class`数値のみ）、`requires-current-mood`、`fallback`、`unadjudicated-guard`として型分け。ただしすべて`runtimeResolvable:false`、`guardContextVerified:false`、`automaticOutcomeSelectionAllowed:false`の**未解決**扱いにする。
- その各ルートが従来の固定全件`phase2_gt_whole_nonskill_effect_inventory.cjs`の**同じカードID・イベント／選択肢／結果順位**と一致し、`CONDITIONAL_SEGMENTS_NOT_MODELED`で隔離されていることを二重チェックする。もし分岐が報酬へ昇格していれば監査全体を失敗させる。
- 監査メタデータにはイベント名、選択肢本文、元効果の型・数量、原文を入れず、**結果数とガードの技術的種類のみ**記録する。通常の公開カタログや非公開の本番形式スキル2,512イベントには接続しない。
- `poc/tools/audit_phase2_gt_whole_nonskill_effects.cjs`で固定全件アクションの**一時フォルダー**にのみ`phase2_gt_conditional_segments_review_private.v1.json`を出力。イベント本体や第三者データをレポジトリへコミット／Pagesで公開しない。
- 合成Node試験`poc/tests/phase2_gt_conditional_segment_review.test.cjs`で、`class`条件をランダム・プレイヤー選択に誤変換しないこと、セグメント内結果の元順序、ガード形状、本文・数値情報の漏出防止、出典SHAと元結果位置の改変に対する失敗を確認する。

## B：固定GT全件の再監査

[固定GT全件CI #40255009826](https://github.com/Nimrodx0/Umasupport/actions/runs/40255009826) **PASS**。基準元は559サポカ・2,488イベント、4,129選択肢、4,376結果経路、13,263効果記載で不変。

| 項目 | 結果 |
| --- | ---: |
| `segments`のある元GTイベント／カード | **3イベント／3カード** |
| 条件付きセグメント総数 | **8** |
| セグメントから展開した結果経路 | **8** |
| 明示的な`when`ガードの付いた結果経路 | **7** |
| 技術用`scripted class`ガード | **6** |
| `otherwise`既定分岐のガード | **1** |
| その他のガード（今回の資料の対象内） | **0** |
| 元の結果IDに対応して隔離状態を再確認した経路 | **8/8** |
| 自動的なスキル／数値報酬への昇格 | **0** |

`8`結果経路と`7`条件付き経路の差の1つは、明示的な`when`を持たない既定区間であり、そこが無条件に必ず発動するという意味ではない。内部条件の判定結果によって選ばれる一つの区間である。

**調査対象の元位置（イベント原文は記録しない）**

| 固定GTカードID | 元イベント順位 | 元選択肢順位 | セグメントとガード |
| --- | ---: | ---: | --- |
| 10109 | 2 | 1 | 1～3：`scripted class` 1／2／3 |
| 30102 | 5 | 1 | 1：明示ガードなし、2：`otherwise` |
| 30207 | 2 | 1 | 1～3：`scripted class` 1／2／3 |

これらは[最終固定全件CI #40255332044](https://github.com/Nimrodx0/Umasupport/actions/runs/40255332044)の`GT_CONDITIONAL_SEGMENTS_SOURCE_POSITIONS`で全8行を数値IDと元順位で再確認した。特に30102の「明示ガードなし」は**実行器の既定セグメント選択規則の一部**であり、同じchoiceの両区間の効果を合算する根拠ではない。

今回この8経路を「安全に統合できた件数」とは数えない。既存2,488イベントの構造化可能数**2,404**、保留**84**、非公開スキル2,512件へ統合**2,403**、SSR30080#6の元GT auto／個別裁定3択例外は**すべて不変**。元の563サポカのスキル計算ハッシュと、既存の使い捨て`preflight/attach`検証も保持する。

## A/B/C・未解決の条件

A＝合成ガード試験と不正元結果・出版誤昇格の拒否。B＝固定GT全件走査、元結果との1対1照合、隔離されたメタ情報の件数固定。C＝従来のChromiumによる**現行公開アプリの機能回帰のみ**。条件付き8結果の本番公開UI表示、実際の`class`の出所、Windows／Android物理端末、現行ゲーム内の結果表示は未検証。

**次の開発対象**：固定元実装外の`class`が何を指すかの個別出典裁定と、条件がユーザー選択ではなく内部状態に依存する場合のアプリ用`branchGuard`設計。曖昧なまま元データを複数の報酬へ合算したり、ユーザーにランダム結果として選ばせたりしない。残り84イベントには未対応効果コード90記載、数値範囲表記、先行連続結果条件、特殊コード等も存在する。**正式公開イベント0件**は不変。
