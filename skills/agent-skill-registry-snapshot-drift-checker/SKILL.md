---
name: agent-skill-registry-snapshot-drift-checker
description: Compare a current Agent Skill source folder with a registry snapshot, detect missing, extra, or changed files, and produce deterministic evidence for stale registry/reindex debugging. Use when skills.sh or another registry appears older than the current GitHub source.
compatibility: Requires Node.js 18+ to run the bundled checker script.
metadata:
  author: toolfarm
  version: "0.1.0"
---

# Agent Skill Registry Snapshot Drift Checker

Diagnostic-only checker for registry snapshot drift.

## Procedure

1. Identify the current local skill directory.
2. Obtain the registry snapshot as JSON containing a `files` array with `{ path, contents }`, or use a registry skill ID such as `owner/repo/skill-slug`.
3. Run `scripts/check-registry-drift.mjs`.
4. Report missing, extra, and changed files separately.
5. Treat a mismatch as evidence of drift, not proof of a registry defect by itself.
6. Recommend the least-destructive next step: refresh/reindex, verify source path, or inspect registry ingestion.

## Offline example

```bash
node scripts/check-registry-drift.mjs \
  --source-dir ./skills/my-skill \
  --registry-file ./registry-snapshot.json
```

## Registry fetch example

```bash
node scripts/check-registry-drift.mjs \
  --source-dir ./skills/my-skill \
  --registry-id owner/repo/my-skill
```

When `VERCEL_OIDC_TOKEN` or `SKILLS_API_TOKEN` is present, the checker first uses the documented skills.sh v1 detail API. Without a token it falls back to the public legacy download endpoint when available.

## CI mode

```bash
node scripts/check-registry-drift.mjs --json --fail-on-drift \
  --source-dir ./skills/my-skill \
  --registry-file ./registry-snapshot.json
```

## Safety and privacy

The checker reads the local source folder and fetches only the remote registry snapshot when `--registry-id` is used. It does not upload local skill contents and performs no writes.
