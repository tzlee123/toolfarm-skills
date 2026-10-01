---
name: ai-sdk-credential-boundary-preflight
description: Scan AI SDK and agent application source locally for credential-bearing headers placed near dynamic or externally controlled request URLs. Use before shipping fetch/download/provider code that may attach Authorization, API keys, bearer tokens, or similar credentials to URLs that are not obviously fixed or allowlisted.
compatibility: Requires Node.js 18+ to run the bundled deterministic checker script.
metadata:
  author: toolfarm
  version: "0.1.0"
---

# AI SDK Credential Boundary Preflight

Run a narrow, defensive static preflight before shipping AI SDK or agent code that combines credentials with outbound URLs.

## Procedure

1. Run `scripts/check-credential-boundary.mjs` against the repository or selected source paths.
2. Review findings where credential-bearing headers appear close to dynamic URLs, template URLs, or URL fields.
3. Prefer fixed/same-origin destinations or explicit destination allowlists before attaching credentials.
4. Treat findings as review prompts, not proof of a vulnerability.
5. Do not print, copy, upload, or modify credential values.

## Examples

```bash
node scripts/check-credential-boundary.mjs --path src
```

```bash
node scripts/check-credential-boundary.mjs --json --fail-on-findings --path src --path app
```

## Safety and privacy

The checker reads local text files only. It makes no network requests, does not read environment-variable values, does not print credential values, and performs no writes.
