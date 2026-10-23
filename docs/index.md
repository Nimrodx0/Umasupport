# 文書の入口

プロジェクトの一次入口は [README](../README.md)。**この索引と [文書運用規約](documentation-policy.md) は文書の役割を案内するもので、仕様や進捗の正本ではありません。**

| 探したいもの | 正本 |
| --- | --- |
| AIの作業規則・引き継ぎの読み順 | [AGENTS.md](../AGENTS.md) |
| 製品の最終要件と対象外 | [requirements.md](requirements.md) |
| 利用者による確定決定・撤回の履歴 | [decisions.md](decisions.md) |
| 今後の作業順序と完了ゲート | [roadmap.md](roadmap.md) |
| 現在の状況と根拠リンク | [status.md](status.md) |
| 機構・データ・実環境での合否条件 | [verification-plan.md](verification-plan.md) |
| 技術設計 | [architecture.md](architecture.md) / [event-schema.md](event-schema.md) / [runtime-data-loading.md](runtime-data-loading.md) |
| データの出典と現行イベント収録方針 | [data-sources.md](data-sources.md) / [GameTora基準とGameWith例外裁定](gametora-baseline-event-policy-20261021.md) |
| 公開時のイベント監査・権利 | [checker-public-catalog.md](checker-public-catalog.md) / [event-data-acquisition-rights-20261019.md](event-data-acquisition-rights-20261019.md) |
| 実装コマンド | [poc/README.md](../poc/README.md) |
| PR別の作業履歴 | [development-history.md](development-history.md) |
| 仕様とコード／テストの整合性監査 | [初回スポット監査（2026-10-22）](decision-implementation-consistency-audit-20261022.md) |
| 編集採用済みのGameWith数値事実と未確証の連続経路 | [Phase 2・独立編集台帳](phase2-adjudicated-numeric-fact-intake-20261022.md) / [4SSR全20件の追加採用](phase2-three-ssr-final-editorial-adoption-20261022.md) / [連続12段階の手動再現・遷移監査](phase2-four-ssr-chain-manual-replay-20261022.md) |
| 通常8イベントの公開スキーマ候補と署名前チェック | [Phase 2・公開候補8件](phase2-eight-release-schema-candidate-20261023.md) |
| GameTora全件の短見出しの出典SHA結合 | [Phase 2・見出し一括編集](phase2-gametora-short-title-intake-20261023.md) |
| 個別の数値・例外・出典検証 | `docs/phase2-*.md` や `docs/*-audit*.md` の該当文書 |
| 整理前の全文保存 | [archive/](archive/) |

## 履歴と現行の区別

以前の入口に進捗が入り込んでいたため、2026-10-21に原文をアーカイブした。

- [旧 AGENTS.md の全文](archive/agents-handoff-20261021.md)：PRごとの引き継ぎ・数値は**旧記録**。現在のAI指示に使わない。
- [旧 README.md の全文](archive/readme-before-20261021.md)：旧GameWith-first方針や当時のプレビュー情報も履歴として保存。
- [旧 roadmap.md の全文](archive/roadmap-progress-log-20261021.md)：各PRの時系列数値と当時のロードマップ。最新の優先順位ではない。

詳細監査文書そのものは削除・一律移動しない。各監査の固定ソース・コミット・対象版という証拠を維持するため。過去の方針を記す文書には必要に応じて冒頭注記を置く。

- [Phase 2・SSR30321の全5件編集採用と非公開通常草稿](phase2-30321-editorial-adoption-20261022.md)

- [SSR30080の1行→3択・非公開補正](phase2-30080-three-choice-editorial-repair-20261022.md)

- [SSR30221のGT欠損連続3段階をGameWithで数値採用](phase2-30221-missing-chain-editorial-intake-20261022.md)

- [SR20075欠損連続初段階のGameWith数値採用](phase2-20075-first-chain-gamewith-numeric-adoption-20261022.md)

- [SSR30240 GameWith未掲載の具体的保留とU-tools単独数値候補試験](phase2-30240-gamewith-gap-utools-only-replay-20261022.md)

- [Phase 2・重点28イベントの公開受け入れブロッカー](phase2-priority-release-readiness-20261022.md)

- [4SSRの通常8件・16択の公開前レビューと仮表示](phase2-eight-standalone-event-display-review-20261022.md)

- [Phase 2・通常8イベントをlocalhostのブラウザで非公開の選択検証](phase2-eight-standalone-local-interactive-review-20261023.md)

- [Phase 2・GitHub Pagesで通常8イベントを操作する試用画面](phase2-eight-pages-browser-preview-20261023.md)

- [Phase 2・GameTora 2,488イベントの署名前レビューキュー](phase2-gametora-unsigned-release-review-20261023.md)

- [Phase 2・固定GTスキル辞書の根本原因とGameTora／Checker例外の統合](phase2-source-exception-overlay-20261023.md)

- [Phase 2・SSR30080/6の3択を非公開本番実行形式に補正](phase2-30080-private-runtime-overlay-20261023.md)

- [Phase 2・固定GameTora 2,488＋追加通常8件の非公開統合イベント候補](phase2-integrated-2496-private-runtime-20261023.md)

- [Phase 2・2,496件を公開用スキルローダーへ非公開で通す全件検査](phase2-integrated-private-loader-acceptance-20261023.md)

- [Phase 2・連続12段階のGitHub Pages手動到達プレビュー](phase2-chain-pages-manual-review-20261023.md)

- [Phase 2・SSR30221（KFCサトノダイヤモンド）の連続3段階を試用に追加](phase2-30221-chain-pages-preview-20261023.md)

- [Phase 2・連続イベントの選択ルートを到達チェックなしで試す](phase2-chain-ordinary-continuation-planner-20261023.md)
