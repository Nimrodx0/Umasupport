# 公開イベントDBの審査ゲートと旧Checker候補取込手順

**現在有効な取得元方針：GameTora由来の固定データが基準**。Checkerは別ソースの欠落・矛盾の発見に用い、GameWithは特定の疑義・欠落の裁定に限る。[現行のGameTora優先決定](gametora-baseline-event-policy-20261021.md)、[差異ごとの優先監査](phase2-cross-source-completeness-exceptions-20261022.md)を参照。

この文書のChecker入口を前提としたCLI例や旧PRの節は、**当時のChecker限定の収集・レビュー機構の手順と経緯**として保存する。新規開発でこの手順を全件イベントの第一資料取込に採用するという意味ではない。数値上の候補レコードを、元ソースの実選択肢の証拠にすることもできない。公開JSONと独立のレビュー／権利ゲートは現行のまま維持する。

## 決定事項と現状

- 全サポートカードのイベント候補はGameTora由来データを**基準**とする。Checkerは収録不足、イベント同定・分岐・報酬の不一致を検出するために照合する。
- GameTora固定版にないカードは**SSR30318〜30321の4枚**、Checker側の追加イベント候補は各5件で計20件。GameWithは**これらの局所的な欠落や不一致の裁定**に利用し、全件をGameWithで作り直さない。[固定元の欠落台帳](phase2-missing-gametora-cards-20261022.md)。
- ウマサルタント独自の公開DBは **poc/data/reviewed_events.v1.json**。GitHub Pagesから同一オリジンで配信する。
- 元データの文面や攻略文章を丸ごと移すのではなく、レビューで確定したカードID・スキルID・選択肢の効果・到達条件を独自データ形式にする。
- **本PR時点では実ゲームのイベント収録0件。** 初期JSONは空。変換器、検証、公開DB接続だけを実装した。

注意：UmaUmaCheckerのMITライセンス表記はアプリのソースコードについてのもの。GameWith由来データやゲーム内の文章を公開利用できると一律には判断しない。事実データと独自表現を扱う範囲は公開前に確認する。

## 1. 旧Checker候補の読み取り専用監査（欠損調査に限定）

リポジトリルートでNode.js 22以上を使う。

~~~sh
node poc/tools/build_checker_catalog.cjs
~~~

このコマンドはUmaSimのサポカ一覧とUmaUmaCheckerのEvents.jsonを公開元から読み取り、SSR・SRのカード照合率、イベント数、選択肢行数、未照合カードIDを報告する。**元イベント文面を保存・標準出力に表示しない。**

ネットワークに接続せずローカルのファイルを使う場合：

~~~sh
node poc/tools/build_checker_catalog.cjs --local local-data/support_card.txt local-data/Events.json --candidates local-data/candidates.json
~~~

local-dataディレクトリはgitignore対象。candidates.jsonには、カードIDと、元の配列上の番号（sourceIndex）、イベント識別子（sourceKey）、元のタイトル・選択肢・効果文全体のSHA-256（sourceDigest）、選択肢の件数だけを記録する。**イベント名・選択肢原文・効果原文は含まない。2026-10-17から各候補へ `titleFingerprint`（正規化イベント名のSHA-256）と `typographicFingerprint`（記号・空白除去＋小文字化した**補助診断専用**SHA-256）も追加し、[旧マスターのイベント名監査](event-title-fingerprint-audit.md)で一時利用する。これは正式ゲームイベントIDではなく、候補ファイルそのものをPublicへコミットしない。**

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
      "selectionSemanticsVerified": true,
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

poc/live.htmlはUmaSimの通常ヒントを取得した後、同一サイトのイベント公開JSONを取得して検証してカードに追加する。イベントJSONの取得・検証に失敗しても、通常ヒントは利用できる。イベントは公開用の0件から開始した。**2026-10-22以降は**公開イベントJSONをカード・スキル現行モデルに照らして検証後のみIndexedDBに保存し、取得失敗・破損更新時は検証済み旧版を再検証して復帰する。キャッシュも不正・未保持ならイベントは反映せず、通常ヒントのみ表示する。これはHTTPでアプリ本体を読み込める状況での**イベントデータ取得先だけの障害復旧**であり、HTML/JSの完全オフライン起動は保証しない。詳細は[最新の運用・受入記録](f08-reviewed-event-cache-acceptance-20261022.md)。

## 5. 残る課題

- UmaUmaCheckerの417カード見出し中24件の異表記は、明示エイリアスとして名前対応済み。ただしソース名対応とゲーム内正式イベントIDの照合は別で、未検証のイベント本体には承認が必要。
- **旧Checker限定監査時点の記録**：5枚のSSRは当時のCheckerイベントレコード0件だった。**現在のGameTora基準の未収録4SSRとは別の指標であり、現行の未収録数と混同しない。**
- イベントがある412枚についても、各カードの全イベントが揃っていることはまだ実証されていない。
- 成功失敗・途中打ち切りの整理、イベント固有スキルのID統合、ソース利用条件の確認が完了するまでは、実イベントを自動収録しない。
- GameWith個別記事の抽出コードと定期更新ジョブは今回未実装。必要なカードのみを処理するための運用は次の工程で決める。

## 2026-10-16追加：表記差24件とGameWith掲載状態

[検証記録](checker-aliases-and-gaps.md) のとおり、UmaSimとUmaUmaCheckerのSSR・SR **全417枚の名称対応候補**を確定。CLIは標準で `poc/config/checker-name-aliases.json`（24件）を使用する。`--no-aliases` なら厳密名称一致393枚のみを再監査できる。24件はソース名の一意な対応であり、正式なゲーム内イベントIDではない。

`poc/config/gamewith-ssr-review-status.json` はGameWithの欠損5枚の個別記事についてイベント詳細の掲載状態を保持。1枚に内容掲載、3枚はイベント欄「検証中」、1枚は未確認。「検証中」をゲーム内イベントが存在しない証拠とみなさない。実イベント公開DBは引き続き0件。

## 数値ID報酬の公開形式（2026-10-17）

実装された `poc/src/skill_bridge.js` は、レビュー済みイベントJSONのスキル報酬で次の記法を受け付ける。現時点で公開DBは空であり、以下は**形式説明の架空例**。

~~~json
{"skillId":"skill:123456","verifiedSkillName":"架空スキル名","level":2}
~~~

- `skill:123456` はUmaSimの数値IDを参照するキー。実行時に `skill_data.txt` を取得してID・名称を厳密照合する。
- `verifiedSkillName` はレビュー時に確定した照合対象名。実行時に元データと一致しなければ**イベントJSONを丸ごと拒否**する。既存の `hint:名称` 形式は引き続き使用可能。
- 名前が一意一致する通常ヒントがあれば、集計時にその `hint:名称` へ統合。名称重複は勝手に同一スキルと見なさない。
- イベント専用の金スキルを登録しても、白スキルとの上下関係・イベント発生条件・成功率は自動推論しない。
- 当初のID変換層はイベント0件なら報酬変換用辞書の追加取得不要としていたが、現在は金白階層の全件表示のため**イベント0件でもスキル辞書を起動時に取得**する。辞書を取得できない場合も通常ヒントは表示できる。

**公開前レビューでは、イベント到達条件・報酬・権利確認は別途すべて必須。** 元データに記載の数値IDが見つかることはこれらの承認ではない。

## 金白辞書の全件対応（2026-10-16）

金白対応は `poc/src/skill_hierarchy.js` の実行時全件グルーピングを使用する。通常ヒントと同一名称・一意な場合は既存 `hint:名前` に統合し、固有の金・白は `skill:数値ID` とする。起動時にスキル辞書を取得し、3段階の○・◎・金を相互にリンクする。公開イベントDBは実イベント0件のまま。[実測・例外の資料](skill-hierarchy-coverage.md)参照。

## 2026-10-18：選択式イベントを自動報酬に変換しないゲート（PR #68）

`checker_candidate_pipeline.publishReviewed` でも `selectionSemanticsVerified:true` を独立必須とした。候補インベントリに保存済みの `optionCount` が2以上の場合、手動レビューで `type:auto` としたり、候補側の選択肢数より公開 `choices` が少ない／多いイベントは**拒否**する。候補ソース本文を表示・転載する必要はなく、候補のハッシュ・選択肢の個数だけを使った検査となる。複数結果（成功／大成功）は選択肢数を増やすのでなく、各 `choices[].outcomes` に記述する。

元ソース `optionCount` が0または1の場合、この件数だけでは自動イベントなのか選択式なのか判定できないため、`selectionSemanticsVerified` を個別に取得する必要がある。2以上の場合も**数の一致が実ゲームでの効果と全結果の正確性を証明するわけではない**。本文・スキル報酬・分岐条件・配布権利のレビューと2026年のゲーム照合は依然必要。

従来のレビューmanifestで `selectionSemanticsVerified` が欠けているものは今後拒否する。これは未確認報酬を公開しないための意図的な仕様変更。架空データの回帰で複数枝→auto、枝数不足、候補メタデータ欠落、成功／大成功の条件付きスキル2経路を検証。公開実イベント0件を維持。

## 2026-10-18：公開JSONと人手レビュー証跡をCIで突き合わせる（PR #70）

レビュー変換器の承認フラグだけでは、後から公開ファイルを編集した場合に、その版が本当にレビューされたかを追跡できない。そのため公開前の最終ゲートを追加した。

- `poc/data/reviewed_events.v1.json`：配信するイベント本体。
- `poc/config/event-release-approvals.v1.json`：配信イベントIDごとのレビュー者、日付、6観点の明示承認、各観点のHTTPS根拠URL、公開利用判断、およびイベント内容のSHA-256。**資料本文やゲーム画像は保存しない**。
- `node poc/tools/verify_event_release.cjs`：両ファイルを読み、**カタログに存在する全イベントに完全一致する承認が1件ずつ**あるかを検査。イベントのスキルLv、選択肢、到達条件などを変更すると、キー順序を正規化して算出するSHA-256が変化し、以前の承認では通らない。未承認・余分な承認・重複・不足根拠・不正なURL・`coverageStatus=complete` を拒否する。
- 通常CIは、外部GETなしで公開JSONと承認台帳の現物を必ず検査する。台帳は現在 `entries: []`。公開JSONも0件で、両方が空であることが合格条件。

台帳に記載する `checks` は `card` / `event` / `choices` / `outcomes` / `dependencies` / `publication` の6つをすべて `true` とする。各 `evidence` 配列に参照元のHTTPS URLを1件以上記録し、`publicationBasis` には公開の根拠区分（`permission` / `open-license` / `original-factual-description`）と判断理由を記録する。**この仕組みが第三者の権利を自動判定したり、資料が独立していること、ゲーム内報酬が正しいことを保証するわけではない。** 実ゲーム照合・利用条件・結果分岐の確認は責任者が別途行い、根拠をレビューして初めて承認欄を完成させる。

いずれか一つでも不足した実イベントは、公開JSONへ入れてもCIを通過できない。正式リリースの全件性は依然未検証のため、カードの `coverageStatus=complete` はゲートで認めない。

## 【旧運用・撤回済み】2026-10-18：GameWithをイベント効果の暫定正本にした当時の運用

**現行ではこの節を実装方針として用いない。** 2026-10-21に[GameTora基準／GameWith個別裁定](gametora-baseline-event-policy-20261021.md)へ明確に切り替えた。以下は当時の判断履歴であり、全イベント収録をGameWith-firstに戻す指示ではない。

**攻略サイト間で数値・効果が矛盾した場合は、GameWithの該当サポカ記事を優先してレビュー入力を作成する。** 一致するまで複数記事を追加検索する作業を必須にしない。対象はイベントの効果・報酬数値で、ゲーム内イベントIDとカードID、連続条件、発生条件の確証とは別問題。サイトの掲載時点とURL、他サイトとの既知の不一致、例外はレビュー記録へ残す。GameWithが未掲載なら未解決にするか明示的な例外レビューを行い、他サイトから無断で穴埋めしない。

**現行の公開イベント形式は獲得スキルとヒントLvのみをモデル化し、体力・絆ゲージ・ステータス報酬はアプリに表示・計上しない。** これらの数値差は監査でGameWith優先と記録するだけに留め、スキル経路の初期収録を停止しない。

この優先はGameWithが絶対的に正しいと立証したものではなく、公開判断・第三者データ利用条件にも影響しない。正式な公開JSONへ反映するには従来どおり選択方式、結果別スキルとヒントLv、到達条件、実ID、出典と公開利用の根拠を個別承認し、イベント本体SHAを照合する。[意思決定ログ](decisions.md)／[SSR30311差異記録](unreviewed-event-numeric-candidate-audit.md)／[数値優先ポリシー](../poc/config/event-source-priority.v1.json) を参照。
