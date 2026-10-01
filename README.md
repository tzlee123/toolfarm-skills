# Toolfarm Skills

Public Agent Skills from [Toolfarm](https://www.toolfarm.app/?utm_source=github&utm_medium=skill-registry&utm_campaign=toolfarm_skills), focused on narrow, deterministic developer workflows that have survived Toolfarm's Trend Capture / Surface Radar review.

## Install

Install an individual skill with the `skills` CLI:

```bash
npx skills add tzlee123/toolfarm-skills@agent-skill-precedence-preflight
```

## Available skills

### `agent-skill-precedence-preflight`

Detect duplicate Agent Skill names across project and user roots before they produce ambiguous shadowing or runtime precedence failures.

- deterministic local scanner
- no network requests
- reads only local `SKILL.md` frontmatter
- reports project-over-user precedence
- flags same-scope collisions as client-dependent rather than guessing a winner
- supports JSON output and CI failure mode

Source: `skills/agent-skill-precedence-preflight/`

Web companion: [Agent Skill Precedence Collision Preflight](https://www.toolfarm.app/en/p/agent-skill-precedence-collision-preflight?utm_source=github&utm_medium=skill-registry&utm_campaign=agent_skill_precedence)

## Distribution policy

This repository is intentionally selective. Toolfarm does not publish generic wrappers simply because a platform or protocol is trending. Skills are added only when a concrete workflow failure survives competition and distribution review.

Toolfarm web utilities remain available at [toolfarm.app](https://www.toolfarm.app/?utm_source=github&utm_medium=skill-registry&utm_campaign=toolfarm_skills).
