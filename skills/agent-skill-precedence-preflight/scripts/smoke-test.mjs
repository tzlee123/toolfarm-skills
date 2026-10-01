#!/usr/bin/env node

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const checker = path.join(here, 'check-precedence.mjs');
const temp = await mkdtemp(path.join(os.tmpdir(), 'toolfarm-skill-precedence-'));

async function addSkill(root, dir, name) {
  const target = path.join(root, dir);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'SKILL.md'), `---\nname: ${name}\ndescription: smoke test skill\n---\n\nTest.\n`, 'utf8');
}

function run(args) {
  const result = spawnSync(process.execPath, [checker, '--json', ...args], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

try {
  const projectA = path.join(temp, 'project-a');
  const projectB = path.join(temp, 'project-b');
  const user = path.join(temp, 'user');
  await mkdir(projectA, { recursive: true });
  await mkdir(projectB, { recursive: true });
  await mkdir(user, { recursive: true });

  await addSkill(projectA, 'alpha-project', 'alpha');
  await addSkill(user, 'alpha-user', 'alpha');
  await addSkill(projectA, 'beta-project-a', 'beta');
  await addSkill(projectB, 'beta-project-b', 'beta');
  await addSkill(user, 'gamma-user', 'gamma');

  const report = run([
    '--root', `project=${projectA}`,
    '--root', `project=${projectB}`,
    '--root', `user=${user}`,
  ]);

  assert.equal(report.summary.skillsDiscovered, 5);
  assert.equal(report.summary.collisions, 2);

  const alpha = report.collisions.find((item) => item.name === 'alpha');
  assert.ok(alpha);
  assert.equal(alpha.classification, 'project_over_user');
  assert.match(alpha.deterministicWinner, /alpha-project[\\/]SKILL\.md$/);

  const beta = report.collisions.find((item) => item.name === 'beta');
  assert.ok(beta);
  assert.equal(beta.classification, 'same_scope_collision');
  assert.equal(beta.deterministicWinner, null);
  assert.equal(beta.candidateWinners.length, 2);

  const failing = spawnSync(
    process.execPath,
    [checker, '--json', '--fail-on-collision', '--root', `project=${projectA}`, '--root', `user=${user}`],
    { encoding: 'utf8' },
  );
  assert.equal(failing.status, 2);

  console.log('agent-skill-precedence-preflight smoke test: OK');
} finally {
  await rm(temp, { recursive: true, force: true });
}
