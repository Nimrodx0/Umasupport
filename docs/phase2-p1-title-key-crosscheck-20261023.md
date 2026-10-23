# Phase 2：Checker P1の4位置をGTイベントIDと短見出しハッシュで限定照合（2026-10-23）

## 目的と母集団

既存の[条件付き4位置の監査](phase2-four-p1-conditional-result-review-20261023.md)で、Checker未対イベントとして30067/10、30081/12、30137/10、30160/10が残った。これらはChecker原候補からスキルヒントが検出されないが、単に0件だから欠損なしと断言することも、GameWithの類似名だけで同一イベントと断定することもできない。

本監査はGT固定 `systemless10/UmamusumePS@6e38b54` の`events_ja`、Checker固定 `Cilda/UmaUmaChecker@8cf9fcb3` のタイトルから構成した`sourceKey`、既存の**テキストなし2,109件Checker候補**と固定`whole_event_provisional`索引を、4カード／4位置に限り照合する。GameTora個別カードページを既に確認済みとし、GameWithの対応記事で使用されるイベント短見出し・限定された条件付き説明のみを対象とする。

| カード／Checker位置 | GT固定イベント位置／ローカルID | GameWith見出し・報酬の参照 |
| --- | --- | --- |
| 30067/10 | 10／1492 | [鍛えよ共に](https://gamewith.jp/uma-musume/article/show/352660) |
| 30081/12 | 16／1478 | [おかわりトレーニング](https://gamewith.jp/uma-musume/article/show/324511) |
| 30137/10 | 10／1510 | [三女神の気分転換トレーニング](https://gamewith.jp/uma-musume/article/show/392647) |
| 30160/10 | 2／1411 | [お疲れ様！！](https://gamewith.jp/uma-musume/article/show/413773) |

GTのカード確認：[30067](https://gametora.com/ja/umamusume/supports/30067-the-thrones-assemblage)、[30081](https://gametora.com/ja/umamusume/supports/30081-team-sirius)、[30137](https://gametora.com/ja/umamusume/supports/30137-ancestors-guides)、[30160](https://gametora.com/ja/umamusume/supports/30160-mei-satake)。

## 実装と意味の区分

`poc/src/phase2_p1_source_title_join.cjs` は既存Checkerアダプタと同じ**NFKC＋空白統一、カードID＋NUL＋元イベント短見出し＋NUL＋0始まり位置のSHA-256先頭20桁**から`sourceKey`を独立再計算する。タイトル候補は個別GameWith記事の短見出しと、その直後に「(温かなメッセージ)」が付く場合の表記だけを許可する。カード名や別カードの一般的な類似度で自動突合しない。

同時にGTのカード・`events_ja`順序・元ローカルID・`special`区分・操作項目数、当該GT効果にスキルヒントおよび`chain_end`がないこと、元Checkerの条件行数・候補スキルなし・出典ダイジェストを検証する。不変条件が変化すれば**監査を停止**する。タイトル`sourceKey`一致が見つからない場合は保留にし、偽の同定はしない。

重要：この検査が一致しても確認できるのは**カード内の出典見出しと操作項目形状の限定的な対応**であり、Checker掲載の成功／失敗とGT元の非スキル効果の完全な意味同一性ではない。従って正式な分岐・結果承認、元65差異の台帳件数、技術用2,512イベント、スキル候補数、公開承認は一切変えない。30160の別イベント「時には仕事を忘れて」のヒントID201641・連続お出かけ終了も本件と混同しない。

## A/B/C

- **A**: `node --test poc/tests/phase2_p1_source_title_join.test.cjs`。ソース見出し差、GT ID・位置・イベント選択肢・スキル・終了フラグ改変を拒否し、未同定時は自動追加しない。
- **B**: `.github/workflows/whole-event-inventory.yml`で実固定元2,488 GT／2,109 Checkerイベントを読み取り、個別4イベントに限定して`audit_phase2_p1_source_title_join.cjs`を実行。結果の一致件数はActions実測から追記する。
- **C**: 通常Pagesのアプリ、正式公開JSON、ユーザー保存値は無変更。Windows／Android実機試験はこの差分の対象外。

次は今回のハッシュ一致候補についてChecker条件付き結果群とGameWithの同名イベントの各結果の対応を追加で照合し、意味同一性を別に審査する。確証のない結果や報酬を創作しない。
