---
name: agent-skill-precedence-preflight
description: Detect duplicate Agent Skill names across project and user skill roots, report project-over-user precedence, and flag same-scope collisions whose winner depends on the client. Use before installing, syncing, or debugging Agent Skills when multiple .agents/skills or client-specific skill directories may shadow each other.
compatibility: Requires Node.js 18+ to run the bundled deterministic checker script.
metadata:
  author: toolfarm
  version: "0.1.0"
---

# Agent Skill Precedence Preflight

Diagnostic-only preflight for duplicate Agent Skill names across project and user scopes.

## Procedure

1. Identify the skill roots relevant to the current agent/client.
2. Run `scripts/check-precedence.mjs` with repeated `--root <scope>=<path>` arguments.
3. Treat project-over-user collisions as deterministic.
4. Treat same-scope collisions as client-dependent warnings.
5. Treat custom-scope collisions as ambiguous unless the client documents its precedence.
6. Report the least-destructive fix; do not modify skill files automatically.

## Scope aliases

- `project`, `repo`, `workspace` -> project scope
- `user`, `global`, `home` -> user scope
- any other label -> custom/unknown scope

## Examples

```bash
node scripts/check-precedence.mjs \
  --root project=/repo/.agents/skills \
  --root user=$HOME/.agents/skills
```

```bash
node scripts/check-precedence.mjs --json \
  --root project=/repo/.agents/skills \
  --root project=/repo/.codex/skills \
  --root user=$HOME/.agents/skills \
  --root user=$HOME/.codex/skills
```

## Safety and privacy

The checker only reads local `SKILL.md` frontmatter. It makes no network requests, uploads no skill content, and performs no writes.
