#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const credentialPattern = /(authorization|x-api-key|api[-_]?key|bearer|access[-_]?token|secret[-_]?key)/i;
const dynamicFetchPattern = /\b(fetch|axios\.(?:get|post|put|patch|delete)|request)\s*\(\s*(?!['"`][^$`'"\n]+['"`])([^,\n)]+)/i;
const templateDynamicPattern = /\b(fetch|request)\s*\(\s*`[^`]*\$\{/i;
const urlFieldPattern = /(url|uri|endpoint|downloadUrl|pollingUrl|resultUrl)\s*[:=]/i;

function usage() {
  console.log(`Usage:
  node scripts/check-credential-boundary.mjs --path <file-or-dir> [--path ...] [--json] [--fail-on-findings]

The checker is read-only and never prints credential values.`);
}

function parseArgs(argv) {
  const paths = [];
  let json = false;
  let failOnFindings = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--fail-on-findings') failOnFindings = true;
    else if (arg === '--help' || arg === '-h') return { help: true, paths, json, failOnFindings };
    else if (arg === '--path') {
      const value = argv[++i];
      if (!value) throw new Error('--path requires a value');
      paths.push(path.resolve(value));
    } else if (arg.startsWith('--path=')) paths.push(path.resolve(arg.slice(7)));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return { help: false, paths, json, failOnFindings };
}

async function exists(target) {
  try { return await stat(target); } catch { return null; }
}

async function collect(target, out) {
  const info = await exists(target);
  if (!info) return;
  if (info.isFile()) {
    if (EXTENSIONS.has(path.extname(target))) out.push(target);
    return;
  }
  if (!info.isDirectory()) return;
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    await collect(path.join(target, entry.name), out);
  }
}

function inspect(text, file) {
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!credentialPattern.test(lines[i])) continue;
    const nearby = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 6)).join('\n');
    let rule = null;
    if (dynamicFetchPattern.test(nearby) || templateDynamicPattern.test(nearby) || urlFieldPattern.test(nearby)) {
      rule = 'credential-near-dynamic-url';
    } else if (/sanitizeRequestHeaders\s*\(/.test(nearby)) {
      rule = 'credential-near-header-sanitizer';
    }
    if (rule) findings.push({ file, line: i + 1, rule });
  }
  return findings;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); usage(); process.exitCode = 1; return; }
  if (args.help) { usage(); return; }
  if (!args.paths.length) { console.error('At least one --path is required.'); usage(); process.exitCode = 1; return; }

  const files = [];
  for (const target of args.paths) await collect(target, files);
  files.sort();
  const findings = [];
  for (const file of files) {
    try { findings.push(...inspect(await readFile(file, 'utf8'), file)); }
    catch (error) { findings.push({ file, line: null, rule: 'read-error', message: String(error?.message ?? error) }); }
  }

  const report = { summary: { filesScanned: files.length, findings: findings.length }, findings };
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`AI SDK Credential Boundary Preflight\nFiles scanned: ${files.length} | Findings: ${findings.length}`);
    for (const finding of findings) console.log(`- ${finding.rule}: ${finding.file}${finding.line ? `:${finding.line}` : ''}`);
    if (!findings.length) console.log('No matching credential-boundary patterns found.');
  }
  if (args.failOnFindings && findings.length) process.exitCode = 2;
}

await main();
