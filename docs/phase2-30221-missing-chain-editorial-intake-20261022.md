# Phase 2：SSR30221の固定GT欠損連続3段階をGameWith数値採用（2026-10-22）

## 対象、旧出典の限界

カードID **30221、SSRサトノダイヤモンド［今日もたのしく、おいしく。］（KFCコラボ特典）**。GT固定`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`は通常ランダム2イベント（ローカルID107/108）のみ、連続段階0件。固定Checker`Cilda/UmaUmaChecker@8cf9fcb3cc7239041161be75c84daf9f8f22d29f`のイベント位置1〜3は**既にChecker-only40件に含まれる3件**であり、新しく未収録イベント3件を発見したと重複計上しない。

[GameTora対象カード固有ページ](https://gametora.com/ja/umamusume/supports/30221-satono-diamond)で同一SSRを確認し、固定GTに連続構造がない例外に対し、[GameWith同一カード個別記事](https://gamewith.jp/uma-musume/article/show/461418)（最終更新2026-10-12）を指定裁定元として選択肢・数値を採用。U-tools [カードID固有イベント記事](https://xn--gck1f423k.xn--1bvt37a.tools/supports/30221/event)でも数値と3連続が整合。名称が同じでも**カード30221とSSR［百花の願いをこの胸に］は別物**。後者の能力や金スキルに誤って置き換えない。

| Checker位置／連続段階 | プレイヤー選択肢 | GameWith数値採用 | 技能報酬 |
| --- | ---: | --- | --- |
| 1 | なし | 体力+5、スタミナ+5、絆+5 | なし |
| 2 | なし | 体力+10、スタミナ+5、絆+5 | なし |
| 3 | なし | 体力+10、スタミナ+5、絆+5 | **食いしん坊 ID201351 Lv1** |

技能IDは[U-toolsの数値IDページ](https://xn--gck1f423k.xn--1bvt37a.tools/skills/201351)で対象名と照合。イベント名や選択肢の原文、画像をデータ成果物に保存しない。各段階の報酬候補は数値で固定し、根拠を履歴化する。

## 連続到達の扱い

GameWithの掲載した段階数・選択肢の有無・数値は編集上の採用値として確定する。ただし **「第1段階を観測した」だけで第2・第3段階への具体的な継続／打ち切り条件は出典から確定できない**。内部条件を捏造しない。通常イベントを含めて実ゲーム実機で確認したと主張しない。

`poc/src/phase2_30221_missing_chain_intake.cjs`は全3件を `evaluateException` のGameTora欠損→GameWith明示値に通す。スキルの非公開コア再現は**各段階で明示的に「到達を観測した」と呼び出す場合のみ**。第3段階を任意の前段から自動発火させるデータや、公開アプリのイベントDBへは登録しない。

## 再実行／合格境界

```sh
node --test poc/tests/phase2_30221_missing_chain_intake.test.cjs
node poc/tools/verify_event_release.cjs
```

- **A・機構**：カードIDや数値を別SSRへすり替える変更、出典URLの置換、後続条件の創作、選択肢数の改変、公開フラグ混入をfail-closed。実集計`core.directRoutes`で未観測0報酬、第3段階の手動到達時だけID201351/Lv1を再現。
- **B・出典**：元GT2通常・Checker-only3位置＋GameWith同カード数値＋U-toolsスキルIDの固定照合。Web記事の文字列やゲームの生マスターを丸ごと保存したわけではない。
- **C・実ゲーム／公開**：2026年ゲームのプレイ、内部連続の全経路、Windows/Android物理端末、権利・配信の承認は**未実施**。正式配信イベント0件、GT 2,488固定イベント、Checker-only40／重点差異65件は維持。

次は、同じカード同定→正本採用方式で残るSSR30240（両固定元とも連続3段階なし）と、SR20075の初段階を調査する。ただしGameWithが対象事実を掲載していない場合は、具体的な欠落内容を記録し、他サイトの報酬をGameWithにあったかのように偽装しない。
