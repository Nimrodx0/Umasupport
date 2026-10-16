# 開発支援AI向け引き継ぎメモ

1. **最初に** `README.md`、`docs/requirements.md`、`docs/development-history.md`、`docs/roadmap.md` を読む。
2. 現状は**PoC v8.1**。React/TypeScript/Viteは将来案であり、現在実装済みと勘違いしない。
3. 仕様変更時は `docs/requirements.md` と `docs/decisions.md` を更新する。開発上の重要事実は `docs/development-history.md` に追加する。
4. ゲームデータが未収録な場合は「ヒントなし」「獲得不可」と断定しない。出典、データ版、欠損状況を区別する。
5. ゲーム内IDを優先し、表記が似ているだけでカードを自動統合しない。レビュー済みのエイリアス表と回帰テストを使う。
6. イベント分岐の結果、成功率、スキルの上位・下位関係を推測で埋めない。
7. 一般ユーザー不在の開発段階では、旧ユーザー保存設定のID互換・旧スキーマ互換を維持しない。変更時は開発用設定を初期化してよい。ゲームデータの実ID照合は別途正確に行う。
8. サポカ検索・スキル集計の利用者向け更新ボタンは作らない。**ゲームデータは起動時に公開元から直接取得・検証し、IndexedDBにキャッシュ**する。ビルド同梱方針は2026-10-16に変更。
9. 出典・再配布条件未確認のゲームデータ、攻略テキスト、画像をPublicリポジトリに勝手に追加しない。
10. 可能な範囲で自動テストとブラウザ操作テストを実行し、未実施項目を明示する。
11. 実装コードは `poc/src/`、Python変換は `poc/tools/`、テストは `poc/tests/`。必ず `poc/README.md` を読む。
12. `poc/demo.html` は架空カードで動く公開可能なデモ。実データ版v8.1と混同しない。
13. 最低限の検証コマンドは `node --test poc/tests/core.test.js poc/tests/stage.test.cjs poc/tests/runtime.test.cjs poc/tests/settings.test.cjs`。legacy配下のテストは未公開の実データ入力が必要。
14. 最新データ方式は `poc/live.html` と `poc/src/live_loader.js`（通常ヒントのみ・移行中）。`docs/runtime-data-loading.md` を読む。旧データ同梱v8.1の実HTMLは公開していない。Pages通常起動・公開元データ読込・表示は2026-10-16にユーザー確認済み。IndexedDB保存内容・オフライン復旧の実機検証とイベント取得方式は未完了。

15. `poc/live.html` の起動にはインターネットが必要（初回）。`poc/demo.html` はオフラインの架空デモ。混同しない。

16. `poc/src/settings.js` は設定形式と現在のカード・スキルIDのみ検証する。旧ID移行・未知ID保持・復旧用バックアップは不要。読み込めなければエラー画面で確認付き初期化を案内し、確認まで保存値を上書きしない。
17. CIテストとPages公開は2026-10-16のmainで成功済み。「CI未設定・ブラウザ未検証」という古い記述より最新実行記録を優先。
18. イベントモデルを変更する場合は `docs/event-schema.md` と `poc/src/event_schema.js` の検証処理を参照する。第三者イベントはまだ公開版未収録。GameWith等の由来データを権利確認前に同梱しない。入力カタログの件数をゲーム内の網羅率と混同しない。
19. `docs/event-source-audit.md` は実ソースの照合結果。45枚のカードID・名称一致は確認したがイベントの到達条件やスキルID対応は未検証。`poc/src/event_source_audit.js` は読み取り専用監査、`poc/src/event_review_compiler.js` は各イベントの `chainVerified:true` と `rewardSemanticsVerified:true`、承認済みのスキル対応を要求。未レビューイベントの公開版自動導入は禁止。
20. 2026-10-16 IndexedDB保存・データ取得先遮断時復旧・再取得の実ブラウザ検証は3項目成功。アプリ本体の完全オフライン起動は未検証。

21. 大規模イベントソースの全件測定は `docs/event-source-selection.md` にある（2026-10-16に466カード見出し、1,403イベント、UmaSimとの名前＋レアリティ一致442/563）。この値をゲーム内ID一致やイベント網羅率と称さない。調査には `poc/tools/audit_cruise_source.cjs` を使う。サポカ実イベントの自動統合は未許可。


22. 2026-10-16のUmaUmaChecker照合（docs/event-source-selection.md）ではSSR・SRカード417件、イベントあり412件、5件空。残る24件は表記差候補だがゲーム内ID未検証。イベント全件収録やID一致を宣言しない。

23. `poc/src/event_gap_audit.js` はSSR・SRイベントのソース間タイトル差分をカード単位で抽出するが、差分をゲーム内実イベントの確定的な未収録と呼ばない。2026-10-16時点でCruiseのみ11件／11枚。U-toolsはカードID別連続・ランダムイベントの検証候補だが、サイト上での公開はスクレイピング・再利用許可を意味しない。


24. U-toolsの技術・利用条件の評価は `docs/utools-source-evaluation.md`。GitHub Actionsからの自動GETは30302で403（Cloudflare challenge）、30164で200かつCORS `*` と混在した。保護回避や大量の自動収集を行わず、公式のデータ提供手段と第三者アプリ利用許可を確認するまでは本番接続しない。

25. **最新決定（2026-10-16）：** U-toolsは当面使わない。SSR・SRの初期収録候補UmaUmaCheckerからウマサルタント独自形式を作り、不足・新規はGameWithの当該カード記事を参照。イベントDBはGitHub Pagesに公開するが、GameWith等の元イベント全文を無検証で複製しない。docs/checker-public-catalog.md参照。src/checker_candidate_pipeline.cjsは名前厳密一致／明示エイリアス、sourceDigest、同名イベント識別を扱う。公開DBへの変換は分岐・報酬・公開可否の個別レビューを要求。公開済み実イベントは0件。
