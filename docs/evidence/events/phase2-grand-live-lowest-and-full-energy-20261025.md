# Phase 2：GameTora固定`mt`と`full_energy`の実行時依存効果（2026-10-25）

## 目的と根拠

固定GameTora由来559カード／2,488イベントについて、前PR #209時点で構造化を保留した182イベントのうち、元のイベント実行器で意味の確認できる5件の特殊効果（`mt` 4記載、`full_energy` 1記載）を処理する。元スナップショットは`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`、母数は変えない。

- `mt`：固定[イベント実行器](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L1531-L1565)ではシナリオ通貨の付与操作として扱う。固定[Grand Live実装](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/scenarios/grand_live/impl.py#L1015-L1034)によれば、グランドライブが有効なとき、ダンス／情熱／ボーカル／ビジュアル／メンタルの**実行時の残量が最も少ないカテゴリ**を選んで指定値を加算する。並び順で同数のときの優先も元実装にある。元イベント効果だけからカテゴリは確定できず、シナリオがGrand Live以外なら当該元実装は中立処理。
- `full_energy`：固定[イベント実行器](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L1380-L1388)が現在体力を**その時点の最大体力**に設定する。元の`value`整数を指定する類の効果ではなく、常に体力+100、最大体力増加、回復量固定と解釈してはいけない。
- `ken_ing`（6記載）：[元イベント表示器](https://github.com/systemless10/UmamusumePS/blob/6e38b54af4fad397ff4491e63007a90705a4fe67/server/app/event_engine.py#L764-L767)には「表示専用、シナリオ側で別段付与」の説明がある。重複付与を避けるため、今回の非公開イベント報酬へ**自動加算しない**。`all_disc`、`veggies`、`ttl_gauge`等は固定元だけで意味が確定しないため、今工程では保留。

## 機構と保留

`poc/src/event_schema.js`の`dynamicEffects[]`は元の`random-stats`に加え、次の厳密な可変値形式を受け付ける。

- `{kind:'grand-live-lowest-performance',delta:20,scenario:'grand-live',possible:true,targetSelection:'lowest-performance-at-runtime'}`：符号付き非ゼロ整数とGT出典フィールドのみ許容。**グランドライブ限定の候補**として扱い、カテゴリーは実行時に確定する。
- `{kind:'restore-current-max-energy',possible:true,targetSelection:'current-max-energy'}`：現在の最大体力への回復候補。増加量の`delta`は付けない。余計な出典フィールドがあれば保留。

`UmaCore.directDynamicEffectRoutes`は従来と同様にイベント到達・選択・成功／失敗の排他を守り、`conditional:true`かつ`unresolvedTargets:true`を返す。シナリオ制約、最大体力による可変増減量を条件文に含めるが、**固定能力値効果・スキルの取得報酬・獲得済み数値合計へは合算しない**。

GT数値インベントリは効果コードの別種カウンタとスキーマを追加し、既存の`all_stats`、状態付与、ランダム能力、スキル、連続停止コードの排他的監査を継続。異常な整数・未知フィールド・同じ結果への重複は安全に保留。`poc/tests/phase2_gt_grand_live_mt_full_energy.test.cjs`は合成A試験で元選択未確定・結果2択・出典の余計な項目・数量への誤換算を検査する。

## 固定全件B・実行環境Cの実測

[固定全件監査 #40197743550](https://github.com/Nimrodx0/Umasupport/actions/runs/40197743550)は**PASS**。559カード／2,488元イベント／4,129選択肢／4,376結果経路／13,263元効果記載の母数を保持した。

| 指標 | 前回 #209 | 今回 |
| --- | ---: | ---: |
| `mt`対応（元記載） | 未対応4 | **4/4** |
| `full_energy`対応（元記載） | 未対応1 | **1/1** |
| 未対応効果コードの記載 | 95 | **90** |
| 孤立した非スキル構造化可能イベント | 2,306 | **2,309** |
| GT元イベントの非スキル構造保留 | 182 | **179** |
| 構造化可能な結果経路 | 4,159 | **4,164** |
| 構造保留経路 | 217 | **212** |
| 孤立プレビューの可変効果記録 | 18 | **23** |

非公開2,512件のスキルイベントへの同一GTカード・イベント順位／選択・結果番号対応を厳格に維持した全件結合結果は、**2,308／2,309件**（確定数値効果10,413成分、状態操作88成分、動的効果22成分）。元スキル計算の不変性は563カードすべてで検査。本番同形式のpreflightと使い捨てattachは2,512件を保持。

唯一の結合保留は**SSR30080イベント#6**。元GTのautoを、別資料で既にGameWith裁定した実際の3択（choice）に書き換えた例外であり、元の「無選択」の報酬を特定の選択肢へ無根拠に配布しない。今回の特殊効果5元記載のうち、構造化対象を追加できたイベントは3件。元報酬の意味が読み取れたことと、既存イベントへ何件追加できるかは**異なる単位**。

**A**：Node合成単体テストで正負、形状、結果排他、確定能力・スキル取得へ混入しないことを検証。**B**：固定GT全件監査と本番用の非公開一時読込、全563カードのスキル経路SHA照合。**C**：現行UIのChromium回帰で以前の機能を保護。シナリオ限定動的効果の正式なWeb画面表示、元ゲームの現行版直接プレイ、Windows／Android物理端末、正式公開と権利認可は未実施。

次の優先対象は残179イベントの未対応効果コード90記載（シナリオ独自通貨・ゲージ・機能の意味論）と、制御マーカー・条件付き分岐の保留、SSR30080の3択に対応する非スキル結果の個別事実裁定である。通常公開`reviewed_events.v1.json`は変更しておらず**正式公開イベントは0件**。
