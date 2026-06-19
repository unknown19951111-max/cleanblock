# Architecture

## Service Worker Modules

The background service worker is split into native MV3 ES modules with no bundler:

| Module | Responsibility |
|--------|---------------|
| `service-worker.js` | Lifecycle, alarms, message routing (80 lines) |
| `constants.js` | All shared constants, rule ID ranges, allowed fields |
| `stats.js` | Local stats storage |
| `crypto.js` | SHA-256 hashing, Ed25519 signature verification, canonicalization |
| `manifest-validation.js` | Update manifest shape validation, file descriptor validation |
| `rule-validation.js` | DNR rule validation, executable-field rejection |
| `update-pipeline.js` | Full update validation and application pipeline |
| `update-state.js` | Update state, last-known-good, rollback management |
| `allowlist.js` | Domain parsing, allowlist CRUD, DNR sync |
| `storage-init.js` | Storage initialization |
| `validation-helpers.js` | Shared validation utilities (no circular imports) |

## Rule ID Ranges

| Range | Purpose |
|-------|---------|
| 1–2999 | Static packaged rulesets (core ads, privacy trackers, annoyances) |
| 50000–59999 | Manual user allowlist (dynamic rules, `initiatorDomains`) |
| 60000–89999 | Signed remote update rules (dynamic overlay, not static replacement) |

## Update Validation Pipeline

1. Manifest shape validation — reject unknown fields
2. Monotonic version check
3. Ed25519 signature verification (scaffold — placeholder key)
4. File presence and type check
5. SHA-256 hash verification per file
6. DNR rule validation — allowed actions, allowed fields, recursive executable-field rejection, ID range enforcement
7. Atomic application — single `updateDynamicRules` call (remove old + add new)
8. On failure: record failure, activate rollback, preserve last-known-good
