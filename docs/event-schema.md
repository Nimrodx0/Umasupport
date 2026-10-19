# イベント到達条件スキーマ v1（2026-10-16）

## 目的と現在の実装範囲

選択式イベント、選択肢なしイベント、連続イベント、打ち切り、成功・失敗によって異なる**獲得候補**を機械可読にする。

**今回のスキーマとテストは架空データで検証した。公開版は今も通常ヒントのみで、実ゲームのイベントは未収録。** イベントを扱えるようになったこととイベントデータを取り込んだことを混同しない。

## 2026-10-19更新：外部出現条件と連続イベント内部の分岐を分離

**外部出現条件は対象外**：ランダムなイベント発生率・絆・ターン等の再現は要求しない。

**連続イベント内部の条件は必須**：親イベントの選択肢によって次段の選択肢・報酬・進行／打ち切りが変わるとき、`requires` と `terminal` を設定し、到達不可のイベント報酬を集計しない。前段の選択を変えたら従属する後段の選択を消去する。別の後段A／後段Bをそれぞれ異なる親 `choiceId` に接続可能。

親 `choice` イベントの `requires` に `choiceId` を省略した場合、いずれかの**選択済みかつ非打ち切り**選択肢で継続することを表す。どの選択肢でも続くと資料で確認できない限り、`choiceId` を省略して分岐を推測しない。

**現行の制約**：成功／失敗という結果 `outcomeId` 自体により次段の種類が変わる依存は未対応。このケースがデータに存在すれば、結果の選択状態・依存スキーマ・表示／集計を拡張してから「経路再現済み」とする。PR #106の数値ファクト879件に連続内部の分岐情報はないため、試用版の結果は分岐再現済みとみなさない。

## データ構造

最上位は schemaVersion=1、cards の配列。それぞれ cardId、events を持ち、coverageStatus は partial（既定）または complete。

カードの cardId はカード辞書の実IDと一致させ、名前の類似で推測しない。

イベントの定義：
- id、name、type は必須。type は auto または choice。
- choice は choices 配列（各要素 id、label、任意の terminal、rewards、outcomes）を持つ。未選択なら報酬を集計しない。
- auto は、到達できれば直接の rewards を自動集計する。
- requires: {all:[{eventId,choiceId?},...]} は全条件を満たすと到達できる。親が choice なら選択済みかつ非打ち切りが必須。特定選択だけを要求するときは choiceId を明示し、すべての非打ち切り選択から進めると資料で確認できた場合にだけ省略可能。親が auto なら choiceId 不要。古い架空fixture形式の単一 requires:{eventId,choiceId} も認識する。
- terminal:true を選んだ場合は、後続イベントが到達できない。打ち切りルートから後続に接続する不正データは拒否する。
- rewards は {skillId,level?,condition?}。outcomes は id、label、rewards を持つ2つ以上の排他的候補。「成功」「失敗」の報酬をどちらも条件付き候補として扱い、確率や実際の獲得を保証しない。
- outcomeId を用いた後続イベントの到達条件は現段階で未対応。不明確な結果分岐を勝手に補完せず、検証時に拒否する。

## 架空データによる例

以下は実ゲームデータではなく、テスト用の架空カードAと架空スキルIDである。

~~~json
{
  "schemaVersion": 1,
  "cards": [{
    "cardId": "A",
    "coverageStatus": "partial",
    "events": [
      {
        "id": "a1", "name": "架空・練習の分岐", "type": "choice",
        "choices": [
          {"id":"go","label":"継続"},
          {"id":"stop","label":"打ち切り","terminal":true}
        ]
      },
      {
        "id":"a2","name":"架空・練習の結果","type":"auto",
        "requires":{"all":[{"eventId":"a1","choiceId":"go"}]},
        "outcomes":[
          {"id":"success","label":"成功","rewards":[{"skillId":"kunrin","level":1}]},
          {"id":"failure","label":"失敗","rewards":[{"skillId":"step","level":1}]}
        ]
      }
    ]
  }]
}
~~~

## 照合・件数計測とフェイルクローズ

poc/src/event_schema.js の validateCatalog(catalog, model) は、登録済みカードID／スキルID、重複イベントID、未定義の親、循環、打ち切りから後続への接続などを検査し、不正なら全入力を拒否する。

戻り値の totalModelCards、cardsWithRecords、eventsWithRecords、perCard[cardId] は**入力カタログに何件含まれるか**だけを表す。実ゲーム上の全イベントの網羅率とは異なる。coverageStatus=complete は入力元の申告であり、第三者に確認された完全性ではない。

poc/src/core.js は親イベントの到達可否を連鎖的に評価する。先行分岐未選択・打ち切りルートの場合は報酬を計上しない。提供枚数は、同カードに複数経路があっても1枚。

## 実ゲームデータ導入の条件

- 第三者公開元のイベント文とゲームデータの利用条件を確認する。単なる公開・閲覧可能を再配布権限や再利用許諾とみなさない。
- イベントレコードとUmaSimのカードゲーム内IDを一致させ、ゲーム内での連続順と打ち切り・成功失敗を個別検証する。
- スキル辞書にないイベント固有スキルや金スキルの正式IDを整備する。未収録IDを根拠なしに通常ヒントへ一致させない。
- 取得・変換・キャッシュ戦略はデータソース別に独立して評価する。UIへの手動更新ボタンは設けない。
- 現段階では、取得先の条件や対応表が確定していないため公開版に第三者イベントデータを追加しない。

## 外部イベントソースとの接続

[実ソース照合記録](event-source-audit.md) にID一致・例外・スキル未照合をまとめた。`poc/src/event_review_compiler.js` は、個別イベントの到達・打ち切り・報酬条件を `chainVerified:true` と `rewardSemanticsVerified:true` でそれぞれ確認し、数値スキルID対応も明示したの場合に限ってスキーマv1を出力する。元JSONの `defaultChoiceId` を育成で選択済みのルートとみなしてはいけない。

## 選択分岐に依存しない連続継続（2026-10-16、PR #20）

従来の `requires:{all:[{eventId,choiceId}]}` に加え、**親が選択式でも** `requires:{all:[{eventId}]}` を記述できるようにした。この場合「親の選択肢が実際に一つ選ばれ、かつ打ち切りではないなら後続へ進む」意味。未選択、打ち切りは後続へ進まない。すべて打ち切り選択肢の親をこの形で参照することは検証エラー。`src/core.js` の実行時判定と検証器を一致させた。

このルールはイベントの発生率や成功失敗の自動確定を意味しない。Game8の欠損4枚の**検証用候補**と、残り1枚の未確認記録は [Game8のSSR欠損監査](game8-missing-ssr-review.md) を参照。

## 2026-10-18：結果分岐のレビュー済みオーバーライドと公開条件（PR #67）

`src/event_review_compiler.js` で第三者候補JSONを公開JSONへ変換する際、イベントごとの `chainVerified:true`（到達条件）、`rewardSemanticsVerified:true`（報酬）、`selectionSemanticsVerified:true`（選択式か自動発生か）、`publicationReviewed:true`（出典・転載等の公開可否）を**それぞれ独立して要求**する。候補配信の `selection=auto` は計画用の分類であり、これを検証せず実ゲームでの無条件取得へ変換してはならない。

候補が `selection=single` の場合、レビュー入力の任意項目 `choiceOutcomeReviews` で**各選択肢の複数の結果別報酬**を指定できる。例は架空のIDと名称のみ：

~~~json
{
  "sourceEventId": "evt_30242_1",
  "cardId": "30242",
  "chainVerified": true,
  "rewardSemanticsVerified": true,
  "selectionSemanticsVerified": true,
  "publicationReviewed": true,
  "choiceOutcomeReviews": {
    "go": [
      {"id":"success","label":"成功","skills":[{"skillId":2001,"skillName":"架空速度","hintLevel":1}]},
      {"id":"great","label":"大成功","skills":[{"skillId":2001,"skillName":"架空速度","hintLevel":5}]}
    ],
    "stop": [
      {"id":"success","label":"成功","skills":[]},
      {"id":"great","label":"大成功","skills":[]}
    ]
  }
}
~~~

この入力は**既存の候補レコードにあるすべての選択肢に対する結果リストが揃う場合だけ**受け付ける。欠落・余分なID・重複結果・2種類未満の結果・未承認のスキルID/名称を拒否する。外部候補にある既定選択・平坦化報酬を併用せず、承認済み結果だけを公開スキーマの `choices[].outcomes` へ変換する。実行時の `core.directRoutes` はどの結果のスキルも **conditional=true** として扱い、成功・大成功双方のLvを区別する。

`choiceOutcomeReviews` なしの場合は既存の選択枝の `rewards` を維持するが、上記4承認の省略は認めない。レビュー入力は第三者が公表するイベント本文から自動生成されるものではない。独立の検証と公開許諾の審査が必要。今回の検証は人工イベントだけで、SSR30311等の実イベントは**0件のまま**。

## 2026-10-18：無条件報酬と結果別報酬の混在拒否（PR #69）

公開イベントスキーマv1の同じイベント／選択肢に `rewards`（結果条件なし）と `outcomes`（成功・大成功等の排他的な結果候補）が同時に指定された場合、**データ全体を検証失敗として拒否**する。外部候補に「大成功のみのスキル」が平坦化されたまま残った状態で、成功・大成功の結果を追加すると、大成功のスキルが無条件でも獲得できるかのように集計される危険があるため。

共通の報酬がある場合も各レビュー済み結果の `outcomes[].rewards` に明記し、未検証の共通報酬を勝手に確定扱いしない。既存の正常な架空イベント・条件付きの集計は維持。ブラウザ公開JSONを取り込む `public_event_catalog.attach` でも破損入力の**原子的拒否**を人工テストし、通常ヒントと以前の承認済みイベントを保護する。この変更は実イベントの公開承認やゲーム内結果確率の確定ではない。
