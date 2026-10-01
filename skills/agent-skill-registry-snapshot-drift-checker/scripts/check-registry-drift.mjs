#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.log(`Usage:
  node scripts/check-registry-drift.mjs --source-dir <path> (--registry-file <snapshot.json> | --registry-id <owner/repo/skill>) [--json] [--fail-on-drift]

Examples:
  node scripts/check-registry-drift.mjs --source-dir ./skills/my-skill --registry-file ./snapshot.json
  node scripts/check-registry-drift.mjs --source-dir ./skills/my-skill --registry-id owner/repo/my-skill
`);
}

function parseArgs(argv) {
  const out = { sourceDir: null, registryFile: null, registryId: null, json: false, failOnDrift: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') out.json = true;
    else if (arg === '--fail-on-drift') out.failOnDrift = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--source-dir') out.sourceDir = path.resolve(argv[++i] ?? '');
    else if (arg === '--registry-file') out.registryFile = path.resolve(argv[++i] ?? '');
    else if (arg === '--registry-id') out.registryId = argv[++i] ?? '';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (out.help) return out;
  if (!out.sourceDir) throw new Error('--source-dir is required');
  if (Boolean(out.registryFile) === Boolean(out.registryId)) {
    throw new Error('Provide exactly one of --registry-file or --registry-id');
  }
  return out;
}

function normalizeText(text) {
  return text.replace(/\r\n/g, '\n');
}

async function isDirectory(target) {
  try { return (await stat(target)).isDirectory(); } catch { return false; }
}

async function collectFiles(root, current = root, out = {}) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (['.git', 'node_modules', '.DS_Store'].includes(entry.name)) continue;
    const full = path.join(current, entry.name);
    const relative = path.relative(root, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      await collectFiles(root, full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      out[relative] = normalizeText(await readFile(full, 'utf8'));
    } catch {
      // Agent Skills are text-first; unreadable/binary files are excluded from this diagnostic.
    }
  }
  return out;
}

function normalizeRegistrySnapshot(data) {
  const files = Array.isArray(data?.files) ? data.files : Array.isArray(data?.skill?.files) ? data.skill.files : null;
  if (!files) throw new Error('Registry JSON does not contain a files array');
  const out = {};
  for (const file of files) {
    if (file && typeof file.path === 'string' && typeof file.contents === 'string') {
      out[file.path.replace(/^\.\//, '')] = normalizeText(file.contents);
    }
  }
  if (!Object.keys(out).length) throw new Error('Registry snapshot contains no readable text files');
  return { files: out, reportedHash: typeof data.hash === 'string' ? data.hash : null };
}

async function loadRegistryFile(filePath) {
  return normalizeRegistrySnapshot(JSON.parse(await readFile(filePath, 'utf8')));
}

async function fetchJson(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function loadRegistryId(id) {
  const parts = id.split('/').filter(Boolean);
  if (parts.length < 3) throw new Error('--registry-id must look like owner/repo/skill');
  const [owner, repo, ...slugParts] = parts;
  const slug = slugParts.join('/');
  const token = process.env.VERCEL_OIDC_TOKEN || process.env.SKILLS_API_TOKEN || '';
  const v1Url = `https://skills.sh/api/v1/skills/${parts.map(encodeURIComponent).join('/')}`;
  if (token) {
    try {
      return normalizeRegistrySnapshot(await fetchJson(v1Url, token));
    } catch (error) {
      if (process.env.TOOLFARM_SKILL_DEBUG) console.error(`v1 detail API failed: ${error.message}`);
    }
  }
  const legacyUrl = `https://skills.sh/api/download/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(slug)}`;
  try {
    return normalizeRegistrySnapshot(await fetchJson(legacyUrl, ''));
  } catch (error) {
    const hint = token ? '' : ' Set VERCEL_OIDC_TOKEN or SKILLS_API_TOKEN to use the documented v1 API.';
    throw new Error(`Could not fetch registry snapshot for ${id}: ${error.message}.${hint}`);
  }
}

function canonicalHash(files) {
  const hash = createHash('sha256');
  for (const filePath of Object.keys(files).sort()) {
    hash.update(filePath); hash.update('\0'); hash.update(files[filePath]); hash.update('\0\0');
  }
  return hash.digest('hex');
}

function compare(source, registry) {
  const sourcePaths = Object.keys(source).sort();
  const registryPaths = Object.keys(registry).sort();
  const missingFromRegistry = sourcePaths.filter((p) => !(p in registry));
  const onlyInRegistry = registryPaths.filter((p) => !(p in source));
  const changed = sourcePaths.filter((p) => p in registry && source[p] !== registry[p]);
  return {
    same: missingFromRegistry.length === 0 && onlyInRegistry.length === 0 && changed.length === 0,
    missingFromRegistry,
    onlyInRegistry,
    changed,
  };
}

function printHuman(report) {
  console.log('Agent Skill Registry Snapshot Drift Checker');
  console.log(`Status: ${report.same ? 'MATCH' : 'DRIFT DETECTED'}`);
  console.log(`Current files: ${report.sourceFileCount} | Registry files: ${report.registryFileCount}`);
  console.log(`Current local hash: ${report.sourceHash}`);
  console.log(`Registry local hash: ${report.registryHash}`);
  if (report.registryReportedHash) console.log(`Registry reported hash: ${report.registryReportedHash}`);
  console.log(`Missing from registry: ${report.missingFromRegistry.length ? report.missingFromRegistry.join(', ') : 'none'}`);
  console.log(`Only in registry: ${report.onlyInRegistry.length ? report.onlyInRegistry.join(', ') : 'none'}`);
  console.log(`Changed files: ${report.changed.length ? report.changed.join(', ') : 'none'}`);
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); usage(); process.exitCode = 1; return; }
  if (args.help) { usage(); return; }
  try {
    if (!(await isDirectory(args.sourceDir))) throw new Error(`Source directory not found: ${args.sourceDir}`);
    const source = await collectFiles(args.sourceDir);
    if (!Object.keys(source).length) throw new Error('Source directory contains no readable text files');
    const registrySnapshot = args.registryFile ? await loadRegistryFile(args.registryFile) : await loadRegistryId(args.registryId);
    const comparison = compare(source, registrySnapshot.files);
    const report = {
      ...comparison,
      sourceFileCount: Object.keys(source).length,
      registryFileCount: Object.keys(registrySnapshot.files).length,
      sourceHash: canonicalHash(source),
      registryHash: canonicalHash(registrySnapshot.files),
      registryReportedHash: registrySnapshot.reportedHash,
    };
    if (args.json) console.log(JSON.stringify(report, null, 2)); else printHuman(report);
    if (args.failOnDrift && !report.same) process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
