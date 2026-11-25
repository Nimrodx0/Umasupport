# P2.46：32元部分条件の二軸独立整合性検証（2026-11-24）

旧[#378](https://github.com/Nimrodx0/Umasupport/pull/378) と [#379](https://github.com/Nimrodx0/Umasupport/pull/379) は、固定32条件の独立受領契約と実レポート検証を追加し、[旧CI #42572230580](https://github.com/Nimrodx0/Umasupport/actions/runs/42572230580) が成功した。現行mainでは同一の `skill_specificity32_research.cjs` blob と32条件プロフィール・元入力SHAを維持しているが、過去runからの取得は#475で撤去済み。旧workflow全体や旧文書を戻さず、検証器・反例テストだけを現行の同一run再生成／キャッシュSHA検査後へ移植する。

- W（10m窓成立機会）、O（点順位占有）、U（均一順位点基準）、D=O−Uを区別する。W−UをDとしない。
- 全64条件×頭数、384脚質ペア、192頭数感度、順位整数射影、脚質別の保留関係、数値恒等式を検査する。
- 旧派生報告のSHA-256 `7831abb1bfae9f044ad7e4c62a2885fb79e1f25981d387876e03f202925b82e5` を維持し、差異を自動採用しない。[現行固定CI #45360337665](https://github.com/Nimrodx0/Umasupport/actions/runs/45360337665)でSHA一致、全検証成功。#477 main統合 8758537。
- この32条件の30seed二軸報告自体は分割確認済みではない。後続15+15研究のW確認は別証拠。D・元全AND/OR・実ゲーム発動率・G3親Pass・正式ラベル・取得経路・カード採点は認定しない。

実装：[旧条件受領検証](../../../poc/src/p2_p3_evidence_contract.cjs)、[実データ監査](../../../poc/tools/verify_p2_p3_real_report.cjs)、[反例](../../../poc/tests/p2_p3_evidence_contract.test.cjs)。
