#!/usr/bin/env node
'use strict';
/**
 * CI guard: a material source, research or product change must update the
 * canonical status in the same PR/push. It cannot validate semantic accuracy.
 */
const {execFileSync} = require('node:child_process');

const canonicalStatus = 'docs/project/status.md';
function requiresStatusUpdate(file) {
  return /^(?:poc\/(?:src|data|source-probes|tools)\/|docs\/evidence\/(?:skills|events|sources)\/|docs\/plans\/(?:skill-conditions\/|product\.md)|docs\/project\/roadmap\.md$|docs\/reference\/(?:requirements|architecture|data-sources|event-schema)\.md$|\.github\/workflows\/)/.test(file);
}
function checkChangedFiles(files) {
  const material = files.filter(requiresStatusUpdate);
  if (material.length && !files.includes(canonicalStatus))
    throw new Error('Progress-affecting files changed without '+canonicalStatus+
      ' in the same PR/push:\n'+material.slice(0, 30).join('\n')+
      '\nUpdate the current progress, scope, limitations and evidence links together.');
  return {material: material.length, statusChanged: files.includes(canonicalStatus)};
}
function checkGitDiff(base) {
  if (!/^[0-9a-f]{40}$/.test(base || '') || /^0{40}$/.test(base))
    throw new Error('STATUS_DIFF_BASE must be the nonzero 40-character GitHub base/before SHA');
  const files=execFileSync('git',['diff','--name-only','--diff-filter=ACMRT',base,'HEAD','--'],
    {encoding:'utf8',maxBuffer:8*1024*1024}).split(/\r?\n/).filter(Boolean);
  return checkChangedFiles(files);
}
if (require.main===module) {
  try {
    const result=checkGitDiff(process.env.STATUS_DIFF_BASE);
    process.stdout.write('Status freshness change gate passed: '+result.material+
      ' material changed paths; status touched='+result.statusChanged+'.\n');
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
module.exports={requiresStatusUpdate,checkChangedFiles,checkGitDiff};
