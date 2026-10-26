# Phase 2：大豊食祭の野菜・シナリオ14素材の共通変換（2026-10-26）

## 方針と固定元

元イベントごとの専用overlayを追加するのではなく、[前回の原因別監査](phase2-gt-batch-cohort-uaf-20261026.md)で把握した残り**74イベント**を共通効果コード単位で処理する。今回の対象は固定 `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67` の `veggies` と `ken_ing`。

- **`veggies`**：固定元 `support_10109.json` と `support_30207.json` に、シナリオ限定の全野菜増分 `+40` がそれぞれ複数のイベントで記載される。元のソースコードは野菜名5種類を識別しない。Cygames[大豊食祭公式](https://umamusume.jp/contents/game/scenario/daihoshokusai/)には5種類の野菜が記載され、[GameWith大豊食祭攻略](https://gamewith.jp/uma-musume/article/show/451602)にも秋川理事長のお出かけによる各野菜+40が明記されている。同じイベントに通常の体力・能力等があっても、野菜はそれらの値に加算しない。
- **`ken_ing`**：固定元 `support_30305.json` の複数イベントに `+2`。同版の [`server/app/event_engine.py`](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py) の `_encode_effect` にはシナリオ14の「secret ingredients」カウント表示として扱い、**preview only、実際の払い出しはリンクカードのstory_step側**と明記。したがって今回の通常イベントルートから「素材2個を確定取得した」と判定してはならない。

利用者へ提示可能な事実と元コード内の再現範囲を区別する。元サポカIDと固定GT元位置、効果コード、型付きの数値情報だけを保存し、第三者の原文・画像・選択肢文章を公開しない。

## 共通実装

[全件の共通変換器](../poc/src/phase2_gt_whole_nonskill_effect_inventory.cjs)で `SCENARIO_RESOURCES` に次の2つの**独立した型**を定義。

| GT効果コード | schema `dynamicEffects[].kind` | `scenario` | `targetSelection` |
|---|---|---|---|
| `veggies` | `great-food-festival-all-vegetables` | `great-food-festival` | `all-five-vegetables` |
| `ken_ing` | `scenario14-secret-ingredients` | `scenario-14` | `secret-ingredient-count` |

変換対象は`type`と`value`の2フィールド、符号付き整数（非0）。元値が範囲値・不明値・追加属性なら保留。同じ元結果内に同じ効果コードが重なれば意味が未確定なので結果全体を保留。選択肢が複数あれば元の選択肢それぞれに候補を保持し、合算しない。いずれも`possible:true`としてスキーマがガードし、`UmaCore.directDynamicEffectRoutes`が`conditional:true`・`unresolvedTargets:true`付きの**候補**を返す。通常の5能力値加算、取得スキル候補、イベント進行フラグへ変換しない。

## 固定全件B監査（今回の実測）

| 指標 | 変更前 | 今回 |
|---|---:|---:|
| GT固定元の総イベント | 2,488 | 2,488 |
| 一般構造化可能イベント | 2,414 | **2,427** |
| 一般構造化保留 | 74 | **61** |
| 主原因が未知効果のイベント | 47 | **34** |
| 共通変換された `veggies` | 未変換 | **10効果記載／8イベント／2カード** |
| 共通変換された `ken_ing` | 未変換 | **6効果記載／5イベント／1カード** |
| 一般スキル同結果結合 | 2,413 | **2,426** |
| 特例5件込みの非公開効果付きイベント | 2,418 | **2,431** |
| 既存スキル候補（非公開） | 2,512 | 2,512 |
| 正式公開イベント | 0 | 0 |

全563カードで既存スキル経路を保護する。GT元のautoとGameWith裁定3択が矛盾するSSR30080#6は通常結合不可のまま（一般候補2,427と通常結合2,426の差1）。

### A/B/C

A：[専用回帰](../poc/tests/phase2_gt_scenario_resource_batch.test.cjs)で2効果コードの動的型分離、選択未決定時の非表示、選択肢ごとの非二重計上、不正値・重複・スキーマ不正の拒否を試験。B：固定GT559カード／2,488イベント／4,376経路の全件監査と、2,512候補の一時preflight/attachをGitHub Actionsで実施。C：CIの既存Chromiumは公開中のWebアプリの保護回帰。今回追加した未公開イベントの画面確認、現行ゲーム内でのシナリオ効果の発生、Windows／Android物理端末では未検証。**今回も未承認イベント・イベント本文をPagesへ出さない。**

## 次のまとまり

残り61イベントの内訳は、特殊コード34、連続結果・打ち切り15、数値範囲9、内部条件セグメント3。次は`ntsr`が12イベント、`yhs_tix`/`yhs_sr`が10イベント、`ttl_gauge_all`が7イベントなど、出典で意味と帰属シナリオを確認できたコードの組から共通処理を追加する。未裁定のコードを通常の能力値・確定値として推定補完しない。
