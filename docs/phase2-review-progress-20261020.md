# Phase 2④：全候補進捗台帳（2026-10-20）

Phase 2の「資料で裏付けられた分岐」と「現行ゲームで検証済み」を分離する、読み取り専用の進捗台帳を追加。

- `poc/src/phase2_review_progress.cjs`：既存レビューキュー2,109件・563枚索引・出版社横断監査を全件結合
- `poc/tools/report_phase2_review_progress.cjs`：`--summary`、`--priority P0`、`--card 30026`、`--status publisher-corroborated`、`--limit 30`
- `poc/tests/phase2_review_progress.test.cjs`：全件母数、出典変更、未承認境界の回帰

全563カードのうちChecker候補は417カード、2,109イベント。別出版社で遷移関係を照合したのは**3枚の4イベント・10枝**、独自数値報酬照合8件、出版社間で未解決の選択肢報酬差2件。残りのイベントはほぼ未着手であり、全件一致や実ゲーム裏付け済みと解釈してはならない。

`publisher-corroborated` は複数出版社による記載の整合のみ。すべてのイベントで `routeVerifiedInGame:false`、`approvedForProduction:false`、`publicationApproval:false` を維持し、配信DBへの自動接続を一切行わない。全件の母数と厳格なP0レビューをCIで継続検証する。

次のレビューはP0の残件と、差異がある30026カードの選択肢から確認。ソース元のデータ来歴と最新版ゲームマスター、表現再利用条件の確認は依然別ゲート。

## 2026-10-20追補：SSR30103の累積成功判定を監査

SSR30103「マチタン☆アドベンチャー」の連続1・2・3段階を、公開されたファミ通・電撃オンライン・U-toolsの報酬表で照合。最終段の報酬は前2段の結果に従い、成功/成功→アガッてきた！ Lv3、成功/失敗と失敗/成功→Lv2、失敗/失敗→Lv1。連続1と2は失敗しても次段へ続く。各記事で一致した事実のみ `poc/data/candidates/editorial_cumulative_result_30103.v1.json` に保存し、ゲーム実機の最終検証と公開承認は引き続き未完。

主な複数資料（編集後の原文をGitに収録しない）：
- https://www.famitsu.com/news/202206/29266681.html
- https://dengekionline.com/articles/138788/
- https://xn--gck1f423k.xn--1bvt37a.tools/supports/30103/event

第3段の各結果に OR-of-AND 型の前提条件 `{any:[{all:[...]},...]}` を追加。イベント/選択式全体の既存 AND 前提はそのまま維持。`event_schema.js` は矛盾・無効な親ID・自己参照・循環を拒否し、`core.outcomeReachability` は前段結果の未確定・一致・不一致に応じて conditional/reachable/blocked を返す。`core.directRoutes` は不可能な報酬を除外、`live_app.js` は到達不能な結果選択をdisabledとする。過去の選択変更時に結果依存子も解除する。

固定UmaSim辞書の「差し焦り」は数値ID未解決であり、第2段の成功報酬は資料には存在するが **数値IDを推測して集計しない**。監査ケースに採録した数値ヒントは4記載、未解決1記載。P0照合イベントは従来4件に新たな3件を加え7件、資料で確認した選択/結果分岐は10+7=17件、数値報酬照合は8+4=12記載。出版社間の既存不一致2選択肢は維持。**現行ゲーム実機で検証済み0件・本番公開0件**。

検証 `node --test poc/tests/editorial_cumulative_result_30103.test.cjs` と既存の全コアCI。`node poc/tools/report_phase2_review_progress.cjs --summary` は3件を加えた全2,109候補の進捗を表示する。
