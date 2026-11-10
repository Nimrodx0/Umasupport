# ウマサルタントの文書

ここが文書の入口です。**docs直下にはこのindex.md以外のMarkdownを置きません。** 各ファイルは読者の目的と責任範囲に応じて整理しています。

## まず探すもの

| 知りたいこと | 文書 |
| --- | --- |
| 何ができるアプリか | [現在有効な要件](reference/requirements.md) |
| 今どこまで完成しているか | [現在の状況](project/status.md) |
| 次に何を作るのか | [上位ロードマップ](project/roadmap.md) |
| P0～P5の細かい研究工程と結果 | [研究計画](plans/skill-conditions/index.md) |
| 仕様がそうなった理由 | [確定した判断](decisions/log.md) |
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
| [tutorials](tutorials/first-session.md) | 初めての開発・確認演習 |
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
