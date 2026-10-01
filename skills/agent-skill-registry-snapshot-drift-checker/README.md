# Agent Skill Registry Snapshot Drift Checker

Compare a current local Agent Skill source with a registry snapshot and report missing, extra, or changed files.

## Install

```bash
npx skills add tzlee123/toolfarm-skills@agent-skill-registry-snapshot-drift-checker
```

## Offline comparison

```bash
node scripts/check-registry-drift.mjs \
  --source-dir ./skills/my-skill \
  --registry-file ./registry-snapshot.json
```

## Direct registry comparison

```bash
node scripts/check-registry-drift.mjs \
  --source-dir ./skills/my-skill \
  --registry-id owner/repo/my-skill
```

If `VERCEL_OIDC_TOKEN` or `SKILLS_API_TOKEN` is available, the checker uses the documented skills.sh v1 detail API. Otherwise it falls back to the legacy public download endpoint when available.

Use `--json` for structured output and `--fail-on-drift` for CI. Local source contents are never uploaded.

Web companion: https://www.toolfarm.app/en/p/agent-skill-registry-snapshot-drift-checker?utm_source=github&utm_medium=skill-registry&utm_campaign=agent_skill_registry_drift
