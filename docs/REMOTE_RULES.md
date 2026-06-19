# Remote Rules Boundary

## Governing Law

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

## What Remote Rules CAN Express

- Block a network request by domain, URL pattern, or resource type (DNR `block` action)
- Allow a network request that would otherwise be blocked (DNR `allow` action)
- Upgrade an HTTP request to HTTPS (DNR `upgradeScheme` action)
- Modify request/response headers within DNR's declarative model (future, if needed)
- Replace the contents of a known static ruleset with updated DNR rules of the same format

## What Remote Rules CANNOT Express

- JavaScript execution of any kind
- Content script injection
- Scriptlet injection (ABP/uBO-style)
- `eval()`, `new Function()`, `setTimeout(string)`, or equivalent
- DOM manipulation
- Cookie reading or writing
- Page content inspection
- Redirect to an arbitrary URL controlled by the update server
- Permission escalation
- Modification of the extension's own code or manifest
- Any behavior not already defined in the shipped extension code

## Allowed Rule Types

| Type | Description | Allowed |
|------|-------------|---------|
| `dnr_dynamic_ruleset_update` | Signed, hash-verified DNR JSON applied as dynamic rules through the extension's packaged update logic | Yes |
| `scriptlet` | Inject JavaScript snippets into pages | No |
| `content_script` | Inject content scripts | No |
| `executable` | Any form of executable code | No |
| `redirect_url` | Redirect requests to server-controlled URLs | No |

## Allowed DNR Action Types in Remote Rules

| Action | Allowed | Notes |
|--------|---------|-------|
| `block` | Yes | Core blocking functionality |
| `allow` | Yes | Site-breakage fixes only, must have documented reason |
| `allowAllRequests` | No | Too broad for remote control |
| `upgradeScheme` | Yes | HTTP-to-HTTPS upgrade |
| `redirect` | No | Could be used to inject tracking |
| `modifyHeaders` | No (v0.1) | Reserved for future with strict validation |

## Validation Requirements

Every remote rule file must pass:

1. Valid JSON
2. Array of objects
3. Each object is a valid Chrome DNR rule
4. Only allowed action types (see table above)
5. No fields outside the DNR schema
6. SHA-256 hash matches the update manifest
7. Rule count matches the update manifest
8. Ed25519 signature on the update manifest is valid

## Rejection Behavior

If any validation step fails:
- The entire update is rejected (no partial application)
- Current rules remain in effect
- Last-known-good state is preserved
- Failure is recorded locally as a counter increment (no event stream)
- No data about the failure is transmitted anywhere
