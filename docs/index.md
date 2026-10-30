# 文書の入口

プロジェクトの一次入口は [README](../README.md)。**この索引と [文書運用規約](documentation-policy.md) は文書の役割を案内するもので、仕様や進捗の正本ではありません。**

| 探したいもの | 正本 |
| --- | --- |
| AIの作業規則・引き継ぎの読み順 | [AGENTS.md](../AGENTS.md) |
| 製品の最終要件と対象外 | [requirements.md](requirements.md) |
| 利用者による確定決定・撤回の履歴 | [decisions.md](decisions.md) |
| 今後の作業順序と完了ゲート | [roadmap.md](roadmap.md) |
| **Phase 2の現在の未解決事項と後続裁定** | [既存563カードのイベント残件台帳](phase2-open-items.md) |
| 現在の状況と根拠リンク | [status.md](status.md) |
| 機構・データ・実環境での合否条件 | [verification-plan.md](verification-plan.md) |
| 技術設計 | [architecture.md](architecture.md) / [event-schema.md](event-schema.md) / [runtime-data-loading.md](runtime-data-loading.md) |
| 2026-10-29 第三者GitHub DBへの復帰と直接取得保留・製品完成計画 | [現在の主経路・作業の優先度・安全な保留](derived-github-primary-restart-20261029.md) |
| 既存GameTora全件変換器の新カード単位での再利用 | [旧2,488イベント変換器と今回の固定Git blob増分接続](derived-github-canonical-single-card-adapter-20261029.md) |
| **既存カードの実イベントを初めて正式収録するための審査リハーサル** | [4カード・通常8イベント、未承認審査票、1件からの安全な追記](phase2-first-event-release-rehearsal-20261030.md) |
| 新サポカの継続更新と要確認事項を翌日も引き継ぐ台帳 | [カードID単位のGitHub Issue・Git blob追跡・日次再試行](derived-github-daily-pending-ledger-20261029.md) |
| 新カードのGitHub派生JSONから増分レビュー待ちまで | [固定Git blob・未掲載／不正／未変換の分岐と継続保留](derived-github-new-card-review-staging-20261029.md) |
| 構造化GitHub派生イベント559枚の全件変換監査 | [2,488イベントの暫定変換・保留を種類別集計](derived-github-whole-roster-app-draft-audit-20261029.md) |
| 派生JSONの排他的スキルヒント候補（skill_hint_or） | [元のORを複数の確定報酬に誤合算せず結果へ展開](derived-github-exclusive-hint-alternatives-20261029.md) |
| GitHub派生JSONから実アプリの非公開イベント形式へ | [R/SR/SSR 3枚の固定JSONを用いた結果別スキル・連続到達変換](derived-github-app-schema-draft-20261029.md) |
| データの出典と現行イベント収録方針 | [data-sources.md](data-sources.md) / [GameTora基準とGameWith例外裁定](gametora-baseline-event-policy-20261021.md) |
| SSR30323吾妻のお出かけ解放と経路の限定出典照合 | [見出し6件・両選択肢の解放](official-gametora-azuma-outing-20261028.md) |
| 次に元サイトと比較する既存GameTora旧カード構造別3枚 | [SSR30030／30041／30080の範囲値・3択・打ち切りを出典固定](official-gametora-existing-structural-cohorts-20261028.md) |
| 過去の別工程の調査（現行変換要件ではない）：SSR30322のGameWith結果名 | [3択×大成功／成功、6結果21数値・12ヒントの編集採用](official-gametora-30322-gamewith-result-adjudication-20261029.md) |
| 過去の表示ラベル実験（現行変換要件ではない） | [新SSR2枚のOR3組・結果ラベル0の実Chrome監査](official-gametora-site-outcome-label-evidence-20261029.md) |
| GameToraの新カード共通DOM抽出と非公開イベントDB形式への変換 | [2カード・18パネル・27結果の共通構造投影](official-gametora-generic-new-card-site-projection-20261029.md) |
| 汎用変換器の構造別実Chrome診断（SSR30030・30041・30080） | [全22パネル・2件のヒントID未確証を保留した共通統合・残1件](official-gametora-structural-adapter-audit-20261029.md) |
| 新サポカの検出と既存イベントDBへの増分追加 | [GameTora新カードの追記専用ゲート・完成条件・保留](new-card-event-incremental-intake-20261029.md) |
| GameTora新SSR二枚に四系統の結果別統合を拡大 | [実Chromeの16イベント・27結果・108数値行・18ヒント照合](official-gametora-new-card-unified-live-20261029.md) |
| GameTora本体の数値・ヒント・直接スキル・進行マーカーを結果別に統合 | [SSR30080の4系統厳格結合と非公開ゲート](official-gametora-unified-site-route-draft-20261029.md) |
| GameTora元サイトの結果別進行表示 | [SSR30323二択のお出かけ解放を結果別に実Chrome照合](official-gametora-visible-flow-20261029.md) |
| GameTora本体の直接スキル獲得をヒントから区別 | [非公開の効果判定器と新SSR二枚の実サイト検証](official-gametora-direct-skill-candidate-20261029.md) |
| GameToraヒントIDの局所照合を新SSR二枚へ共通化 | [3カードの元サイト実Chromeと同名・異ID拒否の監査](official-gametora-hint-locality-shared-20261028.md) |
| GameToraヒント行の局所・親DOMで生じる数値IDの誤曖昧判定を修正 | [SSR30080ヒント1件のスキルID解決と元サイト検証](official-gametora-hint-locality-20261028.md) |
| 元GameTora結果別のスキルヒントID・Lv候補 | [独立UmaSim数値IDへの結果別照合と未解決ゲート](official-gametora-site-route-hint-candidates-20261028.md) |
| GameTora元サイトだけを入力とする非公開数値中間候補 | [旧GT非依存の結果別数値変換器と未採用ゲート](official-gametora-site-only-numeric-draft-20261028.md) |
| SSR30080元サイトの経路別12数値と旧固定の不一致 | [実Chromeで4経路を独立抽出し数値差を記録](official-gametora-30080-numeric-drift-20261028.md) |
| SSR30080元サイトの外側3選択肢・内部OR4候補・明示打ち切りの限定照合 | [旧30080の実ChromeのDOM構造検証と未確認ラベル](official-gametora-30080-site-branch-20261028.md) |
| SSR30030／30041の元GameTora画面での数値範囲の限定照合 | [旧2枚の実Chromeで+10/+30・+15/+45を確認](official-gametora-old-range-direct-site-20261028.md) |
| 既存SSR30001のGameTora本体とスキル＋非スキルの実統合イベントJSON照合 | [5イベント・9経路・36報酬記載](official-gametora-30001-combined-app-parity-20261028.md) |
| 既存SSR30001のGameTora本体と非スキル効果の実アプリ用投影の照合 | [9経路・非スキル効果31/31件](official-gametora-30001-app-effects-parity-20261028.md) |
| 既存SSR30001のGameTora本体と実アプリ用スキルイベント投影の照合 | [5イベント・9経路・スキル報酬5件](official-gametora-30001-app-schema-parity-20261028.md) |
| 既存変換済みGameToraデータと元サイト直接取得の等価性検証 | [SSR30001の5イベント9経路と8未分類数値](official-gametora-existing-normalized-parity-20261028.md) |
| GameTora本体直接取得・不足する選択肢文言の出典検証 | [公式サイト直接取得の限定実証](official-gametora-direct-feasibility-20261027.md) / [GameWithの選択肢だけ補完・新SSR閲覧](official-gametora-choice-label-and-new-cards-20261027.md) |
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

- [Phase 2・5SSRの15連続段階を非公開2,511全イベントへ統合](phase2-private-2511-chain-loader-20261023.md)

- [Phase 2・2,511件統合後に残る固定出典差異20位置の照合](phase2-2511-residual-source-gaps-20261023.md)

- [Phase 2・SSR30301の「足任せ」通常ヒントと連続イベント資料差の裁定](phase2-30301-gt-hint-vs-checker-event-20261023.md)

- [Phase 2・Checker未対16位置のスキルID影響と調査優先順位](phase2-remaining-checker-skill-impact-20261023.md)

- [Phase 2・SSR30180「あなたを想って」のスキル報酬補完](phase2-30180-special-cornering-2512-20261023.md)

- [Phase 2・Checker P1条件付き結果4位置のスキル影響監査](phase2-four-p1-conditional-result-review-20261023.md)
- [Phase 2・P1元見出し4位置の「共通3＋海外1」ハッシュ同定](phase2-p1-title-key-crosscheck-20261023.md)
- [Phase 2・L'Arcイベントの置換と佐岳メイR/SSR海外専用の非スキル数値台帳](phase2-p1-larc-replacement-and-mei-overseas-20261023.md)
- [Phase 2・非スキル効果スキーマと佐岳メイ海外限定R/SSR結果の技術試作](phase2-nonskill-outcome-runtime-20261024.md)
- [Phase 2・GameTora全2,488イベントの非スキル数値・受け手・結果構造全件監査](phase2-gt-whole-nonskill-effect-audit-20261024.md)
- [Phase 2・GameTora固定 `all_stats` 68記載の5能力展開と2,220件の構造試作](phase2-all-stats-five-attributes-20261024.md)
- [Phase 2・非公開2,512件へGT非スキル2,220件を元結果の番号照合で結合](phase2-private-2512-skill-nonskill-join-20261025.md)
- [Phase 2・固定GT121状態操作を候補として分岐に導入し、非スキル構造2,288件へ拡張](phase2-gt-status-operation-adoption-20261025.md)
- [Phase 2・GTランダム能力値18記載の対象未確定処理と2,306件の数値・状態構造化](phase2-gt-random-stat-targets-20261025.md)
- [Phase 2・GTグランドライブ最少パフォーマンスと最大体力までの回復：2,309件の非公開構造化](phase2-grand-live-lowest-and-full-energy-20261025.md)
- [Phase 2・GT連続イベント結果別打ち切り109記載の厳格照合と2,395件の非公開構造化](phase2-gt-chain-end-outcome-proof-20261025.md)
- [Phase 2・GTの同一対象への複数数値効果を元出典の順序で保持し2,402件を構造化](phase2-gt-ordered-repeated-numeric-effects-20261026.md)
- [Phase 2・GTの同一状態操作の反復を元順序で保持し2,404イベントを構造化](phase2-gt-ordered-repeated-status-effects-20261026.md)
- [Phase 2・3カードの条件付きセグメント8結果を元ガードIDで隔離・非公開照合](phase2-gt-conditional-segment-guard-review-20261026.md)
- [Phase 2・GT連動数値範囲15記載を調査しSSR30028の能力値＋ヒントLv2結果を非公開統合](phase2-gt-coupled-range-numeric-outcomes-20261026.md)
- [Phase 2・GT30030/30041の数値のみの低／高結果を厳格に2分割し非公開2512イベントへ限定統合](phase2-gt-nonskill-only-range-pair-20261026.md)
- [Phase 2・SSR30010の賢さ低／高とヒント2択を既存4排他的結果で同期](phase2-gt-30010-correlated-or-20261026.md)
- [Phase 2・SSR30090絆±5の2結果と両方の連続打ち切りを厳格照合](phase2-gt-30090-terminal-bond-20261026.md)
- [Phase 2・未対応84件の原因別一括分類とU.A.F.全15競技の共通変換](phase2-gt-batch-cohort-uaf-20261026.md)
- [Phase 2・大豊食祭の野菜とシナリオ14秘密素材を共通型で一括変換](phase2-scenario-resources-batch-20261026.md)
- [Phase 2・タッカー翌ターン得意率と保科温泉入浴券・次回超回復の22イベント一括変換](phase2-gt-contextual-batch-20261026.md)
- [Phase 2・レジェンズの全員／選択相手の指南ゲージ9イベントを共通変換](phase2-legends-gauge-batch-20261026.md)
- [Phase 2・お出かけ連続イベントの解放／打ち切り14イベントを一括変換](phase2-outing-unlock-terminal-batch-20261026.md)
- [Phase 2・2026-10-26現行UmaSimサポカ563→566枚の差分と公開ローダー監査](phase2-current-roster-566-audit-20261026.md)
- [Phase 2・2026/10/26追加サポカ3枚の通常ヒント14件・数値スキルIDとイベント未収録の独立照合](phase2-20261026-new-card-skill-event-scope.md)
- [固定GameTora／UmaSim出典の継続更新手順と日次差分監視](upstream-refresh-operations.md)
- [出典候補の全件GTイベント・UmaSimカード／数値スキル辞書preflight（2026-10-27）](upstream-full-source-preflight-20261027.md)
