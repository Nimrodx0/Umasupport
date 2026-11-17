# 開発状況（現行スナップショット）

**スナップショット更新日：2026-11-17。** 本文の整理・現行mainの実装と固定出典研究の確認日です。**測定日：2026-11-06。** こちらは公開アプリの**既存GitHub Pages実ブラウザ確認**の基準日であり、全対象を同日に再測定したという意味ではありません。

ここは**現行の到達点・計測範囲・未検証の境界**の短い正本です。今後の仕事は[ロードマップ](roadmap.md)、小工程の状態・終了条件は[詳細計画](../plans/index.md)、研究数値・実験日時・版・反例は[証拠索引](../evidence/catalog.md)から確認してください。旧資料の「次工程」を現在の指示として扱いません。

## 対象・測定日と範囲

| 対象 | 日付・固定版・測定範囲 |
| --- | --- |
| 公開アプリ | 2026-11-06基準のPages実ブラウザ確認。最近のChromium/CIは**物理端末の再検証ではない** |
| 公開イベント | 現行mainの[承認済みJSON](../../poc/data/reviewed_events.v1.json)を対象に[件数検査](../../poc/tools/check_project_tracking.cjs)。現行ゲーム全体の網羅率ではない |
| P2モデル | 固定GlobalSim v77による無スキルの人工条件実験と、P2.15の3技能装備による限定モデル観測。11月17日までの[P2小工程](../plans/skill-conditions/p2.md)・固定証拠を参照 |
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
| P2 | **現在の重点研究。P2親工程は未完**。固定881スキルのうち818件の元効果・条件を照合し、970元条件経路を253厳密構造群／144共有判定機構へ整理。スキルごとの3軸明示的適用制限は元値別32文脈で必要条件を検査。元のAND/OR・preConditions・複数Invokeを保持する三値評価器、固定GlobalSimの同一tick順位・位置・corner研究、元UmaSim JVMの実登録スキル200671の窓・距離条件の同一tick観測を実施。**11月16日最新PR #449**で局面前半・後半のランダム窓の共通抽選機構を元JVMで検証。[最新研究](../evidence/skills/skill-p2-32-halfphase-source-window-reuse-20261116.md)／[P2研究の完了ゲートG1～G6](../plans/skill-conditions/p2.md#p2研究の完了ゲート2026-11-16確定) | 63件の元効果・条件未照合、元順位条件の実観測・複合ANDの全成立、3軸別の非明示的成立機会の代表性・閾値は未完。**P2.33の同一元部分条件・同一脚質の距離別W監査を実装・固定CI検証待ち**。芝ダート同一元ID比較、馬場状態・全元ANDは未評価。4脚質のWとD=O−Uは別指標、別モデルの元条件評価は実ゲーム発動率ではない。P3/P4正式スコアは未承認 |
| P3.1 | 10元部分条件×脚質6ペア＝60件のW専用研究を出典固定で隔離受入・元ID検索可能 | D、全条件、取得経路、採点は未検証・未承認 |
| P3.2 | 元10スキルをID・名称・全条件構造でアプリ照合。**9件一意一致／1件未収録**（[研究証拠](../evidence/skills/skill-p3-2-original-source-app-identity-20261112.md)） | P3.3の通常ヒント・イベント結果・カード取得経路は**未検証** |
| P3.3（研究限定） | 11月12日の固定CIで、P3.2の9一致スキルについて承認済みイベントの直接獲得**候補6経路／5スキル**を照合。厳密IDによる通常ヒント候補は0（[P3.3証拠](../evidence/skills/skill-p3-3-approved-card-route-intake-20261112.md)） | 本番の選択済み分岐、間接取得、未確認通常ヒントの同定、実ゲーム獲得、適性スコアは未検証 |
| P4／P5 | 研究から製品への工程・受入条件を定義 | 適性評価の公開UI・A/B/C統合受入は未完 |

## P2.33の2026-11-17の新規進捗（実データCI検証待ち）

[距離別W監査](../../poc/tools/skill_p2_33_distance_w.cjs)・[人工反例](../../poc/tests/skill_p2_33_distance_w.test.cjs)・[研究記録](../evidence/skills/skill-p2-33-same-style-distance-w-20261117.md)を追加。既存固定5,760モデルレース由来の10距離無制限元部分条件に対し、同じ脚質のWが距離間でどう異なるかを検査する。芝・ダート同一スキルの直接比較は根拠不足で保留。**G5とP2は未完、P3/P4公開は変更なし**。

## 11月16日時点の直近研究（mainを照合）

- [PR #445](https://github.com/Nimrodx0/Umasupport/pull/445)：固定元スキル200671を元条件式のSHA-256で85候補経路と同一性照合。原元JVMで3レースを実行し、元順位率は未観測。
- [PR #446～#448](https://github.com/Nimrodx0/Umasupport/pull/448)：同じ元ANDについて観測したphase_randomとdistance_typeを接続。PR #448の観測結果は1,946 checker tick中、既知false 1,943／順位条件UNKNOWN 3／全真0。GameToraの9/12頭順位の投影は仮定であり実測順位ではない。
- [PR #449](https://github.com/Nimrodx0/Umasupport/pull/449)：元UmaSim JVMでphase_firsthalf_random／phase_laterhalf_randomを実抽選（各6窓）、キャッシュ12・境界48チェック。共通判定機構のみ確認し、元登録スキル全条件や正式適性へは転用しない。
- **P2完了ゲート**：2026-11-16に[G1～G6](../plans/skill-conditions/p2.md#p2研究の完了ゲート2026-11-16確定)を定義。**全て未通過としてP2を継続**。実測研究の細部は各固定証拠、製品実装は現行コードで確認する。

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

## 更新同期の必須ルール

進捗に関わるPRは**そのPR内で**このスナップショットを更新する。新規の固定研究・製品機能・公開データ・対象集合の変更は、確認済み範囲／未完と対象別測定日を見直す。詳細な測定値を無制限に追記せず、主要な到達点と根拠リンクだけを残す。

[文書運用規約](../governance/documentation-policy.md)と[更新手順](../how-to/update-docs.md)を正とし、[PoC Core Tests](../../.github/workflows/ci.yml)で変更ファイルとこの文書の同時更新を検査する。**CIが保証するのは更新忘れの一部の検出であって、文書の意味的な正しさや外部ソースの継続的な最新性ではない**。PRでの人手照合を省かない。

## 更新規則・履歴

1. このページは**上書き式の現在のスナップショット**です。スナップショット更新日と、対象別の測定日・出典版・A/B/Cの実施状況を区別します。新しい研究PRごとの長い経過記録を日付順に追加せず、[小工程](../plans/index.md)と[固定証拠](../evidence/README.md)を更新してここからリンクします。
2. 公開件数は対象JSONを変更するPRで更新し、[check_project_tracking.cjs](../../poc/tools/check_project_tracking.cjs)で整合性を確認します。最新の文書更新日だけで未検証をPassへ変更しません。
3. 整理前の内容は[2026-11-12の凍結コピー](../archive/status-before-snapshot-rework-20261112.md)に保存しました。それ以前の[2026-11-05までの状態](../archive/status-through-20261105.md)と[開発履歴](../history/development-history.md)も参照できます。これらの旧記述は現行の作業指示ではありません。
