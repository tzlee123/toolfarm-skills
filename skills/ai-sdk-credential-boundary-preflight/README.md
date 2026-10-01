# AI SDK Credential Boundary Preflight

A narrow defensive checker for credential-bearing headers near dynamic or externally controlled request URLs.

## Install

```bash
npx skills add tzlee123/toolfarm-skills@ai-sdk-credential-boundary-preflight
```

## Run the checker directly

```bash
node scripts/check-credential-boundary.mjs --path src
```

JSON / CI mode:

```bash
node scripts/check-credential-boundary.mjs --json --fail-on-findings --path src --path app
```

The checker is read-only. It makes no network requests, does not read environment-variable values, and reports only file/line/rule metadata rather than source snippets or credential values.

Web companion: https://www.toolfarm.app/en/p/ai-sdk-credential-boundary-preflight?utm_source=github&utm_medium=skill-registry&utm_campaign=ai_sdk_credential_boundary
