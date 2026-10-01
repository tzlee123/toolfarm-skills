#!/usr/bin/env node

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.log(`Usage:
  node scripts/check-precedence.mjs --root <scope>=<path> [--root ...] [--json] [--fail-on-collision]

Scope aliases:
  project, repo, workspace -> project
  user, global, home      -> user
  anything else           -> custom scope
`);
}

function parseArgs(argv) {
  const roots = [];
  let json = false;
  let failOnCollision = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') { json = true; continue; }
    if (arg === '--fail-on-collision') { failOnCollision = true; continue; }
    if (arg === '--help' || arg === '-h') return { help: true, roots, json, failOnCollision };
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) throw new Error('--root requires <scope>=<path>');
      roots.push(parseRoot(value));
      i += 1;
      continue;
    }
    if (arg.startsWith('--root=')) { roots.push(parseRoot(arg.slice('--root='.length))); continue; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { help: false, roots, json, failOnCollision };
}

function parseRoot(value) {
  const eq = value.indexOf('=');
  if (eq <= 0 || eq === value.length - 1) throw new Error(`Invalid root '${value}'. Expected <scope>=<path>.`);
  const label = value.slice(0, eq).trim();
  return { label, scope: normalizeScope(label), rootPath: path.resolve(value.slice(eq + 1).trim()) };
}

function normalizeScope(label) {
  const normalized = label.toLowerCase();
  if (['project', 'repo', 'workspace'].includes(normalized)) return 'project';
  if (['user', 'global', 'home'].includes(normalized)) return 'user';
  return `custom:${normalized}`;
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function extractFrontmatterName(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { name: null, error: 'missing_frontmatter' };
  let closing = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { closing = i; break; }
  }
  if (closing === -1) return { name: null, error: 'unterminated_frontmatter' };
  for (let i = 1; i < closing; i += 1) {
    const match = lines[i].match(/^\s*name\s*:\s*(.+?)\s*$/);
    if (match) {
      const name = unquote(match[1]);
      return name ? { name, error: null } : { name: null, error: 'empty_name' };
    }
  }
  return { name: null, error: 'missing_name' };
}

async function isDirectory(target) {
  try { return (await stat(target)).isDirectory(); } catch { return false; }
}

async function readSkill(skillDir, root) {
  const skillMd = path.join(skillDir, 'SKILL.md');
  try {
    const parsed = extractFrontmatterName(await readFile(skillMd, 'utf8'));
    if (!parsed.name) {
      return { kind: 'diagnostic', severity: 'warning', code: parsed.error, path: skillMd, scope: root.scope, scopeLabel: root.label };
    }
    return { kind: 'skill', name: parsed.name, path: skillMd, skillDir, scope: root.scope, scopeLabel: root.label, rootPath: root.rootPath };
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    return { kind: 'diagnostic', severity: 'warning', code: 'read_error', path: skillMd, scope: root.scope, scopeLabel: root.label, message: error instanceof Error ? error.message : String(error) };
  }
}

async function scanRoot(root) {
  const results = [];
  if (!(await isDirectory(root.rootPath))) {
    results.push({ kind: 'diagnostic', severity: 'warning', code: 'root_not_found', path: root.rootPath, scope: root.scope, scopeLabel: root.label });
    return results;
  }

  const direct = await readSkill(root.rootPath, root);
  if (direct) {
    results.push(direct);
    if (direct.kind === 'skill') return results;
  }

  const entries = await readdir(root.rootPath, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;
    const candidate = path.join(root.rootPath, entry.name);
    if (!(await isDirectory(candidate))) continue;
    const skill = await readSkill(candidate, root);
    if (skill) results.push(skill);
  }
  return results;
}

function classifyCollision(entries) {
  const scopes = new Map();
  for (const entry of entries) {
    if (!scopes.has(entry.scope)) scopes.set(entry.scope, []);
    scopes.get(entry.scope).push(entry);
  }
  const hasCustom = [...scopes.keys()].some((scope) => scope.startsWith('custom:'));
  const project = scopes.get('project') ?? [];
  const user = scopes.get('user') ?? [];
  const hasSameScopeDuplicate = [...scopes.values()].some((items) => items.length > 1);

  if (hasCustom) return { classification: 'ambiguous_scope_collision', deterministicWinner: null, candidateWinners: entries.map((entry) => entry.path), note: 'A custom scope is involved. No universal precedence is assumed.' };

  if (hasSameScopeDuplicate) {
    const highestScope = project.length ? 'project' : user.length ? 'user' : null;
    const candidates = highestScope ? scopes.get(highestScope) : entries;
    return {
      classification: 'same_scope_collision', deterministicWinner: null,
      candidateWinners: candidates.map((entry) => entry.path),
      note: highestScope === 'project' && user.length
        ? 'Project scope outranks user scope, but multiple project candidates remain and same-scope tie-breaking is client-dependent.'
        : 'Multiple candidates exist in the same scope; first/last tie-breaking is client-dependent.'
    };
  }

  if (project.length === 1 && user.length >= 1) return { classification: 'project_over_user', deterministicWinner: project[0].path, candidateWinners: [project[0].path], note: 'Project-level skills conventionally override user-level skills.' };

  return { classification: 'ambiguous_scope_collision', deterministicWinner: null, candidateWinners: entries.map((entry) => entry.path), note: 'No universal precedence rule applies to this combination.' };
}

function buildReport(skills, diagnostics) {
  const byName = new Map();
  for (const skill of skills) {
    if (!byName.has(skill.name)) byName.set(skill.name, []);
    byName.get(skill.name).push(skill);
  }
  const collisions = [];
  for (const [name, entries] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (entries.length < 2) continue;
    entries.sort((a, b) => a.path.localeCompare(b.path));
    const classification = classifyCollision(entries);
    collisions.push({ name, ...classification, entries: entries.map(({ name: _name, kind: _kind, ...entry }) => entry) });
  }
  return { summary: { rootsScanned: new Set(skills.map((skill) => skill.rootPath)).size, skillsDiscovered: skills.length, uniqueNames: byName.size, collisions: collisions.length, diagnostics: diagnostics.length }, collisions, diagnostics };
}

function printHuman(report) {
  const { summary } = report;
  console.log('Agent Skill Precedence Preflight');
  console.log(`Skills: ${summary.skillsDiscovered} | Unique names: ${summary.uniqueNames} | Collisions: ${summary.collisions} | Diagnostics: ${summary.diagnostics}`);
  if (!report.collisions.length) console.log('\nNo duplicate skill names found.');
  for (const collision of report.collisions) {
    console.log(`\n[${collision.classification}] ${collision.name}`);
    for (const entry of collision.entries) {
      const winnerMark = collision.deterministicWinner === entry.path ? ' <- expected winner' : '';
      console.log(`  - ${entry.scopeLabel} (${entry.scope}): ${entry.path}${winnerMark}`);
    }
    if (collision.candidateWinners?.length > 1) {
      console.log('  Candidate winners:');
      for (const candidate of collision.candidateWinners) console.log(`    - ${candidate}`);
    }
    console.log(`  Note: ${collision.note}`);
  }
  if (report.diagnostics.length) {
    console.log('\nDiagnostics:');
    for (const diagnostic of report.diagnostics) console.log(`  - ${diagnostic.code}: ${diagnostic.path}${diagnostic.message ? ` (${diagnostic.message})` : ''}`);
  }
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    process.exitCode = 1;
    return;
  }
  if (args.help) { usage(); return; }
  if (!args.roots.length) {
    console.error('At least one --root <scope>=<path> is required.');
    usage();
    process.exitCode = 1;
    return;
  }
  const raw = (await Promise.all(args.roots.map(scanRoot))).flat();
  const report = buildReport(raw.filter((item) => item?.kind === 'skill'), raw.filter((item) => item?.kind === 'diagnostic'));
  if (args.json) console.log(JSON.stringify(report, null, 2)); else printHuman(report);
  if (args.failOnCollision && report.collisions.length > 0) process.exitCode = 2;
}

await main();
