# 2026-11-24：期限切れ研究成果の再現性回復

対象：Issue [#473](https://github.com/Nimrodx0/Umasupport/issues/473)、修正 [#475](https://github.com/Nimrodx0/Umasupport/pull/475)、固定検証HEAD `6704c14d4166773aa4f0ef73579ff72910bb0a55`。main統合 `a91200c9c0b81db90f40cb6cab32a346b4ae0f9e`。

| CI | 観測した結果 |
| --- | --- |
| [32条件二軸 #45357852050](https://github.com/Nimrodx0/Umasupport/actions/runs/45357852050) | cache miss、固定5,760レースを再生成、元5点SHA-256一致、全ステップ成功 |
| [6コース #45357852112](https://github.com/Nimrodx0/Umasupport/actions/runs/45357852112) | cache miss、固定2,160レース再生成、元2点SHA-256一致、全ステップ成功 |
| [15+15 #45357852027](https://github.com/Nimrodx0/Umasupport/actions/runs/45357852027) | cache miss、元5点再生成・SHA一致、旧P2.31固定版再導出、旧仮0/1/3/5ptで135/131/121/118、両15seed130/126/120/116を従来のCIで確認。全ジョブ成功 |
| [Core #45357852040](https://github.com/Nimrodx0/Umasupport/actions/runs/45357852040) / [Docs #45357852102](https://github.com/Nimrodx0/Umasupport/actions/runs/45357852102) | 成功 |

固定出典・期待値・回復経路は [復旧スクリプト](../../../poc/tools/restore_pinned_research.sh) と [検証器](../../../poc/tools/verify_pinned_research.cjs)、運用は [D-048](../../decisions/log.md#decision-d-048) を参照。旧レシピ3点を専用archive branchで保全。再計算された結果は元の期待ハッシュと比較する。P2.31は固定旧版から再導出し既存判定数を再現（旧ZIPのバイト同一性を認定しない）。全条件発動率・P2親Pass・製品採点・実機受入の証拠ではない。別の固定出典や計算環境でハッシュが変化した場合は新しい版の再検証を要する。
