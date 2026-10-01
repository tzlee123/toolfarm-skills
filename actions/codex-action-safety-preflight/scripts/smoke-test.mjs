import assert from 'node:assert/strict';
import { scanText } from './check-codex-action.mjs';

const invalid = `name: codex\non: workflow_dispatch\njobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: openai/codex-action@v1\n        with:\n          openai-api-key: \${{ secrets.OPENAI_API_KEY }}\n          permission-profile: ":workspace"\n          sandbox: workspace-write\n          prompt: review\n          prompt-file: prompt.md\n          allow-users: "*"\n`;

const result = scanText(invalid, 'fixture.yml');
assert.equal(result.blocks.length, 1);
assert.ok(result.findings.some((x) => x.rule === 'CAX001' && x.level === 'error'));
assert.ok(result.findings.some((x) => x.rule === 'CAX003' && x.level === 'error'));
assert.ok(result.findings.some((x) => x.rule === 'CAX102' && x.level === 'warning'));

const good = `jobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: openai/codex-action@v1\n        with:\n          openai-api-key: \${{ secrets.OPENAI_API_KEY }}\n          permission-profile: ":workspace"\n          prompt: review this change\n`;
const clean = scanText(good, 'good.yml');
assert.equal(clean.blocks.length, 1);
assert.equal(clean.findings.length, 0);

console.log('Codex Action Safety Preflight smoke test passed.');
