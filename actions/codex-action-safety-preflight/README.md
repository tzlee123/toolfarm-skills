# Codex Action Safety Preflight

A narrow, deterministic preflight for workflows using `openai/codex-action`.

It checks configuration before Codex Action runs, including:

- `permission-profile` together with `sandbox`
- `permission-profile` together with `safety-strategy: read-only`
- `prompt` together with `prompt-file`
- `output-schema` together with `output-schema-file`
- `safety-strategy: unsafe`
- wildcard `allow-users`
- `read-only` plus an OpenAI API key
- legacy or implicit sandbox fallback

It does **not** inspect secret values and is not a general GitHub Actions security scanner.

## Use in a workflow

```yaml
- name: Preflight Codex Action configuration
  uses: tzlee123/toolfarm-skills/actions/codex-action-safety-preflight@main
```

Optional strict mode:

```yaml
- uses: tzlee123/toolfarm-skills/actions/codex-action-safety-preflight@main
  with:
    path: .github/workflows
    fail-on-warning: "true"
```

## Local CLI

```bash
node actions/codex-action-safety-preflight/scripts/check-codex-action.mjs .github/workflows
```

The scanner reads workflow YAML as text and prints GitHub annotations. It makes no network requests and does not read secret values.

Web companion: https://www.toolfarm.app/en/p/codex-action-safety-preflight?utm_source=github&utm_medium=github-action&utm_campaign=codex_action_safety
