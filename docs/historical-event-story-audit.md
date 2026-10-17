# 2025年ゲームマスター由来サポカ・ストーリーIDの照合

検証対象：Phase 2。採用母集団は2026-10-13固定UmaSimサポカ563件。2025年10月の固定ゲームマスターSQLiteと2026-10-17固定UmaUmaCheckerを、**数値ID・件数だけ**で比較する。全イベント収録の証明ではない。

## 分母と根拠

- [UmaSimの固定support_card.txt](https://github.com/mee1080/umasim/blob/cf9366f6a487bd8f197b53d8a11981207beb9f6c/data/support_card.txt)：0〜4凸の5段階の存在、IDとSSR/SR/Rを検査。
- [2025-10-10の独立マスター](https://github.com/SimpleSandman/UmaMusumeMetaMasterMDB/tree/5a8ec1356859a35e245edef0d40da740e652df68/master)：support_card_data.idで当時のカードIDの存在を確認。single_mode_story_dataのgallery_flag=2かつsupport_card_id>0という条件でカード直結のストーリーIDを数える。[Wikiのソース処理](https://umamusu.wiki/Module:Game/Supports/Data/Events)と同じ抽出範囲。
- [UmaUmaCheckerの固定2026-10-17版](https://github.com/Cilda/UmaUmaChecker/commit/30ec4d0c3dd61d1e208b0e5c3853c22a5a10f49c)：24件の明示的な名称対応を使用してSSR/SRのカードID別候補イベント数を数える。元イベント本文は一切収録せず、実行時だけ一時取得する。

## 事前ゲート

**A 機構：** カードID重複、0〜4凸欠落、元マスターのテーブルや列欠損、候補参照IDと合計の不整合を拒否する。人工SQLiteによる正常・異常テストを通常CIに登録。

**B データ：** 全対象カードを「旧マスターにも存在／旧版に存在しない」で分類。旧版にあるカードについてカード直結のストーリーID数を分類。UmaUmaCheckerの候補イベント記録数が旧マスターのストーリーID数より少ないカードを**調査優先対象**として記録。ただしストーリーIDと候補イベントタイトルの対応は未照合で、1対1を前提としていない。**件数差はゲーム内の欠損確定ではない。**

**対象外：** support_chara_idで結ばれるキャラクター共通イベント、選択肢・分岐、打ち切り、成功／失敗、報酬ID、権利と公開許可、2026年時点のゲーム全イベント。古いデータにない2026年カードを現行データ誤りと呼ばない。

**C 実機：** 公開アプリに変更なし。PagesやAndroid/Windowsの物理実機確認は今回の監査からは増えない。

## 再実行

- 人工データ回帰：python3 -m unittest discover -s poc/tests -p 'test_historical_event_master.py' -v
- [限定ワークフロー](../.github/workflows/historical-event-master-audit.yml)：PR（スクリプト・ワークフロー自身の変更）または手動で固定コミットから3ファイルを一時取得。ゲーム生データをアーティファクトやPublicレポジトリに保存しない。
- [監査スクリプト](../poc/tools/audit_historical_event_master.py)：UmaSim TSV、ゲームマスターSQLite、任意の候補JSONをローカル指定可能。

実測値と制約は限定監査の合格結果を得てから追記する。少数実データ試験や2025年版をもってPhase 2完了とはしない。
