# Phase 2：固定GT未収録3SSR・残り15イベントの数値事実採用（2026-10-22）

## 対象と採用判断

固定GameTora由来JSON（`systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67`）が未収録の4SSRのうち、前PRで先に採用した30321の5件を除いた**30318・30319・30320の15イベント**。3カードそれぞれに連続3段階＋通常2件がある。Checkerの元イベント位置・ヒント数値IDは`phase2_four_ssr_editorial_review.cjs`の既存固定監査を利用し、**編集上の数値報酬の裁定元はGameWith**とした。出典文章・イベント名・選択肢の原文を収録せず、位置・選択別能力／絆／回復等の数値・スキルID／ヒントLvのみ収録する。

| カード | GameTora対象ページ（固定元との差異確認） | GameWithの選択肢・数値報酬記事 | 件数 |
| --- | --- | --- | ---: |
| SSR30318 ライスシャワー | https://gametora.com/ja/umamusume/supports/30318-rice-shower | https://gamewith.jp/uma-musume/article/show/578814 | 5 |
| SSR30319 ナリタブライアン | https://gametora.com/ja/umamusume/supports/30319-narita-brian | https://gamewith.jp/uma-musume/article/show/578819 | 5 |
| SSR30320 アドマイヤグルーヴ | https://gametora.com/ja/umamusume/supports/30320-admire-groove | https://gamewith.jp/uma-musume/article/show/578818 | 5 |

調査日2026-10-22。GameTora 30318・30319は個別ページで3連続＋2通常の見出しまで確認、30320は**カード概要を確認したがイベント全5件の個別展開までは検証していない**。後者でもGT固定元の当該カードJSONが欠損することは既に確認されており、GameWithカード記事で5件の個別数値が明示されているので、[採用契約](event-adjudication-enforcement.md)に従って編集上の値は採用する。第二の独立資料やゲーム実機を編集採用の必須条件にはしない。

**表示矛盾の限定解消：30319の通常イベント位置5**。カード別GameWith一覧の第1行には「選択肢なし」と誤解を招く表示がある一方、同じGameWithの[イベント単独記事](https://gamewith.jp/uma-musume/article/show/289111)は男性・女性別の操作2択と各報酬を明記する。したがって操作2択と各数値効果・後者でのスキルID201641 Lv1を採用し、元記事の表示相違と解消リンクを独立データへ保存した。選択肢本文そのものは収録しない。

**出典間の具体的な数値差**：30319の連続最終イベントについてGameWithはスピード+10、[Game8](https://game8.jp/umamusume/818831)は+15と記載する。本件は固定GTに該当カードJSONがないため、プロジェクトで指定した例外裁定元である**GameWithの+10を採用**する。両資料を混ぜたり、独立二サイトが一致しないことのみを理由に採用を止めたりしない。

## 実装・母数

- `poc/data/curation/adjudicated/30318-30320.v1.json`：**15イベント／27効果・選択行**、非スキル数値効果73件、**スキルID・Lv10記載**。イベント本文なし。連続先行分岐は未確認。
- `poc/src/phase2_remaining_ssr_intake.cjs`：固定GameWith採用値、固定CheckerヒントID・位置、GameTora対象カードURL、GameWithカードURL、30319イベント単独記事の2択解消を照合。全15件に`evaluateException`を適用。採用済み事実が途中で変化した場合は拒否。
- `poc/data/curation/adjudicated_event_facts.v1.json` と中央検証器：前PR #170の30321を合わせて**編集採用20／保留0／ヒント12記載**に変更。全20イベントにおける非スキル数値効果**90件**、選択式の操作選択肢**30個**、選択肢なしの単一結果**3件**、公開イベント0件。
- `provisionalCatalog` は**3カードの通常イベント計6件だけ**をメモリ内で作成。先に採用した30321の通常2件と合わせ、非公開の通常候補草稿は計8件。一方4カードの**連続イベント計12件は前段依存／継続・打ち切り未確認**で、現時点ではランタイムへ自動到達イベントとしては投影しない。
- GameWith記載の体力最大値+4は`max_energy`として編集台帳に保持し、共通例外裁定器の許容数値効果種類に明示追加。通常体力`energy`とは混同しない。

## 再現

```sh
node --test poc/tests/phase2_remaining_ssr_intake.test.cjs poc/tests/phase2_adjudicated_fact_intake.test.cjs poc/tests/phase2_editorial_intake.test.cjs
node poc/tools/verify_adjudicated_event_facts.cjs
node poc/tools/verify_event_release.cjs
```

**A 機構**：独立の数値期待値と編集台帳を全15件・位置／選択肢／ヒント単位で照合、選んでいない通常イベントのスキルを加算しないことと、数値ドリフト・ゲーム真実／公開フラグ混入の拒否を試験。

**B 出典**：カード別GameTora表示範囲とGameWith掲載事実の編集採用。GameWith記事の数値自体がゲーム現行版で完全に正しいとの確認ではない。

**C 実環境・権利**：Node／既存のGitHub Actions Chromiumの合格はゲーム実機の連続分岐再現、Windows/Android端末、第三者素材の再配布権、正式公開承認を意味しない。元の公開用`poc/data/reviewed_events.v1.json`と承認台帳は**どちらも空のまま**。

次の作業は、20件の数値再採用を繰り返すのではなく、連続12件の前段選択による後続打ち切り・分岐を出典に即して照合し、既存GT559枚の優先差異へ移る。
