import fs from 'node:fs';
import path from 'node:path';

function leading(line) {
  return (line.match(/^\s*/) ?? [''])[0].length;
}

function unquote(value = '') {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

export function findCodexBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\s*-\s*uses:\s*openai\/codex-action@/i.test(lines[i])) continue;
    const base = leading(lines[i]);
    let end = i + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (line.trim() && leading(line) <= base && /^\s*-\s*(name|uses|run):/i.test(line)) break;
      end += 1;
    }
    blocks.push({ start: i + 1, lines: lines.slice(i, end) });
  }
  return blocks;
}

function blockValues(block) {
  const values = {};
  for (const line of block.lines) {
    const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (m) values[m[1].toLowerCase()] = unquote(m[2]);
  }
  return values;
}

export function scanText(text, file = '<workflow>') {
  const blocks = findCodexBlocks(text);
  const findings = [];
  for (const block of blocks) {
    const v = blockValues(block);
    const has = (key) => Object.prototype.hasOwnProperty.call(v, key) && v[key] !== '';
    const add = (level, rule, message) => findings.push({ level, rule, message, file, line: block.start });

    if (has('permission-profile') && has('sandbox')) add('error', 'CAX001', 'permission-profile and sandbox are mutually exclusive.');
    if (has('permission-profile') && String(v['safety-strategy']).toLowerCase() === 'read-only') add('error', 'CAX002', 'permission-profile cannot be combined with safety-strategy: read-only.');
    if (has('prompt') && has('prompt-file')) add('error', 'CAX003', 'prompt and prompt-file are mutually exclusive.');
    if (has('output-schema') && has('output-schema-file')) add('error', 'CAX004', 'output-schema and output-schema-file are mutually exclusive.');

    if (String(v['safety-strategy']).toLowerCase() === 'unsafe') add('warning', 'CAX101', 'safety-strategy: unsafe removes privilege reduction; use only for a fully trusted workflow.');
    if (String(v['allow-users'] ?? '').replace(/["']/g, '').split(',').map((x) => x.trim()).includes('*')) add('warning', 'CAX102', 'allow-users includes *, widening who may trigger the Codex workflow.');
    if (String(v['safety-strategy']).toLowerCase() === 'read-only' && has('openai-api-key')) add('warning', 'CAX103', 'read-only limits writes/network but does not by itself guarantee the API key cannot be read from process memory.');
    if (has('sandbox') && !has('permission-profile')) add('warning', 'CAX104', 'legacy sandbox is configured; current guidance prefers permission-profile for new workflows.');
    if (!has('sandbox') && !has('permission-profile')) add('warning', 'CAX105', 'no permission-profile is set; the action may use its legacy sandbox fallback.');
  }
  return { blocks, findings };
}

function collectFiles(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return /\.ya?ml$/i.test(target) ? [target] : [];
  const files = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (/\.ya?ml$/i.test(entry.name)) files.push(full);
  }
  return files;
}

function annotation(finding) {
  const command = finding.level === 'error' ? 'error' : 'warning';
  const safe = finding.message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log(`::${command} file=${finding.file},line=${finding.line},title=${finding.rule}::${safe}`);
}

function main() {
  const target = process.env.TOOLFARM_CODEX_PREFLIGHT_PATH || process.argv[2] || '.github/workflows';
  const failOnWarning = String(process.env.TOOLFARM_CODEX_PREFLIGHT_FAIL_ON_WARNING || '').toLowerCase() === 'true' || process.argv.includes('--fail-on-warning');
  const files = collectFiles(target);
  if (!files.length) {
    console.error(`No YAML workflow files found at: ${target}`);
    process.exit(2);
  }

  let codexSteps = 0;
  const findings = [];
  for (const file of files) {
    const result = scanText(fs.readFileSync(file, 'utf8'), file);
    codexSteps += result.blocks.length;
    findings.push(...result.findings);
  }

  for (const finding of findings) annotation(finding);
  const errors = findings.filter((x) => x.level === 'error').length;
  const warnings = findings.filter((x) => x.level === 'warning').length;
  console.log(`Codex Action Safety Preflight: ${files.length} workflow file(s), ${codexSteps} codex-action step(s), ${errors} error(s), ${warnings} warning(s).`);

  if (errors > 0 || (failOnWarning && warnings > 0)) process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  main();
}
