#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(here, 'check-credential-boundary.mjs');
const temp = await mkdtemp(path.join(os.tmpdir(), 'toolfarm-credential-boundary-'));

function run(args) {
  const result = spawnSync(process.execPath, [checker, '--json', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

try {
  const src = path.join(temp, 'src');
  await mkdir(src, { recursive: true });
  await writeFile(path.join(src, 'risky.ts'), `const target = input.url;\nawait fetch(target, { headers: { Authorization: 'Bearer ' + token } });\n`, 'utf8');
  await writeFile(path.join(src, 'safe.ts'), `await fetch('https://api.example.com/status', { headers: { 'content-type': 'application/json' } });\n`, 'utf8');

  const report = run(['--path', src]);
  assert.equal(report.summary.filesScanned, 2);
  assert.equal(report.summary.findings, 1);
  assert.equal(report.findings[0].rule, 'credential-near-dynamic-url');
  assert.match(report.findings[0].file, /risky\.ts$/);
  assert.equal('snippet' in report.findings[0], false);

  const failing = spawnSync(process.execPath, [checker, '--json', '--fail-on-findings', '--path', src], { encoding: 'utf8' });
  assert.equal(failing.status, 2);

  console.log('ai-sdk-credential-boundary-preflight smoke test: OK');
} finally {
  await rm(temp, { recursive: true, force: true });
}
