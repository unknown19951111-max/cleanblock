# CleanBlock

Privacy-preserving content blocker for Chrome, built on Manifest V3.

## What It Does

CleanBlock blocks ads, trackers, and annoyances using Chrome's `declarativeNetRequest` API. No host permissions, no content scripts, no telemetry, no build step — the source in this repo is the exact code that runs in Chrome.

<!-- TODO: Add popup screenshot showing trust state card and active rulesets -->

## Load in Chrome

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** and select the `cleanblock/` folder
5. Confirm no error badge on the extension card

See [LOCAL_SMOKE_TEST.md](docs/LOCAL_SMOKE_TEST.md) for a full verification checklist.

## Why This Matters

Most ad blockers ask you to trust their code. CleanBlock asks you to verify it.

- **No host permissions.** DNR rulesets operate without access to page content.
- **No telemetry.** Nothing leaves the device. No analytics, no outbound requests.
- **No content scripts, no build step.** Raw source ships directly — a reviewer can read every line that executes.

Every trust claim is mechanically verifiable: `npm run verify`.

## Current Status

**Done:**

- Static DNR rulesets (core ads, privacy trackers, annoyances)
- Manual user allowlist with domain validation
- Signed update validation pipeline — shape, version, signature, hash, rule validation (scaffold only — not connected to a live endpoint)
- Last-known-good / rollback state management
- Trust summary popup (replaces cosmetic blocked counters)
- Four automated verification scripts
- Trust documentation and machine-readable schemas
- MV3 ES module architecture (no bundler)

**Planned (v0.2):**

- CSS cosmetic filtering via `chrome.scripting.insertCSS()`
- Test-framework-based trust tests (see [tests/trust/README.md](tests/trust/README.md))

## Trust Model

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

A signed update can add, remove, or modify DNR block/allow/upgradeScheme rules. It cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

Trust documentation lives in [`trust/`](trust/) — covers telemetry, allowlist, permissions, security, and build provenance.

## Verification

```
npm run verify
```

Runs four scripts in sequence:

| Script | Checks |
|--------|--------|
| `verify:manifest` | MV3, exact permissions, forbidden permissions, icon/ruleset file existence, ES module syntax |
| `verify:rulesets` | Valid JSON, unique IDs, correct ID ranges, block-only actions, no main_frame |
| `verify:privacy` | No fetch/XHR, no remote URLs, no eval, no forbidden Chrome APIs, no DEV handlers, no key material |
| `verify:trust` | Trust docs, schema files, example manifest, all trust functions present, popup trust UI |

## Architecture

Permissions: `storage`, `declarativeNetRequest`, `alarms` — nothing else. No `host_permissions`, no `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `management`, `offscreen`, or `declarativeNetRequestFeedback`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for service worker modules, rule ID ranges, and the update validation pipeline.

## Repo Structure

```
src/background/   — Service worker modules (no bundler)
src/popup.*       — Trust dashboard UI
rules/static/     — DNR rulesets (ads, trackers, annoyances)
trust/            — Trust documentation
scripts/          — Automated verification (npm run verify)
schemas/          — Machine-readable trust schemas
```

## License

MIT — see [LICENSE](LICENSE).
