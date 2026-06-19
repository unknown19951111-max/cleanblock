# CleanBlock

A Manifest V3 privacy-preserving content blocker for Chrome, built as a portfolio-grade demonstration of trust engineering, MV3 architecture, and auditable privacy design.

## What CleanBlock Is

- **MV3 content blocker** using `declarativeNetRequest` — no content scripts, no injected JavaScript
- **Local-only stats** — blocked counts stored in `chrome.storage.local`, never transmitted
- **Manual user allowlist** — domain-level blocking exceptions entered by the user, not inferred from browsing
- **Signed update validation scaffold** — SHA-256 hash verification, Ed25519 signature scaffold, strict manifest and DNR rule validation
- **Last-known-good / rollback state** — failed updates trigger rollback with full state consistency
- **Automated trust and privacy regression checks** — four verification scripts covering manifest, rulesets, privacy, and trust surface

## What CleanBlock Is Not

- Not a YouTube or Twitch ad-bypass tool
- Not a clone of Pie AdBlock or any rewards/affiliate system
- Not an AI-powered blocker
- Not a telemetry or analytics product
- Not a filter-list aggregator (no EasyList, no uBlock Origin imports)

## Architecture

### Permissions

```
storage, declarativeNetRequest, alarms
```

No `host_permissions`. No `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `management`, `offscreen`, or `declarativeNetRequestFeedback`.

CleanBlock does not request host permissions. It uses Manifest V3 `declarativeNetRequest` rules to block content without asking to read or modify page contents across all websites.

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
4. File presence check
5. File type check
6. SHA-256 hash verification per file
7. DNR rule validation — allowed actions, allowed fields, recursive executable-field rejection, ID range enforcement
8. Atomic application — single `updateDynamicRules` call (remove old + add new)
9. On failure: record failure, activate rollback, preserve last-known-good

### Popup Trust Surface

The extension popup displays a trust summary and read-only Update Trust State card.

**Trust summary:**

- Protection status (active/inactive)
- Static rulesets enabled count
- Per-request stats: not collected
- Telemetry: none
- Updates: local validation scaffold
- Allowlist: manual only

CleanBlock intentionally does not show per-request blocked counts. Under Manifest V3, accurate DNR match counting requires `declarativeNetRequestFeedback` or tab-scoped observability permissions. CleanBlock avoids those permissions to preserve its minimal-permission boundary.

**Update Trust State card:**

- Current ruleset version and source
- Last successful update timestamp
- Last failure stage and consecutive failure count
- Rollback status
- Last-known-good ruleset version

## Trust Documentation

| Document | Contents |
|----------|----------|
| [trust/TELEMETRY.md](trust/TELEMETRY.md) | No telemetry leaves the device |
| [trust/ALLOWLIST.md](trust/ALLOWLIST.md) | Manual allowlist behavior, no business exceptions |
| [trust/PERMISSIONS.md](trust/PERMISSIONS.md) | Exact permissions and why each is excluded |
| [trust/SECURITY.md](trust/SECURITY.md) | Signed update validation, runtime message surface, key management |
| [trust/BUILD_PROVENANCE.md](trust/BUILD_PROVENANCE.md) | No build step — raw source ships directly |

## Trust Law

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

A signed update can add, remove, or modify DNR block/allow/upgradeScheme rules. It cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

Every trust claim in the documentation is mechanically verifiable by running the verification suite.

## Verification

```
npm run verify
```

Runs all four verification scripts in sequence:

| Command | Checks |
|---------|--------|
| `npm run verify:manifest` | MV3, exact permissions, forbidden permissions, ruleset files, syntax validation |
| `npm run verify:rulesets` | Valid JSON, unique IDs, correct ID ranges, block-only actions, no main_frame |
| `npm run verify:privacy` | No fetch/XHR, no remote URLs, no eval, no forbidden Chrome APIs, local-only references |
| `npm run verify:trust` | Trust docs exist, example manifest valid, all trust functions present, popup trust UI elements |

## Local Smoke Test

See [docs/LOCAL_SMOKE_TEST.md](docs/LOCAL_SMOKE_TEST.md) for a step-by-step checklist to load the extension in Chrome and verify popup, allowlist, trust state, and stability.

## Project Status

- MVP architecture scaffold: **complete**
- Remote update fetching: **intentionally not implemented** — validation and application logic exist, but no endpoint is contacted
- Production signing key: **intentionally placeholder** — real Ed25519 keypair to be generated offline before any signed update is published
- Chrome Web Store submission: **not yet** — requires real signing key, icon assets, and store listing

## License

MIT

## File Structure

```
cleanblock/
  manifest.json
  package.json
  src/
    background/service-worker.js
    popup.html
    popup.css
    popup.js
  rules/static/
    core-ads.json
    privacy-trackers.json
    annoyances.json
  updates/
    update-manifest.example.json
    README.md
  docs/
    REMOTE_RULES.md
    LOCAL_SMOKE_TEST.md
  scripts/
    verify-manifest.js
    verify-rulesets.js
    verify-no-privacy-regressions.js
    verify-update-trust-surface.js
```
