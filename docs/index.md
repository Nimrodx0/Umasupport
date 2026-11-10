# 文書の入口

[README](../README.md)はアプリの概要、[AGENTS](../AGENTS.md)は開発原則です。ここは**情報を探すための入口**であり、実測値や仕様の正本ではありません。

## まず知りたいこと

| 質問 | 読む文書 |
| --- | --- |
| 今どこまでできている？ | [開発状況](status.md) |
| 次に何を作る？ | [ロードマップ](roadmap.md) |
| P0～P5の下位計画と結果は？ | [詳細計画](plans/index.md) |

## 目的から探す

[初回演習](tutorials/first-session.md) ／ [文書更新手順](how-to/update-docs.md) ／ [技術リファレンス](reference/index.md) ／ [設計の解説](explanation/index.md) ／ [方法論と適用範囲](documentation-methodology.md) ／ [ADR](adr/README.md) ／ [WBS Dictionary](plans/wbs-dictionary.md)

## 文書の地図

| 分類 | 入口 | 役割 |
| --- | --- | --- |
| 企画・工程 | [plans](plans/index.md) | 製品W1～W5・研究P0～P5の小工程、状態、成果と未完ゲート |
| 要件・判断 | [requirements](requirements.md)／[decisions](decisions.md) | 有効な仕様・ユーザー判断と変更理由 |
| 設計 | [architecture](architecture.md)／[event-schema](event-schema.md)／[data-sources](data-sources.md) | 技術・データ契約 |
| 実装・検証 | [PoC手順](../poc/README.md)／[検証計画](verification-plan.md) | 起動方法・A/B/C受け入れ |
| 研究・監査 | [evidence](evidence/README.md)／[主要証拠の索引](evidence-index.md) | 分野別の個別記録 |
| 履歴 | [archive](archive/)／[開発履歴](development-history.md)／[検証履歴](verification-history.md) | 旧記録。当時の指示は現行指示ではない |
| 文書の規則 | [documentation-policy](documentation-policy.md) | 保存先と更新ルール |

## 食い違いがある場合

有効要件は[requirements](requirements.md)、現在の動作事実はコード・公開JSON・検証、優先順位は[roadmap](roadmap.md)、**細分化した計画と進捗**は[plans](plans/index.md)、日付付きの実測は[status](status.md)を確認してください。決定理由は[decisions](decisions.md)、研究の詳細は[evidence](evidence/README.md)から辿れます。
