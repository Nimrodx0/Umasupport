# W1.2 / W1.3：公開イベント実JSONを使うデッキ集計結合検証

**作業開始：2026-11-11**。基準：`main`のコミット `2d428bcc42a4d8c1d21c70f72fc467b3e2913d13`。この文書はW1の範囲限定記録であり、公開アプリのA/B/C最終合格報告ではない。

## 対象と既存契約

- [現行要件 F-03/F-04](../../reference/requirements.md)、[公開イベントスキーマ](../../reference/event-schema.md)、[検証計画](../../quality/verification-plan.md)に基づき、イベント未選択、選択済み、結果排他、後続条件、連続打ち切り、デッキ内の直接提供枚数、通常ヒントとイベントの混合経路を扱う。
- 実データは**公開承認済み** `poc/data/reviewed_events.v1.json` のみ。既存の測定基準では559カード／2,487イベント。候補25件は取り込まず、第三者本文・画像・未承認データは追加しない。
- `core.directRoutes`、`core.clearDependentState`、`core.aggregate`、`core.coverage`、`UmaDeckEvents.summarize`という実アプリの関数を直接使用する。通常ヒント用の外部`support_card.txt`はリポジトリに同梱されないため、混合経路の**通常ヒントと2枚目カードだけ人工配置**する。これは公開JSONと実通常ヒントの独立照合ではない。

## 追加した試験

`poc/tests/approved_event_w1_integration.test.cjs`：

1. 公開実JSONの固定イベント・カード数と、全カードの選択肢未設定時に選択式報酬を集計しない性質を検査。
2. 実JSON内の選択肢なし報酬と、直接報酬を持つ選択式イベントを集計。選択解除で対応イベント経路が消えることを検査。
3. 実JSON内に条件に適合する例がある場合、排他的結果の決定と親の選択変更時の後続状態クリアを検査。該当例がなければ**スキップと明記**し、架空の実データ事実を創作しない。
4. 実イベントの提供スキルを人工の通常ヒントに重ね、1サポカ・複数経路でも提供枚数が1、別カードが加われば2になること、直接カバーを検査。
5. `core.directRoutes(card)`に`config`を渡さないとき、凸段階別ヒントのデフォルト4凸読込で例外が起こる不具合を修正し、回帰テストで保護。

既存テストでは人工データによる内部AND/OR・打ち切り・結果依存・保存を継続検証。公開実JSONテストはこれを置き換えない。

## 検証ゲート（PR提出時点）

| ゲート | 状態 | 根拠／今後の確認 |
| --- | --- | --- |
| A 機構 | **追加試験の対象範囲はCI合格（6 Pass、1 Skip、0 Fail）** | [PoC Core Tests #42945587196](https://github.com/Nimrodx0/Umasupport/actions/runs/42945587196)。公開コホート・自動／選択／結果排他・重複・目標の検証に成功。**明示 choiceId の親子分岐に該当する公開実例がなく、連続打ち切り試験はスキップ**。旧人工データ回帰は別枠で成功 |
| B データ | **既存公開審査の範囲を使用、追加の独立照合は未実施** | [公開審査](phase2-no-inquiry-publication-assessment-20261102.md)と`node poc/tools/verify_event_release.cjs`を参照。公開コホートを変更しない |
| C 実環境 | **未実施** | Windows／Androidの物理端末・GitHub Pages上での実操作、選択と復元、公開版コミットの記録が必要 |

## GitHub Actionsで確認した結果（2026-11-11）

- [PoC Core Tests #42945587196](https://github.com/Nimrodx0/Umasupport/actions/runs/42945587196)：core-tests と browser-smoke のジョブがともに成功。追加試験は **7件中6 Pass／1 Skip／0 Fail**。スキップ対象は公開JSONから `requires.all[].choiceId` を使う選択肢依存の親子イベントを発見できなかったため。**連続イベントの実データ完全再現を証明しない**。
- [Documentation Integrity #42945587240](https://github.com/Nimrodx0/Umasupport/actions/runs/42945587240)：成功。
- [Audit complete cross-source support event inventory #42945587137](https://github.com/Nimrodx0/Umasupport/actions/runs/42945587137)：成功。独立した現ゲーム全体の網羅率の証明ではない。
- いずれも作業ブランチのコミット `d2380cbf25647e73d85b1a0b6515cd9507062883` に対する結果。以後の文書修正は検査結果の記録のみで、機構・テストを変更しない。

## 後続

- 条件に合う公開実データが見つからない明示的な選択肢依存の連続打ち切りは、既存の人工モデル回帰を保持したまま、将来の承認済みイベント追加時または具体的な実ゲーム出典が確保された際に実データで再試験する。スキップを「検証済み」と扱わない。
- W1.2では公開版実ブラウザで選択→結果変更→後続解除→打ち切りを操作し、具体的なイベントID・カードID・期待値・実測値を記録する。
- W1.3ではUmaSim通常ヒントの実出典を固定し、イベントIDとスキルIDを独立に確認して目標セット・デッキ比較まで通し確認する。
- W1.4の保存／復元／異常時保護およびW1.5のA/B/C受入記録は別工程。**W1.2とW1.3の完了宣言は行わない。**
