# GameWith正本によるイベント網羅・通常継続の採用規則（2026-10-21）

## 決定

**カード別のイベント一覧、選択肢、結果分岐、スキル報酬、連続イベントの到達条件に関する編集上の正本をGameWithに統一する。** 既存の「効果数値が割れた際はGameWithを暫定優先」という規則を拡張した。GameTora、UmaUmaChecker、Game8、旧2025年マスター、Wikiは**欠損・異表記・例外発見と補助調査**に使い、異なる記載を見つけただけでGameWith基準の全体処理を停止しない。

この「正本」は**プロジェクト内で値を決定するための参照基準**であり、Cygames公式の現在仕様、現行全イベント網羅、情報源の独立性、データ再配布や大量取得の許可を意味しない。

## 無記載の解釈

攻略記事は特記事項がある場合に途中終了などを明記することが多いため、**GameWithのカード記事に連続イベント・選択肢・結果が完全に掲載されており、各分岐の例外欄を確認済み**なら、非最終段階の**明示終了のない選択／結果**をそのカードの**通常継続**として採用する。

これは **`GameWith editorial default`（攻略情報の編集規約に基づく採用）** であって **`live gameplay verified`（ゲーム実測）** ではない。「マーカーのないGameToraのJSON」や「CheckerのEffect欄が空欄」をGameWith本文の無記載と同一視しない。

| 状況 | 解釈 |
| --- | --- |
| GameWithの記事全体、イベント段階・選択肢・結果・特記事項を確認した。終了記述なし | 非最終段階は **通常継続** |
| 記載された途中終了 | 明示的な `terminal` |
| 特定の失敗結果だけ途中終了 | その `outcome.terminal` のみ `true` |
| 前段の成功数に応じて報酬だけ変化 | 報酬の条件であり、イベント出現条件にしない |
| 通常と異なる進行条件・複数の後続 | 個別審査。線形通常継続で上書きしない |
| 記事全体未取得、イベント一覧が「調査中」、選択肢／結果の一部不明 | **採用保留**（勝手に継続へ補完しない） |
| GameWithにないイベントが他資料だけにある | 欠損調査の例外キューへ、GameWith内容として偽装しない |

**最終段階には通常の後続イベントを作らない。** 自明な「連続イベントが完了する」という意味と、途中打ち切りフラグの意味を混同しない。

## 実装した査読→暫定グラフ化

- 設定：`poc/config/event-source-priority.v1.json`。GameWithを5種類の情報の優先資料に設定し、全自動公開は禁止する。
- 審査変換器：`poc/src/gamewith_chain_adoption.cjs` の `applyGameWithChainReview()`。
- 手動入力からのローカル草稿生成：`poc/tools/prepare_gamewith_chain_draft.cjs`。**GameWithへの通信は一切行わない。** `local-data/` 内の未承認草稿にしか書き出せない。
- 回帰：`poc/tests/gamewith_chain_adoption.test.cjs`（通常継続／成功・失敗別終了／途中終了／選択解除／スキーマ検証／悪意のある不完全レビュー／資料URLすり替え／特殊条件保持）。

入力には必ず `source:'GameWith'`、個別記事の正規URL、確認日、記事内容SHA-256、レビュー担当者、記事のイベント欄・全段階・全選択肢・全結果・全特記事項を確かめたという**5項目の明示記録**、カードIDと確定したイベントID対応、順番を持つ各連続段階、選択肢と結果の全ID、途中終了の例外だけを書く。単純な文言無しを自動解釈する前に、**記事の該当欄が完全だったという査読行為**を必要とする。

不完全な記事・欠けた段階・選択肢数／結果数の不一致・既存の別の到達条件・例外の重複はエラーで止める。これにより、**GameWithの無記載と抽出プログラムがデータを落としたこと**を分ける。複雑な特殊条件は通常継続を適用せず別の専門レビューを要求する。

### ローカル入力の最小例（架空データ）

以下は**実サポカとは無関係のサンプル構造**。入力ファイルには同カードの`events`配列（スキル・名称は権利条件に沿って別途レビューした独自表現）も含める。

~~~json
{
  "schemaVersion": 1,
  "cardId": "00000",
  "review": {
    "schemaVersion": 1,
    "cardId": "00000",
    "source": "GameWith",
    "articleUrl": "https://gamewith.jp/uma-musume/article/show/123",
    "articleSha256": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "reviewedAt": "2026-10-21",
    "reviewer": "human-reviewer",
    "coverage": {
      "articleSectionStatus": "complete",
      "allEventHeadingsReviewed": true,
      "allStageOrderReviewed": true,
      "allChoicesReviewed": true,
      "allResultsReviewed": true,
      "allExceptionsReviewed": true
    },
    "chains": [{
      "chainKey": "sample-chain",
      "stages": [
        {
          "eventId": "sample-1",
          "stageNumber": 1,
          "choices": [
            {"choiceId": "a", "outcomeIds": ["success", "failure"]},
            {"choiceId": "b", "outcomeIds": []}
          ],
          "exceptions": [
            {"kind": "terminal", "choiceId": "a", "outcomeId": "failure"}
          ]
        },
        {
          "eventId": "sample-2",
          "stageNumber": 2,
          "choices": [{"choiceId": "c", "outcomeIds": []}],
          "exceptions": []
        }
      ]
    }]
  },
  "events": [
    {
      "id": "sample-1",
      "name": "架空の第一段階",
      "type": "choice",
      "choices": [
        {"id": "a", "label": "A", "outcomes": [
          {"id": "success", "label": "成功", "rewards": []},
          {"id": "failure", "label": "失敗", "rewards": []}
        ]},
        {"id": "b", "label": "B", "rewards": []}
      ]
    },
    {
      "id": "sample-2",
      "name": "架空の第二段階",
      "type": "choice",
      "choices": [{"id": "c", "label": "C", "rewards": []}]
    }
  ]
}
~~~

~~~sh
node poc/tools/prepare_gamewith_chain_draft.cjs \
  local-data/card-review.json \
  local-data/card-chain-draft.json
~~~

結果は `events`（既存`requires`/`terminal`/`outcomes[].terminal` に対応する暫定グラフ）と、`gameVerified:false`、`publicationApproved:false` の審査集計。**直接 `poc/data/reviewed_events.v1.json` へ書き出したり、公開承認を偽装しない。**

### 既存のオフラインGameWith記事インポーターからの接続

既に実装済みの`poc/tools/import_gamewith_article.py`および`batch_gamewith_import.py`は、合法・正当に用意されたローカル記事から、連続イベント候補を`manualCandidates`として生成できる。今回の草稿変換器は**同インポーターの出力をそのまま`importerProposal`に渡す入口**も用意した。

- `manualCandidates`内の連続イベントは、種別・連番・選択肢が正常解析できたものだけを仮IDへ正規化する。報酬の未解決項目は自動で削除しない。
- レビュー記録`review.chains[].stages[].eventId`は、`draft_<cardId>_chain_01`など、インポーターが生成した同一IDに対応させる。これがGameWith上の**正式story_idだという意味ではない**。
- 入力総見出し数が合わない、連続段階が欠ける、条件解析に失敗した段階が含まれる場合は拒否する。
- 元記事をパーサーが誤認していないか、記事・イベント欄・分岐・例外を確認した`review.coverage`は引き続き必須。インポーターの出力だけで自動的に記事確認済みとしない。
- 結果はローカル草稿であり、別途スキルID／継続の特殊条件／利用条件／公開ゲートを通さない限り本番へ接続しない。

これにより、既に実装済みの**記事解析 → 候補データ → GameWith正本による通常継続解釈 → 暫定イベントグラフ**を一つのオフラインワークフローに接続できる。全563枚へ展開する際も、記事の大量取得許可とは独立してこの変換器を再利用できる。

## 全カード展開と完了の分母

1. **カード分母：** 対象版の採用全サポカID集合。現行採用版は563枚だが、将来のゲーム全カード枚数を意味しない。
2. **GameWithに載るイベントの全件名寄せ：** カード別イベント一覧・通常/連続・段階番号・選択位置数。元ページの個別確認済み記録をもつもののみGameWithの「無記載」規則を適用する。
3. **GameWithに載らない外部資料のイベント：** 別ソースから独立の欠損検出キューに入れ、「GameWithにはない＝ゲームにもない」と断定しない。
4. **各選択肢・結果の報酬：** GameWith掲載数値を暫定採用。数値ID→スキル辞書の一意対応と版を点検。別サイトとの食い違いはログへ残し、正本採用が技術的に可能な限り全件保留にしない。
5. **特殊進行だけ重点レビュー：** 途中終了・前段成功依存・通常の次段階以外への分岐を重点対象とする。
6. **公開：** 既存の独自公開DBスキーマ、スキルID・権利・選択・結果・依存関係・出典SHA付き公開ゲートを通す。編集上の採用が可能でも再配布や大量クロールが許可されたとはみなさない。

最終的に「GameWith掲載欄への完全対応率」「観測外部資料との残差」「実ゲーム内全イベントの独立分母が確認できたか」は**別々に報告**する。GameWithへ無許可で全件自動アクセスする処理は今回実装していない。既存GameWith由来Checkerは候補取り込み・異常検知として活用できるが、`GameWithの記事の無記載を確認した`との代用にはしない。

## 現在の進捗と次のゲート

**本PRは方針とローカル草稿変換の実装まで。** GameWithの全563カード本文を直接確認し、すべてのイベント・結果位置について例外の無記載を人手・合法な取得方法で記録したわけではない。したがって今回のコードだけで675候補の接続が認証済みになったり、本番イベント数が増えたりはしない。2026年ゲーム実測済み接続0、公開承認済みイベント0を維持する。

次は実カード1枚のGameWith記事について全イベント欄・選択肢・結果・例外を確認し、前後段階のイベントID/スキルIDを合わせ、この暫定グラフから既存`verify_event_release.cjs`まで一続きで通して最初の本番データを作る。元記事を丸ごとコピーしない適切な利用方法と、公開する事実の表現は別のレビューで確定させる。
