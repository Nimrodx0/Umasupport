# イベント到達条件スキーマ v1（2026-10-16）

## 目的と現在の実装範囲

選択式イベント、選択肢なしイベント、連続イベント、打ち切り、成功・失敗によって異なる**獲得候補**を機械可読にする。

**今回のスキーマとテストは架空データで検証した。公開版は今も通常ヒントのみで、実ゲームのイベントは未収録。** イベントを扱えるようになったこととイベントデータを取り込んだことを混同しない。

## データ構造

最上位は schemaVersion=1、cards の配列。それぞれ cardId、events を持ち、coverageStatus は partial（既定）または complete。

カードの cardId はカード辞書の実IDと一致させ、名前の類似で推測しない。

イベントの定義：
- id、name、type は必須。type は auto または choice。
- choice は choices 配列（各要素 id、label、任意の terminal、rewards、outcomes）を持つ。未選択なら報酬を集計しない。
- auto は、到達できれば直接の rewards を自動集計する。
- requires: {all:[{eventId,choiceId?},...]} は全条件を満たすと到達できる。親が choice なら choiceId 必須、親が auto なら不要。古い架空fixture形式の単一 requires:{eventId,choiceId} も認識する。
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
