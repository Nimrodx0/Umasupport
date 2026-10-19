# 数値ゲームマスターに基づく連続イベント段階の一括監査（2026-10-19）

## 目的と制約

PR #101で2025年固定マスターのストーリーIDと**厳密名称一致で仮対応**できた954イベントを対象に、旧ゲームマスターの `show_progress_1` / `show_progress_2` / `show_progress_3` と、Checker由来のヒント数値候補を初めて一括結合する。対応する公開Wikiのコードでは、これらを `chainNum` / `chainMax` / `isGroupChain` と読み替えている：[Umamusume WikiのTrainingEvents/Data](https://umamusu.wiki/Module:Game/TrainingEvents/Data)。

ただし旧マスターは2025年の版であり、イベントタイトルの一致もあくまで仮の同一性。**連続3段階がそろっただけでは、そのカードで2026年に3イベントが順に起こること、次へ進める選択肢、途中での打ち切り、成功・大成功・失敗の分岐、スキルの獲得可否は実証できない。**

## 全件の構造分析

数値メタデータが有効な旧マスター仮IDリンクを、同一カード内の `(chainMax,isGroupChain)` ごとにグループ化する。`chainNum` が1から `chainMax` まで**各1件ずつ**そろっている場合だけ `stage-complete-unique` とする。どれかが欠ける場合 `stage-incomplete`、重複する段階がある場合 `stage-ambiguous`。同じカードに同じ長さとフラグの複数のイベント系列があればこの方式だけでは識別できないため、曖昧な段階は絶対に結合しない。

| 指標 | 固定データの実測値 |
| --- | ---: |
| 厳密な旧ストーリー名一致イベント候補 | 954 |
| 正規の正数段階を持つイベント候補 | 910 |
| 数値段階が未設定／非標準（旧マスター上） | 44 |
| カード内の `(chainMax,isGroupChain)` グループ | 349 |
| 各段階が一度ずつそろっているグループ | 312 |
| 段階欠落のグループ | 33 |
| 段階番号重複などで曖昧なグループ | 4 |
| 上記312グループに含まれる候補イベント | 841 |
| **2026年に経路・報酬・公開条件まで正式確認したグループ** | **0** |

**312という数字は「経路まで検証済みの連続イベント数」ではない。** カード名や段階だけでは、同一の長さを持つ別のイベント系列、打ち切り選択肢、結果依存報酬の区別に不足がある。

## 保存内容と実用的な次工程

生成先：`poc/data/candidates/checker_chain_stage_audit.v1.json`。既存の `checker_event_hints.v1.json` と `checker_route_classification.v1.json` の**コミット済み数値データだけ**を入力に使う。追加の外部GETはしない。

- 各グループはカード数値ID、`chainMax`、`isGroupChain`、構造状態、段階欠番、および構成する候補の `sourceKey`・数値story ID（**仮**）・イベント順序ではなく明示 `chainNum` を保存。
- 各構成候補は `choiceSlots`、`hintMentions`、`numericHintMentions`、`unresolvedHintMentions`、`flaggedChoices`、`unparsedChoices` を保存。**元選択肢・効果・記事本文や画像を再配布しない**。
- すべてのグループに `needsCurrentGameReview:true` と `needsChoiceOutcomeReview:true` を設定。数値辞書一致と、ヒント獲得結果の承認を区別する。
- 異常のあるグループからP0（未解決スキルIDや不明なヒント構文）、P1（成功等の結果マーカー）を優先し、構造がそろい条件マーカーが少ない候補を**先に調査できる**ようにする。構造がそろっていることを獲得確率や無条件ヒントの根拠にしない。

再生成・検証コマンド：

```bash
node poc/tools/build_candidate_chain_stage_audit.cjs
node poc/tools/build_candidate_chain_stage_audit.cjs --verify
```

既存の出力ファイルを上書きしない。保存されたDBと分類台帳をSHAで照合し、再構築した完全な数値監査オブジェクトとの一致を要求する。通常CIで毎回全件検証する。

**次に必要な独立証拠**：2026年同時期のイベント数値マスターまたは実ゲームから、イベントID・段階、各選択肢の次段階への進行／打ち切り、成功等の結果別ヒントIDとLvを確認する。それがそろい、第三者由来データの利用条件もクリアしたレコードだけ `reviewed_events.v1.json` と既存の公開ゲートへ入れる。
