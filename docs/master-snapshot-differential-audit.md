# 旧・新ゲームマスターSQLiteの差分監査器（Phase 2）

更新：2026-10-17。**仕組み実装と人工データ検証のみ。2026年現行ゲームの新しいSQLiteを入手したという意味ではない。**

## 目的

2025年の[固定旧マスター監査](story-residual-metadata-audit.md)には、現在採用しているUmaSim563枚のうち495枚が存在し、68枚は当時の資料にない。SSR30241の旧story_id=830241004は2025年版では存在する。将来、適正な手続きで**別時点の**master.mdb（SQLite）が用意できたときに、上記の版差とイベントの同一性を推測なく検証できるようにする。

- source population：UmaSim固定ファイルの563枚・レアリティと5段階（厳密検証済み）
- 旧master：2025-10-10の固定blob、SHA-256=46363929ab097edf164d78a1e8f8d212dbf8c440a7c44431079198ca167002cb
- 新master：**現在未入手**。リビジョン名／入手日時・由来の手作業での説明、SQLiteのファイル自体とSHA-256が必要

本ツールはゲームのAPI、暗号化データ、認証、保護機構にアクセスせず、与えられたローカルSQLiteの表と数値だけをread-onlyで比較する。

## 事前ゲート

**A 機構：** support_card_dataのID重複、single_mode_story_dataのID重複、存在しないカードへのリンク、text_data(category181)の名前欠損、表/列欠損を例外で停止させる。入力が同じSQLite・旧SHA不一致・新ソースのリビジョン記載なしでも停止する。人工旧版／新版のカード増減・同一story_id維持・名称変更・メタデータ変更の回帰試験を通常CIに含める。

**B データ（新マスター未入手のため未実施）：** 新旧masterを元の独立SHAと記録済みリビジョンで区別し、563枚に関する旧のみ・新のみのIDを分類。旧マスターに無かった68枚の新資料収録状況、旧ストーリーIDの存続・消失、SSR30241の830241004が同じカードに残っているか、タイトルが記号を除いた指紋で一致するか、生の数値メタデータが同じかを記録する。旧マスターのstory_id集合と新マスターの同集合の差分も報告。新資料が2026年のゲームに近いことは**取得元と時刻の証拠がない限り断言しない**。

**C 実機：** アプリの配信資産に変更なしのため今回不要。

## 実行方法

~~~sh
python3 poc/tools/compare_event_master_snapshots.py \
  --umasim local-data/support_card.txt \
  --old-master local-data/master-2025-10.mdb \
  --new-master local-data/master-supplied-new.mdb \
  --new-revision "入手元・入手日時・版の説明"
~~~

テスト（ネットワーク不要）：python3 -m unittest discover -s poc/tests -p 'test_compare_event_master_snapshots.py' -v

出力は、採用カードIDの集合・件数、2025年旧masterの数値story_id=830241004の有無・カード所属・数値メタデータ、日付の根拠とSHAのみ。ゲームの見出し・台詞・選択肢・報酬テキスト、指紋は標準出力に含めない。元masterをPublicへ同梱しない。

**制約：** 新マスターに記録があっても、同時点の育成シナリオでイベントが実際に発生する、あるいはアプリで配信できるという証明にはならない。新マスターに記録がなくても削除／更新／取得不完全を区別して扱う。イベント選択肢・報酬・ゲーム正式IDマッピング・再配布条件の別レビューが必要。

## ソース探査状況

2026年10月17日時点、2025年固定版より新しく、検証可能な数値ID・ハッシュと再利用条件を兼ね備えたmaster.mdbの公開取得元を本工程では**確定していない**。第三者のツールが「手元のmaster.mdbを読める」と記載することは、そのmaster.mdb本体を安全に再取得できることや、ゲームの現行版と同じことの証拠にはならない。[SimpleSandmanの保存リポジトリ](https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB) は2025年に運用を終了した旨を記載。新しいSQLiteの入手条件が整うまでBゲートは未通過。

関連：[ロードマップ](roadmap.md)、[検証基準](verification-plan.md)。公開DBの実イベント0件、Phase 2未完了を維持。
