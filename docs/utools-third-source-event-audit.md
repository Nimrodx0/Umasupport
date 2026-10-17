# SSR30241：第三資料のイベント見出し照合（2026-10-17）

対象：[2025年版マスターstory_id監査](story-residual-metadata-audit.md)の未一致ID **830241004**。2026年10月17日のSSR30241（グループ「［導きの光］伝説の体現者」）について、UmaUmaCheckerの候補イベント17件と2025年旧masterカード直結18件を、[U-toolsイベント一覧](https://xn--gck1f423k.xn--1bvt37a.tools/supports/30241/event)の見出しで第三者照合する。

## 事前合格条件

**A 機構：** HTMLのカード名・「連続イベント」「ランダムイベント」・「エピソード」の構造が崩れている場合は監査を失敗にする。見出しの件数と標準のNFKC＋空白・句読点除去の指紋が一致するかを、人工HTMLの単体テストで確認。同名の多重集合を保持して旧IDを誤認しない。外部文字列の内容や指紋は標準出力／GitHubへ公開しない。

**B 限定実データ（事前目標）：** 2025年固定SQLite／2026-10-17固定Checker／U-toolsの該当1ページを取得できる場合に限り、旧masterの18、Checkerの17、U-toolsの見出しと相互一致数、特に830241004の見出しが第三サイトにもあるかを判定する。取得できない場合は**B未実施・未確定**として止める。U-toolsの2026-10-17時点での最終更新日・独立した一次データ元は不明。3サイトの一致は公式ゲーム内実装の独立証明とはしない。

**C 実機：** 配信アプリUIや公開イベントDBに変更なし。実機操作は今回不要。

## 方法・出典

- 固定2025年masterと固定Checkerの監査は[限定的実ソースワークフロー](../.github/workflows/historical-event-master-audit.yml)を継続。U-toolsサイトは**GitHub ActionsからHTTP 403でアクセス不可**のため、自動取得を試みるステップを削除した。サイトの制限を回避せず、HTMLを正当に入手できた場合だけローカルの一時ファイルを入力とする。データ取得・パースの障害を「イベントが無い」とは解釈しない。
- [監査コード](../poc/tools/audit_three_source_event_headings.py)はページ見出しと旧masterのカード直結story_idを、推測で直接1対1結合しない。全て「タイトルの一致候補」のみ。
- [人工データテスト](../poc/tests/test_three_source_event_headings.py)は正常時、ソースにしかない見出し、旧masterの重複タイトル、ページ構造の崩れを検証する。

**未解決の課題：** 同じ表記であっても、発生するシナリオ・条件、選択肢、報酬、金スキル、現在のゲーム実装、転載可能性の別証明が必要。U-toolsとCheckerが共通元を持つ可能性を除外しない。正式イベントDB0件を維持する。

## 実ソース結果

2026-10-17の[U-toolsカード個別公開ページ](https://xn--gck1f423k.xn--1bvt37a.tools/supports/30241/event)をページ閲覧で確認すると、連続イベント5見出しとランダムイベント13見出しの**計18見出し**がある。2025年master側の直接ストーリー18件・Checkerの候補17件との数の比較としては追加の傍証。ただし独立した収録体系か、見出しが全て実ゲームで現役かは不明。

限定Actions [#39039021792](https://github.com/Nimrodx0/Umasupport/actions/runs/39039021792)では外部サイトへの単発取得が**HTTP 403で失敗**。本来予定したU-tools見出し18件と旧masterの18件の名称ハッシュ・数値story_idペアの自動検証は**未実施**であり、830241004がU-toolsに掲載されているかは確認できない。404やデータ0件という意味ではない。サイトのアクセス制限を回避せず、外部GETステップを通常の限定CIから除いた。人工HTMLを用いたA機構テストのみCIに残す。

再現手順（元SQLite、UmaSim、Checker候補JSONおよびHTMLはローカルに合法的に用意し、Publicには置かない）：

~~~sh
python3 poc/tools/audit_three_source_event_headings.py \\
  --umasim local-data/support_card.txt \\
  --master local-data/master.mdb \\
  --candidates local-data/candidates.json \\
  --external-html local-data/utools-30241.html \\
  --focus 30241
~~~

**判定：A=人工HTMLテスト成功、B=公開ページの計18見出しを目視計数のみ、3者名称一致・830241004との対応は未検証、C=今回のUI変更なし。** Phase 2未完。
