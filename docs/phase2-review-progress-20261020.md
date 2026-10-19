# Phase 2④：全候補進捗台帳（2026-10-20）

Phase 2の「資料で裏付けられた分岐」と「現行ゲームで検証済み」を分離する、読み取り専用の進捗台帳を追加。

- `poc/src/phase2_review_progress.cjs`：既存レビューキュー2,109件・563枚索引・出版社横断監査を全件結合
- `poc/tools/report_phase2_review_progress.cjs`：`--summary`、`--priority P0`、`--card 30026`、`--status publisher-corroborated`、`--limit 30`
- `poc/tests/phase2_review_progress.test.cjs`：全件母数、出典変更、未承認境界の回帰

全563カードのうちChecker候補は417カード、2,109イベント。別出版社で遷移関係を照合したのは**3枚の4イベント・10枝**、独自数値報酬照合8件、出版社間で未解決の選択肢報酬差2件。残りのイベントはほぼ未着手であり、全件一致や実ゲーム裏付け済みと解釈してはならない。

`publisher-corroborated` は複数出版社による記載の整合のみ。すべてのイベントで `routeVerifiedInGame:false`、`approvedForProduction:false`、`publicationApproval:false` を維持し、配信DBへの自動接続を一切行わない。全件の母数と厳格なP0レビューをCIで継続検証する。

次のレビューはP0の残件と、差異がある30026カードの選択肢から確認。ソース元のデータ来歴と最新版ゲームマスター、表現再利用条件の確認は依然別ゲート。
