# ウマサルタントの文書

ここは**正本を発見するための地図**です。AIエージェントはリポジトリ直下の[AGENTS.md](../AGENTS.md)を入口とし、担当作業に必要な文書だけを読むことを基本とします。ファイルをフォルダへ入れること自体は品質の保証ではありません。現在の分類は利用しつつ、正本の発見性を優先します。

## エージェントの作業別入口

- **デッキ・UI・保存の変更**：[要件](reference/requirements.md) → [アーキテクチャ](reference/architecture.md) → [実装・テスト](../poc/README.md)
- **イベント追加・公開**：[出典契約](reference/data-sources.md) → [イベント構造](reference/event-schema.md) → [公開審査](how-to/checker-public-catalog.md)
- **P2研究・スキル適合性**：[研究小工程](plans/skill-conditions/index.md) → [技術設計](explanation/skill-activation-tendencies-design.md) → [関連する固定証拠](evidence/skills/README.md)
- **次の実装の着手**：[ロードマップ](project/roadmap.md) → [開発状況](project/status.md) → [詳細計画](plans/index.md)
- **合格基準の確認**：[検証計画](quality/verification-plan.md) → 対象のテスト／CI → [証拠記録](evidence/README.md)
- **複数領域にまたがる文書構成の改善**：[Dトラックの改善計画](plans/documentation-maintenance.md) → [横断課題 Issue #388](https://github.com/Nimrodx0/Umasupport/issues/388)。個別の不備は発見したPRで直す

必要な文書を段階的に読むこと。文書一覧を一括でコンテキストに投入せず、該当するコード・実際のJSONと突き合わせます。

## まず探すもの

| 知りたいこと | 文書 |
| --- | --- |
| 何ができるアプリか | [現在有効な要件](reference/requirements.md) |
| 今どこまで完成しているか | [現在の状況](project/status.md) |
| 次に何を作るのか | [上位ロードマップ](project/roadmap.md) |
| P0～P5の細かい研究工程と結果 | [研究計画](plans/skill-conditions/index.md) |
| 仕様がそうなった理由 | [原文と状態別の判断索引](decisions/index.md) |
| 用語の優先表記・定義の所在 | [用語索引](reference/terminology.md) |
| データの構造と取り込み方 | [技術リファレンス](reference/index.md) |
| 実際の作業の手順 | [How-to](how-to/README.md) |
| 実験や監査の根拠 | [固定研究の索引](evidence/catalog.md) |

## フォルダ一覧

| フォルダ | 役割 |
| --- | --- |
| [project](project/README.md) | 現在の進捗と上位計画 |
| [plans](plans/index.md) | 製品・研究の小工程、依存、受入基準 |
| [reference](reference/index.md) | 有効要件、技術・データ・イベントの定義 |
| [how-to](how-to/README.md) | 出典更新、イベント取込、公開審査などの手順 |
| [explanation](explanation/index.md) | 設計や推定の根拠と限界 |
| [decisions](decisions/index.md) | ユーザー判断、権利、出典選定の経緯 |
| [adr](adr/README.md) | 設計上の重要判断（採用・提案を区別） |
| [quality](quality/README.md) | 受入ゲート、文書の検証 |
| [governance](governance/README.md) | 文書運用と設計方法論 |
| [evidence](evidence/README.md) | 分野別の固定調査・監査 |
| [history](history/README.md) | 継続して記録する開発・検証の履歴 |
| [archive](archive/) | 凍結した過去の文書 |

## 正本と履歴の読み分け

有効な仕様は[requirements](reference/requirements.md)、現時点の検証結果は[status](project/status.md)、優先順位は[roadmap](project/roadmap.md)、実行可能な下位工程は[plans](plans/index.md)で扱います。

過去の採用・撤回の理由は[decisions](decisions/log.md)、実験の数値や反例は[evidence](evidence/README.md)を参照します。日付の古い資料にある「現在」「次工程」は現行の指示ではありません。

[リポジトリ全体のREADME](../README.md) ／ [開発者向けAGENTS](../AGENTS.md)
