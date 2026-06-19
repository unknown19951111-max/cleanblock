# Trust Tests

## Current automated trust checks

CleanBlock's trust verification currently lives in four scripts under `scripts/`:

| Script | Coverage |
|--------|----------|
| `verify-manifest.js` | MV3 version, exact permissions, forbidden permissions, icon/ruleset/service-worker file existence |
| `verify-rulesets.js` | Valid JSON, unique IDs, correct ID ranges, block-only actions, no main_frame blocking |
| `verify-no-privacy-regressions.js` | No fetch/XHR, no remote URLs, no eval, no forbidden Chrome APIs, no DEV handlers, no key material |
| `verify-update-trust-surface.js` | Trust docs, schema files, example manifest, trust functions, popup trust UI elements |

Run all checks: `npm run verify`

## Future unit/integration trust tests

This directory is reserved for test-framework-based trust tests (e.g., using a test runner like Vitest or Jest). Planned test files from the MVP spec:

- `telemetry-forbidden-fields.test.js` — grep codebase for outbound data payloads
- `allowlist-ledger.test.js` — verify no business exceptions in allowlist schema
- `permission-drift.test.js` — compare manifest permissions against permission-map.json
- `remote-rule-parser.test.js` — feed malicious rule fixtures to the validator
- `signed-update.test.js` — end-to-end signature and hash verification
- `rollback.test.js` — simulate bad updates, verify last-known-good restoration
- `store-claims.test.js` — verify every store claim maps to an artifact and test

These tests will be implemented when a test runner is added to the project.
