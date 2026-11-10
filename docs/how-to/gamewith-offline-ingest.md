# GameWith記事のオフライン照合：例外がある場合だけ

この手順は現行の**主取得経路ではありません**。GameTora派生JSONの特定イベントに明確な欠損・疑義があるときに限り補助資料を照合します。GameWith-firstの旧全件収集計画とツールの実行例は[2026-10-19原文](../evidence/sources/gamewith-offline-ingest-legacy-20261019.md)へ保全しました。

## 利用条件

1. カードID、イベント、選択肢・結果・スキルのどの部分に疑義があるか固定する。[現行出典方針](../reference/data-sources.md)を参照。
2. **適法に取得・保管した個別記事**に限りオフライン解析する。無許可の網羅クローリング、第三者原文のPublicリポジトリへの追加はしない。
3. 解析器が生成するのは編集候補です。記事の見出し数とイベント数、結果ごとの分岐、未知IDを確認し、不明は保留にする。
4. [個別裁定契約](../reference/event-adjudication-enforcement.md)と[公開承認ゲート](checker-public-catalog.md)により、事実の編集採用と正式公開を分けて判定する。

旧版の再現用に、[過去の実行コマンド・入力例・検証記録](../evidence/sources/gamewith-offline-ingest-legacy-20261019.md)を保持しています。**現在の全件取込実行指示ではありません。**
