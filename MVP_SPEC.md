# CleanBlock MVP Spec

> A Manifest V3 privacy-preserving content blocker with signed rule updates, local-only stats, user-controlled exceptions, and CI-enforced public trust claims.

**Status:** LOCKED — do not add features beyond this spec without explicit unlock.

---

## 1. Product Identity

**Name:** CleanBlock

**One-liner:** MV3 content blocker that proves privacy engineering and trust architecture, not ad-war tactics.

**Position:** This is a portfolio-grade browser extension demonstrating MV3 mastery, supply-chain security, permission minimization, and auditable trust design. It is not a commercial product competing with uBlock Origin, AdBlock Plus, or Pie.

**Hard non-goal:** This project does not attempt to bypass YouTube, Twitch, or platform-specific video advertising systems. Its purpose is to demonstrate browser-extension trust engineering, MV3 architecture, and auditable privacy design.

---

## 2. Non-Goals

These are explicitly excluded. Each exclusion is an architectural decision, not a deferral.

| Excluded | Reason |
|----------|--------|
| YouTube/Twitch ad blocking | Arms race, not architecture |
| Scriptlet injection engine | Too close to remote-code-execution boundary |
| Affiliate/rewards allowlists | No business model in the MVP |
| Shopping/cashback/AI features | Separate product surfaces entirely |
| Third-party analytics (Segment, GA, etc.) | Contradicts privacy positioning |
| `externally_connectable` website bridge | No website needs to talk to a pure blocker |
| React in content scripts | Vanilla DOM for any minimal UI |
| Remote graceful-fail messaging | No remote behavior control |
| Timer acceleration / page API monkeypatching | No aggressive page intervention |
| Acceptable Ads / fair ads program | No company-controlled exceptions |
| `cookies` permission | Near-disqualifying for a privacy blocker |
| `management` permission | Extension inventory is privacy-sensitive |
| `webRequest` permission | DNR replaces this in MV3 |
| `offscreen` permission | Not needed for pure blocking |
| Cosmetic filtering (deferred to v0.2) | v0.1 is DNR-only to minimize permission surface |

---

## 3. Permission Model

### v0.1 — DNR-only blocker

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "alarms"
  ]
}
```

No `host_permissions`. MV3 `declarativeNetRequest` with static and dynamic rulesets does not require host access for `block`, `allow`, or `upgradeScheme` actions.

**Permission justification:**

| Permission | Feature | Why required |
|------------|---------|-------------|
| `storage` | Settings, user allowlist, last-known-good state | Core data persistence |
| `declarativeNetRequest` | Network-level ad/tracker blocking | Core blocking engine |
| `alarms` | Scheduled filter update checks | Automatic signed-update polling |

**Explicitly not requested:** `host_permissions`, `cookies`, `tabs`, `scripting`, `webNavigation`, `webRequest`, `management`, `offscreen`, `unlimitedStorage`, `declarativeNetRequestFeedback`, `declarativeNetRequestWithHostAccess`.

### v0.2 — Add cosmetic filtering

```json
{
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "alarms",
    "scripting"
  ]
}
```

`scripting` added for `chrome.scripting.insertCSS()` cosmetic element hiding. No content script execution — CSS injection only. `host_permissions` may be required for CSS injection targeting specific sites — evaluate at v0.2 scope and document the tradeoff explicitly if added.

---

## 4. DNR Rule Architecture

### Static rules (packaged, reviewed)

```
rules/
  static/
    core-ads.json          # ad network domains
    privacy-trackers.json  # tracker domains
    annoyances.json        # cookie banners, popups, self-promos
```

Small curated rulesets. Quality over quantity. Each rule traceable to a known ad/tracker domain with a public source.

### Dynamic rules (runtime, from signed updates)

Applied via `chrome.declarativeNetRequest.updateDynamicRules()` after signature and hash verification. Never exceed Chrome's dynamic rule limit. Always preservable as last-known-good.

### Rule format

Standard DNR JSON. No custom DSL. No scriptlet directives. No executable filter syntax.

```json
{
  "id": 1,
  "priority": 1,
  "action": { "type": "block" },
  "condition": {
    "urlFilter": "||example-ad-network.com^",
    "resourceTypes": ["script", "image", "xmlhttprequest", "sub_frame"]
  }
}
```

### Session rules

Not used in v0.1. Reserved for future per-tab temporary rules if needed.

---

## 5. Signed Update Architecture

### Update flow

```
1. alarm fires (every N hours)
2. fetch manifest from update endpoint (HTTPS)
3. verify manifest signature (Ed25519, hardcoded public key)
4. compare version against current
5. if newer: fetch rule file
6. verify rule file SHA-256 hash against manifest
7. validate rules against remote-rule-schema.json
8. apply as dynamic DNR rules
9. store as current-good
10. preserve previous as last-known-good
```

### Manifest format

```json
{
  "version": 2,
  "rules_url": "https://rules.cleanblock.example/v2/rules.json",
  "rules_sha256": "abc123...",
  "released": "2026-06-19T00:00:00Z",
  "signature": "<Ed25519 signature over version + rules_url + rules_sha256 + released>"
}
```

### Rejection conditions

Update is rejected and last-known-good preserved if:

- Manifest signature invalid
- Rule file hash mismatch
- Rules fail schema validation
- Rule count exceeds dynamic rule budget
- Rule contains disallowed action types

### Rollback triggers

- Signature/hash verification failure
- Schema validation failure
- Content-script crash loop (if v0.2 cosmetic filtering is active)
- Manual user rollback from popup

### Key management

- Ed25519 keypair generated offline
- Public key hardcoded in extension source
- Private key never in repo, never in CI, never on server
- Signing happens on developer machine pre-publish

---

## 6. Local-Only Stats

All counters stored in `chrome.storage.local`. Nothing transmitted. Ever.

### Stored fields

```json
{
  "stats": {
    "blocked_today": 0,
    "blocked_total": 0,
    "last_reset_date": "2026-06-19",
    "ruleset_version": 1,
    "ruleset_source": "static",
    "last_update_check": "2026-06-19T12:00:00Z",
    "last_update_status": "success",
    "rollback_active": false,
    "rollback_reason": null
  }
}
```

### Daily reset

`blocked_today` resets when `last_reset_date` !== current date. Triggered on popup open or alarm.

### What is never stored

- URLs
- Domains visited
- Page titles
- Video IDs
- Per-site blocking history
- Browsing timeline
- Cookie values
- Installed extension inventory

---

## 7. User Allowlist Governance

### Hierarchy

```
0. Safety/security invariants (non-bypassable)
1. Explicit user blocklist / allowlist (sovereign)
2. Default blocking rules (transparent, overridable)
```

No tier 3 (creator signals), tier 4 (community policy), or tier 5 (company exceptions) in MVP.

### User allowlist behavior

- User pauses blocking on a site → site added to allowlist in `chrome.storage.local`
- DNR rules for that site are disabled via `chrome.declarativeNetRequest.updateEnabledRulesets()` or dynamic rule exceptions
- User unpauses → site removed from allowlist, rules re-enabled
- Allowlist is local-only, never transmitted

### Governance rules

- No company-controlled exceptions
- No affiliate allowlists
- No revenue-linked exceptions
- No remote override of user allowlist
- User block always wins over default allow
- User allow always wins over default block (except malware/phishing if added later)

---

## 8. Fail-State Rules

### Governing principle

Fail toward the user's last known intent, not toward any business outcome.

### Failure cascade

```
NORMAL
  ↓ update fetch fails
CACHED_RULES (last-known-good)
  ↓ signature/hash verification fails
REJECT_UPDATE → stay on current rules
  ↓ current rules cause errors
STATIC_FALLBACK (packaged rules only)
  ↓ user notices degradation
USER_INFORMED (badge/popup notice)
```

### Rules

1. Never silently allow ads that were previously blocked.
2. Never switch from blocked to allowed state without user action.
3. Never use failure states for monetization, persuasion, or rewards messaging.
4. Bad remote updates roll back locally — do not depend on remote rescue.
5. Circuit breaker: after N consecutive update failures, back off exponentially.
6. Trust/security failures (bad signature, bad hash) are hard rejections, not retries.
7. Failure telemetry stays local (counter increments, not event streams).

---

## 9. Trust Package

### Required documents

```
trust/
  TELEMETRY.md           # "No telemetry leaves this device"
  ALLOWLIST.md           # "No business/revenue exceptions"
  PERMISSIONS.md         # Permission-to-feature mapping
  SECURITY.md            # Signed updates, threat model, rollback
  REMOTE_RULES.md        # Remote data boundary: what remote rules CAN and CANNOT express
  BUILD_PROVENANCE.md    # How to verify installed extension matches source
```

### Required machine-readable schemas

```
schemas/
  telemetry-schema.json      # Empty/minimal — proves no outbound telemetry
  allowlist.json              # Empty — proves no business exceptions
  permission-map.json         # Maps each permission to feature + code path
  remote-rule-schema.json     # JSON Schema for accepted remote rule format
  store-claims.json           # Maps each store listing claim to artifact + test
```

### TELEMETRY.md content

States clearly: this extension sends no data to any server except signed-rule update checks. Update checks transmit only: HTTPS request to a known URL. No user ID. No browsing context. No cookies. No referrer beyond default browser behavior.

### ALLOWLIST.md content

States clearly: this extension has no company-controlled, revenue-linked, or affiliate exceptions. The only allowlist is the user's own per-site pause list, stored locally.

---

## 10. CI Trust Tests

### Test suite structure

```
tests/trust/
  telemetry-forbidden-fields.test.ts
  allowlist-ledger.test.ts
  permission-drift.test.ts
  remote-rule-parser.test.ts
  signed-update.test.ts
  rollback.test.ts
  store-claims.test.ts
```

### Test specifications

**telemetry-forbidden-fields**
- Grep entire codebase for outbound fetch/XHR calls
- Verify no URL, domain, title, video ID, channel ID, search query, referrer, cookie value, or extension inventory appears in any payload
- Verify no third-party analytics SDK (Segment, GA, Mixpanel, Amplitude) is imported or bundled

**allowlist-ledger**
- Parse `allowlist.json`
- Verify it is empty (no business exceptions)
- Verify no DNR rule has action type `allow` unless it is a site-breakage fix with a documented reason

**permission-drift**
- Parse `manifest.json` permissions
- Compare against `permission-map.json`
- Fail if any permission exists without a mapped feature
- Fail if `cookies`, `management`, `webRequest`, `offscreen`, or `declarativeNetRequestFeedback` appear

**remote-rule-parser**
- Feed malicious rule fixtures to the rule validator
- Verify rejection of: arbitrary JS bodies, eval-like patterns, Function constructor, unknown action types, missing required fields
- Verify acceptance of: valid DNR block/allow/redirect rules within schema

**signed-update**
- Verify valid signature + valid hash → rules applied
- Verify invalid signature → rules rejected, last-known-good preserved
- Verify valid signature + wrong hash → rules rejected
- Verify missing signature → rules rejected

**rollback**
- Simulate bad update → verify last-known-good rules restored
- Simulate N consecutive failures → verify exponential backoff
- Verify rollback state visible in popup

**store-claims**
- Parse `store-claims.json`
- For each claim, verify mapped artifact file exists and mapped test file exists
- Fail if any claim has no artifact or no test

---

## 11. v0.1 Build Checklist

Build order (each step verified before proceeding):

```
[ ] 1. manifest.json — minimal permissions, no content scripts
[ ] 2. Static DNR rulesets — core-ads.json, privacy-trackers.json, annoyances.json
[ ] 3. Background service worker — alarm setup, update check, message handling
[ ] 4. Popup dashboard — blocked counts, ruleset version, update status, allowlist controls
[ ] 5. Local stats engine — chrome.storage.local counters, daily reset
[ ] 6. User allowlist — per-site pause/unpause, stored locally
[ ] 7. Signed update manifest — Ed25519 verification, SHA-256 hash check
[ ] 8. Hash verification — rule file integrity before applying
[ ] 9. Last-known-good rollback — preserve previous rules, restore on failure
[ ] 10. Trust documents — TELEMETRY.md, ALLOWLIST.md, PERMISSIONS.md, SECURITY.md, REMOTE_RULES.md, BUILD_PROVENANCE.md
[ ] 11. Machine-readable schemas — all .json schema files
[ ] 12. CI trust tests — all 7 test files passing
[ ] 13. README.md — positioning, architecture summary, non-goals
[ ] 14. Chrome Web Store submission package — screenshots, description, privacy policy
```

### Done criteria

The MVP is complete when:

1. Extension installs cleanly in Chrome with only `storage`, `declarativeNetRequest`, and `alarms` permissions
2. Static DNR rules block a curated set of ad/tracker domains
3. Popup shows local-only blocked counts and ruleset health
4. User can pause/unpause blocking per site
5. Signed update flow works end-to-end with Ed25519 + SHA-256
6. Bad updates are rejected and last-known-good is preserved
7. All 7 CI trust tests pass
8. Every store claim maps to an artifact and a test
9. A skeptical reviewer can verify or falsify every trust claim in under one hour using only the public repo

---

## Appendix: Governing Laws

From the 12-question architectural grilling session:

1. **Remote updates may choose behavior; remote updates may not define new behavior.**
2. **One user intent = one permission boundary = one product surface.**
3. **Fail toward the user's last known intent, not toward the business's preferred outcome.**
4. **Every trust claim must be independently falsifiable.**
5. **The MVP should be boring in user features and impressive in architecture.**
