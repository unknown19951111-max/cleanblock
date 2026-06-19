# CleanBlock Security Model

## Signed update validation

Remote rule updates are validated through a multi-stage pipeline before application:

1. **Manifest shape validation** — reject unknown fields
2. **Monotonic version check** — new version must be strictly greater than current
3. **Ed25519 signature verification** — verify against hardcoded public key (scaffold — placeholder key in v0.1)
4. **File presence and type check** — only `dnr_dynamic_ruleset_update` type accepted
5. **SHA-256 hash verification** — each rule file hash must match manifest declaration
6. **DNR rule validation** — allowed actions only, allowed fields only, recursive executable-field rejection, ID range enforcement (60000–89999)
7. **Atomic application** — single `updateDynamicRules` call (remove old + add new)
8. **On failure** — record failure, activate rollback, preserve last-known-good

## Trust law

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

A signed update can add, remove, or modify DNR block/allow/upgradeScheme rules. It cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

## No remote executable behavior

The service worker rejects any remote rule containing:

- `eval`, `Function()`, `setTimeout`/`setInterval` with string arguments
- `javascript:` URLs
- `data:` URLs with executable MIME types
- Content script paths
- Scriptlet directives
- Unknown action types

## Runtime message surface

The extension exposes exactly 4 runtime message handlers:

- `GET_HEALTH` — read-only health/status query
- `GET_ALLOWLIST` — read-only allowlist query
- `ADD_ALLOWLIST_DOMAIN` — add user domain exception
- `REMOVE_ALLOWLIST_DOMAIN` — remove user domain exception

No development, debug, or administrative handlers exist in the production service worker.

## Key management

- Ed25519 keypair to be generated offline on the developer machine
- Public key hardcoded in extension source
- Private key never committed to the repository
- Private key never in CI pipelines
- Private key never on any server
- Signing happens pre-publish on the developer machine only
- `.gitignore` blocks `*.pem`, `*.key`, `private-key*`, and related patterns
- `verify:privacy` script scans for accidentally committed key material

## Rollback

- Failed updates trigger automatic rollback to last-known-good ruleset
- Rollback state is visible in the popup trust card
- Circuit breaker: consecutive failures trigger exponential backoff
- Trust/security failures (bad signature, bad hash) are hard rejections, not retries
