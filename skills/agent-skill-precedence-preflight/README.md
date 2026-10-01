# Agent Skill Precedence Preflight

Detect duplicate Agent Skill names before they create shadowing or ambiguous runtime resolution.

## Install

```bash
npx skills add tzlee123/toolfarm-skills@agent-skill-precedence-preflight
```

## Run the bundled checker directly

```bash
node scripts/check-precedence.mjs \
  --root project=/path/to/project/.agents/skills \
  --root user=$HOME/.agents/skills
```

JSON output:

```bash
node scripts/check-precedence.mjs --json \
  --root project=/path/to/project/.agents/skills \
  --root user=$HOME/.agents/skills
```

CI mode exits with code `2` when any duplicate skill name is found:

```bash
node scripts/check-precedence.mjs --fail-on-collision \
  --root project=/path/to/project/.agents/skills \
  --root user=$HOME/.agents/skills
```

The checker is read-only and makes no network requests.

Web companion: [Toolfarm Agent Skill Precedence Collision Preflight](https://www.toolfarm.app/en/p/agent-skill-precedence-collision-preflight?utm_source=github&utm_medium=skill-registry&utm_campaign=agent_skill_precedence)
