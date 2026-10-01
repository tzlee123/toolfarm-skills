#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(here, 'check-registry-drift.mjs');
const temp = await mkdtemp(path.join(os.tmpdir(), 'toolfarm-registry-drift-'));

function run(args) {
  return spawnSync(process.execPath, [checker, '--json', ...args], { encoding: 'utf8' });
}

try {
  const source = path.join(temp, 'source');
  await mkdir(path.join(source, 'scripts'), { recursive: true });
  await writeFile(path.join(source, 'SKILL.md'), '---\nname: demo\ndescription: current\n---\n', 'utf8');
  await writeFile(path.join(source, 'scripts', 'run.mjs'), 'console.log("current")\n', 'utf8');

  const matching = path.join(temp, 'matching.json');
  await writeFile(matching, JSON.stringify({ files: [
    { path: 'SKILL.md', contents: '---\nname: demo\ndescription: current\n---\n' },
    { path: 'scripts/run.mjs', contents: 'console.log("current")\n' }
  ] }), 'utf8');

  const matchResult = run(['--source-dir', source, '--registry-file', matching]);
  assert.equal(matchResult.status, 0, matchResult.stderr || matchResult.stdout);
  const matchReport = JSON.parse(matchResult.stdout);
  assert.equal(matchReport.same, true);
  assert.deepEqual(matchReport.changed, []);

  const stale = path.join(temp, 'stale.json');
  await writeFile(stale, JSON.stringify({ hash: 'registry-reported-hash', files: [
    { path: 'SKILL.md', contents: '---\nname: demo\ndescription: old\n---\n' },
    { path: 'old.txt', contents: 'stale\n' }
  ] }), 'utf8');

  const driftResult = run(['--source-dir', source, '--registry-file', stale]);
  assert.equal(driftResult.status, 0, driftResult.stderr || driftResult.stdout);
  const drift = JSON.parse(driftResult.stdout);
  assert.equal(drift.same, false);
  assert.deepEqual(drift.changed, ['SKILL.md']);
  assert.deepEqual(drift.missingFromRegistry, ['scripts/run.mjs']);
  assert.deepEqual(drift.onlyInRegistry, ['old.txt']);
  assert.equal(drift.registryReportedHash, 'registry-reported-hash');

  const failResult = run(['--fail-on-drift', '--source-dir', source, '--registry-file', stale]);
  assert.equal(failResult.status, 2);

  console.log('agent-skill-registry-snapshot-drift-checker smoke test: OK');
} finally {
  await rm(temp, { recursive: true, force: true });
}
