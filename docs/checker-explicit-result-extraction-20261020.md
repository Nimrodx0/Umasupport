# Phase 2：全2,109候補の結果別一括抽出（2026-10-20）

## 完了した一括抽出

固定Checkerコミット 8cf9fcb3cc7239041161be75c84daf9f8f22d29f を参照し、既存の417枚・2,109イベント候補・3,458選択肢と元の位置・スキル記載を全件突合した。元の効果文、選択肢原文、見出し、画像は新DBへ含めない。

| データ項目 | 件数 |
| --- | ---: |
| カード（SSR/SR） | 417 |
| イベント候補 | 2,109 |
| 選択肢位置 | 3,458 |
| 明示結果見出しを複数分離した選択肢 | 203 |
| 分離した結果レコード | 411 |
| 明示結果を含むイベント | 179 |
| 結果未分離の選択肢 | 3,255 |
| 元資料に終了が明示された選択肢・結果 | 73 |
| ヒント数値ID・Lv | 1,406 |
| 数値ID未解決のヒント記載 | 98 |
| Lv範囲表記の選択肢 | 4 |

結果が明記された報酬を成功・大成功・失敗・通常に分け、報酬のLv差を保存。結果未分離なら unspecified のまま保持。Lv範囲は levelMin/levelMax を使用し、単一Lvに確定しない。

## 生成ファイル

- poc/data/candidates/checker_explicit_result_facts.v1.json
- poc/data/candidates/checker_explicit_result_review_queue.v1.json
- poc/src/checker_explicit_result_extract.cjs と poc/src/checker_result_review_queue.cjs

### 新レビュー優先度

| 優先度 | イベント数 | 意味 |
| --- | ---: | --- |
| P0 | 185 | 結果別報酬差、連続終了記載、前段結果依存 |
| P1 | 177 | 解析不能の結果表記、ヒントID未解決、Lv範囲等 |
| P2 | 1,747 | ソースに候補があるが、連続到達関係・全件性は未確認 |

全2,109イベントに CHAIN_TOPOLOGY_UNVERIFIED を明示し、forSkillGrant:false、routeReviewRequired:true を保持。P2は完成の意味ではない。今回のデータは元資料の明示ラベルを独自構造化した未承認候補で、2026年の実ゲーム結果数と打ち切り・連続経路を独立確認していない。terminalObserved:true を公開アプリの terminal:true へ自動接続しない。公開承認イベント0件を維持。

## 検証

通常CIは外部HTTP取得をせず、node poc/tools/verify_checker_result_facts.cjs --verify によって全件のID、ヒントLv多重集合、データの非承認状態、レビューキューの優先度を再構築して検証する。

明示的に元資料から再抽出する場合だけ、GitHub Actionsの手動ワークフロー Verify pinned Checker result extraction (manual) を実行する。固定GitHubコミットの3資料を一時取得してSHAを照合し、生成JSONとのバイト一致を検査する。GameWith.jpの一括GETは行わない。

今後は結果分岐を既存の旧story ID段階照合と接続し、GameWith・Wiki等の独立資料からP0の打ち切り／後続分岐を優先検証する。R146枚・全カード期待イベント一覧の独立照合と実機検証は未達。

## 優先レビューの旧story ID仮照合

レビューキューのsourceKeyを既存563枚索引へ全件突合。P0の185イベントのうち、2025年旧ゲームマスターに厳密仮一致165、表記差候補6、未対応14。P1は厳密96、表記差2、その他79。P2は厳密693、表記差21、その他1,033。

node poc/tools/query_checker_result_review.cjs --summary
node poc/tools/query_checker_result_review.cjs --priority P0 --limit 30
node poc/tools/query_checker_result_review.cjs 30003

この照合は2025年版に限定。現行ゲーム正式ID、結果条件、イベント継続を承認する証拠ではない。

## Phase 2④：最初の複数出版社による実経路照合（2026-10-20）

CheckerのP0イベントからカード30001・30007・30026を選び、Game8とU-tools、それに30001ではGameWithを人手で照合。元のイベント文章や効果文章を保存しない独自の条件レコードを poc/data/candidates/editorial_branch_crosscheck.v1.json に追加した。

| カードID | 監査した遷移元 | 対応する分岐数 |
| --- | --- | ---: |
| 30001 | 連続2（継続／終了） | 2 |
| 30007 | 連続2（継続／終了） | 2 |
| 30026 | 連続1・2（上選択の成功／失敗、下選択終了） | 6 |
| **合計** | **4イベント** | **10** |

結果に応じた報酬事実8件も数値スキルID・Lvで照合。ツインターボの連続2段階・下選択には、Checker側に記載されたランダムなスキルヒントが別2サイトの記事の選択肢表に出ない差異がある。連続3段階・下選択にも資料間でヒントLv差がある。これら2選択肢の報酬は **未承認としてゼロ件の照合済み報酬** とし、欠損を埋める推測は禁止。

出典リンク：
- 30001: https://game8.jp/umamusume/372298 と https://xn--gck1f423k.xn--1bvt37a.tools/supports/30001/event
- 30007: https://game8.jp/umamusume/372303 と https://xn--gck1f423k.xn--1bvt37a.tools/supports/30007/event
- 30026: https://game8.jp/umamusume/375510 と https://xn--gck1f423k.xn--1bvt37a.tools/supports/30026/event

異なる出版社のページで一致することは、データ採録経路の完全な独立性や2026年実機の再現性を保証しない。実機検証が終わるまでactualGamePlayVerified:false／publicationApproval:false。先行イベント結果が未選択の場合、下流は条件付きとし、失敗／終了なら下流の報酬を遮断する。

検証：node --test poc/tests/editorial_branch_crosscheck.test.cjs。レビューモデルは poc/src/editorial_branch_crosscheck.cjs の auditFixture 関数だけから取得でき、正式イベントカタログには結合していない。出典指紋・全分岐の対応・数値IDとLv・出版社URL・不一致報酬の未承認を検査し、実際の core.reachability と directRoutes に全10経路を適用。

同時に core.reachability と event_schema.js で同一前段イベントに排他的な結果条件をAND指定したとき blocked／検証拒否とするガードを追加した。
