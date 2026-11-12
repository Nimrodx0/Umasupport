# 開発状況（現行スナップショット）

**スナップショット更新日：2026-11-12。** 本文の整理・現行mainの実装と固定出典研究の確認日です。**測定日：2026-11-06。** こちらは公開アプリの**既存GitHub Pages実ブラウザ確認**の基準日であり、全対象を同日に再測定したという意味ではありません。

ここは**現行の到達点・計測範囲・未検証の境界**の短い正本です。今後の仕事は[ロードマップ](roadmap.md)、小工程の状態・終了条件は[詳細計画](../plans/index.md)、研究数値・実験日時・版・反例は[証拠索引](../evidence/catalog.md)から確認してください。旧資料の「次工程」を現在の指示として扱いません。

## 対象・測定日と範囲

| 対象 | 日付・固定版・測定範囲 |
| --- | --- |
| 公開アプリ | 2026-11-06基準のPages実ブラウザ確認。最近のChromium/CIは**物理端末の再検証ではない** |
| 公開イベント | 現行mainの[承認済みJSON](../../poc/data/reviewed_events.v1.json)を対象に[件数検査](../../poc/tools/check_project_tracking.cjs)。現行ゲーム全体の網羅率ではない |
| P2モデル | 固定GlobalSim v77による無スキルの人工条件実験と、P2.15の3技能装備による限定モデル観測。11月12日までの[P2小工程](../plans/skill-conditions/p2.md)・固定証拠を参照 |
| P3集約研究 | 11月12日統合の[P3.1・P3.2](../plans/skill-conditions/p3.md)を確認。出典固定の部分条件とアプリID照合に限定 |
| 受入 | [A/B/Cゲート](../quality/verification-plan.md)を分離。Node/Chromium・研究CI成功は実機受入の代わりにならない |

## 現在の到達点と残る課題

| 領域 | 確認済み | 残る課題・保留 |
| --- | --- | --- |
| Webアプリ | 本育成／継承育成、通常ヒント・公開イベント候補、選択分岐、重複・目標カバー、所持・検索、保存／JSON復元をGitHub Pagesで提供 | Windows／Android物理端末の最終受入、障害・復帰の公開運用 |
| 公開イベント | GameTora派生JSON由来の承認済み数値事実を公開 | 25件の出典例外・現行ゲームとの独立照合・公開条件の継続管理（[W2](../plans/product.md)） |
| 新サポカ | UmaSim追加ID検出、GameTora派生JSON確認、未入手の持越台帳・増分追加機構 | 未掲載イベントの収録・審査、監視用Draft PR作成の権限問題（[Issue #283](https://github.com/Nimrodx0/Umasupport/issues/283)・[#386](https://github.com/Nimrodx0/Umasupport/issues/386)） |
| スキル辞書 | 固定881スキルのうち818件の元効果・条件を照合 | 63件の効果・条件未照合。辞書収録とカード獲得可能性は別 |
| P0／P1 | 元スキル条件監査と内部モデル実装済み | 出典更新時の回帰 |
| P2 | 固定モデルのW・D=O−U、頭数・編成・コース・シード感度を研究。P2.15の元`phase_random`窓は102スキル／371経路で構造確認。モデル32無技能レースの判定直前位置435,558走者・tickを計測。追加の**3技能を実際に装備した8モデルレース**で有効窓210・予約無効42を分離し、物理値437,364・技能イベント181の全件一致（[追加証拠](../evidence/skills/skill-p2-15-equipped-runtime-windows-20261112.md)）。元全辞書2,162件のAND/OR・preConditions履歴を扱う三値tick判定器は[全件構造検証済み](../evidence/skills/skill-p2-15-whole-tick-logic-20261112.md) | GlobalSim抽選は元UmaSim抽選や実ゲームではない。**`distance_rate`を持つ固定元253技能についてGlobalSim実判定直前位置108,844走者・tickを元算式へ変換し、元全条件式へ保留付き入力する[限定観測](../evidence/skills/skill-p2-15-source-distance-rate-real-ticks-20261112.md)を実施**。順位・抽選窓などの動的元条件の同時全件観測、シミュレータの妥当性、正式3軸適性とP3カード採点は未完 |
| P3.1 | 10元部分条件×脚質6ペア＝60件のW専用研究を出典固定で隔離受入・元ID検索可能 | D、全条件、取得経路、採点は未検証・未承認 |
| P3.2 | 元10スキルをID・名称・全条件構造でアプリ照合。**9件一意一致／1件未収録**（[研究証拠](../evidence/skills/skill-p3-2-original-source-app-identity-20261112.md)） | P3.3の通常ヒント・イベント結果・カード取得経路は**未検証** |
| P3.3（研究限定） | 11月12日の固定CIで、P3.2の9一致スキルについて承認済みイベントの直接獲得**候補6経路／5スキル**を照合。厳密IDによる通常ヒント候補は0（[P3.3証拠](../evidence/skills/skill-p3-3-approved-card-route-intake-20261112.md)） | 本番の選択済み分岐、間接取得、未確認通常ヒントの同定、実ゲーム獲得、適性スコアは未検証 |
| P4／P5 | 研究から製品への工程・受入条件を定義 | 適性評価の公開UI・A/B/C統合受入は未完 |

## Pトラックの直近の根拠

[P2.13の5,760レース・15＋15シード再実行](../evidence/skills/skill-p2-13-source32-split15-w-20261111.md)、[P2.15の元AND/OR構造監査](../evidence/skills/skill-p2-15-full-path-gate-audit-20261111.md)、[P2.17bの距離・コース文脈の分割検証](../evidence/skills/skill-p2-17b-distance-split15-20261112.md)、[P2.18の保留付き研究契約](../evidence/skills/skill-p2-18-research-evidence-contract-20261112.md)、[P3.1の隔離受入口](../evidence/skills/skill-p3-1-research-intake-20261112.md)、[P3.2のスキルID独立照合](../evidence/skills/skill-p3-2-original-source-app-identity-20261112.md)、[P3.3の固定承認データ直接候補監査](../evidence/skills/skill-p3-3-approved-card-route-intake-20261112.md)が現行の主要な根拠です。詳細な数値・母集団・例外・検証CIは各証拠が正本であり、ここへ実験別の長文を再掲しません。

**重要な境界**：固定モデル上のWやDは、元スキル全条件の発動率・カードの適性スコアではありません。P3.2の9件一致も、そのカードから取得できるという証明ではありません。未観測・適用外・脚質不在を「0点」にしません。

## 公開イベントの検証対象（本番JSON）

- 公開イベント（公開JSON実測）：**2,487件**／**559カード**。測定対象：[poc/data/reviewed_events.v1.json](../../poc/data/reviewed_events.v1.json)。公開承認と初回投入は [PR #309](https://github.com/Nimrodx0/Umasupport/pull/309)（2026-11-02）。CIの機械検査でJSONのイベント数とこの記載を突き合わせます。
- 固定技術変換2,512件のうち **25件** は公開保留（GameWith補正が入ったGT由来1件、別出典から編集追加した24件）。保留は公開データから分離したままで、ゲーム中に存在しない意味ではありません。根拠は [公開承認の監査](../evidence/events/phase2-no-inquiry-publication-assessment-20261102.md) と [出典例外分類](../evidence/events/phase2-source-lineage-exception-map-20261102.md)。
- 公開JSONは、未承認の試用モードや非公開候補とは別。通常の起動時にロードできることは [PR #312・#313](https://github.com/Nimrodx0/Umasupport/pull/313) とPages実ブラウザで確認。元のイベント本文・画像を無断再配布しない。

## 実装と検証の境界

- **A 機構**：Nodeのユニットテスト、実Chromiumのデスクトップ／スマホ幅で主要操作を検証。継続実行は [PoC Core Tests](../../.github/workflows/ci.yml) を参照。
- **B データ**：固定出典での技術変換・JSON公開ゲート・元スキルIDの照合は確認済みの範囲がある。ただし **旧マスター**・出典間の差分と全件の実ゲーム照合は別の未完工程。
- **C 実環境**：GitHub Pages実ブラウザの表示・公開データ読込は検証済み。Windows／Androidの物理端末を網羅した最終受け入れとは区別する。受け入れゲートは [verification-plan.md](../quality/verification-plan.md)。

## 更新規則・履歴

1. このページは**上書き式の現在のスナップショット**です。スナップショット更新日と、対象別の測定日・出典版・A/B/Cの実施状況を区別します。新しい研究PRごとの長い経過記録を日付順に追加せず、[小工程](../plans/index.md)と[固定証拠](../evidence/README.md)を更新してここからリンクします。
2. 公開件数は対象JSONを変更するPRで更新し、[check_project_tracking.cjs](../../poc/tools/check_project_tracking.cjs)で整合性を確認します。最新の文書更新日だけで未検証をPassへ変更しません。
3. 整理前の内容は[2026-11-12の凍結コピー](../archive/status-before-snapshot-rework-20261112.md)に保存しました。それ以前の[2026-11-05までの状態](../archive/status-through-20261105.md)と[開発履歴](../history/development-history.md)も参照できます。これらの旧記述は現行の作業指示ではありません。
