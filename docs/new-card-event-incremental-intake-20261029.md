# 新規サポカだけを既存イベントDBへ増分追加する更新境界（2026-10-29）

## 利用者が確定した目標

**既存ウマサルタントDBをGameToraで再取得・全件差し替えしない。** 新たなサポートカードがUmaSimに追加されたとき、その**新カードのイベントだけ**GameTora本体から抽出・汎用変換し、カードIDをキーに既存DBへ追記する。過去カードのイベント・取得済みスキル・ユーザーのデッキ設定を変更しない。

技術入力の区分は次のとおり。

1. **前後のUmaSim `support_card.txt`**：実アプリの `live_loader.parseSupportCards` で**両方の全カードと5解放段階**を検証して新規IDを動的に抽出。新旧の途中欠損を削除と解釈してはならない。現在の新カードIDや対象SSRカード名をソースに固定しない。
2. **新IDのGameTora本体のイベント**：元サイトに表示されている**当該新カードのイベントだけ**を取得する。各イベントの結果位置、排他的OR、数値増減、スキルヒント／直接付与・明示の連続内部停止／依存を、[前工程の結果別抽出](official-gametora-new-card-unified-live-20261029.md)と今後の共通アプリ用変換器で解釈。結果名をGameWithに照合する必要はない。結果は「結果1」「結果2」でよい。
3. **既存イベントDB**：現在の `poc/data/reviewed_events.v1.json` の既存レコードと順序をそのまま維持する。既存イベントと承認台帳を更新・再計算して置き換える方式ではない。
4. **全件検証に成功した新カードだけ**：アプリのイベントスキーマと通常の数値スキル辞書照合、出典と公開の既存ゲートを通過した新カードだけ、追記できる。一部未解析のカードを「報酬なし」と見なしたり、既存カードを置換したりしない。

## 今回実装したもの

`poc/src/new_card_event_incremental.cjs`

- `discoverNewCardsFromUmaSim`：前後の**完全な**UmaSimサポカ元テキストを実アプリと同じパーサで読み、追加カードIDのリストを返す。既存カードを削除したような壊れた名簿は受け付けない。
- `stageNewCardEvents`：その追加カードIDのGameTora-only変換済み候補だけを受ける。未取得 `not-yet-fetched`、イベント数が揃っていない `gametora-source-unresolved`、正しい形式での候補 `ready` を分ける。既存DB内容を読み替えず、計画には既存カタログの**SHA-256だけ**を記録する。
- `appendApprovedNewCards`：**新カードの全イベントが抽出済み**であり、アプリの実 `public_event_catalog.preflight`（必要に応じて `skill_data.txt` 数値ID辞書照合）と `event_release_gate.verifyRelease`（公開する各イベントの個別承認SHA・6項目と再利用根拠）がすべて成功した場合だけ、元のカード列／承認証跡の**末尾に追加**した新カタログを返す。二重追加・旧カード上書き・未承認・欠落・数値スキルID不一致は拒否し、**入力ファイルを一切書き換えない**。複数新カードのうち検査・承認済みのカードは個別に追加可能で、未取得・未解決の新カードだけを保留台帳へ返す。既存カードは変更しない。

`poc/tools/plan_new_card_event_intake.cjs` は、元サポカテキストを一時ファイルで受け取り、**今回必要となるカードIDと未取得状況だけ**を標準出力に返す、ブラウザや本番DBを変更しないCLI。

```sh
node poc/tools/plan_new_card_event_intake.cjs \
  /tmp/old-support_card.txt /tmp/current-support_card.txt \
  poc/data/reviewed_events.v1.json \
  /tmp/gametora-only-new-card-candidates.json
```

次回も追跡する未公開カードIDは、`{"pendingCardIds":["30322"]}` のような**保留台帳**に保持して、CLIの第5引数に渡せる。CLIは `carryForwardPendingIds` を出力するが、これは「元サイトの取得準備はできたが公開DBへの追記はまだ」というカードも含む。**追記が実際に既存DBに反映されるまで保留から外さない**。将来の自動ジョブではこの台帳の読み書き・次回繰り越しを接続する必要がある。

最後の引数は省略可能。その場合は新カードが存在していても**未取得と報告**する。入力候補は `{"cards":[...]} ` 形式で、各カードは `source:"GameTora-original-site"`、`cardId`、`siteEventPanelCount`、`convertedEventCount`、`unresolvedEventCount`、`events[]` と既存の非公開フラグを持つ。これは**正規化を完了した候補を受け取る接続口**であり、元サイトのHTMLをこのCLIが取得・パースするものではない。

## 合格条件と現在の限界

- **A（機構）**：合成試験で、500→501枚の実UmaSimテキスト形式、2枚の新カード追加、結果1／結果2の獲得Lv差、旧カード順序・承認証跡の完全保持、同一名簿での再実行冪等性、未取得／部分抽出／他カード混入／辞書不一致／承認SHA改ざん時の無変更を検証。さらに**翌日差分0からの保留再試行、別新カードの先行追加、旧固定ピンの再通知による二重登録防止**をテスト。通常CIへ接続。
- **B（データ）**：元GameTora本体で確認済みの[SSR30322・30323の結果統合](official-gametora-new-card-unified-live-20261029.md)は利用可能な前段技術だが、この新しい増分追加処理へ**実際の全イベントを変換した登録候補として接続する作業は未実施**。既存のイベント本番JSONへ新レコードを追加していない。
- **C（実環境）**：通常CIのNodeテストと既存ブラウザ回帰。実物のGameTora新カードをサイトから自動取得して新規DBへ公開する運用や、利用者の物理端末は今回未検証。

**残る重要工程**：GameToraの未知の**任意の新カード**をカードIDから安全に選択して取得する方法（掲載URL・取得規約・制限）を確立し、イベントパネル全件を`event-schema.v1`形式へ共通変換する処理に接続する。その後、既に承認条件を満たした新カードだけを**既存JSONと承認台帳の両ファイルを一つのGitコミットで原子的に追記する**継続更新ジョブへ結合する。元サイト取得不能・未掲載時は次回へ保留し、既存DBに影響させない。未承認の第三者の表現を自動公開する仕組みは作らない。

これにより、**新カードを検知しただけで自動イベント公開できると誤認しないこと**と、元サイト変換器が完成した際に既存データを壊さず接続できることを両立する。既存公開イベント数0件は変更していない。


## 2026-10-29：任意新カードのGameTora掲載URL照合と最大2カード限定読取

前段はSSR30322/30323の固定URLだけが対象だった。今回は `poc/src/official_gametora_new_card_locator.cjs` と `poc/tools/probe_official_gametora_target_cards.cjs` を追加し、**任意の新カードIDを元サイトの一覧上のリンクで発見**して既存の `extractRoutePieces → assembleLiveEvent → projectNewCardSite` に渡す、別の読み取り専用経路を用意した。

- 入力は `plan_new_card_event_intake.cjs` が出す最新の **未公開・未取込** `NEW_CARD_EVENT_INTAKE_PLAN=` 行、または同等のJSON。名簿で増えたIDも翌日からの保留IDも対象。既存DBに収録済みのIDは除外し、**1回最大2カード**、残余は `unvisitedCardIds` に残す。前回「ready」でも正式追記が済まなければ保留を解消しない。
- GameToraの **1枚の一覧ページ** `/ja/umamusume/supports` に表示された詳細リンクだけを使う。カードIDに似たURLを推測したり、入力から任意URLを直接訪問したりしない。同一IDに異なるリンクがあれば停止。未掲載なら `not-listed-yet` として保留し、未抽出を報酬ゼロ扱いしない。
- `robots.txt` と取得制限応答を確認し、一覧＋選択された最大2枚だけをPlaywright Chromeで訪問。HTTP/URL・ドメイン・20イベントパネル上限を検査し、欠損・超過時は完了扱いしない。1回の実行で新カードの全データを自動公開するものではない。
- 各カードの表示イベントを四系統で結果別統合し、**独立固定UmaSimスキル辞書のblob SHAを確認した上で**、スキーマ形の**非公開**概要だけを出力する。HTML・選択肢原文・画像・未承認のイベントJSONはディスク、ログ、正式カタログに出さない。結果が得られても、承認済みDBへの追加件数は**0件**のまま。実稼働の継続スケジュール、保留ファイル書込、公開審査・原子コミットは未接続。

手動検証用コマンド（元サイト閲覧は明示 `--live` のときのみ）：

```sh
node poc/tools/plan_new_card_event_intake.cjs \
  /tmp/previous-support_card.txt /tmp/current-support_card.txt \
  poc/data/reviewed_events.v1.json > /tmp/new-card-plan.txt

# 次のファイルは固定スキル辞書の正しいGit blob版を事前に用意する。
node poc/tools/probe_official_gametora_target_cards.cjs \
  --live --plan /tmp/new-card-plan.txt --skills /tmp/pinned-skill_data.txt
```

**A（機構）**：ID保留・上限・悪性URL拒否・同一IDの異URL衝突・未掲載維持の合成テストをCIへ接続。**B（限定実データ）／C（実Chrome）**：[新しい汎用CLIの実サイトActions #40813210929](https://github.com/Nimrodx0/Umasupport/actions/runs/40813210929)で、GameTora一覧からSSR30322／30323のURLを発見して実際に訪問し、**18パネル／16候補イベント／27結果経路／数値108行／ヒント18件／進行表示2件**を元の2カード専用抽出と同数で再現。SSR30322は6パネル中5件・13結果、SSR30323は12パネル中11件・14結果。両カード各1件は結果表示なしで保留。さらに本PRの限定Chromeワークフローは件数と公開禁止フラグの固定回帰を検査する。これは**既知の2カードに限った元サイト実証**であり、任意の今後の新カード、結果意味のゲーム内確認、Windows／Android端末を検証したわけではない。新カードの**全報酬、ゲーム内選択肢と表示グループの対応、内部継続分岐、再利用権利**が未確認である点も不変。
