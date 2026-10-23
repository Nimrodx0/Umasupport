# Phase 2：Checker P1の未対4位置は「同じ名前のGTイベント」ではなかった（2026-10-23）

## 結論（出典に基づく限定判定）

固定Checkerにイベント名だけの対応がないP1の4位置について、**GT同名イベントIDとの対応付けを行わない**。GameWithのカード記事・個別記事と、実GT固定イベントを再調査すると二種類に分かれる。

| Checker側のカード／元位置 | Checker側で確認する短見出し | GT固定データの参照イベント | 個別に確認した編集事実 | GT同一イベントか |
| --- | --- | --- | --- | --- |
| 30067／10 | 温かなメッセージ | 30067／GT位置10、1492「鍛えよ共に」 | グループサポカ共通の「温かなメッセージ」が元のトレーニングイベントへ追加の結果差を付ける | **GT本体と直接同一視しない** |
| 30081／12 | 温かなメッセージ | 30081／GT位置16、1478「おかわりトレーニング」 | 上と同じ共通イベント文脈で3択・成功失敗 | **GT本体と直接同一視しない** |
| 30137／10 | 温かなメッセージ | 30137／GT位置10、1510「三女神の気分転換トレーニング」 | 上と同じ共通イベント文脈で3択・シナリオ効果 | **GT本体と直接同一視しない** |
| 30160／10 | 労いのエール | 30160／GT位置2、1411「お疲れ様！！」 | 「労いのエール」は**海外時のみ**、「お疲れ様！！」は国内時。選択肢なし・大成功／成功でいずれもスキルヒントなし | **別イベント候補**（固定GT未収録） |

個別GameToraカード：[30067](https://gametora.com/ja/umamusume/supports/30067-the-thrones-assemblage)／[30081](https://gametora.com/ja/umamusume/supports/30081-team-sirius)／[30137](https://gametora.com/ja/umamusume/supports/30137-ancestors-guides)／[30160](https://gametora.com/ja/umamusume/supports/30160-mei-satake)。

GameWith編集資料：[温かなメッセージ共通イベント](https://gamewith.jp/uma-musume/article/show/414606)／[玉座の3択](https://gamewith.jp/uma-musume/article/show/352660)／[チームシリウス](https://gamewith.jp/uma-musume/article/show/324511)／[三女神](https://gamewith.jp/uma-musume/article/show/392647)／[佐岳メイ国内・海外](https://gamewith.jp/uma-musume/article/show/413773)／[労いのエール個別記事](https://gamewith.jp/uma-musume/article/show/414373)。

## なぜ前工程の仮説を訂正したか

[PR #201](https://github.com/Nimrodx0/Umasupport/pull/201)では関連していそうなGT/GW個別イベント名だけを確認した。Checker元イベントのタイトル`sourceKey`から**GT同名タイトルを再計算**すると、4位置とも一致しなかった。2026-10-23の固定全件CIで初めてその結果を実測した。

元Checkerの見出しタイトルを直接同梱・ログ転載する代わりに、固定Checkerアダプタと同じ**NFKC＋空白統一、カードID・NUL・イベント短見出し・NUL・0始まり位置、SHA-256前20桁**を算出し、`checker_event_hints.v1.json` の各`sourceKey`へ厳密一致させる。対応する記事短見出しを「共通の温かなメッセージ」と「海外の労いのエール」に訂正し、その限られた2種類だけを採用候補とする。

## 実装・安全条件

`poc/src/phase2_p1_source_title_join.cjs`は元`whole_event_provisional`の未対4位置、Checker候補の元ID・digest・条件行数、GTイベントのカードID・`events_ja`元位置・ローカルID・`special`・操作項目数・スキルヒント／打ち切り不在を検査する。4件のChecker分類見出しの正確な`sourceKey`を再計算し、一致／不一致を出す。コードに原文の選択肢セリフ・結果文章は入れない。

**一致したとしても、GTとCheckerのイベント本体の同一性を証明したことにはならない。** 次のように区分する。

- `COMMON_GROUP_CONTEXT`：共通イベントの名前を厳密識別。GTトレーニングイベントの成否・非スキル追加報酬について、GameWith側を元にした**限定編集**が可能。対応カードに新しいスキルヒントがあるとは判定しない。
- `OVERSEAS_SEPARATE_EVENT`：Checker「労いのエール」を別の海外限定イベント候補として識別。GT固定の国内用「お疲れ様！！」をこれで上書きしない。現行スキル獲得経路には直接関係しないが、**全イベント収録範囲としては独立して検討する**。
- `UNRESOLVED_CHECKER_TITLE`：元タイトルハッシュが一致しない場合は保留。表記・カード版差を想像して対応付けない。

いずれも現存2,512件の非公開実行候補、GT/Checker差異の全件統計、正式公開イベント0件、イベント内の技能・フラグに変更はない。佐岳メイの**別イベント**「時には仕事を忘れて」にあるスキルID201641（Lv5）とお出かけ終了分岐を混入させない。

## A/B/Cゲート

A：`node --test poc/tests/phase2_p1_source_title_join.test.cjs`。厳密タイトル・元ID・GT形状・Checker条件行、改変拒否、4件から3件に減らす不一致動作の合成テスト。

B：`.github/workflows/whole-event-inventory.yml`で固定GT559枚2,488件／Checker2,109件／UmaSim563枚を再取得・出典版確認し、4行の**元文言を含まない**結果を出す。[全件Action #39968475095](https://github.com/Nimrodx0/Umasupport/actions/runs/39968475095)で**4/4の短見出し分類キーが厳密一致**。内訳：グループ共通「温かなメッセージ」3／佐岳メイ海外別イベント「労いのエール」1。Checker未対元位置とGTカードID・元選択肢形状の改変拒否も成功。**GT同一イベントペアの追加0、結果経路同一性の確認0、正式公開0**。

C：通常の公開Webアプリの表示・設定保存・公開イベントには変更なし。物理端末C確認は対象外。

次工程：1) 3グループの「温かなメッセージ」成功失敗がGTの基本効果に足されるルートを、スキル以外の報酬としてどう保存するか判断する（現アプリの対象はスキル経路）。2) 30160海外限定別イベントを独立候補として形式化する場合、スキルなし／条件限定／公開審査未了と明示し、固定GTモデルに無断結合しない。
