# 開発支援AI向け引き継ぎメモ

1. **最初に** `README.md`、`docs/requirements.md`、`docs/development-history.md`、`docs/roadmap.md` を読む。
2. 現状は**PoC v8.1**。React/TypeScript/Viteは将来案であり、現在実装済みと勘違いしない。
3. 仕様変更時は `docs/requirements.md` と `docs/decisions.md` を更新する。開発上の重要事実は `docs/development-history.md` に追加する。
4. ゲームデータが未収録な場合は「ヒントなし」「獲得不可」と断定しない。出典、データ版、欠損状況を区別する。
5. ゲーム内IDを優先し、表記が似ているだけでカードを自動統合しない。レビュー済みのエイリアス表と回帰テストを使う。
6. イベント分岐の結果、成功率、スキルの上位・下位関係を推測で埋めない。
7. 既存デッキのユーザー設定を壊すID変更を行わない。必要ならマイグレーションを付ける。
8. サポカ検索・スキル集計の利用者向け更新ボタンは作らない。**ゲームデータは起動時に公開元から直接取得・検証し、IndexedDBにキャッシュ**する。ビルド同梱方針は2026-10-16に変更。
9. 出典・再配布条件未確認のゲームデータ、攻略テキスト、画像をPublicリポジトリに勝手に追加しない。
10. 可能な範囲で自動テストとブラウザ操作テストを実行し、未実施項目を明示する。
11. 実装コードは `poc/src/`、Python変換は `poc/tools/`、テストは `poc/tests/`。必ず `poc/README.md` を読む。
12. `poc/demo.html` は架空カードで動く公開可能なデモ。実データ版v8.1と混同しない。
13. 最低限の検証コマンドは `node --test poc/tests/core.test.js poc/tests/stage.test.cjs`。legacy配下のテストは未公開の実データ入力が必要。
14. 最新データ方式は `poc/live.html` と `poc/src/live_loader.js`（通常ヒントのみ・移行中）。`docs/runtime-data-loading.md` を読む。旧データ同梱v8.1の実HTMLは公開していない。実ブラウザ検証・イベントの取得方式は未完了。

15. `poc/live.html` の起動にはインターネットが必要（初回）。`poc/demo.html` はオフラインの架空デモ。混同しない。
