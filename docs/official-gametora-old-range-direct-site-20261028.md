# 旧SSR30030／30041のGameTora本体数値範囲を限定観測（2026-10-28）

## 調査対象と前提

[旧GT構造選定の監査](official-gametora-existing-structural-cohorts-20261028.md)の3カードから、範囲付き数値があるSSR30030／30041を先に調査する。Git blobを固定した従来の派生GT元データと、現在の[SSR30030 GameToraページ](https://gametora.com/ja/umamusume/supports/30030-matikanetannhauser)／[SSR30041 GameToraページ](https://gametora.com/ja/umamusume/supports/30041-mejiro-dober)の**実ブラウザ表示を独立に比較**するための限定計測。元出典の数値を画面観測側へ混ぜず、GameToraの原文、選択肢文章、HTML、画像、全ページレスポンスをリポジトリ・ログへ出力しない。

- SSR30030は旧元位置3・選択肢2、体力変化が二値（旧固定は+10／+30）。
- SSR30041は旧元位置3・選択肢1、スキルPtが二値（旧固定は+15／+45）。
- 旧元データは固定 systemless10/UmamusumePS@6e38b54af4fad397ff4491e63007a90705a4fe67。対象Git blobは既存監査の 30030=95d6692825af1d7774b0382245016433660509c9／30041=fda834045267a13bd06d51d39468ac7cb9367136 へ一致しなければ実Chromeを起動しない。

## 実装と検証の境界

- poc/src/official_gametora_old_range_dom.cjs：旧固定元の構造監査を再利用しつつ、実サイトから独立に得た**当該選択肢のDOM直下テキスト断片**に同じ効果種類と符号付き二値が現れる場合だけ一致と判定。別選択肢、別効果、余分な第3の数値では不合格。画面上の表示方法（同一断片に2数値、別断片）も区別する。
- poc/tools/probe_official_gametora_old_ranges.cjs：固定の2ページ・対象イベント見出しを一意同定して1イベントずつChromeで展開。robots.txt確認、同時処理なし、6秒間隔、403／429停止、画像等のダウンロード拒否、画面文章をログ出力しない。
- .github/workflows/official-gametora-old-range-browser.yml：明示対象2ファイルだけ使い捨てランナーへ取得し、Playwright（実Chrome）の限定計測を実行。
- .github/workflows/ci.yml に合成不正系を追加。旧固定データでの範囲位置、誤った効果種類、他の選択肢からの数字の借用、数値異常を拒否する。

**この工程では、画面で明示的な二値が見つかっても、低／高結果が排他的か、同じ確率か、ゲームの内部イベント分岐と一致するか、公開イベントJSONの全フィールドが正しいかまでは認定しない。** SSR30080の3択・4結果・停止と、お出かけの内部到達条件も別ゲート。公開承認イベントは0件のまま。

## 実測記録

追加したChrome監査の出力は ORIGINAL_GT_OLD_RANGES の構造・数値のみ。合成A・固定元B・実サイトCはGitHub Actions結果を独立して判定する。旧派生固定ファイルだけで「C成功」とみなさない。
