# W5.1/W5.2：ライブ元データの構造変化・障害と保存キャッシュ復帰（2026-11-11）

**判定：機構Aの一部を実Chromiumで検証。W5.1/W5.2の公開環境・物理端末の受入完了を意味しない。** Windows／Android実機検証は利用者指示で保留。

## スコープ

[現行ロードマップ](../../plans/product.md)のW5.1/W5.2、[運用手順](../../how-to/upstream-refresh-operations.md) と [検証ゲート](../../quality/verification-plan.md) に従う。

- 検査対象はCI内でSHA-256を検証した固定UmaSimサポカ `support_card.txt` と数値スキル `skill_data.txt`、公開承認済みイベント `reviewed_events.v1.json` （559カード／2,487イベント）。
- 外部UmaSim本文はCI内メモリで取得し、GitHubリポジトリに再配布しない。実利用者のローカル設定も操作しない。
- [W1.4の実データブラウザ試験](../../../poc/tests/browser_w1_settings_recovery.cjs)で、取得先をPlaywright側から差し替え、実アプリの読込処理 `UmaLiveLoader`、`UmaSkillBridge`、`UmaPublicEventCatalog` を通す。自動テスト内の一時的な擬似通信障害であり、外部提供元が実際に障害を起こした記録ではない。

## 試験と期待値

| 試験 | 期待値 | 実測 |
| --- | --- | --- |
| サポカTSV列構造が不正 | ロード時に形式エラーを検知し、検証済みカードキャッシュで起動。異常TSVでキャッシュを上書きしない | Pass |
| スキルJSONのスキーマ不正 | スキル辞書だけをキャッシュ復帰、カード名簿はオンライン状態を保つ。異常JSONでスキルキャッシュを上書きしない | Pass |
| 公開イベントJSON破損 | 不正な最新版を採用しない。検証済みイベントキャッシュがあれば復帰 | Pass |
| 3データソース同時遮断 | 検証済みキャッシュでサポカ・スキル・イベントを読込。選択イベント／目標を保持 | Pass |
| イベントキャッシュ破損＋オンライン停止 | イベント検証失敗を明示して、そのイベントの採用を停止。利用者設定を破棄しない | Pass |
| 取得元の復帰 | 正常な出典レスポンスを再取得し、オンラインモードへ復帰 | Pass |
| キャッシュがない新規プロファイルで障害 | 架空データにフォールバックせず、明示的な起動エラー。設定を偽造しない | Pass |

[PoC Core Tests #42952860558](https://github.com/Nimrodx0/Umasupport/actions/runs/42952860558) の `browser-smoke` ジョブ「W1.4 export import and cache recovery with approved events (Chromium)」で、`malformedSupportSkillRejected:true`、`upstreamCacheNotPoisoned:true`、旧W1.4異常系の成功を確認。後続の実装・文書コミットと本番Pages配信を別扱いにする。

**表示上の注意**：起動ステータスの `data-mode` はカード名簿の取得状態に対応する。スキル辞書だけキャッシュから復帰した場合、起動ステータス自体は`online`でも `model.meta.runtimeSources.skills.mode='cached'`となる。これを混同しない回帰テストに修正した。

## まだ残るゲート

- **A**：最新版元データで実際に発生する未知の列追加・意味変更・新IDや外部API破壊の全パターンが検証されたわけではない。異常系の網羅範囲を今後拡張する。
- **B**：配信データがゲーム現行版の完全な全件か、独立根拠で正確かは別。固定スナップショットのテストで代替しない。
- **C**：公開Pages上で配信版を操作する試験、物理Windows／Android環境の実測は未実施・保留。実端末とブラウザ上の擬似通信障害を同一視しない。
- **W5.3**：承認済み増分のみの公開、ロールバック手順の本番確認、A/B/C完了は未実施。
