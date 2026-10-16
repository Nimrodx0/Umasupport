# 公開イベントDBの初期取り込み手順（2026-10-16）

## 決定事項と現状

- サポカSSR・SRは、まずUmaUmaCheckerの公開データを初期収録の**候補**とする。
- 欠損カード5枚と今後の新規カードは、GameWithの該当カード個別記事を確認して補完する。定期的な全記事巡回は実施しない。
- ウマサルタント独自の公開DBは **poc/data/reviewed_events.v1.json**。GitHub Pagesから同一オリジンで配信する。
- 元データの文面や攻略文章を丸ごと移すのではなく、レビューで確定したカードID・スキルID・選択肢の効果・到達条件を独自データ形式にする。
- **本PR時点では実ゲームのイベント収録0件。** 初期JSONは空。変換器、検証、公開DB接続だけを実装した。

注意：UmaUmaCheckerのMITライセンス表記はアプリのソースコードについてのもの。GameWith由来データやゲーム内の文章を公開利用できると一律には判断しない。事実データと独自表現を扱う範囲は公開前に確認する。

## 1. まず読み取り専用でSSR・SRを監査

リポジトリルートでNode.js 22以上を使う。

~~~sh
node poc/tools/build_checker_catalog.cjs
~~~

このコマンドはUmaSimのサポカ一覧とUmaUmaCheckerのEvents.jsonを公開元から読み取り、SSR・SRのカード照合率、イベント数、選択肢行数、未照合カードIDを報告する。**元イベント文面を保存・標準出力に表示しない。**

ネットワークに接続せずローカルのファイルを使う場合：

~~~sh
node poc/tools/build_checker_catalog.cjs --local local-data/support_card.txt local-data/Events.json --candidates local-data/candidates.json
~~~

local-dataディレクトリはgitignore対象。candidates.jsonには、カードIDと、元の配列上の番号（sourceIndex）、イベント識別子（sourceKey）、元のタイトル・選択肢・効果文全体のSHA-256（sourceDigest）、選択肢の件数だけを記録する。**イベント名・選択肢原文・効果原文は含まない。**

カード名の揺れは推測で自動統合しない。人手で対応を確認したときだけ、別ファイルに実ID→元ソースのカード表示名を明記して --aliases local-data/aliases.json を指定する。同一カードの同名イベントは消去・統合せず、別々のsourceIndexを持つ候補とし、duplicateTitleフラグで追加レビューを要求する。

## 2. イベントごとに事実・分岐・報酬をレビュー

元のEffectフィールドは自然言語であり、成功・失敗・連続イベント順・途中終了が正式なフィールドに分離されていない。未確認のイベントを自動的に獲得可能なスキルとして登録してはならない。

local-data/reviews.jsonの形式（以下は実データでなく、説明用の架空例）：

~~~json
{
  "schemaVersion": 1,
  "events": [
    {
      "sourceKey": "checker:30001:0123456789abcdef0123",
      "sourceDigest": "sha256:the-actual-digest-from-candidates",
      "cardId": "30001",
      "chainVerified": true,
      "rewardSemanticsVerified": true,
      "publicationReviewed": true,
      "event": {
        "id": "checker:30001:0123456789abcdef0123",
        "name": "架空イベント",
        "type": "choice",
        "choices": [
          { "id": "go", "label": "継続", "rewards": [{ "skillId": "hint:架空速度", "level": 1 }] },
          { "id": "stop", "label": "終了", "terminal": true }
        ]
      }
    }
  ]
}
~~~

分岐条件・成功失敗には、イベントv1スキーマのrequires・outcomesを使う。sourceDigestがソースの更新により変われば旧レビューは拒否する。同名イベントはduplicateTitleReviewed:trueを追加要求する。金スキル等で未照合のスキルIDは内部辞書への対応確定まで登録を拒否する。

**承認フラグはレビュー完了記録であり、GameWith等の著作権者からの許諾を代替しない。** 名称・ラベルの公開可能性も個別に検討する。

## 3. 公開DBへ出力する

~~~sh
node poc/tools/build_checker_catalog.cjs --local local-data/support_card.txt local-data/Events.json --aliases local-data/aliases.json --review local-data/reviews.json --output local-data/reviewed_events.v1.json
~~~

出力するのは、レビューJSONのeventオブジェクトに明示した事実・構造のみ。元データのイベントタイトル、選択肢や効果文章を自動複製しない。出力形式はschemaVersion:1とcards配列を持ち、各カードのcoverageStatusはpartial固定。

確認を通した結果だけを **poc/data/reviewed_events.v1.json** に反映する。生成前にイベントID、カード実ID、スキルID、到達条件、循環、打ち切り、重複を検証。公開JSONはブラウザで誰でもダウンロードできることを前提にする。

## 4. サービス側の動作

poc/live.htmlはUmaSimの通常ヒントを取得した後、同一サイトのイベント公開JSONを取得して検証してカードに追加する。イベントJSONの取得・検証に失敗しても、通常ヒントは利用できる。イベントは公開用の0件から開始し、**既存イベントへのオフライン復帰はまだ未実装**。

## 5. 残る課題

- UmaUmaCheckerの417カード見出しのうち24件は名前の表記が異なる。ゲーム内IDで個別確認してエイリアスを承認する。
- 5枚のSSRはイベントレコード0件。GameWithの個別記事の利用条件と情報の抽出形式を確認して追加する。
- イベントがある412枚についても、各カードの全イベントが揃っていることはまだ実証されていない。
- 成功失敗・途中打ち切りの整理、イベント固有スキルのID統合、ソース利用条件の確認が完了するまでは、実イベントを自動収録しない。
- GameWith個別記事の抽出コードと定期更新ジョブは今回未実装。必要なカードのみを処理するための運用は次の工程で決める。
