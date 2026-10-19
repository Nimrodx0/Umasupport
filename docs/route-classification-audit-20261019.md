# 全2,109イベント候補の経路状態分類（2026-10-19）

## 目的と公開境界

PR #100で保存した `poc/data/candidates/checker_event_hints.v1.json`（SSR/SR 417枚、イベント候補2,109件）を、**イベントごとに一件も漏らさず**次の3状態で管理する。

| 状態 | 判定の根拠 | 本番への投入 |
| --- | --- | --- |
| `verified-route`（経路まで検証済み） | カードの正式ID、実イベントID、到達・連続・打ち切り条件、選択肢、成功／失敗の結果、スキル報酬とLv、公開利用条件まで独立に承認 | 既存 `event_release_gate.cjs` の承認証跡が必要 |
| `needs-review`（追加確認が必要） | 候補は存在しているが、上記のうち一つ以上の確認が欠ける | 不可 |
| `source-gap`（ソースに欠損あり） | 採用候補ファイル側にイベントが空などの明確な欠損がある。**実ゲームにイベントが無いという意味ではない** | 不可 |

これらのうち、現時点のChecker候補イベント2,109件について、イベントごとの**経路全体をゲーム側・権利面まで承認したものは0件**。全2,109件を `needs-review` とすることが正しい。これを「2,109件の入力作業が残る」と混同せず、旧マスターとの数値ID仮照合を一括実行して、どこから検証すべきかを具体化する。

`source-gap` は主に**カード単位**の状態。Checkerでイベント空配列のカードは `sourceRecordStatus:source-gap` を持つ。これらについて候補イベントレコード自体が存在しないため、イベント2,109件の分母に架空レコードを追加しない。

## 古いゲームマスターとの一括照合

[固定2025-10-10マスター](https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB/tree/5a8ec1356859a35e245edef0d40da740e652df68/master) の `single_mode_story_data` と `text_data(category=181)` で、カード直結のストーリーIDとイベント見出しから**実行時メモリだけでNFKC等を正規化したSHA-256**を導く。Checkerの元記事見出しやマスターの文章はレポジトリへ保存しない。

イベント候補との照合は、同じUmaSimカードID内で次のように分ける。

- `strict-unique`：候補にもマスターにも、厳密正規化見出しがそれぞれ一件だけ存在する。古い `provisionalStoryId` とマスター側の数値メタデータを**仮の照合結果として**保存する。正式な2026年ゲームID対応や経路検証ではない。
- `typography-suggestion`：句読点などの違いを無視すればそれぞれ1件だけ一致。イベントIDを確定せず `possibleStoryId` のみ保存。
- `ambiguous`：同名が複数あり、数値IDの一意な結合ができない。
- `no-match`：旧版の同カードに厳密・緩い一致なし。2026年新規イベント／単なる表記変更／粒度差などを含む。
- `not-in-2025-master`：該当カードが旧マスター直結に見当たらない。**現行ゲームで存在しない**の意味ではない。

旧マスター直結でCheckerに一対一の厳密一致がないIDは `historicalPossibleGaps` に記録し、常に `confirmedMissingIn2026:false` とする。古いゲームタイトル差・別名・共通キャラ関連・時代差を欠損確定として扱わない。

## 保存先・コマンド

- 生成先：`poc/data/candidates/checker_route_classification.v1.json`
- 一括分類器：`poc/tools/classify_candidate_event_routes.py`
- 一時fingerprint生成：`poc/tools/build_checker_fingerprint_inventory.cjs`
- 厳格照合：`poc/src/route_classification_verify.cjs` と `poc/tools/verify_route_classification.cjs`
- 実データ限定検証：`.github/workflows/classify-checker-route-coverage.yml`
- 人工データ異常・一意性テスト：`poc/tests/test_classify_candidate_event_routes.py`

元Checkerは `8cf9fcb3cc7239041161be75c84daf9f8f22d29f`、旧マスターは `5a8ec1356859a35e245edef0d40da740e652df68`。UmaSimの固定 `support_card.txt` と旧マスターはSHA-256固定、Checkerも**候補DBの登録SHA-256と一致を必須**。GitHub Actionsの一時領域にだけ元JSONとSQLiteを置き、数値IDと理由コードだけの分類結果をGitにコミットする。GameWith.jpへの一括GETは実施しない。

**重要：** 個々のイベントの取得経路は、この分類によって自動的に使用可能にならない。仮のstory IDやヒントLvが一致しても、まだ成功結果、打ち切り条件、依存イベント、現在版の実データを必要とする。`poc/data/reviewed_events.v1.json` は引き続き独立の本番用DBとして扱い、未承認候補を同期しない。

## 次の具体的な作業

仮照合済みIDのあるイベントから、ゲーム内イベントの `chainNum`・到達条件・成功／大成功／失敗の分岐・報酬スキルIDを別証拠で照合する。確認できたものだけを公開承認台帳へ追加する。空のカードや旧マスターにのみ出現するstory IDについては、候補を増やす前に現行ゲーム側の同時期資料を調べる。

自動分類はレビュー作業を**絞るための索引**であり、過剰に「経路まで検証済み」と宣言するための装置ではない。
