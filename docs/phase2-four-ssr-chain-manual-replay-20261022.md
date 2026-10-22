# Phase 2：4SSR連続12段階の到達条件と安全な手動再現（2026-10-22）

## 背景と観測範囲

固定GameToraスナップショット `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67` はSSR30318〜30321の4枚を未収録。PR #171で[4枚20イベントの**数値事実**](phase2-three-ssr-final-editorial-adoption-20261022.md)をGameWithから採用したが、**連続イベントの後続継続・打ち切り条件を確認済みとはしていない**。

2026-10-22に各カードの出典を確認し、いずれもGameWithのカード別記事で連続3段階と各段階の数値報酬が掲載されていることを確認した。GameTora現在のカードページには、30318・30319・30321で連続3段階のイベント一覧が現れる。30320では今回の取得範囲で全イベント個別展開まで確認できず、概要のみを確認した。

| ID | GameToraのカード別ページ | GameWithのイベント記事 | 連続段階 | 報酬数値の採用 |
| --- | --- | --- | ---: | --- |
| 30318 | https://gametora.com/ja/umamusume/supports/30318-rice-shower | https://gamewith.jp/uma-musume/article/show/578814 | 3 | 全3段階 |
| 30319 | https://gametora.com/ja/umamusume/supports/30319-narita-brian | https://gamewith.jp/uma-musume/article/show/578819 | 3 | 全3段階 |
| 30320 | https://gametora.com/ja/umamusume/supports/30320-admire-groove | https://gamewith.jp/uma-musume/article/show/578818 | 3 | 全3段階 |
| 30321 | https://gametora.com/ja/umamusume/supports/30321-duramente | https://gamewith.jp/uma-musume/article/show/578817 | 3 | 全3段階 |

**「段階1／2／3が一覧にある」「選択別の報酬が書かれている」は、段階1の各選択後・段階2の各選択後に必ず後続が解禁される証明ではない。** 今回確認した上記記事の情報からは、段階ごとの選択が後続を打ち切るか、後続の報酬を変更するかを**選択位置単位で確定できない**。記事に明記がないことを「打ち切りなし」という事実に置き換えない。GameTora固定JSONに限る「通常の後続継続を既定とする」契約を、欠損した4カードに拡張しない。

## 独立した到達監査

`poc/src/phase2_chain_manual_replay.cjs` で全4カードの出典・数値・公開ゲートを既存の4SSR編集台帳と相互照合したうえで、以下の**確認済み事項と未解明の事項を別の値**で保持する。

| 項目 | 件数 | 意味 |
| --- | ---: | --- |
| 出典に連続として掲載された段階 | **12** | 4カード×3段階。選択肢数と数値報酬が採用済み |
| 連続段階内の報酬行 | **19** | 2択段階と選択肢なし段階の合計 |
| 選択・単一結果から次段階への遷移候補 | **15** | **継続・打ち切り両方とも未確証**の位置 |
| 連続12件に掲載されたスキルヒント | **8** | 数値IDとLvおよび発生段階は編集採用済み |
| 分岐単位で実証できた遷移 | **0** | ソースの記載不足。0件の遷移しか存在しないという意味ではない |
| 正式公開したイベント | **0** | 本工程で配信物を追加しない |

残る8件の数値スキルヒントは、**到達を明示した単一段階に限り**既存の `UmaCore.directRoutes` を用いて計算できる。検証入口 `replay({cardId,stageOrdinal,observed,selectedOptionOrdinal})` は `observed:true` を**利用者側が明示した場合だけ**対象段階を実行し、選択式は選択位置を指定しない限りヒントを追加しない。選択肢なしの段階も `observed:false` なら加算しない。返り値の全ヒントには `manualStageAssertionOnly:true` と未確認到達条件を付け、通常のデッキ計算の「無条件」経路に混入しない。

この手動到達は**実ゲームで既に検証済み**という意味ではなく、ユーザー・テストが「あえてこの段階が発生したケースを仮定する」と示す純粋関数の引数である。段階間の依存は内部に合成しない。連続イベントの実装を完了した・自動スキル獲得可能になったとは呼ばない。確認済みの通常イベント8件の**非公開草稿**は従来と同じ。元の `poc/data/reviewed_events.v1.json` と公開承認台帳は変更しない。

## 改変拒否と再現

```sh
node --test poc/tests/phase2_chain_manual_replay.test.cjs
node poc/tools/report_phase2_chain_manual_replay.cjs
node poc/tools/verify_event_release.cjs
```

- **A**：元の4SSR数値全20件を固定チェック。連続12段階・19報酬行・15未解決遷移・8ヒントを検査。未到達段階や未選択の分岐、存在しない第3選択肢、スキルLv改変、公開済み偽装を拒否。手動到達時は実際の `core.directRoutes` を通し、外部モデルのスキルID照合も任意で実施可能。
- **B**：上記公開記事は段階見出し・選択別報酬の根拠であり、未記載の連続打ち切りを「存在しない」とは認定しない。GameWithを例外裁定元とする数値事実の採用判断は既に完了。
- **C**：Node／GitHub Actions Chromiumの試験は本機能の内部ロジックのテスト。2026年ゲーム実機、Android/Windows物理端末、全カードの正確性、権利・公開許可は未実施のまま。正式公開イベント0件。

次は**後続遷移15位置**について、出典の「続行・打ち切り・結果依存」が特定できたものだけを明示した実イベントグラフへ進める。並行して固定GT既存カードの他の重点差異へ移り、4SSRの未解決を他の編集採用20件と混同しない。
