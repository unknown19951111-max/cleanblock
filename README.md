# CleanBlock

A Manifest V3 privacy-preserving content blocker for Chrome.

## What It Does

CleanBlock blocks ads, trackers, and annoyances using Chrome's `declarativeNetRequest` API. It requests no host permissions, runs no content scripts, collects no telemetry, and ships no build artifacts — the source in this repo is the exact code that runs in Chrome.

The project demonstrates trust engineering, MV3 architecture, and auditable privacy design. It is not a commercial ad blocker competing with uBlock Origin or AdBlock Plus.

## Why This Matters

Most ad blockers ask you to trust their code. CleanBlock asks you to verify it.

The hard part is not blocking a URL — the hard part is proving what the extension cannot do. CleanBlock is built around that constraint:

- **No host permissions.** CleanBlock does not request host permissions. DNR rulesets operate without access to page content.
- **No telemetry.** Nothing leaves the device. No analytics SDKs, no crash reporters, no outbound requests.
- **No content scripts.** No injected JavaScript, no DOM access, no page manipulation.
- **No DEV runtime handlers.** CleanBlock does not ship development-only runtime message handlers. The runtime message surface is exactly 4 product endpoints.
- **No blocked counters.** CleanBlock intentionally does not collect per-request blocked counts. Accurate counting requires `declarativeNetRequestFeedback` — a permission CleanBlock refuses.
- **No build step.** Raw source ships directly. A reviewer can read every line that executes.

Every trust claim is mechanically verifiable by running `npm run verify`.

## Quick Facts

| | |
|-|-|
| Manifest | V3 |
| Permissions | `storage`, `declarativeNetRequest`, `alarms` |
| Host permissions | None |
| Telemetry | None |
| Content scripts | None |
| DEV handlers | None |
| Allowlist | Local, manual only |
| Signed updates | Local validation scaffold (Ed25519 + SHA-256) |
| Build step | None — raw source |
| License | MIT |

## Current Status

**Implemented:**

- Static DNR rulesets (core ads, privacy trackers, annoyances)
- Manual user allowlist with domain validation
- Signed update validation pipeline (shape, version, signature, hash, rule validation)
- Last-known-good / rollback state management
- Trust summary popup (replaces cosmetic blocked counters)
- Four automated verification scripts
- Trust documentation and machine-readable schemas
- MV3 ES module architecture

**Scaffolded (logic exists, not connected):**

- Ed25519 signature verification (placeholder public key)
- Update package application pipeline

**Intentionally not implemented:**

- Remote update fetching — no endpoint is contacted
- Production signing key — to be generated offline before first signed update

**Planned (v0.2):**

- CSS cosmetic filtering via `chrome.scripting.insertCSS()`
- Test-framework-based trust tests (see [tests/trust/README.md](tests/trust/README.md))

## Architecture

### Service Worker Modules

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

### Permissions

```
storage, declarativeNetRequest, alarms
```

No `host_permissions`. No `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `management`, `offscreen`, or `declarativeNetRequestFeedback`.

### Rule ID Ranges

| Range | Purpose |
|-------|---------|
| 1–2999 | Static packaged rulesets (core ads, privacy trackers, annoyances) |
| 50000–59999 | Manual user allowlist (dynamic rules, `initiatorDomains`) |
| 60000–89999 | Signed remote update rules (dynamic overlay, not static replacement) |

### Update Validation Pipeline

1. Manifest shape validation — reject unknown fields
2. Monotonic version check
3. Ed25519 signature verification (scaffold — placeholder key)
4. File presence and type check
5. SHA-256 hash verification per file
6. DNR rule validation — allowed actions, allowed fields, recursive executable-field rejection, ID range enforcement
7. Atomic application — single `updateDynamicRules` call (remove old + add new)
8. On failure: record failure, activate rollback, preserve last-known-good

## Trust Model

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

A signed update can add, remove, or modify DNR block/allow/upgradeScheme rules. It cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

### Trust Documentation

| Document | Contents |
|----------|----------|
| [trust/TELEMETRY.md](trust/TELEMETRY.md) | No telemetry leaves the device |
| [trust/ALLOWLIST.md](trust/ALLOWLIST.md) | Manual allowlist behavior, no business exceptions |
| [trust/PERMISSIONS.md](trust/PERMISSIONS.md) | Exact permissions and why each is excluded |
| [trust/SECURITY.md](trust/SECURITY.md) | Signed update validation, runtime message surface, key management |
| [trust/BUILD_PROVENANCE.md](trust/BUILD_PROVENANCE.md) | No build step — raw source ships directly |

See also: [docs/REMOTE_RULES.md](docs/REMOTE_RULES.md) and [updates/README.md](updates/README.md) for update manifest format and placeholder documentation.

## Verification

```
npm run verify
```

Runs all four verification scripts in sequence:

| Command | Checks |
|---------|--------|
| `npm run verify:manifest` | MV3, exact permissions, forbidden permissions, icon/ruleset file existence, ES module syntax |
| `npm run verify:rulesets` | Valid JSON, unique IDs, correct ID ranges, block-only actions, no main_frame |
| `npm run verify:privacy` | No fetch/XHR, no remote URLs, no eval, no forbidden Chrome APIs, no DEV handlers, no key material |
| `npm run verify:trust` | Trust docs, schema files, example manifest, all trust functions present, popup trust UI |

## Local Smoke Test

See [docs/LOCAL_SMOKE_TEST.md](docs/LOCAL_SMOKE_TEST.md) for a step-by-step checklist to load the extension in Chrome and verify popup, allowlist, trust state, and stability.

## What CleanBlock Is Not

- Not a YouTube or Twitch ad-bypass tool
- Not a clone of Pie AdBlock or any rewards/affiliate system
- Not an AI-powered blocker
- Not a telemetry or analytics product
- Not a filter-list aggregator (no EasyList, no uBlock Origin imports)

## Repo Structure

```
cleanblock/
  manifest.json
  package.json
  LICENSE
  src/
    background/
      service-worker.js
      constants.js
      stats.js
      crypto.js
      manifest-validation.js
      rule-validation.js
      update-pipeline.js
      update-state.js
      allowlist.js
      storage-init.js
      validation-helpers.js
    popup.html
    popup.css
    popup.js
  rules/static/
    core-ads.json
    privacy-trackers.json
    annoyances.json
  trust/
    TELEMETRY.md
    ALLOWLIST.md
    PERMISSIONS.md
    SECURITY.md
    BUILD_PROVENANCE.md
  schemas/
    telemetry-schema.json
    allowlist.json
    permission-map.json
    remote-rule-schema.json
    store-claims.json
  updates/
    update-manifest.example.json
    README.md
  docs/
    REMOTE_RULES.md
    LOCAL_SMOKE_TEST.md
  tests/trust/
    README.md
  scripts/
    verify-manifest.js
    verify-rulesets.js
    verify-no-privacy-regressions.js
    verify-update-trust-surface.js
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
```

## License

MIT — see [LICENSE](LICENSE).
