# Phase 2：SR20075のGT未収録連続初段階をGameWith数値採用（2026-10-22）

## 固定データとカード同定

対象は **SR20075 タップダンスシチー［Cheers!］**。固定GT `systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67` は通常2イベントと連続最終1段階（ローカルID416）のみ。固定Checker `Cilda/UmaUmaChecker@8cf9fcb3cc7239041161be75c84daf9f8f22d29f`には初段階の未対行`checker:20075:8fd4b0e1da2eeb063087`がある。これは以前から**Checker-only40／重点差異65の中に含まれる1件**。

対象の[GameToraカード固有ページ](https://gametora.com/ja/umamusume/supports/20075-tap-dance-city)を確認し、[GameWithの同カード記事](https://gamewith.jp/uma-musume/article/show/441770)（2026-10-12更新）が連続初段階に**プレイヤー選択肢なし、根性+15・絆+15**を明示するため、既定のGT欠損→GameWith採用契約で、**当該掲載数値を編集上の採用値**にした。GameWithに根拠がある項目を、第二サイト不一致や実ゲーム未検証だけを理由に保留しない。

## 既知の「2結果」と未確認条件

[U-toolsのカード別イベント記事](https://xn--gck1f423k.xn--1bvt37a.tools/supports/20075/event)は同じ連続初段階について**根性+15・絆+15、根性+5・絆+5の2つの報酬行**を併記し、[ゲームエイト](https://game8.jp/umamusume/600213)は+5/+5側を掲載している。これらを一つの選択肢／成功失敗／ゲーム更新差のいずれとみなすべきかを断定する明示情報は確認できない。

したがって本PRは次を区別する。

- **採用**：GameWithが明示した操作0択、掲載効果2個（根性+15、絆+15）。
- **未分類のまま保存**：U-toolsの数値報酬2行（+15/+15、+5/+5）。成功・失敗ラベル、排他性・分岐確率・後続への影響は**未確認**。
- **公開・ランタイム昇格なし**：報酬がスキル計算対象外でも、選択肢なし＝常に+15/+15確定とは推定しない。欠損初段階を無条件`type:auto`にして配信しない。

保存物は`poc/data/curation/adjudicated/20075_stage1.v1.json`（出典リンクと数値だけ）、型・元カード・数値の改変拒否は`poc/src/phase2_20075_first_stage_intake.cjs`で検証。イベント名・第三者文章・画像をデータ成果物に含めない。GameWith共通の`evaluateException`判定へ通す。

## 合格範囲と残件

```sh
node --test poc/tests/phase2_20075_first_stage_intake.test.cjs
node poc/tools/verify_event_release.cjs
```

A＝固定数値の変更・自動昇格・存在しない結果名の創作を拒否する合成テスト。B＝固定GT欠損位置とChecker元位置、GameWith編集採用事実、U-tools二行報告の分離。C＝ゲーム実機の成功／失敗・後続遷移・Windows/Android端末、再配布許可と正式公開承認は未実施。

Checker-only40／重点65は未照合元イベントの固定出典差異として引き続き保持する。**SR20075の初段階は「数値採用済み」だが「全分岐を検証済み」ではない**。全ユーザー公開イベントは0件のまま。
