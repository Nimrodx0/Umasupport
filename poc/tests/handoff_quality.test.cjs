'use strict';
/** Cold-start navigation audit: use only repository files, no chat transcript or network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const core = [
  'README.md', 'AGENTS.md', 'poc/README.md', 'docs/index.md',
  'docs/governance/documentation-policy.md', 'docs/reference/requirements.md', 'docs/decisions/log.md',
  'docs/project/roadmap.md', 'docs/project/status.md', 'docs/reference/architecture.md',
  'docs/quality/verification-plan.md', 'docs/evidence/catalog.md',
  'docs/history/verification-history.md'
];
const destinations = [
  'docs/reference/requirements.md', 'docs/decisions/log.md', 'docs/project/roadmap.md',
  'docs/project/status.md', 'docs/reference/architecture.md', 'docs/quality/verification-plan.md',
  'docs/evidence/catalog.md', 'docs/governance/documentation-policy.md'
];

function withoutCodeFences(markdown) {
  let fence = '';
  return markdown.split('\n').filter(line => {
    const match = /^ {0,3}(\x60{3,}|~{3,})/.exec(line);
    if (match) {
      const marker = match[1][0];
      if (!fence) fence = marker;
      else if (marker === fence) fence = '';
      return false;
    }
    return !fence;
  }).join('\n');
}

function readLinks(base, relativePath) {
  const markdown = withoutCodeFences(fs.readFileSync(path.join(base, relativePath), 'utf8'));
  const links = [];
  for (const match of markdown.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const raw = match[1].trim().replace(/^<([^>]+)>.*$/, '$1');
    const destination = raw.split(/\s+["']/)[0];
    if (!destination || /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(destination)) continue;
    const withoutAnchor = destination.split(/[?#]/)[0];
    if (!withoutAnchor) continue;
    let decoded;
    try { decoded = decodeURIComponent(withoutAnchor); }
    catch { links.push({invalid: destination}); continue; }
    const absolute = path.resolve(base, path.dirname(relativePath), decoded);
    const normalized = path.relative(base, absolute).replaceAll('\\', '/');
    if (normalized === '..' || normalized.startsWith('../') || path.isAbsolute(normalized)) {
      links.push({invalid: destination});
    } else {
      links.push({target: normalized});
    }
  }
  return links;
}

function scan(base, files) {
  const graph = new Map();
  const errors = [];
  for (const file of files) {
    if (!fs.existsSync(path.join(base, file))) {
      errors.push(file + ': required handoff document is missing');
      continue;
    }
    const edges = new Set();
    for (const link of readLinks(base, file)) {
      if (link.invalid) {
        errors.push(file + ': invalid local link ' + link.invalid);
      } else if (!fs.existsSync(path.join(base, link.target))) {
        errors.push(file + ': missing linked target ' + link.target);
      } else if (link.target.endsWith('.md')) {
        edges.add(link.target);
      }
    }
    graph.set(file, [...edges]);
  }
  return {graph, errors};
}

function shortestRoute(graph, from, target) {
  if (!graph.has(from)) return null;
  const queue = [[from]];
  const visited = new Set([from]);
  for (let i = 0; i < queue.length; i++) {
    const route = queue[i];
    if (route.at(-1) === target) return route;
    for (const next of graph.get(route.at(-1)) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...route, next]);
      }
    }
  }
  return null;
}

function topicalEvidence(graph, source) {
  const canonical = new Set(core);
  return (graph.get(source) || []).filter(p =>
    p.startsWith('docs/') && !p.startsWith('docs/archive/') &&
    !canonical.has(p) && !/^(?:docs\/development-history|docs\/documentation-architecture-review)/.test(p));
}

test('new agents and developers can navigate to authoritative sources from entry files', () => {
  const {graph, errors} = scan(root, core);
  assert.deepEqual(errors, [], 'All local references in the handoff entry documents must resolve');
  for (const entry of ['README.md', 'AGENTS.md', 'poc/README.md']) {
    for (const target of destinations) {
      const route = shortestRoute(graph, entry, target);
      assert.ok(route && route.length <= 4,
        'Cold-start route missing or longer than 3 clicks: ' + entry + ' -> ' + target +
        (route ? ' (via ' + route.join(' -> ') + ')' : ''));
    }
  }
});

test('current work is traceable to versioned research, beyond generic entries', () => {
  const {graph, errors} = scan(root, core);
  assert.deepEqual(errors, []);
  for (const file of ['docs/project/roadmap.md', 'docs/project/status.md', 'docs/evidence/catalog.md']) {
    assert.ok(topicalEvidence(graph, file).length > 0,
      file + ' should link to at least one concrete audit, study or implementation record');
  }
  assert.ok(shortestRoute(graph, 'docs/reference/requirements.md', 'docs/decisions/log.md'),
    'Requirements should lead to decision reasons and supersessions');
  assert.ok(shortestRoute(graph, 'docs/quality/verification-plan.md', 'docs/history/verification-history.md'),
    'Acceptance criteria should link to prior test evidence without treating it as current');
});

test('broken evidence and disconnected decisions fail while harmless prose changes pass', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-check-'));
  try {
    fs.mkdirSync(path.join(temp, 'docs/reference'), {recursive: true});
    fs.writeFileSync(path.join(temp, 'README.md'),
      '# Any heading\n[Navigation](docs/index.md)\n');
    fs.writeFileSync(path.join(temp, 'docs/index.md'),
      '[Current contract](reference/requirements.md)\n');
    fs.writeFileSync(path.join(temp, 'docs/reference/requirements.md'), '# Effective requirements\n');
    let result = scan(temp, ['README.md', 'docs/index.md', 'docs/reference/requirements.md']);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(shortestRoute(result.graph, 'README.md', 'docs/reference/requirements.md'),
      ['README.md', 'docs/index.md', 'docs/reference/requirements.md']);
    fs.writeFileSync(path.join(temp, 'README.md'),
      '# Renamed heading\n[Start here instead](docs/index.md)\n');
    result = scan(temp, ['README.md', 'docs/index.md', 'docs/reference/requirements.md']);
    assert.deepEqual(result.errors, []);
    fs.writeFileSync(path.join(temp, 'docs/index.md'), '[Missing](missing.md)\n');
    result = scan(temp, ['README.md', 'docs/index.md', 'docs/reference/requirements.md']);
    assert.ok(result.errors.some(e => e.includes('missing.md')));
    assert.equal(shortestRoute(result.graph, 'README.md', 'docs/reference/requirements.md'), null);
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
});

test('all tracked Markdown documents keep valid local links after reorganization', () => {
  const {execFileSync} = require('node:child_process');
  const files = execFileSync('git', ['ls-files', '--', '*.md'], {cwd: root, encoding: 'utf8'})
    .split('\n').map(line => line.trim()).filter(Boolean);
  const {errors} = scan(root, files);
  assert.deepEqual(errors, [], 'Every local Markdown destination must exist, including archived evidence');
});

test('docs root contains only index.md',()=>{
 const loose=fs.readdirSync(path.join(root,'docs'),{withFileTypes:true}).filter(x=>x.isFile()&&x.name.endsWith('.md')).map(x=>x.name).sort();
 assert.deepEqual(loose,['index.md']);
});
