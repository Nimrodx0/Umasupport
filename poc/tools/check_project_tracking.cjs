'use strict';

/** Verify the canonical status against the actual shipped JSON; optional API issue check. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

function validateDocs() {
  const status = read('docs/project/status.md');
  const roadmap = read('docs/project/roadmap.md');
  const catalog = JSON.parse(read('poc/data/reviewed_events.v1.json'));
  if (!Array.isArray(catalog.cards)) throw new Error('Unexpected approved catalog shape: cards array missing');
  const cards = catalog.cards.length;
  const events = catalog.cards.reduce((total, card) => {
    if (!Array.isArray(card.events)) throw new Error('Unexpected approved card events');
    return total + card.events.length;
  }, 0);

  const match = status.match(/公開イベント（公開JSON実測）：\*\*([\d,]+)件\*\*／\*\*([\d,]+)カード\*\*/);
  if (!match) throw new Error('Missing canonical release-count field in docs/project/status.md');
  const reported = [Number(match[1].replaceAll(',', '')), Number(match[2].replaceAll(',', ''))];
  if (reported[0] !== events || reported[1] !== cards)
    throw new Error('docs/project/status.md release count ' + reported.join('/') +
      ' disagrees with approved JSON ' + events + '/' + cards + '; update status in the release PR');

  if (!/^# 開発状況（現行スナップショット）/m.test(status) ||
      !/\*\*測定日：20\d{2}-\d{2}-\d{2}。\*\*/.test(status))
    throw new Error('docs/project/status.md must begin with a dated current summary');
  if (!/archive\/status-through-20261105\.md/.test(status) ||
      !fs.existsSync(path.join(root, 'docs/archive/status-through-20261105.md')))
    throw new Error('Status migration must retain historical evidence');

  if (!/^## 現在の製品完成への作業順（正本）$/m.test(roadmap) ||
      (roadmap.match(/^## 現在の製品完成への作業順（正本）$/gm) || []).length !== 1)
    throw new Error('Roadmap must have exactly one current priority list');
  if (!/status\.md/.test(roadmap) || !/archive\/roadmap-through-20261105\.md/.test(roadmap))
    throw new Error('Roadmap must link to measured status and historical plan');
  if (/(?:公開イベント|本番イベント|Real published events)\s*[：:は]*\s*0\s*(?:件|events)?/i.test(roadmap) ||
      /(?:最優先：自動提供方法・利用条件|次の実装順は上の3→4)/.test(roadmap))
    throw new Error('Superseded pre-release instruction leaked into the current roadmap');
  if (new RegExp(events.toLocaleString('en-US') + '件').test(roadmap))
    throw new Error('Roadmap repeats the changing current public release count; link to status instead');

  return {events, cards};
}

function scanIssues(issues, publishedEvents) {
  const findings = [];
  if (publishedEvents === 0) return findings;
  for (const issue of issues) {
    if (issue.pull_request || issue.state !== 'open') continue;
    const body = String(issue.body || '').split('<!-- historical:begin -->')[0];
    const current = String(issue.title || '') + '\n' + body;
    const patterns = [
      /\bReal published events:\s*0\b/i,
      /\bPreserve 0 public events\b/i,
      /(?:現在|現時点|公開DB|公開イベント|公開実イベント)[^\n]{0,45}(?:実イベント)?0件/,
      /(?:実イベント|公開イベント|本番イベント)[^\n]{0,35}0件/
    ];
    if (patterns.some(re => re.test(current))) findings.push('#' + issue.number + ': stale zero-release claim');
  }
  return findings;
}

async function checkIssuesOnline(publishedEvents) {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error('--issues requires GITHUB_REPOSITORY and GITHUB_TOKEN');
  const issues = [];
  for (let page = 1; page <= 20; page++) {
    const response = await fetch('https://api.github.com/repos/' + repo +
      '/issues?state=open&per_page=100&page=' + page, {
      headers: {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'},
      signal: AbortSignal.timeout(12000)
    });
    if (!response.ok) throw new Error('GitHub issue audit API: HTTP ' + response.status);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('GitHub issue response is not an array');
    issues.push(...batch);
    if (batch.length < 100) break;
  }
  const findings = scanIssues(issues, publishedEvents);
  if (findings.length) throw new Error('Update current Issue body or mark legacy text as history:\n' + findings.join('\n'));
  process.stdout.write('Open Issue audit passed (' + issues.length + ' entries).\n');
}

if (require.main === module) {
  try {
    const result = validateDocs();
    process.stdout.write('Status/roadmap synchronized with public JSON: ' +
      result.events + ' events / ' + result.cards + ' cards.\n');
    if (process.argv.includes('--issues'))
      checkIssuesOnline(result.events).catch(e => {console.error(e); process.exitCode = 1;});
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {validateDocs, scanIssues};
