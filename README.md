# Toolfarm Skills

Public developer utilities from [Toolfarm](https://www.toolfarm.app/?utm_source=github&utm_medium=skill-registry&utm_campaign=toolfarm_skills), focused on narrow, deterministic workflows that have survived Toolfarm's Trend Capture / Surface Radar review.

## Agent Skills

Toolfarm supports two discovery paths:

```bash
# Discover the site-native Skill catalog directly from toolfarm.app
npx skills@latest add https://www.toolfarm.app --list

# Install an executable Skill from the public GitHub source
npx skills add tzlee123/toolfarm-skills@agent-skill-precedence-preflight
npx skills add tzlee123/toolfarm-skills@agent-skill-registry-snapshot-drift-checker
npx skills add tzlee123/toolfarm-skills@ai-sdk-credential-boundary-preflight
```

The domain discovery path is backed by Toolfarm's production Agent Skills index at `https://www.toolfarm.app/.well-known/agent-skills/index.json`. CI verifies that the public `skills` CLI can discover all current site-native Skills from the domain without performing synthetic installs.

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

### `agent-skill-registry-snapshot-drift-checker`

Compare a current Agent Skill source folder with a registry snapshot and produce deterministic evidence for stale registry/reindex debugging.

- compares full text file trees, not only metadata
- reports missing, extra, and changed files separately
- computes local SHA-256 fingerprints for both snapshots
- supports offline registry JSON or a skills.sh registry ID
- never uploads the local source folder
- supports JSON output and CI failure mode

Source: `skills/agent-skill-registry-snapshot-drift-checker/`

Web companion: [Agent Skill Registry Snapshot Drift Checker](https://www.toolfarm.app/en/p/agent-skill-registry-snapshot-drift-checker?utm_source=github&utm_medium=skill-registry&utm_campaign=agent_skill_registry_drift)

### `ai-sdk-credential-boundary-preflight`

Scan AI SDK / agent source for credential-bearing headers placed close to dynamic or externally controlled request URLs.

- read-only local static analysis
- no network requests
- does not read environment-variable values
- reports only file, line and rule metadata — not credential values or source snippets
- supports JSON output and CI failure mode

Source: `skills/ai-sdk-credential-boundary-preflight/`

Web companion: [AI SDK Credential Boundary Preflight](https://www.toolfarm.app/en/p/ai-sdk-credential-boundary-preflight?utm_source=github&utm_medium=skill-registry&utm_campaign=ai_sdk_credential_boundary)

## GitHub Actions

### `codex-action-safety-preflight`

Preflight workflows using `openai/codex-action` before the Codex Action step runs.

```yaml
- name: Preflight Codex Action configuration
  uses: tzlee123/toolfarm-skills/actions/codex-action-safety-preflight@main
```

It detects mutually exclusive inputs and narrow high-risk settings such as `permission-profile + sandbox`, wildcard `allow-users`, and `safety-strategy: unsafe`. It does not read secret values and is not a general GitHub Actions security scanner.

Source: `actions/codex-action-safety-preflight/`

Web companion: [Codex Action Safety Preflight](https://www.toolfarm.app/en/p/codex-action-safety-preflight?utm_source=github&utm_medium=github-action&utm_campaign=codex_action_safety)

## Distribution policy

This repository is intentionally selective. Toolfarm does not publish generic wrappers simply because a platform or protocol is trending. New surfaces are added only when a concrete workflow failure survives competition and distribution review.

Toolfarm web utilities remain available at [toolfarm.app](https://www.toolfarm.app/?utm_source=github&utm_medium=skill-registry&utm_campaign=toolfarm_skills).
