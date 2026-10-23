# Phase 2：連続イベントの解放フラグ仕様（2026-10-23再確認）

2026-10-23にユーザーが**フラグONとイベント発生抽選は別**であることを再確認した。**明示 `chain_end`・選択／結果別の打ち切りがなければ後続フラグON。** ゲーム内で発生するかどうかの確率は本アプリでは一切モデル化しない。先の記録にある「17経路を継続と仮定するが個別確証0」や「発生保証0なので未確定」という表現はアプリ仕様として**取り消し**。これはデータ由来の公表判断・結果別効果の照合や正式公開ゲートまで免除するわけではない。

## 対象と実装

GameTora固定版にない4SSR（30318〜30321）およびSSR30221について、GameWith個別記事に明示打ち切りが記載されていない選択位置17件を通常継続の解放フラグとする。段階数15、数値結果22行、スキルヒント9件。選択肢を設定すれば次段が解放され、選択肢のない段階は直前フラグで後段を解放する。外的なイベント発生抽選は関与しない。既に選んだ前段を変更したとき、古い後続選択を解除する。

- `poc/data/curation/phase2_five_chain_continuation_policy.v1.json`：対象5枚の出典と、明示打ち切り不在を記録する。規則は `NO_EXPLICIT_CHAIN_END_SETS_NEXT_STAGE_FLAG`。
- `poc/src/phase2_chain_plan_build.cjs`：各経路に `setsNextStageFlag:true` と `terminal:false` を付与し、17件の解放経路を照合する。将来明示 `chain_end` が見つかれば該当経路にその情報を反映する。
- `poc/src/phase2_chain_plan_client.js`：段階の`requires:{all:[{eventId:前段ID}]}`を本番`UmaCore.directRoutes`に渡して前段の選択と打ち切りを判定。開発用の「到達した」ボタンは通常の選択ルート画面から廃止。日本語スキル名とヒントLvのみ利用者表示に使用する。
- 公開用の独自イベントDBおよび人手承認台帳は引き続き0件。出典記事原文・選択肢台詞・画像は再配布しない。

**検証方針：** Nodeで明示打ち切り時の下流フラグOFF、選択肢のない連続段階の後段ON、選択未設定時の後段OFFを直接`UmaCore.directRoutes`で確認。Chromiumで390/1280pxの画面操作・選択変更・改変拒否を検証。各経路の「肯定的な継続記載」を別資料で再照合する作業を新たに義務付けない。

## 出典

GameToraの[基準継続ルール](gametora-baseline-event-policy-20261021.md)。個別サポカGameWithの記事：[30318](https://gamewith.jp/uma-musume/article/show/578814)、[30319](https://gamewith.jp/uma-musume/article/show/578819)、[30320](https://gamewith.jp/uma-musume/article/show/578818)、[30321](https://gamewith.jp/uma-musume/article/show/578817)、[30221](https://gamewith.jp/uma-musume/article/show/461418)。
